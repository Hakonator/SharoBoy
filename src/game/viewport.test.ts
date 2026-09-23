import { describe, expect, it } from "vitest"

import {
  HUD_TOP_CSS,
  HUD_TOP_PORTRAIT_CSS,
  MAX_SCALE,
  MIN_SCALE,
  computeScale,
  hudTopCss,
  isPortrait,
} from "./viewport"

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

describe("isPortrait / hudTopCss — неигровая HUD-зона", () => {
  it("портрет — высота больше ширины, ландшафт — наоборот", () => {
    expect(isPortrait(390, 844)).toBe(true)
    expect(isPortrait(844, 390)).toBe(false)
  })

  it("квадратное окно считается ландшафтом", () => {
    expect(isPortrait(800, 800)).toBe(false)
  })

  it("в портрете HUD-зона выше: HUD двухрядный", () => {
    expect(hudTopCss(390, 844)).toBe(HUD_TOP_PORTRAIT_CSS)
    expect(hudTopCss(844, 390)).toBe(HUD_TOP_CSS)
    expect(hudTopCss(390, 844)).toBeGreaterThan(hudTopCss(844, 390))
  })
})
