import { describe, expect, it } from "vitest"

import { Physics } from "./physics"

/** Регрессия 26dc66b: знак surfaceAt для «convex» инвертировали «для симметрии»
 *  с чашей — все потребители (старт шара, прилипание, выталкивание, пилоны)
 *  трактуют результат как ВЫСОТУ НАД ГРАНЬЮ (y = yTop − surfaceAt), и шар
 *  оказывался под куполом. Контракт: результат ≥ 0 для любой формы. */
describe("Physics.surfaceAt — высота поверхности над гранью", () => {
  it("flat: грань, 0 в любой точке", () => {
    expect(Physics.surfaceAt(60, 0, "flat")).toBe(0)
    expect(Physics.surfaceAt(60, 0.7, "flat")).toBe(0)
  })

  it("convex: центр выше краёв — bump в центре, 0 на краях", () => {
    const halfW = 60
    expect(Physics.surfaceAt(halfW, 0, "convex")).toBeCloseTo(Physics.convexBump(halfW))
    expect(Physics.surfaceAt(halfW, 1, "convex")).toBeCloseTo(0)
    expect(Physics.surfaceAt(halfW, -1, "convex")).toBeCloseTo(0)
    // парабола: симметрия и монотонный спад от центра к краю
    expect(Physics.surfaceAt(halfW, 0.5, "convex")).toBeCloseTo(
      Physics.surfaceAt(halfW, -0.5, "convex")
    )
    expect(Physics.surfaceAt(halfW, 0.5, "convex")).toBeLessThan(
      Physics.surfaceAt(halfW, 0, "convex")
    )
  })

  it("concave: края выше центра — bump на краях, грань в центре", () => {
    const halfW = 60
    expect(Physics.surfaceAt(halfW, 0, "concave")).toBe(0)
    expect(Physics.surfaceAt(halfW, 1, "concave")).toBeCloseTo(Physics.convexBump(halfW))
    expect(Physics.surfaceAt(halfW, -1, "concave")).toBeCloseTo(Physics.convexBump(halfW))
  })

  it("контракт: результат неотрицателен для всех форм во всех точках", () => {
    for (const kind of ["flat", "convex", "concave"] as const) {
      for (let i = 0; i <= 10; i++) {
        const rel = -1 + (2 * i) / 10
        expect(Physics.surfaceAt(60, rel, kind, 20)).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
