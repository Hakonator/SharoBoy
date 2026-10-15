/**
 * Вариативность финальных боссов кампании.
 *
 * Тип босса выбирается детерминированно по сиду забега и ярусу: одна и та же
 * карта всегда даёт одного и того же босса, разные забеги — разных боссов.
 * Никаких обращений к DOM/движку — модуль тестируется автономно.
 */
import { clamp, mulberry32 } from "./utils"

export type BossVariantKind = "king" | "jellyfish" | "octopus" | "crab" | "kraken" | "chrono"

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
}

/** Базовые интервалы бомб/пороги агрессии по видам боссов. */
const KIND_DEFAULTS: Record<
  BossVariantKind,
  { name: string; minions: number; tentacles: number; bombEvery: number; angryAt: number }
> = {
  king: { name: "ЦАРЬ-ШАР", minions: 3, tentacles: 0, bombEvery: 0, angryAt: 0.4 },
  jellyfish: { name: "ГРОЗОВАЯ МЕДУЗА", minions: 0, tentacles: 5, bombEvery: 0, angryAt: 0.5 },
  octopus: { name: "ОСЬМИНОГ", minions: 0, tentacles: 6, bombEvery: 4.5, angryAt: 0.5 },
  crab: { name: "МЕХА-КРАБ", minions: 0, tentacles: 0, bombEvery: 4.0, angryAt: 0.5 },
  kraken: { name: "КРАКЕН", minions: 0, tentacles: 8, bombEvery: 3.2, angryAt: 0.55 },
  chrono: { name: "ПОВЕЛИТЕЛЬ ВРЕМЕНИ", minions: 4, tentacles: 0, bombEvery: 0, angryAt: 0.5 },
}

/**
 * Вариант с фиксированными параметрами вида (без рандома).
 * Используется и отбором по сиду, и отладочным спавном босса.
 * @param tier ярус (масштабирует HP и число миньонов)
 */
export function fixedVariant(kind: BossVariantKind, tier = 2): BossVariant {
  const d = KIND_DEFAULTS[kind]
  return {
    kind,
    name: d.name,
    // Сила масштабируется ярусом: HP растёт, миньонов прибавляется.
    hp:
      40 +
      (tier + 1) * 6 +
      (kind === "kraken" || kind === "jellyfish" || kind === "chrono" ? 10 : 0),
    minions:
      kind === "king" || kind === "chrono" ? clamp(d.minions + Math.floor(tier / 2), 3, 6) : 0,
    tentacles: d.tentacles,
    bombEvery: d.bombEvery,
    angryAt: d.angryAt,
  }
}

/**
 * Пулы боссов по Актам кампании:
 * - Акт 1 (ярус 10): Царь-шар (Механический Страж) или Грозовая Медуза
 * - Акт 2 (ярус 20): Глубинный Спрут (Осьминог) или Меха-Краб
 * - Акт 3 (ярус 30): Повелитель Измерений (Кракен) или Повелитель Времени (Хронос)
 */
export const ACT_BOSS_POOLS: Record<number, readonly BossVariantKind[]> = {
  0: ["king", "jellyfish"],
  1: ["octopus", "crab"],
  2: ["kraken", "chrono"],
}

/**
 * Выбирает вариант босса для узла кампании.
 * @param seed сид забега (детерминированность в рамках карты)
 * @param tier ярус босса / индекс Акта (0: Акт 1, 1: Акт 2, 2+: Финал)
 */
export function pickBossVariant(seed: number, tier: number): BossVariant {
  const rng = mulberry32(seed | 0 || 1)
  const roll = rng()
  const actIndex = tier <= 0 ? 0 : tier === 1 ? 1 : 2
  const pool = ACT_BOSS_POOLS[actIndex] ?? ACT_BOSS_POOLS[2]
  const kind = pool[Math.floor(roll * pool.length) % pool.length]
  return fixedVariant(kind, tier)
}
