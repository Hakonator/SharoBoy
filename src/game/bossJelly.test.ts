import { describe, expect, it } from "vitest"

import { makeEnv } from "./frameInvariant.helpers"
import type { Block, BossState } from "./types"
import {
  JELLY_BOLT_EVERY,
  JELLY_BOLT_SPEED,
  JELLY_MIN_PULSE_SCALE,
  JELLY_SEG_COUNT,
  JELLY_TENTACLES,
  jellyBodyMinY,
  jellyPulse,
  updateJellyTentacles,
} from "./bossJelly"

const world = { w: 960, h: 640 }

function makeJelly(): BossState {
  return {
    x: 480,
    y: 154,
    baseY: 154,
    r: 52,
    hp: 100,
    maxHp: 100,
    t: 2,
    flash: 0,
    dropTimer: 4,
    isJellyfish: true,
    totalTentacles: JELLY_TENTACLES,
    pulsePhase: 0,
    pulseScale: 1,
    boltTimer: JELLY_BOLT_EVERY,
    chargeTent: null,
    chargeT: 0,
  }
}

function makeTentacles(): Block[] {
  const blocks: Block[] = []
  for (let i = 0; i < JELLY_TENTACLES; i++) {
    for (let seg = 0; seg < JELLY_SEG_COUNT; seg++) {
      blocks.push({
        x: 480,
        y: 200,
        rx: 7,
        ry: 7,
        rot: 0,
        circle: true,
        hp: 4,
        maxHp: 4,
        tier: 2,
        flash: 0,
        seed: 0,
        dead: false,
        x0: 480,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: false,
        isTentacle: true,
        tentacleId: i,
        tentacleSeg: seg,
      } as Block)
    }
  }
  return blocks
}

describe("jellyPulse: настоящий пульс медузы", () => {
  it("оставляет купол достижимым над верхней границей поля", () => {
    expect(jellyBodyMinY(350, 68)).toBe(418)
    expect(jellyBodyMinY(0, 68)).toBe(68)
  })

  it("купол сжимается и расправляется в пределах шкалы", () => {
    for (let i = 0; i < 100; i++) {
      const { scale } = jellyPulse(i / 100)
      expect(scale).toBeGreaterThanOrEqual(JELLY_MIN_PULSE_SCALE - 1e-9)
      expect(scale).toBeLessThanOrEqual(1 + 1e-9)
    }
    expect(jellyPulse(0).scale).toBeCloseTo(1)
    expect(jellyPulse(0.28).scale).toBeCloseTo(JELLY_MIN_PULSE_SCALE)
    expect(jellyPulse(1).scale).toBeCloseTo(1)
    // в середине фазы сжатия купол реально сжат
    expect(jellyPulse(0.14).scale).toBeLessThan(0.9)
  })

  it("сжатие выбрасывает тело вверх, расширение опускает", () => {
    expect(jellyPulse(0.14).vy).toBeLessThan(0)
    expect(jellyPulse(0.64).vy).toBeGreaterThan(0)
    // в «злой» фазе толчок сильнее
    expect(Math.abs(jellyPulse(0.14, true).vy)).toBeGreaterThan(Math.abs(jellyPulse(0.14).vy))
  })
})

describe("updateJellyTentacles: отростки привязаны к куполу", () => {
  it("отростки свисают ниже купола, кончики — самые нижние сегменты", () => {
    const bo = makeJelly()
    const blocks = makeTentacles()
    updateJellyTentacles(world, bo, blocks)
    for (let i = 0; i < JELLY_TENTACLES; i++) {
      const base = blocks.find((b) => b.tentacleId === i && b.tentacleSeg === 0)!
      const tip = blocks.find((b) => b.tentacleId === i && b.tentacleSeg === JELLY_SEG_COUNT - 1)!
      expect(base.y).toBeGreaterThan(bo.y)
      expect(tip.y).toBeGreaterThan(base.y)
      // длина отростка ≈ размер туловища (диаметр купола)
      expect(tip.y - base.y).toBeGreaterThan(bo.r)
      expect(tip.y - base.y).toBeLessThan(bo.r * 3)
    }
  })

  it("при сжатии купола разлёт отростков уменьшается (дышат вместе с телом)", () => {
    const spread = (blocks: Block[]) => Math.max(...blocks.map((b) => Math.abs(b.x - 480)))
    const a = makeJelly()
    const blocksA = makeTentacles()
    a.pulseScale = 1
    updateJellyTentacles(world, a, blocksA)
    const c = makeJelly()
    const blocksC = makeTentacles()
    c.pulseScale = JELLY_MIN_PULSE_SCALE
    updateJellyTentacles(world, c, blocksC)
    expect(spread(blocksC)).toBeLessThan(spread(blocksA))
  })

  it("сжатый купол тянет отростки вверх, но они остаются ниже него", () => {
    const bo = makeJelly()
    const blocks = makeTentacles()
    bo.pulseScale = JELLY_MIN_PULSE_SCALE
    updateJellyTentacles(world, bo, blocks)
    for (const b of blocks) expect(b.y).toBeGreaterThan(bo.y)
  })
})

describe("stepJellyfish: молнии (интеграция через игровой цикл)", () => {
  it("кончик искрит перед выстрелом, затем летит молния в ракетку", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("jellyfish")
      const boss = game.bossSys.boss as BossState
      expect(boss.isJellyfish).toBe(true)
      const tentacles = () => game.blocks.filter((b) => b.isTentacle && !b.dead)
      expect(tentacles().length).toBe(JELLY_TENTACLES * JELLY_SEG_COUNT)
      // отростки пересчитываются каждый кадр (извиваются)
      const xBefore = tentacles()[0].x
      step(3)
      expect(tentacles()[0].x).not.toBe(xBefore)

      // ~8.5 с: телеграф ещё не начался (выстрел раз в 10 с)
      step(509)
      expect(boss.chargeTent ?? null).toBeNull()
      expect(game.blocks.filter((b) => b.bolt).length).toBe(0)

      // ~8.9 с: кончик выбранного отростка начал искрить
      step(24)
      expect(boss.chargeTent).not.toBeNull()
      expect(boss.chargeT ?? 0).toBeGreaterThan(0)
      expect(boss.chargeT ?? 0).toBeLessThan(1)

      // ~10.1 с: искрение завершилось — молния вылетела
      for (let i = 0; i < 72; i += 12) step(12)
      const bolts = game.blocks.filter((b) => b.bolt)
      expect(bolts.length).toBe(1)
      const bolt = bolts[0]
      // молния летит в ракетку со скоростью JELLY_BOLT_SPEED — быстро, но не мгновенно
      const speed = Math.hypot(bolt.bombVx ?? 0, bolt.bombVy ?? 0)
      expect(speed).toBeCloseTo(JELLY_BOLT_SPEED)
      expect(bolt.hitsPaddle).toBe(true)
      expect(speed * 0.0167).toBeLessThan(game.w * 0.33)
      // после выстрела таймер снова почти на полном интервале (минус dt кадра)
      expect(boss.boltTimer).toBeGreaterThan(JELLY_BOLT_EVERY - 0.5)
      expect(boss.chargeTent).toBeNull()
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("тело медузы неуязвимо, пока живы отростки", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("jellyfish")
      const boss = game.bossSys.boss as BossState
      const hp = boss.hp
      game.bossSys.damage(10, false)
      expect(boss.hp).toBe(hp) // урон заблокирован
      // уничтожаем все отростки — тело становится уязвимым
      for (const b of game.blocks.filter((x) => x.isTentacle)) b.dead = true
      game.blocks = game.blocks.filter((x) => !x.dead)
      game.bossSys.damage(10, false)
      expect(boss.hp).toBe(hp - 10)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("после уничтожения кончиков усечённые отростки продолжают стрелять", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("jellyfish")
      const boss = game.bossSys.boss as BossState
      // первый выстрел по расписанию (~10.1 с)
      step(606)
      expect(game.blocks.filter((b) => b.bolt).length).toBe(1)
      // сносим все прежние кончики (seg 3) — остаются усечённые отростки
      game.blocks = game.blocks.filter(
        (b) => !(b.isTentacle && b.tentacleSeg === JELLY_SEG_COUNT - 1)
      )
      const aliveSegs = new Set(game.blocks.filter((b) => b.isTentacle).map((b) => b.tentacleSeg))
      expect(aliveSegs.has(JELLY_SEG_COUNT - 1)).toBe(false)
      // сокращаем ожидание и даём выстрелить: молния должна прилететь
      // из нового кончика (seg 2), а не исчезнуть вместе с прежними
      boss.boltTimer = 1.4
      step(90)
      expect(game.blocks.filter((b) => b.bolt).length).toBe(1)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})
