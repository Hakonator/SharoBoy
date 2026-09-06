import { describe, expect, it } from "vitest"

import { MAX_SCALE, MIN_SCALE, computeScale } from "./viewport"

describe("computeScale — единый масштаб мира", () => {
  it("эталонное окно 1920×1080 даёт масштаб 1", () => {
    expect(computeScale(1920, 1080)).toBe(1)
  })

  it("пропорциональные окна масштабируются ровно по диагонали", () => {
    expect(computeScale(960, 540)).toBe(0.5)
    expect(computeScale(3840, 2160)).toBe(2)
  })

  it("телефон в портрете и ландшафте — одинаковый масштаб (по диагонали)", () => {
    expect(computeScale(390, 844)).toBe(computeScale(844, 390))
    expect(computeScale(390, 844)).toBeCloseTo(0.422, 3)
  })

  it("масштаб ограничен снизу и сверху", () => {
    expect(computeScale(100, 100)).toBe(MIN_SCALE)
    expect(computeScale(20000, 20000)).toBe(MAX_SCALE)
  })
})
