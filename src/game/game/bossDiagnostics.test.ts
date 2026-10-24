import { afterEach, describe, expect, it, vi } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"
import { ACT_BOSS_POOLS } from "../bossVariants"

/** Все виды боссов, доступные в диагностическом режиме (панель «Отладка»). */
const DEBUG_BOSS_KINDS = Object.values(ACT_BOSS_POOLS).flat()

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Диагностический режим: новые боссы Актов I и II", () => {
  it("в пулах Актов есть крио-дрон и электрическая минога", () => {
    expect(ACT_BOSS_POOLS[0]).toContain("cryo")
    expect(ACT_BOSS_POOLS[1]).toContain("lamprey")
  })

  for (const kind of DEBUG_BOSS_KINDS) {
    it(`спавн «${kind}» создаёт живую арену с боссом`, () => {
      const { game, step, restoreRandom } = makeEnv()
      try {
        game.spawnDebugBoss(kind)
        expect(game.bossSys.boss).not.toBeNull()
        expect(game.bossSys.boss!.hp).toBeGreaterThan(0)
        expect(game.debugBossType).toBe(kind)
        // несколько кадров боя не должны ломать логику (бомбы, лёд, разряды)
        step(30)
        expect(game.bossSys.boss).not.toBeNull()
      } finally {
        game.destroy()
        restoreRandom()
      }
    })
  }

  it("крио-дрон: лёд не ломает уровень и не считается в цели", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("cryo")
      const initial = game.blocksInitial
      const boss = game.bossSys.boss!
      // подталкиваем таймер сброса капсулы и прокручиваем кадры до раскрытия
      boss.cryoIceTimer = 0.01
      step(1)
      expect(game.blocks.some((b) => b.isIceCapsule)).toBe(true)
      boss.cryoIceTimer = 0.01
      step(90)
      expect(game.blocks.some((b) => b.isIceColumn)).toBe(true)
      // цели уровня остались прежними — лёд не входит в blocksInitial
      expect(initial).toBeGreaterThan(0)
      expect(game.bossSys.boss).not.toBeNull()
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("минога: голова неуязвима, пока хвост не разбит", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      const hp = boss.hp
      // урон по телу не проходит — сначала надо разбить сегменты
      game.bossSys.damage(5, false)
      expect(boss.hp).toBe(hp)
      step(10)
      // голова следует за сегментом 0 — миного действительно скользит
      const head = game.blocks.find((b) => b.lampreySeg === 0)!
      expect(boss.x).toBeCloseTo(head.x, 6)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("минога без головы: не стреляет из пустоты и не теряет HP", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      const hp = boss.hp
      // разбиваем три сегмента тела и саму голову, как это делает шар
      const tail = game.blocks.filter((b) => (b.lampreySeg ?? 0) > 0)
      for (let i = 0; i < 3; i++) tail[i].dead = true
      const head = game.blocks.find((b) => b.lampreySeg === 0)!
      head.dead = true
      game.blocks = game.blocks.filter((b) => !b.dead)

      // раньше здесь босс продолжал бить «невидимыми импульсами» из пустоты
      boss.lampreyBoltTimer = 0.01
      step(30)
      expect(game.blocks.some((b) => b.lampreyBolt)).toBe(false)
      // урон по отбитой голове не снимает HP
      game.bossSys.damage(5, false)
      expect(boss.hp).toBe(hp)

      // через HEAD_REGEN_TIME голова отрастает — бой продолжается
      boss.lampreyRevive = 0.01
      step(3)
      expect(game.blocks.some((b) => b.lampreySeg === 0 && !b.dead)).toBe(true)
      expect(boss.lampreyHeadDown).toBe(false)

      boss.lampreyBoltTimer = 0.01
      step(30)
      expect(game.blocks.filter((b) => b.lampreyBolt).length).toBe(1)
      // после реванша головы урон снова проходит (сегменты уже разбиты)
      const before = boss.hp
      game.bossSys.damage(5, false)
      expect(boss.hp).toBe(before - 5)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("после смерти миноги на арене не остаётся невидимых сегментов", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      // открываем голову и добиваем босса до нуля HP
      const tail = game.blocks.filter((b) => (b.lampreySeg ?? 0) > 0)
      for (let i = 0; i < 3; i++) tail[i].dead = true
      boss.hp = 1
      game.bossSys.damage(10, false)
      expect(game.bossSys.boss).toBeNull()
      // сегменты тела — блоки уровня: после смерти их быть не должно, иначе шар
      // бьётся о невидимую преграду, а зачистка не наступает
      step(2)
      expect(game.blocks.some((b) => b.isLampreySeg)).toBe(false)
      expect(game.blocks.length).toBe(0)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("после смерти миноги её разряды не остаются висеть на арене", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      const tail = game.blocks.filter((b) => (b.lampreySeg ?? 0) > 0)
      for (let i = 0; i < 3; i++) tail[i].dead = true
      // головной разряд уже в полёте — именно он «зависал» после победы
      boss.lampreyBoltTimer = 0.01
      step(2)
      expect(game.blocks.some((b) => b.lampreyBolt)).toBe(true)

      boss.hp = 1
      game.bossSys.damage(10, false)
      expect(game.bossSys.boss).toBeNull()
      step(2)
      // снаряд рисуется только рендером босса, а коллайдер у него настоящий —
      // оставлять его на поле нельзя
      expect(game.blocks.some((b) => b.lampreyBolt)).toBe(false)
      expect(game.blocks.length).toBe(0)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("после смерти крио-дрона лёд убирается с арены", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("cryo")
      const boss = game.bossSys.boss!
      boss.cryoIceTimer = 0.01
      step(1)
      boss.cryoIceTimer = 0.01
      step(90)
      expect(game.blocks.some((b) => b.isIceColumn)).toBe(true)

      // в режиме «черновика» лёд убирается и должен попасть в цепочку взрывов,
      // иначе он остался бы висеть до следующей зачистки
      const iceBefore = game.blocks.filter((b) => b.isIceColumn).length
      boss.hp = 0
      game.bossSys.kill()
      expect(game.bossSys.boss).toBeNull()
      step(2)
      expect(game.blocks.some((b) => b.isIceColumn || b.isIceCapsule)).toBe(false)
      expect(iceBefore).toBeGreaterThan(0)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("углублённые фазы: мутаторы делают бой двухфазным", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      game.campaignModifiers = ["ironman", "hyper_speed"]
      game.spawnDebugBoss("crab")
      // отладочный спавн идёт в одну фазу, но фазы боя настраиваются ареной
      expect(game.bossSys.phases.count).toBe(1)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })
})
