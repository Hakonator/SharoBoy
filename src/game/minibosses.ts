/**
 * Мини-боссы кампании: стилизованные обитатели водной фауны (рыба, медуза),
 * собранные из круглых блоков в цельный силуэт. Появляются в обычных боевых
 * узлах кампании с фиксированным шансом — детерминированно по сиду карты,
 * одна и та же карта всегда даёт минибоссов в одних и тех же узлах.
 * За уничтожение минибосса полагается жизнь с шансом MINIBOSS_LIFE_CHANCE —
 * других источников жизней в кампании нет.
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

/** Фабрика круглого блока существа: цельный силуэт, лёгкое «плавание» через sway. */
function makeMinibossBlock(opts: {
  x: number
  y: number
  r: number
  hp: 1 | 2 | 3
  swayAmp: number
  swayFreq: number
  swayPh: number
}): Block {
  return {
    x: opts.x,
    y: opts.y,
    rx: opts.r,
    ry: opts.r,
    rot: 0,
    circle: true,
    hp: opts.hp,
    maxHp: opts.hp,
    tier: opts.hp,
    flash: 0,
    seed: rand(0, Math.PI * 2),
    dead: false,
    x0: opts.x,
    swayAmp: opts.swayAmp,
    swayFreq: opts.swayFreq,
    swayPh: opts.swayPh,
    bomb: false,
    splits: false,
    isMiniboss: true,
  }
}

/**
 * Собирает существо из ASCII-карты: «X» — тело (2 HP, золотой), «C» — ядро
 * (3 HP), строчные «x» — мягкие части: хвост/юбка/щупальца (1 HP, зелёный).
 * Соседние блоки слегка перекрываются, чтобы силуэт читался как одно
 * существо, а не россыпь шаров.
 */
function buildFromMap(
  map: string[],
  opts: {
    cx: number
    cy: number
    r: number
    spacing: number
    swayAmp: number
    swayFreq: number
  }
): Block[] {
  const blocks: Block[] = []
  const rows = map.length
  const cols = Math.max(...map.map((row) => row.length))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = map[r][c]
      if (!ch || ch === ".") continue
      const hp: 1 | 2 | 3 = ch === "C" ? 3 : ch === "x" ? 1 : 2
      blocks.push(
        makeMinibossBlock({
          x: opts.cx + (c - (cols - 1) / 2) * opts.spacing,
          y: opts.cy + (r - (rows - 1) / 2) * opts.spacing,
          r: opts.r,
          hp,
          swayAmp: opts.swayAmp,
          swayFreq: opts.swayFreq,
          swayPh: 0, // одна фаза на всё существо — плывёт как единое целое
        })
      )
    }
  }
  return blocks
}

/** Рыба-шар: тело с ядром и хвостом, неспешно патрулирует по горизонтали. */
export function buildFish(w: number, h: number, top: number): Block[] {
  void h
  const R = 14
  return buildFromMap(["...XXXX...", ".xXXXXXXX.", "xxXCCXXXXX", ".xXXXXXXX.", "...XXXX..."], {
    cx: w / 2,
    cy: top + 140,
    r: R,
    spacing: R * 2 - 6,
    swayAmp: 26,
    swayFreq: 0.45,
  })
}

/** Медуза: купол с мягкой юбкой и щупальцами, плавно покачивается. */
export function buildJelly(w: number, h: number, top: number): Block[] {
  void h
  const R = 14
  return buildFromMap(
    [
      "..XXXXX...",
      ".XXXXXXX..",
      "XXXXXXXXX.",
      ".xxxxxxx..",
      "..x.x.x...",
      "..x.x.x...",
      "..x.x.x...",
    ],
    {
      cx: w / 2,
      cy: top + 130,
      r: R,
      spacing: R * 2 - 6,
      swayAmp: 14,
      swayFreq: 0.6,
    }
  )
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
