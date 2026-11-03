import { describe, expect, it } from "vitest"

import { makeRecordingCtx, type PaintEvent } from "../frameInvariant.helpers"
import { buildArmoredCrab, buildEel } from "../minibosses"
import { TIER } from "../palette"

import { drawCrab } from "./minibossCrab"
import { drawEel } from "./minibossEel"

const W = 960
const H = 640
const TOP = 120

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

  it("тело рисуется цельным контуром, а не набором отдельных эллипсов", () => {
    const paints = paintEel(1)
    // первый fill — заливка тела; перед ней путь набирался кривыми
    const bodyFill = paints.find((p) => p.op === "fill")
    expect(bodyFill).toBeDefined()
    // эллипсы (arcs) до первой заливки означали бы «силуэт из шариков»
    expect(bodyFill!.arcs).toHaveLength(0)
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
