import { describe, expect, it } from "vitest"

import { FIREBALL_DAMAGE_MULT, Physics, type PhysicsWorld } from "./physics"
import type { Ball, Block } from "./types"
import { spawnScatter } from "./physics/destruction"
import { paddleLaunchAngle } from "./game/paddleControl"
import { gridBlocks, buildBossArena } from "./levelPatterns"
import { layoutBlocks } from "./levelBuilder"
import { LEVELS } from "./levels"

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

describe("генераторы уровней — верхняя HUD-зона", () => {
  const top = 96

  it("grid и layout держат верх блока ниже границы зоны с учётом ry", () => {
    const pattern = LEVELS.find((level) => "rows" in level)
    const layout = LEVELS.find((level) => "layout" in level)
    if (!pattern || !("rows" in pattern) || !layout || !("layout" in layout)) {
      throw new Error("Ожидались pattern и layout fixtures")
    }

    const generated = [
      ...gridBlocks(pattern, 1200, 700, 1, top),
      ...layoutBlocks(layout, 1200, 700, 1, top),
    ]

    expect(generated.length).toBeGreaterThan(0)
    for (const block of generated) expect(block.y - block.ry).toBeGreaterThanOrEqual(top)
  })

  it("boss arena сохраняет босса, minions и bombs ниже HUD-зоны", () => {
    const { boss, blocks } = buildBossArena(20, 3, 4, 1200, 700, top)
    expect(boss.baseY - boss.r).toBeGreaterThanOrEqual(top)
    for (const block of blocks) {
      if (block.minionOrbit) {
        expect(boss.baseY - block.minionOrbit.rad - block.ry).toBeGreaterThanOrEqual(top)
      } else {
        expect(block.y - block.ry).toBeGreaterThanOrEqual(top)
      }
    }
  })

  it("ограничивает орбиту миньонов при тесной boss arena", () => {
    const { boss, blocks } = buildBossArena(20, 3, 0, 600, 300, 90)
    for (const block of blocks) {
      if (!block.minionOrbit) continue
      expect(boss.baseY - block.minionOrbit.rad * 1.6 - block.ry).toBeGreaterThanOrEqual(90)
    }
  })
})

describe("прицел запуска для чаши", () => {
  it("отражает направление внутрь чаши симметрично от обоих краёв", () => {
    const right = paddleLaunchAngle("concave", 0.8, 60)
    const left = paddleLaunchAngle("concave", -0.8, 60)
    expect(right).toBeLessThan(-Math.PI / 2)
    expect(left).toBeGreaterThan(-Math.PI / 2)
    expect(right + left).toBeCloseTo(-Math.PI)
  })

  it("в центре чаши направление вертикальное", () => {
    expect(paddleLaunchAngle("concave", 0, 60)).toBeCloseTo(-Math.PI / 2)
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

  it.each([
    ["mode repel", { radius: 100, force: 500, mode: "repel" as const }],
    ["negative force", { radius: 100, force: -500 }],
  ])("магнит отталкивает шар (%s)", (_label, magnet) => {
    const block = makeBlock(false)
    block.sp = { magnet }
    const { world, ball } = makeWorld(block, false)
    ball.x = 275
    ball.y = 100
    ball.vx = 0
    ball.vy = -ball.speed
    ball.sinceHit = 0

    for (let i = 0; i < 20; i++) new Physics(world).updateBall(ball, 0.016)

    expect(ball.vx).toBeGreaterThan(ball.speed * 0.015)
    expect(ball.vx).toBeLessThan(ball.speed * 0.35)
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

  it.each(["portrait", "landscape"] as const)("шар отражается от границы зоны (%s)", () => {
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

  it("прицел находит ближайшее столкновение с блоком и отражённый вектор", () => {
    const world = makeTopWorld(0)
    Object.assign(world, {
      aimAngle: -Math.PI / 2,
      aimGuideActive: () => true,
      bounceGuideActive: () => true,
      magneticPaddleActive: () => false,
    })
    world.blocks.push({
      x: 200,
      y: 180,
      rx: 40,
      ry: 16,
      rot: 0,
      dead: false,
      hp: 1,
    } as Block)
    const ball = { ...makeTopBall(), x: 200, y: 300, r: 10 }
    const guide = new Physics(world).aimGuide(ball)
    expect(guide?.hitX).toBeCloseTo(200)
    expect(guide?.hitY).toBeCloseTo(206)
    expect(guide?.bounceDy).toBeGreaterThan(0)
  })

  it("магнитная ракетка ловит мяч в точке столкновения", () => {
    const world = makeTopWorld(0)
    const paddle = { x: 200, y: 560, w: 90, h: 14, vx: 0, squash: 0 }
    Object.assign(world, {
      paddle,
      magneticPaddleActive: () => true,
      magnetActive: () => false,
      paddleShape: () => "flat" as const,
      sfx: { paddle() {} },
      fx: { burst() {} },
    })
    const ball = {
      ...makeTopBall(),
      x: 225,
      y: 550,
      vx: 0,
      vy: 100,
      r: 10,
      sinceHit: 1,
    }
    const physics = new Physics(world)
    physics.updateBall(ball, 0.016)
    expect(ball.stuck).toBe(true)
    expect(ball.stuckOffset).toBeCloseTo(25)
    expect(ball.vx).toBe(0)
    expect(ball.vy).toBe(0)
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
