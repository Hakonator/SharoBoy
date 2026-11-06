import { describe, expect, it, vi } from "vitest"

import { BossSystem, LAST_STAND_BOMB_MULT, LAST_STAND_MINIONS, type BossHost } from "./boss"
import { BOSS_LAST_STAND_AT } from "./bossVariants"
import type { BossState } from "./types"

/** «Злая» фаза не должна телепортировать босса: позиция — непрерывная функция
 *  времени (фаза патруля интегрируется, частота меняется плавно). */
describe("BossSystem — смена «злой» фазы без телепорта", () => {
  function makeHost(
    sfx: Partial<{
      brick: () => void
      bossPhase: (kind: string) => void
      setBattleIntensity: (intensity: string) => void
    }> = {}
  ) {
    return {
      w: 800,
      h: 600,
      time: 0,
      shake: 0,
      hitStop: 0,
      flash: 0,
      blocks: [],
      powers: [],
      boomQueue: [],
      paddle: { x: 400, y: 560, w: 90, h: 14 },
      fx: { burst() {}, rings: [], popups: [], particles: [] },
      sfx: { brick() {}, bossPhase() {}, setBattleIntensity() {}, ...sfx },
      addRawScore() {},
      onBossKilled() {},
      pushHud() {},
    } as unknown as BossHost
  }

  function makeBoss(hp: number): BossState {
    return { x: 400, y: 120, baseY: 120, r: 30, hp, maxHp: 100, t: 0, flash: 0, dropTimer: 1e9 }
  }

  const DT = 1 / 60

  it("в кадр смены фазы сдвиг остаётся в пределах обычной скорости патруля", () => {
    const sys = new BossSystem(makeHost())
    const boss = makeBoss(100) // «злится» при hp < 40
    sys.spawn(boss)
    for (let i = 0; i < 300; i++) sys.step(DT) // 5 с спокойного патруля
    let maxJump = 0
    let prev = boss.x
    boss.hp = 39 // порог пройден — фаза «злости»
    for (let i = 0; i < 90; i++) {
      sys.step(DT)
      maxJump = Math.max(maxJump, Math.abs(boss.x - prev))
      prev = boss.x
    }
    // предел плавного патруля: амплитуда 208 × частота 1.1 рад/с ≈ 4 px/кадр
    expect(maxJump).toBeLessThan(10)
  })

  it("частота патруля плавно выходит на «злую» (быструю) и остаётся непрерывной", () => {
    const sys = new BossSystem(makeHost())
    const boss = makeBoss(100)
    sys.spawn(boss)
    for (let i = 0; i < 300; i++) sys.step(DT)
    boss.hp = 39
    for (let i = 0; i < 120; i++) sys.step(DT) // ~2 с — переход завершён
    expect(boss.swayFreq).toBeCloseTo(1.1, 1)
    // непрерывность фазы: x — синус от накопленной фазы, скачков нет по определению
    expect(boss.x).toBeGreaterThanOrEqual(400 - 208 - 1)
    expect(boss.x).toBeLessThanOrEqual(400 + 208 + 1)
  })

  it("смена фазы звучит один раз и своим акцентом для финальных боссов", () => {
    const played: string[] = []
    const intensityCalls: string[] = []
    const sys = new BossSystem(
      makeHost({
        bossPhase: (kind) => played.push(kind),
        setBattleIntensity: (val) => intensityCalls.push(val),
      })
    )
    const boss: BossState = { ...makeBoss(100), isChrono: true, angryAt: 0.5 }
    sys.spawn(boss)
    for (let i = 0; i < 60; i++) sys.step(DT)
    expect(played).toEqual([]) // спокойная фаза молчит
    expect(intensityCalls).toEqual([])

    boss.hp = 40 // порог пройден
    for (let i = 0; i < 60; i++) sys.step(DT)
    expect(played).toEqual(["chrono"])
    expect(intensityCalls).toEqual(["angry"])

    // Повторный проход порога (хилы, регенерация) не должен дублировать акцент.
    boss.hp = 100
    for (let i = 0; i < 30; i++) sys.step(DT)
    boss.hp = 30
    for (let i = 0; i < 30; i++) sys.step(DT)
    expect(played).toEqual(["chrono"])
    expect(intensityCalls).toEqual(["angry"])
  })
})

describe("BossSystem — «последний рубеж»", () => {
  function makeHost(over: Partial<Record<string, unknown>> = {}) {
    return {
      w: 800,
      h: 600,
      blockTop: 60,
      // Арена «широкая», чтобы орбита подкрепления всегда была положительной
      // и не обнулялась расчётом (baseY - blockTop) / 1.6.
      time: 0,
      shake: 0,
      hitStop: 0,
      flash: 0,
      blocks: [] as unknown[],
      powers: [],
      boomQueue: [],
      paddle: { x: 400, y: 560, w: 90, h: 14 },
      fx: { burst() {}, rings: [], popups: [], particles: [] },
      sfx: { brick() {}, bossPhase() {}, power: vi.fn(), setBattleIntensity() {} },
      addRawScore() {},
      onBossKilled() {},
      pushHud() {},
      ...over,
    } as unknown as BossHost
  }

  const DT = 1 / 60

  /**
   * Подкрепление не появляется, если в арене нет места под орбиту:
   * `(baseY - blockTop) / 1.6` должен быть > 0. У босса на y = 120 при
   * blockTop = 60 запас 60 px — орбита есть; для «тесной» арены берём y выше.
   */
  function makeBoss(over: Partial<BossState> = {}): BossState {
    return {
      x: 400,
      y: 200,
      baseY: 220,
      r: 30,
      hp: 100,
      maxHp: 100,
      t: 0,
      flash: 0,
      dropTimer: 1e9,
      ...over,
    }
  }

  /** Провести бой до нужной доли HP «штатным» шагом. */
  function stepTo(sys: BossSystem, boss: BossState, hp: number, frames = 5) {
    boss.hp = hp
    for (let i = 0; i < frames; i++) sys.step(DT)
  }

  it("включается ровно один раз за бой, даже если HP снова проседает", () => {
    const host = makeHost()
    const sys = new BossSystem(host)
    const boss = makeBoss({ bombEvery: 4 })
    sys.spawn(boss)

    for (let i = 0; i < 60; i++) sys.step(DT)
    expect(boss.lastStand).toBeFalsy()

    stepTo(sys, boss, 100 * BOSS_LAST_STAND_AT * 0.9)
    expect(boss.lastStand).toBe(true)
    const ringsAfterFirst = (host.fx.rings as unknown[]).length
    expect(ringsAfterFirst).toBeGreaterThanOrEqual(2) // двойное кольцо
    expect(host.sfx.power).toHaveBeenCalledTimes(1)

    // Повторный проход порога не дублирует событие (баннер/кольца/звук).
    stepTo(sys, boss, 100)
    stepTo(sys, boss, 5)
    expect(host.sfx.power).toHaveBeenCalledTimes(1)
    expect((host.fx.rings as unknown[]).length).toBe(ringsAfterFirst)
  })

  it("порог берётся из состояния босса, дефолт — BOSS_LAST_STAND_AT", () => {
    const boss = makeBoss()
    const sys = new BossSystem(makeHost())
    sys.spawn(boss)
    // Чуть выше дефолтного порога — рубежа ещё нет.
    stepTo(sys, boss, 100 * (BOSS_LAST_STAND_AT + 0.02))
    expect(boss.lastStand).toBeFalsy()
    stepTo(sys, boss, 100 * (BOSS_LAST_STAND_AT - 0.01))
    expect(boss.lastStand).toBe(true)

    const custom = makeBoss({ lastStandAt: 0.3 })
    const sys2 = new BossSystem(makeHost())
    sys2.spawn(custom)
    stepTo(sys2, custom, 100 * 0.25)
    expect(custom.lastStand).toBe(true)
  })

  it("бомбы летят чаще: идущий таймер и новые интервалы умножаются на LAST_STAND_BOMB_MULT", () => {
    // Один и тот же «фронт» боя: HP в «злой» фазе и половина интервала до бомбы.
    const hp = 100 * BOSS_LAST_STAND_AT * 0.5
    const timer = 0.5

    const withLastStand = makeBoss({ bombEvery: 4, bombTimer: timer, hp })
    const sys = new BossSystem(makeHost())
    sys.spawn(withLastStand)
    sys.step(DT)
    expect(withLastStand.lastStand).toBe(true)
    // Идущий таймер ускорен сразу при включении рубежа.
    expect(withLastStand.bombTimer).toBeCloseTo((timer - DT) * LAST_STAND_BOMB_MULT, 5)
    expect(withLastStand.lastStandBombAccelerated).toBe(true)

    // Следующий интервал: «злая» фаза (bombEvery / 2) × рубеж.
    withLastStand.bombTimer = DT // бомба «дозрела» на этом шаге
    sys.step(DT)
    expect(withLastStand.bombTimer).toBeCloseTo((4 / 2) * LAST_STAND_BOMB_MULT, 5)

    // Контроль: новый интервал без ускоренного таймера тоже учитывает рубеж —
    // но ровно один раз на бой (флаг lastStandBombAccelerated).
    const fresh = makeBoss({ bombEvery: 4, hp, lastStand: true })
    const freshSys = new BossSystem(makeHost())
    freshSys.spawn(fresh)
    freshSys.step(DT)
    // Первый интервал выставляется сразу с множителем (таймера ещё не было).
    expect(fresh.bombTimer).toBeCloseTo(4 * LAST_STAND_BOMB_MULT - DT, 5)
    expect(LAST_STAND_BOMB_MULT).toBeLessThan(1)
  })

  it("на орбите появляется ровно LAST_STAND_MINIONS подкрепления", () => {
    const blocks: { dead?: boolean; minionOrbit?: { rad: number } }[] = []
    const host = makeHost({ blocks })
    const sys = new BossSystem(host)
    const boss = makeBoss({ hp: 100 * BOSS_LAST_STAND_AT * 0.5 })
    sys.spawn(boss)
    sys.step(DT)
    const minions = blocks.filter((b) => b.minionOrbit)
    expect(minions).toHaveLength(LAST_STAND_MINIONS)
    for (const m of minions) expect(m.minionOrbit!.rad).toBeGreaterThan(0)

    // Повторное срабатывание подкрепление не добавляет.
    sys.step(DT)
    sys.step(DT)
    expect(blocks.filter((b) => b.minionOrbit)).toHaveLength(LAST_STAND_MINIONS)
  })

  it("босс без бомб и без места под орбиту получает только визуальный сигнал", () => {
    // Тесная арена (blockTop почти на уровне босса): орбиту построить нельзя,
    // поэтому подкрепление не спавнится, а бомб у вида нет вовсе.
    const blocks: { minionOrbit?: { rad: number } }[] = []
    const host = makeHost({ blocks, blockTop: 230 })
    const sys = new BossSystem(host)
    const boss = makeBoss({ bombEvery: 0, hp: 3 })
    sys.spawn(boss)

    for (let i = 0; i < 600; i++) sys.step(DT) // 10 секунд боя
    expect(boss.lastStand).toBe(true)
    expect(blocks.filter((b) => b.minionOrbit)).toHaveLength(0) // подкрепления нет
    expect(boss.bombTimer).toBeUndefined() // бомб нет вовсе
    // Визуальный сигнал всё равно сыграл: событие одноразовое.
    expect(host.sfx.power).toHaveBeenCalledTimes(1)
  })
})
