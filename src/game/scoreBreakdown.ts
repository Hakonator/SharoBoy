import type { Game } from "./game"
import {
  computeRunMultipliers,
  CAMPAIGN_MODIFIERS_MAP,
  type CampaignModifierId,
} from "./campaignModifiers"
import { lsSet } from "./utils"

export const BONUS_PER_LIFE = 500
export const BONUS_PER_SHIELD = 250
export const BONUS_PER_MAX_COMBO = 100
export const BONUS_PER_CRIT = 300
export const BONUS_PER_CLUTCH = 400
export const BONUS_PER_FAST_CLEAR = 600
export const FAST_CLEAR_PAR_SECONDS = 45

export interface ScoreBreakdownItem {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly points: number
  readonly icon?: string
  readonly isMultiplier?: boolean
}

export interface RunScoreBreakdown {
  /** Исходные очки за разрушение блоков и прохождение секторов до финального бонуса. */
  readonly baseScore: number
  /** Категории начислений для отображения в UI. */
  readonly items: readonly ScoreBreakdownItem[]
  /** Разрушенные блоки. */
  readonly blocksDestroyed: number
  readonly blocksScore: number
  /** Поверженные боссы. */
  readonly bossesDefeated: number
  readonly bossesScore: number
  /** Оставшиеся жизни и бонус. */
  readonly livesRemaining: number
  readonly livesBonus: number
  /** Оставшиеся щиты и бонус. */
  readonly shieldsRemaining: number
  readonly shieldsBonus: number
  /** Максимальное комбо и бонус. */
  readonly maxCombo: number
  readonly comboBonus: number
  /** Критические попадания ×3 и бонус. */
  readonly critHits: number
  readonly critBonus: number
  /** Сэйвы на грани ракетки и бонус. */
  readonly clutchSaves: number
  readonly clutchBonus: number
  /** Пройденные секторы. */
  readonly sectorsCleared: number
  /** Скоростные зачистки и бонус. */
  readonly fastClears: number
  readonly speedBonus: number
  /** Процент бонуса мутаторов. */
  readonly mutatorBonusPercent: number
  readonly mutatorsMultiplier: number
  readonly activeMutators: readonly string[]
  /** Суммарный бонус за завершение забега. */
  readonly endBonusTotal: number
  /** Итоговый финальный счёт. */
  readonly finalScore: number
}

/**
 * Вычисляет прозрачный детальный расчёт очков забега (Score Breakdown).
 */
export function computeScoreBreakdown(g: Game): RunScoreBreakdown {
  const blocksDestroyed = g.runBlocksDestroyed ?? 0
  const blocksScore = g.runBlocksScore ?? 0
  const bossesDefeated = g.runBossKills ?? 0
  const bossesScore = g.runBossesScore ?? 0

  const livesRemaining = Math.max(0, g.lives ?? 0)
  const livesBonus = livesRemaining * BONUS_PER_LIFE

  const shieldsRemaining = Math.max(0, g.shield ?? 0)
  const shieldsBonus = shieldsRemaining * BONUS_PER_SHIELD

  const maxCombo = g.runMaxCombo ?? 0
  const comboBonus = maxCombo >= 3 ? maxCombo * BONUS_PER_MAX_COMBO : 0

  const critHits = g.runCritHits ?? 0
  const critBonus = critHits * BONUS_PER_CRIT

  const clutchSaves = g.runClutchSaves ?? 0
  const clutchBonus = clutchSaves * BONUS_PER_CLUTCH

  const sectorsCleared = g.runSectorsCleared ?? 0
  const fastClears = g.runFastClears ?? 0
  const speedBonus = fastClears * BONUS_PER_FAST_CLEAR

  const activeMutators = (g.campaignModifiers ?? []) as readonly CampaignModifierId[]
  const { scoreMultiplier } = computeRunMultipliers(activeMutators)
  const mutatorsMultiplier = scoreMultiplier
  const mutatorBonusPercent = Math.round((mutatorsMultiplier - 1) * 100)

  const rawEndBonus = livesBonus + shieldsBonus + comboBonus + critBonus + clutchBonus + speedBonus
  const endBonusTotal = Math.round(rawEndBonus * mutatorsMultiplier)
  const baseScore = g.score ?? 0
  const finalScore = baseScore + endBonusTotal

  const items: ScoreBreakdownItem[] = []

  if (blocksDestroyed > 0 || blocksScore > 0) {
    items.push({
      id: "blocks",
      label: "Разрушенные блоки",
      detail: `${blocksDestroyed} шт.`,
      points: blocksScore,
      icon: "🧱",
    })
  }

  if (bossesDefeated > 0 || bossesScore > 0) {
    items.push({
      id: "bosses",
      label: "Поверженные боссы",
      detail: `${bossesDefeated} босс(ов)`,
      points: bossesScore,
      icon: "👑",
    })
  }

  if (livesRemaining > 0) {
    items.push({
      id: "lives",
      label: "Сэкономленные жизни",
      detail: `${livesRemaining} × ${BONUS_PER_LIFE}`,
      points: Math.round(livesBonus * mutatorsMultiplier),
      icon: "💖",
    })
  }

  if (shieldsRemaining > 0) {
    items.push({
      id: "shields",
      label: "Защитные энергощиты",
      detail: `${shieldsRemaining} × ${BONUS_PER_SHIELD}`,
      points: Math.round(shieldsBonus * mutatorsMultiplier),
      icon: "🛡",
    })
  }

  if (maxCombo >= 3) {
    items.push({
      id: "combo",
      label: "Максимальная серия комбо",
      detail: `Серия ×${maxCombo}`,
      points: Math.round(comboBonus * mutatorsMultiplier),
      icon: "🔥",
    })
  }

  if (critHits > 0) {
    items.push({
      id: "crits",
      label: "Критические рикошеты ×3",
      detail: `${critHits} × ${BONUS_PER_CRIT}`,
      points: Math.round(critBonus * mutatorsMultiplier),
      icon: "🎯",
    })
  }

  if (clutchSaves > 0) {
    items.push({
      id: "clutch",
      label: "Сэйвы на грани ракетки",
      detail: `${clutchSaves} × ${BONUS_PER_CLUTCH}`,
      points: Math.round(clutchBonus * mutatorsMultiplier),
      icon: "⚡",
    })
  }

  if (fastClears > 0) {
    items.push({
      id: "speed",
      label: "Скоростная зачистка",
      detail: `${fastClears} секторов (< ${FAST_CLEAR_PAR_SECONDS} с)`,
      points: Math.round(speedBonus * mutatorsMultiplier),
      icon: "⏱",
    })
  }

  if (mutatorBonusPercent > 0) {
    const badges = activeMutators.map((id) => CAMPAIGN_MODIFIERS_MAP[id]?.icon ?? "🧬").join(" ")
    items.push({
      id: "mutators",
      label: "Множитель мутаторов",
      detail: `${badges} +${mutatorBonusPercent}% к очкам`,
      points: 0,
      icon: "🧬",
      isMultiplier: true,
    })
  }

  return {
    baseScore,
    items,
    blocksDestroyed,
    blocksScore,
    bossesDefeated,
    bossesScore,
    livesRemaining,
    livesBonus,
    shieldsRemaining,
    shieldsBonus,
    maxCombo,
    comboBonus,
    critHits,
    critBonus,
    clutchSaves,
    clutchBonus,
    sectorsCleared,
    fastClears,
    speedBonus,
    mutatorBonusPercent,
    mutatorsMultiplier,
    activeMutators,
    endBonusTotal,
    finalScore,
  }
}

/**
 * Применяет финальный подсчёт очков к состоянию игры (начисляет бонусы, обновляет рекорд).
 */
export function applyFinalScoreBreakdown(g: Game): RunScoreBreakdown {
  if (g.scoreBreakdown) return g.scoreBreakdown
  const breakdown = computeScoreBreakdown(g)
  if (breakdown.endBonusTotal > 0) {
    g.score += breakdown.endBonusTotal
    if (g.score > g.best) {
      g.best = g.score
      g.newRecord = true
      lsSet("sharoboy-best", String(g.best))
    }
  }
  g.scoreBreakdown = breakdown
  return breakdown
}

/**
 * Сбрасывает счётчики статистики забега перед новой партией.
 */
export function resetRunStats(g: Game) {
  g.runBlocksDestroyed = 0
  g.runBlocksScore = 0
  g.runBossKills = 0
  g.runBossesScore = 0
  g.runMaxCombo = 0
  g.runCritHits = 0
  g.runClutchSaves = 0
  g.runSectorsCleared = 0
  g.runFastClears = 0
  g.runSectorStartTime = 0
  g.scoreBreakdown = null
}
