import { SFX } from "./audio"
import { evaluateAch } from "./achievements"
import { LEVELS, type LevelSpec, type PatternSpec } from "./levels"
import { POWER_META, TIER } from "./palette"
import type {
  Ball,
  Block,
  BossState,
  Bubble,
  Particle,
  Phase,
  Popup,
  PowerType,
  PowerUp,
  Projectile,
  Ring,
} from "./types"
import type { HudData } from "./types"
import { clamp, daySeed, fitTilt, lsGet, lsSet, mulberry32, rand, rotatedExtents } from "./utils"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "./upgrades"

export { UPGRADES_ENABLED, UPGRADE_DEFS } from "./upgrades"
export type { Block, HudData, Phase, PowerType } from "./types"

/* ==================================================================== */

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private onHud: (h: HudData) => void

  private raf = 0
  private last = 0
  private destroyed = false
  private time = 0

  private w = 960
  private h = 640
  private dpr = 1

  private phase: Phase = "menu"
  private score = 0
  private best = 0
  private lives = 3
  private level = 1
  private combo = 0
  private newRecord = false
  /** статистика текущей партии — для достижений */
  private runBossKills = 0
  private runLivesLost = 0
  /** очередь открытых достижений до следующей отправки HUD */
  private achQueue: string[] = []

  private mode: "campaign" | "endless" = "campaign"
  private wave = 0
  private waveSpec: { name: string; speed: number } | null = null

  private paddle = { x: 480, y: 600, w: 150, baseW: 150, h: 18, vx: 0, squash: 0 }
  /** Множитель ширины ракетки от прокачки (апгрейд «paddle»). */
  private paddleWidthMult = 1
  private balls: Ball[] = []
  private blocks: Block[] = []
  private powers: PowerUp[] = []
  private projectiles: Projectile[] = []
  private particles: Particle[] = []
  private rings: Ring[] = []
  private popups: Popup[] = []
  private bubbles: Bubble[] = []

  private keys = { left: false, right: false, space: false }
  private pointerX: number | null = null
  private locked = false
  private lockFailed = false
  private virtualX: number | null = null
  private tapFire = false
  private shake = 0

  private wideUntil = 0
  private slowUntil = 0
  private fastUntil = 0
  private shrinkUntil = 0
  private laserUntil = 0
  private laserArmed = false
  private laserArmedUntil = 0
  private laserWasOn = false
  private rocketUntil = 0
  private fireUntil = 0
  private magnetUntil = 0
  private weaponCd = 0
  private shield = 0

  private boss: BossState | null = null
  private bossHitCd = 0
  private boomQueue: { x: number; y: number; at: number }[] = []

  private spawnTimer = 18
  private skyDropTimer = 22
  private shiftTimer = 14
  private fieldShift: null | { t: number; dur: number; dx: number; dy: number } = null
  private blocksInitial = 1

  private coins = 0
  private upgrades: Record<string, number> = {}

  private banner: string | null = null
  private bannerTimer = 0
  private transition = 0
  private hitStop = 0
  private flash = 0
  private countdown = 0
  private levelLostBall = false
  private effectsKey = ""

  private top: number[] = []
  private topEndless: number[] = []

  sfx = new SFX()

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudData) => void) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no 2d context")
    this.ctx = ctx
    this.onHud = onHud
    this.best = Number(lsGet("sharoboy-best") || 0) || 0
    try {
      const parsed = JSON.parse(lsGet("sharoboy-top") || "[]") as unknown
      this.top = Array.isArray(parsed)
        ? (parsed as number[]).filter((n) => typeof n === "number")
        : []
    } catch {
      this.top = []
    }
    try {
      const parsedE = JSON.parse(lsGet("sharoboy-top-endless") || "[]") as unknown
      this.topEndless = Array.isArray(parsedE)
        ? (parsedE as number[]).filter((n) => typeof n === "number")
        : []
    } catch {
      this.topEndless = []
    }
    this.loadProgress()
  }

  /* ---------- сохранение валюты/прокачки ---------- */

  private loadProgress() {
    try {
      this.coins = Math.max(0, Number(lsGet("sharoboy-coins") || 0) || 0)
      const up = JSON.parse(lsGet("sharoboy-upgrades") || "{}") as unknown
      this.upgrades = up && typeof up === "object" ? (up as Record<string, number>) : {}
    } catch {
      this.coins = 0
      this.upgrades = {}
    }
  }

  private saveProgress() {
    lsSet("sharoboy-coins", String(this.coins))
    lsSet("sharoboy-upgrades", JSON.stringify(this.upgrades))
  }

  private addCoins(n: number) {
    const mult = 1 + (this.upgrades.coin ?? 0)
    this.coins += n * mult
    this.saveProgress()
    this.pushHud()
  }

  /** Покупка постоянного улучшения — вызывается будущим UI прокачки. */
  buyUpgrade(id: string): boolean {
    if (!UPGRADES_ENABLED) return false
    const def = UPGRADE_DEFS.find((d) => d.id === id)
    if (!def) return false
    const lvl = this.upgrades[id] ?? 0
    if (lvl >= def.max) return false
    const price = def.cost(lvl)
    if (this.coins < price) return false
    this.coins -= price
    this.upgrades[id] = lvl + 1
    this.saveProgress()
    this.applyUpgrades()
    this.pushHud()
    return true
  }

  private applyUpgrades() {
    const paddleLvl = this.upgrades.paddle ?? 0
    this.paddleWidthMult = 1 + 0.12 * paddleLvl
    this.paddle.baseW = clamp(this.w * 0.18, 110, 200) * this.paddleWidthMult
  }

  /* ---------- жизненный цикл ---------- */

  attach() {
    this.handleResize()
    window.addEventListener("resize", this.handleResize)
    window.addEventListener("keydown", this.handleKeyDown)
    window.addEventListener("keyup", this.handleKeyUp)
    window.addEventListener("blur", this.handleBlur)
    window.addEventListener("pointermove", this.handlePointerMove)
    window.addEventListener("mousemove", this.handlePointerMove)
    document.addEventListener("pointerlockchange", this.handleLockChange)
    document.addEventListener("pointerlockerror", this.handleLockError)
    this.canvas.addEventListener("pointerdown", this.handlePointerDown)
    this.canvas.addEventListener("pointerup", this.handlePointerUp)
    this.canvas.addEventListener("pointercancel", this.handlePointerUp)
    for (let i = 0; i < 26; i++) {
      this.bubbles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: rand(2, 7),
        vy: rand(14, 46),
        ph: rand(0, Math.PI * 2),
      })
    }
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
    this.pushHud()
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener("resize", this.handleResize)
    window.removeEventListener("keydown", this.handleKeyDown)
    window.removeEventListener("keyup", this.handleKeyUp)
    window.removeEventListener("blur", this.handleBlur)
    window.removeEventListener("pointermove", this.handlePointerMove)
    window.removeEventListener("mousemove", this.handlePointerMove)
    document.removeEventListener("pointerlockchange", this.handleLockChange)
    document.removeEventListener("pointerlockerror", this.handleLockError)
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown)
    this.canvas.removeEventListener("pointerup", this.handlePointerUp)
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp)
  }

  private loop = (t: number) => {
    if (this.destroyed) return
    const dtRaw = clamp((t - this.last) / 1000, 0, 0.033)
    this.last = t
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dtRaw)
    const dt = this.hitStop > 0 ? dtRaw * 0.18 : dtRaw
    this.time += dt
    this.flash = Math.max(0, this.flash - dtRaw * 2.6)
    try {
      this.update(dt)
      this.draw()
    } catch (err) {
      console.error("[ШАРОБОЙ] ошибка в игровом цикле:", err)
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private handleResize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    const ow = this.w
    const oh = this.h
    this.w = window.innerWidth
    this.h = window.innerHeight
    this.canvas.width = Math.floor(this.w * this.dpr)
    this.canvas.height = Math.floor(this.h * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // Экранный размер канваса задаём явно: canvas — replaced-элемент, без явных
    // CSS-размеров он берёт размер атрибутов (w*dpr × h*dpr) и при
    // devicePixelRatio != 1 (масштаб ОС 125%/150%, Retina) вылезает за экран.
    this.canvas.style.width = `${this.w}px`
    this.canvas.style.height = `${this.h}px`
    this.paddle.baseW = clamp(this.w * 0.18, 110, 200) * this.paddleWidthMult
    this.paddle.y = this.h - 34
    this.paddle.x = clamp(this.paddle.x, this.paddle.w / 2 + 4, this.w - this.paddle.w / 2 - 4)
    if (ow && oh && this.blocks.length && (ow !== this.w || oh !== this.h)) {
      const sx = this.w / ow
      const sy = this.h / oh
      for (const b of this.blocks) {
        b.x = clamp(b.x * sx, b.rx + 6, this.w - b.rx - 6)
        b.x0 = clamp(b.x0 * sx, b.rx + 6, this.w - b.rx - 6)
        b.y = clamp(b.y * sy, b.ry + 6, this.h * 0.75)
      }
    }
  }

  /* ---------- ввод ---------- */

  private handleKeyDown = (e: KeyboardEvent) => {
    const c = e.code
    if (c === "ArrowLeft" || c === "KeyA") this.keys.left = true
    if (c === "ArrowRight" || c === "KeyD") this.keys.right = true
    if (c === "Space") e.preventDefault()
    if (c === "Space" || c === "Enter") {
      if (this.phase === "menu" || this.phase === "over" || this.phase === "won") this.startGame()
      else if (this.phase === "playing") this.launch()
    }
    if (c === "Space") this.keys.space = true
    if (c === "KeyP" || c === "Escape") {
      if (this.phase === "playing" || this.phase === "paused") this.togglePause()
    }
    if (c === "KeyM") this.toggleMute()
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false
    if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false
    if (e.code === "Space") this.keys.space = false
  }

  private handleBlur = () => {
    this.keys.left = false
    this.keys.right = false
    this.keys.space = false
    this.pointerX = null
    if (this.phase === "playing") this.togglePause()
  }

  /* Координата указателя (clientX) → игровая координата X.
     Canvas растянут на весь экран, но прямоугольник считаем через
     getBoundingClientRect, чтобы компенсировать любые смещения/масштабы. */
  private clientToGameX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width > 0) return ((clientX - rect.left) / rect.width) * this.w
    return clientX - rect.left
  }

  /* Сколько игровых пикселей приходится на один CSS-пиксель канваса
     (для дельты movementX в режиме pointer lock). */
  private worldPerCssPx(): number {
    const rect = this.canvas.getBoundingClientRect()
    return rect.width > 0 ? this.w / rect.width : 1
  }

  private handlePointerMove = (e: PointerEvent | MouseEvent) => {
    if (this.locked) {
      const vx = (this.virtualX ?? this.paddle.x) + e.movementX * this.worldPerCssPx()
      this.virtualX = clamp(vx, 0, this.w)
      this.pointerX = this.virtualX
      return
    }
    this.pointerX = this.clientToGameX(e.clientX)
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.sfx.ensure()
    this.tapFire = true
    // Ракетку в точку касания НЕ перекидываем — палец/мышь могут быть далеко
    // от ракетки, и ракетка «уезжала» к месту тапа.
    if (this.phase === "playing") {
      if (e.pointerType === "touch") {
        // Тач: сначала ведём ракетку пальцем в нужное место, шар запускается
        // при отпускании (handlePointerUp).
        return
      }
      // Мышь/стилус: запуск сразу + pointer lock, как раньше.
      this.launch()
      this.requestLock()
    }
  }

  /* Отпускание пальца на таче = запуск шара (если он на ракетке). */
  private handlePointerUp = (e: PointerEvent) => {
    if (this.phase === "playing" && (e.pointerType === "touch" || e.pointerType === "pen")) {
      this.launch()
    }
  }

  private requestLock() {
    if (this.locked) return
    try {
      const el = this.canvas as HTMLCanvasElement & {
        requestPointerLock?: () => Promise<void> | void
      }
      if (typeof el.requestPointerLock !== "function") {
        this.lockFailed = true
        return
      }
      const res = el.requestPointerLock()
      if (res && typeof (res as Promise<void>).catch === "function") {
        ;(res as Promise<void>).catch(() => {
          this.lockFailed = true
        })
      }
    } catch {
      this.lockFailed = true
    }
  }

  private releaseLock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock?.()
    } catch {
      /* ignore */
    }
  }

  private handleLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas
    if (this.locked) {
      this.lockFailed = false
      this.virtualX = this.pointerX ?? this.paddle.x
    } else if (this.virtualX !== null) {
      this.pointerX = this.virtualX
    }
  }

  private handleLockError = () => {
    this.lockFailed = true
  }

  /* ---------- управление игрой ---------- */

  startGame() {
    this.sfx.ensure()
    this.sfx.ui()
    this.mode = "campaign"
    this.wave = 0
    this.waveSpec = null
    this.boss = null
    this.boomQueue = []
    this.score = 0
    this.lives = 3 + (this.upgrades.life ?? 0)
    this.combo = 0
    this.level = 1
    this.newRecord = false
    this.runBossKills = 0
    this.runLivesLost = 0
    this.particles = []
    this.rings = []
    this.popups = []
    this.powers = []
    this.projectiles = []
    this.wideUntil = 0
    this.slowUntil = 0
    this.fastUntil = 0
    this.shrinkUntil = 0
    this.laserUntil = 0
    this.laserArmed = false
    this.rocketUntil = 0
    this.fireUntil = 0
    this.magnetUntil = 0
    this.shield = 0
    this.weaponCd = 0
    this.effectsKey = ""
    this.transition = 0
    this.buildLevel(1)
    this.applyUpgrades()
    this.magnetUntil = this.time + 4 * (this.upgrades.magnet ?? 0)
    this.laserArmed = (this.upgrades.laser ?? 0) > 0
    this.serveBall()
    this.phase = "playing"
    this.setBanner(`УРОВЕНЬ 1 — ${LEVELS[0].name}`)
    this.pushHud()
  }

  startEndless() {
    this.sfx.ensure()
    this.sfx.ui()
    this.mode = "endless"
    this.wave = 1
    this.waveSpec = { name: "ВОЛНА 1", speed: 400 }
    this.boss = null
    this.boomQueue = []
    this.score = 0
    this.lives = 3 + (this.upgrades.life ?? 0)
    this.combo = 0
    this.level = 1
    this.newRecord = false
    this.runBossKills = 0
    this.runLivesLost = 0
    this.particles = []
    this.rings = []
    this.popups = []
    this.powers = []
    this.projectiles = []
    this.wideUntil = 0
    this.slowUntil = 0
    this.fastUntil = 0
    this.shrinkUntil = 0
    this.laserUntil = 0
    this.laserArmed = false
    this.rocketUntil = 0
    this.fireUntil = 0
    this.magnetUntil = 0
    this.shield = 0
    this.weaponCd = 0
    this.effectsKey = ""
    this.transition = 0
    this.buildWave(1)
    this.applyUpgrades()
    this.magnetUntil = this.time + 4 * (this.upgrades.magnet ?? 0)
    this.laserArmed = (this.upgrades.laser ?? 0) > 0
    this.serveBall()
    this.phase = "playing"
    this.setBanner("БЕСКОНЕЧНЫЙ РЕЖИМ — ВОЛНА 1")
    this.pushHud()
  }

  toMenu() {
    this.sfx.ui()
    this.releaseLock()
    this.phase = "menu"
    this.balls = []
    this.blocks = []
    this.powers = []
    this.projectiles = []
    this.boss = null
    this.boomQueue = []
    this.banner = null
    this.popups = []
    this.particles = []
    this.rings = []
    this.shake = 0
    this.flash = 0
    this.hitStop = 0
    this.pushHud()
  }

  togglePause() {
    if (this.phase === "playing") {
      this.phase = "paused"
      this.keys.space = false
      this.releaseLock()
      this.sfx.ui()
    } else if (this.phase === "paused") {
      this.phase = "playing"
      this.countdown = 3
      this.sfx.ui()
    }
    this.pushHud()
  }

  toggleMute() {
    this.sfx.muted = !this.sfx.muted
    if (!this.sfx.muted) this.sfx.ui()
    this.pushHud()
  }

  private launch() {
    let launched = false
    for (const b of this.balls) {
      if (b.stuck) {
        b.stuck = false
        const ang = -Math.PI / 2 + rand(-0.3, 0.3)
        b.vx = Math.cos(ang) * b.speed
        b.vy = Math.sin(ang) * b.speed
        launched = true
      }
    }
    if (launched) {
      this.sfx.launch()
      this.pushHud()
    }
  }

  /* ---------- построение уровней ---------- */

  private buildLevel(n: number) {
    this.buildFromSpec(LEVELS[n - 1])
  }

  private buildFromSpec(spec: LevelSpec) {
    this.levelLostBall = false
    this.boss = null
    this.boomQueue = []
    this.fieldShift = null
    if ("boss" in spec) {
      this.buildBossLevel(spec.boss.hp, spec.boss.minions, spec.boss.bombs)
      return
    }
    const margin = clamp(this.w * 0.055, 22, 72)
    const top = clamp(this.h * 0.14, 86, 160)
    const blocks: Block[] = []

    if ("layout" in spec) {
      // авторская раскладка в нормализованных координатах
      const zoneH = clamp(this.h * 0.42, 220, 420)
      let minX = Infinity
      let maxX = -Infinity
      let maxY = 0
      for (const it of spec.layout) {
        minX = Math.min(minX, it.x - it.rx)
        maxX = Math.max(maxX, it.x + it.rx)
        maxY = Math.max(maxY, it.y + (it.ry ?? it.rx))
      }
      const unit = Math.min(
        (this.w - margin * 2) / (maxX - minX || 1),
        zoneH / (maxY || 1),
        Math.min(this.w, this.h) * 0.075
      )
      const offsetX = -((minX + maxX) / 2) * unit
      for (const it of spec.layout) {
        const rx = Math.max(it.rx * unit, 8)
        const ry = Math.max((it.ry ?? it.rx) * unit, 8)
        const cx = clamp(
          this.w / 2 + offsetX + it.x * unit,
          margin * 0.5 + rx,
          this.w - margin * 0.5 - rx
        )
        blocks.push({
          x: cx,
          y: top + it.y * unit,
          rx,
          ry,
          rot: it.rot ?? 0,
          circle: Math.abs(rx - ry) < 0.6 && !it.rot,
          hp: it.hp,
          maxHp: it.hp,
          tier: it.hp,
          flash: 0,
          seed: rand(0, Math.PI * 2),
          dead: false,
          x0: cx,
          swayAmp: 0,
          swayFreq: 0,
          swayPh: 0,
          bomb: it.bomb ?? false,
          splits: it.splits ?? false,
        })
      }
      this.blocks = blocks
      this.blocksInitial = Math.max(1, blocks.length)
      return
    }

    // процедурная сетка
    const zoneH = clamp(this.h * 0.42, 220, 420)
    const gap = clamp(zoneH / spec.rows, 46, 78)
    for (let r = 0; r < spec.rows; r++) {
      let count = spec.counts[r % spec.counts.length]
      while ((this.w - margin * 2) / count < 60 && count > 3) count--
      const slot = (this.w - margin * 2) / count
      for (let i = 0; i < count; i++) {
        const kind = spec.shape(r, i)
        const isBomb = Math.random() < 0.07
        const isSplit = !isBomb && Math.random() < 0.09
        const hp = (isBomb ? 1 : spec.hp(r, i)) as 1 | 2 | 3
        const cx = clamp(
          margin + slot * (i + 0.5) + rand(-1, 1) * slot * 0.02,
          margin + slot * 0.3,
          this.w - margin - slot * 0.3
        )
        const cy = top + gap * (r + 0.5) + rand(-1, 1) * gap * 0.02
        let rx: number
        let ry: number
        if (kind === "circle" || isBomb) {
          const rr = clamp(Math.min(slot * 0.5, gap * 0.44) * rand(0.9, 1), 12, 42)
          rx = ry = rr
        } else if (kind === "eh") {
          rx = clamp(slot * 0.52 * rand(0.9, 1), 18, 60)
          ry = clamp(gap * 0.3 * rand(0.9, 1), 11, 27)
        } else {
          rx = clamp(slot * 0.27 * rand(0.9, 1), 10, 26)
          ry = clamp(gap * 0.47 * rand(0.9, 1), 15, 46)
        }
        const rot =
          kind !== "circle" && !isBomb && Math.random() < 0.65
            ? fitTilt(rx, ry, slot / 2 - 4, gap / 2 - 4)
            : 0
        blocks.push({
          x: cx,
          y: cy,
          rx,
          ry,
          rot,
          circle: kind === "circle" || isBomb,
          hp,
          maxHp: hp,
          tier: hp,
          flash: 0,
          seed: rand(0, Math.PI * 2),
          x0: cx,
          swayAmp: rand(5, 13),
          swayFreq: rand(0.5, 1.0) * (r % 2 === 0 ? 1 : -1),
          swayPh: rand(0, Math.PI * 2),
          bomb: isBomb,
          splits: isSplit,
          dead: false,
        })
      }
    }
    this.blocks = blocks
    this.blocksInitial = Math.max(1, blocks.length)
  }

  private buildWave(n: number) {
    this.waveSpec = { name: `ВОЛНА ${n}`, speed: clamp(380 + n * 22, 380, 650) }
    if (n % 5 === 0) {
      this.buildBossLevel(38 + n * 4, Math.min(5, 3 + Math.floor(n / 10)), 4)
      return
    }
    const rng = mulberry32(daySeed() * 31 + n * 7919)
    const rows = clamp(5 + Math.floor(n / 3), 5, 8)
    const spec: PatternSpec = {
      name: this.waveSpec.name,
      speed: this.waveSpec.speed,
      rows,
      counts: Array.from({ length: rows }, (_, r) =>
        clamp(6 + ((r + n) % 3) + Math.floor(n / 4), 6, 10)
      ),
      shape: () => {
        const t = rng()
        return (t < 0.5 ? "circle" : t < 0.78 ? "eh" : "ev") as "circle" | "eh" | "ev"
      },
      hp: (r) =>
        (r < rows * 0.4 ? (rng() < 0.4 ? 3 : 2) : r < rows * 0.75 ? (rng() < 0.45 ? 2 : 1) : 1) as
          1 | 2 | 3,
    }
    this.buildFromSpec(spec)
  }

  private buildBossLevel(hp: number, minions: number, bombs: number) {
    const top = clamp(this.h * 0.14, 86, 160)
    const r = clamp(Math.min(this.w, this.h) * 0.1, 52, 84)
    const baseY = top + r + 34
    this.boss = { x: this.w / 2, y: baseY, baseY, r, hp, maxHp: hp, t: 0, flash: 0, dropTimer: 5 }
    const blocks: Block[] = []
    const orbit = clamp(r * 2.5, 110, Math.min(this.w * 0.3, 280))
    for (let i = 0; i < minions; i++) {
      blocks.push({
        x: this.w / 2,
        y: baseY,
        rx: 15,
        ry: 15,
        rot: 0,
        circle: true,
        hp: 2,
        maxHp: 2,
        tier: 2,
        flash: 0,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: this.w / 2,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: false,
        minionOrbit: {
          ang: (i * Math.PI * 2) / minions,
          rad: orbit,
          dir: i % 2 ? 1 : -1,
          speed: 1.05,
        },
      })
    }
    const spots = [
      [0.13, 0.16],
      [0.87, 0.16],
      [0.13, 0.55],
      [0.87, 0.55],
      [0.5, 0.7],
    ]
    for (let i = 0; i < bombs; i++) {
      const [fx, fy] = spots[i % spots.length]
      const bx = clamp(this.w * fx, 40, this.w - 40)
      const by = top + fy * clamp(this.h * 0.42, 220, 420)
      blocks.push({
        x: bx,
        y: by,
        rx: 20,
        ry: 20,
        rot: 0,
        circle: true,
        hp: 1,
        maxHp: 1,
        tier: 1,
        flash: 0,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: bx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: true,
        splits: false,
      })
    }
    this.blocks = blocks
    this.blocksInitial = Math.max(1, blocks.length)
  }

  private levelSpeed() {
    return this.mode === "endless" ? (this.waveSpec?.speed ?? 400) : LEVELS[this.level - 1].speed
  }

  private levelDisplayName() {
    return this.mode === "endless" ? (this.waveSpec?.name ?? "ВОЛНА") : LEVELS[this.level - 1].name
  }

  private serveBall() {
    // базовая скорость повышена на 50%
    const base = clamp(
      Math.min(
        this.h * 0.62,
        (this.levelSpeed() + (this.mode === "endless" ? this.wave * 18 : this.level * 45)) * 1.5
      ),
      540,
      1140
    )
    const ball: Ball = {
      x: this.paddle.x,
      y: this.paddle.y - this.paddle.h / 2 - 9 - 2,
      vx: 0,
      vy: 0,
      r: 9,
      speed: base,
      stuck: true,
      stuckOffset: 0,
      trail: [],
      squash: 0,
      sinceHit: 0,
    }
    this.balls = [ball]
    this.spawnTimer = rand(16, 22)
    this.skyDropTimer = rand(18, 27)
    this.shiftTimer = rand(12, 18)
    this.fieldShift = null
    this.pushHud()
  }

  /* ---------- обновление ---------- */

  private update(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 26)

    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.grav * dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const r of this.rings) r.t += dt * 2.4
    this.rings = this.rings.filter((r) => r.t < 1)
    for (const p of this.popups) {
      p.t += dt
      p.y -= dt * 46
    }
    this.popups = this.popups.filter((p) => p.t < 1)

    for (const b of this.bubbles) {
      b.y -= b.vy * dt
      b.x += Math.sin(this.time * 0.8 + b.ph) * 12 * dt
      if (b.y < -20) {
        b.y = this.h + 20
        b.x = Math.random() * this.w
      }
    }

    if (this.countdown > 0 && this.phase === "playing") {
      const prev = Math.ceil(this.countdown)
      this.countdown = Math.max(0, this.countdown - dt)
      if (this.countdown > 0 && Math.ceil(this.countdown) !== prev) this.sfx.ui()
    }

    if (this.bannerTimer > 0 && this.phase === "playing") {
      this.bannerTimer -= dt
      if (this.bannerTimer <= 0) {
        this.banner = null
        this.pushHud()
      }
    }

    if (this.transition > 0 && this.phase === "playing") {
      this.transition -= dt
      if (this.transition <= 0) this.pushHud()
    }

    // живые ряды
    for (const b of this.blocks) {
      if (b.swayAmp > 0) {
        b.x = clamp(
          b.x0 + Math.sin(this.time * b.swayFreq + b.swayPh) * b.swayAmp,
          b.rx + 4,
          this.w - b.rx - 4
        )
      }
    }

    // плавный дрейф поля
    if (this.fieldShift) {
      const fs = this.fieldShift
      fs.t += dt
      const k = clamp(fs.t / fs.dur, 0, 1)
      const e = k * k * (3 - 2 * k)
      for (const b of this.blocks) {
        if (b.minionOrbit) continue
        b.x0 = clamp(b.x0 + fs.dx * e * dt, b.rx + 4, this.w - b.rx - 4)
        b.y = clamp(b.y + fs.dy * e * dt, b.ry + 4, this.h * 0.8)
      }
      if (k >= 1) this.fieldShift = null
    }

    if (this.phase !== "playing") return

    this.syncEffectsHud()
    this.updatePaddle(dt)
    this.updatePowers(dt)
    this.periodicSpawn(dt)
    this.periodicPowerDrop(dt)
    this.tryFieldShift(dt)
    if (this.boss) this.updateBoss(dt)
    if (this.boomQueue.length) {
      const due = this.boomQueue.filter((q) => this.time >= q.at)
      if (due.length) {
        this.boomQueue = this.boomQueue.filter((q) => this.time < q.at)
        for (const q of due) this.explode(q.x, q.y)
      }
    }

    const frozen = this.transition > 0 || this.bannerTimer > 1.1 || this.countdown > 0
    if (!frozen) {
      const fire = this.keys.space || this.tapFire
      this.tapFire = false
      this.updateLaser(fire)
      this.tryFire(dt, fire)
      this.updateProjectiles(dt)
      for (const ball of this.balls) this.updateBall(ball, dt)
      this.balls = this.balls.filter((b) => !(b as Ball & { lost?: boolean }).lost)
      if (this.balls.length === 0) this.loseLife()
    }

    for (const b of this.blocks) b.flash = Math.max(0, b.flash - dt * 5)

    if (
      this.blocks.length === 0 &&
      !this.boss &&
      this.transition <= 0 &&
      this.phase === "playing"
    ) {
      this.onLevelCleared()
    }
  }

  private updatePaddle(dt: number) {
    const p = this.paddle
    let wMult = 1
    if (this.time < this.wideUntil) wMult = 1.45
    else if (this.time < this.shrinkUntil) wMult = 0.6
    const targetW = p.baseW * wMult
    p.w += (targetW - p.w) * Math.min(1, dt * 10)

    if (this.keys.left || this.keys.right) {
      const dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0)
      p.vx += dir * 5200 * dt
      p.vx = clamp(p.vx, -900, 900)
      this.pointerX = null
    } else if (this.pointerX !== null) {
      const k = 1 - Math.exp(-dt * (this.locked ? 44 : 26))
      p.vx = (this.pointerX - p.x) * k * 30
      p.x += (this.pointerX - p.x) * k
    } else {
      p.vx *= Math.exp(-dt * 10)
    }
    p.x += p.vx * dt
    p.x = clamp(p.x, p.w / 2 + 4, this.w - p.w / 2 - 4)
    p.squash = Math.max(0, p.squash - dt * 5)
  }

  private updateBall(ball: Ball, dt: number) {
    if (ball.stuck) {
      ball.x = this.paddle.x + ball.stuckOffset
      ball.y = this.paddle.y - this.paddle.h / 2 - ball.r - 2
      return
    }

    ball.sinceHit += dt

    const speed = Math.hypot(ball.vx, ball.vy) || 1
    const steps = Math.max(1, Math.ceil((speed * dt) / (ball.r * 0.8)))
    const sdt = dt / steps
    for (let s = 0; s < steps; s++) {
      ball.x += ball.vx * sdt
      ball.y += ball.vy * sdt

      if (ball.x - ball.r < 0) {
        ball.x = ball.r
        ball.vx = Math.abs(ball.vx)
        ball.vy += rand(-1, 1) * speed * 0.06
        ball.squash = 1
        this.sfx.wall()
      }
      if (ball.x + ball.r > this.w) {
        ball.x = this.w - ball.r
        ball.vx = -Math.abs(ball.vx)
        ball.vy += rand(-1, 1) * speed * 0.06
        ball.squash = 1
        this.sfx.wall()
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r
        ball.vy = Math.abs(ball.vy)
        ball.squash = 1
        this.sfx.wall()
      }

      // низ — щит или потеря
      if (this.shield > 0 && ball.vy > 0 && ball.y + ball.r >= this.h - 14) {
        this.shield--
        ball.y = this.h - 14 - ball.r
        ball.vy = -Math.abs(ball.vy)
        ball.squash = 1
        ball.sinceHit = 0
        this.sfx.shieldHit()
        this.burst(ball.x, this.h - 14, "#4dff9e", 14, 220)
        this.rings.push({
          x: ball.x,
          y: this.h - 14,
          r: 8,
          maxR: 74,
          color: "rgba(77,255,158,0.8)",
          t: 0,
        })
        this.shake = Math.min(this.shake + 2.5, 8)
        this.pushHud()
        continue
      }
      if (ball.y > this.h + ball.r * 2) {
        ;(ball as Ball & { lost?: boolean }).lost = true
        return
      }

      this.collidePaddle(ball)
      this.collideBlocks(ball)
      this.collideBoss(ball)
    }

    ball.trail.push({ x: ball.x, y: ball.y })
    if (ball.trail.length > 10) ball.trail.shift()

    ball.squash = Math.max(0, ball.squash - dt * 6)

    // искры огненного ядра
    if (this.time < this.fireUntil && Math.random() < 0.75) {
      this.particles.push({
        x: ball.x + rand(-5, 5),
        y: ball.y + rand(-5, 5),
        vx: rand(-30, 30),
        vy: rand(-120, -40),
        life: rand(0.2, 0.45),
        maxLife: 0.45,
        size: rand(2, 4),
        color: Math.random() < 0.5 ? "#ff8a3d" : "#ffc94d",
        grav: -120,
      })
    }

    // режимы скорости + нарастание по мере зачистки уровня
    const cleared = 1 - this.blocks.length / this.blocksInitial
    const ramp = 1 + clamp(cleared, 0, 1) * 0.24
    const mult = (this.time < this.slowUntil ? 0.72 : this.time < this.fastUntil ? 1.32 : 1) * ramp
    const cur = Math.hypot(ball.vx, ball.vy) || 1
    const target = ball.speed * mult
    if (Math.abs(cur - target) > 1) {
      ball.vx = (ball.vx / cur) * target
      ball.vy = (ball.vy / cur) * target
    }

    // страховка от плоских траекторий
    const sp = Math.hypot(ball.vx, ball.vy) || 1
    if (Math.abs(ball.vy) < sp * 0.16) {
      const sign = ball.vy === 0 ? -1 : Math.sign(ball.vy)
      ball.vy = sign * sp * 0.22
      const nx = Math.sqrt(Math.max(sp * sp - ball.vy * ball.vy, 0))
      ball.vx = Math.sign(ball.vx || 1) * nx
    }

    // мягкий доворот «ленивого» шара к вертикали
    if (ball.sinceHit > 4) {
      const k = Math.min(1.6, 0.5 + (ball.sinceHit - 4) * 0.35) * dt
      ball.vy += (Math.sign(ball.vy || -1) * sp - ball.vy) * k * 0.5
    }
  }

  private collidePaddle(ball: Ball) {
    const p = this.paddle
    const top = p.y - p.h / 2
    if (ball.vy <= 0) return
    if (
      ball.y + ball.r >= top &&
      ball.y - ball.r <= p.y + p.h / 2 &&
      ball.x >= p.x - p.w / 2 - ball.r &&
      ball.x <= p.x + p.w / 2 + ball.r
    ) {
      const rel = clamp((ball.x - p.x) / (p.w / 2), -1, 1)
      // магнит: шар прилипает вместо отскока
      if (this.time < this.magnetUntil && !ball.stuck) {
        ball.stuck = true
        ball.stuckOffset = clamp(ball.x - p.x, -p.w / 2 + ball.r, p.w / 2 - ball.r)
        ball.vx = 0
        ball.vy = 0
        ball.squash = 1
        ball.sinceHit = 0
        this.sfx.paddle(Math.abs(rel))
        this.burst(ball.x, top, "#4dff9e", 8, 140)
        return
      }
      const ang = -Math.PI / 2 + rel * 1.05 + clamp(p.vx * 0.0004, -0.3, 0.3)
      const sp = Math.hypot(ball.vx, ball.vy) || ball.speed
      ball.vx = Math.cos(ang) * sp
      ball.vy = Math.sin(ang) * sp
      ball.y = top - ball.r - 0.5
      ball.squash = 1
      ball.sinceHit = 0
      p.squash = 1
      this.combo = 0
      this.sfx.paddle(Math.abs(rel))
      this.burst(ball.x, top, "#7cf5ff", 6, 130)
      this.pushHud()
    }
  }

  private collideBlocks(ball: Ball) {
    const fire = this.time < this.fireUntil
    for (const b of this.blocks) {
      if (b.dead) continue
      const ex = b.rx + ball.r
      const ey = b.ry + ball.r
      const dx = ball.x - b.x
      const dy = ball.y - b.y
      const cs = Math.cos(b.rot)
      const sn = Math.sin(b.rot)
      const lx = dx * cs + dy * sn
      const ly = -dx * sn + dy * cs
      const q = (lx * lx) / (ex * ex) + (ly * ly) / (ey * ey)
      if (q > 1) continue

      let nx = lx / (ex * ex)
      let ny = ly / (ey * ey)
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl
      ny /= nl
      const wnx = nx * cs - ny * sn
      const wny = nx * sn + ny * cs
      const sc = 1 / Math.sqrt(Math.max(q, 1e-6))
      const plx = lx * sc
      const ply = ly * sc
      ball.x = b.x + plx * cs - ply * sn + wnx * 0.8
      ball.y = b.y + plx * sn + ply * cs + wny * 0.8
      ball.sinceHit = 0
      if (!fire) {
        const dot = ball.vx * wnx + ball.vy * wny
        if (dot < 0) {
          ball.vx -= 2 * dot * wnx
          ball.vy -= 2 * dot * wny
        }
        this.damageBlock(b)
        return
      }
      this.sfx.burn()
      this.damageBlock(b, 2)
    }
  }

  private collideBoss(ball: Ball) {
    const bo = this.boss
    if (!bo || ball.stuck) return
    const dx = ball.x - bo.x
    const dy = ball.y - bo.y
    const dist = Math.hypot(dx, dy)
    const min = bo.r + ball.r
    if (dist >= min) return
    const nx = dx / (dist || 1)
    const ny = dy / (dist || 1)
    ball.x = bo.x + nx * (min + 1)
    ball.y = bo.y + ny * (min + 1)
    const dot = ball.vx * nx + ball.vy * ny
    if (dot < 0) {
      ball.vx -= 2 * dot * nx
      ball.vy -= 2 * dot * ny
    }
    ball.squash = 1
    ball.sinceHit = 0
    this.damageBoss(this.time < this.fireUntil ? 2 : 1, false)
  }

  /* ---------- разрушения ---------- */

  private damageBlock(b: Block, dmg = 1) {
    b.hp -= dmg
    b.flash = 1
    if (b.hp > 0) {
      this.sfx.brick(b.tier)
      this.burst(b.x, b.y, TIER[b.tier].base, 5, 130)
      this.combo++
      this.addScore(10 * this.comboMult(), b.x, b.y, "#9fd6ea", 12)
      if (b.tier === 3) this.hitStop = Math.max(this.hitStop, 0.03)
      this.pushHud()
      return
    }
    b.dead = true
    this.blocks = this.blocks.filter((x) => !x.dead)
    if (b.bomb && !b.boomQueued) {
      b.boomQueued = true
      this.boomQueue.push({ x: b.x, y: b.y, at: this.time + 0.09 })
    }
    if (b.splits) this.spawnScatter(b)
    this.combo++
    const mult = this.comboMult()
    this.addScore((30 + b.tier * 20) * mult, b.x, b.y, TIER[b.tier].base, 14 + b.tier * 2)
    this.sfx.destroy(b.tier)
    this.burst(b.x, b.y, TIER[b.tier].base, 10 + b.tier * 4, 190 + b.tier * 40)
    this.rings.push({
      x: b.x,
      y: b.y,
      r: 6,
      maxR: 40 + b.tier * 18,
      color: "rgba(234,247,255,0.7)",
      t: 0,
    })
    this.shake = Math.min(this.shake + b.tier, 9)
    if (b.tier === 3) this.hitStop = Math.max(this.hitStop, 0.05)

    // вехи серии
    if (this.combo === 5 || this.combo === 10 || this.combo === 15) {
      const word = this.combo === 5 ? "ГОРЯЧО!" : this.combo === 10 ? "НЕУДЕРЖИМО!" : "БЕЗУМИЕ!"
      this.popups.push({
        x: this.w / 2,
        y: this.h * 0.3,
        text: `${word} ×${this.combo}`,
        color: "#ffc94d",
        t: 0,
        size: 30,
      })
      this.rings.push({
        x: this.w / 2,
        y: this.h * 0.3,
        r: 10,
        maxR: 150,
        color: "rgba(255,201,77,0.6)",
        t: 0,
      })
      this.sfx.levelClear()
    }

    // дроп из блока
    this.dropPower(b.x, b.y)

    // монеты
    if (Math.random() < 0.05) {
      this.powers.push({ x: b.x, y: b.y, vy: 150, type: "coin", t: 0 })
    }
    this.pushHud()
  }

  private comboMult() {
    return 1 + Math.min(this.combo, 20) * 0.1
  }

  private addScore(n: number, x: number, y: number, color: string, size: number) {
    this.score += Math.round(n)
    if (this.score > this.best) {
      this.best = this.score
      this.newRecord = true
      lsSet("sharoboy-best", String(this.best))
    }
    this.popups.push({ x, y, text: `+${Math.round(n)}`, color, t: 0, size })
  }

  /** «Матрёшка»: вокруг разбитого блока рассыпаются 3–10 крупных шаров. */
  private spawnScatter(b: Block) {
    if (this.blocks.length > 150) return
    const n = 3 + Math.floor(rand(0, 8))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.4, 0.4)
      const d = Math.max(b.rx, b.ry) * rand(1.7, 2.4)
      const r = rand(17, 23)
      const cx = clamp(b.x + Math.cos(a) * d, r + 6, this.w - r - 6)
      const cy = clamp(b.y + Math.sin(a) * d, r + 6, this.h * 0.72)
      this.blocks.push({
        x: cx,
        y: cy,
        rx: r,
        ry: r,
        rot: 0,
        circle: true,
        hp: 1,
        maxHp: 1,
        tier: 1,
        flash: 1,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: cx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: false,
      })
    }
    this.popups.push({ x: b.x, y: b.y, text: "РАССЫПЬ!", color: "#5dffb0", t: 0, size: 16 })
    this.rings.push({ x: b.x, y: b.y, r: 8, maxR: 90, color: "rgba(93,255,176,0.7)", t: 0 })
    this.burst(b.x, b.y, "#5dffb0", 10, 200)
  }

  /** Периодически в верхней зоне появляются новые блоки (в основном одноразовые). */
  private periodicSpawn(dt: number) {
    if (this.boss) return
    this.spawnTimer -= dt
    if (this.spawnTimer > 0) return
    this.spawnTimer = rand(16, 22)
    const cap = Math.min(this.blocksInitial + 12, 150)
    if (this.blocks.length >= cap) return
    for (let attempt = 0; attempt < 7; attempt++) {
      const kind = Math.random() < 0.6 ? "circle" : Math.random() < 0.5 ? "eh" : "ev"
      let rx: number
      let ry: number
      if (kind === "circle") {
        rx = ry = rand(14, 24)
      } else if (kind === "eh") {
        rx = rand(24, 44)
        ry = rand(12, 18)
      } else {
        rx = rand(12, 18)
        ry = rand(20, 34)
      }
      const cx = rand(rx + 10, this.w - rx - 10)
      const cy = rand(ry + 70, this.h * 0.5)
      let overlaps = false
      for (const b of this.blocks) {
        if (Math.abs(b.x - cx) < b.rx + rx + 8 && Math.abs(b.y - cy) < b.ry + ry + 8) {
          overlaps = true
          break
        }
      }
      if (overlaps) continue
      const hroll = Math.random()
      const hp = (hroll < 0.78 ? 1 : hroll < 0.95 ? 2 : 3) as 1 | 2 | 3
      const rot = kind !== "circle" && Math.random() < 0.5 ? fitTilt(rx, ry, 60, 46) : 0
      this.blocks.push({
        x: cx,
        y: cy,
        rx,
        ry,
        rot,
        circle: kind === "circle",
        hp,
        maxHp: hp,
        tier: hp,
        flash: 1,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: cx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: Math.random() < 0.05,
      })
      this.rings.push({ x: cx, y: cy, r: 4, maxR: 60, color: "rgba(124,245,255,0.7)", t: 0 })
      this.popups.push({ x: cx, y: cy - 20, text: "ПОПОЛНЕНИЕ!", color: "#7cf5ff", t: 0, size: 12 })
      break
    }
  }

  /** Редкое смещение всего поля (плавный дрейф). */
  private tryFieldShift(dt: number) {
    this.shiftTimer -= dt
    if (this.shiftTimer > 0 || this.fieldShift) return
    this.shiftTimer = rand(12, 18)
    if (!this.blocks.length) return
    const ang = rand(0, Math.PI * 2)
    const mag = rand(22, 40)
    let dx = Math.cos(ang) * mag
    let dy = Math.sin(ang) * mag * 0.6
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const b of this.blocks) {
      if (b.minionOrbit) continue
      minX = Math.min(minX, b.x - b.rx)
      maxX = Math.max(maxX, b.x + b.rx)
      minY = Math.min(minY, b.y - b.ry)
      maxY = Math.max(maxY, b.y + b.ry)
    }
    if (minX + dx < 6) dx = 6 - minX
    if (maxX + dx > this.w - 6) dx = this.w - 6 - maxX
    if (minY + dy < 6) dy = 6 - minY
    if (maxY + dy > this.h * 0.8) dy = this.h * 0.8 - maxY
    this.fieldShift = { t: 0, dur: rand(0.6, 0.9), dx: dx * 2.2, dy: dy * 2.2 }
    this.popups.push({
      x: this.w / 2,
      y: this.h * 0.25,
      text: "СДВИГ ПОЛЯ",
      color: "#9fd6ea",
      t: 0,
      size: 20,
    })
    this.shake = Math.min(this.shake + 1.5, 5)
  }

  /* ---------- бонусы ---------- */

  private pickPowerType(): PowerType {
    const fewBlocks = this.blocks.length <= Math.max(5, this.blocksInitial * 0.3)
    const table: [PowerType, number][] = [
      ["wide", 12],
      ["multi", 12],
      ["life", 6],
      ["slow", 10],
      ["shield", 10],
      ["laser", fewBlocks ? 72 : 9],
      ["rocket", fewBlocks ? 64 : 8],
      ["fire", 8],
      ["fast", 14],
      ["shrink", 10],
    ]
    let sum = 0
    for (const [, w] of table) sum += w
    let roll = Math.random() * sum
    for (const [t, w] of table) {
      roll -= w
      if (roll <= 0) return t
    }
    return "wide"
  }

  private dropPower(x: number, y: number) {
    if (Math.random() < 0.24) {
      const type = this.pickPowerType()
      const skip =
        (type === "multi" && this.balls.length >= 4) ||
        (type === "life" && this.lives >= 5) ||
        (type === "shield" && this.shield >= 5)
      if (!skip) this.powers.push({ x, y, vy: 150, type, t: 0 })
    }
  }

  /** Периодический «небесный» сброс бонусов с верхней границы поля. */
  private periodicPowerDrop(dt: number) {
    if (this.boss) {
      this.skyDropTimer -= dt * 0.55
    } else {
      this.skyDropTimer -= dt
    }
    if (this.skyDropTimer > 0) return
    this.skyDropTimer = rand(18, 27)
    if (this.powers.length >= 6) return
    const type = this.pickPowerType()
    const x = rand(60, this.w - 60)
    this.powers.push({ x, y: -24, vy: 170, type, t: 0 })
    this.rings.push({ x, y: 20, r: 6, maxR: 90, color: "rgba(234,247,255,0.7)", t: 0 })
    this.popups.push({ x, y: 60, text: "С НЕБА!", color: "#eaf7ff", t: 0, size: 18 })
    this.sfx.power()
  }

  private updatePowers(dt: number) {
    const p = this.paddle
    for (const pw of this.powers) {
      pw.t += dt
      pw.y += pw.vy * dt
      pw.x += Math.sin(pw.t * 4) * 14 * dt
      if (
        pw.y > p.y - p.h / 2 - 12 &&
        pw.y < p.y + p.h / 2 + 12 &&
        pw.x > p.x - p.w / 2 - 14 &&
        pw.x < p.x + p.w / 2 + 14
      ) {
        ;(pw as PowerUp & { taken?: boolean }).taken = true
        this.applyPower(pw.type)
      }
    }
    this.powers = this.powers.filter(
      (pw) => !(pw as PowerUp & { taken?: boolean }).taken && pw.y < this.h + 40
    )
  }

  private applyPower(type: PowerType) {
    const meta = POWER_META[type]
    this.sfx.power()
    const popup = (text: string) =>
      this.popups.push({
        x: this.paddle.x,
        y: this.paddle.y - 40,
        text,
        color: meta.color,
        t: 0,
        size: 18,
      })
    switch (type) {
      case "wide":
        this.wideUntil = this.time + 12
        this.shrinkUntil = 0
        popup("ШИРОКАЯ РАКЕТКА")
        break
      case "slow":
        this.slowUntil = this.time + 8
        this.fastUntil = 0
        popup("ЗАМЕДЛЕНИЕ")
        break
      case "shield":
        this.shield = Math.min(5, this.shield + 3)
        popup("ЗАЩИТНЫЙ ЭКРАН")
        break
      case "laser":
        // луч не стреляет сам: бонус взводит лазер, залп — по пробелу/клику
        this.laserArmed = true
        this.laserArmedUntil = this.time + 4
        popup("ЛАЗЕР ГОТОВ — ПРОБЕЛ")
        break
      case "rocket":
        this.rocketUntil = this.time + 12
        popup("РАКЕТЫ — ПРОБЕЛ")
        break
      case "fire":
        this.fireUntil = this.time + 8
        popup("ОГНЕННОЕ ЯДРО!")
        break
      case "magnet":
        this.magnetUntil = this.time + 7
        popup("МАГНИТ!")
        break
      case "multi": {
        const donors = this.balls.filter((b) => !b.stuck).slice(0, 2)
        const base = donors[0] ?? this.balls[0]
        if (base) {
          for (const d of [base, ...donors.slice(1)]) {
            if (this.balls.length >= 6) break
            const ang = rand(-Math.PI * 0.85, -Math.PI * 0.15)
            this.balls.push({
              x: d.x,
              y: d.y,
              vx: Math.cos(ang) * d.speed,
              vy: Math.sin(ang) * d.speed,
              r: d.r,
              speed: d.speed,
              stuck: false,
              stuckOffset: 0,
              trail: [],
              squash: 0,
              sinceHit: 0,
            })
          }
        }
        popup("×3 ШАРА!")
        break
      }
      case "life":
        this.lives = Math.min(5, this.lives + 1)
        popup("+1 ЖИЗНЬ")
        break
      case "coin":
        this.addCoins(1)
        popup("+1 МОНЕТА")
        this.sfx.coin()
        this.burst(this.paddle.x, this.paddle.y - 12, "#ffd66b", 10, 170)
        break
      case "fast":
        this.fastUntil = this.time + 7
        this.slowUntil = 0
        this.sfx.powerBad()
        popup("УСКОРЕНИЕ!")
        break
      case "shrink":
        this.shrinkUntil = this.time + 9
        this.wideUntil = 0
        this.sfx.powerBad()
        popup("УЗКАЯ РАКЕТКА!")
        break
    }
    this.burst(this.paddle.x, this.paddle.y - 10, meta.color, 12, 190)
    this.pushHud()
  }

  /* ---------- оружие ---------- */

  private tryFire(dt: number, fire: boolean) {
    const rocketOn = this.time < this.rocketUntil
    if (!rocketOn || !fire) {
      this.weaponCd = 0
      return
    }
    this.weaponCd -= dt
    if (this.weaponCd > 0) return
    const p = this.paddle
    this.projectiles.push({ x: p.x, y: p.y - p.h - 6, vy: -560, kind: "rocket", r: 7, dead: false })
    this.sfx.rocket()
    this.weaponCd = 0.32
    this.burst(p.x, p.y - p.h, "#ffc94d", 5, 120)
    if (this.projectiles.length > 48) this.projectiles.splice(0, this.projectiles.length - 48)
    p.squash = Math.max(p.squash, 0.35)
  }

  /** Лазер-луч: взводится бонусом, залп по пробелу/клику, импульсы ~2 с. */
  private updateLaser(fire: boolean) {
    if (this.laserArmed && this.time > this.laserArmedUntil) this.laserArmed = false
    if (this.laserArmed && fire) {
      this.laserArmed = false
      this.laserUntil = this.time + 2
      this.laserWasOn = false
    }
    const active = this.time < this.laserUntil
    const cyc = this.time % 0.3
    const on = active && cyc < 0.17
    if (on && !this.laserWasOn) {
      this.sfx.laser()
      const p = this.paddle
      this.beamHit(p.x - p.w * 0.36)
      this.beamHit(p.x + p.w * 0.36)
      p.squash = Math.max(p.squash, 0.25)
    }
    this.laserWasOn = on
  }

  private beamHit(px: number) {
    const pylonY = this.paddle.y - this.paddle.h / 2 - 8
    let best: Block | null = null
    let bestHH = 0
    for (const b of this.blocks) {
      if (b.dead) continue
      const e = rotatedExtents(b.rx, b.ry, b.rot)
      if (Math.abs(b.x - px) > e.hw + 3) continue
      if (b.y + e.hh >= pylonY) continue
      if (!best || b.y > best.y) {
        best = b
        bestHH = e.hh
      }
    }
    if (best) {
      this.damageBlock(best, 3)
      this.burst(px, best.y + bestHH, "#7cf5ff", 8, 180)
      this.rings.push({
        x: px,
        y: best.y + bestHH,
        r: 4,
        maxR: 44,
        color: "rgba(124,245,255,0.85)",
        t: 0,
      })
      return
    }
    if (
      this.boss &&
      Math.abs(this.boss.x - px) < this.boss.r &&
      this.boss.y + this.boss.r < pylonY
    ) {
      this.damageBoss(2, true)
      this.burst(px, this.boss.y + this.boss.r, "#7cf5ff", 8, 180)
    }
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.y += pr.vy * dt
      if (pr.y < -30) {
        pr.dead = true
        continue
      }
      if (Math.random() < 0.5) {
        this.particles.push({
          x: pr.x + rand(-2, 2),
          y: pr.y + 10,
          vx: rand(-20, 20),
          vy: rand(40, 90),
          life: 0.25,
          maxLife: 0.25,
          size: rand(1.5, 3),
          color: "#ff8a3d",
          grav: 0,
        })
      }
      for (const b of this.blocks) {
        if (b.dead) continue
        const e = rotatedExtents(b.rx, b.ry, b.rot)
        if (Math.abs(pr.x - b.x) < e.hw + pr.r && Math.abs(pr.y - b.y) < e.hh + pr.r) {
          pr.dead = true
          if (pr.kind === "rocket") this.explode(pr.x, pr.y)
          break
        }
      }
      if (!pr.dead && this.boss) {
        if (Math.hypot(pr.x - this.boss.x, pr.y - this.boss.y) < this.boss.r + pr.r + 4) {
          pr.dead = true
          this.explode(pr.x, pr.y)
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead)
  }

  private explode(x: number, y: number) {
    this.sfx.explosion()
    this.shake = Math.min(this.shake + 5, 12)
    this.flash = Math.max(this.flash, 0.4)
    this.rings.push({ x, y, r: 12, maxR: 150, color: "rgba(255,138,61,0.85)", t: 0 })
    this.burst(x, y, "#ffc94d", 14, 270)
    this.burst(x, y, "#ff8a3d", 10, 210)
    const R = 90
    for (const b of [...this.blocks]) {
      if (b.dead) continue
      if (Math.hypot(b.x - x, b.y - y) < R + Math.max(b.rx, b.ry)) this.damageBlock(b, 3)
    }
    if (this.boss && Math.hypot(this.boss.x - x, this.boss.y - y) < R + this.boss.r)
      this.damageBoss(3, true)
  }

  /* ---------- босс ---------- */

  private updateBoss(dt: number) {
    const bo = this.boss
    if (!bo) return
    bo.t += dt
    bo.flash = Math.max(0, bo.flash - dt * 4)
    const angry = bo.hp < bo.maxHp * 0.4
    const amp = clamp(this.w * 0.26, 120, 420)
    bo.x = this.w / 2 + Math.sin(bo.t * (angry ? 1.1 : 0.6)) * amp
    bo.y = bo.baseY + Math.sin(bo.t * 1.7) * 22
    for (const b of this.blocks) {
      const m = b.minionOrbit
      if (!m) continue
      m.ang += m.dir * m.speed * dt * (angry ? 1.6 : 1)
      b.x = clamp(bo.x + Math.cos(m.ang) * m.rad, b.rx + 4, this.w - b.rx - 4)
      b.y = clamp(bo.y + Math.sin(m.ang) * m.rad * 0.55, b.ry + 4, this.h * 0.8)
    }
    bo.dropTimer -= dt
    if (bo.dropTimer <= 0) {
      bo.dropTimer = angry ? 3.6 : 5
      const types: PowerType[] = ["wide", "shield", "laser", "rocket", "multi"]
      this.powers.push({
        x: bo.x,
        y: bo.y + bo.r + 10,
        vy: 150,
        type: types[Math.floor(Math.random() * types.length)],
        t: 0,
      })
    }
  }

  private damageBoss(dmg: number, fromWeapon: boolean) {
    const bo = this.boss
    if (!bo) return
    if (fromWeapon && this.time < this.bossHitCd) return
    this.bossHitCd = this.time + 0.08
    bo.hp -= dmg
    bo.flash = 1
    this.sfx.brick(3)
    this.burst(
      bo.x + rand(-bo.r * 0.5, bo.r * 0.5),
      bo.y + rand(-bo.r * 0.3, bo.r * 0.3),
      "#ff5ca8",
      8,
      200
    )
    this.score += 5
    if (bo.hp <= 0) {
      this.killBoss()
    } else {
      this.pushHud()
    }
  }

  private killBoss() {
    const bo = this.boss
    if (!bo) return
    this.boss = null
    this.runBossKills++
    this.score += 1500
    this.hitStop = Math.max(this.hitStop, 0.5)
    this.flash = 1
    this.shake = Math.min(this.shake + 14, 18)
    this.sfx.bossDie()
    this.burst(bo.x, bo.y, "#ff5ca8", 40, 420)
    this.burst(bo.x, bo.y, "#ffc94d", 24, 330)
    this.rings.push({ x: bo.x, y: bo.y, r: 20, maxR: 300, color: "rgba(255,92,168,0.85)", t: 0 })
    this.popups.push({ x: bo.x, y: bo.y, text: "+1500", color: "#ffc94d", t: 0, size: 30 })
    // миньоны и бомбы разлетаются цепочкой взрывов
    let i = 0
    for (const b of [...this.blocks]) {
      if (b.minionOrbit || b.bomb) {
        this.boomQueue.push({ x: b.x, y: b.y, at: this.time + 0.12 + i * 0.1 })
        b.hp = 0
        b.dead = true
        i++
      }
    }
    this.blocks = this.blocks.filter((b) => !b.dead)
    this.powers.push(
      { x: bo.x - 40, y: bo.y, vy: 150, type: "multi", t: 0 },
      { x: bo.x + 40, y: bo.y, vy: 150, type: "shield", t: 0 }
    )
    this.pushHud()
  }

  /* ---------- переходы ---------- */

  private onLevelCleared() {
    if (!this.levelLostBall) {
      this.score += 500
      if (this.score > this.best) {
        this.best = this.score
        this.newRecord = true
        lsSet("sharoboy-best", String(this.best))
      }
      this.popups.push({
        x: this.w / 2,
        y: this.h * 0.42,
        text: "ЧИСТО! +500",
        color: "#5dffb0",
        t: 0,
        size: 26,
      })
      this.sfx.power()
    }
    this.flash = 1
    this.hitStop = Math.max(this.hitStop, 0.35)
    if (this.mode === "endless") {
      this.score += 200 + this.wave * 50
      this.lives = Math.min(this.lives + 1, 5)
      this.sfx.levelClear()
      this.wave++
      this.buildWave(this.wave)
      this.clearAllEffects()
      this.balls = []
      this.serveBall()
      this.setBanner(this.wave % 5 === 0 ? `ВОЛНА ${this.wave} — БОСС!` : `ВОЛНА ${this.wave}`)
      this.pushHud()
      return
    }
    if (this.level >= LEVELS.length) {
      this.phase = "won"
      this.releaseLock()
      this.sfx.win()
      this.saveTop()
      this.pushHud()
      return
    }
    this.sfx.levelClear()
    this.level++
    this.buildLevel(this.level)
    this.clearAllEffects()
    this.balls = []
    this.serveBall()
    this.setBanner(`УРОВЕНЬ ${this.level} — ${LEVELS[this.level - 1].name}`)
    this.pushHud()
  }

  private loseLife() {
    this.lives--
    this.runLivesLost++
    this.levelLostBall = true
    this.combo = 0
    this.shake = 10
    this.sfx.loseLife()
    this.wideUntil = 0
    this.slowUntil = 0
    this.fastUntil = 0
    this.shrinkUntil = 0
    this.laserUntil = 0
    this.laserArmed = false
    this.rocketUntil = 0
    this.fireUntil = 0
    this.magnetUntil = 0
    this.weaponCd = 0
    this.powers = []
    this.projectiles = []
    if (this.lives <= 0) {
      this.phase = "over"
      this.releaseLock()
      this.sfx.gameOver()
      this.saveTop()
      this.pushHud()
      return
    }
    this.serveBall()
    this.pushHud()
  }

  /** Полный сброс временных эффектов между уровнями/волнами. */
  private clearAllEffects() {
    this.wideUntil = 0
    this.slowUntil = 0
    this.fastUntil = 0
    this.shrinkUntil = 0
    this.laserUntil = 0
    this.laserArmed = false
    this.rocketUntil = 0
    this.fireUntil = 0
    this.magnetUntil = 0
    this.weaponCd = 0
    this.shield = 0
    this.laserWasOn = false
    this.powers = []
    this.projectiles = []
    this.combo = 0
    this.effectsKey = ""
    this.pushHud()
  }

  private saveTop() {
    if (this.score <= 0) return
    if (this.mode === "endless") {
      this.topEndless = [...this.topEndless, this.score].sort((a, b) => b - a).slice(0, 5)
      lsSet("sharoboy-top-endless", JSON.stringify(this.topEndless))
    } else {
      this.top = [...this.top, this.score].sort((a, b) => b - a).slice(0, 5)
      lsSet("sharoboy-top", JSON.stringify(this.top))
    }
  }

  private syncEffectsHud() {
    const t = this.time
    const key = [
      t < this.wideUntil ? 1 : 0,
      t < this.slowUntil ? 1 : 0,
      t < this.fastUntil ? 1 : 0,
      t < this.shrinkUntil ? 1 : 0,
      t < this.laserUntil ? 1 : 0,
      this.laserArmed ? 1 : 0,
      t < this.rocketUntil ? 1 : 0,
      t < this.fireUntil ? 1 : 0,
      t < this.magnetUntil ? 1 : 0,
    ].join("")
    if (key !== this.effectsKey) {
      this.effectsKey = key
      this.pushHud()
    }
  }

  private pushHud() {
    const fresh = evaluateAch({
      score: this.score,
      combo: this.combo,
      wave: this.wave,
      won: this.phase === "won",
      bossKills: this.runBossKills,
      livesLost: this.runLivesLost,
      coins: this.coins,
      upgradeLevels: Object.values(this.upgrades).reduce((a, b) => a + b, 0),
      upgradesMaxed: UPGRADE_DEFS.every((d) => (this.upgrades[d.id] ?? 0) >= d.max),
    })
    if (fresh.length) {
      this.achQueue.push(...fresh.map((a) => a.id))
      this.sfx.achievement()
    }
    this.onHud({
      phase: this.phase,
      score: this.score,
      best: this.best,
      lives: this.lives,
      level: this.mode === "endless" ? this.wave : this.level,
      levelCount: this.mode === "endless" ? -1 : LEVELS.length,
      levelName: this.levelDisplayName(),
      mode: this.mode,
      wave: this.wave,
      combo: this.combo,
      blocksLeft: this.blocks.length,
      muted: this.sfx.muted,
      banner: this.banner,
      stuck: this.balls.some((b) => b.stuck),
      newRecord: this.newRecord,
      shield: this.shield,
      wideOn: this.time < this.wideUntil,
      slowOn: this.time < this.slowUntil,
      fastOn: this.time < this.fastUntil,
      shrinkOn: this.time < this.shrinkUntil,
      laserOn: this.time < this.laserUntil || this.laserArmed,
      laserArmed: this.laserArmed,
      rocketOn: this.time < this.rocketUntil,
      fireOn: this.time < this.fireUntil,
      magnetOn: this.time < this.magnetUntil,
      coins: this.coins,
      upgrades: { ...this.upgrades },
      top: this.top,
      topEndless: this.topEndless,
      newAchievements: this.achQueue.splice(0),
    })
  }

  private setBanner(text: string) {
    this.banner = text
    this.bannerTimer = 2.2
    this.transition = 0.5
  }

  private burst(x: number, y: number, color: string, count: number, speed: number) {
    if (this.particles.length > 420) return
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2)
      const v = rand(speed * 0.3, speed)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        size: rand(2, 5),
        color,
        grav: 300,
      })
    }
  }

  /* ---------- отрисовка ---------- */

  private draw() {
    const { ctx, w, h } = this
    ctx.clearRect(0, 0, w, h)

    ctx.save()
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake))
    }

    this.drawBackground()
    this.drawShieldLine()
    this.drawBlocks()
    this.drawBoss()
    this.drawRings()
    this.drawPowers()
    this.drawLaserBeams()
    this.drawProjectiles()
    this.drawBalls()
    if (this.phase !== "menu") this.drawPaddle()
    this.drawParticles()
    this.drawPopups()

    ctx.restore()

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(234,247,255,${this.flash * 0.3})`
      ctx.fillRect(0, 0, w, h)
    }

    if (this.countdown > 0 && this.phase === "playing") {
      ctx.fillStyle = "rgba(4,16,26,0.45)"
      ctx.fillRect(0, 0, w, h)
      const n = Math.ceil(this.countdown)
      const frac = this.countdown - Math.floor(this.countdown)
      ctx.save()
      ctx.translate(w / 2, h * 0.44)
      ctx.scale(0.8 + frac * 0.5, 0.8 + frac * 0.5)
      ctx.font = '120px "Russo One", sans-serif'
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.shadowColor = "#35e0ff"
      ctx.shadowBlur = 34
      ctx.fillStyle = "#eaf7ff"
      ctx.fillText(String(n), 0, 0)
      ctx.restore()
    }

    // виньетка
    const vg = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.42,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75
    )
    vg.addColorStop(0, "rgba(0,0,0,0)")
    vg.addColorStop(1, "rgba(2,10,16,0.55)")
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, w, h)
  }

  private drawBackground() {
    const { ctx, w, h } = this
    const heat = clamp(this.combo / 12, 0, 1)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, "#0e3a4e")
    g.addColorStop(0.5, "#082434")
    g.addColorStop(1, "#04121c")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    if (heat > 0.02) {
      const rg = ctx.createRadialGradient(w / 2, 0, 40, w / 2, 0, Math.max(w, h) * 0.8)
      rg.addColorStop(0, `rgba(255,201,77,${0.14 * heat})`)
      rg.addColorStop(0.5, `rgba(53,224,255,${0.08 * heat})`)
      rg.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, w, h)
    }
    for (const b of this.bubbles) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(140,220,255,0.07)"
      ctx.fill()
      ctx.strokeStyle = "rgba(140,220,255,0.12)"
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawShieldLine() {
    if (this.shield <= 0 || this.phase === "menu") return
    const { ctx, w, h } = this
    const y = h - 14
    const a = 0.5 + Math.sin(this.time * 6) * 0.18
    const g = ctx.createLinearGradient(0, y - 9, 0, y + 9)
    g.addColorStop(0, "rgba(77,255,158,0)")
    g.addColorStop(0.5, `rgba(77,255,158,${a})`)
    g.addColorStop(1, "rgba(77,255,158,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, y - 9, w, 18)
    ctx.shadowColor = "#4dff9e"
    ctx.shadowBlur = 9
    for (let i = 0; i < this.shield; i++) {
      const px = w / 2 + (i - (this.shield - 1) / 2) * 15
      ctx.beginPath()
      ctx.arc(px, y, 4.2, 0, Math.PI * 2)
      ctx.fillStyle = "#4dff9e"
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  private drawBlocks() {
    const { ctx } = this
    for (const b of this.blocks) {
      if (b.dead) continue
      if (b.bomb) {
        this.drawBomb(b, b.x, b.y)
        continue
      }
      const x = b.x + Math.sin(this.time * 0.9 + b.seed) * 1.4
      const y = b.y + Math.cos(this.time * 0.8 + b.seed) * 1.4
      const tier = TIER[b.tier]
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(b.rot)
      ctx.scale(b.rx, b.ry)
      const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15)
      g.addColorStop(0, tier.light)
      g.addColorStop(0.5, tier.base)
      g.addColorStop(1, tier.dark)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 2.5 / Math.max(b.rx, b.ry)
      ctx.strokeStyle = "rgba(4,18,26,0.55)"
      ctx.stroke()
      if (b.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`
        ctx.beginPath()
        ctx.arc(0, 0, 1, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // трещины
      const dmg = b.maxHp - b.hp
      if (dmg > 0) {
        ctx.strokeStyle = "rgba(4,18,26,0.5)"
        ctx.lineWidth = 1.6
        for (let i = 0; i < dmg; i++) {
          const a0 = b.seed + i * 2.1
          ctx.beginPath()
          ctx.moveTo(x + Math.cos(a0) * b.rx * 0.2, y + Math.sin(a0) * b.ry * 0.2)
          ctx.lineTo(x + Math.cos(a0 + 0.5) * b.rx * 0.75, y + Math.sin(a0 + 0.5) * b.ry * 0.75)
          ctx.lineTo(x + Math.cos(a0 + 0.9) * b.rx * 0.55, y + Math.sin(a0 + 0.9) * b.ry * 0.55)
          ctx.stroke()
        }
      }

      // пипсы HP
      if (b.maxHp > 1 && b.hp > 1) {
        ctx.fillStyle = "rgba(4,18,26,0.75)"
        for (let i = 0; i < b.hp; i++) {
          ctx.beginPath()
          ctx.arc(x + (i - (b.hp - 1) / 2) * 8, y + b.ry * 0.55, 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // «матрёшка»: мини-шарики внутри
      if (b.splits) {
        ctx.fillStyle = "rgba(255,255,255,0.85)"
        for (let i = 0; i < 3; i++) {
          const aa = b.seed + (i * Math.PI * 2) / 3 + this.time * 0.9
          ctx.beginPath()
          ctx.ellipse(
            x + Math.cos(aa) * b.rx * 0.36,
            y + Math.sin(aa) * b.ry * 0.36,
            Math.max(3, b.rx * 0.17),
            Math.max(3, b.ry * 0.17),
            0,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
      }
    }
  }

  private drawBomb(b: Block, x: number, y: number) {
    const { ctx } = this
    const pulse = 0.6 + Math.sin(this.time * 9 + b.seed) * 0.4
    ctx.save()
    const g = ctx.createRadialGradient(x - b.rx * 0.3, y - b.ry * 0.35, 2, x, y, b.rx * 1.2)
    g.addColorStop(0, "#5a6b78")
    g.addColorStop(0.55, "#2b3a45")
    g.addColorStop(1, "#101b22")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, b.rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = "#ff8a3d"
    ctx.shadowBlur = 14 * pulse
    ctx.strokeStyle = `rgba(255,138,61,${0.45 + pulse * 0.4})`
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.shadowBlur = 0
    // фитиль
    ctx.strokeStyle = "#8a6b4a"
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(x, y - b.ry)
    ctx.quadraticCurveTo(x + 7, y - b.ry - 8, x + 12, y - b.ry - 4)
    ctx.stroke()
    ctx.fillStyle = `rgba(255,220,120,${pulse})`
    ctx.beginPath()
    ctx.arc(x + 12, y - b.ry - 4, 3 + pulse * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawBoss() {
    const bo = this.boss
    if (!bo) return
    const { ctx } = this
    const angry = bo.hp < bo.maxHp * 0.4
    ctx.save()
    ctx.translate(bo.x, bo.y)
    const frac = clamp(bo.hp / bo.maxHp, 0, 1)
    ctx.lineWidth = 6
    ctx.strokeStyle = "rgba(4,18,26,0.7)"
    ctx.beginPath()
    ctx.arc(0, 0, bo.r + 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347"
    ctx.beginPath()
    ctx.arc(0, 0, bo.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
    ctx.stroke()
    ctx.shadowColor = angry ? "#ff5347" : "#ff5ca8"
    ctx.shadowBlur = 30
    const g = ctx.createRadialGradient(-bo.r * 0.35, -bo.r * 0.4, 4, 0, 0, bo.r * 1.2)
    if (angry) {
      g.addColorStop(0, "#ffd9d4")
      g.addColorStop(0.45, "#ff6a5c")
      g.addColorStop(1, "#5a0f08")
    } else {
      g.addColorStop(0, "#ffd0e8")
      g.addColorStop(0.45, "#ff5ca8")
      g.addColorStop(1, "#5a0f3c")
    }
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    if (bo.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.7})`
      ctx.beginPath()
      ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
      ctx.fill()
    }
    // корона
    ctx.fillStyle = "#ffc94d"
    ctx.beginPath()
    const cy0 = -bo.r * 0.92
    ctx.moveTo(-bo.r * 0.42, cy0)
    ctx.lineTo(-bo.r * 0.42, cy0 - bo.r * 0.28)
    ctx.lineTo(-bo.r * 0.2, cy0 - bo.r * 0.1)
    ctx.lineTo(0, cy0 - bo.r * 0.34)
    ctx.lineTo(bo.r * 0.2, cy0 - bo.r * 0.1)
    ctx.lineTo(bo.r * 0.42, cy0 - bo.r * 0.28)
    ctx.lineTo(bo.r * 0.42, cy0)
    ctx.closePath()
    ctx.fill()
    // глаза следят за шаром
    const target = this.balls.find((b) => !b.stuck)
    let ex = 0
    let ey = 0
    if (target) {
      const dx = target.x - bo.x
      const dy = target.y - bo.y
      const dl = Math.hypot(dx, dy) || 1
      ex = (dx / dl) * bo.r * 0.08
      ey = (dy / dl) * bo.r * 0.08
    }
    for (const sx of [-1, 1]) {
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.ellipse(sx * bo.r * 0.32, -bo.r * 0.15, bo.r * 0.2, bo.r * 0.24, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#12222c"
      ctx.beginPath()
      ctx.arc(sx * bo.r * 0.32 + ex, -bo.r * 0.15 + ey, bo.r * 0.09, 0, Math.PI * 2)
      ctx.fill()
    }
    // рот
    ctx.strokeStyle = "#3c0a26"
    ctx.lineWidth = bo.r * 0.07
    ctx.lineCap = "round"
    ctx.beginPath()
    if (angry) {
      ctx.moveTo(-bo.r * 0.3, bo.r * 0.42)
      for (let i = 0; i <= 6; i++) {
        ctx.lineTo(-bo.r * 0.3 + (i * bo.r * 0.6) / 6, bo.r * 0.42 + (i % 2 ? bo.r * 0.09 : 0))
      }
    } else {
      ctx.arc(0, bo.r * 0.28, bo.r * 0.3, 0.15, Math.PI - 0.15)
    }
    ctx.stroke()
    ctx.restore()
  }

  private drawRings() {
    const { ctx } = this
    for (const r of this.rings) {
      const a = clamp(1 - r.t, 0, 1)
      ctx.globalAlpha = a
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.r + r.t * r.maxR, 0, Math.PI * 2)
      ctx.strokeStyle = r.color
      ctx.lineWidth = 3 * a + 1
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private drawPowers() {
    const { ctx } = this
    for (const pw of this.powers) {
      const meta = POWER_META[pw.type]
      // столб света сверху в первые мгновения падения
      if (pw.t < 0.5 && pw.y > 0) {
        const a = (0.5 - pw.t) / 0.5
        ctx.fillStyle = meta.color + "30"
        ctx.fillRect(pw.x - 4, 0, 8, pw.y)
        ctx.fillStyle = `rgba(240,255,255,${0.55 * a})`
        ctx.fillRect(pw.x - 1.2, 0, 2.4, pw.y)
      }
      if (pw.type === "coin") {
        this.drawCoin(pw)
        continue
      }
      ctx.save()
      ctx.translate(pw.x, pw.y)
      ctx.rotate(Math.sin(pw.t * 5) * 0.12)
      const pulse = 1 + Math.sin(pw.t * 9) * 0.05
      ctx.scale(pulse, pulse)
      ctx.shadowColor = meta.color
      ctx.shadowBlur = 20
      ctx.fillStyle = meta.color
      this.roundRect(-24, -16, 48, 32, 16)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = meta.edge
      ctx.lineWidth = 2.5
      this.roundRect(-24, -16, 48, 32, 16)
      ctx.stroke()
      ctx.fillStyle = "rgba(255,255,255,0.38)"
      this.roundRect(-18, -12.5, 36, 10, 8)
      ctx.fill()
      ctx.fillStyle = "#04121c"
      ctx.font = '700 15px "Russo One", sans-serif'
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(meta.label, 0, 2)
      ctx.restore()
    }
  }

  private drawCoin(pw: PowerUp) {
    const { ctx } = this
    const R = 13
    const sx = Math.abs(Math.cos(pw.t * 4.5))
    ctx.save()
    ctx.translate(pw.x, pw.y)
    ctx.scale(Math.max(0.25, sx), 1)
    ctx.shadowColor = "#ffc94d"
    ctx.shadowBlur = 16
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 1, 0, 0, R * 1.15)
    g.addColorStop(0, "#fff3d1")
    g.addColorStop(0.5, "#ffc94d")
    g.addColorStop(1, "#b0720a")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = "#8a5a06"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = "rgba(255,243,209,0.8)"
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = "#8a5a06"
    ctx.font = '700 12px "Russo One", sans-serif'
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("★", 0, 1.5)
    ctx.restore()
  }

  private drawLaserBeams() {
    if (this.time >= this.laserUntil || this.phase === "menu") return
    const cyc = this.time % 0.3
    if (cyc >= 0.17) return
    const onAmt = 1 - cyc / 0.17
    const { ctx } = this
    const p = this.paddle
    const pylonY = p.y - p.h / 2 - 8
    for (const s of [-0.36, 0.36]) {
      const px = p.x + p.w * s
      let hitY = -30
      let best: Block | null = null
      for (const b of this.blocks) {
        if (b.dead) continue
        const e = rotatedExtents(b.rx, b.ry, b.rot)
        if (Math.abs(b.x - px) > e.hw + 3 || b.y + e.hh >= pylonY) continue
        if (!best || b.y > best.y) best = b
      }
      if (best) hitY = best.y + rotatedExtents(best.rx, best.ry, best.rot).hh - 2
      else if (
        this.boss &&
        Math.abs(this.boss.x - px) < this.boss.r &&
        this.boss.y + this.boss.r < pylonY
      )
        hitY = this.boss.y + this.boss.r - 2
      const wdt = 2.5 + 5 * onAmt
      ctx.save()
      ctx.globalAlpha = 0.25 * onAmt
      ctx.fillStyle = "#7cf5ff"
      ctx.fillRect(px - wdt * 2.4, hitY, wdt * 4.8, pylonY - hitY)
      ctx.globalAlpha = 0.95 * onAmt
      ctx.shadowColor = "#7cf5ff"
      ctx.shadowBlur = 18
      const g = ctx.createLinearGradient(px - wdt / 2, 0, px + wdt / 2, 0)
      g.addColorStop(0, "rgba(124,245,255,0.1)")
      g.addColorStop(0.5, "#f2ffff")
      g.addColorStop(1, "rgba(124,245,255,0.1)")
      ctx.fillStyle = g
      ctx.fillRect(px - wdt / 2, hitY, wdt, pylonY - hitY)
      ctx.beginPath()
      ctx.arc(px, hitY + 3, 4.5 + 4.5 * onAmt, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(240,255,255,0.95)"
      ctx.fill()
      ctx.restore()
    }
  }

  private drawProjectiles() {
    const { ctx } = this
    for (const pr of this.projectiles) {
      ctx.save()
      ctx.translate(pr.x, pr.y)
      ctx.shadowColor = "#ffc94d"
      ctx.shadowBlur = 14
      const g = ctx.createLinearGradient(0, -11, 0, 8)
      g.addColorStop(0, "#ffe9a8")
      g.addColorStop(0.5, "#ffc94d")
      g.addColorStop(1, "#c07f0e")
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(0, -11)
      ctx.quadraticCurveTo(6, -4, 5, 6)
      ctx.lineTo(-5, 6)
      ctx.quadraticCurveTo(-6, -4, 0, -11)
      ctx.closePath()
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = "#ff6a5c"
      ctx.beginPath()
      ctx.moveTo(0, -11)
      ctx.quadraticCurveTo(3.4, -7, 3, -4)
      ctx.lineTo(-3, -4)
      ctx.quadraticCurveTo(-3.4, -7, 0, -11)
      ctx.fill()
      const fl = 6 + Math.sin(this.time * 42) * 3
      ctx.fillStyle = "#ff8a3d"
      ctx.beginPath()
      ctx.moveTo(-3, 6)
      ctx.lineTo(0, 10 + fl)
      ctx.lineTo(3, 6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  private drawBalls() {
    if (this.phase === "menu") return
    const { ctx } = this
    const mode =
      this.time < this.fireUntil
        ? { trail: "rgba(255,138,61,", mid: "#ffe9a8", core: "#ff5347", glow: "#ff8a3d" }
        : this.time < this.slowUntil
          ? { trail: "rgba(93,255,176,", mid: "#d2ffee", core: "#2fd98a", glow: "#5dffb0" }
          : this.time < this.fastUntil
            ? { trail: "rgba(255,106,92,", mid: "#ffd9d4", core: "#ff5347", glow: "#ff6a5c" }
            : { trail: "rgba(120,240,255,", mid: "#c9f6ff", core: "#38bcd8", glow: "#7cf5ff" }
    for (const b of this.balls) {
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i]
        const a = (i / b.trail.length) * 0.28
        ctx.beginPath()
        ctx.arc(t.x, t.y, b.r * (0.3 + (i / b.trail.length) * 0.6), 0, Math.PI * 2)
        ctx.fillStyle = `${mode.trail}${a})`
        ctx.fill()
      }
      if (b.stuck) {
        const pr = b.r + 6 + Math.sin(this.time * 6) * 2.5
        const c = Math.PI * 2 * pr
        const n = 18
        const seg = c / n
        ctx.beginPath()
        ctx.arc(b.x, b.y, pr, Math.PI / 2, Math.PI / 2 + Math.PI * 2)
        ctx.strokeStyle = `${mode.trail}0.65)`
        ctx.lineWidth = 2
        ctx.setLineDash([seg * 0.45, seg * 0.55])
        ctx.lineDashOffset = -this.time * 30
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
      }
      const sq = b.squash * 0.28
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.scale(1 + sq, 1 - sq)
      ctx.shadowColor = mode.glow
      ctx.shadowBlur = 16
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, b.r)
      g.addColorStop(0, "#ffffff")
      g.addColorStop(0.55, mode.mid)
      g.addColorStop(1, mode.core)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, b.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  private drawPaddle() {
    const { ctx } = this
    const p = this.paddle
    const ww = p.w * (1 + p.squash * 0.12)
    const hh = p.h * (1 - p.squash * 0.3)
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(clamp(p.vx * 0.00011, -0.1, 0.1))
    const wide = this.time < this.wideUntil
    const shrink = !wide && this.time < this.shrinkUntil
    ctx.shadowColor = wide ? "#ffc94d" : shrink ? "#ff5347" : "#35e0ff"
    ctx.shadowBlur = 22
    const g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2)
    if (wide) {
      g.addColorStop(0, "#ffe9a8")
      g.addColorStop(0.5, "#ffc94d")
      g.addColorStop(1, "#c07f0e")
    } else if (shrink) {
      g.addColorStop(0, "#ffb8b0")
      g.addColorStop(0.5, "#ff5347")
      g.addColorStop(1, "#8f1d12")
    } else {
      g.addColorStop(0, "#aef7ff")
      g.addColorStop(0.5, "#35e0ff")
      g.addColorStop(1, "#0e86a3")
    }
    ctx.fillStyle = g
    this.roundRect(-ww / 2, -hh / 2, ww, hh, hh / 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    this.roundRect(-ww / 2 + 6, -hh / 2 + 2.5, ww - 12, 4, 2)
    ctx.fill()
    ctx.fillStyle = "rgba(4,18,26,0.35)"
    ctx.beginPath()
    ctx.arc(-ww / 2 + hh / 2, 0, hh * 0.22, 0, Math.PI * 2)
    ctx.arc(ww / 2 - hh / 2, 0, hh * 0.22, 0, Math.PI * 2)
    ctx.fill()
    const laserOn = this.time < this.laserUntil
    const rocketOn = this.time < this.rocketUntil
    if (laserOn || this.laserArmed) {
      const charge = !laserOn && this.laserArmed ? 8 + Math.sin(this.time * 16) * 6 : 10
      ctx.shadowColor = "#7cf5ff"
      ctx.shadowBlur = charge
      ctx.fillStyle = !laserOn && this.laserArmed ? "#5fd8ef" : "#9df2ff"
      for (const s of [-0.36, 0.36]) {
        this.roundRect(ww * s - 3, -hh / 2 - 9, 6, 10, 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }
    if (rocketOn) {
      ctx.shadowColor = "#ffc94d"
      ctx.shadowBlur = 10
      ctx.fillStyle = "#ffe9a8"
      this.roundRect(-4.5, -hh / 2 - 13, 9, 14, 3)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = "#ff6a5c"
      ctx.beginPath()
      ctx.arc(0, -hh / 2 - 13, 3, Math.PI, 0)
      ctx.fill()
    }
    if (this.time < this.magnetUntil) {
      const pulse = 0.5 + Math.sin(this.time * 8) * 0.25
      ctx.strokeStyle = `rgba(77,255,158,${pulse})`
      ctx.lineWidth = 2.5
      ctx.setLineDash([6, 7])
      ctx.lineDashOffset = -this.time * 30
      ctx.beginPath()
      ctx.arc(0, -hh / 2 - 4, ww * 0.44, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
    }
    ctx.restore()
  }

  private drawParticles() {
    const { ctx } = this
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1)
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawPopups() {
    const { ctx } = this
    for (const p of this.popups) {
      const a = clamp(1 - p.t, 0, 1)
      ctx.globalAlpha = a
      ctx.font = `700 ${p.size}px "Russo One", sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.shadowColor = p.color
      ctx.shadowBlur = 12
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y)
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }
}
