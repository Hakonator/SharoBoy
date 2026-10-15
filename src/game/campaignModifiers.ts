/**
 * Модификаторы забегов кампании (мутаторы):
 * Опциональные правила, выбираемые игроком перед стартом кампании,
 * усложняющие геймплей в обмен на солидные множители очков и кристаллов.
 */

export type CampaignModifierId =
  "ironman" | "heavy_gravity" | "hyper_speed" | "dense_armor" | "glass_paddle" | "inverted_controls"

export interface CampaignModifierDef {
  readonly id: CampaignModifierId
  readonly title: string
  readonly desc: string
  readonly icon: string
  /** Доля прибавки к очкам (0.50 = +50% к финальным очкам). */
  readonly scoreBonus: number
  /** Доля прибавки к кристаллам забега (0.50 = +50% к кристаллам). */
  readonly crystalBonus: number
  readonly badgeColor: string
}

export const CAMPAIGN_MODIFIERS: readonly CampaignModifierDef[] = [
  {
    id: "ironman",
    title: "Железная воля",
    desc: "Ровно 1 жизнь на всю кампанию. Потеря мяча при 0 щитах — мгновенный конец забега.",
    icon: "💀",
    scoreBonus: 0.5,
    crystalBonus: 0.5,
    badgeColor: "#f43f5e",
  },
  {
    id: "heavy_gravity",
    title: "Гравитационный шторм",
    desc: "Усиленная гравитация тянет шар к бездне. Используй наклон ракетки и быстрые сэйвы!",
    icon: "⚓",
    scoreBonus: 0.3,
    crystalBonus: 0.3,
    badgeColor: "#38bdf8",
  },
  {
    id: "hyper_speed",
    title: "Гипер-разгон",
    desc: "Шар со старта на +25% быстрее и разгоняется от каждого удара о ракетку без ограничений.",
    icon: "⚡",
    scoreBonus: 0.35,
    crystalBonus: 0.35,
    badgeColor: "#facc15",
  },
  {
    id: "dense_armor",
    title: "Титановые ряды",
    desc: "Все блоки на арене получают +1 к максимальному запасу прочности / броне.",
    icon: "🧱",
    scoreBonus: 0.4,
    crystalBonus: 0.4,
    badgeColor: "#a855f7",
  },
  {
    id: "glass_paddle",
    title: "Хрупкая платформа",
    desc: "Ширина ракетки уменьшена на 20%. Высочайшая точность позиционирования.",
    icon: "🪟",
    scoreBonus: 0.25,
    crystalBonus: 0.25,
    badgeColor: "#34d399",
  },
  {
    id: "inverted_controls",
    title: "Инверсия руля",
    desc: "Управление ракеткой горизонтально инвертировано. Вызов для истинных виртуозов.",
    icon: "🔄",
    scoreBonus: 0.6,
    crystalBonus: 0.6,
    badgeColor: "#fb923c",
  },
]

export const CAMPAIGN_MODIFIERS_MAP: Record<CampaignModifierId, CampaignModifierDef> =
  CAMPAIGN_MODIFIERS.reduce(
    (acc, m) => {
      acc[m.id] = m
      return acc
    },
    {} as Record<CampaignModifierId, CampaignModifierDef>
  )

/**
 * Подсчитывает суммарные множители наград по списку активных модификаторов.
 * Бонусы суммируются аддитивно: 1.0 + sum(bonus).
 */
export function computeRunMultipliers(modifierIds?: readonly string[] | null): {
  scoreMultiplier: number
  crystalMultiplier: number
} {
  let scoreBonusTotal = 0
  let crystalBonusTotal = 0

  if (modifierIds) {
    for (const id of modifierIds) {
      const def = CAMPAIGN_MODIFIERS_MAP[id as CampaignModifierId]
      if (def) {
        scoreBonusTotal += def.scoreBonus
        crystalBonusTotal += def.crystalBonus
      }
    }
  }

  return {
    scoreMultiplier: Number((1 + scoreBonusTotal).toFixed(2)),
    crystalMultiplier: Number((1 + crystalBonusTotal).toFixed(2)),
  }
}

/** Проверяет, активен ли конкретный модификатор в текущем наборе. */
export function hasModifier(
  modifiers: readonly string[] | undefined,
  id: CampaignModifierId
): boolean {
  if (!modifiers || modifiers.length === 0) return false
  return modifiers.includes(id)
}

const MODIFIERS_STORAGE_KEY = "sharoboy-campaign-modifiers"

/** Загрузка сохранённого выбора модификаторов из localStorage. */
export function loadSelectedModifiers(): CampaignModifierId[] {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(MODIFIERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is CampaignModifierId => id in CAMPAIGN_MODIFIERS_MAP)
  } catch {
    return []
  }
}

/** Сохранение выбранных модификаторов в localStorage. */
export function saveSelectedModifiers(mods: readonly CampaignModifierId[]): void {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(MODIFIERS_STORAGE_KEY, JSON.stringify(mods))
  } catch {
    // приватный режим
  }
}
