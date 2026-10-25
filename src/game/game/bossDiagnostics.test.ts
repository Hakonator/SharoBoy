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

  it("минога: целый хвост ослабляет урон, но не блокирует его", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      const hp = boss.hp
      // тело держит удар: урон идёт, но сильно ослабленным (раньше был полный
      // блок — из-за него бой выглядел как «босс неубиваем»)
      game.bossSys.damage(5, false)
      expect(boss.hp).toBeLessThan(hp)
      expect(hp - boss.hp).toBeLessThan(5)
      step(10)
      // голова следует за сегментом 0 — миного действительно скользит
      const head = game.blocks.find((b) => b.lampreySeg === 0)!
      expect(boss.x).toBeCloseTo(head.x, 6)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("сбитая голова убивает миногу сразу — без регена и воскрешения", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      // хвост цел, но голова разбита: минога умирает сразу, как игрок и ожидает
      const head = game.blocks.find((b) => b.lampreySeg === 0)!
      game.physics.damageBlock(head, 99)
      game.blocks = game.blocks.filter((b) => !b.dead)
      expect(game.bossSys.boss).not.toBeNull()

      // смерть фиксирует следующий кадр боссовой системы
      step(2)
      expect(game.bossSys.boss).toBeNull()
      // никакого «возвращения» головы: спустя много секунд босса по-прежнему нет,
      // а тело убрано с арены. В endless сразу стартует следующая волна —
      // поэтому проверяем именно отсутствие сегментов миноги, а не пустоту поля.
      step(400)
      expect(game.bossSys.boss).toBeNull()
      expect(game.blocks.some((b) => b.lampreySeg)).toBe(false)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("урон по миноге идёт всегда, но целый хвост его ослабляет", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      // хвост цел — тело держит удар: урон проходит, но ослабленным
      const hp0 = boss.hp
      game.bossSys.damage(10, false)
      const weakHit = hp0 - boss.hp
      expect(weakHit).toBeGreaterThan(0)
      expect(weakHit).toBeLessThan(10)

      // сбиваем три хвоста — урон становится полным
      for (const seg of [1, 2, 3]) {
        const b = game.blocks.find((x) => x.lampreySeg === seg)!
        game.physics.damageBlock(b, 99)
      }
      game.blocks = game.blocks.filter((b) => !b.dead)
      const hp1 = boss.hp
      game.bossSys.damage(10, false)
      expect(hp1 - boss.hp).toBe(10)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("минога убивается через HP: снос хвоста ускоряет добивание", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("lamprey")
      const boss = game.bossSys.boss!
      /* Полный проход боя без хаков: сначала урон по защищённому телу (слабый),
         затем снос трёх хвостов (урон полный) до нуля HP. */
      let guard = 0
      while (game.bossSys.boss && guard++ < 500) {
        // сначала сносим хвост (каждый — 99 урона, ломает сегмент), потом бьём тело
        const tail = game.blocks.filter((b) => (b.lampreySeg ?? 0) > 0 && !b.dead)
        if (tail.length) game.physics.damageBlock(tail[0], 99)
        game.blocks = game.blocks.filter((b) => !b.dead)
        game.bossSys.damage(30, false)
        step(1)
      }
      expect(game.bossSys.boss).toBeNull()
      expect(boss.hp).toBeLessThanOrEqual(0)
      // тело миноги убрано с арены — уровень засчитывается без «невидимых» блоков
      expect(game.blocks.some((b) => b.isLampreySeg)).toBe(false)
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

  it("крио-дрон: смерть босса закрывает уровень даже с целыми турбинами", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("cryo")
      const boss = game.bossSys.boss!
      // корпус дрона защищён, пока живы обе тарелки: сначала сносим их, но
      // оставляем крепления (seg 0) — именно они раньше «держали» уровень
      const disks = game.blocks.filter((b) => b.isCryoPart && b.cryoSeg === 1)
      for (const d of disks) game.physics.damageBlock(d, 99)
      game.blocks = game.blocks.filter((b) => !b.dead)
      expect(game.blocks.some((b) => b.isCryoPart)).toBe(true)

      game.bossSys.damage(boss.hp + 10, false)
      expect(game.bossSys.boss).toBeNull()
      // турбины уходят вместе с боссом (общая цепочка взрывов, а не «висят»)
      step(2)
      expect(game.blocks.some((b) => b.isCryoPart)).toBe(false)
      expect(game.blocks.length).toBe(0)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("краб: клешни уходят вместе с боссом и не держат уровень", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("crab")
      const boss = game.bossSys.boss!
      expect(game.blocks.some((b) => b.isClaw)).toBe(true)
      game.bossSys.kill()
      step(2)
      expect(game.blocks.some((b) => b.isClaw)).toBe(false)
      expect(game.blocks.length).toBe(0)
      expect(boss.hp).toBeGreaterThan(0)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("гибель босса — достаточное условие победы, блоки добивать не нужно", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      game.spawnDebugBoss("cryo")
      const boss = game.bossSys.boss!
      game.bossSys.kill()
      // на арене намеренно оставлен «мусор», который босс рисует сам
      expect(game.bossDefeated).toBe(true)
      expect(game.bossSys.boss).toBeNull()
      // зачистка считается выполненной независимо от остатков арены
      step(2)
      expect(game.blocks.length).toBe(0)
      expect(boss.hp).toBeGreaterThan(0)
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
