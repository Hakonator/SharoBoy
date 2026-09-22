import type { Game } from "../game"
import { clamp, lsGet, lsSet } from "../utils"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../upgrades"

import { pushHud } from "./hudSync"

export function loadProgress(g: Game) {
  try {
    g.coins = Math.max(0, Number(lsGet("sharoboy-coins") || 0) || 0)
    const up = JSON.parse(lsGet("sharoboy-upgrades") || "{}") as unknown
    g.upgrades = up && typeof up === "object" ? (up as Record<string, number>) : {}
  } catch {
    g.coins = 0
    g.upgrades = {}
  }
}
export function saveProgress(g: Game) {
  lsSet("sharoboy-coins", String(g.coins))
  lsSet("sharoboy-upgrades", JSON.stringify(g.upgrades))
}
export function addCoins(g: Game, n: number) {
  const mult = 1 + (g.upgrades.coin ?? 0)
  g.coins += n * mult
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
