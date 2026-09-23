/**
 * Расстановка специальных блоков (§6) по уровню — детерминированно из seed.
 * Обычные блоки волн/авторских раскладок получают один из пяти типов
 * (пульсация, пружина, вата, дрейф, вращение), порталы распределяются парами
 * с общим id. Боссы, минибоссы и бомбы не трогаются.
 */
import type { Block } from "../types"
import { clamp } from "../utils"

/** Блоки, которым разрешены специальные типы. */
function eligible(b: Block): boolean {
  return !b.dead && !b.isMiniboss && !b.isTentacle && !b.minionOrbit && !b.bomb && !b.sp
}

/** Интенсивность спецблоков по номеру уровня: 0 до 3-го, далее растёт. */
export function specialIntensity(level: number): number {
  return clamp((level - 2) * 0.05, 0, 0.55)
}

function makePulse(b: Block, rng: () => number) {
  b.sp = {
    pulse: {
      freq: 1.2 + rng() * 1.0,
      ph: rng() * Math.PI * 2,
      rx0: b.rx,
      ry0: b.ry,
    },
  }
}

function makeDrift(b: Block, rng: () => number) {
  const kinds = ["h", "v", "circle"] as const
  const kind = kinds[Math.floor(rng() * kinds.length)]
  b.sp = {
    drift: {
      kind,
      amp: 12 + rng() * 14,
      freq: 0.5 + rng() * 0.6,
      ph: rng() * Math.PI * 2,
    },
  }
  if (kind !== "h") b.y0 ??= b.y
  // собственный маршрут вместо сеточного покачивания
  b.swayAmp = 0
}

function assignSpecial(b: Block, rng: () => number) {
  const roll = rng()
  if (roll < 0.22) makePulse(b, rng)
  else if (roll < 0.44) b.sp = { spring: true }
  else if (roll < 0.66) b.sp = { cotton: true }
  else if (roll < 0.85) makeDrift(b, rng)
  // крутящийся — только вытянутый блок; круглый заменяем пульсацией
  else if (b.circle || b.rx < b.ry) makePulse(b, rng)
  else b.sp = { rotVel: 0 }
}

/** Превращает два свободных блока в пару порталов с общим id. */
function makePortalPair(pool: Block[], id: number, rng: () => number): boolean {
  const free = pool.filter((b) => !b.sp)
  if (free.length < 2) return false
  const a = free[Math.floor(rng() * free.length)]
  const rest = free.filter((b) => b !== a)
  const c = rest[Math.floor(rng() * rest.length)]
  for (const p of [a, c]) {
    p.sp = { portalId: id }
    p.hp = 2
    p.maxHp = 2
  }
  return true
}

/**
 * Назначает специальные типы блокам уровня. Детерминировано относительно
 * (blocks, level, rng); вызывается после построения расстановки.
 */
export function decorateBlocks(blocks: Block[], level: number, rng: () => number) {
  if (level < 3) return
  const pool = blocks.filter(eligible)
  const intensity = specialIntensity(level)
  for (const b of pool) {
    if (rng() < intensity) assignSpecial(b, rng)
  }
  // парные телепорты — с 4-го уровня, вторая пара на высоких
  if (level >= 4 && rng() < clamp(0.15 + (level - 4) * 0.06, 0, 0.8)) {
    makePortalPair(pool, 1, rng)
    if (level >= 9 && rng() < 0.5) makePortalPair(pool, 2, rng)
  }
}
