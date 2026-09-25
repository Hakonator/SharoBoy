/**
 * Вариативность финальных боссов кампании.
 *
 * Тип босса выбирается детерминированно по сиду забега и ярусу: одна и та же
 * карта всегда даёт одного и того же босса, разные забеги — разных боссов.
 * Никаких обращений к DOM/движку — модуль тестируется автономно.
 */
import { clamp, mulberry32 } from "./utils"

export type BossVariantKind = "king" | "octopus" | "kraken" | "jellyfish"

/** Параметры конкретного воплощения финального босса. */
export interface BossVariant {
  kind: BossVariantKind
  /** Отображаемое имя (для баннера боя). */
  name: string
  /** Базовое HP тела (уже масштабировано по ярусу). */
  hp: number
  /** Количество миньонов на орбите (только у «Царь-шара»). */
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
  octopus: { name: "ОСЬМИНОГ", minions: 0, tentacles: 6, bombEvery: 4.5, angryAt: 0.5 },
  kraken: { name: "КРАКЕН", minions: 0, tentacles: 8, bombEvery: 3.2, angryAt: 0.55 },
  jellyfish: { name: "ГРОЗОВАЯ МЕДУЗА", minions: 0, tentacles: 5, bombEvery: 0, angryAt: 0.5 },
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
    // Сила масштабируется ярусом: HP растёт, миньонов прибавляется. Медуза —
    // peer кракена по размеру и живучести.
    hp: 40 + (tier + 1) * 6 + (kind === "kraken" || kind === "jellyfish" ? 10 : 0),
    minions: kind === "king" ? clamp(d.minions + Math.floor(tier / 2), 3, 6) : 0,
    tentacles: d.tentacles,
    bombEvery: d.bombEvery,
    angryAt: d.angryAt,
  }
}

/**
 * Выбирает вариант финального босса для узла кампании.
 * @param seed сид забега (детерминированность в рамках карты)
 * @param tier ярус узла босса (0-based; влияет на силу и разблокировку видов)
 */
export function pickBossVariant(seed: number, tier: number): BossVariant {
  const rng = mulberry32(seed | 0 || 1)
  const roll = rng()
  // «Кракен» открывается со 2-го яруса боссов, медуза — с 3-го (самая коварная),
  // до этого — король или осьминог.
  const pool: BossVariantKind[] =
    tier >= 2
      ? ["king", "octopus", "kraken", "jellyfish"]
      : tier >= 1
        ? ["king", "octopus", "kraken"]
        : ["king", "octopus"]
  const kind = pool[Math.floor(roll * pool.length) % pool.length]
  return fixedVariant(kind, tier)
}
