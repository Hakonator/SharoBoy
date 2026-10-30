import type { Game } from "../game"
import type { MapPlaylistSpec, PlayerMapSpec } from "../mapSpec"
import { mapSpecToBlocks } from "../mapAdapter"
import type { CampaignModifierId } from "../campaignModifiers"
import { getDailyRunInfo, markTodayDailyPlayed } from "../daily"

import { applyTrack } from "./audioControls"
import { startCampaignMap } from "./campaignFlow"
import { pushHud, saveTop, setBanner } from "./hudSync"
import { buildWave, serveBall } from "./levelBuild"
import { applyUpgrades, addCoins } from "./progress"
import { resetRun } from "./runFlow"

/** Старт забега: генерирует карту кампании и открывает экран карты (фог войны). */
export function startGame(g: Game, modifiers?: CampaignModifierId[]) {
  g.sfx.ensure()
  g.sfx.ui()
  g.mode = "campaign"
  g.wave = 0
  g.waveSpec = null
  resetRun(g)
  g.campaignModifiers = modifiers ? [...modifiers] : []
  if (g.campaignModifiers.includes("ironman")) {
    g.lives = 1
  }
  startCampaignMap(g)
}

/** Старт ежедневного испытания (Daily Run): единый суточный сид, фиксированные мутаторы. */
export function startDaily(g: Game, date = new Date()) {
  g.sfx.ensure()
  g.sfx.ui()
  g.mode = "daily"
  g.wave = 0
  g.waveSpec = null
  resetRun(g)
  const daily = getDailyRunInfo(date)
  g.campaignModifiers = [...daily.modifiers]
  if (g.campaignModifiers.includes("ironman")) {
    g.lives = 1
  }
  g.campaignSeed = daily.campaignSeed
  markTodayDailyPlayed(date)
  startCampaignMap(g)
  setBanner(g, `ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ — ${daily.dateFormatted}`)
  pushHud(g)
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
  if (g.tacticalModules.magnetStart) {
    g.magnetUntil = g.time + 4 * (g.upgrades.magnet ?? 0)
  }
  g.laserArmed = (g.upgrades.laser ?? 0) > 0
  g.laserArmedUntil = g.laserArmed ? Number.POSITIVE_INFINITY : 0
  g.runSectorStartTime = g.time
  g.levelScoreStart = g.score
  g.levelBlocksStart = g.runBlocksDestroyed ?? 0
  serveBall(g)
  g.phase = "playing"
  applyTrack(g)
  setBanner(g, "БЕСКОНЕЧНЫЙ РЕЖИМ — ВОЛНА 1")
  pushHud(g)
}

/** Starts a single custom-map test run; completion is reported to its caller. */
export function startCustomMap(
  g: Game,
  spec: PlayerMapSpec,
  onComplete?: (result: "won" | "over") => void
) {
  g.sfx.ensure()
  g.sfx.ui()
  g.mode = "custom"
  g.customPlaylist = null
  g.customPlaylistIndex = 0
  g.wave = 0
  g.waveSpec = null
  resetRun(g)
  g.mode = "custom"
  g.customWinCondition = spec.winCondition
  g.onCustomComplete = onComplete ?? null
  g.blocks = mapSpecToBlocks(spec)
  g.customTargetBlocks =
    spec.winCondition.kind === "targets"
      ? spec.winCondition.targetIds.map(
          (id) => g.blocks[spec.blocks.findIndex((block) => block.id === id)]
        )
      : []
  g.blocksInitial = Math.max(1, g.blocks.length)
  applyUpgrades(g)
  g.level = 1
  g.customLevelName = spec.metadata.title
  g.levelLostBall = false
  g.runSectorStartTime = g.time
  serveBall(g)
  g.phase = "playing"
  applyTrack(g)
  setBanner(g, spec.metadata.title)
  pushHud(g)
}

function loadPlaylistMap(g: Game, spec: PlayerMapSpec, level: number, _levelCount?: number) {
  g.customWinCondition = spec.winCondition
  g.blocks = mapSpecToBlocks(spec)
  g.customTargetBlocks =
    spec.winCondition.kind === "targets"
      ? spec.winCondition.targetIds.map(
          (id) => g.blocks[spec.blocks.findIndex((block) => block.id === id)]
        )
      : []
  g.blocksInitial = Math.max(1, g.blocks.length)
  g.level = level
  g.customLevelName = spec.metadata.title
  g.levelLostBall = false
  g.runSectorStartTime = g.time
  serveBall(g)
  g.phase = "playing"
  applyTrack(g)
  setBanner(g, spec.metadata.title)
  pushHud(g)
}

export function startCustomPlaylist(
  g: Game,
  playlist: MapPlaylistSpec,
  onComplete?: (result: "won" | "over") => void
) {
  if (playlist.maps.length === 0) return
  g.sfx.ensure()
  g.sfx.ui()
  g.mode = "custom"
  g.customPlaylist = playlist
  g.customPlaylistIndex = 0
  g.onCustomComplete = onComplete ?? null
  resetRun(g)
  g.mode = "custom"
  applyUpgrades(g)
  loadPlaylistMap(g, playlist.maps[0]!, 1, playlist.maps.length)
}

export function advanceCustomPlaylist(g: Game): boolean {
  if (!g.customPlaylist) return false
  g.customPlaylistIndex += 1
  if (g.customPlaylistIndex >= g.customPlaylist.maps.length) {
    return false
  }
  const nextMap = g.customPlaylist.maps[g.customPlaylistIndex]!
  loadPlaylistMap(g, nextMap, g.customPlaylistIndex + 1, g.customPlaylist.maps.length)
  return true
}

export function toMenu(g: Game) {
  g.sfx.ui()
  g.input.releaseLock()
  if (g.mode !== "custom") saveTop(g)
  if ((g.mode === "campaign" || g.mode === "daily") && g.crystalsRunTotal > 0) {
    const mult = g.campaignRelics.relicConverter ? 1.5 : 1.0
    const earnedCoins = Math.round(g.crystalsRunTotal * mult)
    if (earnedCoins > 0) {
      addCoins(g, earnedCoins)
    }
  }
  g.crystals = 0
  g.crystalsRunTotal = 0
  g.campaignRelics = {}
  g.campaignSparkBounceCount = 0
  g.phase = "menu"
  g.mode = "campaign"
  g.customWinCondition = null
  g.customTargetBlocks = []
  g.customPlaylist = null
  g.customPlaylistIndex = 0
  g.onCustomComplete = null
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
  g.campaignModifiers = []
  g.activeChallenge = null
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
  g.sfx.setUnderwater(false)
  pushHud(g)
}

/** Завершить тест пользовательской карты и сообщить вызывающей стороне о выходе. */
export function stopCustomMap(g: Game) {
  if (g.mode !== "custom") return
  const callback = g.onCustomComplete
  toMenu(g)
  callback?.("over")
}

export function togglePause(g: Game) {
  if (g.intermediateScore) return
  if (g.phase === "playing") {
    g.phase = "paused"
    g.input.keys.space = false
    g.input.releaseLock()
    g.sfx.setUnderwater(true)
    g.sfx.ui()
  } else if (g.phase === "paused") {
    g.phase = "playing"
    g.countdown = 3
    g.sfx.setUnderwater(false)
    g.sfx.ui()
  }
  pushHud(g)
}
