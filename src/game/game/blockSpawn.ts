/**
 * Расстановка специальных блоков (§6) по уровню — детерминированно из seed.
 * Обычные блоки волн/авторских раскладок получают один из пяти типов
 * (пульсация, пружина, вата, дрейф, вращение), порталы распределяются парами
 * с общим id. Боссы, минибоссы и бомбы не трогаются.
 */
import type { Block } from "../types"
import {
  BLOCK_MAGNET_FORCE,
  BLOCK_MAGNET_RADIUS_MULT,
  BRITTLE_RADIUS_MULT,
  DRIFT_MAX_RADIUS_MULT,
  PHASE_ACTIVE_FRACTION,
  PHASE_PERIOD,
} from "../blockKinds"
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
  const maxAmp = kind === "h" ? b.rx * DRIFT_MAX_RADIUS_MULT : b.ry * DRIFT_MAX_RADIUS_MULT
  b.sp = {
    drift: {
      kind,
      amp: Math.min(12 + rng() * 14, maxAmp),
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
  else b.sp = { rotVel: 0, rotDir: rng() < 0.5 ? -1 : 1 }
}

function assignPrioritySpecial(b: Block, rng: () => number) {
  const roll = rng()
  if (roll < 0.25) {
    const armor = 1 + (rng() < 0.2 ? 1 : 0)
    b.sp = { armor, armorMax: armor }
  } else if (roll < 0.5) {
    b.sp = { brittle: { radius: Math.max(b.rx, b.ry) * BRITTLE_RADIUS_MULT, damage: 1 } }
  } else if (roll < 0.75) {
    b.sp = {
      phase: {
        period: PHASE_PERIOD * (0.85 + rng() * 0.3),
        active: PHASE_ACTIVE_FRACTION,
        offset: rng() * PHASE_PERIOD,
      },
    }
  } else {
    b.sp = {
      magnet: {
        radius: Math.max(b.rx, b.ry) * BLOCK_MAGNET_RADIUS_MULT,
        force: BLOCK_MAGNET_FORCE,
      },
    }
  }
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
    if (rng() < intensity) {
      if (rng() < 0.3) assignPrioritySpecial(b, rng)
      else assignSpecial(b, rng)
    }
  }
  // парные телепорты — с 4-го уровня, вторая пара на высоких
  if (level >= 4 && rng() < clamp(0.15 + (level - 4) * 0.06, 0, 0.8)) {
    makePortalPair(pool, 1, rng)
    if (level >= 9 && rng() < 0.5) makePortalPair(pool, 2, rng)
  }
}
