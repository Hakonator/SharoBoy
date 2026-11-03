import { describe, expect, it } from "vitest"

import { makeRecordingCtx, type PaintEvent } from "../frameInvariant.helpers"
import { buildArmoredCrab, buildEel } from "../minibosses"
import { TIER } from "../palette"

import { drawCrab } from "./minibossCrab"
import { drawEel } from "./minibossEel"

const W = 960
const H = 640
const TOP = 120

/**
 * Записывающий контекст собирает и КРИВЫЕ контура (moveTo/quadraticCurveTo),
 * а не только эллипсы: без этого нельзя проверить, что силуэт строится
 * единым контуром, а не набором отдельных дуг.
 */
function makeCurveCtx(curves: { op: string }[]) {
  const base = makeRecordingCtx([] as PaintEvent[])
  const ctx = base.ctx as unknown as Record<string, unknown>
  const record = (op: string) => () => curves.push({ op })
  ctx.moveTo = record("moveTo")
  ctx.lineTo = record("lineTo")
  ctx.quadraticCurveTo = record("curve")
  ctx.bezierCurveTo = record("curve")
  return base.ctx
}

/** Рисует угря с заданным направлением силуэта и возвращает журнал красок. */
function paintEel(facing: 1 | -1): PaintEvent[] {
  const paints: PaintEvent[] = []
  const eel = buildEel(W, H, TOP)
  for (const b of eel) b.mbFacing = facing
  drawEel(makeRecordingCtx(paints).ctx, eel, 0.4)
  return paints
}

describe("T-063: силуэт скользкого угря", () => {
  it("рисуется зеркально по ходу движения (mbFacing = −1 → отражение)", () => {
    const right = paintEel(1)
    const left = paintEel(-1)
    expect(right.length).toBeGreaterThan(0)
    expect(left.length).toBe(right.length)
    // отражение — это масштаб по X со знаком минус в матрице красок
    expect(right.every((p) => p.m[0] > 0)).toBe(true)
    expect(left.every((p) => p.m[0] < 0)).toBe(true)
  })

  it("тело строится цельным контуром, а не набором отдельных эллипсов", () => {
    const curves: { op: string }[] = []
    const eel = buildEel(W, H, TOP)
    for (const b of eel) b.mbFacing = 1
    drawEel(makeCurveCtx(curves), eel, 0.4)
    // контур тела + гребни + голова: много кривых, и все — в одном проходе
    expect(curves.filter((c) => c.op === "curve").length).toBeGreaterThan(8)
    expect(curves.filter((c) => c.op === "moveTo").length).toBeLessThan(
      curves.filter((c) => c.op === "curve").length
    )
  })
})

describe("T-063: силуэт панцирного краба", () => {
  it("каждая из трёх пластин панциря рисуется отдельно, своим щитком", () => {
    const paints: PaintEvent[] = []
    const crab = buildArmoredCrab(W, H, TOP)
    drawCrab(makeRecordingCtx(paints).ctx, crab, 0.5)
    const shellXs = crab.filter((b) => b.mbPart === "shell").map((b) => b.x)
    expect(shellXs).toHaveLength(3)
    for (const x of shellXs) {
      // обводка пластины идёт в собственной системе координат (translate на её x)
      const own = paints.filter(
        (p) => p.op === "stroke" && Math.abs(p.m[4] - x) < 0.001 && p.strokeStyle === TIER[3].dark
      )
      expect(own.length).toBeGreaterThan(0)
    }
  })

  it("обе клешни рисуются зеркально: левая — отражённая копия правой", () => {
    const paints: PaintEvent[] = []
    drawCrab(makeRecordingCtx(paints).ctx, buildArmoredCrab(W, H, TOP), 0.5)
    const mirrored = paints.filter((p) => p.m[0] < 0)
    const plain = paints.filter((p) => p.m[0] > 0)
    expect(mirrored.length).toBeGreaterThan(3)
    expect(plain.length).toBeGreaterThan(3)
  })
})
