import { describe, it, expect, vi } from "vitest"

import {
  CHALLENGE_FULL_POOL_TIER,
  CHALLENGE_KINDS,
  createCampaignChallenge,
  formatChallengeHud,
  initActiveChallenge,
  isCollectiveChallenge,
  recordChallengeArmor,
  recordChallengeBallLost,
  recordChallengeChain,
  recordChallengeCrit,
  recordChallengePower,
  updateActiveChallenge,
  type ActiveChallengeState,
  type CampaignChallenge,
} from "./campaignChallenges"
import { Physics, type PhysicsWorld } from "./physics"
import { PowersSystem, type PowersWorld } from "./powers"
import type { Block, PowerType } from "./types"

describe("Campaign Challenges (Квестовые узлы-челленджи)", () => {
  it("детерминированно создаёт испытания по сиду узла", () => {
    const ch1 = createCampaignChallenge(12345, 5)
    const ch2 = createCampaignChallenge(12345, 5)

    expect(ch1).toEqual(ch2)
    expect(ch1.rewardCrystals).toBeGreaterThan(0)
    expect(ch1.rewardMeta).toBeGreaterThanOrEqual(1)
    expect([...CHALLENGE_KINDS]).toContain(ch1.kind)
  })

  it("на поздних ярусах (tier >= 18) награда мета-кристаллами возрастает до 2", () => {
    const chLate = createCampaignChallenge(42, 20)
    expect(chLate.rewardMeta).toBe(2)
  })

  it("увеличивает базовый лимит времени для speed_clear и добавляет +35с за каждого минибосса", () => {
    const def = createCampaignChallenge(1, 4)
    const speedDef = {
      ...def,
      kind: "speed_clear" as const,
      targetValue: 68,
      description: "Зачистите быстрее чем за 68 сек",
    }
    // 0 минибоссов
    const active0 = initActiveChallenge(speedDef, 0)
    expect(active0.def.targetValue).toBe(68)

    // 1 минибосс: +35 сек
    const active1 = initActiveChallenge(speedDef, 1)
    expect(active1.def.targetValue).toBe(103)
    expect(active1.def.description).toContain("+35 с за минибосса")

    // 2 минибосса: +70 сек
    const active2 = initActiveChallenge(speedDef, 2)
    expect(active2.def.targetValue).toBe(138)
    expect(active2.def.description).toContain("+70 с за минибосса")
  })

  it("updateActiveChallenge для speed_clear отсчитывает время и проваливает при лимите", () => {
    const def = createCampaignChallenge(1, 4)
    const active = initActiveChallenge({
      ...def,
      kind: "speed_clear",
      targetValue: 10,
    })

    const onSurviveWin = vi.fn()
    const onTimeExpired = vi.fn()

    // 5 секунд прошло
    updateActiveChallenge(active, 5, { onSurviveWin, onTimeExpired })
    expect(active.progress).toBe(5)
    expect(active.failed).toBe(false)
    expect(onTimeExpired).not.toHaveBeenCalled()

    // Еще 6 секунд -> суммарно 11 >= 10
    updateActiveChallenge(active, 6, { onSurviveWin, onTimeExpired })
    expect(active.failed).toBe(true)
    expect(onTimeExpired).toHaveBeenCalledTimes(1)
  })

  it("updateActiveChallenge для survive_time засчитывает триумф при истечении времени", () => {
    const def = createCampaignChallenge(1, 4)
    const active = initActiveChallenge({
      ...def,
      kind: "survive_time",
      targetValue: 8,
    })

    const onSurviveWin = vi.fn()
    const onTimeExpired = vi.fn()

    updateActiveChallenge(active, 8.5, { onSurviveWin, onTimeExpired })
    expect(active.completed).toBe(true)
    expect(active.failed).toBe(false)
    expect(onSurviveWin).toHaveBeenCalledTimes(1)
  })

  it("recordChallengeBallLost проваливает flawless и survive_time при потере мяча", () => {
    const flawless = initActiveChallenge({
      kind: "flawless",
      title: "Без потерь",
      description: "Не терять мяч",
      targetValue: 1,
      rewardCrystals: 50,
      rewardMeta: 1,
    })

    const onFail = vi.fn()
    recordChallengeBallLost(flawless, onFail)

    expect(flawless.failed).toBe(true)
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it("recordChallengeCrit увеличивает счётчик критов и завершает при достижении цели", () => {
    const active = initActiveChallenge({
      kind: "crit_hunter",
      title: "Мастер критов",
      description: "3 крита",
      targetValue: 3,
      rewardCrystals: 50,
      rewardMeta: 1,
    })

    const onWin = vi.fn()
    recordChallengeCrit(active, onWin)
    expect(active.progress).toBe(1)
    expect(active.completed).toBe(false)

    recordChallengeCrit(active, onWin)
    expect(active.progress).toBe(2)
    expect(active.completed).toBe(false)

    recordChallengeCrit(active, onWin)
    expect(active.progress).toBe(3)
    expect(active.completed).toBe(true)
    expect(onWin).toHaveBeenCalledTimes(1)
  })

  it("formatChallengeHud формирует корректный снимок данных для UI", () => {
    const active = initActiveChallenge({
      kind: "speed_clear",
      title: "СПРИНТ",
      description: "За 40 сек",
      targetValue: 40,
      rewardCrystals: 50,
      rewardMeta: 1,
    })
    active.progress = 10

    const hud = formatChallengeHud(active)
    expect(hud.title).toBe("СПРИНТ")
    expect(hud.statusText).toContain("30.0")
    expect(hud.failed).toBe(false)
    expect(hud.rewardCrystals).toBe(50)
  })
})

/* ---------- T-053: челлендж-узлы 4 → 7 видов ---------- */

/** Подбор сида, на котором генератор выдаёт нужный вид при данном ярусе. */
function seedForKind(kind: CampaignChallenge["kind"], tier: number): number {
  for (let seed = 1; seed < 20000; seed++) {
    if (createCampaignChallenge(seed, tier).kind === kind) return seed
  }
  throw new Error(`не удалось найти сид для ${kind} (ярус ${tier})`)
}

function makeChallenge(kind: CampaignChallenge["kind"], targetValue: number): ActiveChallengeState {
  return initActiveChallenge({
    kind,
    title: kind,
    description: kind,
    targetValue,
    rewardCrystals: 60,
    rewardMeta: 1,
  })
}

/** Эллипс-блок по образцу physics.test.ts. */
function makeBlock(over: Partial<Block> = {}): Block {
  return {
    x: 200,
    y: 100,
    rx: 30,
    ry: 16,
    rot: 0,
    circle: false,
    hp: 3,
    maxHp: 3,
    tier: 1,
    flash: 0,
    seed: 1,
    dead: false,
    x0: 200,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
    ...over,
  }
}

describe("T-053: новые виды испытаний", () => {
  it("пул вырос до 7 видов, порядок классической четвёрки сохранён", () => {
    expect(CHALLENGE_KINDS).toHaveLength(7)
    expect(CHALLENGE_KINDS.slice(0, 4)).toEqual([
      "speed_clear",
      "flawless",
      "survive_time",
      "crit_hunter",
    ])
    expect(CHALLENGE_FULL_POOL_TIER).toBe(5)
  })

  it("на ранних ярусах генератор не выдаёт новые виды, с 5-го — выдаёт", () => {
    const early = new Set<string>()
    for (let seed = 1; seed < 400; seed++) {
      early.add(createCampaignChallenge(seed, 3).kind)
    }
    for (const kind of early) {
      expect(CHALLENGE_KINDS.slice(0, 4)).toContain(kind)
    }

    const late = new Set<string>()
    for (let seed = 1; seed < 400; seed++) {
      late.add(createCampaignChallenge(seed, CHALLENGE_FULL_POOL_TIER).kind)
    }
    expect(late.size).toBe(7) // все семь видов достижимы с 5-го яруса
  })

  it("новые виды детерминированно создаются по сиду узла с ростом цели по ярусу", () => {
    for (const kind of ["power_hunter", "chain_master", "armor_breaker"] as const) {
      const seed = seedForKind(kind, 6)
      const a = createCampaignChallenge(seed, 6)
      const b = createCampaignChallenge(seed, 6)
      expect(a).toEqual(b)
      expect(a.kind).toBe(kind)
      expect(a.targetValue).toBeGreaterThan(0)
      expect(a.rewardCrystals).toBeGreaterThan(0)
      expect(a.rewardMeta).toBe(1)

      // Поздние ярусы: цель не меньше ранней, награда мета-кристаллами выше.
      const late = createCampaignChallenge(seedForKind(kind, 20), 20)
      expect(late.kind).toBe(kind)
      expect(late.targetValue).toBeGreaterThanOrEqual(a.targetValue)
      expect(late.rewardMeta).toBe(2)
    }
  })

  it("power_hunter: считает бонусы и завершается ровно один раз", () => {
    const active = makeChallenge("power_hunter", 3)
    const onWin = vi.fn()
    recordChallengePower(active, onWin)
    recordChallengePower(active, onWin)
    expect(active.progress).toBe(2)
    expect(active.completed).toBe(false)
    recordChallengePower(active, onWin)
    expect(active.completed).toBe(true)
    expect(onWin).toHaveBeenCalledTimes(1)
    // Дальнейший прогресс награду не дублирует.
    recordChallengePower(active, onWin)
    expect(onWin).toHaveBeenCalledTimes(1)
    // Чужой вид счётчик не трогает.
    const crit = makeChallenge("crit_hunter", 2)
    recordChallengePower(crit)
    expect(crit.progress).toBe(0)
  })

  it("chain_master: одна цепная детонация — один шаг", () => {
    const active = makeChallenge("chain_master", 2)
    const onWin = vi.fn()
    recordChallengeChain(active, onWin)
    expect(active.progress).toBe(1)
    expect(active.completed).toBe(false)
    recordChallengeChain(active, onWin)
    expect(active.completed).toBe(true)
    expect(onWin).toHaveBeenCalledTimes(1)
  })

  it("armor_breaker: копит снятые единицы брони, мусорные значения игнорирует", () => {
    const active = makeChallenge("armor_breaker", 4)
    const onWin = vi.fn()
    recordChallengeArmor(active, 3, onWin)
    expect(active.progress).toBe(3)
    expect(active.completed).toBe(false)
    recordChallengeArmor(active, 0, onWin)
    recordChallengeArmor(active, -2, onWin)
    recordChallengeArmor(active, Number.NaN, onWin)
    expect(active.progress).toBe(3)
    recordChallengeArmor(active, 1, onWin)
    expect(active.progress).toBe(4)
    expect(active.completed).toBe(true)
    expect(onWin).toHaveBeenCalledTimes(1)
  })

  it("потеря шара не проваливает счётные виды и по-прежнему проваливает flawless", () => {
    for (const kind of ["power_hunter", "chain_master", "armor_breaker", "crit_hunter"] as const) {
      const active = makeChallenge(kind, 3)
      const onFail = vi.fn()
      recordChallengeBallLost(active, onFail)
      expect(active.failed).toBe(false)
      expect(onFail).not.toHaveBeenCalled()
    }
    const flawless = makeChallenge("flawless", 1)
    recordChallengeBallLost(flawless)
    expect(flawless.failed).toBe(true)
    expect(isCollectiveChallenge("flawless")).toBe(false)
    expect(isCollectiveChallenge("power_hunter")).toBe(true)
  })

  it("HUD показывает прогресс новых видов, таймер их не двигает", () => {
    const power = makeChallenge("power_hunter", 4)
    power.progress = 1
    expect(formatChallengeHud(power).statusText).toBe("🎁 1 / 4")
    const chain = makeChallenge("chain_master", 5)
    chain.progress = 2
    expect(formatChallengeHud(chain).statusText).toBe("💥 2 / 5")
    const armor = makeChallenge("armor_breaker", 6)
    armor.progress = 3
    const hud = formatChallengeHud(armor)
    expect(hud.statusText).toBe("🛡 3 / 6")
    expect(hud.progressRatio).toBeCloseTo(0.5)
    updateActiveChallenge(armor, 30, { onSurviveWin: vi.fn(), onTimeExpired: vi.fn() })
    expect(armor.progress).toBe(3)
  })

  it("старые виды ведут себя как раньше: таймеры и криты", () => {
    const speed = makeChallenge("speed_clear", 5)
    const expired = vi.fn()
    updateActiveChallenge(speed, 6, { onSurviveWin: vi.fn(), onTimeExpired: expired })
    expect(speed.failed).toBe(true)
    expect(expired).toHaveBeenCalledTimes(1)

    const crit = makeChallenge("crit_hunter", 2)
    recordChallengeCrit(crit)
    recordChallengeCrit(crit)
    expect(crit.completed).toBe(true)
  })
})

describe("T-053: хуки движка питают новые виды", () => {
  /** Мир бонусов: ракетка в точке бонуса, оба источника дропа заглушены таймерами. */
  function makePowersWorld(picked: string[]): PowersWorld {
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
      skyDropTimer: 1e9,
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
      onPowerPicked: (t: PowerType) => picked.push(t),
    } as unknown as PowersWorld
  }

  it("подбор бонуса сообщается хосту до применения эффекта", () => {
    const picked: string[] = []
    const world = makePowersWorld(picked)
    world.powers = [{ x: 400, y: 560, vy: 0, type: "wide", t: 0 }]
    new PowersSystem(world).updatePowers(0.016)
    expect(picked).toEqual(["wide"])
    expect(world.wideUntil).toBeGreaterThan(0) // эффект всё равно применён
  })

  /** Мир физики с переданными блоками и счётчиками хуков. */
  function makePhysicsWorld(
    blocks: Block[],
    hooks: { armor: number[]; chains: number[] }
  ): PhysicsWorld {
    return {
      w: 400,
      h: 600,
      time: 0,
      paddle: { x: 200, y: 560, w: 90, h: 14 },
      blocksInitial: blocks.length,
      boss: null,
      input: { keys: { left: false, right: false }, pointerX: null, locked: false },
      balls: [],
      blocks,
      powers: [],
      boomQueue: [],
      sparkQueue: [],
      shield: 0,
      combo: 0,
      shake: 0,
      hitStop: 0,
      flash: 0,
      fx: { burst() {}, rings: [], popups: [], particles: [] },
      sfx: { brick() {}, destroy() {}, levelClear() {} },
      fireActive: () => false,
      frostActive: () => false,
      sparkActive: () => false,
      pierceActive: () => false,
      explosiveActive: () => false,
      bigActive: () => false,
      slowActive: () => false,
      fastActive: () => false,
      magnetActive: () => false,
      wideActive: () => false,
      shrinkActive: () => false,
      paddleShape: () => "flat",
      paddleRotatable: () => false,
      addScore() {},
      dropPower() {},
      damageBoss() {},
      damageMiniboss() {},
      onBombHitPaddle() {},
      pushHud() {},
      debugBallDamage: 1,
      onArmorBroken: (n: number) => hooks.armor.push(n),
      onChainDetonation: (n: number) => hooks.chains.push(n),
    } as unknown as PhysicsWorld
  }

  it("снятая броня сообщается по фактически поглощённым единицам", () => {
    const hooks = { armor: [] as number[], chains: [] as number[] }
    const armored = makeBlock({ x: 200, y: 200, hp: 3, maxHp: 3, sp: { armor: 2, armorMax: 2 } })
    const physics = new Physics(makePhysicsWorld([armored], hooks))

    physics.damageBlock(armored, 1)
    expect(armored.sp!.armor).toBe(1)
    expect(hooks.armor).toEqual([1])
    // Второй удар снимает последнюю броню — хук сообщает ещё одну единицу.
    physics.damageBlock(armored, 1)
    expect(armored.sp!.armor).toBe(0)
    expect(hooks.armor).toEqual([1, 1])
    // Брони больше нет: урон идёт в HP, хука нет.
    const hpBefore = armored.hp
    physics.damageBlock(armored, 1)
    expect(armored.hp).toBe(hpBefore - 1)
    expect(hooks.armor).toEqual([1, 1])
  })

  it("цепной каскад даёт ровно один вызов хука, рекурсия его не повторяет", () => {
    const hooks = { armor: [] as number[], chains: [] as number[] }
    const brittle = makeBlock({
      x: 200,
      y: 100,
      hp: 1,
      maxHp: 1,
      sp: { brittle: { radius: 100, damage: 1 } },
    })
    const neighbour = makeBlock({
      x: 240,
      y: 100,
      hp: 1,
      maxHp: 1,
      sp: { brittle: { radius: 100, damage: 1 } },
    })
    const physics = new Physics(makePhysicsWorld([brittle, neighbour], hooks))

    physics.damageBlock(brittle, 1)
    expect(brittle.dead).toBe(true)
    expect(neighbour.dead).toBe(true)
    expect(hooks.chains).toEqual([1]) // сосед взорвался рекурсивно, но хук молчит
  })

  it("разрушение без цепных соседей хук не вызывает", () => {
    const hooks = { armor: [] as number[], chains: [] as number[] }
    const lone = makeBlock({
      x: 200,
      y: 100,
      hp: 1,
      maxHp: 1,
      sp: { brittle: { radius: 10, damage: 1 } },
    })
    new Physics(makePhysicsWorld([lone], hooks)).damageBlock(lone, 1)
    expect(hooks.chains).toEqual([])
  })
})
