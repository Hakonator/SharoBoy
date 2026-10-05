import { describe, expect, it } from "vitest"

import { FIREBALL_DAMAGE_MULT, Physics, type PhysicsWorld } from "./physics"
import type { Ball, Block } from "./types"
import { spawnScatter } from "./physics/destruction"

/** Регрессия 26dc66b: знак surfaceAt для «convex» инвертировали «для симметрии»
 *  с чашей — все потребители (старт шара, прилипание, выталкивание, пилоны)
 *  трактуют результат как ВЫСОТУ НАД ГРАНЬЮ (y = yTop − surfaceAt), и шар
 *  оказывался под куполом. Контракт: результат ≥ 0 для любой формы. */
describe("Physics.surfaceAt — высота поверхности над гранью", () => {
  it("flat: грань, 0 в любой точке", () => {
    expect(Physics.surfaceAt(60, 0, "flat")).toBe(0)
    expect(Physics.surfaceAt(60, 0.7, "flat")).toBe(0)
  })

  it("convex: центр выше краёв — bump в центре, 0 на краях", () => {
    const halfW = 60
    expect(Physics.surfaceAt(halfW, 0, "convex")).toBeCloseTo(Physics.convexBump(halfW))
    expect(Physics.surfaceAt(halfW, 1, "convex")).toBeCloseTo(0)
    expect(Physics.surfaceAt(halfW, -1, "convex")).toBeCloseTo(0)
    // парабола: симметрия и монотонный спад от центра к краю
    expect(Physics.surfaceAt(halfW, 0.5, "convex")).toBeCloseTo(
      Physics.surfaceAt(halfW, -0.5, "convex")
    )
    expect(Physics.surfaceAt(halfW, 0.5, "convex")).toBeLessThan(
      Physics.surfaceAt(halfW, 0, "convex")
    )
  })

  it("concave: края выше центра — bump на краях, грань в центре", () => {
    const halfW = 60
    expect(Physics.surfaceAt(halfW, 0, "concave")).toBe(0)
    expect(Physics.surfaceAt(halfW, 1, "concave")).toBeCloseTo(Physics.convexBump(halfW))
    expect(Physics.surfaceAt(halfW, -1, "concave")).toBeCloseTo(Physics.convexBump(halfW))
  })

  it("контракт: результат неотрицателен для всех форм во всех точках", () => {
    for (const kind of ["flat", "convex", "concave"] as const) {
      for (let i = 0; i <= 10; i++) {
        const rel = -1 + (2 * i) / 10
        expect(Physics.surfaceAt(60, rel, kind, 20)).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

/** Огненное ядро: множитель урона и запрет «прожигания» минибоссов насквозь. */
describe("Physics — огненное ядро", () => {
  /** Минимальный фейковый мир: шар летит вверх в блок-эллипс, урон копится. */
  function makeWorld(block: Block, fire: boolean) {
    const miniDamage: number[] = []
    const stats = { hits: 0 }
    const world = {
      w: 400,
      h: 600,
      time: 0,
      paddle: { x: 200, y: 560, w: 90, h: 14 },
      blocksInitial: 1,
      boss: null,
      input: { keys: { left: false, right: false }, pointerX: null, locked: false },
      balls: [],
      blocks: [block],
      powers: [],
      boomQueue: [],
      shield: 0,
      combo: 0,
      shake: 0,
      hitStop: 0,
      flash: 0,
      fx: { burst() {}, particles: [], rings: [], popups: [] },
      sfx: { wall() {}, burn() {}, brick() {} },
      fireActive: () => fire,
      frostActive: () => false,
      sparkActive: () => false,
      sparkQueue: [],
      slowActive: () => false,
      fastActive: () => false,
      magnetActive: () => false,
      wideActive: () => false,
      shrinkActive: () => false,
      paddleShape: () => "flat" as const,
      paddleRotatable: () => false,
      addScore: () => stats.hits++,
      dropPower() {},
      damageBoss() {},
      damageMiniboss: (dmg: number) => miniDamage.push(dmg),
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
    return { world, ball, miniDamage, stats }
  }

  /** Эллипс-блок: обычный или минибоссный. */
  function makeBlock(isMiniboss: boolean): Block {
    return {
      x: 200,
      y: 100,
      rx: 60,
      ry: 24,
      rot: 0,
      circle: false,
      hp: 999,
      maxHp: 999,
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
      isMiniboss,
      mbGroup: isMiniboss ? 0 : undefined,
    }
  }

  it("множитель огня — ×3 от обычного урона", () => {
    expect(FIREBALL_DAMAGE_MULT).toBe(3)
  })

  /** Шаг физики: шар стартует в 150 и летит вверх к блоку на y=100. */
  function run(world: PhysicsWorld, ball: Ball, frames = 12) {
    const physics = new Physics(world)
    for (let i = 0; i < frames; i++) physics.updateBall(ball, 0.016)
  }

  it("огонь ОТСКАКИВАЕТ от блока минибосса и бьёт ×3 (без прожигания насквозь)", () => {
    const block = makeBlock(true)
    const { world, ball, miniDamage } = makeWorld(block, true)
    run(world, ball)
    expect(miniDamage).toEqual([3])
    expect(ball.vy).toBeGreaterThan(0) // отскок вниз — машина урона исчезла
    expect(ball.y).toBeGreaterThan(block.y) // шар отлетел от существа
  })

  it("обычный шар по минибоссу: урон ×1 и отскок", () => {
    const { world, ball, miniDamage } = makeWorld(makeBlock(true), false)
    run(world, ball)
    expect(miniDamage).toEqual([1])
    expect(ball.vy).toBeGreaterThan(0)
  })

  it("огонь прожигает обычные блоки: урон ×3 за каждое касание, без отскока", () => {
    const block = makeBlock(false)
    const { world, ball, stats } = makeWorld(block, true)
    run(world, ball)
    expect(stats.hits).toBeGreaterThanOrEqual(1) // касаний могло быть несколько — шар идёт насквозь
    expect(block.hp).toBe(999 - 3 * stats.hits) // каждое касание — ровно ×3 обычного урона
    expect(ball.vy).toBeLessThan(0) // прошёл насквозь
  })

  it("портал на кулдауне полностью пропускает шар без урона", () => {
    const block = makeBlock(false)
    block.sp = { portalId: 1, portalCd: 0.5 }
    const { world, ball } = makeWorld(block, false)

    run(world, ball)

    expect(block.hp).toBe(block.maxHp)
    expect(block.dead).toBe(false)
    expect(ball.vy).toBeLessThan(0)
    expect(ball.y).toBeLessThan(block.y)
  })

  it("магнитный блок притягивает шар, пока тот вне хитбокса", () => {
    const block = makeBlock(false)
    block.sp = { magnet: { radius: 100, force: 500 } }
    const { world, ball } = makeWorld(block, false)
    ball.x = 275
    ball.y = 100
    ball.vx = 0
    ball.vy = -ball.speed
    ball.sinceHit = 0

    const physics = new Physics(world)
    for (let i = 0; i < 20; i++) physics.updateBall(ball, 0.016)

    expect(ball.vx).toBeLessThan(-ball.speed * 0.015)
    expect(ball.vx).toBeGreaterThan(-ball.speed * 0.35)
    expect(block.hp).toBe(block.maxHp)
  })

  it("отрицательная сила/радиус магнита не ускоряют мяч к блоку", () => {
    const block = makeBlock(false)
    block.sp = { magnet: { radius: 100, force: -500 } }
    const { world, ball } = makeWorld(block, false)
    ball.x = 275
    ball.y = 100
    ball.vx = 0
    ball.vy = 0
    new Physics(world).updateBall(ball, 0.016)
    // Общая страховка физики не позволяет шару иметь нулевую скорость.
    expect(ball.vx).toBeGreaterThanOrEqual(0)
  })

  it("неактивная фаза не отражает шар и не наносит урон", () => {
    const block = makeBlock(false)
    block.sp = { phase: { period: 2, active: 0.5, offset: 1 } }
    const { world, ball } = makeWorld(block, false)

    run(world, ball)

    expect(block.hp).toBe(block.maxHp)
    expect(ball.vy).toBeLessThan(0)
    expect(ball.y).toBeLessThan(block.y)
  })

  it("невалидная доля/период фазы безопасно оставляет блок активным", () => {
    const block = makeBlock(false)
    block.sp = { phase: { period: Number.NaN, active: 0, offset: 0 } }
    const { world, ball } = makeWorld(block, false)

    run(world, ball)

    expect(block.hp).toBeLessThan(block.maxHp)
  })
})

/** Верхняя неигровая HUD-зона: шар отражается от её нижней границы. */
describe("Physics — верхняя неигровая HUD-зона", () => {
  function makeTopWorld(blockTop: number) {
    return {
      w: 400,
      h: 600,
      blockTop,
      blockSpawnTop: blockTop,
      time: 0,
      paddle: { x: 200, y: 560, w: 90, h: 14 },
      blocksInitial: 0,
      boss: null,
      input: { keys: { left: false, right: false }, pointerX: null, locked: false },
      balls: [],
      blocks: [],
      powers: [],
      boomQueue: [],
      shield: 0,
      combo: 0,
      shake: 0,
      hitStop: 0,
      flash: 0,
      fx: { burst() {}, particles: [], rings: [], popups: [] },
      sfx: { wall() {} },
      fireActive: () => false,
      frostActive: () => false,
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
  }

  function makeTopBall(): Ball {
    return {
      x: 200,
      y: 300,
      vx: 0,
      vy: -400,
      r: 10,
      speed: 400,
      stuck: false,
      stuckOffset: 0,
      trail: [],
      squash: 0,
      sinceHit: 0,
    }
  }

  it("шар отражается от границы зоны и не заходит выше неё", () => {
    const world = makeTopWorld(150)
    const physics = new Physics(world)
    const ball = makeTopBall()
    for (let i = 0; i < 40; i++) physics.updateBall(ball, 0.016)
    expect(ball.y - ball.r).toBeGreaterThanOrEqual(150)
    expect(ball.vy).toBeGreaterThan(0)
  })

  it("шар, оказавшийся выше границы (поворот экрана), выталкивается вниз", () => {
    const world = makeTopWorld(150)
    const physics = new Physics(world)
    const ball = { ...makeTopBall(), y: 80, vy: -100 }
    physics.updateBall(ball, 0.016)
    expect(ball.y - ball.r).toBe(150)
    expect(ball.vy).toBeGreaterThan(0)
  })

  it("рассыпь не создаёт новые блоки за HUD на портретном экране", () => {
    const world = makeTopWorld(150)
    world.fx = {
      burst() {},
      particles: [],
      rings: [],
      popups: [],
    } as unknown as PhysicsWorld["fx"]
    const source = {
      x: 180,
      y: 170,
      rx: 18,
      ry: 18,
      tier: 1,
      seed: 1,
    } as Block

    spawnScatter(world, source)

    expect(world.blocks.length).toBeGreaterThan(0)
    for (const block of world.blocks) {
      expect(block.y - block.ry).toBeGreaterThanOrEqual(150)
    }
  })
})
