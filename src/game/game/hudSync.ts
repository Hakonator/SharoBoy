import type { Game } from "../game"
import { evaluateAch } from "../achievements"
import { LEVELS } from "../levels"
import { lsSet } from "../utils"
import { UPGRADE_DEFS } from "../upgrades"
import type { ScoreEntry } from "../types"

import { currentMapView } from "./campaignFlow"
import { levelDisplayName } from "./levelBuild"

export function saveTop(g: Game) {
  if (g.score <= 0) return
  const entry: ScoreEntry = { score: g.score, nick: g.nick }
  /* записи, сделанные до появления ника, считаем рекордами текущего игрока */
  const withNick = (list: ScoreEntry[]): ScoreEntry[] =>
    g.nick ? list.map((e) => (e.nick ? e : { ...e, nick: g.nick })) : list
  if (g.mode === "endless") {
    g.topEndless = withNick([...g.topEndless, entry])
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    lsSet("sharoboy-top-endless", JSON.stringify(g.topEndless))
  } else {
    g.top = withNick([...g.top, entry])
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    lsSet("sharoboy-top", JSON.stringify(g.top))
  }
}

export function syncEffectsHud(g: Game) {
  const t = g.time
  const key = [
    t < g.wideUntil ? 1 : 0,
    t < g.slowUntil ? 1 : 0,
    t < g.fastUntil ? 1 : 0,
    t < g.shrinkUntil ? 1 : 0,
    t < g.laserUntil ? 1 : 0,
    g.laserArmed ? 1 : 0,
    t < g.rocketUntil ? 1 : 0,
    t < g.fireUntil ? 1 : 0,
    t < g.frostUntil ? 1 : 0,
    t < g.sparkUntil ? 1 : 0,
    t < g.magnetUntil ? 1 : 0,
  ].join("")
  if (key !== g.effectsKey) {
    g.effectsKey = key
    pushHud(g)
  }
}

export function pushHud(g: Game) {
  const fresh = evaluateAch({
    score: g.score,
    combo: g.combo,
    wave: g.wave,
    won: g.phase === "won",
    bossKills: g.runBossKills,
    livesLost: g.runLivesLost,
    coins: g.coins,
    upgradeLevels: Object.values(g.upgrades).reduce((a, b) => a + b, 0),
    upgradesMaxed: UPGRADE_DEFS.every((d) => (g.upgrades[d.id] ?? 0) >= d.max),
  })
  if (fresh.length) {
    g.achQueue.push(...fresh.map((a) => a.id))
    g.sfx.achievement()
  }
  g.onHud({
    phase: g.phase,
    score: g.score,
    best: g.best,
    lives: g.lives,
    level: g.mode === "endless" ? g.wave : g.level,
    levelCount: g.mode === "endless" ? -1 : (g.campaign?.tiers ?? LEVELS.length),
    levelName: levelDisplayName(g),
    mode: g.mode,
    wave: g.wave,
    combo: g.combo,
    blocksLeft: g.blocks.length,
    muted: g.sfx.muted,
    musicMuted: g.sfx.musicMuted,
    musicVolume: g.sfx.musicVolume,
    sfxVolume: g.sfx.sfxVolume,
    banner: g.banner,
    stuck: g.balls.some((b) => b.stuck),
    newRecord: g.newRecord,
    shield: g.shield,
    wideOn: g.time < g.wideUntil,
    slowOn: g.time < g.slowUntil,
    fastOn: g.time < g.fastUntil,
    shrinkOn: g.time < g.shrinkUntil,
    laserOn: g.time < g.laserUntil || g.laserArmed,
    laserArmed: g.laserArmed,
    rocketOn: g.time < g.rocketUntil,
    fireOn: g.time < g.fireUntil,
    frostOn: g.time < g.frostUntil,
    sparkOn: g.time < g.sparkUntil,
    magnetOn: g.time < g.magnetUntil,
    coins: g.coins,
    upgrades: { ...g.upgrades },
    top: g.top,
    topEndless: g.topEndless,
    map: currentMapView(g),
    campaignEvent: g.campaignEvent,
    newAchievements: g.achQueue.splice(0),
  })
}

export function setBanner(g: Game, text: string) {
  g.banner = text
  g.bannerTimer = 2.2
  g.transition = 0.5
}

/* ---------- отрисовка ---------- */
