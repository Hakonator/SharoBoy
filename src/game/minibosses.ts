/**
 * Мини-боссы кампании: стилизованные обитатели водной фауны (рыба, медуза),
 * собранные из перекрывающихся эллипсов в цельный силуэт. Блоки существа
 * неразрушаемы — урон идёт в общий пул HP (MINIBOSS_HP), над существом
 * рисуется полоска здоровья; при обнулении пула существо взрывается целиком.
 * Появляются в обычных боевых узлах кампании с фиксированным шансом —
 * детерминированно по сиду карты, одна и та же карта всегда даёт минибоссов
 * в одних и тех же узлах. За уничтожение полагается жизнь с шансом
 * MINIBOSS_LIFE_CHANCE — других источников жизней в кампании нет.
 *
 * Чистые функции без обращений к движку — модуль тестируется автономно.
 */
import type { Block } from "./types"
import { mulberry32, rand } from "./utils"

export type MinibossKind = "fish" | "jelly"

/** Шанс появления минибосса в обычном узле кампании (по задумке: 10–20%). */
export const MINIBOSS_NODE_CHANCE = 0.15
/** Шанс дропа жизни за полностью уничтоженного минибосса. */
export const MINIBOSS_LIFE_CHANCE = 0.8

const NAMES: Record<MinibossKind, string> = {
  fish: "РЫБА-ШАР",
  jelly: "МЕДУЗА",
}

export function minibossName(kind: MinibossKind): string {
  return NAMES[kind]
}

/**
 * Детерминированный розыгрыш минибосса для узла кампании.
 * @param seed сид карты кампании
 * @param nodeId идентификатор узла
 * @returns вид минибосса или null — в этом узле минибосса нет
 */
export function rollMiniboss(seed: number, nodeId: number): MinibossKind | null {
  const rng = mulberry32((seed + nodeId * 104729) | 0 || 1)
  if (rng() >= MINIBOSS_NODE_CHANCE) return null
  return rng() < 0.5 ? "fish" : "jelly"
}

/** Общий запас HP существа: блоки минибосса не разрушаются поодиночке. */
export const MINIBOSS_HP: Record<MinibossKind, number> = {
  fish: 60,
  jelly: 50,
}

/** Фабрика части существа: эллипс с наклоном, «плавание» через sway. */
function makePart(opts: {
  x: number
  y: number
  rx: number
  ry: number
  rot?: number
  tier: 1 | 2 | 3
  part: Block["mbPart"]
  swayAmp: number
  swayFreq: number
}): Block {
  return {
    x: opts.x,
    y: opts.y,
    rx: opts.rx,
    ry: opts.ry,
    rot: opts.rot ?? 0,
    circle: Math.abs(opts.rx - opts.ry) < 0.6 && !(opts.rot ?? 0),
    hp: opts.tier,
    maxHp: opts.tier,
    tier: opts.tier,
    flash: 0,
    seed: rand(0, Math.PI * 2),
    dead: false,
    x0: opts.x,
    swayAmp: opts.swayAmp,
    swayFreq: opts.swayFreq,
    swayPh: 0, // одна фаза на всё существо — плывёт как единое целое
    bomb: false,
    splits: false,
    isMiniboss: true,
    mbPart: opts.part,
  }
}

/**
 * Рыба: обтекаемое тело из перекрывающихся эллипсов, раздвоенный хвост,
 * спинной и грудной плавники, глаз. Плывёт носом вправо, патрулирует поле.
 * Тиры: тело — 2 (золото), плавники — 1 (зелень), глаз — 3 (акцент).
 */
export function buildFish(w: number, h: number, top: number): Block[] {
  void h
  const cx = w / 2
  const cy = top + 165
  const S = { swayAmp: 26, swayFreq: 0.45 }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, ...S })
  return [
    // тело: три эллипса, сужающиеся к хвосту и к носу
    p(0, 0, 52, 30, 2, "body"),
    p(-36, 3, 38, 24, 2, "body"),
    p(36, -3, 38, 24, 2, "body"),
    // широкий и низкий раздвоенный хвост
    p(-52, 0, 14, 10, 1, "tail"),
    p(-72, -1, 26, 5, 1, "tail", -0.55),
    p(-72, 1, 26, 5, 1, "tail", 0.55),
    // массивный спинной плавник
    p(-2, -36, 26, 12, 1, "dorsal"),
    // грудной плавник
    p(16, 18, 18, 10, 1, "pectoral", 0.5),
    // глаз
    p(46, -10, 5, 5, 3, "eye"),
  ]
}

/**
 * Медуза: пышный купол с бахромой по нижнему краю и пятью щупальцами-цепочками.
 * Тиры: купол — 3 (розовый), щупальца — 1 (зелень).
 */
export function buildJelly(w: number, h: number, top: number): Block[] {
  void h
  const cx = w / 2
  const cy = top + 160
  const S = { swayAmp: 14, swayFreq: 0.6 }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, ...S })
  const blocks: Block[] = [
    // купол: большой эллипс плюс «наползание» сверху
    p(0, 0, 48, 34, 3, "dome"),
    p(0, -12, 40, 26, 3, "dome"),
  ]
  // бахрома по нижнему краю купола
  for (let i = -3; i <= 3; i++) blocks.push(p(i * 12, 24, 8, 8, 3, "fringe"))
  // щупальца: пять цепочек из четырёх шариков с лёгким изгибом
  for (let t = 0; t < 5; t++) {
    const tx = -32 + t * 16
    for (let s = 0; s < 4; s++) {
      blocks.push(p(tx + (s % 2 ? 3 : -3), 36 + s * 14, 6.5, 6.5, 1, "tentacle"))
    }
  }
  return blocks
}

/** Нормализованная проверка пересечения кругов с запасом (pad, px). */
function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
  pad = 0
): boolean {
  const dx = ax - bx
  const dy = ay - by
  const rr = ar + br + pad
  return dx * dx + dy * dy < rr * rr
}

/**
 * Убирает из раскладки уровня блоки, на которые налегает существо, —
 * силуэт минибосса остаётся аккуратным и целостным, без наложений.
 */
export function carveLevelBlocks(level: Block[], creature: Block[]): Block[] {
  return level.filter(
    (b) => !creature.some((c) => circlesOverlap(b.x, b.y, Math.max(b.rx, b.ry), c.x, c.y, c.rx, 6))
  )
}
