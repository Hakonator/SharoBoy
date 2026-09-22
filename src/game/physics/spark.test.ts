import { describe, expect, it, vi } from "vitest"

import { Physics, type PhysicsWorld } from "../physics"
import type { Ball, Block } from "../types"

import {
  SPARK_CHAIN_DELAY,
  SPARK_CHAIN_MAX,
  SPARK_CHAIN_RADIUS,
  queueSparkChain,
  sparkChainTargets,
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
