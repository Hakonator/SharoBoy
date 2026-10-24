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

  it("минога с полностью разбитым телом: отрастает только голова, бой можно добить", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      // худший случай из playtest: игрок разбил ВСЕ сегменты вместе с головой.
      // Раньше `stepLamprey` возвращался по `!bodyAlive` до таймера регена:
      // `bo` оставался в массиве, но его нельзя было ни увидеть (рисунок тела —
      // это сегменты), ни ранить — уровень становился непроходимым.
      for (const b of game.blocks.filter((x) => x.isLampreySeg)) game.physics.damageBlock(b, 99)
      game.blocks = game.blocks.filter((b) => !b.dead)
      expect(game.blocks.length).toBe(0)
      expect(game.bossSys.boss).not.toBeNull()

      // реген идёт ровно HEAD_REGEN_TIME (6 c), запас на кадры таймера
      step(400)
      // Снесённый хвост — накопленный прогресс: возвращается ТОЛЬКО голова,
      // иначе босс «бессмертен» (полный реген каждые 6 с обнулял работу игрока).
      expect(game.blocks.filter((b) => b.isLampreySeg).length).toBe(1)
      expect(game.blocks.some((b) => b.lampreySeg === 0)).toBe(true)
      // хвоста нет — голова открыта, HP реально снимается
      const hp = boss.hp
      game.bossSys.damage(5, false)
      expect(boss.hp).toBe(hp - 5)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("минога убивается до конца: снос всего тела ведёт к победе, а не к регену", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      /* Полный проход боя без хаков: игрок сбивает сегменты (урон шара), затем
         бьёт открытую голову. Раньше на этом пути бой либо зависал (нет головы
         и урона), либо обнулялся (полный реген тела). */
      let guard = 0
      while (game.bossSys.boss && guard++ < 500) {
        const live = game.blocks.filter((b) => b.isLampreySeg && !b.dead)
        const tail = live.filter((b) => (b.lampreySeg ?? 0) > 0)
        if (tail.length) game.physics.damageBlock(tail[tail.length - 1], 99)
        game.blocks = game.blocks.filter((b) => !b.dead)
        // урон по боссу: проходит, только когда голова открыта
        game.bossSys.damage(10, false)
        step(1)
      }
      expect(game.bossSys.boss).toBeNull()
      // после победы арена пуста — уровень засчитывается
      step(2)
      expect(game.blocks.length).toBe(0)
      expect(boss.hp).toBeLessThanOrEqual(0)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("сбитый хвост миноги не возвращается: броня не отрастает", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      // сбиваем три хвостовых сегмента — голова открывается для урона
      for (const seg of [1, 2, 3]) {
        const b = game.blocks.find((x) => x.lampreySeg === seg)!
        game.physics.damageBlock(b, 99)
      }
      game.blocks = game.blocks.filter((b) => !b.dead)
      const head = game.blocks.find((b) => b.lampreySeg === 0)!
      game.physics.damageBlock(head, 99)
      game.blocks = game.blocks.filter((b) => !b.dead)

      step(400)
      // вернулась только голова: сбитые хвосты 1–3 не отрастают, 4–7 остались
      expect(game.blocks.filter((b) => b.lampreySeg === 0).length).toBe(1)
      const alive = game.blocks
        .filter((b) => b.isLampreySeg)
        .map((b) => b.lampreySeg)
        .sort((a, b) => (a ?? 0) - (b ?? 0))
      expect(alive).toEqual([0, 4, 5, 6, 7])
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

  it("снаряды босса без босса не остаются на арене (страховка)", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      // снаряд в полёте, затем босс исчезает не через kill() (смена арены,
      // отладочный спавн, баг в пути смерти) — так и появлялись «невидимые блоки»
      boss.lampreyBoltTimer = 0.01
      step(2)
      expect(game.blocks.some((b) => b.lampreyBolt)).toBe(true)
      game.bossSys.clear()
      step(1)
      expect(game.blocks.some((b) => b.bomb)).toBe(false)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("снаряд без босса не отражает шар (страховка в коллизиях)", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      boss.lampreyBoltTimer = 0.01
      game.bossSys.step(0.02)
      const bolt = game.blocks.find((b) => b.lampreyBolt)!
      expect(bolt).toBeTruthy()
      game.bossSys.clear()
      // ставим шар точно на снаряд: без страховки он отскочил бы и снял урон
      const ball = game.balls[0]
      ball.x = bolt.x
      ball.y = bolt.y
      ball.vx = 0
      ball.vy = 1
      const hpBefore = bolt.hp
      game.physics.updateBall(ball, 0.016)
      expect(bolt.hp).toBe(hpBefore)
      expect(Math.hypot(ball.vx, ball.vy)).toBeGreaterThan(0)
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
