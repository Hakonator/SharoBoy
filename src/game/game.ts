import { SFX } from "./audio"
import { BossSystem } from "./boss"
import { Physics } from "./physics"
import { PowersSystem } from "./powers"
import { InputController } from "./input"
import { evaluateAch } from "./achievements"
import { Effects } from "./effects"
import { buildBossArena, gridBlocks, layoutBlocks } from "./levelBuilder"
import { LEVELS, type LevelSpec, type PatternSpec } from "./levels"
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
import type { Ball, Block, Bubble, PaddleState, Phase, PowerUp, Projectile } from "./types"
import type { HudData } from "./types"
import { clamp, daySeed, lsGet, lsSet, mulberry32, rand, rotatedExtents } from "./utils"
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
  private fx = new Effects()
  private bubbles: Bubble[] = []

  private input: InputController
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

  private readonly bossSys: BossSystem
  private readonly physics: Physics
  private readonly powersSys: PowersSystem
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
    this.input = new InputController(canvas, {
      paddleX: () => this.paddle.x,
      worldWidth: () => this.w,
      sfxEnsure: () => this.sfx.ensure(),
      isPlaying: () => this.phase === "playing",
      primaryAction: () => {
        if (this.phase === "menu" || this.phase === "over" || this.phase === "won") this.startGame()
        else if (this.phase === "playing") this.launch()
      },
      launchIfPlaying: () => {
        if (this.phase === "playing") this.launch()
      },
      togglePause: () => this.togglePause(),
      toggleMute: () => this.toggleMute(),
      onBlur: () => {
        if (this.phase === "playing") this.togglePause()
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- геттерам хоста нужно живое замыкание на Game
    const g = this
    this.bossSys = new BossSystem({
      get w() {
        return g.w
      },
      get h() {
        return g.h
      },
      get time() {
        return g.time
      },
      get shake() {
        return g.shake
      },
      set shake(v) {
        g.shake = v
      },
      get hitStop() {
        return g.hitStop
      },
      set hitStop(v) {
        g.hitStop = v
      },
      get flash() {
        return g.flash
      },
      set flash(v) {
        g.flash = v
      },
      get blocks() {
        return g.blocks
      },
      set blocks(v) {
        g.blocks = v
      },
      get powers() {
        return g.powers
      },
      get boomQueue() {
        return g.boomQueue
      },
      fx: g.fx,
      sfx: g.sfx,
      addRawScore: (n) => g.addRawScore(n),
      onBossKilled: () => g.onBossKilled(),
      pushHud: () => g.pushHud(),
    })
    this.powersSys = new PowersSystem({
      get w() {
        return g.w
      },
      get h() {
        return g.h
      },
      get time() {
        return g.time
      },
      paddle: g.paddle,
      get balls() {
        return g.balls
      },
      get blocks() {
        return g.blocks
      },
      get boss() {
        return g.bossSys.boss
      },
      get blocksInitial() {
        return g.blocksInitial
      },
      get powers() {
        return g.powers
      },
      set powers(v) {
        g.powers = v
      },
      get fieldShift() {
        return g.fieldShift
      },
      set fieldShift(v) {
        g.fieldShift = v
      },
      get spawnTimer() {
        return g.spawnTimer
      },
      set spawnTimer(v) {
        g.spawnTimer = v
      },
      get skyDropTimer() {
        return g.skyDropTimer
      },
      set skyDropTimer(v) {
        g.skyDropTimer = v
      },
      get shiftTimer() {
        return g.shiftTimer
      },
      set shiftTimer(v) {
        g.shiftTimer = v
      },
      get wideUntil() {
        return g.wideUntil
      },
      set wideUntil(v) {
        g.wideUntil = v
      },
      get slowUntil() {
        return g.slowUntil
      },
      set slowUntil(v) {
        g.slowUntil = v
      },
      get fastUntil() {
        return g.fastUntil
      },
      set fastUntil(v) {
        g.fastUntil = v
      },
      get shrinkUntil() {
        return g.shrinkUntil
      },
      set shrinkUntil(v) {
        g.shrinkUntil = v
      },
      get rocketUntil() {
        return g.rocketUntil
      },
      set rocketUntil(v) {
        g.rocketUntil = v
      },
      get fireUntil() {
        return g.fireUntil
      },
      set fireUntil(v) {
        g.fireUntil = v
      },
      get magnetUntil() {
        return g.magnetUntil
      },
      set magnetUntil(v) {
        g.magnetUntil = v
      },
      get laserArmed() {
        return g.laserArmed
      },
      set laserArmed(v) {
        g.laserArmed = v
      },
      get laserArmedUntil() {
        return g.laserArmedUntil
      },
      set laserArmedUntil(v) {
        g.laserArmedUntil = v
      },
      get shield() {
        return g.shield
      },
      set shield(v) {
        g.shield = v
      },
      get lives() {
        return g.lives
      },
      set lives(v) {
        g.lives = v
      },
      get shake() {
        return g.shake
      },
      set shake(v) {
        g.shake = v
      },
      fx: g.fx,
      sfx: g.sfx,
      addCoins: (n) => g.addCoins(n),
      pushHud: () => g.pushHud(),
    })
    this.physics = new Physics({
      get w() {
        return g.w
      },
      get h() {
        return g.h
      },
      get time() {
        return g.time
      },
      paddle: g.paddle,
      get blocksInitial() {
        return g.blocksInitial
      },
      get boss() {
        return g.bossSys.boss
      },
      input: g.input,
      get balls() {
        return g.balls
      },
      get blocks() {
        return g.blocks
      },
      set blocks(v) {
        g.blocks = v
      },
      get powers() {
        return g.powers
      },
      get boomQueue() {
        return g.boomQueue
      },
      get shield() {
        return g.shield
      },
      set shield(v) {
        g.shield = v
      },
      get combo() {
        return g.combo
      },
      set combo(v) {
        g.combo = v
      },
      get shake() {
        return g.shake
      },
      set shake(v) {
        g.shake = v
      },
      get hitStop() {
        return g.hitStop
      },
      set hitStop(v) {
        g.hitStop = v
      },
      fx: g.fx,
      sfx: g.sfx,
      fireActive: () => g.time < g.fireUntil,
      slowActive: () => g.time < g.slowUntil,
      fastActive: () => g.time < g.fastUntil,
      magnetActive: () => g.time < g.magnetUntil,
      wideActive: () => g.time < g.wideUntil,
      shrinkActive: () => g.time < g.shrinkUntil,
      addScore: (n, x, y, color, size) => g.addScore(n, x, y, color, size),
      dropPower: (x, y) => g.powersSys.dropPower(x, y),
      damageBoss: (dmg, fromWeapon) => g.bossSys.damage(dmg, fromWeapon),
      pushHud: () => g.pushHud(),
    })
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
    this.input.attach()
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
    this.input.destroy()
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

  /* ---------- управление игрой ---------- */

  startGame() {
    this.sfx.ensure()
    this.sfx.ui()
    this.mode = "campaign"
    this.wave = 0
    this.waveSpec = null
    this.bossSys.clear()
    this.boomQueue = []
    this.score = 0
    this.lives = 3 + (this.upgrades.life ?? 0)
    this.combo = 0
    this.level = 1
    this.newRecord = false
    this.runBossKills = 0
    this.runLivesLost = 0
    this.fx.clear()
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
    this.bossSys.clear()
    this.boomQueue = []
    this.score = 0
    this.lives = 3 + (this.upgrades.life ?? 0)
    this.combo = 0
    this.level = 1
    this.newRecord = false
    this.runBossKills = 0
    this.runLivesLost = 0
    this.fx.clear()
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
    this.input.releaseLock()
    this.phase = "menu"
    this.balls = []
    this.blocks = []
    this.powers = []
    this.projectiles = []
    this.bossSys.clear()
    this.boomQueue = []
    this.banner = null
    this.fx.clear()
    this.shake = 0
    this.flash = 0
    this.hitStop = 0
    this.pushHud()
  }

  togglePause() {
    if (this.phase === "playing") {
      this.phase = "paused"
      this.input.keys.space = false
      this.input.releaseLock()
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
    this.bossSys.clear()
    this.boomQueue = []
    this.fieldShift = null
    if ("boss" in spec) {
      const { boss, blocks } = buildBossArena(
        spec.boss.hp,
        spec.boss.minions,
        spec.boss.bombs,
        this.w,
        this.h
      )
      this.bossSys.spawn(boss)
      this.blocks = blocks
    } else if ("layout" in spec) {
      this.blocks = layoutBlocks(spec, this.w, this.h)
    } else {
      this.blocks = gridBlocks(spec, this.w, this.h)
    }
    this.blocksInitial = Math.max(1, this.blocks.length)
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
    const { boss, blocks } = buildBossArena(hp, minions, bombs, this.w, this.h)
    this.bossSys.spawn(boss)
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

    this.fx.step(dt)

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
    this.physics.updatePaddle(dt)
    this.powersSys.updatePowers(dt)
    this.powersSys.periodicSpawn(dt)
    this.powersSys.periodicPowerDrop(dt)
    this.powersSys.tryFieldShift(dt)
    this.bossSys.step(dt)
    if (this.boomQueue.length) {
      const due = this.boomQueue.filter((q) => this.time >= q.at)
      if (due.length) {
        this.boomQueue = this.boomQueue.filter((q) => this.time < q.at)
        for (const q of due) this.explode(q.x, q.y)
      }
    }

    const frozen = this.transition > 0 || this.bannerTimer > 1.1 || this.countdown > 0
    if (!frozen) {
      const fire = this.input.keys.space || this.input.consumeTapFire()
      this.updateLaser(fire)
      this.tryFire(dt, fire)
      this.updateProjectiles(dt)
      for (const ball of this.balls) this.physics.updateBall(ball, dt)
      this.balls = this.balls.filter((b) => !b.lost)
      if (this.balls.length === 0) this.loseLife()
    }

    for (const b of this.blocks) b.flash = Math.max(0, b.flash - dt * 5)

    if (
      this.blocks.length === 0 &&
      !this.bossSys.boss &&
      this.transition <= 0 &&
      this.phase === "playing"
    ) {
      this.onLevelCleared()
    }
  }

  private addScore(n: number, x: number, y: number, color: string, size: number) {
    this.score += Math.round(n)
    if (this.score > this.best) {
      this.best = this.score
      this.newRecord = true
      lsSet("sharoboy-best", String(this.best))
    }
    this.fx.popups.push({ x, y, text: `+${Math.round(n)}`, color, t: 0, size })
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
    this.fx.burst(p.x, p.y - p.h, "#ffc94d", 5, 120)
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
      this.physics.damageBlock(best, 3)
      this.fx.burst(px, best.y + bestHH, "#7cf5ff", 8, 180)
      this.fx.rings.push({
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
      this.bossSys.boss &&
      Math.abs(this.bossSys.boss.x - px) < this.bossSys.boss.r &&
      this.bossSys.boss.y + this.bossSys.boss.r < pylonY
    ) {
      this.bossSys.damage(2, true)
      this.fx.burst(px, this.bossSys.boss.y + this.bossSys.boss.r, "#7cf5ff", 8, 180)
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
        this.fx.particles.push({
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
      if (!pr.dead && this.bossSys.boss) {
        if (
          Math.hypot(pr.x - this.bossSys.boss.x, pr.y - this.bossSys.boss.y) <
          this.bossSys.boss.r + pr.r + 4
        ) {
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
    this.fx.rings.push({ x, y, r: 12, maxR: 150, color: "rgba(255,138,61,0.85)", t: 0 })
    this.fx.burst(x, y, "#ffc94d", 14, 270)
    this.fx.burst(x, y, "#ff8a3d", 10, 210)
    const R = 90
    for (const b of [...this.blocks]) {
      if (b.dead) continue
      if (Math.hypot(b.x - x, b.y - y) < R + Math.max(b.rx, b.ry)) this.physics.damageBlock(b, 3)
    }
    if (
      this.bossSys.boss &&
      Math.hypot(this.bossSys.boss.x - x, this.bossSys.boss.y - y) < R + this.bossSys.boss.r
    )
      this.bossSys.damage(3, true)
  }

  /* ---------- хост для BossSystem ---------- */

  /** Начисление очков без попапа и проверки рекорда (как было в damageBoss/killBoss). */
  private addRawScore(n: number) {
    this.score += n
  }

  /** Смерть босса засчитана в статистику партии (для достижений). */
  private onBossKilled() {
    this.runBossKills++
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
      this.fx.popups.push({
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
      this.input.releaseLock()
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
      this.input.releaseLock()
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
    drawBoss(ctx, this.bossSys.boss, this.balls)
    drawRings(ctx, this.fx.rings)
    drawPowers(ctx, this.powers)
    drawLaserBeams(ctx, {
      time: this.time,
      hidden: this.phase === "menu",
      laserUntil: this.laserUntil,
      paddle: this.paddle,
      blocks: this.blocks,
      boss: this.bossSys.boss,
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
    drawParticles(ctx, this.fx.particles)
    drawPopups(ctx, this.fx.popups)

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
