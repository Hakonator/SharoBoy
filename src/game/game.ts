import { SFX } from "./audio"
import { evaluateAch } from "./achievements"
import { LEVELS, type LevelSpec, type PatternSpec } from "./levels"
import { POWER_META, TIER } from "./palette"
import {
  drawBackground,
  drawBalls,
  drawBlocks,
  drawBoss,
  drawLaserBeams,
  drawPaddle,
  drawParticles,
  drawPowers,
  drawProjectiles,
  drawPopups,
  drawRings,
  drawShieldLine,
} from "./render"
import type {
  Ball,
  Block,
  BossState,
  Bubble,
  PaddleState,
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

  private paddle: PaddleState = { x: 480, y: 600, w: 150, baseW: 150, h: 18, vx: 0, squash: 0 }
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

    drawBackground(ctx, w, h, this.combo, this.bubbles)
    drawShieldLine(ctx, w, h, this.time, this.shield, this.phase === "menu")
    drawBlocks(ctx, this.blocks, this.time)
    drawBoss(ctx, this.boss, this.balls)
    drawRings(ctx, this.rings)
    drawPowers(ctx, this.powers)
    drawLaserBeams(ctx, {
      time: this.time,
      hidden: this.phase === "menu",
      laserUntil: this.laserUntil,
      paddle: this.paddle,
      blocks: this.blocks,
      boss: this.boss,
    })
    drawProjectiles(ctx, this.projectiles, this.time)
    drawBalls(ctx, this.balls, {
      time: this.time,
      hidden: this.phase === "menu",
      fire: this.time < this.fireUntil,
      slow: this.time < this.slowUntil,
      fast: this.time < this.fastUntil,
    })
    if (this.phase !== "menu") {
      drawPaddle(ctx, {
        p: this.paddle,
        time: this.time,
        wideUntil: this.wideUntil,
        shrinkUntil: this.shrinkUntil,
        laserUntil: this.laserUntil,
        laserArmed: this.laserArmed,
        rocketUntil: this.rocketUntil,
        magnetUntil: this.magnetUntil,
      })
    }
    drawParticles(ctx, this.particles)
    drawPopups(ctx, this.popups)

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
}
