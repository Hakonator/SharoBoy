/**
 * «Кинетический клинок»: пробитие с лимитом за проход.
 *
 * Проход — отрезок между двумя отскоками. Счётчик `Ball.pierceLeft` считается
 * заново после отскока от ракетки, стены, блока, минибосса и босса. Тесты
 * проверяют ровно это: лимит блоков, отражение от лишнего блока и сброс
 * счётчика на отскоке.
 */
import { describe, expect, it } from "vitest"

import type { PhysicsWorld } from "../physics"
import type { Ball, Block } from "../types"

import {
  EXPLOSIVE_BALL_DAMAGE,
  EXPLOSIVE_BALL_MAX_TARGETS,
  EXPLOSIVE_BALL_RADIUS,
  PIERCE_BLOCKS_PER_PASS,
  collideBlocks,
  collidePaddle,
} from "./collide"

function makeBlock(x: number, y: number): Block {
  return {
    x,
    y,
    rx: 40,
    ry: 20,
    rot: 0,
    circle: false,
    hp: 5,
    maxHp: 5,
    tier: 1,
    flash: 0,
    seed: 1,
    dead: false,
    x0: x,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
  }
}

function makeBall(x: number, y: number): Ball {
  return {
    x,
    y,
    vx: 0,
    vy: -300,
    r: 8,
    speed: 300,
    stuck: false,
    stuckOffset: 0,
    trail: [],
    squash: 0,
    sinceHit: 0,
  }
}

function makeWorld(blocks: Block[], pierce: boolean, explosive = false, time = 0): PhysicsWorld {
  const world = {
    w: 400,
    h: 600,
    time,
    paddle: { x: 200, y: 560, w: 90, h: 14, vx: 0 },
    blocks,
    combo: 0,
    shake: 0,
    hitStop: 0,
    flash: 0,
    lives: 3,
    fx: { burst() {}, shatter() {}, rings: [], popups: [] },
    sfx: {
      brick() {},
      destroy() {},
      burn() {},
      paddle() {},
      power() {},
      iceShatter() {},
      shieldHit() {},
      wall() {},
    },
    fireActive: () => false,
    frostActive: () => false,
    sparkActive: () => false,
    pierceActive: () => pierce,
    explosiveActive: () => explosive,
    sparkQueue: [],
    slowActive: () => false,
    fastActive: () => false,
    magnetActive: () => false,
    magneticPaddleActive: () => false,
    wideActive: () => false,
    shrinkActive: () => false,
    paddleShape: () => "flat" as const,
    paddleRotatable: () => false,
    addScore() {},
    dropPower() {},
    damageBoss() {},
    damageMiniboss() {},
    onBombHitPaddle() {},
    pushHud() {},
    debugBallDamage: 1,
  } as unknown as PhysicsWorld
  return world
}

describe("Кинетический клинок", () => {
  it("лимит прохода — 3 блока", () => {
    expect(PIERCE_BLOCKS_PER_PASS).toBe(3)
  })

  it("пробивает ровно три блока и отражается от четвёртого", () => {
    const blocks = [
      makeBlock(200, 400),
      makeBlock(200, 300),
      makeBlock(200, 200),
      makeBlock(200, 100),
    ]
    const world = makeWorld(blocks, true)
    const ball = makeBall(200, 100)

    for (let i = 0; i < PIERCE_BLOCKS_PER_PASS; i++) {
      // шар у нижней границы блока: нормаль направлена вниз, поэтому при
      // отсутствии пробития он бы отразился
      ball.x = blocks[i].x
      ball.y = blocks[i].y + blocks[i].ry
      ball.vy = -300
      collideBlocks(world, ball)
      // пробитие не меняет направление: шар летит дальше вверх
      expect(ball.vy).toBeLessThan(0)
      expect(blocks[i].hp).toBe(4)
    }
    expect(ball.pierceLeft).toBe(0)

    // четвёртый блок уже не пробивается — шар отражается вниз
    ball.x = blocks[3].x
    ball.y = blocks[3].y + blocks[3].ry
    ball.vy = -300
    collideBlocks(world, ball)
    expect(ball.vy).toBeGreaterThan(0)
    // отскок от блока закрывает проход
    expect(ball.pierceLeft).toBeUndefined()
  })

  it("без активного клинка отражает первый же блок", () => {
    const blocks = [makeBlock(200, 300), makeBlock(200, 100)]
    const world = makeWorld(blocks, false)
    const ball = makeBall(200, 320)

    collideBlocks(world, ball)
    expect(ball.vy).toBeGreaterThan(0)
    expect(ball.pierceLeft).toBeUndefined()
    expect(blocks[1].hp).toBe(5)
  })

  it("не пробивает минибосса и не расходует лимит", () => {
    const miniboss = makeBlock(200, 100)
    miniboss.isMiniboss = true
    miniboss.mbGroup = 0
    const world = makeWorld([miniboss], true)
    const ball = makeBall(200, 120)

    collideBlocks(world, ball)
    expect(ball.vy).toBeGreaterThan(0)
    expect(ball.pierceLeft).toBeUndefined()
  })

  it("отскок от ракетки сбрасывает проход клинка", () => {
    const world = makeWorld([], true)
    const ball = makeBall(200, 548)
    ball.vy = 300
    ball.sinceHit = 1
    ball.pierceLeft = 1

    collidePaddle(world, ball)
    expect(ball.pierceLeft).toBeUndefined()
  })
})

describe("Плазменный заряд (взрывной шар)", () => {
  it("балансные константы соответствуют спецификации T-037", () => {
    expect(EXPLOSIVE_BALL_RADIUS).toBe(72)
    expect(EXPLOSIVE_BALL_MAX_TARGETS).toBe(8)
    expect(EXPLOSIVE_BALL_DAMAGE).toBe(1)
  })

  it("подрывает соседей в радиусе 72 на урон 1, блок прямого удара не получает двойной урон", () => {
    const target = makeBlock(200, 300)
    const near = makeBlock(240, 300) // расстояние 40 <= 72
    const far = makeBlock(200, 100) // расстояние 200 > 72
    const world = makeWorld([target, near, far], false, true)
    const ball = makeBall(200, 320) // у нижней границы target

    collideBlocks(world, ball)

    // Шар отскочил вниз
    expect(ball.vy).toBeGreaterThan(0)
    // target получил ровно 1 урон от прямого попадания (не двойной)
    expect(target.hp).toBe(4)
    // сосед в радиусе взрыва получил 1 урон
    expect(near.hp).toBe(4)
    // далёкий блок остался невредим
    expect(far.hp).toBe(5)
  })

  it("без активного бонуса соседи не получают урон", () => {
    const target = makeBlock(200, 300)
    const near = makeBlock(240, 300)
    const world = makeWorld([target, near], false, false)
    const ball = makeBall(200, 320)

    collideBlocks(world, ball)

    expect(target.hp).toBe(4)
    expect(near.hp).toBe(5)
  })

  it("минибоссы, бомбы и неактивные фазовые блоки взрывом не задеваются", () => {
    const target = makeBlock(200, 300)

    const miniboss = makeBlock(230, 300)
    miniboss.isMiniboss = true
    miniboss.mbGroup = 0

    const bombBlock = makeBlock(170, 300)
    bombBlock.bomb = true

    const phaseBlock = makeBlock(200, 330)
    phaseBlock.sp = { phase: { period: 2, active: 0.5, offset: 0 } }

    // в момент 1.5s при active: 0.5 фаза неактивна (1.5 % 2 = 1.5 >= 1.0)
    const world = makeWorld([target, miniboss, bombBlock, phaseBlock], false, true, 1.5)
    const ball = makeBall(200, 320)

    collideBlocks(world, ball)

    expect(target.hp).toBe(4)
    expect(miniboss.hp).toBe(5)
    expect(bombBlock.hp).toBe(5)
    expect(phaseBlock.hp).toBe(5)
  })

  it("защита от бесконечного каскада: взрывной урон идёт с allowBrittle = false", () => {
    const target = makeBlock(200, 300)
    // Хрупкий блок рядом с целью
    const brittle = makeBlock(230, 300)
    brittle.hp = 1
    brittle.sp = { brittle: { radius: 100, damage: 1 } }

    // Третий блок вне радиуса взрыва шара (86 > 72), но в радиусе хрупкого блока (80 <= 100)
    const chainTarget = makeBlock(230, 380)

    const world = makeWorld([target, brittle, chainTarget], false, true)
    const ball = makeBall(200, 320)

    collideBlocks(world, ball)

    expect(target.hp).toBe(4)
    // Хрупкий блок погиб от взрыва шара
    expect(brittle.dead).toBe(true)
    // Поскольку allowBrittle = false, хрупкий блок не произвёл собственный взрыв
    expect(chainTarget.hp).toBe(5)
  })

  it("лимит целей: взрывная волна поражает не более 8 блоков", () => {
    const target = makeBlock(200, 300)
    // 10 блоков вокруг цели в радиусе 50
    const neighbors: Block[] = []
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      neighbors.push(makeBlock(200 + Math.cos(angle) * 50, 300 + Math.sin(angle) * 50))
    }

    const world = makeWorld([target, ...neighbors], false, true)
    const ball = makeBall(200, 320)

    collideBlocks(world, ball)

    expect(target.hp).toBe(4)
    const damaged = neighbors.filter((b) => b.hp < 5)
    const undamaged = neighbors.filter((b) => b.hp === 5)
    expect(damaged.length).toBe(EXPLOSIVE_BALL_MAX_TARGETS)
    expect(undamaged.length).toBe(2)
  })
})
