import { describe, expect, it, vi } from "vitest"

import { makeEnv } from "./campaignFlow.helpers"
import type { Game } from "./game"
import { stopWeaponsAndAura, onLevelCleared } from "./game/runFlow"
import { drawLaserBeams } from "./render/powers"
import type { Block, PaddleState, Projectile } from "./types"
import { WeaponsSystem, type WeaponsWorld } from "./weapons"

function makePaddle(over: Partial<PaddleState> = {}): PaddleState {
  return {
    x: 200,
    y: 560,
    w: 100,
    baseW: 100,
    h: 14,
    vx: 0,
    squash: 0,
    ...over,
  }
}

function makeTestBlock(over: Partial<Block> = {}): Block {
  return {
    x: 200,
    y: 100,
    rx: 30,
    ry: 15,
    rot: 0,
    circle: false,
    hp: 1,
    maxHp: 1,
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

describe("WeaponsSystem", () => {
  it("stop() немедленно сбрасывает все таймеры, флаги взвода и массив снарядов", () => {
    const world: WeaponsWorld = {
      time: 10,
      paddle: makePaddle(),
      blocks: [],
      boss: null,
      projectiles: [{ x: 200, y: 300, vy: -500, kind: "rocket", r: 7, dead: false } as Projectile],
      rocketUntil: 15,
      weaponCd: 0.2,
      laserArmed: true,
      laserArmedUntil: 20,
      laserUntil: 12,
      laserWasOn: true,
      paddleShape: () => "flat",
      shake: 0,
      flash: 0,
      fx: { burst: vi.fn(), rings: [], particles: [] } as unknown as WeaponsWorld["fx"],
      sfx: {
        laser: vi.fn(),
        rocket: vi.fn(),
        explosion: vi.fn(),
      } as unknown as WeaponsWorld["sfx"],
      damageBlock: vi.fn(),
      damageBoss: vi.fn(),
    }

    const ws = new WeaponsSystem(world)
    ws.stop()

    expect(world.laserUntil).toBe(0)
    expect(world.laserArmed).toBe(false)
    expect(world.laserArmedUntil).toBe(0)
    expect(world.laserWasOn).toBe(false)
    expect(world.rocketUntil).toBe(0)
    expect(world.weaponCd).toBe(0)
    expect(world.projectiles).toEqual([])
  })

  it("уничтожение последнего блока лазером автоматически вызывает stop() и гасит лазер", () => {
    const lastBlock = makeTestBlock({ x: 200, y: 100, hp: 1 })
    const blocks = [lastBlock]

    const damageBlock = vi.fn((b: Block) => {
      b.hp = 0
      b.dead = true
      blocks.length = 0
    })

    const world: WeaponsWorld = {
      time: 0.05, // cyc = 0.05 < 0.17 -> лазер бьёт
      paddle: makePaddle(),
      blocks,
      boss: null,
      projectiles: [],
      rocketUntil: 0,
      weaponCd: 0,
      laserArmed: false,
      laserArmedUntil: 0,
      laserUntil: 2.0,
      laserWasOn: false,
      paddleShape: () => "flat",
      shake: 0,
      flash: 0,
      fx: { burst: vi.fn(), rings: [], particles: [] } as unknown as WeaponsWorld["fx"],
      sfx: {
        laser: vi.fn(),
        rocket: vi.fn(),
        explosion: vi.fn(),
      } as unknown as WeaponsWorld["sfx"],
      damageBlock,
      damageBoss: vi.fn(),
    }

    const ws = new WeaponsSystem(world)
    // Размещение лазерного пилона p.x - p.w * 0.36 = 200 - 36 = 164
    // lastBlock в x = 200, rx = 50 перекрывает x=164
    lastBlock.rx = 50

    ws.updateLaser(false)

    expect(damageBlock).toHaveBeenCalledWith(lastBlock, 3)
    // После разрушения последнего блока laserUntil сброшен в 0
    expect(world.laserUntil).toBe(0)
    expect(world.laserWasOn).toBe(false)
  })

  it("лазер при попадании в блок-призму преломляется горизонтально и наносит урон соседям", () => {
    const prismBlock = makeTestBlock({ x: 164, y: 150, rx: 20, ry: 20, sp: { prism: true } })
    const neighborBlock = makeTestBlock({ x: 300, y: 150, rx: 20, ry: 20 })
    const damageBlock = vi.fn()

    const world: WeaponsWorld = {
      time: 0.05,
      paddle: makePaddle(),
      blocks: [prismBlock, neighborBlock],
      boss: null,
      projectiles: [],
      rocketUntil: 0,
      weaponCd: 0,
      laserArmed: false,
      laserArmedUntil: 0,
      laserUntil: 2.0,
      laserWasOn: false,
      paddleShape: () => "flat",
      shake: 0,
      flash: 0,
      fx: { burst: vi.fn(), rings: [], particles: [] } as unknown as WeaponsWorld["fx"],
      sfx: {
        laser: vi.fn(),
        rocket: vi.fn(),
        explosion: vi.fn(),
      } as unknown as WeaponsWorld["sfx"],
      damageBlock,
      damageBoss: vi.fn(),
    }

    const ws = new WeaponsSystem(world)
    ws.updateLaser(false)

    expect(damageBlock).toHaveBeenCalledWith(prismBlock, 3)
    expect(damageBlock).toHaveBeenCalledWith(neighborBlock, 2)
  })

  it("stopWeaponsAndAura сбрасывает лазер, ракеты, снаряды, молнии и очереди", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game

    game.laserUntil = 50
    game.laserArmed = true
    game.rocketUntil = 50
    game.projectiles = [{ x: 100, y: 100, vy: -100, kind: "rocket", r: 5, dead: false }]
    game.fx.lightnings = [{ x1: 0, y1: 0, x2: 10, y2: 10, t: 0 }]
    game.sparkQueue = [{ block: makeTestBlock(), from: { x: 0, y: 0 }, at: 10 }]
    game.boomQueue = [{ x: 100, y: 100, at: 10 }]

    stopWeaponsAndAura(game)

    expect(game.laserUntil).toBe(0)
    expect(game.laserArmed).toBe(false)
    expect(game.rocketUntil).toBe(0)
    expect(game.projectiles).toEqual([])
    expect(game.fx.lightnings).toEqual([])
    expect(game.sparkQueue).toHaveLength(0)
    expect(game.boomQueue).toHaveLength(0)

    g.destroy()
  })

  it("при завершении уровня onLevelCleared глушит все эффекты оружия", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game

    game.startLevelBattle(1)
    game.laserUntil = game.time + 10
    game.laserArmed = true
    game.rocketUntil = game.time + 10
    game.projectiles = [{ x: 100, y: 100, vy: -100, kind: "rocket", r: 5, dead: false }]

    onLevelCleared(game)

    expect(game.laserUntil).toBe(0)
    expect(game.laserArmed).toBe(false)
    expect(game.rocketUntil).toBe(0)
    expect(game.projectiles).toHaveLength(0)

    g.destroy()
  })

  it("drawLaserBeams не рисует лучи, если все блоки уничтожены или активно окно очков", () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
    }

    // 1. laserUntil в будущем, но блоки мертвы / пусты
    drawLaserBeams(ctx as unknown as CanvasRenderingContext2D, {
      time: 0.05,
      laserUntil: 10,
      paddle: makePaddle(),
      blocks: [],
      boss: null,
    })
    expect(ctx.save).not.toHaveBeenCalled()

    // 2. hidden (например, при появлении intermediateScore)
    const aliveBlock = makeTestBlock({ x: 200, y: 100 })
    drawLaserBeams(ctx as unknown as CanvasRenderingContext2D, {
      time: 0.05,
      laserUntil: 10,
      hidden: true,
      paddle: makePaddle(),
      blocks: [aliveBlock],
      boss: null,
    })
    expect(ctx.save).not.toHaveBeenCalled()
  })
})
