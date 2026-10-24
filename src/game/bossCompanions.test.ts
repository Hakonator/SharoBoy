import { describe, expect, it } from "vitest"

import type { BossHost } from "./boss"
import type { Block } from "./types"
import {
  CRYO_TURBINE_SEGS,
  ICE_BARRIER_EVERY,
  ICE_BLOOM_TIME,
  ICE_STOP_FRAC,
  buildCryoDrone,
  cryoTurbinesAlive,
  iceUnitsLeft,
  stepCryoDrone,
  updateCryoTurbines,
} from "./bossCryo"
import {
  LAMPREY_BOLT_EVERY,
  LAMPREY_GUARD_SEGMENTS,
  LAMPREY_SEGMENTS,
  buildLamprey,
  lampreyHeadAlive,
  lampreyHeadExposed,
  lampreySegments,
  lampreyTailAlive,
  stepLamprey,
} from "./bossLamprey"

/** Минимальный хост: босс-логике нужны только поле, ракетка, fx и sfx. */
function makeHost(over: Partial<BossHost> = {}): BossHost {
  const calls: string[] = []
  const host = {
    w: 800,
    h: 600,
    blockTop: 40,
    time: 0,
    shake: 0,
    hitStop: 0,
    flash: 0,
    blocks: [] as Block[],
    powers: [],
    boomQueue: [],
    paddle: { x: 400, y: 560, w: 160, h: 18, rot: 0 },
    fx: {
      burst: () => calls.push("burst"),
      rings: [],
      lightnings: [],
      popups: [],
    },
    sfx: {
      brick: () => {},
      freeze: () => calls.push("freeze"),
      thud: () => calls.push("thud"),
      zap: () => calls.push("zap"),
      bossPhase: () => {},
    },
    addRawScore: () => {},
    onBossKilled: () => {},
    pushHud: () => {},
    killBoss: () => calls.push("kill"),
    ...over,
  } as unknown as BossHost
  return host
}

describe("Крио-Дрон Утилизатор: сборка арены", () => {
  it("создаёт корпус и по два сегмента турбин на борт", () => {
    const { boss, blocks } = buildCryoDrone(800, 600, 60)
    expect(boss.isCryo).toBe(true)
    expect(boss.hp).toBe(60)
    expect(blocks.length).toBe(CRYO_TURBINE_SEGS * 2)
    expect(blocks.every((b) => b.isCryoPart)).toBe(true)
    expect(blocks.filter((b) => b.cryoSide === "left").length).toBe(CRYO_TURBINE_SEGS)
    // тарелки (seg 1) — по одной на борт
    expect(cryoTurbinesAlive(blocks)).toBe(2)
  })

  it("турбины покачиваются со временем, а при потере тарелки защита падает", () => {
    const { boss, blocks } = buildCryoDrone(800, 600, 60)
    const disk = blocks.find((b) => b.cryoSeg === 1)!
    const x0 = disk.x
    boss.t = 1.7
    updateCryoTurbines(boss, blocks)
    expect(disk.x).not.toBe(x0)
    expect(boss.cryoScroll).toBeGreaterThan(0)

    blocks.filter((b) => b.cryoSeg === 1)[0].dead = true
    expect(cryoTurbinesAlive(blocks)).toBe(1)
  })
})

describe("Крио-Дрон Утилизатор: ледяные преграды", () => {
  it("сбрасывает капсулу по таймеру и раскрывает её в столб из трёх единиц", () => {
    const { boss, blocks } = buildCryoDrone(800, 600, 60)
    const host = makeHost({ blocks })
    // ракетка левее центра — столб ставится под ней, а не по центру арены
    host.paddle.x = 320

    boss.cryoIceTimer = 0.01
    stepCryoDrone(host, boss, false, 0.02)
    const capsule = host.blocks.find((b) => b.isIceCapsule)
    expect(capsule).toBeDefined()
    expect(boss.cryoIceTimer).toBeCloseTo(ICE_BARRIER_EVERY, 5)

    // капсула долетает и раскрывается: единицы льда вместо неё
    for (let i = 0; i < 8; i++) stepCryoDrone(host, boss, false, ICE_BLOOM_TIME / 4)
    expect(host.blocks.some((b) => b.isIceCapsule)).toBe(false)
    expect(iceUnitsLeft(host.blocks)).toBe(3)
    const ice = host.blocks.filter((b) => b.isIceColumn)
    expect(ice.every((b) => b.frozen)).toBe(true)
    expect(ice.map((b) => b.iceSeg).sort()).toEqual([0, 1, 2])
    // единицы одного столба делят iceId
    expect(new Set(ice.map((b) => b.iceId)).size).toBe(1)
  })

  it("в «злой» фазе сбрасывает две капсулы, а на низком HP вообще не ставит лёд", () => {
    const { boss, blocks } = buildCryoDrone(800, 600, 100)
    const host = makeHost({ blocks })

    boss.cryoIceTimer = 0.01
    stepCryoDrone(host, boss, true, 0.02)
    expect(host.blocks.filter((b) => b.isIceCapsule).length).toBe(2)

    // ниже порога ICE_STOP_FRAC барьеры больше не появляются
    const weak = buildCryoDrone(800, 600, 100)
    const weakHost = makeHost({ blocks: weak.blocks })
    weak.boss.hp = weak.boss.maxHp * ICE_STOP_FRAC - 1
    weak.boss.cryoIceTimer = 0.01
    stepCryoDrone(weakHost, weak.boss, true, 0.02)
    expect(weakHost.blocks.some((b) => b.isIceCapsule)).toBe(false)
  })
})

describe("Глубинная Электрическая Минога: тело по периметру", () => {
  it("создаёт цепочку сегментов, голова — первый сегмент", () => {
    const { boss, blocks } = buildLamprey(800, 600, 40, 70)
    expect(boss.isLamprey).toBe(true)
    expect(boss.hp).toBe(70)
    expect(blocks.length).toBe(LAMPREY_SEGMENTS)
    expect(blocks.filter((b) => b.isLampreySeg).length).toBe(LAMPREY_SEGMENTS)
    const head = blocks.find((b) => b.lampreySeg === 0)!
    expect(boss.x).toBeCloseTo(head.x, 6)
    expect(boss.y).toBeCloseTo(head.y, 6)
    // радиусы убывают к хвосту
    const radii = blocks.map((b) => b.rx)
    expect(radii[0]).toBeGreaterThan(radii[radii.length - 1])
  })

  it("геометрия сегментов едина: lampreySegments даёт те же точки, что и stepLamprey", () => {
    const { boss, blocks } = buildLamprey(800, 600, 40, 70)
    const host = makeHost({ blocks })
    boss.t = 1
    stepLamprey(host, boss, false, 0.5)
    const pts = lampreySegments(800, 600, 40, boss.lampreyAng!)
    for (const b of blocks) {
      const p = pts[b.lampreySeg!]
      expect(b.x).toBeCloseTo(p.x, 6)
      expect(b.y).toBeCloseTo(p.y, 6)
    }
    // голова следует за сегментом 0
    expect(boss.x).toBeCloseTo(blocks[0].x, 6)
    expect(boss.y).toBeCloseTo(blocks[0].y, 6)
  })

  it("голова открыта для урона только после LAMPREY_GUARD_SEGMENTS уничтоженных сегментов", () => {
    const { blocks } = buildLamprey(800, 600, 40, 70)
    expect(lampreyHeadExposed(blocks)).toBe(false)
    expect(lampreyTailAlive(blocks)).toBe(LAMPREY_SEGMENTS - 1)
    const tail = blocks.filter((b) => (b.lampreySeg ?? 0) > 0)
    for (let i = 0; i < LAMPREY_GUARD_SEGMENTS - 1; i++) tail[i].dead = true
    expect(lampreyHeadExposed(blocks)).toBe(false)
    tail[LAMPREY_GUARD_SEGMENTS - 1].dead = true
    expect(lampreyHeadExposed(blocks)).toBe(true)
  })

  it("бьёт разрядом в ракетку по таймеру и телеграфирует искрами заранее", () => {
    const { boss, blocks } = buildLamprey(800, 600, 40, 70)
    const host = makeHost({ blocks })
    // телеграф: до выстрела остаётся меньше LAMPREY_BOLT_CHARGE
    boss.lampreyBoltTimer = 0.4
    stepLamprey(host, boss, false, 0.05)
    expect(boss.lampreyCharge).toBeGreaterThan(0)

    boss.lampreyBoltTimer = 0.01
    stepLamprey(host, boss, false, 0.05)
    const bolt = host.blocks.find((b) => b.lampreyBolt)
    expect(bolt).toBeDefined()
    expect(bolt!.hitsPaddle).toBe(true)
    // снаряд видимый: свой признак отрисовки, не молния медузы
    expect(bolt!.bolt).toBeFalsy()
    expect(boss.lampreyBoltTimer).toBeCloseTo(LAMPREY_BOLT_EVERY, 5)
    expect(boss.lampreyCharge).toBe(0)
  })

  it("после потери головы не двигается и не стреляет, а затем отращивает голову", () => {
    const { boss, blocks } = buildLamprey(800, 600, 40, 70)
    const host = makeHost({ blocks })
    // открываем голову и разбиваем её
    const tail = blocks.filter((b) => (b.lampreySeg ?? 0) > 0)
    for (let i = 0; i < LAMPREY_GUARD_SEGMENTS; i++) tail[i].dead = true
    const head = blocks.find((b) => b.lampreySeg === 0)!
    head.dead = true
    blocks.splice(blocks.indexOf(head), 1)
    expect(lampreyHeadAlive(blocks)).toBe(false)

    // без головы минога мертва: разрядов нет, тело не скользит по периметру
    boss.lampreyBoltTimer = 0.01
    stepLamprey(host, boss, false, 0.5)
    expect(host.blocks.some((b) => b.lampreyBolt)).toBe(false)
    // сегменты остались на прежних местах — волна не пересчитана на новом угле
    const pts = lampreySegments(800, 600, 40, boss.lampreyAng!)
    const standingStill = blocks.some((b) => {
      const p = pts[b.lampreySeg!]
      return Math.hypot(b.x - p.x, b.y - p.y) > 0.001
    })
    expect(standingStill).toBe(true)
    expect(boss.lampreyHeadDown).toBe(true)

    // ГОЛОВА — смертельная точка: снос головы сразу убивает босса и никакого
    // «возвращения» через HEAD_REGEN_TIME больше нет (иначе игрок видел
    // воскрешение и считал босса неубиваемым).
    expect(host.blocks.some((b) => b.lampreySeg === 0)).toBe(false)
    stepLamprey(host, boss, false, 30)
    expect(host.blocks.some((b) => b.lampreySeg === 0)).toBe(false)
    expect(lampreyHeadAlive(host.blocks)).toBe(false)
  })
})
