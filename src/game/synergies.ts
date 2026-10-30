/**
 * Движок синергий перков, бонусов и реликвий станции «СФЕРА-1080» (T-040, §3.1 Roadmap).
 *
 * Синергии — это особые комбинации активных эффектов забега, которые взаимно усиливают
 * друг друга, открывая новые тактические возможности и создавая мощные эффекты.
 */

import type { CampaignRelicsState } from "./campaignRelics"

export type SynergyId =
  | "kinetic_sniper"
  | "chain_resonance"
  | "gravitational_juggernaut"
  | "thermal_shock"
  | "supernova"
  | "absolute_bulwark"

export interface SynergyMeta {
  readonly id: SynergyId
  readonly name: string
  readonly shortName: string
  readonly desc: string
  readonly ingredients: readonly string[]
  readonly icon: string
  readonly color: string
  readonly glowColor: string
}

export const SYNERGIES_META: Record<SynergyId, SynergyMeta> = {
  kinetic_sniper: {
    id: "kinetic_sniper",
    name: "Кинетический Снайпер",
    shortName: "СНАЙПЕР",
    desc: "Проникающий шар + Магнитная ракетка: сквозное пробивание до 6 блоков за проход, лазерный прицел и идеальная баллистика.",
    ingredients: ["Кинетический клинок", "Магнитный захват"],
    icon: "🎯",
    color: "#00f5d4",
    glowColor: "rgba(0, 245, 212, 0.4)",
  },
  chain_resonance: {
    id: "chain_resonance",
    name: "Цепной Резонанс",
    shortName: "РЕЗОНАНС",
    desc: "Взрывной шар + Хрупкие цепи / Искра: радиус взрыва расширен до 108 px, урон ×2, каскадная детонация до 14 целей.",
    ingredients: ["Плазменный заряд", "Хрупкие цепи / Искра"],
    icon: "⚡",
    color: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.4)",
  },
  gravitational_juggernaut: {
    id: "gravitational_juggernaut",
    name: "Гравитационный Джаггернаут",
    shortName: "ДЖАГГЕРНАУТ",
    desc: "Гравитационное ядро + Гравитация / Бастион: урон по боссам ×3, сокрушение брони блоков и сейсмическая ударная волна.",
    ingredients: ["Гравитационное ядро", "Гравитация / Бастион"],
    icon: "💥",
    color: "#c084fc",
    glowColor: "rgba(192, 132, 252, 0.4)",
  },
  thermal_shock: {
    id: "thermal_shock",
    name: "Термический Шок",
    shortName: "ТЕРМОШОК",
    desc: "Огонь + Мороз: паровой взрыв замороженных блоков, колоссальный урон по боссам ×4.",
    ingredients: ["Огненный шар", "Морозный шар"],
    icon: "🌡️",
    color: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.45)",
  },
  supernova: {
    id: "supernova",
    name: "Сверхновая",
    shortName: "СВЕРХНОВАЯ",
    desc: "Огонь + Взрыв: огненный взрыв сверхновой радиусом 96 px с огромным уроном 3 по всем целям.",
    ingredients: ["Огненный шар", "Плазменный заряд"],
    icon: "☀️",
    color: "#ef4444",
    glowColor: "rgba(239, 68, 68, 0.45)",
  },
  absolute_bulwark: {
    id: "absolute_bulwark",
    name: "Абсолютный Бастион",
    shortName: "БАСТИОН",
    desc: "Щит + Широкая платформа / Бастион: гарантированный крит-сэйв ×2 на каждый отскок и поглощение бомб.",
    ingredients: ["Энергощит", "Широкая платформа / Бастион"],
    icon: "🛡️",
    color: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.45)",
  },
}

/** Состояние игры, достаточное для детекции активных синергий. */
export interface SynergyDetectorState {
  time?: number
  combo?: number
  shield?: number
  pierceUntil?: number
  magnetUntil?: number
  magneticPaddleUntil?: number
  explosiveUntil?: number
  sparkUntil?: number
  bigUntil?: number
  fireUntil?: number
  frostUntil?: number
  wideUntil?: number
  campaignRelics?:
    | CampaignRelicsState
    | {
        relicSpark?: boolean
        relicBulwark?: boolean
        relicShield?: boolean
        relicFire?: boolean
        relicFrost?: boolean
      }
    | null
  campaignModifiers?: readonly string[] | null
  blocks?: Array<{ dead?: boolean; frozen?: boolean; sp?: { brittle?: unknown } }>
  // Функциональные геттеры из PhysicsWorld или Game (при наличии)
  pierceActive?: () => boolean
  magnetActive?: () => boolean
  magneticPaddleActive?: () => boolean
  explosiveActive?: () => boolean
  sparkActive?: () => boolean
  bigActive?: () => boolean
  heavyGravityActive?: () => boolean
  fireActive?: () => boolean
  frostActive?: () => boolean
  wideActive?: () => boolean
}

/**
 * 1. «Кинетический Снайпер»:
 * Проникающий шар («Кинетический клинок») + Магнитный захват ракетки.
 */
export function isKineticSniperActive(g: SynergyDetectorState): boolean {
  const pierce = g.pierceActive ? g.pierceActive() : (g.pierceUntil ?? 0) > (g.time ?? 0)
  const magnet =
    (g.magnetActive ? g.magnetActive() : (g.magnetUntil ?? 0) > (g.time ?? 0)) ||
    (g.magneticPaddleActive
      ? g.magneticPaddleActive()
      : (g.magneticPaddleUntil ?? 0) > (g.time ?? 0))
  return Boolean(pierce && magnet)
}

/**
 * 2. «Цепной Резонанс»:
 * Взрывной шар («Плазменный заряд») + (Цепная молния / Реликвия «Грозовой коралл» / Наличие хрупких цепных блоков на поле).
 */
export function isChainResonanceActive(g: SynergyDetectorState): boolean {
  const explosive = g.explosiveActive
    ? g.explosiveActive()
    : (g.explosiveUntil ?? 0) > (g.time ?? 0)
  if (!explosive) return false

  const spark = g.sparkActive ? g.sparkActive() : (g.sparkUntil ?? 0) > (g.time ?? 0)
  const hasSparkRelic = Boolean(g.campaignRelics?.relicSpark)
  const hasBrittleBlocks = Boolean(g.blocks?.some((b) => !b.dead && Boolean(b.sp?.brittle)))

  return Boolean(spark || hasSparkRelic || hasBrittleBlocks)
}

/**
 * 3. «Гравитационный Джаггернаут»:
 * Увеличенный шар («Гравитационное ядро») + (Мутатор «Гравитационный шторм» / Реликвия «Броневой бастион»).
 */
export function isGravitationalJuggernautActive(g: SynergyDetectorState): boolean {
  const big = g.bigActive ? g.bigActive() : (g.bigUntil ?? 0) > (g.time ?? 0)
  if (!big) return false

  const heavyGravity = g.heavyGravityActive
    ? g.heavyGravityActive()
    : Boolean(g.campaignModifiers?.includes("heavy_gravity"))
  const hasBulwarkRelic = Boolean(g.campaignRelics?.relicBulwark)

  return Boolean(heavyGravity || hasBulwarkRelic)
}

/**
 * 4. «Термический Шок»:
 * Огненный шар (бонус, перк или реликвия «Огненная амбра» при комбо >= 3) +
 * Морозный шар (бонус «Мороз» или реликвия «Крио-резонатор»).
 */
export function isThermalShockActive(g: SynergyDetectorState): boolean {
  const fire = g.fireActive
    ? g.fireActive()
    : (g.fireUntil ?? 0) > (g.time ?? 0) ||
      Boolean(g.campaignRelics?.relicFire && (g.combo ?? 0) >= 3)
  const frost = g.frostActive
    ? g.frostActive()
    : (g.frostUntil ?? 0) > (g.time ?? 0) || Boolean(g.campaignRelics?.relicFrost)
  return Boolean(fire && frost)
}

/**
 * 5. «Сверхновая»:
 * Огненный шар + Взрывной шар («Плазменный заряд»).
 */
export function isSupernovaActive(g: SynergyDetectorState): boolean {
  const fire = g.fireActive
    ? g.fireActive()
    : (g.fireUntil ?? 0) > (g.time ?? 0) ||
      Boolean(g.campaignRelics?.relicFire && (g.combo ?? 0) >= 3)
  const explosive = g.explosiveActive
    ? g.explosiveActive()
    : (g.explosiveUntil ?? 0) > (g.time ?? 0)
  return Boolean(fire && explosive)
}

/**
 * 6. «Абсолютный Бастион»:
 * Энергощит (запас щита > 0 или реликвия «Жемчужина глубин») +
 * (Широкая ракетка или реликвия «Броневой бастион»).
 */
export function isAbsoluteBulwarkActive(g: SynergyDetectorState): boolean {
  const hasShield = (g.shield ?? 0) > 0 || Boolean(g.campaignRelics?.relicShield)
  const hasWideOrBulwark =
    (g.wideActive ? g.wideActive() : (g.wideUntil ?? 0) > (g.time ?? 0)) ||
    Boolean(g.campaignRelics?.relicBulwark)
  return Boolean(hasShield && hasWideOrBulwark)
}

/** Возвращает список идентификаторов всех синергий, активных в текущий момент. */
export function getActiveSynergies(g: SynergyDetectorState): SynergyId[] {
  const active: SynergyId[] = []
  if (isKineticSniperActive(g)) active.push("kinetic_sniper")
  if (isChainResonanceActive(g)) active.push("chain_resonance")
  if (isGravitationalJuggernautActive(g)) active.push("gravitational_juggernaut")
  if (isThermalShockActive(g)) active.push("thermal_shock")
  if (isSupernovaActive(g)) active.push("supernova")
  if (isAbsoluteBulwarkActive(g)) active.push("absolute_bulwark")
  return active
}
