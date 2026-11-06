import { describe, expect, it, vi } from "vitest"

import {
  applyKrakenVortexPhysics,
  buildKrakenBoss,
  clearKraken,
  KRAKEN_SEG_COUNT,
  KRAKEN_SHARD_COUNT,
  KRAKEN_TENTACLES,
  KRAKEN_VORTEX_RANGE,
  rebirthKraken,
  stepKraken,
} from "./bossKraken"
import { BossSystem, type BossHost } from "./boss"
import type { Ball, Block, BossState } from "./types"

function makeMockHost(over: Partial<Record<string, unknown>> = {}): BossHost {
  return {
    w: 800,
    h: 600,
    blockTop: 60,
    time: 0,
    shake: 0,
    hitStop: 0,
    flash: 0,
    blocks: [] as Block[],
    powers: [],
    boomQueue: [] as { x: number; y: number; at: number }[],
    paddle: { x: 400, y: 560, w: 90, h: 14 },
    fx: { burst: vi.fn(), rings: [], popups: [], particles: [] },
    sfx: {
      brick: vi.fn(),
      bossPhase: vi.fn(),
      bossDie: vi.fn(),
      power: vi.fn(),
      setBattleIntensity: vi.fn(),
    },
    addRawScore: vi.fn(),
    onBossKilled: vi.fn(),
    pushHud: vi.fn(),
    killBoss: vi.fn(),
    ...over,
  } as unknown as BossHost
}

function makeBall(x: number, y: number, vx = 0, vy = 300): Ball {
  return {
    x,
    y,
    vx,
    vy,
    r: 9,
    speed: Math.hypot(vx, vy),
    stuck: false,
    stuckOffset: 0,
    squash: 1,
    sinceHit: 0,
    trail: [],
  }
}

describe("bossKraken — создание и конфигурация", () => {
  it("buildKrakenBoss создаёт босса и 8 щупалец по 4 сегмента", () => {
    const { boss, blocks } = buildKrakenBoss(800, 600, 80)
    expect(boss.isKraken).toBe(true)
    expect(boss.krakenPhase).toBe(1)
    expect(boss.totalTentacles).toBe(KRAKEN_TENTACLES)
    expect(boss.hp).toBeGreaterThan(0)
    expect(boss.krakenPhase2Hp).toBeGreaterThan(0)

    // 8 щупалец × 4 сегмента = 32 блока
    expect(blocks).toHaveLength(KRAKEN_TENTACLES * KRAKEN_SEG_COUNT)

    const tentacleIds = new Set(blocks.map((b) => b.tentacleId))
    expect(tentacleIds.size).toBe(KRAKEN_TENTACLES)

    const segs = blocks.filter((b) => b.tentacleId === 0)
    expect(segs).toHaveLength(KRAKEN_SEG_COUNT)
    expect(segs[0].isTentacle).toBe(true)
  })
})

describe("bossKraken — Фаза I: поведение и защита", () => {
  it("stepKraken волнообразно анимирует щупальца в Фазе 1", () => {
    const { boss, blocks } = buildKrakenBoss(800, 600, 70)
    const host = makeMockHost({ blocks })

    const initialX = blocks[0].x
    boss.t = 0.5
    stepKraken(host, boss, false, 0.1)

    // Координаты сегментов сдвинулись от волновой анимации
    expect(blocks[0].x).not.toBe(initialX)
  })

  it("в Фазе 1 урон по телу блокируется, пока живы щупальца", () => {
    const { boss, blocks } = buildKrakenBoss(800, 600, 70)
    const host = makeMockHost({ blocks })
    const sys = new BossSystem(host)
    sys.spawn(boss)

    const hpBefore = boss.hp
    sys.damage(10, false)

    // Урон не прошёл, сработал всплеск барьера
    expect(boss.hp).toBe(hpBefore)
    expect(host.sfx.brick).toHaveBeenCalledWith(1)
  })

  it("после сноса всех щупалец урон проходит по телу Кракена-Титана", () => {
    const { boss, blocks } = buildKrakenBoss(800, 600, 70)
    // Убиваем все щупальца
    for (const b of blocks) b.dead = true
    const host = makeMockHost({ blocks: blocks.filter((b) => !b.dead) })
    const sys = new BossSystem(host)
    sys.spawn(boss)

    const hpBefore = boss.hp
    sys.damage(5, false)

    expect(boss.hp).toBe(hpBefore - 5)
  })
})

describe("bossKraken — Перерождение (Rebirth) во 2-ю ипостась", () => {
  it("при обнулении HP Фазы 1 срабатывает rebirthKraken вместо окончательной смерти", () => {
    const { boss, blocks } = buildKrakenBoss(800, 600, 70)
    for (const b of blocks) b.dead = true
    const host = makeMockHost({ blocks: [] })
    const sys = new BossSystem(host)
    sys.spawn(boss)

    boss.hp = 2
    sys.damage(5, false) // Смертельный урон по Фазе 1

    // Босс НЕ умер окончательно:
    expect(host.onBossKilled).not.toHaveBeenCalled()
    expect(boss.krakenPhase).toBe(2)
    expect(boss.hp).toBe(boss.krakenPhase2Hp)
    expect(boss.maxHp).toBe(boss.krakenPhase2Hp)

    // Заспавнены 3 квантовых осколка реальности
    const shards = host.blocks.filter((b) => b.isKrakenShard)
    expect(shards).toHaveLength(KRAKEN_SHARD_COUNT)

    // Сыграли звуки перерождения и выставлены баннеры
    expect(host.sfx.bossDie).toHaveBeenCalled()
    expect(host.sfx.bossPhase).toHaveBeenCalledWith("kraken")
    expect(host.sfx.setBattleIntensity).toHaveBeenCalledWith("last_stand")
    expect(host.fx.popups.some((p) => p.text.includes("ФАЗА II: ЯДРО РАЗЛОМА"))).toBe(true)
  })

  it("rebirthKraken детонирует все оставшиеся щупальца первой фазы", () => {
    const { boss, blocks } = buildKrakenBoss(800, 600, 70)
    const host = makeMockHost({ blocks: [...blocks] })

    rebirthKraken(host, boss)

    // Все щупальца умерли и попали в очередь взрывов
    expect(host.boomQueue.length).toBe(blocks.length)
    expect(host.blocks.filter((b) => b.isTentacle)).toHaveLength(0)
  })
})

describe("bossKraken — Фаза II: Ядро Разлома и гравитация", () => {
  it("вращает аккреционный диск и активирует гравитационный прилив", () => {
    const { boss } = buildKrakenBoss(800, 600, 70)
    boss.krakenPhase = 2
    boss.krakenVortexTimer = 0.05
    boss.krakenVortexActive = false

    const host = makeMockHost()
    stepKraken(host, boss, false, 0.1)

    expect(boss.krakenRiftAngle).toBeGreaterThan(0)
    expect(boss.krakenVortexActive).toBe(true)
    expect(host.fx.popups.some((p) => p.text.includes("ГРАВИТАЦИОННЫЙ ПРИЛИВ"))).toBe(true)
  })

  it("applyKrakenVortexPhysics притягивает и искривляет траекторию шара", () => {
    const boss: BossState = {
      x: 400,
      y: 200,
      baseY: 200,
      r: 54,
      hp: 50,
      maxHp: 50,
      t: 0,
      flash: 0,
      dropTimer: 10,
      isKraken: true,
      krakenPhase: 2,
      krakenVortexActive: true,
    }

    const ball = makeBall(300, 200, 0, 300)
    applyKrakenVortexPhysics(boss, ball, 0.05)

    // Шар притянулся к центру босса (dx > 0 -> vx увеличился вправо)
    expect(ball.vx).toBeGreaterThan(0)
  })

  it("applyKrakenVortexPhysics не действует на шары вне радиуса воронки", () => {
    const boss: BossState = {
      x: 400,
      y: 100,
      baseY: 100,
      r: 54,
      hp: 50,
      maxHp: 50,
      t: 0,
      flash: 0,
      dropTimer: 10,
      isKraken: true,
      krakenPhase: 2,
      krakenVortexActive: true,
    }

    const ball = makeBall(400, 100 + KRAKEN_VORTEX_RANGE + 50, 0, 300)
    const vxBefore = ball.vx
    const vyBefore = ball.vy
    applyKrakenVortexPhysics(boss, ball, 0.05)

    expect(ball.vx).toBe(vxBefore)
    expect(ball.vy).toBe(vyBefore)
  })

  it("в Фазе 2 урон до 0 окончательно убивает босса", () => {
    const { boss } = buildKrakenBoss(800, 600, 70)
    boss.krakenPhase = 2
    boss.hp = 10
    boss.maxHp = 50

    const host = makeMockHost()
    const sys = new BossSystem(host)
    sys.spawn(boss)

    sys.damage(12, false)

    // Финальная смерть зафиксирована
    expect(host.onBossKilled).toHaveBeenCalled()
    expect(sys.boss).toBeNull()
  })

  it("clearKraken корректно удаляет все щупальца и квантовые осколки", () => {
    const blocks: Block[] = [
      { hp: 4, dead: false, isTentacle: true } as Block,
      { hp: 4, dead: false, isKrakenShard: true } as Block,
      { hp: 2, dead: false } as Block,
    ]

    clearKraken(blocks)

    expect(blocks[0].dead).toBe(true)
    expect(blocks[1].dead).toBe(true)
    expect(blocks[2].dead).toBe(false)
  })
})

describe("bossKraken — рендеринг (drawBoss)", () => {
  function makeMockCtx() {
    const calls: string[] = []
    const grad = { addColorStop: () => {} }
    const ctx = {
      canvas: { width: 800, height: 600 },
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      translate: () => calls.push("translate"),
      beginPath: () => calls.push("beginPath"),
      closePath: () => calls.push("closePath"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      arc: () => calls.push("arc"),
      ellipse: () => calls.push("ellipse"),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      fillRect: () => calls.push("fillRect"),
      fillText: () => calls.push("fillText"),
      createRadialGradient: () => {
        calls.push("radialGradient")
        return grad
      },
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      shadowColor: "",
      shadowBlur: 0,
      font: "",
      textAlign: "center",
      textBaseline: "alphabetic",
    }
    return { ctx, calls }
  }

  it("успешно рендерит Фазу I (Кракен-Титан) без ошибок", async () => {
    const { drawBoss } = await import("./render/boss")
    const { boss, blocks } = buildKrakenBoss(800, 600, 70)
    const { ctx, calls } = makeMockCtx()
    const ball = makeBall(400, 300)

    expect(() => drawBoss(ctx as never, boss, [ball], blocks)).not.toThrow()
    expect(calls).toContain("radialGradient")
    expect(calls).toContain("arc")
    expect(calls).toContain("ellipse") // Око Энтропии
  })

  it("успешно рендерит Фазу II (Ядро Разлома) и квантовые осколки", async () => {
    const { drawBoss } = await import("./render/boss")
    const { boss } = buildKrakenBoss(800, 600, 70)
    boss.krakenPhase = 2
    boss.krakenVortexActive = true

    const shards: Block[] = [
      {
        x: 300,
        y: 150,
        rx: 16,
        ry: 16,
        hp: 4,
        maxHp: 4,
        isKrakenShard: true,
        dead: false,
      } as Block,
    ]

    const { ctx, calls } = makeMockCtx()
    expect(() => drawBoss(ctx as never, boss, [], shards)).not.toThrow()
    expect(calls).toContain("radialGradient")
    expect(calls).toContain("fillRect") // HP полоска осколка
  })
})
