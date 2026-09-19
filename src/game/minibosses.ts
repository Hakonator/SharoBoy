/**
 * Мини-боссы кампании: стилизованные обитатели водной фауны (рыба, медуза),
 * собранные из перекрывающихся эллипсов в цельный силуэт. Блоки существа
 * неразрушаемы — урон идёт в пул HP каждого существа (MINIBOSS_HP, растёт по
 * мере приближения к финальному боссу), над существом рисуется полоска
 * здоровья; при обнулении пула существо взрывается целиком. Появляются в
 * обычных боевых узлах кампании полностью случайно (иногда парой) с
 * pity-системой: пока существо не встретилось, шанс растёт, после появления —
 * снова базовый. За уничтожение полагается жизнь с шансом MINIBOSS_LIFE_CHANCE
 * — других источников жизней в кампании нет.
 *
 * Чистые функции без обращений к движку — модуль тестируется автономно.
 */
import type { Block } from "./types"
import { clamp, rand } from "./utils"

export type MinibossKind = "fish" | "jelly"

/** Шанс появления минибосса в обычном узле кампании (≈20%). */
export const MINIBOSS_NODE_CHANCE = 0.2
/** Шанс, что в узле появятся сразу ДВА существа (рыба + медуза). */
export const MINIBOSS_DUET_CHANCE = 0.25
/** Шанс дропа жизни за полностью уничтоженного минибосса. */
export const MINIBOSS_LIFE_CHANCE = 0.8
/** Прирост HP на предпоследнем ярусе относительно базового (60 → 150 у рыбы). */
export const MINIBOSS_HP_GROWTH = 1.5

const NAMES: Record<MinibossKind, string> = {
  fish: "РЫБА-ШАР",
  jelly: "МЕДУЗА",
}

export function minibossName(kind: MinibossKind): string {
  return NAMES[kind]
}

/** Шаг роста шанса за каждый бой подряд без минибосса (pity-система). */
export const MINIBOSS_PITY_STEP = 0.08

/**
 * Текущий шанс появления минибосса: базовый MINIBOSS_NODE_CHANCE плюс
 * MINIBOSS_PITY_STEP за каждый бой подряд без появления, но не больше 1.
 */
export function minibossChance(pity: number): number {
  return Math.min(1, MINIBOSS_NODE_CHANCE + Math.max(0, pity) * MINIBOSS_PITY_STEP)
}

/**
 * Полностью случайный ролл минибоссов для боевого узла (вызывается прямо в
 * момент старта боя). Пока существо не появляется, шанс растёт на
 * MINIBOSS_PITY_STEP за бой; когда появилось — возвращается к базовому.
 * Обычно одно существо, с шансом MINIBOSS_DUET_CHANCE — пара (рыба + медуза).
 * @param pity сколько боёв подряд прошло без минибосса
 * @param rand источник случайности (по умолчанию Math.random; для тестов
 *   можно передать детерминированный ГПСЧ)
 * @returns виды существ в узле и новое значение жалости
 */
export function rollMinibossLive(
  pity: number,
  rand: () => number = Math.random
): { kinds: MinibossKind[]; pity: number } {
  if (rand() >= minibossChance(pity)) return { kinds: [], pity: Math.max(0, pity) + 1 }
  const kind: MinibossKind = rand() < 0.5 ? "fish" : "jelly"
  if (rand() < MINIBOSS_DUET_CHANCE) {
    return { kinds: [kind, kind === "fish" ? "jelly" : "fish"], pity: 0 }
  }
  return { kinds: [kind], pity: 0 }
}

/** Общий запас HP существа: блоки минибосса не разрушаются поодиночке. */
export const MINIBOSS_HP: Record<MinibossKind, number> = {
  fish: 60,
  jelly: 50,
}

/**
 * HP минибосса на ярусе: линейный рост от базового значения на первом боевом
 * ярусе (tier 1) до (1 + MINIBOSS_HP_GROWTH) базового на последнем боевом
 * ярусе перед финальным боссом — чем дальше по карте, тем жирнее существа.
 */
export function minibossHpFor(kind: MinibossKind, tier: number, tiers: number): number {
  const progress = clamp((tier - 1) / Math.max(1, tiers - 3), 0, 1)
  return Math.round(MINIBOSS_HP[kind] * (1 + MINIBOSS_HP_GROWTH * progress))
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
  bobAmp?: number
  bobFreq?: number
  bobPh?: number
  group?: number
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
    y0: opts.y,
    swayAmp: opts.swayAmp,
    swayFreq: opts.swayFreq,
    swayPh: 0, // одна фаза на всё существо — плывёт как единое целое
    bobAmp: opts.bobAmp ?? 0,
    bobFreq: opts.bobFreq ?? 0,
    bobPh: opts.bobPh ?? 0,
    bomb: false,
    splits: false,
    isMiniboss: true,
    mbGroup: opts.group ?? 0,
    mbPart: opts.part,
  }
}

/**
 * Рыба: обтекаемое тело из перекрывающихся эллипсов, раздвоенный хвост,
 * спинной и грудной плавники, глаз. Плывёт носом вправо, патрулирует поле.
 * Тиры: тело — 2 (золото), плавники — 1 (зелень), глаз — 3 (акцент).
 */
export function buildFish(w: number, h: number, top: number, group = 0): Block[] {
  void h
  const cx = w / 2
  const cy = top + 165
  // патрулирует всё поле: амплитуда — почти до стен (с запасом на нос и хвост),
  // частота низкая — неспешное движение
  const S = { swayAmp: Math.max(26, cx - 110), swayFreq: 0.15 }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, group, ...S })
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
export function buildJelly(w: number, h: number, top: number, group = 0): Block[] {
  const cx = w / 2
  const cy = top + 160
  // Медленный патруль влево-вправо (без разворота) + вертикальный дрейф со
  // случайной фазой и некратной частотой — траектория выглядит случайной,
  // но ограничена: щупальца не опускаются ниже ~65% высоты поля.
  const bobAmp = Math.max(10, Math.min(28, h * 0.65 - cy - 90))
  const S = {
    swayAmp: Math.max(14, cx - 56),
    swayFreq: 0.18,
    bobAmp,
    bobFreq: 0.1 + rand(0, 0.05),
    bobPh: rand(0, Math.PI * 2),
  }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, group, ...S })
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
