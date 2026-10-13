import type { Game } from "./game"
import { mulberry32 } from "./utils"
import { saveProgress } from "./game/progress"
import { pushHud } from "./game/hudSync"
import type { CampaignShopItem, CampaignShopState } from "./types"

export interface ShopCatalogEntry {
  id: string
  name: string
  desc: string
  basePrice: number
  category: "life" | "shield" | "perk"
  icon: "life" | "shield" | "laser" | "magnet" | "wide" | "fire" | "coin"
}

export const SHOP_CATALOG: ShopCatalogEntry[] = [
  {
    id: "life",
    name: "Ремонт обшивки",
    desc: "+1 жизнь (до максимума 5).",
    basePrice: 24,
    category: "life",
    icon: "life",
  },
  {
    id: "shield",
    name: "Энергощит",
    desc: "+1 щит: поглощает один промах или удар (до 5).",
    basePrice: 14,
    category: "shield",
    icon: "shield",
  },
  {
    id: "shield_pack",
    name: "Двойной энергощит",
    desc: "+2 щита для защиты от потерь мяча (до 5).",
    basePrice: 25,
    category: "shield",
    icon: "shield",
  },
  {
    id: "laser",
    name: "Лазерный залп",
    desc: "Лазер заряжен наготове на старте следующего боя.",
    basePrice: 18,
    category: "perk",
    icon: "laser",
  },
  {
    id: "wide",
    name: "Широкая платформа",
    desc: "Ракетка расширена на первые 15 сек следующего боя.",
    basePrice: 16,
    category: "perk",
    icon: "wide",
  },
  {
    id: "magnet",
    name: "Магнитный швартов",
    desc: "Магнитный захват шара на первые 10 сек следующего боя.",
    basePrice: 14,
    category: "perk",
    icon: "magnet",
  },
  {
    id: "fire",
    name: "Огненный заряд",
    desc: "Огненный шар на первые 12 сек следующего боя.",
    basePrice: 22,
    category: "perk",
    icon: "fire",
  },
  {
    id: "coin_boost",
    name: "Глубинный эхолот",
    desc: "Бонус +50% монет за победы во всех боях текущего забега.",
    basePrice: 20,
    category: "perk",
    icon: "coin",
  },
]

/**
 * Детерминированная генерация ассортимента товаров в магазине
 * на основе сида карты и яруса узла.
 */
export function generateShopInventory(seed: number, tier: number): CampaignShopItem[] {
  const rng = mulberry32(seed + tier * 9973 + 17)
  const items: CampaignShopItem[] = []

  // 1) Всегда один защитный предмет (жизнь или щит)
  const defensePool = SHOP_CATALOG.filter((i) => i.category === "life" || i.category === "shield")
  const defEntry = defensePool[Math.floor(rng() * defensePool.length)]
  items.push({
    id: defEntry.id,
    name: defEntry.name,
    desc: defEntry.desc,
    price: defEntry.basePrice,
    category: defEntry.category,
    icon: defEntry.icon,
    sold: false,
  })

  // 2) 2–3 перка/усилителя без повторов
  const perkPool = SHOP_CATALOG.filter((i) => i.category === "perk")
  const shuffled = [...perkPool].sort(() => rng() - 0.5)
  const count = 2 + (rng() < 0.5 ? 1 : 0)

  for (let i = 0; i < count && i < shuffled.length; i++) {
    const entry = shuffled[i]
    items.push({
      id: entry.id,
      name: entry.name,
      desc: entry.desc,
      price: entry.basePrice,
      category: entry.category,
      icon: entry.icon,
      sold: false,
    })
  }

  return items
}

/** Открытие магазина на карте */
export function openCampaignShop(
  g: Game,
  nodeId: number,
  name: string,
  tier: number
): CampaignShopState {
  if (!g.campaignShops[nodeId]) {
    g.campaignShops[nodeId] = generateShopInventory(g.campaignSeed, tier)
  }
  return {
    nodeId,
    name,
    items: g.campaignShops[nodeId],
  }
}

/** Проверка возможности покупки товара */
export function canBuyCampaignShopItem(
  g: Game,
  item: CampaignShopItem
): { canBuy: boolean; reason?: string } {
  if (item.sold) return { canBuy: false, reason: "Уже куплено" }
  if (g.coins < item.price) return { canBuy: false, reason: "Недостаточно монет" }
  if (item.category === "life" && g.lives >= 5) {
    return { canBuy: false, reason: "Максимум жизней (5)" }
  }
  if (item.category === "shield" && g.shield >= 5) {
    return { canBuy: false, reason: "Максимум щитов (5)" }
  }
  return { canBuy: true }
}

/** Покупка товара в магазине забега */
export function buyCampaignShopItem(g: Game, itemId: string): boolean {
  if (!g.campaignShop) return false
  const item = g.campaignShop.items.find((i) => i.id === itemId)
  if (!item) return false

  const check = canBuyCampaignShopItem(g, item)
  if (!check.canBuy) return false

  g.coins -= item.price
  item.sold = true

  // Применение эффекта
  switch (item.id) {
    case "life":
      g.lives = Math.min(5, g.lives + 1)
      break
    case "shield":
      g.shield = Math.min(5, g.shield + 1)
      break
    case "shield_pack":
      g.shield = Math.min(5, g.shield + 2)
      break
    case "laser":
      g.campaignPerks.laserStart = true
      break
    case "wide":
      g.campaignPerks.wideStart = true
      break
    case "magnet":
      g.campaignPerks.magnetStart = true
      break
    case "fire":
      g.campaignPerks.fireStart = true
      break
    case "coin_boost":
      g.campaignPerks.coinBoost = true
      break
  }

  saveProgress(g)
  g.sfx.ensure()
  g.sfx.power()
  pushHud(g)
  return true
}

/** Закрытие окна магазина */
export function closeCampaignShop(g: Game) {
  g.campaignShop = null
  pushHud(g)
}
