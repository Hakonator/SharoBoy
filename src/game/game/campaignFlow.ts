import type { Game } from "../game"
import { bossPhasesFor, fixedVariant, pickBossVariant } from "../bossVariants"
import { getBossTransmission } from "../bossDialogs"
import { minibossHpFor, rollMinibossLive } from "../minibosses"
import { LEVELS } from "../levels"
import { generateMotifSpec } from "../levelMotifs"
import { generateCampaignMap, EVENT_TEXTS, EVENT_MAX_BACK_TIERS } from "../campaignMapLayout"
import { nodeById, outgoingIds, visibleFrom, isAdjacent } from "../campaignMap"
import { daySeed } from "../utils"
import type { LevelSpec } from "../levels"
import type { CampaignMapView, CampaignNode } from "../campaignMap"
import { openCampaignShop } from "../campaignShop"
import { buildCampaignEvent } from "../campaignEvents"
import { initActiveChallenge } from "../campaignChallenges"

import { applyTrack } from "./audioControls"
import { pushHud, setBanner } from "./hudSync"
import {
  buildBossLevel,
  buildFromSpec,
  buildLevel,
  buildOctopusBossLevel,
  buildJellyfishBossLevel,
  buildCrabBossLevel,
  buildCryoBossLevel,
  buildChronoBossLevel,
  buildLampreyBossLevel,
  serveBall,
} from "./levelBuild"
import { addMiniboss } from "./minibossRuntime"
import { applyUpgrades } from "./progress"
import { resetRun } from "./runFlow"

/** Прямой запуск боя уровня без карты — тесты движка и отладка раскладок. */
export function startLevelBattle(g: Game, n: number) {
  g.sfx.ensure()
  g.sfx.ui()
  g.mode = "campaign"
  g.wave = 0
  g.waveSpec = null
  resetRun(g)
  applyUpgrades(g)
  g.level = n
  buildLevel(g, n)
  g.levelLostBall = false
  g.onBossNode = "boss" in LEVELS[n - 1]
  g.activeSpec = g.onBossNode ? null : LEVELS[n - 1]
  if (g.onBossNode) {
    const kind = g.debugBossType ?? "king"
    g.activeBossKind = kind
    g.bossTransmission = getBossTransmission(kind)
    g.bossTransmissionTimer = 5.5
    g.sfx.transmission(kind)
  } else {
    g.activeBossKind = null
    g.bossTransmission = null
    g.bossTransmissionTimer = 0
  }
  launchNodeBattle(g, LEVELS[n - 1].name)
}

/* ---------- карта кампании (рогалик слева-направо) ---------- */

/** Генерирует карту забега и ставит игрока на стартовый узел (экран карты). */
export function startCampaignMap(g: Game) {
  g.campaignSeed = (daySeed() * 31 + g.runSeq++) | 0
  g.campaign = generateCampaignMap(g.campaignSeed)
  g.campaignMbSeen = {}
  g.minibossPity = 0
  g.campaignEvent = null
  g.campaignEventData = null
  g.campaignEventTarget = -1
  g.campaignSpentEvents = []
  g.campaignShop = null
  g.campaignShops = {}
  g.campaignPerks = {}
  g.campaignRelics = {}
  g.campaignSparkBounceCount = 0
  g.crystals = 20
  g.crystalsRunTotal = 20
  g.shield = (g.upgrades.shieldStart ?? 0) > 0 ? 1 : 0
  g.bossCleanHits = 0
  g.campaignPlayerId = g.campaign.startId
  g.campaignVisited = [g.campaign.startId]
  g.campaignVisible = visibleFrom(g.campaign, g.campaignPlayerId)
  g.onBossNode = false
  g.activeBossKind = null
  g.bossTransmission = null
  g.bossTransmissionTimer = 0
  g.finalBossDefeated = null
  g.activeSpec = null
  g.phase = "map"
  enterMapView(g)
  g.sfx.ui()
  applyTrack(g)
  pushHud(g)
}

/** Возврат на экран карты из боя или со старта забега: поле очищено. */
export function enterMapView(g: Game) {
  g.phase = "map"
  g.input.releaseLock()
  g.input.clearKeys()
  g.balls = []
  g.blocks = []
  g.powers = []
  g.projectiles = []
  g.bossSys.clear()
  g.boomQueue = []
  g.banner = null
  g.bannerTimer = 0
  g.transition = 0
  g.countdown = 0
  g.fx.clear()
  g.onBossNode = false
  g.activeBossKind = null
  g.bossTransmission = null
  g.bossTransmissionTimer = 0
  g.activeSpec = null
  g.activeChallenge = null
  applyTrack(g)
  pushHud(g)
}

/** Клик по узлу карты: переход разрешён только в узел, соседний с текущим. */
export function enterMapNode(g: Game, id: number) {
  if (g.phase !== "map" || !g.campaign) return
  if (!isAdjacent(g.campaign, g.campaignPlayerId, id)) return
  const node = nodeById(g.campaign, id)
  if (!node) return
  g.sfx.ensure()
  g.sfx.ui()
  g.campaignPlayerId = id
  if (!g.campaignVisited.includes(id)) g.campaignVisited.push(id)
  if (node.isEvent) {
    if (g.campaignSpentEvents.includes(id)) {
      // стихия уже сработала однажды: повторный вход — обычный бой в этой
      // зоне (иначе узел-«бутылочное горлышко» телепортировал бы вечно)
      g.campaignVisible = visibleFrom(g.campaign, id)
      startMapBattle(g, node)
      return
    }
    g.campaignSpentEvents.push(id)
    resolveCampaignEvent(g, node)
    return
  }
  if (node.isShop) {
    g.campaignShop = openCampaignShop(g, node.id, node.name, node.tier)
    g.campaignVisible = visibleFrom(g.campaign, id)
    g.phase = "map"
    g.sfx.power()
    pushHud(g)
    return
  }
  g.campaignVisible = visibleFrom(g.campaign, id)
  startMapBattle(g, node)
}

/**
 * Узел-событие: боя нет — подводная стихия (водоворот, течение, гейзер)
 * предлагает игроку выбор с риском и наградой.
 */
export function resolveCampaignEvent(g: Game, node: CampaignNode) {
  if (!g.campaign) return
  const options = g.campaignVisited.filter((v) => {
    if (v === node.id) return false
    const visited = nodeById(g.campaign!, v)
    // не-событийные и не-магазинные узлы не дальше EVENT_MAX_BACK_TIERS зон назад
    return (
      !!visited &&
      !visited.isEvent &&
      !visited.isShop &&
      visited.tier >= node.tier - EVENT_MAX_BACK_TIERS
    )
  })
  if (!options.length) {
    if (node.isTerminal) {
      g.campaignEventTarget = -1
      g.campaignEvent = "ТЕРМИНАЛ СВЯЗИ «СФЕРА-1080»"
      g.campaignEventData = buildCampaignEvent(g, node, -1)
      g.onBossNode = false
      g.activeSpec = null
      g.phase = "map"
      applyTrack(g)
      g.sfx.terminalLog()
      pushHud(g)
      return
    }
    // редкий случай: окно из 3 зон съедено цепочкой событий — стихия стихла,
    // игрок остаётся на месте и идёт дальше с этого узла
    g.campaignVisible = visibleFrom(g.campaign, node.id)
    g.phase = "map"
    applyTrack(g)
    pushHud(g)
    return
  }
  const to = options[Math.floor(Math.random() * options.length)]
  g.campaignEventTarget = to
  const target = to >= 0 ? nodeById(g.campaign, to) : undefined
  const template = EVENT_TEXTS[Math.floor(Math.random() * EVENT_TEXTS.length)]
  g.campaignEvent = template.replace("{place}", target ? target.name : "НЕИЗВЕСТНОЕ МЕСТО")
  g.campaignEventData = buildCampaignEvent(g, node, to)
  g.onBossNode = false
  g.activeSpec = null
  g.phase = "map"
  applyTrack(g)
  // Сюжетный терминал станции воспроизводит handshake связи, аномалия — гиперпрыжок.
  if (node.isTerminal || g.campaignEventData?.terminalLog) {
    g.sfx.terminalLog()
  } else if (to >= 0) {
    g.sfx.anomalyJump()
  } else {
    g.sfx.power()
  }
  pushHud(g)
}

/**
 * Закрытие экрана события («плыть дальше»): если событие переместило игрока
 * на узел назначения, там стартует бой; если игрок удержался на месте — остаётся
 * на карте для выбора следующего шага.
 */
export function dismissCampaignEvent(g: Game) {
  const target = g.campaignEventTarget
  g.campaignEvent = null
  g.campaignEventData = null
  g.campaignEventTarget = -1
  if (g.phase !== "map" || !g.campaign) {
    pushHud(g)
    return
  }
  if (target < 0) {
    // Игрок остался на текущем узле (результат выбора в событии)
    g.campaignVisible = visibleFrom(g.campaign, g.campaignPlayerId)
    pushHud(g)
    return
  }
  const node = nodeById(g.campaign, target)
  if (!node || node.isEvent || node.isShop) {
    pushHud(g)
    return
  }
  g.campaignPlayerId = target
  if (!g.campaignVisited.includes(target)) g.campaignVisited.push(target)
  g.campaignVisible = visibleFrom(g.campaign, target)
  startMapBattle(g, node)
}

/** Space/Enter на экране карты: входим в узел, если выбор однозначен. */
export function enterNextNodeOnAction(g: Game) {
  if (!g.campaign) return
  const next = outgoingIds(g.campaign, g.campaignPlayerId)
  if (next.length === 1) enterMapNode(g, next[0])
}

/**
 * Запуск боя на узле карты. Обычный узел — авторская раскладка кампании по
 * кругу, узел босса — финальная арена, узел-испытание — элитный бой с минибоссом
 * и повышенной наградой.
 */
export function startMapBattle(g: Game, node: CampaignNode) {
  if (!g.campaign) return
  g.level = node.tier + 1
  g.levelLostBall = false
  g.campaignEvent = null
  g.campaignEventData = null
  g.campaignShop = null
  if (node.isBoss) {
    g.activeSpec = null
    g.onBossNode = true
    // Вариативность: ярус босса масштабируется по Актам (0: Акт 1, 1: Акт 2, 2+: Финал)
    const actBossTier = node.tier < 15 ? 0 : node.tier < 25 ? 1 : 2
    // Углубление фаз: поздний узел Акта и/или мутаторы забега добавляют боссу
    // промежуточную фазу (см. bossVariants.bossPhasesFor).
    const deepNode =
      node.tier >= 27 || (node.tier >= 12 && node.tier < 15) || (node.tier >= 22 && node.tier < 25)
    const phases = deepNode
      ? bossPhasesFor(actBossTier, { modifiers: g.campaignModifiers, difficultyRank: 2 })
      : bossPhasesFor(actBossTier, { modifiers: g.campaignModifiers })
    const variant = node.bossKind
      ? fixedVariant(node.bossKind, actBossTier, { phases })
      : pickBossVariant(g.campaignSeed + node.id * 7919, actBossTier, phases)
    g.activeBossKind = variant.kind
    g.bossTransmission = getBossTransmission(variant.kind)
    g.bossTransmissionTimer = 5.5
    // Радиопомехи и статика — протокол связи станции «поймал» частоту босса.
    g.sfx.transmission(variant.kind)
    const isFinal = !g.campaign || node.id === g.campaign.bossId
    if (isFinal || actBossTier === 2) {
      g.finalBossDefeated = variant.kind
    }
    if (variant.kind === "jellyfish") {
      buildJellyfishBossLevel(g, variant)
    } else if (variant.kind === "cryo") {
      buildCryoBossLevel(g, variant)
    } else if (variant.kind === "crab") {
      buildCrabBossLevel(g, variant)
    } else if (variant.kind === "lamprey") {
      buildLampreyBossLevel(g, variant)
    } else if (variant.kind === "chrono") {
      buildChronoBossLevel(g, variant)
    } else if (variant.kind === "octopus" || variant.kind === "kraken") {
      buildOctopusBossLevel(g, variant)
    } else {
      g.bossSys.setPhases(variant)
      buildBossLevel(g, variant.hp, variant.minions, 4)
    }
    // Углублённые фазы: баннер предупреждает игрока, что бой идёт через
    // промежуточную фазу (виден и на финальном узле Акта).
    const phaseTag = variant.phases > 1 ? " // ФАЗА II" : ""
    const bannerTitle = isFinal
      ? `ФИНАЛЬНЫЙ БОСС: ${variant.name}${phaseTag}`
      : `БОСС: ${variant.name}${phaseTag}`
    launchNodeBattle(g, bannerTitle)
    return
  }
  g.onBossNode = false
  g.activeBossKind = null
  g.bossTransmission = null
  g.bossTransmissionTimer = 0
  g.activeSpec = nodeSpecFor(g, node)
  buildFromSpec(g, g.activeSpec)
  // Минибоссы: случайный ролл с pity-системой, в узлах-испытаниях минибосс гарантирован!
  let rolled = rollMinibossLive(g.minibossPity)
  if (node.isChallenge && rolled.kinds.length === 0) {
    rolled = { kinds: ["fish"], pity: 0 }
  }
  // На узле со спринт-зачисткой ограничиваем число минибоссов максимум 1,
  // чтобы испытание на время оставалось динамичным и сбалансированным
  if (node.isChallenge && node.challenge?.kind === "speed_clear" && rolled.kinds.length > 1) {
    rolled = { kinds: [rolled.kinds[0]], pity: rolled.pity }
  }
  g.minibossPity = rolled.pity
  if (rolled.kinds.length) g.campaignMbSeen[node.id] = rolled.kinds
  for (const kind of rolled.kinds) {
    const baseHp = minibossHpFor(node.tier, g.campaign.tiers)
    const hp = node.isChallenge ? Math.round(baseHp * 1.3) : baseHp
    addMiniboss(g, kind, hp)
  }
  if (node.isChallenge && node.challenge) {
    g.activeChallenge = initActiveChallenge(node.challenge, rolled.kinds.length)
  } else {
    g.activeChallenge = null
  }
  const label = node.isChallenge ? `🎯 ИСПЫТАНИЕ: ${node.challenge?.title ?? node.name}` : node.name
  launchNodeBattle(g, label)
}

/** Раскладка обычного узла: авторские уровни по кругу (босс исключён). */
export function nodeSpecFor(g: Game, node: CampaignNode): LevelSpec {
  const speed = Math.min(650, 380 + node.tier * 7)
  return generateMotifSpec(g.campaignSeed + node.id * 7919, node.tier + 1, speed)
}

/** Общий вход в бой: подача шара, трек, баннер и бонусы прокачки / магазина. */
export function launchNodeBattle(g: Game, label: string) {
  g.magnetUntil = g.time + 4 * (g.upgrades.magnet ?? 0)
  g.laserArmed = (g.upgrades.laser ?? 0) > 0

  // Пассивная реликвия: восстанавливает +1 щит перед боем (до 3)
  if (g.campaignRelics.relicShield && g.shield < 3) {
    g.shield++
  }

  // Временные бонусы забега из магазина/событий:
  if (g.campaignPerks.laserStart) {
    g.laserArmed = true
    g.campaignPerks.laserStart = false
  }
  if (g.campaignPerks.wideStart) {
    g.wideUntil = Math.max(g.wideUntil, g.time + 15)
    g.campaignPerks.wideStart = false
  }
  if (g.campaignPerks.magnetStart) {
    g.magnetUntil = Math.max(g.magnetUntil, g.time + 10)
    g.campaignPerks.magnetStart = false
  }
  if (g.campaignPerks.fireStart) {
    g.fireUntil = Math.max(g.fireUntil, g.time + 12)
    g.campaignPerks.fireStart = false
  }

  g.laserArmedUntil = g.laserArmed ? Number.POSITIVE_INFINITY : 0
  g.runSectorStartTime = g.time
  serveBall(g)
  g.phase = "playing"
  applyTrack(g)
  setBanner(g, label)
  pushHud(g)
}

/** Снимок карты для HUD (только пока активен экран карты). */
export function currentMapView(g: Game): CampaignMapView | null {
  if (!g.campaign || g.phase !== "map") return null
  const map = g.campaign
  return {
    seed: map.seed,
    tiers: map.tiers,
    nodes: map.nodes,
    edges: map.edges,
    startId: map.startId,
    bossId: map.bossId,
    playerId: g.campaignPlayerId,
    visited: [...g.campaignVisited],
    visible: [...g.campaignVisible],
    minibosses: { ...g.campaignMbSeen },
    ...(g.campaignEvent ? { eventTargetId: g.campaignEventTarget } : {}),
  }
}
