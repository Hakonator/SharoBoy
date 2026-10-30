/**
 * «Кинетический клинок»: пробитие с лимитом за проход.
 *
 * Проход — отрезок между двумя отскоками. Счётчик `Ball.pierceLeft` считается
 * заново после отскока от ракетки, стены, блока, минибосса и босса. Тесты
 * проверяют ровно это: лимит блоков, отражение от лишнего блока и сброс
 * счётчика на отскоке.
 */
import { describe, expect, it } from "vitest"

import { BIG_BALL_RADIUS, type PhysicsWorld } from "../physics"
import type { Ball, Block } from "../types"

import {
  CHAIN_RESONANCE_DAMAGE,
  CHAIN_RESONANCE_MAX_TARGETS,
  CHAIN_RESONANCE_RADIUS,
  EXPLOSIVE_BALL_DAMAGE,
  EXPLOSIVE_BALL_MAX_TARGETS,
  EXPLOSIVE_BALL_RADIUS,
  PIERCE_BLOCKS_PER_PASS,
  PIERCE_SNIPER_BLOCKS_PER_PASS,
  SUPERNOVA_DAMAGE,
  SUPERNOVA_MAX_TARGETS,
  SUPERNOVA_RADIUS,
  THERMAL_SHOCK_STEAM_DAMAGE,
  THERMAL_SHOCK_STEAM_MAX_TARGETS,
  THERMAL_SHOCK_STEAM_RADIUS,
  applyClutchRebound,
  applyExplosiveBallAoE,
  applyThermalShockSteamAoE,
  collideBlocks,
  collideBoss,
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

function makeWorld(
  blocks: Block[],
  pierce: boolean,
  explosive = false,
  time = 0,
  big = false
): PhysicsWorld {
  const world = {
    w: 400,
    h: 600,
    time,
    paddle: { x: 200, y: 560, w: 90, h: 14, vx: 0 },
    blocks,
    powers: [],
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
    bigActive: () => big,
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

describe("Гравитационное ядро (увеличенный шар)", () => {
  it("увеличенный шар отражается и не залипает в блоке при ударе", () => {
    const block = makeBlock(200, 300)
    const world = makeWorld([block], false, false, 0, true)
    const ball = makeBall(200, 300 + block.ry + BIG_BALL_RADIUS - 1)
    ball.r = BIG_BALL_RADIUS
    ball.vy = -300

    collideBlocks(world, ball)

    // Шар отскочил вниз
    expect(ball.vy).toBeGreaterThan(0)
    // Шар вытолкнут наружу
    expect(ball.y).toBeGreaterThanOrEqual(block.y + block.ry)
    expect(block.hp).toBe(4)
  })

  it("совместная работа «big» и «pierce»: клинок пробивает 3 блока увеличенным радиусом", () => {
    const blocks = [
      makeBlock(200, 400),
      makeBlock(200, 300),
      makeBlock(200, 200),
      makeBlock(200, 100),
    ]
    const world = makeWorld(blocks, true, false, 0, true)
    const ball = makeBall(200, 100)
    ball.r = BIG_BALL_RADIUS

    for (let i = 0; i < PIERCE_BLOCKS_PER_PASS; i++) {
      ball.x = blocks[i].x
      ball.y = blocks[i].y + blocks[i].ry
      ball.vy = -300
      collideBlocks(world, ball)
      expect(ball.vy).toBeLessThan(0)
      expect(blocks[i].hp).toBe(4)
    }
    expect(ball.pierceLeft).toBe(0)

    // четвёртый блок отражает увеличенный шар
    ball.x = blocks[3].x
    ball.y = blocks[3].y + blocks[3].ry
    ball.vy = -300
    collideBlocks(world, ball)
    expect(ball.vy).toBeGreaterThan(0)
    expect(ball.pierceLeft).toBeUndefined()
  })
})

describe("Синергии боевых механик (T-040, §3.1 Roadmap)", () => {
  describe("«Кинетический Снайпер» (Kinetic Sniper)", () => {
    it("удваивает лимит пробития до 6 блоков за проход", () => {
      expect(PIERCE_SNIPER_BLOCKS_PER_PASS).toBe(6)

      const blocks = Array.from({ length: 7 }, (_, i) => makeBlock(200, 700 - i * 100))
      const world = makeWorld(blocks, true)
      world.isSniperActive = () => true
      const ball = makeBall(200, 100)

      for (let i = 0; i < PIERCE_SNIPER_BLOCKS_PER_PASS; i++) {
        ball.x = blocks[i].x
        ball.y = blocks[i].y + blocks[i].ry
        ball.vy = -300
        collideBlocks(world, ball)
        expect(ball.vy).toBeLessThan(0)
        // Снайпер наносит +50% урона (Math.ceil(1 * 1.5) = 2), поэтому 5 - 2 = 3
        expect(blocks[i].hp).toBe(3)
      }
      expect(ball.pierceLeft).toBe(0)

      // 7-й блок уже не пробивается и отражает шар
      ball.x = blocks[6].x
      ball.y = blocks[6].y + blocks[6].ry
      ball.vy = -300
      collideBlocks(world, ball)
      expect(ball.vy).toBeGreaterThan(0)
      expect(ball.pierceLeft).toBeUndefined()
    })
  })

  describe("«Цепной Резонанс» (Chain Resonance)", () => {
    it("соответствует спецификации: радиус 108, лимит целей 14, урон 2", () => {
      expect(CHAIN_RESONANCE_RADIUS).toBe(108)
      expect(CHAIN_RESONANCE_MAX_TARGETS).toBe(14)
      expect(CHAIN_RESONANCE_DAMAGE).toBe(2)
    })

    it("поражает цели на расстоянии до 108 px с удвоенным уроном", () => {
      const source = makeBlock(200, 300)
      const near = makeBlock(200, 350) // расстояние 50 (в радиусе 72 и 108)
      const mid = makeBlock(200, 395) // расстояние 95 (> 72, но <= 108)
      const far = makeBlock(200, 420) // расстояние 120 (> 108)

      const blocks = [source, near, mid, far]
      const world = makeWorld(blocks, false, true)

      // Базовый взрыв: mid не поражается (95 > 72)
      applyExplosiveBallAoE(world, source, false)
      expect(near.hp).toBe(4) // 5 - 1
      expect(mid.hp).toBe(5) // не задет

      // Цепной резонанс: mid поражается, урон 2
      near.hp = 5
      mid.hp = 5
      applyExplosiveBallAoE(world, source, true)
      expect(near.hp).toBe(3) // 5 - 2
      expect(mid.hp).toBe(3) // 5 - 2
      expect(far.hp).toBe(5) // 120 > 108 не задет
    })
  })

  describe("«Гравитационный Джаггернаут» (Gravitational Juggernaut)", () => {
    it("наносит ×3 урон по боссу (с 1 до 3) и генерирует сейсмический импульс", () => {
      let bossDamageDealt = 0
      const world = makeWorld([], false)
      ;(world as unknown as { boss: unknown }).boss = {
        x: 200,
        y: 100,
        r: 40,
        hp: 100,
        maxHp: 100,
        kind: "kraken",
        state: "idle",
      } as unknown as PhysicsWorld["boss"]
      world.damageBoss = (dmg: number) => {
        bossDamageDealt += dmg
      }
      world.isJuggernautActive = () => true

      const ball = makeBall(200, 145)
      ball.vy = -300
      collideBoss(world, ball)

      expect(bossDamageDealt).toBe(3)
      expect(world.shake).toBeGreaterThanOrEqual(4.5)
    })
  })

  describe("«Термический Шок» (Thermal Shock)", () => {
    it("соответствует спецификации: радиус пара 80, лимит целей 8, урон 2", () => {
      expect(THERMAL_SHOCK_STEAM_RADIUS).toBe(80)
      expect(THERMAL_SHOCK_STEAM_MAX_TARGETS).toBe(8)
      expect(THERMAL_SHOCK_STEAM_DAMAGE).toBe(2)
    })

    it("паровой взрыв поражает блоки в радиусе 80 px на урон 2", () => {
      const source = makeBlock(200, 300)
      const near = makeBlock(200, 350) // расстояние 50 (<= 80)
      const far = makeBlock(200, 390) // расстояние 90 (> 80)

      const world = makeWorld([source, near, far], false)
      applyThermalShockSteamAoE(world, source)

      expect(near.hp).toBe(3) // 5 - 2
      expect(far.hp).toBe(5) // не задет
    })

    it("наносит ×4 урон по боссу при активной синергии", () => {
      let bossDamageDealt = 0
      const world = makeWorld([], false)
      ;(world as unknown as { boss: unknown }).boss = {
        x: 200,
        y: 100,
        r: 40,
        hp: 100,
        maxHp: 100,
        kind: "kraken",
        state: "idle",
      } as unknown as PhysicsWorld["boss"]
      world.damageBoss = (dmg: number) => {
        bossDamageDealt += dmg
      }
      world.isThermalShockActive = () => true

      const ball = makeBall(200, 145)
      ball.vy = -300
      collideBoss(world, ball)

      expect(bossDamageDealt).toBe(4)
      expect(world.shake).toBeGreaterThanOrEqual(5)
    })
  })

  describe("«Сверхновая» (Supernova)", () => {
    it("соответствует спецификации: радиус 96, лимит целей 12, урон 3", () => {
      expect(SUPERNOVA_RADIUS).toBe(96)
      expect(SUPERNOVA_MAX_TARGETS).toBe(12)
      expect(SUPERNOVA_DAMAGE).toBe(3)
    })

    it("взрыв сверхновой поражает блоки в радиусе 96 px с огромным уроном 3", () => {
      const source = makeBlock(200, 300)
      const near = makeBlock(200, 360) // расстояние 60 (<= 96)
      const far = makeBlock(200, 410) // расстояние 110 (> 96)

      const world = makeWorld([source, near, far], false, true)
      applyExplosiveBallAoE(world, source, false, true)

      expect(near.hp).toBe(2) // 5 - 3
      expect(far.hp).toBe(5) // не задет
      expect(world.shake).toBeGreaterThanOrEqual(3.5)
    })
  })

  describe("«Абсолютный Бастион» (Absolute Bulwark)", () => {
    it("гарантирует критический сэйв ×2 на ракетке даже при ударе по центру", () => {
      const world = makeWorld([], false)
      world.isAbsoluteBulwarkActive = () => true
      let clutchCalled = false
      world.onClutchSave = () => {
        clutchCalled = true
      }

      const ball = makeBall(200, 560)
      expect(ball.clutchHits).toBeUndefined()

      // rel = 0 (удар в самый центр платформы, обычно не дающий сэйв)
      applyClutchRebound(world, ball, 0, 0)

      expect(ball.clutchHits).toBe(2)
      expect(clutchCalled).toBe(true)
    })
  })
})
