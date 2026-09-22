import type { Game } from "../game"

import { applyTrack } from "./audioControls"
import { startCampaignMap } from "./campaignFlow"
import { pushHud, saveTop, setBanner } from "./hudSync"
import { buildWave, serveBall } from "./levelBuild"
import { applyUpgrades } from "./progress"
import { resetRun } from "./runFlow"

/** Старт забега: генерирует карту кампании и открывает экран карты (фог войны). */
export function startGame(g: Game) {
  g.sfx.ensure()
  g.sfx.ui()
  g.mode = "campaign"
  g.wave = 0
  g.waveSpec = null
  resetRun(g)
  startCampaignMap(g)
}

export function startEndless(g: Game) {
  g.sfx.ensure()
  g.sfx.ui()
  g.mode = "endless"
  g.wave = 1
  g.waveSpec = { name: "ВОЛНА 1", speed: 400 }
  resetRun(g)
  buildWave(g, 1)
  applyUpgrades(g)
  g.magnetUntil = g.time + 4 * (g.upgrades.magnet ?? 0)
  g.laserArmed = (g.upgrades.laser ?? 0) > 0
  serveBall(g)
  g.phase = "playing"
  applyTrack(g)
  setBanner(g, "БЕСКОНЕЧНЫЙ РЕЖИМ — ВОЛНА 1")
  pushHud(g)
}

export function toMenu(g: Game) {
  g.sfx.ui()
  g.input.releaseLock()
  saveTop(g)
  g.phase = "menu"
  g.campaign = null
  g.campaignMbSeen = {}
  g.minibossPity = 0
  g.campaignEvent = null
  g.campaignEventTarget = -1
  g.campaignSpentEvents = []
  g.campaignPlayerId = -1
  g.campaignVisited = []
  g.campaignVisible = []
  g.activeSpec = null
  g.onBossNode = false
  applyTrack(g)
  g.balls = []
  g.blocks = []
  g.powers = []
  g.projectiles = []
  g.bossSys.clear()
  g.boomQueue = []
  g.banner = null
  g.fx.clear()
  g.shake = 0
  g.flash = 0
  g.hitStop = 0
  pushHud(g)
}

export function togglePause(g: Game) {
  if (g.phase === "playing") {
    g.phase = "paused"
    g.input.keys.space = false
    g.input.releaseLock()
    g.sfx.ui()
  } else if (g.phase === "paused") {
    g.phase = "playing"
    g.countdown = 3
    g.sfx.ui()
  }
  pushHud(g)
}
