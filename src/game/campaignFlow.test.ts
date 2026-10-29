import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EVENT_MAX_BACK_TIERS, type CampaignMap, type CampaignNode } from "./campaignMap"
import { makeEnv } from "./campaignFlow.helpers"
import { nodeSpecFor } from "./game/campaignFlow"
import { launch, loseLife } from "./game/runFlow"
import { LEVEL_MOTIF_NAMES } from "./levelMotifs"
import type { Game } from "./game"

/**
 * Сквозной прогон рогаликового цикла кампании на НАСТОЯЩЕМ движке:
 * startGame → экран карты → вход в соседний узел → бой → зачистка → возврат
 * на карту → узел босса → победа. Проверяем именно стык game-фазы и карты
 * (fog of war, adjacency, выбор раскладки), а не отрисовку — для неё есть
 * frame.invariant.test.ts.
 */

describe("сквозной цикл кампании по карте", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("генерирует разные устойчивые мотивы для узлов одного забега", () => {
    const { g } = makeEnv()
    const raw = g as unknown as { campaignSeed: number }
    raw.campaignSeed = 481516
    const a = { id: 11, tier: 4, x: 0, y: 0, isBoss: false, isEvent: false, name: "A" }
    const b = { ...a, id: 22 }
    const game = g as unknown as Game
    const first = nodeSpecFor(game, a)
    expect(nodeSpecFor(game, a)).toEqual(first)
    const seen = new Set([first.name, nodeSpecFor(game, b).name])
    for (let id = 23; seen.size < LEVEL_MOTIF_NAMES.length && id < 80; id++) {
      seen.add(nodeSpecFor(game, { ...a, id }).name)
    }
    expect(seen.size).toBeGreaterThanOrEqual(5)
    g.destroy()
  })

  it("startGame открывает карту с туманом войны и валидным снимком для HUD", () => {
    const { g, step, hudLog } = makeEnv()
    g.startGame()
    step(2)

    expect(g.phase).toBe("map")
    const snap = hudLog[hudLog.length - 1]
    expect(snap.phase).toBe("map")
    const view = snap.map
    expect(view, "пока активен экран карты HUD обязан нести снимок карты").toBeTruthy()
    expect(view!.playerId).toBe(view!.startId)
    expect(view!.visited).toEqual([view!.startId])
    // туман войны: видны ровно соседи текущего узла (развилка 2–4)
    expect(view!.visible.length).toBeGreaterThanOrEqual(2)
    expect(view!.visible.length).toBeLessThanOrEqual(4)
    // ни один узел вне пути и его соседей не раскрыт
    const revealed = new Set([...view!.visited, ...view!.visible])
    expect(revealed.size).toBeLessThan(view!.nodes.length)

    g.destroy()
  })

  it("клик по соседнему узлу запускает бой, зачистка возвращает на карту, босс даёт победу", () => {
    const { g, step, hudLog } = makeEnv()
    g.startGame()
    step(2)
    expect(g.phase).toBe("map")

    const raw = g as unknown as {
      campaign: {
        nodes: CampaignNode[]
        edges: { from: number; to: number }[]
        bossId: number
        startId: number
      }
      campaignPlayerId: number
      campaignVisited: number[]
      campaignVisible: number[]
      bossSys: { clear: () => void }
      transition: number
      bannerTimer: number
      countdown: number
      minibosses: unknown[]
      powers: unknown[]
    }
    const map = raw.campaign
    expect(map).toBeTruthy()

    let guard = 0
    let bossFought = false
    while (!bossFought) {
      if (guard++ > 150) throw new Error("не дошли до босса за разумное число шагов")

      const from = raw.campaignPlayerId
      const outs = map.edges.filter((e) => e.from === from).map((e) => e.to)
      expect(outs.length, "у не-боссового узла обязан быть путь вперёд").toBeGreaterThan(0)
      // боевые узлы предпочтительнее: узлы-события не продвигают по ярусам,
      // а магазины открывают лавку
      const battleOuts = outs.filter((id) => {
        const n = map.nodes.find((node) => node.id === id)!
        return !n.isEvent && !n.isShop
      })
      const targetId = battleOuts.length ? battleOuts[0] : outs[0]
      const target = map.nodes.find((n) => n.id === targetId)!
      expect(target).toBeTruthy()

      // несоседний узел игнорируется (позиция игрока не меняется)
      const far = map.nodes.find((n) => n.id !== from && !outs.includes(n.id))
      if (far) {
        g.enterMapNode(far.id)
        expect(raw.campaignPlayerId, "несоседний узел не должен открываться").toBe(from)
        expect(g.phase).toBe("map")
      }

      g.enterMapNode(targetId)
      expect(g.phase === "map" || g.phase === "playing").toBe(true)

      if (target.isShop) {
        expect(g.phase).toBe("map")
        g.closeCampaignShop()
        continue
      }

      // узел, на котором реально идёт бой (событие может телепортировать назад)
      let battleNode = target
      if (target.isEvent) {
        if (hudLog[hudLog.length - 1].campaignEvent) {
          // первое срабатывание: экран с сообщением, фишка ещё на месте
          const eventView = hudLog[hudLog.length - 1].map
          expect(eventView?.eventTargetId).toBeTruthy()
          expect(eventView?.nodes.some((n) => n.id === eventView.eventTargetId)).toBe(true)
          g.dismissCampaignEvent()
          // после подтверждения фишка перемещена на узел назначения и бой
          // уже стартовал; узлом назначения не может быть узел-событие —
          // цепочка телепортов на одном ходу исключена; и отбросить событие
          // может не дальше чем на EVENT_MAX_BACK_TIERS зон назад
          expect(g.phase).toBe("playing")
          expect(hudLog[hudLog.length - 1].map).toBeNull()
          battleNode = map.nodes.find((n) => n.id === raw.campaignPlayerId)!
          expect(battleNode.isEvent).toBe(false)
          expect(battleNode.tier).toBeGreaterThanOrEqual(target.tier - EVENT_MAX_BACK_TIERS)
        } else {
          // повторный вход в уже сработавшее событие — обычный бой на месте
          expect(g.phase).toBe("playing")
        }
      }

      if (g.campaignEventData) {
        g.dismissCampaignEvent()
      }

      expect(raw.campaignPlayerId).toBe(battleNode.id)
      expect(g.phase).toBe("playing")
      expect(g.onBossNode).toBe(battleNode.isBoss)
      // во время боя снимок карты в HUD отсутствует
      expect(hudLog[hudLog.length - 1].map).toBeNull()

      step(3) // кадры на подачу/баннер
      // мгновенная зачистка поля: блоки, босс и блокирующие таймеры убраны
      g.blocks.length = 0
      raw.bossSys.clear()
      raw.transition = 0
      raw.bannerTimer = 0
      raw.countdown = 0
      // минибоссы тоже мгновенно «мертвы» и жизнь за них не разыгрываем
      raw.minibosses.length = 0
      raw.powers.length = 0
      step(3)

      if (battleNode.id === map.bossId) {
        bossFought = true
        expect(g.phase, "после финального босса забег завершён").toBe("won")
      } else {
        if (g.intermediateScore) {
          g.continueFromIntermediateScore()
        }
        expect(g.phase, "обычный узел возвращает на карту").toBe("map")
        expect(raw.campaignPlayerId).toBe(battleNode.id)
        expect(raw.campaignVisited).toContain(battleNode.id)
        expect(raw.campaignVisible).toEqual(
          map.edges.filter((e) => e.from === battleNode.id).map((e) => e.to)
        )
        expect(hudLog[hudLog.length - 1].map?.playerId).toBe(battleNode.id)
      }
    }

    expect(bossFought).toBe(true)
    g.destroy()
  })

  it("событие-телепорт не отбрасывает дальше 3 зон назад", () => {
    const { g, step } = makeEnv()
    g.startGame()
    step(2)
    const raw = g as unknown as {
      campaign: CampaignMap
      campaignPlayerId: number
      campaignVisited: number[]
      bossSys: { clear: () => void }
      transition: number
      bannerTimer: number
      countdown: number
      minibosses: unknown[]
      powers: []
    }
    const map = raw.campaign
    expect(map).toBeTruthy()

    /** Трек музыки: на карте — своя медленная тема, в бою — боевая. */
    const musicTrack = () => (g as unknown as { sfx: { track: string } }).sfx.track
    expect(musicTrack(), "на экране карты играет трек карты").toBe("map")

    /** Мгновенная зачистка боя (как в сквозном прогоне выше). */
    const clearBattle = () => {
      step(3)
      g.blocks.length = 0
      raw.bossSys.clear()
      raw.transition = 0
      raw.bannerTimer = 0
      raw.countdown = 0
      raw.minibosses.length = 0
      raw.powers.length = 0
      step(3)
      if (g.intermediateScore) {
        g.continueFromIntermediateScore()
      }
    }

    let guard = 0
    let events = 0
    let reachedBoss = false
    while (!reachedBoss && guard++ < 300) {
      const from = raw.campaignPlayerId
      const outs = map.edges.filter((e) => e.from === from).map((e) => e.to)
      expect(outs.length).toBeGreaterThan(0)
      // приоритет событиям: гарантируем, что телепорты реально прогоняются.
      // Уже посещённые события пропускаем — иначе пинг-понг «событие↔узел»:
      // телепорт возвращается в узел, из которого снова вход в то же событие.
      const evOuts = outs.filter(
        (id) => map.nodes.find((n) => n.id === id)!.isEvent && !raw.campaignVisited.includes(id)
      )
      const battleOuts = outs.filter((id) => {
        const n = map.nodes.find((node) => node.id === id)!
        return !n.isEvent && !n.isShop
      })
      const targetId = evOuts.length ? evOuts[0] : battleOuts.length ? battleOuts[0] : outs[0]
      const target = map.nodes.find((n) => n.id === targetId)!
      g.enterMapNode(targetId)

      if (target.isShop) {
        expect(g.phase).toBe("map")
        g.closeCampaignShop()
        continue
      }

      // первое срабатывание события или терминала: оверлей → подтверждение → старт боя
      const firstTrigger = target.isEvent && g.phase === "map"
      if (firstTrigger || g.campaignEventData) g.dismissCampaignEvent()

      // любой узел заканчивается боем: телепорт на цель или бой на месте
      // (повторный вход в уже сработавшее событие — обычный бой)
      expect(g.phase).toBe("playing")
      expect(musicTrack(), "в бою играет боевой трек").toBe("game")
      const battleNode = map.nodes.find((n) => n.id === raw.campaignPlayerId)!
      if (firstTrigger) {
        // телепорт: цель — не-событие не дальше 3 зон назад
        expect(battleNode.isEvent).toBe(false)
        expect(battleNode.tier).toBeGreaterThanOrEqual(target.tier - EVENT_MAX_BACK_TIERS)
        events++
      }
      clearBattle()
      reachedBoss = battleNode.id === map.bossId
    }
    expect(reachedBoss, "дошли до босса").toBe(true)
    expect(events).toBeGreaterThan(0)
    g.destroy()
  })

  it("пробел на карте входит в единственный доступный узел", () => {
    const { g, step } = makeEnv()
    g.startGame()
    step(2)
    const startId = (g as unknown as { campaignPlayerId: number }).campaignPlayerId
    const outs = (
      g as unknown as { campaign: { edges: { from: number; to: number }[] } }
    ).campaign.edges.filter((e) => e.from === startId).length
    g.enterNextNodeOnAction()
    // при единственном пути вход состоялся, при ветвлении — остаёмся на карте
    expect(g.phase).toBe(outs === 1 ? "playing" : "map")
    g.destroy()
  })

  it("startLevelBattle(1) остаётся прямым входом в бой мимо карты", () => {
    const { g, step } = makeEnv()
    g.startLevelBattle(1)
    step(2)
    expect(g.phase).toBe("playing")
    expect(g.level).toBe(1)
    expect(g.onBossNode).toBe(false)
    expect(g.blocks.length).toBeGreaterThan(0)
    g.destroy()
  })

  it("лазер из прокачки остаётся взведённым после стартовой паузы и стреляет по команде", () => {
    const { g, step } = makeEnv()
    const laserGame = g as typeof g & {
      upgrades: Record<string, number>
      laserArmed: boolean
      laserUntil: number
      time: number
      weaponsSys: { updateLaser: (fire: boolean) => void }
    }
    laserGame.upgrades.laser = 1
    g.startLevelBattle(1)
    expect(laserGame.laserArmed).toBe(true)

    step(180)
    expect(laserGame.laserArmed).toBe(true)

    laserGame.weaponsSys.updateLaser(true)
    expect(laserGame.laserArmed).toBe(false)
    expect(laserGame.laserUntil).toBeGreaterThan(laserGame.time)
    g.destroy()
  })

  it("лазерный старт не активируется при первом запуске шара, а взводится для последующего нажатия", () => {
    const { game, g, step } = makeEnv()
    const laserGame = g as typeof g & {
      upgrades: Record<string, number>
      laserArmed: boolean
      laserUntil: number
      time: number
      balls: Array<{ stuck: boolean }>
      weaponsSys: { updateLaser: (fire: boolean) => void }
    }
    laserGame.upgrades.laser = 1
    g.startLevelBattle(1)
    expect(laserGame.laserArmed).toBe(true)
    expect(laserGame.balls.some((b) => b.stuck)).toBe(true)

    // Запуск шара
    launch(game)
    step(5)

    // Шар в полёте, лазер всё ещё взведён и ждёт последующего нажатия
    expect(laserGame.balls.some((b) => b.stuck)).toBe(false)
    expect(laserGame.laserArmed).toBe(true)
    expect(laserGame.laserUntil).toBe(0)

    // Последующий клик/тап активирует лазерный луч
    laserGame.weaponsSys.updateLaser(true)
    expect(laserGame.laserArmed).toBe(false)
    expect(laserGame.laserUntil).toBeGreaterThan(laserGame.time)
    g.destroy()
  })

  it("toMenu очищает карту, а фазы вне карты несут map = null", () => {
    const { g, step, hudLog } = makeEnv()
    g.startGame()
    step(2)
    g.toMenu()
    step(2)
    expect(g.phase).toBe("menu")
    const snap = hudLog[hudLog.length - 1]
    expect(snap.map).toBeNull()
    g.destroy()
  })

  it("магазин кампании открывается, продаёт товары за кристаллы и закрывается", () => {
    const { game, g, step } = makeEnv()
    g.startGame()
    step(2)
    game.crystals = 100

    const shopNode: CampaignNode = {
      id: 999,
      tier: 1,
      x: 0.1,
      y: 0.5,
      isBoss: false,
      isEvent: false,
      isShop: true,
      name: "ЛАВКА ГЛУБИН",
    }
    const map = game.campaign!
    map.nodes.push(shopNode)
    map.edges.push({ from: game.campaignPlayerId, to: 999 })
    game.campaignVisible.push(999)

    g.enterMapNode(999)
    step(1)

    expect(g.phase).toBe("map")
    expect(game.campaignShop).toBeTruthy()
    expect(game.campaignShop!.items.length).toBeGreaterThanOrEqual(3)

    const initialCrystals = game.crystals
    const lifeItem = game.campaignShop!.items.find((i) => i.id === "life")
    if (lifeItem) {
      game.lives = 3
      const bought = game.buyCampaignShopItem(lifeItem.id)
      expect(bought).toBe(true)
      expect(game.lives).toBe(4)
      expect(game.crystals).toBe(initialCrystals - lifeItem.price)
      expect(lifeItem.sold).toBe(true)

      // Повторная покупка невозможна
      expect(game.buyCampaignShopItem(lifeItem.id)).toBe(false)
    }

    // Закрываем магазин
    game.closeCampaignShop()
    expect(game.campaignShop).toBeNull()
    expect(game.campaignPlayerId).toBe(999)

    g.destroy()
  })

  it("магазин позволяет купить пассивную реликвию забега", () => {
    const { game, g, step } = makeEnv()
    g.startGame()
    step(2)
    game.crystals = 100
    game.shield = 0

    const shopNode: CampaignNode = {
      id: 999,
      tier: 1,
      x: 0.1,
      y: 0.5,
      isBoss: false,
      isEvent: false,
      isShop: true,
      name: "ЛАВКА ГЛУБИН",
    }
    const map = game.campaign!
    map.nodes.push(shopNode)
    map.edges.push({ from: game.campaignPlayerId, to: 999 })
    game.campaignVisible.push(999)

    g.enterMapNode(999)
    step(1)

    // Принудительно добавим реликвию в инвентарь для детерминированного теста
    game.campaignShop!.items.push({
      id: "relic_shield",
      name: "Жемчужина глубин",
      desc: "Реликвия",
      price: 35,
      category: "relic",
      icon: "shield",
      relic: true,
      sold: false,
    })

    const bought = game.buyCampaignShopItem("relic_shield")
    expect(bought).toBe(true)
    expect(game.campaignRelics.relicShield).toBe(true)
    expect(game.shield).toBe(1)
    expect(game.crystals).toBe(65)

    // Повторная покупка реликвии невозможна
    expect(game.buyCampaignShopItem("relic_shield")).toBe(false)

    g.destroy()
  })

  it("интерактивное случайное событие позволяет сделать выбор и применить эффект", () => {
    const { game, g, step } = makeEnv()
    g.startGame()
    step(2)
    game.crystals = 50

    const eventNode: CampaignNode = {
      id: 998,
      tier: 2,
      x: 0.15,
      y: 0.5,
      isBoss: false,
      isEvent: true,
      name: "ВОДОВОРОТ",
    }
    const map = game.campaign!
    map.nodes.push(eventNode)
    map.edges.push({ from: game.campaignPlayerId, to: 998 })
    game.campaignVisible.push(998)

    g.enterMapNode(998)
    step(1)

    expect(game.campaignEventData).toBeTruthy()
    expect(game.campaignEventData!.choices.length).toBe(3)

    // Выбираем первый вариант: "Маневровые двигатели" (тратит 10 кристаллов, даёт +1 щит, остаётся на узле)
    const initialShield = game.shield
    game.chooseCampaignEventOption(0)

    expect(game.campaignEventData!.resolved).toBe(true)
    expect(game.shield).toBe(initialShield + 1)
    expect(game.crystals).toBe(40)
    expect(game.campaignEventTarget).toBe(-1) // остался на месте

    // Подтверждаем и продолжаем путь
    g.dismissCampaignEvent()
    expect(game.campaignEventData).toBeNull()
    expect(game.campaignPlayerId).toBe(998)
    expect(g.phase).toBe("map")

    g.destroy()
  })

  it("узел-испытание гарантирует минибосса и награждает повышенными кристаллами при зачистке", () => {
    const { game, g, step } = makeEnv()
    g.startGame()
    step(2)
    game.crystals = 10

    const challengeNode: CampaignNode = {
      id: 997,
      tier: 2,
      x: 0.15,
      y: 0.5,
      isBoss: false,
      isEvent: false,
      isChallenge: true,
      name: "ИСПЫТАНИЕ",
    }
    const map = game.campaign!
    map.nodes.push(challengeNode)
    map.edges.push({ from: game.campaignPlayerId, to: 997 })
    game.campaignVisible.push(997)

    g.enterMapNode(997)
    step(3)

    expect(g.phase).toBe("playing")
    // В узле-испытании гарантирован минибосс
    expect(game.minibosses.length).toBeGreaterThanOrEqual(1)

    // Зачищаем узел
    game.blocks.length = 0
    game.bossSys.clear()
    game.minibosses.length = 0
    game.powers.length = 0
    game.transition = 0
    game.bannerTimer = 0
    game.countdown = 0

    step(10)

    if (game.intermediateScore) {
      game.continueFromIntermediateScore()
    }

    // Проверяем, что за победу начислены повышенные кристаллы (+40 за испытание)
    expect(game.crystals).toBeGreaterThanOrEqual(50)
    expect(g.phase).toBe("map")

    g.destroy()
  })

  it("в конце забега кристаллы конвертируются в монеты мета-прокачки с учётом реликвии-конвертера", () => {
    const { game, g, step } = makeEnv()
    g.startGame()
    step(2)
    game.coins = 0
    game.crystals = 100
    game.crystalsRunTotal = 100
    game.campaignRelics.relicConverter = true

    // Завершаем кампанию через поражение
    game.lives = 1
    loseLife(game)

    expect(game.phase).toBe("over")
    // 100 * 1.5 = 150 монет
    expect(game.coins).toBe(150)

    g.destroy()
  })

  it("сюжетный терминал станции «СФЕРА-1080» появляется перед стартом боя ближе к концу акта и затем запускает бой", () => {
    const { game, g, step } = makeEnv()
    g.startGame()
    step(2)
    game.crystals = 30
    game.coins = 10
    game.shield = 0

    // Создаём узел боя на 7 ярусе (ближе к концу Акта I)
    const combatNode: CampaignNode = {
      id: 996,
      tier: 7,
      x: 0.7,
      y: 0.5,
      isBoss: false,
      isEvent: false,
      isShop: false,
      name: "СЕКТОР 7",
    }
    const map = game.campaign!
    map.nodes.push(combatNode)
    map.edges.push({ from: game.campaignPlayerId, to: 996 })
    game.campaignVisible.push(996)

    // Игрок входит в узел боя
    g.enterMapNode(996)
    step(1)

    // Вместо прямого старта боя открывается обязательный сюжетный терминал Акта I
    expect(game.phase).toBe("map")
    expect(game.campaignPendingBattleNodeId).toBe(996)
    expect(game.campaignEventData).toBeTruthy()
    expect(game.campaignEventData!.terminalLog).toBeDefined()
    expect(game.campaignEventData!.terminalLog!.act).toBe(1)
    expect(game.campaignEventData!.terminalLog!.code).toContain("108-A")
    expect(game.campaignEventData!.text).toContain("СФЕРА-1080")
    expect(game.campaignEventData!.choices.length).toBe(3)

    // Выбираем второй вариант: "Дешифровать схемы шлюза" (тратит 15 кристаллов, даёт лазерный старт и +20 монет)
    game.chooseCampaignEventOption(1)

    expect(game.campaignEventData!.resolved).toBe(true)
    expect(game.campaignPerks.laserStart).toBe(true)
    expect(game.crystals).toBe(15)
    expect(game.coins).toBe(30)

    // Нажимаем "В бой": терминал закрывается и немедленно стартует бой на этом узле
    g.dismissCampaignEvent()
    expect(game.campaignEventData).toBeNull()
    expect(game.campaignPendingBattleNodeId).toBeNull()
    expect(game.phase).toBe("playing")
    expect(game.campaignPlayerId).toBe(996)
    expect(game.laserArmed).toBe(true)

    g.destroy()
  })
})
