import type { Game } from "../game"
import { clamp, lsGet, lsSet } from "../utils"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../upgrades"
import {
  buyCosmetic,
  equipCosmetic,
  loadPlayerCosmetics,
  savePlayerCosmetics,
  type CosmeticCategory,
} from "../cosmetics"

import { pushHud } from "./hudSync"

export function loadProgress(g: Game) {
  try {
    g.coins = Math.max(0, Number(lsGet("sharoboy-coins") || 0) || 0)
    g.metaCrystals = Math.max(0, Number(lsGet("sharoboy-meta-crystals") || 0) || 0)
    const up = JSON.parse(lsGet("sharoboy-upgrades") || "{}") as unknown
    g.upgrades = up && typeof up === "object" ? (up as Record<string, number>) : {}
    g.cosmetics = loadPlayerCosmetics()
  } catch {
    g.coins = 0
    g.metaCrystals = 0
    g.upgrades = {}
    g.cosmetics = loadPlayerCosmetics()
  }
}
export function saveProgress(g: Game) {
  lsSet("sharoboy-coins", String(g.coins))
  lsSet("sharoboy-meta-crystals", String(g.metaCrystals ?? 0))
  lsSet("sharoboy-upgrades", JSON.stringify(g.upgrades))
  if (g.cosmetics) {
    savePlayerCosmetics(g.cosmetics)
  }
}
export function addCoins(g: Game, n: number) {
  const mult = 1 + (g.upgrades.coin ?? 0)
  g.coins += n * mult
  saveProgress(g)
  pushHud(g)
}
export function addMetaCrystals(g: Game, n: number) {
  g.metaCrystals = (g.metaCrystals ?? 0) + Math.max(0, n)
  saveProgress(g)
  pushHud(g)
}
/** Покупка постоянного улучшения — вызывается будущим UI прокачки. */
export function buyUpgrade(g: Game, id: string): boolean {
  if (!UPGRADES_ENABLED) return false
  const def = UPGRADE_DEFS.find((d) => d.id === id)
  if (!def) return false
  const lvl = g.upgrades[id] ?? 0
  if (lvl >= def.max) return false
  const price = def.cost(lvl)
  if (g.coins < price) return false
  g.coins -= price
  g.upgrades[id] = lvl + 1
  saveProgress(g)
  applyUpgrades(g)
  pushHud(g)
  return true
}
export function applyUpgrades(g: Game) {
  const paddleLvl = g.upgrades.paddle ?? 0
  g.paddleWidthMult = 1 + 0.12 * paddleLvl
  g.paddle.baseW = clamp(g.w * 0.18, 110, 200) * g.paddleWidthMult
}

export function buyCosmeticItem(g: Game, category: CosmeticCategory, id: string): boolean {
  const currentCrystals = g.metaCrystals ?? 0
  const result = buyCosmetic(category, id, currentCrystals, g.cosmetics)
  if (!result.success) return false
  g.metaCrystals = result.newCrystals
  g.cosmetics = result.newCosmetics
  saveProgress(g)
  pushHud(g)
  return true
}

export function equipCosmeticItem(g: Game, category: CosmeticCategory, id: string): boolean {
  g.cosmetics = equipCosmetic(category, id, g.cosmetics)
  saveProgress(g)
  pushHud(g)
  return true
}
