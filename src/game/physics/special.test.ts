import { describe, expect, it, vi } from "vitest"

import {
  COTTON_SPEED_MULT,
  COTTON_TIME,
  PORTAL_CD,
  SPIN_KICK,
  SPRING_SPEED_MULT,
  SPRING_TIME,
} from "../blockKinds"
import type { PhysicsWorld } from "../physics"
import type { Ball, Block } from "../types"

import { applyBallTimers, onBallHitSpecial, specialSpeedMult } from "./special"

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

function makeBall(over: Partial<Ball> = {}): Ball {
  return {
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
    ...over,
  }
}

function makeWorld(blocks: Block[]) {
  return {
    w: 400,
    h: 600,
    time: 5,
    blocks,
    sfx: { spring: vi.fn(), thud: vi.fn(), warp: vi.fn() },
    fx: { burst: vi.fn(), rings: [] },
  } as unknown as PhysicsWorld
}

describe("пружинный и ватный блоки", () => {
  it("пружина ставит таймер разгона на шаре и играет звук", () => {
    const b = makeBlock({ sp: { spring: true } })
    const world = makeWorld([b])
    const ball = makeBall()
    expect(onBallHitSpecial(world, b, ball, 0, 30)).toBe(false) // отскок обычный
    expect(ball.springT).toBe(SPRING_TIME)
    expect(world.sfx.spring).toHaveBeenCalledOnce()
  })

  it("вата ставит таймер замедления на шаре", () => {
    const b = makeBlock({ sp: { cotton: true } })
    const world = makeWorld([b])
    const ball = makeBall()
    expect(onBallHitSpecial(world, b, ball, 0, 30)).toBe(false)
    expect(ball.cottonT).toBe(COTTON_TIME)
    expect(world.sfx.thud).toHaveBeenCalledOnce()
  })

  it("множители скорости: пружина > 1, вата < 1, без таймеров — 1", () => {
    expect(specialSpeedMult(makeBall())).toBe(1)
    expect(specialSpeedMult(makeBall({ springT: 1 }))).toBe(SPRING_SPEED_MULT)
    expect(specialSpeedMult(makeBall({ cottonT: 1 }))).toBe(COTTON_SPEED_MULT)
  })

  it("таймеры тикают вниз и обнуляются", () => {
    const ball = makeBall({ springT: SPRING_TIME, cottonT: 0.5 })
    applyBallTimers(ball, 0.6)
    expect(ball.springT).toBeCloseTo(SPRING_TIME - 0.6)
    expect(ball.cottonT).toBe(0)
  })

  it("повторный удар по пружине не перезапускает таймер, пока он активен", () => {
    const b = makeBlock({ sp: { spring: true } })
    const world = makeWorld([b])
    const ball = makeBall({ springT: 1.5 })
    onBallHitSpecial(world, b, ball, 0, 30)
    expect(ball.springT).toBe(1.5)
  })
})

describe("крутящийся блок", () => {
  it("удар в правую половину раскручивает по часовой, сила растёт к краю", () => {
    const edge = makeBlock({ sp: { rotVel: 0 } })
    const center = makeBlock({ sp: { rotVel: 0 } })
    const world = makeWorld([edge])
    onBallHitSpecial(world, edge, makeBall(), 30, 30)
    onBallHitSpecial(world, center, makeBall(), 0, 30)
    expect(edge.sp!.rotVel).toBeCloseTo(SPIN_KICK)
    expect(center.sp!.rotVel).toBeCloseTo(SPIN_KICK * 0.4)
  })

  it("удар в левую половину крутит в противоположную сторону", () => {
    const b = makeBlock({ sp: { rotVel: 0 } })
    onBallHitSpecial(makeWorld([b]), b, makeBall(), -30, 30)
    expect(b.sp!.rotVel).toBeCloseTo(-SPIN_KICK)
  })

  it("импульс суммируется и ограничен SPIN_MAX", () => {
    const b = makeBlock({ sp: { rotVel: SPIN_KICK * 2 } })
    onBallHitSpecial(makeWorld([b]), b, makeBall(), 30, 30)
    expect(b.sp!.rotVel).toBeLessThanOrEqual(6)
  })
})

describe("парный телепорт «чёрная дыра»", () => {
  it("перебрасывает шар к партнёру с сохранением вектора скорости", () => {
    const a = makeBlock({ x: 100, y: 100, rx: 20, ry: 20, circle: true, sp: { portalId: 1 } })
    const c = makeBlock({ x: 300, y: 200, rx: 20, ry: 20, circle: true, sp: { portalId: 1 } })
    const world = makeWorld([a, c])
    const ball = makeBall({ x: 100, y: 130, vx: 80, vy: -300 })
    expect(onBallHitSpecial(world, a, ball, 0, 20)).toBe(true)
    // скорость не изменилась, позиция — у выхода из партнёра по вектору скорости
    expect(ball.vx).toBe(80)
    expect(ball.vy).toBe(-300)
    const sp = Math.hypot(80, -300)
    expect(ball.x).toBeCloseTo(300 + (80 / sp) * (20 + 8 + 2))
    expect(ball.y).toBeCloseTo(200 + (-300 / sp) * (20 + 8 + 2))
    // кулдаун на обоих порталах пары
    expect(a.sp!.portalCd).toBe(PORTAL_CD)
    expect(c.sp!.portalCd).toBe(PORTAL_CD)
    expect(world.sfx.warp).toHaveBeenCalledOnce()
    // хвост сброшен — не тянется через весь экран
    expect(ball.trail).toHaveLength(0)
  })

  it("на кулдауне портал не телепортирует (обычное отражение)", () => {
    const a = makeBlock({ sp: { portalId: 1, portalCd: 0.5 } })
    const c = makeBlock({ sp: { portalId: 1 } })
    const ball = makeBall()
    expect(onBallHitSpecial(makeWorld([a, c]), a, ball, 0, 30)).toBe(false)
    expect(ball.x).toBe(200) // позиция не тронута
  })

  it("без живого партнёра портал не телепортирует", () => {
    const a = makeBlock({ sp: { portalId: 1 } })
    const dead = makeBlock({ sp: { portalId: 1 }, dead: true })
    const other = makeBlock({ sp: { portalId: 2 } })
    const ball = makeBall()
    expect(onBallHitSpecial(makeWorld([a, dead]), a, ball, 0, 30)).toBe(false)
    expect(onBallHitSpecial(makeWorld([a, other]), a, ball, 0, 30)).toBe(false)
  })

  it("блок без спецтипа — мгновенный выход false без эффектов", () => {
    const b = makeBlock()
    const world = makeWorld([b])
    expect(onBallHitSpecial(world, b, makeBall(), 0, 30)).toBe(false)
    expect(world.sfx.warp).not.toHaveBeenCalled()
  })
})
