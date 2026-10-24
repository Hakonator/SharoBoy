/**
 * Вариативность финальных боссов кампании.
 *
 * Тип босса выбирается детерминированно по сиду забега и ярусу: одна и та же
 * карта всегда даёт одного и того же босса, разные забеги — разных боссов.
 * Никаких обращений к DOM/движку — модуль тестируется автономно.
 */
import { clamp, mulberry32 } from "./utils"

export type BossVariantKind =
  "king" | "jellyfish" | "cryo" | "octopus" | "crab" | "lamprey" | "kraken" | "chrono"

/** Параметры конкретного воплощения финального босса. */
export interface BossVariant {
  kind: BossVariantKind
  /** Отображаемое имя (для баннера боя). */
  name: string
  /** Базовое HP тела (уже масштабировано по ярусу). */
  hp: number
  /** Количество миньонов на орбите (только у «Царь-шара» и «Повелителя Времени»). */
  minions: number
  /** Количество щупалец (0 — босс без щупалец). */
  tentacles: number
  /** Интервал бросания бомб, сек (0 — босс не бросает бомбы). */
  bombEvery: number
  /** Доля HP, при которой босс «злится» (0.4 = при 40% здоровья). */
  angryAt: number
  /**
   * Сколько состояний фазы проходить до «злой» (1 — обычный бой, 2 — углублённые
   * фазы: на высоком ярусе Акта и/или с мутаторами бой идёт через
   * промежуточную фазу — босс сильнее, но и награда выше).
   */
  phases: number
  /** Множитель награды за бой (кристаллы/монеты) — растёт вместе с фазами. */
  rewardMult: number
}

/** Базовые интервалы бомб/пороги агрессии по видам боссов. */
const KIND_DEFAULTS: Record<
  BossVariantKind,
  { name: string; minions: number; tentacles: number; bombEvery: number; angryAt: number }
> = {
  king: { name: "ЦАРЬ-ШАР", minions: 3, tentacles: 0, bombEvery: 0, angryAt: 0.4 },
  jellyfish: { name: "ГРОЗОВАЯ МЕДУЗА", minions: 0, tentacles: 5, bombEvery: 0, angryAt: 0.5 },
  cryo: { name: "КРИО-ДРОН УТИЛИЗАТОР", minions: 0, tentacles: 0, bombEvery: 0, angryAt: 0.5 },
  octopus: { name: "ОСЬМИНОГ", minions: 0, tentacles: 6, bombEvery: 4.5, angryAt: 0.5 },
  crab: { name: "МЕХА-КРАБ", minions: 0, tentacles: 0, bombEvery: 4.0, angryAt: 0.5 },
  lamprey: {
    name: "ГЛУБИННАЯ ЭЛЕКТРИЧЕСКАЯ МИНОГА",
    minions: 0,
    tentacles: 0,
    bombEvery: 0,
    angryAt: 0.5,
  },
  kraken: { name: "КРАКЕН", minions: 0, tentacles: 8, bombEvery: 3.2, angryAt: 0.55 },
  chrono: { name: "ПОВЕЛИТЕЛЬ ВРЕМЕНИ", minions: 4, tentacles: 0, bombEvery: 0, angryAt: 0.5 },
}

/** Порог HP, на котором начинается промежуточная (вторая) фаза боя. */
export const BOSS_MID_PHASE_AT = 0.72
/** Потолок множителя награды за углублённые фазы. */
export const BOSS_REWARD_MULT_MAX = 1.6

/**
 * Сколько фаз у босса на этом ярусе: 2 (углублённые фазы) — последние ярусы
 * Акта, высокий ранг сложности или активные мутаторы забега.
 * @param tier ярус Акта (0: Акт 1, 1: Акт 2, 2+: Финал)
 * @param opts.modifiers активные мутаторы забега
 * @param opts.difficultyRank ранг сложности (0 — базовый)
 */
export function bossPhasesFor(
  tier: number,
  opts?: { modifiers?: readonly string[]; difficultyRank?: number }
): number {
  const deepTier = tier >= 2
  const manyModifiers = (opts?.modifiers?.length ?? 0) >= 2
  const highRank = (opts?.difficultyRank ?? 0) >= 2
  return deepTier || manyModifiers || highRank ? 2 : 1
}

/**
 * Углублённые фазы боя: босс проходит промежуточную фазу раньше, чем «злую».
 * 1 — обычный бой (спокойная → злая), 2 — спокойная → промежуточная → злая.
 */
export interface BossPhases {
  /** Сколько состояний до «злой» фазы. */
  count: number
  /** Доля HP, где начинается промежуточная фаза (только при count > 1). */
  midAt: number
  /** Доля HP, где начинается «злая» фаза. */
  angryAt: number
  /** Ярость на промежуточной фазе: позиция между спокойной и злой. */
  midMix: number
}

/** Параметры фаз из варианта босса (для BossSystem). */
export function bossPhases(variant: BossVariant | null | undefined): BossPhases {
  if (!variant) {
    return { count: 1, midAt: BOSS_MID_PHASE_AT, angryAt: 0.4, midMix: 0 }
  }
  const count = Math.max(1, Math.round(variant.phases))
  return {
    count,
    midAt: BOSS_MID_PHASE_AT,
    angryAt: variant.angryAt,
    // на промежуточной фазе поведение наполовину «злое»
    midMix: count > 1 ? 0.5 : 0,
  }
}

/**
 * Вариант с фиксированными параметрами вида (без рандома).
 * Используется и отбором по сиду, и отладочным спавном босса.
 * @param tier ярус (масштабирует HP и число миньонов)
 * @param opts.phases число фаз (см. `bossPhasesFor`); по умолчанию 1
 */
export function fixedVariant(
  kind: BossVariantKind,
  tier = 2,
  opts?: { phases?: number }
): BossVariant {
  const d = KIND_DEFAULTS[kind]
  const phases = clamp(Math.round(opts?.phases ?? 1), 1, 3)
  // Промежуточная фаза: босс крепче (порог агрессии раньше), награда выше.
  const extraHp = phases > 1 ? Math.round(tier * 4 + 12) : 0
  return {
    kind,
    name: d.name,
    // Сила масштабируется ярусом: HP растёт, миньонов прибавляется.
    hp:
      40 +
      (tier + 1) * 6 +
      (kind === "kraken" || kind === "jellyfish" || kind === "chrono" ? 10 : 0) +
      extraHp,
    minions:
      kind === "king" || kind === "chrono" ? clamp(d.minions + Math.floor(tier / 2), 3, 6) : 0,
    tentacles: d.tentacles,
    bombEvery: d.bombEvery,
    angryAt: phases > 1 ? clamp(d.angryAt + 0.1, 0.4, 0.7) : d.angryAt,
    phases,
    rewardMult: Math.min(BOSS_REWARD_MULT_MAX, 1 + (phases - 1) * 0.3),
  }
}

/**
 * Пулы боссов по Актам кампании:
 * - Акт 1 (ярус 10): Царь-шар (Механический Страж), Грозовая Медуза или
 *   Крио-Дрон Утилизатор
 * - Акт 2 (ярус 20): Глубинный Спрут (Осьминог), Меха-Краб или
 *   Глубинная Электрическая Минога
 * - Акт 3 (ярус 30): Повелитель Измерений (Кракен) или Повелитель Времени (Хронос)
 */
export const ACT_BOSS_POOLS: Record<number, readonly BossVariantKind[]> = {
  0: ["king", "jellyfish", "cryo"],
  1: ["octopus", "crab", "lamprey"],
  2: ["kraken", "chrono"],
}

/**
 * Выбирает вариант босса для узла кампании.
 * @param seed сид забега (детерминированность в рамках карты)
 * @param tier ярус босса / индекс Акта (0: Акт 1, 1: Акт 2, 2+: Финал)
 */
export function pickBossVariant(seed: number, tier: number, phases?: number): BossVariant {
  const rng = mulberry32(seed | 0 || 1)
  const roll = rng()
  const actIndex = tier <= 0 ? 0 : tier === 1 ? 1 : 2
  const pool = ACT_BOSS_POOLS[actIndex] ?? ACT_BOSS_POOLS[2]
  const kind = pool[Math.floor(roll * pool.length) % pool.length]
  return fixedVariant(kind, tier, { phases })
}
