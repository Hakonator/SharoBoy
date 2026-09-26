import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EVENT_MAX_BACK_TIERS, type CampaignNode } from "./campaignMap"
import { makeEnv } from "./campaignFlow.helpers"

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
      // а телепортируют назад (обход их в тесте отдельной веткой ниже)
      const battleOuts = outs.filter((id) => !map.nodes.find((n) => n.id === id)!.isEvent)
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

      // узел, на котором реально идёт бой (событие может телепортировать назад)
      let battleNode = target
      if (target.isEvent) {
        if (hudLog[hudLog.length - 1].campaignEvent) {
          // первое срабатывание: экран с сообщением, фишка ещё на месте
          g.dismissCampaignEvent()
          // после подтверждения фишка перемещена на узел назначения и бой
          // уже стартовал; узлом назначения не может быть узел-событие —
          // цепочка телепортов на одном ходу исключена; и отбросить событие
          // может не дальше чем на EVENT_MAX_BACK_TIERS зон назад
          expect(g.phase).toBe("playing")
          battleNode = map.nodes.find((n) => n.id === raw.campaignPlayerId)!
          expect(battleNode.isEvent).toBe(false)
          expect(battleNode.tier).toBeGreaterThanOrEqual(target.tier - EVENT_MAX_BACK_TIERS)
        } else {
          // повторный вход в уже сработавшее событие — обычный бой на месте
          expect(g.phase).toBe("playing")
        }
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

      if (battleNode.isBoss) {
        bossFought = true
        expect(g.phase, "после финального босса забег завершён").toBe("won")
      } else {
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
      campaign: {
        nodes: CampaignNode[]
        edges: { from: number; to: number }[]
      }
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
      const targetId = evOuts.length ? evOuts[0] : outs[0]
      const target = map.nodes.find((n) => n.id === targetId)!
      g.enterMapNode(targetId)

      // первое срабатывание события: оверлей → подтверждение → телепорт
      const firstTrigger = target.isEvent && g.phase === "map"
      if (firstTrigger) g.dismissCampaignEvent()

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
      reachedBoss = battleNode.isBoss
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
})
