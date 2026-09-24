import { describe, expect, it } from "vitest"

import { BossSystem, type BossHost } from "./boss"
import type { BossState } from "./types"

/** «Злая» фаза не должна телепортировать босса: позиция — непрерывная функция
 *  времени (фаза патруля интегрируется, частота меняется плавно). */
describe("BossSystem — смена «злой» фазы без телепорта", () => {
  function makeHost(): BossHost {
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
      sfx: { brick() {} },
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
})
