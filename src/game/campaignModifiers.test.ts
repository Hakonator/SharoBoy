import { describe, it, expect, beforeEach, vi } from "vitest"

import { BOSS_FURY_BOMB_MULT, BossSystem, type BossHost } from "./boss"
import {
  CAMPAIGN_MODIFIERS,
  LEGACY_MODIFIER_IDS,
  computeRunMultipliers,
  hasModifier,
  loadSelectedModifiers,
  saveSelectedModifiers,
} from "./campaignModifiers"
import { PowersSystem, type PowersWorld } from "./powers"
import { LOW_BOUNCE_VY_MULT, dampBounceVy } from "./physics/collide"
import { BRITTLE_RADIUS_MULT } from "./blockKinds"
import type { BossState } from "./types"
import { makeEnv } from "./campaignFlow.helpers"

function makeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  }
}

describe("Campaign Modifiers (Мутаторы забегов)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
  })

  it("содержит все ключевые модификаторы из дизайн-документа", () => {
    const ids = CAMPAIGN_MODIFIERS.map((m) => m.id)
    expect(ids).toContain("ironman")
    expect(ids).toContain("heavy_gravity")
    expect(ids).toContain("hyper_speed")
    expect(ids).toContain("dense_armor")
    expect(ids).toContain("glass_paddle")
    expect(ids).toContain("inverted_controls")
  })

  it("computeRunMultipliers корректно вычисляет множители очков и кристаллов", () => {
    // Без модификаторов
    const empty = computeRunMultipliers([])
    expect(empty.scoreMultiplier).toBe(1.0)
    expect(empty.crystalMultiplier).toBe(1.0)

    // Один модификатор: ironman (+50% очков, +50% кристаллов)
    const ironmanOnly = computeRunMultipliers(["ironman"])
    expect(ironmanOnly.scoreMultiplier).toBe(1.5)
    expect(ironmanOnly.crystalMultiplier).toBe(1.5)

    // Комбинация: ironman (+50%) + heavy_gravity (+30%) + dense_armor (+40%)
    // Суммарный бонус: +120% -> множитель 2.20
    const combo = computeRunMultipliers(["ironman", "heavy_gravity", "dense_armor"])
    expect(combo.scoreMultiplier).toBe(2.2)
    expect(combo.crystalMultiplier).toBe(2.2)
  })

  it("hasModifier проверяет активность модификатора", () => {
    expect(hasModifier(["ironman", "dense_armor"], "ironman")).toBe(true)
    expect(hasModifier(["ironman", "dense_armor"], "heavy_gravity")).toBe(false)
    expect(hasModifier(undefined, "ironman")).toBe(false)
  })

  it("loadSelectedModifiers и saveSelectedModifiers сохраняют выбор в localStorage", () => {
    expect(loadSelectedModifiers()).toEqual([])
    saveSelectedModifiers(["hyper_speed", "glass_paddle"])
    expect(loadSelectedModifiers()).toEqual(["hyper_speed", "glass_paddle"])
  })

  it("startGame с модификатором ironman устанавливает ровно 1 жизнь", () => {
    const { g } = makeEnv()
    g.startGame(["ironman"])

    expect(g.campaignModifiers).toEqual(["ironman"])
    expect(g.lives).toBe(1)
  })

  it("dense_armor увеличивает прочность блоков при создании уровня", () => {
    const env1 = makeEnv()
    env1.g.startGame([])
    const target1 = env1.g.campaign!.edges.find((e) => e.from === env1.g.campaignPlayerId)!.to
    env1.g.enterMapNode(target1)
    const regularHp = env1.g.blocks.find((b) => !b.isMiniboss)?.hp ?? 1

    const env2 = makeEnv()
    env2.g.startGame(["dense_armor"])
    const target2 = env2.g.campaign!.edges.find((e) => e.from === env2.g.campaignPlayerId)!.to
    env2.g.enterMapNode(target2)
    const armoredHp = env2.g.blocks.find((b) => !b.isMiniboss)?.hp ?? 1

    expect(armoredHp).toBe(regularHp + 1)
  })

  it("hyper_speed увеличивает начальную скорость шара на 25%", () => {
    const env1 = makeEnv()
    env1.g.startGame([])
    const target1 = env1.g.campaign!.edges.find((e) => e.from === env1.g.campaignPlayerId)!.to
    env1.g.enterMapNode(target1)
    const normalSpeed = env1.g.balls[0]?.speed ?? 0

    const env2 = makeEnv()
    env2.g.startGame(["hyper_speed"])
    const target2 = env2.g.campaign!.edges.find((e) => e.from === env2.g.campaignPlayerId)!.to
    env2.g.enterMapNode(target2)
    const boostedSpeed = env2.g.balls[0]?.speed ?? 0

    expect(boostedSpeed).toBeCloseTo(normalSpeed * 1.25, 0)
  })
})

/* ---------- T-052: мутаторы 6 → 10 ---------- */

/** Минимальный хост бонусов: оба источника дропа должны уважать «Сухой закон». */
function makePowersHost(disabled: boolean): PowersWorld {
  return {
    w: 800,
    h: 600,
    blockTop: 60,
    blockSpawnTop: 60,
    time: 0,
    paddle: { x: 400, y: 560, w: 90, h: 14, vx: 0 },
    balls: [],
    blocks: [],
    boss: null,
    blocksInitial: 30,
    mode: "campaign",
    powers: [],
    spawnTimer: 1e9,
    skyDropTimer: 0,
    wideUntil: 0,
    slowUntil: 0,
    fastUntil: 0,
    shrinkUntil: 0,
    rocketUntil: 0,
    fireUntil: 0,
    frostUntil: 0,
    sparkUntil: 0,
    pierceUntil: 0,
    explosiveUntil: 0,
    bigUntil: 0,
    magnetUntil: 0,
    magneticPaddleUntil: 0,
    laserArmed: false,
    laserArmedUntil: 0,
    paddleShape: () => "flat",
    shield: 0,
    lives: 3,
    shake: 0,
    fx: { burst() {}, shatter() {}, rings: [], popups: [] },
    sfx: { power() {}, wall() {}, paddle() {}, brick() {}, destroy() {}, shieldHit() {} },
    addCoins() {},
    pushHud() {},
    powersDisabled: () => disabled,
  } as unknown as PowersWorld
}

describe("T-052: мутаторы кампании 6 → 10", () => {
  it("пул содержит четыре новых мутатора с положительными множителями", () => {
    const ids = CAMPAIGN_MODIFIERS.map((m) => m.id)
    for (const id of ["no_powers", "brittle_world", "low_bounce", "boss_fury"]) {
      expect(ids).toContain(id)
    }
    expect(CAMPAIGN_MODIFIERS).toHaveLength(10)
    // Исторический пул остаётся подмножеством текущего — старые сейвы валидны.
    for (const id of LEGACY_MODIFIER_IDS) expect(ids).toContain(id)

    const combo = computeRunMultipliers(["no_powers", "brittle_world", "low_bounce", "boss_fury"])
    expect(combo.scoreMultiplier).toBe(2.45) // 1 + 0.45 + 0.4 + 0.25 + 0.35
    expect(combo.crystalMultiplier).toBe(2.45)
  })

  it("no_powers отключает оба источника дропа бонусов", () => {
    const blocked = makePowersHost(true)
    const sys = new PowersSystem(blocked)
    for (let i = 0; i < 400; i++) {
      sys.dropPower(100, 100)
      sys.periodicPowerDrop(0.016)
    }
    expect(blocked.powers).toHaveLength(0)

    const allowed = makePowersHost(false)
    const sys2 = new PowersSystem(allowed)
    for (let i = 0; i < 400; i++) {
      sys2.dropPower(100, 100)
      if (allowed.powers.length > 0) break
    }
    expect(allowed.powers.length).toBeGreaterThan(0)
  })

  it("brittle_world делает обычные блоки цепными, не трогая хрупкий спецблок", () => {
    const env = makeEnv()
    env.g.startGame(["brittle_world"])
    const target = env.g.campaign!.edges.find((e) => e.from === env.g.campaignPlayerId)!.to
    env.g.enterMapNode(target)

    const regular = env.g.blocks.filter(
      (b) => !b.isMiniboss && !b.isTentacle && !b.isClaw && !b.bomb
    )
    expect(regular.length).toBeGreaterThan(0)
    for (const b of regular) {
      expect(b.sp?.brittle).toBeDefined()
      expect(b.sp!.brittle!.radius).toBeCloseTo(Math.max(b.rx, b.ry) * BRITTLE_RADIUS_MULT, 5)
      expect(b.sp!.brittle!.damage).toBe(1)
    }
  })

  it("low_bounce ослабляет только вертикальную часть отскока", () => {
    expect(dampBounceVy({ lowBounceActive: () => false }, -420)).toBe(-420)
    expect(dampBounceVy({ lowBounceActive: () => true }, -420)).toBeCloseTo(
      -420 * LOW_BOUNCE_VY_MULT,
      5
    )
    // Знак сохраняется, «ползучий» отскок не создаётся.
    expect(dampBounceVy({ lowBounceActive: () => true }, -30)).toBe(-30)
    expect(dampBounceVy({}, 200)).toBe(200)
  })

  it("boss_fury сокращает интервал бомб на всех стадиях боя", () => {
    const makeHost = (fury: boolean): BossHost => {
      const blocks: BossHost["blocks"] = []
      return {
        w: 800,
        h: 600,
        blockTop: 60,
        time: 0,
        shake: 0,
        hitStop: 0,
        flash: 0,
        blocks,
        powers: [],
        boomQueue: [],
        paddle: { x: 400, y: 560, w: 90, h: 14 },
        fx: { burst() {}, rings: [], popups: [] },
        sfx: { brick() {}, power() {}, bossPhase() {}, bossDie() {} },
        addRawScore() {},
        onBossKilled() {},
        pushHud() {},
        killBoss() {},
        bossFuryActive: () => fury,
      } as unknown as BossHost
    }

    const makeBoss = (): BossState =>
      ({
        x: 400,
        y: 120,
        baseY: 120,
        r: 30,
        hp: 100,
        maxHp: 100,
        t: 0,
        flash: 0,
        dropTimer: 1e9,
        bombEvery: 4,
      }) as BossState

    /** Время до первой бомбы (сек) при заданном мутаторе. */
    const timeToFirstBomb = (fury: boolean): number => {
      const host = makeHost(fury)
      const sys = new BossSystem(host)
      sys.spawn(makeBoss())
      const dt = 1 / 60
      for (let i = 1; i <= 60 * 10; i++) {
        sys.step(dt)
        if (host.blocks.some((b) => b.bomb)) return i * dt
      }
      return Infinity
    }

    const normal = timeToFirstBomb(false)
    const furious = timeToFirstBomb(true)
    expect(normal).toBeGreaterThan(0)
    expect(furious).toBeLessThan(normal)
    // Ожидаемое соотношение — множитель интервала (шаг кадра даёт погрешность).
    expect(furious / normal).toBeCloseTo(BOSS_FURY_BOMB_MULT, 1)
  })
})
