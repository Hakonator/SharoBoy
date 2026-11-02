import { describe, it, expect, vi } from "vitest"

import {
  CAMPAIGN_RELICS_META,
  getActiveRelicIds,
  RELIC_ID_TO_KEY,
  RELIC_KEY_TO_ID,
  type CampaignRelicId,
} from "./campaignRelics"
import { SHOP_CATALOG, canBuyCampaignShopItem, buyCampaignShopItem } from "./campaignShop"
import { loseLife, onBombHitPaddle, resetRun } from "./game/runFlow"
import { launchNodeBattle } from "./game/campaignFlow"
import { makePhysicsHost } from "./game/hosts"
import { pushHud } from "./game/hudSync"
import type { Game } from "./game"
import type { CampaignShopItem, HudData } from "./types"

function makeMockGame(over: Partial<Game> = {}): Game {
  const g = {
    w: 800,
    h: 900,
    cssW: 800,
    cssH: 900,
    time: 10,
    lives: 3,
    shield: 1,
    combo: 10,
    score: 1000,
    best: 5000,
    level: 1,
    wave: 0,
    phase: "playing",
    mode: "campaign",
    crystals: 100,
    crystalsRunTotal: 100,
    coins: 50,
    metaCrystals: 10,
    campaignModifiers: [],
    campaignRelics: {},
    campaignPerks: {},
    campaignShops: {},
    campaignShop: null,
    campaignVisited: [],
    campaignVisible: [],
    campaignTerminalsSeen: [],
    campaignSpentEvents: [],
    tacticalModules: {
      paddleRotation: false,
      paddleImpulse: false,
      aimGuide: true,
      magnetStart: false,
    },
    upgrades: {},
    paddle: { x: 400, y: 850, w: 90, h: 14, rot: 0 },
    paddleShapeKind: () => "flat",
    bossSys: { clear: vi.fn() },
    sparkQueue: [],
    balls: [],
    blocks: [],
    powers: [],
    projectiles: [],
    shake: 0,
    flash: 0,
    wideUntil: 0,
    slowUntil: 0,
    fastUntil: 0,
    shrinkUntil: 0,
    laserUntil: 0,
    laserArmed: false,
    rocketUntil: 0,
    fireUntil: 0,
    frostUntil: 0,
    sparkUntil: 0,
    pierceUntil: 0,
    explosiveUntil: 0,
    bigUntil: 0,
    magnetUntil: 0,
    magneticPaddleUntil: 0,
    weaponCd: 0,
    runLivesLost: 0,
    levelLostBall: false,
    bulwarkBlockedThisLevel: false,
    overdriveUsedThisRun: false,
    achQueue: [],
    top: [],
    topEndless: [],
    input: { releaseLock: () => {} },
    sfx: {
      ensure: vi.fn(),
      setTrack: vi.fn(),
      setUnderwater: vi.fn(),
      shieldHit: vi.fn(),
      loseLife: vi.fn(),
      power: vi.fn(),
      gameOver: vi.fn(),
      levelClear: vi.fn(),
      achievement: vi.fn(),
      launch: vi.fn(),
      muted: false,
      musicMuted: false,
      musicVolume: 1,
      sfxVolume: 1,
    },
    fx: {
      popups: [],
      rings: [],
      burst: vi.fn(),
      clear: vi.fn(),
    },
    onHud: vi.fn(),
    isAimGuideActive: () => true,
    ...over,
  } as unknown as Game
  return g
}

describe("campaignRelics: метаданные и каталог", () => {
  it("содержит ровно 10 реликвий в мета-каталоге", () => {
    const ids = Object.keys(CAMPAIGN_RELICS_META) as CampaignRelicId[]
    expect(ids).toHaveLength(10)
    expect(ids).toContain("relic_shield")
    expect(ids).toContain("relic_spark")
    expect(ids).toContain("relic_fire")
    expect(ids).toContain("relic_converter")
    expect(ids).toContain("relic_frost")
    expect(ids).toContain("relic_combo")
    expect(ids).toContain("relic_bulwark")
    expect(ids).toContain("relic_overdrive")
    expect(ids).toContain("relic_kindle")
    expect(ids).toContain("relic_anchor")
  })

  it("проверяет взаимно-однозначное соответствие ключей и ID", () => {
    for (const [id, key] of Object.entries(RELIC_ID_TO_KEY)) {
      expect(RELIC_KEY_TO_ID[key as keyof typeof RELIC_KEY_TO_ID]).toBe(id)
    }
  })

  it("getActiveRelicIds возвращает пустой массив при отсутствии реликвий", () => {
    expect(getActiveRelicIds(null)).toEqual([])
    expect(getActiveRelicIds(undefined)).toEqual([])
    expect(getActiveRelicIds({})).toEqual([])
  })

  it("getActiveRelicIds корректно возвращает список активных реликвий", () => {
    const active = getActiveRelicIds({
      relicShield: true,
      relicFrost: true,
      relicOverdrive: true,
      relicKindle: true,
      relicAnchor: true,
    })
    expect(active).toEqual([
      "relic_shield",
      "relic_frost",
      "relic_overdrive",
      "relic_kindle",
      "relic_anchor",
    ])
  })

  it("SHOP_CATALOG содержит все 10 реликвий с валидными ценами", () => {
    const relicItems = SHOP_CATALOG.filter((item) => item.category === "relic")
    expect(relicItems).toHaveLength(10)
    const relicIds = relicItems.map((r) => r.id)
    expect(relicIds).toEqual([
      "relic_shield",
      "relic_spark",
      "relic_fire",
      "relic_converter",
      "relic_frost",
      "relic_combo",
      "relic_bulwark",
      "relic_overdrive",
      "relic_kindle",
      "relic_anchor",
    ])
    for (const item of relicItems) {
      expect(item.basePrice).toBeGreaterThan(0)
      expect(item.desc.length).toBeGreaterThan(10)
    }
    expect(SHOP_CATALOG.find((i) => i.id === "relic_kindle")?.basePrice).toBe(42)
    expect(SHOP_CATALOG.find((i) => i.id === "relic_anchor")?.basePrice).toBe(48)
  })
})

describe("campaignRelics: магазин кампании и покупка", () => {
  it("разрешает покупку реликвии при наличии кристаллов и отсутствии реликвии", () => {
    const g = makeMockGame({ crystals: 50, campaignRelics: {} })
    const catalogItem = SHOP_CATALOG.find((i) => i.id === "relic_frost")!
    const shopItem: CampaignShopItem = {
      id: catalogItem.id,
      name: catalogItem.name,
      desc: catalogItem.desc,
      price: catalogItem.basePrice,
      category: catalogItem.category,
      icon: catalogItem.icon,
      relic: true,
      sold: false,
    }
    g.campaignShop = {
      nodeId: 1,
      name: "Лавка",
      items: [shopItem],
    }

    const check = canBuyCampaignShopItem(g, shopItem)
    expect(check.canBuy).toBe(true)

    const bought = buyCampaignShopItem(g, "relic_frost")
    expect(bought).toBe(true)
    expect(g.campaignRelics.relicFrost).toBe(true)
    expect(g.crystals).toBe(50 - catalogItem.basePrice)
    expect(shopItem.sold).toBe(true)
  })

  it("запрещает повторную покупку уже имеющейся реликвии", () => {
    const g = makeMockGame({
      crystals: 100,
      campaignRelics: { relicBulwark: true },
    })
    const catalogItem = SHOP_CATALOG.find((i) => i.id === "relic_bulwark")!
    const shopItem: CampaignShopItem = {
      id: catalogItem.id,
      name: catalogItem.name,
      desc: catalogItem.desc,
      price: catalogItem.basePrice,
      category: catalogItem.category,
      icon: catalogItem.icon,
      relic: true,
      sold: false,
    }
    g.campaignShop = {
      nodeId: 1,
      name: "Лавка",
      items: [shopItem],
    }

    const check = canBuyCampaignShopItem(g, shopItem)
    expect(check.canBuy).toBe(false)
    expect(check.reason).toBe("Реликвия уже активна")

    const bought = buyCampaignShopItem(g, "relic_bulwark")
    expect(bought).toBe(false)
    expect(g.crystals).toBe(100)
  })

  it("покупка relic_overdrive активирует соответствующий флаг в campaignRelics", () => {
    const g = makeMockGame({
      crystals: 100,
      campaignRelics: {},
    })
    const catalogItem = SHOP_CATALOG.find((i) => i.id === "relic_overdrive")!
    const shopItem: CampaignShopItem = {
      id: catalogItem.id,
      name: catalogItem.name,
      desc: catalogItem.desc,
      price: catalogItem.basePrice,
      category: catalogItem.category,
      icon: catalogItem.icon,
      relic: true,
      sold: false,
    }
    g.campaignShop = {
      nodeId: 1,
      name: "Лавка",
      items: [shopItem],
    }

    expect(canBuyCampaignShopItem(g, shopItem).canBuy).toBe(true)
    expect(buyCampaignShopItem(g, "relic_overdrive")).toBe(true)
    expect(g.campaignRelics.relicOverdrive).toBe(true)
  })

  it("покупка relic_kindle и relic_anchor активирует соответствующие флаги в campaignRelics", () => {
    const g = makeMockGame({
      crystals: 150,
      campaignRelics: {},
    })
    const kindleItem = SHOP_CATALOG.find((i) => i.id === "relic_kindle")!
    const anchorItem = SHOP_CATALOG.find((i) => i.id === "relic_anchor")!
    const shopItemKindle: CampaignShopItem = {
      id: kindleItem.id,
      name: kindleItem.name,
      desc: kindleItem.desc,
      price: kindleItem.basePrice,
      category: kindleItem.category,
      icon: kindleItem.icon,
      relic: true,
      sold: false,
    }
    const shopItemAnchor: CampaignShopItem = {
      id: anchorItem.id,
      name: anchorItem.name,
      desc: anchorItem.desc,
      price: anchorItem.basePrice,
      category: anchorItem.category,
      icon: anchorItem.icon,
      relic: true,
      sold: false,
    }
    g.campaignShop = {
      nodeId: 2,
      name: "Лавка",
      items: [shopItemKindle, shopItemAnchor],
    }

    expect(canBuyCampaignShopItem(g, shopItemKindle).canBuy).toBe(true)
    expect(buyCampaignShopItem(g, "relic_kindle")).toBe(true)
    expect(g.campaignRelics.relicKindle).toBe(true)
    expect(g.crystals).toBe(150 - 42)

    expect(canBuyCampaignShopItem(g, shopItemAnchor).canBuy).toBe(true)
    expect(buyCampaignShopItem(g, "relic_anchor")).toBe(true)
    expect(g.campaignRelics.relicAnchor).toBe(true)
    expect(g.crystals).toBe(150 - 42 - 48)

    // Повторная покупка запрещена
    expect(canBuyCampaignShopItem(g, shopItemKindle).canBuy).toBe(false)
    expect(canBuyCampaignShopItem(g, shopItemAnchor).canBuy).toBe(false)
  })
})

describe("campaignRelics: механики в бою", () => {
  it("relic_combo: сохраняет половину комбо при потере жизни вместо сброса в 0", () => {
    const gWithoutRelic = makeMockGame({ combo: 9, campaignRelics: {} })
    loseLife(gWithoutRelic)
    expect(gWithoutRelic.combo).toBe(0)

    const gWithRelic = makeMockGame({ combo: 9, campaignRelics: { relicCombo: true } })
    loseLife(gWithRelic)
    expect(gWithRelic.combo).toBe(4) // Math.floor(9 / 2)
  })

  it("relic_bulwark: первая бомба за бой поглощается без потери жизни", () => {
    const g = makeMockGame({
      lives: 3,
      shield: 0,
      campaignRelics: { relicBulwark: true },
      bulwarkBlockedThisLevel: false,
    })

    // Первый удар бомбы — поглощается
    onBombHitPaddle(g)
    expect(g.lives).toBe(3)
    expect(g.bulwarkBlockedThisLevel).toBe(true)
    expect(g.sfx.shieldHit).toHaveBeenCalled()
    expect(g.fx.popups.some((p: { text: string }) => p.text.includes("БОМБА ПОГЛОЩЕНА"))).toBe(true)

    // Второй удар бомбы в том же бою — наносит урон
    onBombHitPaddle(g)
    expect(g.lives).toBe(2)
  })

  it("absolute_bulwark: при активной синергии (щит + бастион) бомбы поглощаются без лимита", () => {
    const g = makeMockGame({
      lives: 3,
      shield: 1,
      campaignRelics: { relicBulwark: true },
      bulwarkBlockedThisLevel: false,
    })

    onBombHitPaddle(g)
    expect(g.lives).toBe(3)
    // bulwarkBlockedThisLevel не тратится, так как сработал Абсолютный Бастион
    expect(g.bulwarkBlockedThisLevel).toBe(false)
    expect(
      g.fx.popups.some((p: { text: string }) =>
        p.text.includes("АБСОЛЮТНЫЙ БАСТИОН: БОМБА ОТРАЖЕНА")
      )
    ).toBe(true)

    // Второй удар бомбы — также поглощается!
    onBombHitPaddle(g)
    expect(g.lives).toBe(3)
  })

  it("relic_bulwark: флаг сбрасывается при старте нового боя на карте", () => {
    const g = makeMockGame({
      bulwarkBlockedThisLevel: true,
      campaignRelics: { relicBulwark: true },
    })

    launchNodeBattle(g, "ТЕСТОВЫЙ БОЙ")
    expect(g.bulwarkBlockedThisLevel).toBe(false)
  })

  it("relic_overdrive: спасает от поражения при 0 жизней, восстанавливая 1 жизнь и 1 щит", () => {
    const g = makeMockGame({
      lives: 1,
      shield: 0,
      campaignRelics: { relicOverdrive: true },
      overdriveUsedThisRun: false,
    })

    loseLife(g)

    // Овердрайв предотвратил гибель:
    expect(g.lives).toBe(1)
    expect(g.shield).toBe(1)
    expect(g.overdriveUsedThisRun).toBe(true)
    expect(g.phase).toBe("playing")
    expect(g.fx.popups.some((p: { text: string }) => p.text.includes("АВАРИЙНЫЙ ОВЕРДРАЙВ"))).toBe(
      true
    )
    expect(g.sfx.gameOver).not.toHaveBeenCalled()

    // Вторая смертельная потеря в том же забеге — нормальный game over
    loseLife(g)
    expect(g.lives).toBe(0)
    expect(g.phase).toBe("over")
    expect(g.sfx.gameOver).toHaveBeenCalled()
  })

  it("resetRun сбрасывает статус овердрайва и бастиона", () => {
    const g = makeMockGame({
      bulwarkBlockedThisLevel: true,
      overdriveUsedThisRun: true,
    })

    resetRun(g)
    expect(g.bulwarkBlockedThisLevel).toBe(false)
    expect(g.overdriveUsedThisRun).toBe(false)
  })

  it("pushHud синхронизирует activeRelics в объекте HudData", () => {
    let capturedHud: HudData | null = null
    const g = makeMockGame({
      campaignRelics: {
        relicShield: true,
        relicFrost: true,
        relicOverdrive: true,
        relicKindle: true,
        relicAnchor: true,
      },
      onHud: (hud: HudData) => {
        capturedHud = hud
      },
    })

    pushHud(g)
    expect(capturedHud).toBeTruthy()
    expect(capturedHud!.activeRelics).toEqual([
      "relic_shield",
      "relic_frost",
      "relic_overdrive",
      "relic_kindle",
      "relic_anchor",
    ])
  })

  it("relic_kindle: при комбо >= 5 включает огненный шар на 3 с", () => {
    const g = makeMockGame({
      time: 10,
      combo: 0,
      fireUntil: 0,
      campaignRelics: { relicKindle: true },
    })
    const host = makePhysicsHost(g)

    // При комбо < 5 огонь не включается
    host.combo = 4
    expect(g.fireUntil).toBe(0)
    expect(host.fireActive()).toBe(false)

    // При достижении комбо >= 5 огонь включается на 3 сек (time 10 + 3 = 13)
    host.combo = 5
    expect(g.fireUntil).toBe(13)
    expect(host.fireActive()).toBe(true)

    // Пока таймер не истёк, огонь остаётся активным
    g.time = 12.5
    expect(host.fireActive()).toBe(true)

    // После истечения таймера огонь выключается
    g.time = 13.5
    expect(host.fireActive()).toBe(false)

    // Без реликвии комбо >= 5 не активирует fireUntil
    const gWithoutRelic = makeMockGame({
      time: 10,
      combo: 0,
      fireUntil: 0,
      campaignRelics: {},
    })
    const hostWithout = makePhysicsHost(gWithoutRelic)
    hostWithout.combo = 5
    expect(gWithoutRelic.fireUntil).toBe(0)
    expect(hostWithout.fireActive()).toBe(false)
  })

  it("relic_anchor: на последней жизни шар замедляется на 15%", () => {
    const ball = {
      x: 400,
      y: 800,
      vx: 0,
      vy: -500,
      r: 9,
      speed: 500,
      stuck: false,
      stuckOffset: 0,
      trail: [],
      squash: 0,
      sinceHit: 0,
    }
    const g = makeMockGame({
      lives: 3,
      balls: [ball],
      campaignRelics: { relicAnchor: true },
    })
    const host = makePhysicsHost(g)

    // При 3 жизнях скорость шара номинальная (500)
    expect(host.balls[0].speed).toBe(500)

    // При потере жизней до 1 («последняя жизнь») скорость снижается на 15% (500 * 0.85 = 425)
    g.lives = 1
    expect(host.balls[0].speed).toBeCloseTo(425, 1)

    // При восстановлении жизней (например, починка/апгрейд до 2) скорость возвращается к норме
    g.lives = 2
    expect(host.balls[0].speed).toBeCloseTo(500, 1)

    // Без реликвии при 1 жизни замедление не происходит
    const ball2 = { ...ball, speed: 500 }
    const gWithout = makeMockGame({
      lives: 1,
      balls: [ball2],
      campaignRelics: {},
    })
    const hostWithout = makePhysicsHost(gWithout)
    expect(hostWithout.balls[0].speed).toBe(500)
  })
})
