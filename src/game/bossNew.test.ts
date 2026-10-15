import { describe, expect, it } from "vitest"

import { buildCrabBoss, stepCrab, updateCrabClaws } from "./bossCrab"
import { applyChronoRiftsToBalls, buildChronoBoss, stepChrono } from "./bossChrono"
import type { Ball } from "./types"
import type { BossHost } from "./boss"

function makeFakeHost(): BossHost {
  return {
    w: 800,
    h: 600,
    blockTop: 60,
    time: 0,
    blocks: [],
    shake: 0,
    balls: [],
    projectiles: [],
    sfx: {
      bossHit: () => {},
      bossDefeat: () => {},
      brick: () => {},
      zap: () => {},
    },
    fx: {
      burst: () => {},
      rings: [],
      lightnings: [],
    },
    physics: {
      damageBlock: () => {},
    },
    onCleared: () => {},
    pushHud: () => {},
    loseLife: () => {},
  } as unknown as BossHost
}

describe("Boss: Меха-Краб (crab)", () => {
  it("создаёт панцирь и 6 сегментов клешней с флагом isClaw", () => {
    const { boss, blocks } = buildCrabBoss(800, 600, 60)
    expect(boss.isCrab).toBe(true)
    expect(boss.hp).toBe(60)
    expect(blocks.length).toBe(6)

    const leftClaws = blocks.filter((b) => b.isClaw && b.clawSide === "left")
    const rightClaws = blocks.filter((b) => b.isClaw && b.clawSide === "right")
    expect(leftClaws.length).toBe(3)
    expect(rightClaws.length).toBe(3)

    // Проверяем сегменты 0, 1, 2
    expect(leftClaws.map((b) => b.clawSeg).sort()).toEqual([0, 1, 2])
    expect(rightClaws.map((b) => b.clawSeg).sort()).toEqual([0, 1, 2])
  })

  it("updateCrabClaws перемещает сегменты в зависимости от времени", () => {
    const { boss, blocks } = buildCrabBoss(800, 600, 60)
    const initX = blocks[0].x
    boss.t = 1.5
    updateCrabClaws(boss, blocks)
    expect(blocks[0].x).not.toBe(initX)
  })

  it("stepCrab уменьшает таймер защёлкивания клешней", () => {
    const host = makeFakeHost()
    const { boss, blocks } = buildCrabBoss(800, 600, 60)
    host.blocks = blocks
    boss.clawSnapTimer = 0.5
    stepCrab(host, boss, false, 0.2)
    expect(boss.clawSnapTimer).toBeCloseTo(0.3)
  })
})

describe("Boss: Повелитель Времени (chrono)", () => {
  it("создаёт ядро и орбитальные хроно-кристаллы", () => {
    const { boss, blocks } = buildChronoBoss(800, 600, 65, { minions: 4 })
    expect(boss.isChrono).toBe(true)
    expect(boss.hp).toBe(65)
    expect(blocks.length).toBe(4)
    expect(blocks.every((b) => b.minionOrbit !== undefined)).toBe(true)
  })

  it("stepChrono спавнит и двигает временные воронки", () => {
    const host = makeFakeHost()
    const { boss, blocks } = buildChronoBoss(800, 600, 65)
    host.blocks = blocks
    boss.chronoTimer = 0.05
    stepChrono(host, boss, false, 0.1)

    expect(boss.chronoRifts).toBeDefined()
    expect(boss.chronoRifts!.length).toBeGreaterThan(0)
    const rift = boss.chronoRifts![0]
    expect(["slow", "fast"]).toContain(rift.kind)
    expect(rift.life).toBeGreaterThan(0)

    // Шаг движения
    stepChrono(host, boss, false, 0.1)
    expect(rift.life).toBeLessThan(rift.maxLife)
  })

  it("applyChronoRiftsToBalls изменяет chronoMult внутри воронки", () => {
    const ball: Ball = {
      x: 400,
      y: 300,
      vx: 200,
      vy: -200,
      r: 6,
      speed: 280,
      stuck: false,
      stuckOffset: 0,
      trail: [],
      squash: 0,
      sinceHit: 0,
      chronoMult: 1.0,
    }

    // Лазурная замедляющая воронка прямо на шаре
    const slowRift = {
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      r: 60,
      kind: "slow" as const,
      life: 5,
      maxLife: 5,
    }

    applyChronoRiftsToBalls([slowRift], [ball], 0.1)
    expect(ball.chronoMult).toBeLessThan(1.0)

    // Пурпурная ускоряющая воронка прямо на шаре
    const fastRift = {
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      r: 60,
      kind: "fast" as const,
      life: 5,
      maxLife: 5,
    }
    ball.chronoMult = 1.0
    applyChronoRiftsToBalls([fastRift], [ball], 0.1)
    expect(ball.chronoMult).toBeGreaterThan(1.0)

    // Без воронок — плавный возврат к 1.0
    applyChronoRiftsToBalls([], [ball], 0.5)
    expect(ball.chronoMult).toBeCloseTo(1.0, 1)
  })
})
