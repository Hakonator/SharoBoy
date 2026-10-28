import { describe, expect, it } from "vitest"

import {
  BASE_BALL_RADIUS,
  BIG_BALL_RADIUS,
  BIG_BALL_RADIUS_MULT,
  BIG_BALL_SPEED_MULT,
  CLEAR_RAMP_MAX,
  FAST_SPEED_MULT,
  SLOW_SPEED_MULT,
  ballSpeedMult,
  baseBallRadius,
  isBallSpedUp,
} from "./speed"

describe("ballSpeedMult", () => {
  it("без эффектов и зачистки множитель равен 1", () => {
    expect(ballSpeedMult({ slow: false, fast: false, cleared: 0 })).toBeCloseTo(1)
  })

  it("замедление снижает скорость", () => {
    expect(ballSpeedMult({ slow: true, fast: false, cleared: 0 })).toBeCloseTo(SLOW_SPEED_MULT)
  })

  it("ускорение повышает скорость", () => {
    expect(ballSpeedMult({ slow: false, fast: true, cleared: 0 })).toBeCloseTo(FAST_SPEED_MULT)
  })

  it("разгон зачистки ограничен CLEAR_RAMP_MAX", () => {
    expect(ballSpeedMult({ slow: false, fast: false, cleared: 1 })).toBeCloseTo(1 + CLEAR_RAMP_MAX)
    expect(ballSpeedMult({ slow: false, fast: false, cleared: 5 })).toBeCloseTo(1 + CLEAR_RAMP_MAX)
  })

  it("при одновременных эффектах замедление приоритетно", () => {
    expect(ballSpeedMult({ slow: true, fast: true, cleared: 0 })).toBeCloseTo(SLOW_SPEED_MULT)
  })

  it("эффекты и разгон перемножаются", () => {
    const expected = FAST_SPEED_MULT * (1 + 0.5 * CLEAR_RAMP_MAX)
    expect(ballSpeedMult({ slow: false, fast: true, cleared: 0.5 })).toBeCloseTo(expected)
  })

  it("гравитационное ядро снижает скорость на 10%", () => {
    expect(ballSpeedMult({ slow: false, fast: false, big: true, cleared: 0 })).toBeCloseTo(
      BIG_BALL_SPEED_MULT
    )
    expect(BIG_BALL_SPEED_MULT).toBe(0.9)
  })
})

describe("baseBallRadius (Гравитационное ядро)", () => {
  it("базовые константы соответствуют роадмапу 3.1", () => {
    expect(BASE_BALL_RADIUS).toBe(9)
    expect(BIG_BALL_RADIUS_MULT).toBe(1.6)
    expect(BIG_BALL_RADIUS).toBeCloseTo(14.4)
  })

  it("без активного эффекта возвращает базовый радиус 9", () => {
    expect(baseBallRadius()).toBe(9)
    expect(baseBallRadius({ bigActive: () => false })).toBe(9)
    expect(baseBallRadius({ time: 10, bigUntil: 8 })).toBe(9)
  })

  it("при активном эффекте возвращает увеличенный радиус 14.4", () => {
    expect(baseBallRadius({ bigActive: () => true })).toBeCloseTo(14.4)
    expect(baseBallRadius({ time: 5, bigUntil: 10 })).toBeCloseTo(14.4)
  })
})

describe("isBallSpedUp (порог 1.5× номинала)", () => {
  it("без эффектов шар не разогнан даже при полной зачистке", () => {
    expect(isBallSpedUp({ slow: false, fast: false, cleared: 1 })).toBe(false)
  })

  it("одно ускорение без зачистки ниже порога", () => {
    expect(isBallSpedUp({ slow: false, fast: true, cleared: 0 })).toBe(false)
  })

  it("ускорение + достаточная зачистка достигает порога", () => {
    // 1.32 × (1 + 0.57 × 0.24) ≈ 1.5006 ≥ 1.5
    expect(isBallSpedUp({ slow: false, fast: true, cleared: 0.57 })).toBe(true)
    // 1.32 × (1 + 0.56 × 0.24) ≈ 1.4974 < 1.5
    expect(isBallSpedUp({ slow: false, fast: true, cleared: 0.56 })).toBe(false)
  })

  it("при активном замедлении порог недостижим — дубли не набьются", () => {
    expect(isBallSpedUp({ slow: true, fast: true, cleared: 1 })).toBe(false)
  })
})
