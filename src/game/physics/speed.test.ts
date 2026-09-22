import { describe, expect, it } from "vitest"

import {
  CLEAR_RAMP_MAX,
  FAST_SPEED_MULT,
  SLOW_SPEED_MULT,
  ballSpeedMult,
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
