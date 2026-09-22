/**
 * Электрошар: цепь искр при ударе. От блока удара искра последовательно
 * (с задержкой SPARK_CHAIN_DELAY) перескакивает к ближайшим живым блокам,
 * нанося каждому обычный урон прямого попадания. Чистая логика без Canvas.
 */
import type { Block, SparkHit } from "../types"

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
