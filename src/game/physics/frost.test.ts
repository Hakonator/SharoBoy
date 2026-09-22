import { describe, expect, it, vi } from "vitest"

import { Physics, type PhysicsWorld } from "../physics"
import type { Ball, Block } from "../types"

import { damageBlock } from "./destruction"
import { FROST_FREEZE_RADIUS, freezeCluster } from "./frost"

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

describe("freezeCluster", () => {
  it("константа радиуса — 72 мировых единицы", () => {
    expect(FROST_FREEZE_RADIUS).toBe(72)
  })

  it("замораживает блок удара и соседей в радиусе, hp = 1", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const near = makeBlock({ x: 240, y: 110 })
    const far = makeBlock({ x: 320, y: 200 })
    const frozen = freezeCluster([hit, near, far], hit)
    expect(frozen).toContain(hit)
    expect(frozen).toContain(near)
    expect(frozen).not.toContain(far)
    for (const b of [hit, near]) {
      expect(b.frozen).toBe(true)
      expect(b.hp).toBe(1) // колется с одного удара
    }
    expect(far.frozen).toBeFalsy()
  })

  it("бомбы и блоки минибоссов не замораживаются", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const bomb = makeBlock({ x: 210, y: 105, bomb: true })
    const mini = makeBlock({ x: 220, y: 110, isMiniboss: true })
    const frozen = freezeCluster([hit, bomb, mini], hit)
    expect(frozen).toEqual([hit])
    expect(bomb.frozen).toBeFalsy()
    expect(mini.frozen).toBeFalsy()
  })

  it("уже замороженные блоки не трогаются повторно", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const already = makeBlock({ x: 210, y: 105, frozen: true, hp: 1 })
    const frozen = freezeCluster([hit, already], hit)
    expect(frozen).toEqual([hit])
    expect(already.frozen).toBe(true)
  })

  it("кастомный радиус сужает зону", () => {
    const hit = makeBlock({ x: 200, y: 100 })
    const mid = makeBlock({ x: 260, y: 100 }) // дистанция 60
    freezeCluster([hit, mid], hit, 50)
    expect(mid.frozen).toBeFalsy()
    freezeCluster([mid], mid, 50)
    expect(mid.frozen).toBe(true) // блок удара замораживается всегда
  })
})

/** Фейковый мир по образцу physics.test.ts — шар летит вверх в блок. */
function makeWorld(blocks: Block[], frost: boolean) {
  const sfx = { freeze: vi.fn(), iceShatter: vi.fn(), destroy: vi.fn(), brick: vi.fn() }
  const fx = {
    burst: vi.fn(),
    iceShatter: vi.fn(),
    particles: [],
    rings: [] as { maxR: number }[],
    popups: [],
  }
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
    shield: 0,
    combo: 0,
    shake: 0,
    hitStop: 0,
    flash: 0,
    fx,
    sfx,
    fireActive: () => false,
    frostActive: () => frost,
    sparkActive: () => false,
    sparkQueue: [],
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
  return { world: world as PhysicsWorld, ball, sfx, fx }
}

describe("морозный мяч — удар о блок", () => {
  it("замораживает блок вместо урона и отскакивает", () => {
    const block = makeBlock({ x: 200, y: 100, hp: 2, maxHp: 2 })
    const { world, ball, sfx } = makeWorld([block], true)
    const physics = new Physics(world)
    for (let i = 0; i < 12; i++) physics.updateBall(ball, 0.016)
    expect(block.frozen).toBe(true)
    expect(block.hp).toBe(1) // не разбился — только заморожен
    expect(block.dead).toBe(false)
    expect(sfx.freeze).toHaveBeenCalled()
    expect(sfx.iceShatter).not.toHaveBeenCalled()
    expect(ball.vy).toBeGreaterThan(0) // отскок вниз
  })

  it("без мороза удар наносит обычный урон", () => {
    const block = makeBlock({ x: 200, y: 100, hp: 2, maxHp: 2 })
    const { world, ball, sfx } = makeWorld([block], false)
    const physics = new Physics(world)
    for (let i = 0; i < 12; i++) physics.updateBall(ball, 0.016)
    expect(block.frozen).toBeFalsy()
    expect(block.hp).toBeLessThanOrEqual(1) // обычный урон прошёл
    expect(sfx.freeze).not.toHaveBeenCalled()
  })

  it("замороженный блок колется с одного удара: осколки и звук льда", () => {
    const block = makeBlock({ x: 200, y: 100, hp: 1, frozen: true })
    const { world, sfx, fx } = makeWorld([block], false)
    damageBlock(world, block, 1)
    expect(block.dead).toBe(true)
    expect(sfx.iceShatter).toHaveBeenCalled()
    expect(sfx.destroy).not.toHaveBeenCalled()
    expect(fx.iceShatter).toHaveBeenCalledWith(block.x, block.y)
    // обычный удар шара довершает раскол
    const ball2: Ball = {
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
    const world2 = makeWorld([makeBlock({ x: 200, y: 100, hp: 1, frozen: true })], false)
    for (let i = 0; i < 12; i++) new Physics(world2.world).updateBall(ball2, 0.016)
    expect(world2.world.blocks.find((b) => b.x === 200)?.dead ?? true).toBe(true)
  })
})
