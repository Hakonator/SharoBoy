import { describe, expect, it } from "vitest"

import { drawRings } from "./render"
import type { Ring } from "./types"

/** Минимальная заглушка 2D-контекста: drawRings использует только эти методы. */
function makeCtx() {
  const alphaDuringStroke: number[] = []
  const ctx = {
    globalAlpha: 1,
    beginPath: () => {},
    arc: () => {},
    stroke: () => {
      alphaDuringStroke.push(ctx.globalAlpha)
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, alphaDuringStroke }
}

const ring = (t: number): Ring => ({ x: 0, y: 0, r: 5, maxR: 100, color: "#fff", t })

describe("drawRings", () => {
  it("рисует кольца с их собственной альфой", () => {
    const { ctx, alphaDuringStroke } = makeCtx()
    drawRings(ctx, [ring(0), ring(0.5)])
    expect(alphaDuringStroke).toHaveLength(2)
    expect(alphaDuringStroke[0]).toBeCloseTo(1)
    expect(alphaDuringStroke[1]).toBeCloseTo(0.5)
  })

  it("после отрисовки globalAlpha возвращается в 1 — иначе мигают шар, ракетка и бонусы", () => {
    const { ctx } = makeCtx()
    ctx.globalAlpha = 1
    drawRings(ctx, [ring(0.9)])
    expect(ctx.globalAlpha).toBe(1)
  })

  it("сбрасывает globalAlpha даже когда колец нет", () => {
    const { ctx } = makeCtx()
    ctx.globalAlpha = 0.3
    drawRings(ctx, [])
    expect(ctx.globalAlpha).toBe(1)
  })
})
