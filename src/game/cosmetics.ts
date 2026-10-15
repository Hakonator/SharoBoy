import { lsGet, lsSet } from "./utils"

export type PaddleSkinId = "default" | "cyberpunk" | "gold" | "ice" | "retro"
export type BallTrailId = "default" | "fire" | "electric" | "rainbow" | "void"
export type TableThemeId = "ocean" | "nebula" | "retrowave" | "abyss"

export type CosmeticCategory = "paddle" | "ball" | "theme"

export interface PaddleSkinColors {
  top: string
  mid: string
  dark: string
  glow: string
  stroke?: string
}

export interface BallTrailColors {
  trail: string
  mid: string
  core: string
  glow: string
  sparks?: boolean
  stars?: boolean
}

export interface TableThemeColors {
  bgTop: string
  bgMid: string
  bgBot: string
  bubble: string
  stars?: boolean
}

export interface CosmeticDef {
  id: string
  name: string
  category: CosmeticCategory
  cost: number
  desc: string
  icon: string
}

export interface PaddleSkinDef extends CosmeticDef {
  id: PaddleSkinId
  category: "paddle"
  colors: PaddleSkinColors
}

export interface BallTrailDef extends CosmeticDef {
  id: BallTrailId
  category: "ball"
  colors: BallTrailColors
}

export interface TableThemeDef extends CosmeticDef {
  id: TableThemeId
  category: "theme"
  colors: TableThemeColors
}

export const PADDLE_SKINS: readonly PaddleSkinDef[] = [
  {
    id: "default",
    name: "Классика Неона",
    category: "paddle",
    cost: 0,
    desc: "Стандартная аркадная ракетка из лазурного сплава.",
    icon: "🏓",
    colors: {
      top: "#aef7ff",
      mid: "#35e0ff",
      dark: "#0e86a3",
      glow: "#35e0ff",
    },
  },
  {
    id: "cyberpunk",
    name: "Киберпанк",
    category: "paddle",
    cost: 50,
    desc: "Пурпурно-розовый неон ночного мегаполиса с бирюзовым контуром.",
    icon: "⚡",
    colors: {
      top: "#ffe4f7",
      mid: "#ff2a85",
      dark: "#7d0545",
      glow: "#ff2a85",
      stroke: "#00f0ff",
    },
  },
  {
    id: "gold",
    name: "Золотая Аркада",
    category: "paddle",
    cost: 75,
    desc: "Слиток чистого золота с тёплым янтарным сиянием чемпионов.",
    icon: "👑",
    colors: {
      top: "#fff4cc",
      mid: "#ffc94d",
      dark: "#996500",
      glow: "#ffc94d",
      stroke: "#ffe9a8",
    },
  },
  {
    id: "ice",
    name: "Ледяной Кристалл",
    category: "paddle",
    cost: 60,
    desc: "Гранёный арктический лёд с кристальным сапфировым блеском.",
    icon: "❄️",
    colors: {
      top: "#e0f7ff",
      mid: "#70d6ff",
      dark: "#0a58ca",
      glow: "#70d6ff",
      stroke: "#ffffff",
    },
  },
  {
    id: "retro",
    name: "Ретро 8-Бит",
    category: "paddle",
    cost: 40,
    desc: "Кислотно-зелёный монохром ретро-экранов аркадных залов.",
    icon: "👾",
    colors: {
      top: "#e6ffcc",
      mid: "#39ff14",
      dark: "#0d5c00",
      glow: "#39ff14",
      stroke: "#39ff14",
    },
  },
] as const

export const BALL_TRAILS: readonly BallTrailDef[] = [
  {
    id: "default",
    name: "Лазурный Шлейф",
    category: "ball",
    cost: 0,
    desc: "Классический чистый бирюзовый хвост и ядро.",
    icon: "🔵",
    colors: {
      trail: "rgba(120,240,255,",
      mid: "#c9f6ff",
      core: "#38bcd8",
      glow: "#7cf5ff",
    },
  },
  {
    id: "fire",
    name: "Огненный Метеор",
    category: "ball",
    cost: 60,
    desc: "Пылающий хвост раскалённого пламени и горячие угли.",
    icon: "🔥",
    colors: {
      trail: "rgba(255,110,40,",
      mid: "#ffe29a",
      core: "#ff3b14",
      glow: "#ff7700",
    },
  },
  {
    id: "electric",
    name: "Шаровая Молния",
    category: "ball",
    cost: 65,
    desc: "Золотисто-жёлтый вольтаж и искрящиеся микро-разряды.",
    icon: "⚡",
    colors: {
      trail: "rgba(255,230,60,",
      mid: "#fffde0",
      core: "#e5b700",
      glow: "#ffe53b",
      sparks: true,
    },
  },
  {
    id: "rainbow",
    name: "Радужный Спектр",
    category: "ball",
    cost: 80,
    desc: "Переливающийся всеми цветами радуги неоновый след.",
    icon: "🌈",
    colors: {
      trail: "rgba(255,80,180,",
      mid: "#ffffff",
      core: "#00f0ff",
      glow: "#ff00d4",
    },
  },
  {
    id: "void",
    name: "Звёздная Гравитация",
    category: "ball",
    cost: 70,
    desc: "Космическая фиолетовая материя с мерцающими звёздными искрами.",
    icon: "🌌",
    colors: {
      trail: "rgba(180,70,255,",
      mid: "#f3d9ff",
      core: "#8a1fff",
      glow: "#c44dff",
      stars: true,
    },
  },
] as const

export const TABLE_THEMES: readonly TableThemeDef[] = [
  {
    id: "ocean",
    name: "Глубокий Океан",
    category: "theme",
    cost: 0,
    desc: "Атмосферные синие глубины с пузырьками воздуха.",
    icon: "🌊",
    colors: {
      bgTop: "#0e3a4e",
      bgMid: "#082434",
      bgBot: "#04121c",
      bubble: "rgba(140,220,255,0.07)",
    },
  },
  {
    id: "nebula",
    name: "Космическая Туманность",
    category: "theme",
    cost: 50,
    desc: "Таинственный фиолетово-синий космос и звёздная пыль.",
    icon: "✨",
    colors: {
      bgTop: "#280c4a",
      bgMid: "#15062b",
      bgBot: "#070112",
      bubble: "rgba(215,140,255,0.09)",
      stars: true,
    },
  },
  {
    id: "retrowave",
    name: "Ретро-Вейв Закат",
    category: "theme",
    cost: 60,
    desc: "Тёплый неоновый закат в стиле 80-х и синтвейва.",
    icon: "🌇",
    colors: {
      bgTop: "#420935",
      bgMid: "#21041c",
      bgBot: "#0a010d",
      bubble: "rgba(255,100,180,0.09)",
    },
  },
  {
    id: "abyss",
    name: "Изумрудная Бездна",
    category: "theme",
    cost: 55,
    desc: "Древние зелёные подводные гроты и люминесцентный планктон.",
    icon: "🌿",
    colors: {
      bgTop: "#0a3d28",
      bgMid: "#052216",
      bgBot: "#020d09",
      bubble: "rgba(100,255,180,0.08)",
    },
  },
] as const

export interface EquippedCosmetics {
  paddle: PaddleSkinId
  ball: BallTrailId
  theme: TableThemeId
}

export interface PlayerCosmetics {
  unlocked: string[]
  equipped: EquippedCosmetics
}

export const COSMETICS_STORAGE_KEY = "sharoboy-cosmetics"

export const DEFAULT_EQUIPPED_COSMETICS: EquippedCosmetics = {
  paddle: "default",
  ball: "default",
  theme: "ocean",
}

export const DEFAULT_UNLOCKED_COSMETICS: string[] = [
  "paddle:default",
  "ball:default",
  "theme:ocean",
]

export function makeCosmeticKey(category: CosmeticCategory, id: string): string {
  return `${category}:${id}`
}

export function loadPlayerCosmetics(): PlayerCosmetics {
  try {
    const raw = lsGet(COSMETICS_STORAGE_KEY)
    if (!raw) {
      return {
        unlocked: [...DEFAULT_UNLOCKED_COSMETICS],
        equipped: { ...DEFAULT_EQUIPPED_COSMETICS },
      }
    }
    const parsed = JSON.parse(raw) as Partial<PlayerCosmetics>
    const unlocked = Array.isArray(parsed?.unlocked)
      ? Array.from(new Set([...DEFAULT_UNLOCKED_COSMETICS, ...parsed.unlocked]))
      : [...DEFAULT_UNLOCKED_COSMETICS]

    const equipped: EquippedCosmetics = {
      paddle:
        parsed?.equipped?.paddle && PADDLE_SKINS.some((p) => p.id === parsed.equipped?.paddle)
          ? parsed.equipped.paddle
          : "default",
      ball:
        parsed?.equipped?.ball && BALL_TRAILS.some((b) => b.id === parsed.equipped?.ball)
          ? parsed.equipped.ball
          : "default",
      theme:
        parsed?.equipped?.theme && TABLE_THEMES.some((t) => t.id === parsed.equipped?.theme)
          ? parsed.equipped.theme
          : "ocean",
    }

    return { unlocked, equipped }
  } catch {
    return {
      unlocked: [...DEFAULT_UNLOCKED_COSMETICS],
      equipped: { ...DEFAULT_EQUIPPED_COSMETICS },
    }
  }
}

export function savePlayerCosmetics(cosmetics: PlayerCosmetics): void {
  try {
    lsSet(COSMETICS_STORAGE_KEY, JSON.stringify(cosmetics))
  } catch {
    /* ignore storage errors */
  }
}

export function isCosmeticUnlocked(
  category: CosmeticCategory,
  id: string,
  cosmetics: PlayerCosmetics
): boolean {
  if (id === "default" || (category === "theme" && id === "ocean")) return true
  const key = makeCosmeticKey(category, id)
  return cosmetics.unlocked.includes(key)
}

export function equipCosmetic(
  category: CosmeticCategory,
  id: string,
  cosmetics: PlayerCosmetics
): PlayerCosmetics {
  if (!isCosmeticUnlocked(category, id, cosmetics)) {
    return cosmetics
  }
  const next: PlayerCosmetics = {
    unlocked: [...cosmetics.unlocked],
    equipped: {
      ...cosmetics.equipped,
      [category]: id,
    },
  }
  savePlayerCosmetics(next)
  return next
}

export function buyCosmetic(
  category: CosmeticCategory,
  id: string,
  currentCrystals: number,
  cosmetics: PlayerCosmetics
): { success: boolean; newCrystals: number; newCosmetics: PlayerCosmetics } {
  let cost = 0
  if (category === "paddle") {
    const def = PADDLE_SKINS.find((p) => p.id === id)
    if (!def) return { success: false, newCrystals: currentCrystals, newCosmetics: cosmetics }
    cost = def.cost
  } else if (category === "ball") {
    const def = BALL_TRAILS.find((b) => b.id === id)
    if (!def) return { success: false, newCrystals: currentCrystals, newCosmetics: cosmetics }
    cost = def.cost
  } else if (category === "theme") {
    const def = TABLE_THEMES.find((t) => t.id === id)
    if (!def) return { success: false, newCrystals: currentCrystals, newCosmetics: cosmetics }
    cost = def.cost
  }

  if (isCosmeticUnlocked(category, id, cosmetics)) {
    // Уже разблокировано — просто надеваем
    const equipped = equipCosmetic(category, id, cosmetics)
    return { success: true, newCrystals: currentCrystals, newCosmetics: equipped }
  }

  if (currentCrystals < cost) {
    return { success: false, newCrystals: currentCrystals, newCosmetics: cosmetics }
  }

  const key = makeCosmeticKey(category, id)
  const next: PlayerCosmetics = {
    unlocked: [...cosmetics.unlocked, key],
    equipped: {
      ...cosmetics.equipped,
      [category]: id,
    },
  }
  const newCrystals = currentCrystals - cost
  savePlayerCosmetics(next)
  return { success: true, newCrystals, newCosmetics: next }
}

export function getPaddleSkinDef(id: PaddleSkinId): PaddleSkinDef {
  return PADDLE_SKINS.find((p) => p.id === id) ?? PADDLE_SKINS[0]
}

export function getBallTrailDef(id: BallTrailId): BallTrailDef {
  return BALL_TRAILS.find((b) => b.id === id) ?? BALL_TRAILS[0]
}

export function getTableThemeDef(id: TableThemeId): TableThemeDef {
  return TABLE_THEMES.find((t) => t.id === id) ?? TABLE_THEMES[0]
}
