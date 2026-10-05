/**
 * Физика шара и разрушений: интеграция движения с подшагами, отскоки от стен,
 * ракетки, блоков, босса и щита, урон блокам, «матрёшки» и множитель серии.
 * Решения о последствиях (очки, дропы, HUD) — через узкий PhysicsWorld.
 */
import type { Effects } from "./effects"
import type { SFX } from "./audio"
import type {
  Ball,
  Block,
  BossState,
  PaddleState,
  PaddleShapeKind,
  PowerUp,
  SparkHit,
} from "./types"
import { clamp, rand } from "./utils"
import { convexBump, surfaceAt } from "./physics/shapes"
import {
  applyBlockMagnets,
  collideBlocks as blockBounce,
  collideBoss as bossBounce,
  collidePaddle as paddleBounce,
} from "./physics/collide"
import { isBlockPhaseActive } from "./physics/collide"
import {
  damageBlock as applyBlockDamage,
  finishSpinDeaths as applySpinDeathFinisher,
  spawnScatter as scatterBlocks,
  updateBombs as moveBombs,
} from "./physics/destruction"
import { ballSpeedMult } from "./physics/speed"
import { applyBallTimers, specialSpeedMult } from "./physics/special"
import { spawnBallTrailFx } from "./physics/ballFx"

export { FIREBALL_DAMAGE_MULT } from "./physics/destruction"
export { FROST_FREEZE_RADIUS, freezeCluster } from "./physics/frost"
export {
  SPARK_CHAIN_DELAY,
  SPARK_CHAIN_MAX,
  SPARK_CHAIN_RADIUS,
  queueSparkChain,
  sparkChainTargets,
} from "./physics/spark"
export {
  CLEAR_RAMP_MAX,
  FAST_SPEED_MULT,
  SLOW_SPEED_MULT,
  SPEEDUP_RATIO,
  ballSpeedMult,
  isBallSpedUp,
} from "./physics/speed"

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
  /** Верхняя неигровая HUD-зона (мировые единицы): шар не заходит выше неё. */
  readonly blockTop: number
  /** Нижний край видимого HUD в обеих ориентациях — только для новых блоков. */
  readonly blockSpawnTop: number
  readonly time: number
  readonly aimAngle: number
  readonly paddle: PaddleState
  readonly blocksInitial: number
  readonly boss: BossState | null
  readonly input: PaddleInput
  balls: Ball[]
  blocks: Block[]
  powers: PowerUp[]
  boomQueue: { x: number; y: number; at: number }[]
  /** Очередь звеньев цепи искр электрошара: заполняется при ударе,
   *  разбирается игровым циклом (каждое звено бьёт по расписанию). */
  readonly sparkQueue: SparkHit[]
  shield: number
  combo: number
  shake: number
  hitStop: number
  flash: number
  fx: Effects
  sfx: SFX
  fireActive(): boolean
  frostActive(): boolean
  sparkActive(): boolean
  slowActive(): boolean
  fastActive(): boolean
  magnetActive(): boolean
  magneticPaddleActive(): boolean
  wideActive(): boolean
  shrinkActive(): boolean
  /** Форма верхней поверхности ракетки (эффекты отладки). */
  paddleShape(): PaddleShapeKind
  /** Активен ли поворотный эффект (ЛКМ/ПКМ меняют наклон ракетки) — в этом
   *  режиме арканоидное «искажение» отскока отключается. */
  paddleRotatable(): boolean
  aimGuideActive(): boolean
  bounceGuideActive(): boolean
  addScore(n: number, x: number, y: number, color: string, size: number): void
  dropPower(x: number, y: number): void
  damageBoss(dmg: number, fromWeapon: boolean): void
  /** Урон в пул HP минибосса, по блоку которого пришёл удар (блоки существа
   *  неразрушаемы) — существ в уровне может быть несколько. */
  damageMiniboss(dmg: number, block: Block): void
  /** Попадание бомбы осьминога по ракетке. */
  onBombHitPaddle(): void
  pushHud(): void
  /** Множитель урона шара (отладка: увеличивается клавишей NumpadSubtract). */
  readonly debugBallDamage: number
}

export class Physics {
  constructor(private readonly g: PhysicsWorld) {}

  /** Высота купола выпуклой ракетки — единая для физики и рендера.
   *  Чаша использует ту же глубину (инверсия купола). */
  static convexBump(halfW: number): number {
    return convexBump(halfW)
  }

  /** Высота поверхности ракетки над плоской гранью — см. physics/shapes.ts. */
  static surfaceAt(halfW: number, relX: number, kind: PaddleShapeKind, hh = 0): number {
    return surfaceAt(halfW, relX, kind, hh)
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

  /** Прилипший шар держится на ракетке — даже пока мир «заморожен» баннером/отсчётом.
   *  Шар сидит на поверхности формы в точке смещения (купол/чаша/грань). */
  stickToPaddle(ball: Ball) {
    if (!ball.stuck) return
    const g = this.g
    const p = g.paddle
    ball.x = p.x + ball.stuckOffset
    const rel = clamp(ball.stuckOffset / (p.w / 2), -1, 1)
    ball.y = p.y - p.h / 2 - surfaceAt(p.w / 2, rel, g.paddleShape(), p.h) - ball.r - 2
  }

  /** Прицельная линия кончается на первом препятствии и отражается по его нормали. */
  aimGuide(ball: Ball) {
    const g = this.g
    const angle = g.aimGuideActive() ? g.aimAngle : -Math.PI / 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    let distance = Infinity
    let nx = 0
    let ny = 0
    const consider = (t: number, x: number, y: number) => {
      if (t <= 1 || t >= distance) return
      distance = t
      nx = x
      ny = y
    }
    if (dx < 0) consider((ball.r - ball.x) / dx, 1, 0)
    if (dx > 0) consider((g.w - ball.r - ball.x) / dx, -1, 0)
    if (dy < 0) consider((g.blockTop + ball.r - ball.y) / dy, 0, 1)
    if (g.shield > 0 && dy > 0) consider((g.h - 14 - ball.r - ball.y) / dy, 0, -1)
    for (const block of g.blocks) {
      if (block.dead || (block.sp?.phase && !isBlockPhaseActive(block, g.time))) continue
      if (block.sp?.portalId !== undefined && (block.sp.portalCd ?? 0) > 0) continue
      const cs = Math.cos(block.rot)
      const sn = Math.sin(block.rot)
      const qx = (ball.x - block.x) * cs + (ball.y - block.y) * sn
      const qy = -(ball.x - block.x) * sn + (ball.y - block.y) * cs
      const vx = dx * cs + dy * sn
      const vy = -dx * sn + dy * cs
      const rx = block.rx + ball.r
      const ry = block.ry + ball.r
      const a = (vx * vx) / (rx * rx) + (vy * vy) / (ry * ry)
      const b = (2 * qx * vx) / (rx * rx) + (2 * qy * vy) / (ry * ry)
      const c = (qx * qx) / (rx * rx) + (qy * qy) / (ry * ry) - 1
      const disc = b * b - 4 * a * c
      if (disc < 0 || a === 0) continue
      const root = Math.sqrt(disc)
      const first = (-b - root) / (2 * a)
      const second = (-b + root) / (2 * a)
      const t = first > 1 ? first : second
      const hx = qx + vx * t
      const hy = qy + vy * t
      const nl = Math.hypot(hx / (rx * rx), hy / (ry * ry)) || 1
      const lnx = hx / (rx * rx) / nl
      const lny = hy / (ry * ry) / nl
      if (t > 1) consider(t, lnx * cs - lny * sn, lnx * sn + lny * cs)
    }
    const boss = g.boss
    if (boss) {
      const ox = ball.x - boss.x
      const oy = ball.y - boss.y
      const b = 2 * (ox * dx + oy * dy)
      const c = ox * ox + oy * oy - (boss.r + ball.r) ** 2
      const disc = b * b - 4 * c
      if (disc >= 0) {
        const t = (-b - Math.sqrt(disc)) / 2
        const hx = ball.x + dx * t
        const hy = ball.y + dy * t
        const nl = Math.hypot(hx - boss.x, hy - boss.y) || 1
        consider(t, (hx - boss.x) / nl, (hy - boss.y) / nl)
      }
    }
    if (!Number.isFinite(distance)) distance = Math.max(g.w, g.h) * 2
    const hitX = ball.x + dx * distance
    const hitY = ball.y + dy * distance
    const dot = dx * nx + dy * ny
    return {
      x: ball.x,
      y: ball.y,
      dx,
      dy,
      hitX,
      hitY,
      bounceX: hitX - 2 * dot * nx,
      bounceY: hitY - 2 * dot * ny,
      bounceDx: dx - 2 * dot * nx,
      bounceDy: dy - 2 * dot * ny,
    }
  }

  /** Интеграция движения шара с подшагами: стены, щит, потери, столкновения. */
  updateBall(ball: Ball, dt: number) {
    const g = this.g
    if (ball.stuck) {
      this.stickToPaddle(ball)
      return
    }

    ball.sinceHit += dt
    // таймеры спецблоков (пружина/вата) тикают вниз
    applyBallTimers(ball, dt)

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
      if (ball.y - ball.r < g.blockTop) {
        ball.y = g.blockTop + ball.r
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

      paddleBounce(this.g, ball)
      if (ball.stuck) {
        this.stickToPaddle(ball)
        return
      }
      blockBounce(this.g, ball)
      bossBounce(this.g, ball)
    }

    ball.trail.push({ x: ball.x, y: ball.y })
    if (ball.trail.length > 10) ball.trail.shift()

    ball.squash = Math.max(0, ball.squash - dt * 6)

    // искры элементальных шаров (огонь/электро)
    spawnBallTrailFx(g, ball)

    // режимы скорости + нарастание по мере зачистки уровня
    const mult = ballSpeedMult({
      slow: g.slowActive(),
      fast: g.fastActive(),
      cleared: 1 - g.blocks.length / g.blocksInitial,
    })
    const cur = Math.hypot(ball.vx, ball.vy) || 1
    const target = ball.speed * mult * specialSpeedMult(ball)
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

    applyBlockMagnets(g, ball, dt)
  }

  /** Урон блоку; при разрушении — очки, эффекты, дроп бонуса, «матрёшка». */
  damageBlock(b: Block, dmg = 1) {
    applyBlockDamage(this.g, b, dmg)
  }

  /** Завершает минутную анимацию вращения перед разрушением блока. */
  finishSpinDeaths() {
    applySpinDeathFinisher(this.g)
  }

  /** «Матрёшка»: вокруг разбитого блока рассыпаются 3–10 крупных шаров. */
  spawnScatter(b: Block) {
    scatterBlocks(this.g, b)
  }

  /** Обновление бомб осьминога: движение и столкновение с ракеткой. */
  updateBombs(dt: number) {
    moveBombs(this.g, dt)
  }
}
