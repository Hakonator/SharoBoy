import { beforeEach, describe, expect, it, vi } from "vitest"

import { UPGRADE_DEFS } from "./upgrades"
import { makeEnv } from "./campaignFlow.helpers"
import { buyUpgrade, loadProgress, saveProgress, addMetaCrystals } from "./game/progress"
import { resetRun, onLevelCleared } from "./game/runFlow"
import { makePhysicsHost } from "./game/hosts"
import { collideBoss, collidePaddle } from "./physics/collide"
import { buildCampaignEvent, chooseCampaignEventChoice } from "./campaignEvents"
import type { Ball, CampaignNode, Popup } from "./types"
import type { Game } from "./game"

describe("Новые апгрейды, мета-кристаллы, боссы Актов и криты ×3", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(k: string) {
        return this.store[k] ?? null
      },
      setItem(k: string, v: string) {
        this.store[k] = String(v)
      },
      removeItem(k: string) {
        delete this.store[k]
      },
      clear() {
        this.store = {}
      },
    })
  })

  it("UPGRADE_DEFS содержит все 6 новых постоянных улучшений", () => {
    const ids = UPGRADE_DEFS.map((u) => u.id)
    expect(ids).toContain("paddleRotation")
    expect(ids).toContain("shieldStart")
    expect(ids).toContain("coinMagnet")
    expect(ids).toContain("buffDuration")
    expect(ids).toContain("comboMaster")
    expect(ids).toContain("crystalVein")
  })

  it("мета-кристаллы сохраняются, загружаются и сбрасываются", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.metaCrystals = 100
    saveProgress(game)
    expect(localStorage.getItem("sharoboy-meta-crystals")).toBe("100")

    game.metaCrystals = 0
    loadProgress(game)
    expect(game.metaCrystals).toBe(100)

    addMetaCrystals(game, 25)
    expect(game.metaCrystals).toBe(125)
    expect(localStorage.getItem("sharoboy-meta-crystals")).toBe("125")

    game.resetAccountData()
    expect(game.metaCrystals).toBe(0)
    expect(localStorage.getItem("sharoboy-meta-crystals")).toBeNull()
    g.destroy()
  })

  it("покупка апгрейда shieldStart даёт стартовый щит в resetRun", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.coins = 1000
    expect(buyUpgrade(game, "shieldStart")).toBe(true)
    expect(game.upgrades.shieldStart).toBe(1)

    resetRun(game)
    expect(game.shield).toBe(1)
    g.destroy()
  })

  it("комбо-мастер сохраняет процент комбо при отскоке от ракетки", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    const host = makePhysicsHost(game)

    // Без апгрейда комбо сбрасывается в 0
    game.combo = 10
    game.upgrades.comboMaster = 0
    const ball: Ball = {
      x: host.paddle.x,
      y: host.paddle.y - host.paddle.h / 2,
      vx: 0,
      vy: 100,
      r: 8,
      speed: 100,
      stuck: false,
      stuckOffset: 0,
      trail: [],
      squash: 0,
      sinceHit: 0.1,
    }
    collidePaddle(host, ball)
    expect(game.combo).toBe(0)

    // На 1 уровне сохраняет 35%
    game.combo = 10
    game.upgrades.comboMaster = 1
    ball.y = host.paddle.y - host.paddle.h / 2
    ball.vy = 100
    ball.sinceHit = 0.1
    collidePaddle(host, ball)
    expect(game.combo).toBe(3) // floor(10 * 0.35)

    // На 2 уровне сохраняет 70%
    game.combo = 10
    game.upgrades.comboMaster = 2
    ball.y = host.paddle.y - host.paddle.h / 2
    ball.vy = 100
    ball.sinceHit = 0.1
    collidePaddle(host, ball)
    expect(game.combo).toBe(7) // floor(10 * 0.7)

    g.destroy()
  })

  it("крит ×3 активируется на 3-е последовательное чистое попадание по боссу", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    const host = makePhysicsHost(game)

    game.bossSys.boss = {
      x: 300,
      y: 150,
      baseY: 150,
      r: 40,
      hp: 100,
      maxHp: 100,
      t: 0,
      flash: 0,
      dropTimer: 0,
    }

    const ball: Ball = {
      x: 300,
      y: 150 + 40,
      vx: 0,
      vy: -100,
      r: 8,
      speed: 100,
      stuck: false,
      stuckOffset: 0,
      trail: [],
      squash: 0,
      sinceHit: 0,
    }

    // Удар 1 (чистый)
    collideBoss(host, ball)
    expect(game.bossCleanHits).toBe(1)
    expect(host.boss.hp).toBe(99)

    // Удар 2 (чистый)
    ball.y = 150 + 40
    ball.vy = -100
    collideBoss(host, ball)
    expect(game.bossCleanHits).toBe(2)
    expect(host.boss.hp).toBe(98)

    // Удар 3 (КРИТ! урон ×3)
    ball.y = 150 + 40
    ball.vy = -100
    collideBoss(host, ball)
    expect(game.bossCleanHits).toBe(0) // сброс серии после крита
    expect(host.boss.hp).toBe(95) // 98 - 3 = 95
    expect(host.fx.popups.some((p: Popup) => p.text.includes("КРИТ ×3!"))).toBe(true)

    // Касание ракетки сбрасывает счётчик чистых ударов
    game.bossCleanHits = 2
    ball.x = host.paddle.x
    ball.y = host.paddle.y - host.paddle.h / 2
    ball.vy = 100
    ball.sinceHit = 0.1
    collidePaddle(host, ball)
    expect(game.bossCleanHits).toBe(0)

    g.destroy()
  })

  it("победа над боссом Акта даёт мета-кристаллы и возвращает на карту, а финальный босс завершает забег", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.mode = "campaign"
    game.campaign = {
      seed: 123,
      tiers: 30,
      startId: 0,
      bossId: 99,
      nodes: [
        { id: 10, tier: 9, isBoss: true, isEvent: false, name: "БОСС: АКТ I", x: 0.3, y: 0.5 },
        { id: 20, tier: 19, isBoss: true, isEvent: false, name: "БОСС: АКТ II", x: 0.6, y: 0.5 },
        { id: 99, tier: 29, isBoss: true, isEvent: false, name: "ФИНАЛЬНЫЙ БОСС", x: 0.95, y: 0.5 },
      ],
      edges: [],
    }

    // Победа над боссом Акта I
    game.campaignPlayerId = 10
    game.onBossNode = true
    game.metaCrystals = 0
    onLevelCleared(game)
    expect(game.phase).toBe("map")
    expect(game.metaCrystals).toBe(25)

    // Победа над боссом Акта II
    game.campaignPlayerId = 20
    game.onBossNode = true
    onLevelCleared(game)
    expect(game.phase).toBe("map")
    expect(game.metaCrystals).toBe(75) // 25 + 50

    // Победа над Финальным боссом
    game.campaignPlayerId = 99
    game.onBossNode = true
    onLevelCleared(game)
    expect(game.phase).toBe("won")
    expect(game.metaCrystals).toBe(225) // 75 + 150

    g.destroy()
  })

  it("новые события кампании генерируют валидные варианты и обрабатывают выбор", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    const node: CampaignNode = {
      id: 5,
      tier: 4,
      x: 0.2,
      y: 0.5,
      isBoss: false,
      isEvent: true,
      name: "АЛТАРЬ БЕЗДНЫ",
    }

    // Алтарь Бездны
    const altarEvent = buildCampaignEvent(game, node, 1)
    expect(altarEvent.choices.length).toBe(3)
    game.campaignEventData = altarEvent
    game.crystals = 50
    game.lives = 2
    chooseCampaignEventChoice(game, 0) // Жертва ради Вечного Огня
    expect(game.campaignRelics.relicFire).toBe(true)
    expect(game.lives).toBe(1)

    // Сундук Корсаров
    node.name = "СУНДУК КОРСАРОВ"
    const chestEvent = buildCampaignEvent(game, node, 1)
    expect(chestEvent.choices.length).toBe(3)

    // Азартный Осьминог
    node.name = "ОСЬМИНОГ-ШУЛЕР"
    const gambleEvent = buildCampaignEvent(game, node, 1)
    expect(gambleEvent.choices.length).toBe(3)

    // Развилка Течений
    node.name = "РАЗВИЛКА ТЕЧЕНИЙ"
    const currentEvent = buildCampaignEvent(game, node, 1)
    expect(currentEvent.choices.length).toBe(3)

    g.destroy()
  })
})
