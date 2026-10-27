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

import { PIERCE_BLOCKS_PER_PASS, collideBlocks, collidePaddle } from "./collide"

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

function makeWorld(blocks: Block[], pierce: boolean): PhysicsWorld {
  const world = {
    w: 400,
    h: 600,
    time: 0,
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
