/**
 * Электрошар: цепь искр при ударе. От блока удара искра последовательно
 * (с задержкой SPARK_CHAIN_DELAY) перескакивает к ближайшим живым блокам,
 * нанося каждому обычный урон прямого попадания. Чистая логика без Canvas.
 */
import type { Ball, Block, SparkHit } from "../types"
import { clamp } from "../utils"

/** Радиус прыжка искры к следующему блоку (в мировых единицах). */
export const SPARK_CHAIN_RADIUS = 95
/** Максимальное число звеньев цепи от одного удара. */
export const SPARK_CHAIN_MAX = 4
/** Задержка между последовательными прыжками искры, сек. */
export const SPARK_CHAIN_DELAY = 0.07

/** Опции цепи: лимиты зоны и исключение блока прямого попадания. */
export interface SparkChainOptions {
  max?: number
  radius?: number
  /** Блок удара исключается из цепи — свой урон он уже получил. */
  exclude?: Block
}

/** Жадная цепь: каждый следующий блок — ближайший живой к предыдущему звену. */
export function sparkChainTargets(
  blocks: Block[],
  from: { x: number; y: number },
  opts: SparkChainOptions = {}
): Block[] {
  const max = opts.max ?? SPARK_CHAIN_MAX
  const radius = opts.radius ?? SPARK_CHAIN_RADIUS
  const chain: Block[] = []
  const used = new Set<Block>()
  let px = from.x
  let py = from.y
  for (;;) {
    let best: Block | null = null
    let bestD = Infinity
    for (const b of blocks) {
      if (b.dead || b === opts.exclude || used.has(b)) continue
      const d = Math.hypot(b.x - px, b.y - py)
      if (d <= radius && d < bestD) {
        bestD = d
        best = b
      }
    }
    if (!best || chain.length >= max) break
    used.add(best)
    chain.push(best)
    px = best.x
    py = best.y
  }
  return chain
}

/** Поставить цепь в очередь ударов: каждое звено бьёт позже предыдущего. */
export function queueSparkChain(
  queue: SparkHit[],
  targets: Block[],
  from: { x: number; y: number },
  now: number
): void {
  let px = from.x
  let py = from.y
  for (let i = 0; i < targets.length; i++) {
    const b = targets[i]
    queue.push({ block: b, from: { x: px, y: py }, at: now + (i + 1) * SPARK_CHAIN_DELAY })
    px = b.x
    py = b.y
  }
}

/** Радиус действия грозового ореола: множитель к радиусу шара (4 * ball.r = 2 диаметра шара). */
export const SPARK_AURA_RADIUS_RATIO = 4
/** Кулдаун разряда грозового ореола по одному блоку, сек. */
export const SPARK_AURA_COOLDOWN = 0.35

/**
 * Расстояние от поверхности шара до поверхности блока (0, если шар касается или перекрывает блок).
 * Поддерживает круглые блоки, прямоугольники (включая скруглённые) и повёрнутые эллипсы.
 */
export function distanceToBlockSurface(
  ball: { x: number; y: number; r: number },
  b: Block
): number {
  const dx = ball.x - b.x
  const dy = ball.y - b.y

  // 1. Круг
  if (b.circle || b.shape === "circle" || b.rx === b.ry) {
    return Math.max(0, Math.hypot(dx, dy) - b.rx - ball.r)
  }

  // Перевод в локальные координаты блока с учётом угла поворота
  const cs = Math.cos(b.rot)
  const sn = Math.sin(b.rot)
  const lx = dx * cs + dy * sn
  const ly = -dx * sn + dy * cs

  // 2. Прямоугольник или скруглённый прямоугольник
  const isBox = b.shape === "rect" || b.shape === "round_rect"
  if (isBox) {
    const cr = b.shape === "round_rect" ? Math.min(12, b.rx * 0.5, b.ry * 0.5) : 0
    const hx = Math.max(0, b.rx - cr)
    const hy = Math.max(0, b.ry - cr)
    const cx = Math.max(-hx, Math.min(hx, lx))
    const cy = Math.max(-hy, Math.min(hy, ly))
    const d = Math.hypot(lx - cx, ly - cy)
    return Math.max(0, d - cr - ball.r)
  }

  // 3. Эллипс (rx !== ry)
  const a = b.rx
  const bY = b.ry
  const q = (lx * lx) / (a * a) + (ly * ly) / (bY * bY)
  if (q <= 1) return 0

  const px = Math.abs(lx)
  const py = Math.abs(ly)
  let th = Math.atan2(a * py, bY * px)
  for (let iter = 0; iter < 3; iter++) {
    const c = Math.cos(th)
    const s = Math.sin(th)
    const f = a * px * s - bY * py * c - (a * a - bY * bY) * s * c
    const df = a * px * c + bY * py * s - (a * a - bY * bY) * (c * c - s * s)
    if (Math.abs(df) < 1e-9) break
    th = Math.max(0, Math.min(Math.PI * 0.5, th - f / df))
  }
  const cx = a * Math.cos(th) * (lx < 0 ? -1 : 1)
  const cy = bY * Math.sin(th) * (ly < 0 ? -1 : 1)
  const dist = Math.hypot(lx - cx, ly - cy)
  return Math.max(0, dist - ball.r)
}

/** Окружение для работы грозового ореола электрического шара. */
export interface SparkAuraWorld {
  readonly time: number
  readonly sparkUntil?: number
  sparkActive?: () => boolean
  readonly upgrades?: Record<string, number>
  readonly balls: Ball[]
  readonly blocks: Block[]
  readonly w: number
  readonly fx: {
    lightnings: { x1: number; y1: number; x2: number; y2: number; t: number }[]
    burst(x: number, y: number, color: string, count: number, speed: number): void
  }
  readonly sfx: {
    zap(pan?: number): void
  }
  readonly physics: {
    damageBlock(b: Block, dmg?: number): void
  }
}

/**
 * Проверяет пролёт электрического шара рядом с блоками (в радиусе 2 диаметров).
 * При наличии постоянного улучшения «Грозовой ореол» (`sparkAura`) испускает дуговую молнию
 * с нанесением 1 урона по каждому блоку в зоне (с кулдауном 0.35 с на блок).
 */
export function updateSparkAura(g: SparkAuraWorld): void {
  if ((g.upgrades?.sparkAura ?? 0) <= 0) return
  const isSparkActive = g.sparkActive ? g.sparkActive() : (g.sparkUntil ?? 0) > g.time
  if (!isSparkActive) return

  for (const ball of g.balls) {
    if (ball.lost || ball.stuck) continue
    const maxRange = ball.r * SPARK_AURA_RADIUS_RATIO

    const blocks = g.blocks.slice()
    for (const b of blocks) {
      if (b.dead) continue
      if (b.sp?.phase) {
        const phase = b.sp.phase
        if (
          Number.isFinite(phase.period) &&
          phase.period > 0 &&
          Number.isFinite(phase.active) &&
          Number.isFinite(phase.offset)
        ) {
          const active = clamp(phase.active, 0, 1)
          const norm = (((g.time + phase.offset) % phase.period) + phase.period) % phase.period
          if (norm / phase.period >= active) continue
        }
      }
      if (b.sp?.portalId !== undefined && (b.sp.portalCd ?? 0) > 0) continue
      if (
        b.sparkAuraAt !== undefined &&
        g.time >= b.sparkAuraAt &&
        g.time - b.sparkAuraAt < SPARK_AURA_COOLDOWN
      ) {
        continue
      }

      const dist = distanceToBlockSurface(ball, b)
      if (dist <= maxRange) {
        b.sparkAuraAt = g.time
        g.fx.lightnings.push({ x1: ball.x, y1: ball.y, x2: b.x, y2: b.y, t: 0 })
        g.fx.burst(b.x, b.y, "#ffe95c", 4, 120)
        const pan = clamp((b.x / (g.w || 400)) * 2 - 1, -0.85, 0.85)
        g.sfx.zap(pan)
        g.physics.damageBlock(b, 1)
      }
    }
  }
}
