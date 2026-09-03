/**
 * Физика шара и разрушений: интеграция движения с подшагами, отскоки от стен,
 * ракетки, блоков, босса и щита, урон блокам, «матрёшки» и множитель серии.
 * Решения о последствиях (очки, дропы, HUD) — через узкий PhysicsWorld.
 */
import type { Effects } from "./effects"
import type { SFX } from "./audio"
import { TIER } from "./palette"
import type { Ball, Block, BossState, PaddleState, PowerUp } from "./types"
import { clamp, rand } from "./utils"

/** Узкий срез ввода, нужный ракетке (структурно совместим с InputController). */
export interface PaddleInput {
  readonly keys: { left: boolean; right: boolean }
  pointerX: number | null
  readonly locked: boolean
}

/** Хост-интерфейс: состояние движка, которым управляет физика. */
export interface PhysicsWorld {
  readonly w: number
  readonly h: number
  readonly time: number
  readonly paddle: PaddleState
  readonly blocksInitial: number
  readonly boss: BossState | null
  readonly input: PaddleInput
  balls: Ball[]
  blocks: Block[]
  powers: PowerUp[]
  boomQueue: { x: number; y: number; at: number }[]
  shield: number
  combo: number
  shake: number
  hitStop: number
  fx: Effects
  sfx: SFX
  fireActive(): boolean
  slowActive(): boolean
  fastActive(): boolean
  magnetActive(): boolean
  wideActive(): boolean
  shrinkActive(): boolean
  addScore(n: number, x: number, y: number, color: string, size: number): void
  dropPower(x: number, y: number): void
  damageBoss(dmg: number, fromWeapon: boolean): void
  pushHud(): void
}

export class Physics {
  constructor(private readonly g: PhysicsWorld) {}

  private comboMult() {
    return 1 + Math.min(this.g.combo, 20) * 0.1
  }

  /** Кинематика ракетки: целевая ширина (эффекты), клавиши/указатель, границы поля. */
  updatePaddle(dt: number) {
    const p = this.g.paddle
    let wMult = 1
    if (this.g.wideActive()) wMult = 1.45
    else if (this.g.shrinkActive()) wMult = 0.6
    const targetW = p.baseW * wMult
    p.w += (targetW - p.w) * Math.min(1, dt * 10)

    const inp = this.g.input
    if (inp.keys.left || inp.keys.right) {
      const dir = (inp.keys.right ? 1 : 0) - (inp.keys.left ? 1 : 0)
      p.vx += dir * 5200 * dt
      p.vx = clamp(p.vx, -900, 900)
      inp.pointerX = null
    } else if (inp.pointerX !== null) {
      const k = 1 - Math.exp(-dt * (inp.locked ? 44 : 26))
      p.vx = (inp.pointerX - p.x) * k * 30
      p.x += (inp.pointerX - p.x) * k
    } else {
      p.vx *= Math.exp(-dt * 10)
    }
    p.x += p.vx * dt
    p.x = clamp(p.x, p.w / 2 + 4, this.g.w - p.w / 2 - 4)
    p.squash = Math.max(0, p.squash - dt * 5)
  }

  /** Прилипший шар держится на ракетке — даже пока мир «заморожен» баннером/отсчётом. */
  stickToPaddle(ball: Ball) {
    if (!ball.stuck) return
    const g = this.g
    ball.x = g.paddle.x + ball.stuckOffset
    ball.y = g.paddle.y - g.paddle.h / 2 - ball.r - 2
  }

  /** Интеграция движения шара с подшагами: стены, щит, потери, столкновения. */
  updateBall(ball: Ball, dt: number) {
    const g = this.g
    if (ball.stuck) {
      this.stickToPaddle(ball)
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
        g.sfx.wall()
      }
      if (ball.x + ball.r > g.w) {
        ball.x = g.w - ball.r
        ball.vx = -Math.abs(ball.vx)
        ball.vy += rand(-1, 1) * speed * 0.06
        ball.squash = 1
        g.sfx.wall()
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r
        ball.vy = Math.abs(ball.vy)
        ball.squash = 1
        g.sfx.wall()
      }

      // низ — щит или потеря
      if (g.shield > 0 && ball.vy > 0 && ball.y + ball.r >= g.h - 14) {
        g.shield--
        ball.y = g.h - 14 - ball.r
        ball.vy = -Math.abs(ball.vy)
        ball.squash = 1
        ball.sinceHit = 0
        g.sfx.shieldHit()
        g.fx.burst(ball.x, g.h - 14, "#4dff9e", 14, 220)
        g.fx.rings.push({
          x: ball.x,
          y: g.h - 14,
          r: 8,
          maxR: 74,
          color: "rgba(77,255,158,0.8)",
          t: 0,
        })
        g.shake = Math.min(g.shake + 2.5, 8)
        g.pushHud()
        continue
      }
      if (ball.y > g.h + ball.r * 2) {
        ball.lost = true
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
    if (g.fireActive() && Math.random() < 0.75) {
      g.fx.particles.push({
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
    const cleared = 1 - g.blocks.length / g.blocksInitial
    const ramp = 1 + clamp(cleared, 0, 1) * 0.24
    const mult = (g.slowActive() ? 0.72 : g.fastActive() ? 1.32 : 1) * ramp
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

  /** Отскок от ракетки: угол зависит от точки попадания и её скорости; магнит — прилипание. */
  private collidePaddle(ball: Ball) {
    const g = this.g
    const p = g.paddle
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
      if (g.magnetActive() && !ball.stuck) {
        ball.stuck = true
        ball.stuckOffset = clamp(ball.x - p.x, -p.w / 2 + ball.r, p.w / 2 - ball.r)
        ball.vx = 0
        ball.vy = 0
        ball.squash = 1
        ball.sinceHit = 0
        g.sfx.paddle(Math.abs(rel))
        g.fx.burst(ball.x, top, "#4dff9e", 8, 140)
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
      g.combo = 0
      g.sfx.paddle(Math.abs(rel))
      g.fx.burst(ball.x, top, "#7cf5ff", 6, 130)
      g.pushHud()
    }
  }

  /** Столкновения с блоками: локальные координаты повёрнутого эллипса, отражение по нормали. */
  private collideBlocks(ball: Ball) {
    const g = this.g
    const fire = g.fireActive()
    for (const b of g.blocks) {
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
      g.sfx.burn()
      this.damageBlock(b, 2)
    }
  }

  /** Столкновение с боссом: круговое отражение + урон (огненное ядро бьёт сильнее). */
  private collideBoss(ball: Ball) {
    const g = this.g
    const bo = g.boss
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
    g.damageBoss(g.fireActive() ? 2 : 1, false)
  }

  /** Урон блоку; при разрушении — очки, эффекты, дроп бонуса, «матрёшка». */
  damageBlock(b: Block, dmg = 1) {
    const g = this.g
    b.hp -= dmg
    b.flash = 1
    if (b.hp > 0) {
      g.sfx.brick(b.tier)
      g.fx.burst(b.x, b.y, TIER[b.tier].base, 5, 130)
      g.combo++
      g.addScore(10 * this.comboMult(), b.x, b.y, "#9fd6ea", 12)
      if (b.tier === 3) g.hitStop = Math.max(g.hitStop, 0.03)
      g.pushHud()
      return
    }
    b.dead = true
    g.blocks = g.blocks.filter((x) => !x.dead)
    if (b.bomb && !b.boomQueued) {
      b.boomQueued = true
      g.boomQueue.push({ x: b.x, y: b.y, at: g.time + 0.09 })
    }
    if (b.splits) this.spawnScatter(b)
    g.combo++
    const mult = this.comboMult()
    g.addScore((30 + b.tier * 20) * mult, b.x, b.y, TIER[b.tier].base, 14 + b.tier * 2)
    g.sfx.destroy(b.tier)
    g.fx.burst(b.x, b.y, TIER[b.tier].base, 10 + b.tier * 4, 190 + b.tier * 40)
    g.fx.rings.push({
      x: b.x,
      y: b.y,
      r: 6,
      maxR: 40 + b.tier * 18,
      color: "rgba(234,247,255,0.7)",
      t: 0,
    })
    g.shake = Math.min(g.shake + b.tier, 9)
    if (b.tier === 3) g.hitStop = Math.max(g.hitStop, 0.05)

    // вехи серии
    if (g.combo === 5 || g.combo === 10 || g.combo === 15) {
      const word = g.combo === 5 ? "ГОРЯЧО!" : g.combo === 10 ? "НЕУДЕРЖИМО!" : "БЕЗУМИЕ!"
      g.fx.popups.push({
        x: g.w / 2,
        y: g.h * 0.3,
        text: `${word} ×${g.combo}`,
        color: "#ffc94d",
        t: 0,
        size: 30,
      })
      g.fx.rings.push({
        x: g.w / 2,
        y: g.h * 0.3,
        r: 10,
        maxR: 150,
        color: "rgba(255,201,77,0.6)",
        t: 0,
      })
      g.sfx.levelClear()
    }

    // дроп из блока
    g.dropPower(b.x, b.y)

    // монеты
    if (Math.random() < 0.05) {
      g.powers.push({ x: b.x, y: b.y, vy: 150, type: "coin", t: 0 })
    }
    g.pushHud()
  }

  /** «Матрёшка»: вокруг разбитого блока рассыпаются 3–10 крупных шаров. */
  spawnScatter(b: Block) {
    const g = this.g
    if (g.blocks.length > 150) return
    const n = 3 + Math.floor(rand(0, 8))
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.4, 0.4)
      const d = Math.max(b.rx, b.ry) * rand(1.7, 2.4)
      const r = rand(17, 23)
      const cx = clamp(b.x + Math.cos(a) * d, r + 6, g.w - r - 6)
      const cy = clamp(b.y + Math.sin(a) * d, r + 6, g.h * 0.72)
      g.blocks.push({
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
    g.fx.popups.push({ x: b.x, y: b.y, text: "РАССЫПЬ!", color: "#5dffb0", t: 0, size: 16 })
    g.fx.rings.push({ x: b.x, y: b.y, r: 8, maxR: 90, color: "rgba(93,255,176,0.7)", t: 0 })
    g.fx.burst(b.x, b.y, "#5dffb0", 10, 200)
  }
}
