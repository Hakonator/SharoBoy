import { describe, expect, it, vi } from "vitest"

import { Physics, type PhysicsWorld } from "../physics"
import type { Ball, Block } from "../types"

import {
  SPARK_AURA_COOLDOWN,
  SPARK_AURA_RADIUS_RATIO,
  SPARK_CHAIN_DELAY,
  SPARK_CHAIN_MAX,
  SPARK_CHAIN_RADIUS,
  distanceToBlockSurface,
  queueSparkChain,
  sparkChainTargets,
  updateSparkAura,
  type SparkAuraWorld,
} from "./spark"

/** Эллипс-блок по образцу physics.test.ts. */
function makeBlock(over: Partial<Block> = {}): Block {
  return {
    x: 200,
    y: 100,
    rx: 30,
    ry: 16,
    rot: 0,
    circle: false,
    hp: 2,
    maxHp: 2,
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

describe("sparkChainTargets", () => {
  it("константы цепи: радиус 95, максимум 4 звена, задержка 0.07 с", () => {
    expect(SPARK_CHAIN_RADIUS).toBe(95)
    expect(SPARK_CHAIN_MAX).toBe(4)
    expect(SPARK_CHAIN_DELAY).toBeCloseTo(0.07)
  })

  it("выбирает ближайшие блоки последовательно, начиная от точки удара", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const near = makeBlock({ x: 240, y: 105 })
    const mid = makeBlock({ x: 280, y: 110 })
    const chain = sparkChainTargets([mid, near, hit], hit, { exclude: hit })
    expect(chain).toEqual([near, mid]) // от удара — к ближайшему, затем к следующему
  })

  it("блоки вне радиуса прыжка и мёртвые не участвуют", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const far = makeBlock({ x: 400, y: 300 })
    const dead = makeBlock({ x: 220, y: 105, dead: true })
    expect(sparkChainTargets([far, dead], hit)).toEqual([])
  })

  it("цепь ограничена максимумом звеньев", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const blocks: Block[] = [hit]
    for (let i = 0; i < 8; i++) blocks.push(makeBlock({ x: 200 + (i + 1) * 40, y: 100 }))
    expect(sparkChainTargets(blocks, hit, { exclude: hit })).toHaveLength(SPARK_CHAIN_MAX)
  })

  it("кастомный максимум сужает цепь, блок удара не бьётся дважды", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const a = makeBlock({ x: 240, y: 100 })
    const b = makeBlock({ x: 280, y: 100 })
    expect(sparkChainTargets([a, b, hit], hit, { max: 1, exclude: hit })).toEqual([a])
  })
})

describe("queueSparkChain", () => {
  it("каждое звено бьёт позже предыдущего, from — предыдущее звено цепи", () => {
    const queue: { block: Block; from: { x: number; y: number }; at: number }[] = []
    const a = makeBlock({ x: 240, y: 100 })
    const b = makeBlock({ x: 280, y: 100 })
    queueSparkChain(queue, [a, b], { x: 200, y: 100 }, 10)
    expect(queue).toHaveLength(2)
    expect(queue[0].block).toBe(a)
    expect(queue[0].from).toEqual({ x: 200, y: 100 })
    expect(queue[0].at).toBeCloseTo(10 + SPARK_CHAIN_DELAY)
    expect(queue[1].block).toBe(b)
    expect(queue[1].from).toEqual({ x: 240, y: 100 }) // от первого звена
    expect(queue[1].at).toBeCloseTo(10 + 2 * SPARK_CHAIN_DELAY)
  })
})

/** Фейковый мир по образцу physics.test.ts — шар летит вверх в блок. */
function makeWorld(blocks: Block[], spark: boolean) {
  const world = {
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
    sparkQueue: [] as { block: Block; from: { x: number; y: number }; at: number }[],
    shield: 0,
    combo: 0,
    shake: 0,
    hitStop: 0,
    flash: 0,
    fx: { burst() {}, particles: [], rings: [], popups: [] },
    sfx: {
      wall() {},
      burn() {},
      brick() {},
      destroy: vi.fn(),
      iceShatter: vi.fn(),
      levelClear: vi.fn(),
    },
    fireActive: () => false,
    frostActive: () => false,
    sparkActive: () => spark,
    pierceActive: () => false,
    explosiveActive: () => false,
    bigActive: () => false,
    slowActive: () => false,
    fastActive: () => false,
    magnetActive: () => false,
    wideActive: () => false,
    shrinkActive: () => false,
    paddleShape: () => "flat" as const,
    paddleRotatable: () => false,
    addScore: () => {},
    dropPower() {},
    damageBoss() {},
    damageMiniboss() {},
    onBombHitPaddle() {},
    pushHud() {},
    debugBallDamage: 1,
  } as unknown as PhysicsWorld
  const ball: Ball = {
    x: 200,
    y: 150,
    vx: 0,
    vy: -300,
    r: 8,
    speed: 300,
    stuck: false,
    stuckOffset: 0,
    trail: [],
    squash: 0,
    sinceHit: 10,
  }
  return { world, ball }
}

describe("электрошар — удар о блок", () => {
  it("наносит обычный урон и ставит цепь искр в очередь", () => {
    const hit = makeBlock({ x: 200, y: 100, hp: 999, maxHp: 999 })
    const near = makeBlock({ x: 250, y: 110, hp: 999, maxHp: 999 })
    const { world, ball } = makeWorld([hit, near], true)
    const physics = new Physics(world)
    for (let i = 0; i < 12; i++) physics.updateBall(ball, 0.016)
    // обычный урон прямого попадания (без разрушения — hp=999)
    expect(999 - hit.hp).toBeGreaterThanOrEqual(1)
    expect(hit.dead).toBe(false)
    // цепь: звено в близкий блок, мяч отскочил
    const link = world.sparkQueue.find((q) => q.block === near)
    expect(link).toBeDefined()
    expect(link!.from.x).toBeCloseTo(200, 0)
    expect(link!.at).toBeGreaterThan(0)
    expect(ball.vy).toBeGreaterThan(0)
  })

  it("без электрошара очередь искр не заполняется", () => {
    const hit = makeBlock({ x: 200, y: 100, hp: 999, maxHp: 999 })
    const { world, ball } = makeWorld([hit], false)
    const physics = new Physics(world)
    for (let i = 0; i < 12; i++) physics.updateBall(ball, 0.016)
    expect(world.sparkQueue).toHaveLength(0)
  })

  it("звено цепи добивает блок с 1 hp обычным уроном (как в updateStep)", () => {
    const target = makeBlock({ x: 250, y: 110, hp: 1 })
    const { world } = makeWorld([target], true)
    // как strikeSpark: молния уже отрисована, урон — обычный
    new Physics(world).damageBlock(target, 1)
    expect(target.dead).toBe(true)
  })
})

describe("distanceToBlockSurface", () => {
  it("круг: вычисляет точное расстояние до поверхности и 0 при перекрытии", () => {
    const b = makeBlock({ x: 200, y: 100, rx: 20, ry: 20, circle: true })
    const ballFar = { x: 200, y: 150, r: 8 }
    // центр-центр = 50, rx = 20, r = 8 -> 50 - 20 - 8 = 22
    expect(distanceToBlockSurface(ballFar, b)).toBeCloseTo(22)

    const ballTouch = { x: 200, y: 128, r: 8 }
    // 28 - 20 - 8 = 0
    expect(distanceToBlockSurface(ballTouch, b)).toBeCloseTo(0)

    const ballInside = { x: 200, y: 110, r: 8 }
    expect(distanceToBlockSurface(ballInside, b)).toBe(0)
  })

  it("прямоугольник: вычисляет расстояние по нормали и от угла", () => {
    const b = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", rot: 0, circle: false })
    // строго снизу: dy = 40, ry = 15, r = 8 -> 40 - 15 - 8 = 17
    expect(distanceToBlockSurface({ x: 200, y: 140, r: 8 }, b)).toBeCloseTo(17)

    // строго справа: dx = 50, rx = 30, r = 8 -> 50 - 30 - 8 = 12
    expect(distanceToBlockSurface({ x: 250, y: 100, r: 8 }, b)).toBeCloseTo(12)

    // от угла (230, 115): точка шара (236, 123) -> d_corner = hypot(6, 8) = 10 -> 10 - 8 = 2
    expect(distanceToBlockSurface({ x: 236, y: 123, r: 8 }, b)).toBeCloseTo(2)

    // перекрытие
    expect(distanceToBlockSurface({ x: 200, y: 100, r: 8 }, b)).toBe(0)
  })

  it("скруглённый прямоугольник: учитывает скругление углов", () => {
    const b = makeBlock({
      x: 200,
      y: 100,
      rx: 30,
      ry: 16,
      shape: "round_rect",
      rot: 0,
      circle: false,
    })
    // снизу по центру: скругление не влияет на плоскую грань
    // dy = 40, ry = 16, r = 8 -> 40 - 16 - 8 = 16
    expect(distanceToBlockSurface({ x: 200, y: 140, r: 8 }, b)).toBeCloseTo(16)
  })

  it("повёрнутый эллипс: корректно проецирует в локальную систему координат", () => {
    // поворот на 90 градусов (Math.PI / 2): большая полуось rx=30 направлена по Y, ry=16 по X
    const b = makeBlock({
      x: 200,
      y: 100,
      rx: 30,
      ry: 16,
      rot: Math.PI / 2,
      circle: false,
      shape: "ellipse",
    })
    // шар снизу на (200, 150): расстояние от центра вдоль оси Y равно 50
    // так как rx=30 направлена по оси Y, край эллипса находится на Y = 130
    // расстояние между поверхностями: 50 - 30 - 8 = 12
    expect(distanceToBlockSurface({ x: 200, y: 150, r: 8 }, b)).toBeCloseTo(12, 1)
  })
})

function makeAuraWorld(options: {
  sparkActive?: boolean
  sparkAuraLevel?: number
  ball?: Partial<Ball>
  blocks?: Block[]
  time?: number
}) {
  const lightnings: { x1: number; y1: number; x2: number; y2: number; t: number }[] = []
  const bursts: { x: number; y: number; color: string; count: number; speed: number }[] = []
  const zaps: (number | undefined)[] = []
  const damaged: { block: Block; dmg: number }[] = []

  const ball: Ball = {
    x: 200,
    y: 135,
    vx: 0,
    vy: -300,
    r: 8,
    speed: 300,
    stuck: false,
    stuckOffset: 0,
    trail: [],
    squash: 0,
    sinceHit: 10,
    ...options.ball,
  }

  const world: SparkAuraWorld = {
    time: options.time ?? 1.0,
    sparkUntil: (options.sparkActive ?? true) ? 10 : 0,
    sparkActive: () => options.sparkActive ?? true,
    upgrades: {
      sparkAura: options.sparkAuraLevel ?? 1,
    },
    balls: [ball],
    blocks: options.blocks ?? [],
    w: 400,
    fx: {
      lightnings,
      burst: (x, y, color, count, speed) => bursts.push({ x, y, color, count, speed }),
    },
    sfx: {
      zap: (pan) => zaps.push(pan),
    },
    physics: {
      damageBlock: (b, dmg = 1) => {
        damaged.push({ block: b, dmg })
        b.hp -= dmg
        if (b.hp <= 0) b.dead = true
      },
    },
  }

  return { world, ball, lightnings, bursts, zaps, damaged }
}

describe("updateSparkAura", () => {
  it("константы грозового ореола: радиус 4 * r (2 диаметра) и кулдаун 0.35 с", () => {
    expect(SPARK_AURA_RADIUS_RATIO).toBe(4)
    expect(SPARK_AURA_COOLDOWN).toBe(0.35)
  })

  it("поражает блок молнией в пределах 2 диаметров шара при активном грозовом ореоле", () => {
    // блок: rect 30x15 в (200, 100), шар r=8 в (200, 135) -> dist = 35 - 15 - 8 = 12 <= 32 (4 * 8)
    const block = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", hp: 3 })
    const { world, lightnings, bursts, zaps, damaged } = makeAuraWorld({
      blocks: [block],
      time: 1.0,
    })

    updateSparkAura(world)

    expect(lightnings).toHaveLength(1)
    expect(lightnings[0]).toEqual({ x1: 200, y1: 135, x2: 200, y2: 100, t: 0 })
    expect(bursts).toHaveLength(1)
    expect(bursts[0]).toEqual({ x: 200, y: 100, color: "#ffe95c", count: 4, speed: 120 })
    expect(zaps).toHaveLength(1)
    expect(zaps[0]).toBeCloseTo(0) // по центру экрана (200 / 400 * 2 - 1 = 0)
    expect(damaged).toHaveLength(1)
    expect(damaged[0].dmg).toBe(1)
    expect(block.hp).toBe(2)
    expect(block.sparkAuraAt).toBe(1.0)
  })

  it("не поражает блок за пределами радиуса 2 диаметров шара", () => {
    // шар в (200, 170): dist = 70 - 15 - 8 = 47 > 32
    const block = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", hp: 3 })
    const { world, lightnings, damaged } = makeAuraWorld({
      ball: { y: 170 },
      blocks: [block],
      time: 1.0,
    })

    updateSparkAura(world)

    expect(lightnings).toHaveLength(0)
    expect(damaged).toHaveLength(0)
    expect(block.hp).toBe(3)
    expect(block.sparkAuraAt).toBeUndefined()
  })

  it("соблюдает кулдаун 0.35 с между разрядами по одному блоку", () => {
    const block = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", hp: 5 })
    const { world, damaged } = makeAuraWorld({
      blocks: [block],
      time: 1.0,
    })

    // 1-й кадр: попадание
    updateSparkAura(world)
    expect(damaged).toHaveLength(1)

    // 2-й кадр через 0.15 с: кулдаун ещё активен
    ;(world as { time: number }).time = 1.15
    updateSparkAura(world)
    expect(damaged).toHaveLength(1)

    // 3-й кадр через 0.36 с: кулдаун истёк, повторный разряд
    ;(world as { time: number }).time = 1.36
    updateSparkAura(world)
    expect(damaged).toHaveLength(2)
    expect(block.hp).toBe(3)
    expect(block.sparkAuraAt).toBe(1.36)
  })

  it("не срабатывает, если улучшение sparkAura не куплено (lvl = 0)", () => {
    const block = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", hp: 3 })
    const { world, lightnings, damaged } = makeAuraWorld({
      sparkAuraLevel: 0,
      blocks: [block],
      time: 1.0,
    })

    updateSparkAura(world)

    expect(lightnings).toHaveLength(0)
    expect(damaged).toHaveLength(0)
  })

  it("не срабатывает, если электрошар не активен", () => {
    const block = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", hp: 3 })
    const { world, lightnings, damaged } = makeAuraWorld({
      sparkActive: false,
      blocks: [block],
      time: 1.0,
    })

    updateSparkAura(world)

    expect(lightnings).toHaveLength(0)
    expect(damaged).toHaveLength(0)
  })

  it("не срабатывает для застрявшего шара на ракетке (stuck) или потерянного (lost)", () => {
    const block = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", hp: 3 })
    const stuckWorld = makeAuraWorld({
      ball: { stuck: true },
      blocks: [block],
      time: 1.0,
    })
    updateSparkAura(stuckWorld.world)
    expect(stuckWorld.lightnings).toHaveLength(0)

    const lostWorld = makeAuraWorld({
      ball: { lost: true },
      blocks: [block],
      time: 1.0,
    })
    updateSparkAura(lostWorld.world)
    expect(lostWorld.lightnings).toHaveLength(0)
  })

  it("не бьёт мёртвые блоки или блоки в нематериальной фазе", () => {
    const deadBlock = makeBlock({ x: 200, y: 100, rx: 30, ry: 15, shape: "rect", dead: true })
    const phaseBlock = makeBlock({
      x: 200,
      y: 100,
      rx: 30,
      ry: 15,
      shape: "rect",
      sp: { phase: { period: 2, active: 0.5, offset: 0 } },
    })
    // при time = 1.5 norm / period = 1.5 / 2 = 0.75 >= active (0.5) -> нематериален
    const { world, lightnings } = makeAuraWorld({
      blocks: [deadBlock, phaseBlock],
      time: 1.5,
    })

    updateSparkAura(world)

    expect(lightnings).toHaveLength(0)
  })
})
