/**
 * Каталог и метаданные пассивных реликвий кампании станции «СФЕРА-1080».
 */

export type CampaignRelicId =
  | "relic_shield"
  | "relic_spark"
  | "relic_fire"
  | "relic_converter"
  | "relic_frost"
  | "relic_combo"
  | "relic_bulwark"
  | "relic_overdrive"

export interface CampaignRelicsState {
  relicShield?: boolean
  relicSpark?: boolean
  relicFire?: boolean
  relicConverter?: boolean
  relicFrost?: boolean
  relicCombo?: boolean
  relicBulwark?: boolean
  relicOverdrive?: boolean
}

export interface RelicMeta {
  id: CampaignRelicId
  name: string
  shortName: string
  desc: string
  icon: string
  color: string
}

export const CAMPAIGN_RELICS_META: Record<CampaignRelicId, RelicMeta> = {
  relic_shield: {
    id: "relic_shield",
    name: "Жемчужина глубин",
    shortName: "ЖЕМЧУЖИНА",
    desc: "Восстанавливает +1 щит в начале каждого яруса (до 3).",
    icon: "🛡️",
    color: "#38bdf8",
  },
  relic_spark: {
    id: "relic_spark",
    name: "Грозовой коралл",
    shortName: "КОРАЛЛ",
    desc: "Пускает цепь молний каждые 15 отскоков от ракетки.",
    icon: "⚡",
    color: "#fbbf24",
  },
  relic_fire: {
    id: "relic_fire",
    name: "Огненная амбра",
    shortName: "АМБРА",
    desc: "При комбо ×3 и выше шар зажигается огнём.",
    icon: "🔥",
    color: "#f97316",
  },
  relic_converter: {
    id: "relic_converter",
    name: "Золотой компас",
    shortName: "КОМПАС",
    desc: "+50% монет при конверсии кристаллов в конце забега.",
    icon: "🧭",
    color: "#facc15",
  },
  relic_frost: {
    id: "relic_frost",
    name: "Крио-резонатор",
    shortName: "РЕЗОНАТОР",
    desc: "При потере или срабатывании щита активирует мороз на 6 сек.",
    icon: "❄️",
    color: "#7dd3fc",
  },
  relic_combo: {
    id: "relic_combo",
    name: "Нейро-стабилизатор",
    shortName: "СТАБИЛИЗАТОР",
    desc: "Сохраняет минимум 50% комбо при касании ракетки и потере мяча.",
    icon: "🎯",
    color: "#c084fc",
  },
  relic_bulwark: {
    id: "relic_bulwark",
    name: "Броневой бастион",
    shortName: "БАСТИОН",
    desc: "Первая бомба за бой поглощается без потери жизни.",
    icon: "🏰",
    color: "#34d399",
  },
  relic_overdrive: {
    id: "relic_overdrive",
    name: "Аварийный овердрайв",
    shortName: "ОВЕРДРАЙВ",
    desc: "1 раз за забег спасает от поражения (восстанавливает 1 жизнь и 1 щит).",
    icon: "🔋",
    color: "#ec4899",
  },
}

export const RELIC_ID_TO_KEY: Record<CampaignRelicId, keyof CampaignRelicsState> = {
  relic_shield: "relicShield",
  relic_spark: "relicSpark",
  relic_fire: "relicFire",
  relic_converter: "relicConverter",
  relic_frost: "relicFrost",
  relic_combo: "relicCombo",
  relic_bulwark: "relicBulwark",
  relic_overdrive: "relicOverdrive",
}

export const RELIC_KEY_TO_ID: Record<keyof CampaignRelicsState, CampaignRelicId> = {
  relicShield: "relic_shield",
  relicSpark: "relic_spark",
  relicFire: "relic_fire",
  relicConverter: "relic_converter",
  relicFrost: "relic_frost",
  relicCombo: "relic_combo",
  relicBulwark: "relic_bulwark",
  relicOverdrive: "relic_overdrive",
}

/** Получить список ID активных реликвий из объекта состояния. */
export function getActiveRelicIds(relics?: CampaignRelicsState | null): CampaignRelicId[] {
  if (!relics) return []
  const list: CampaignRelicId[] = []
  for (const [id, key] of Object.entries(RELIC_ID_TO_KEY) as [
    CampaignRelicId,
    keyof CampaignRelicsState,
  ][]) {
    if (relics[key]) {
      list.push(id)
    }
  }
  return list
}
