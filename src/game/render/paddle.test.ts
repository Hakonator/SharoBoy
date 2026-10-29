import { describe, expect, it } from "vitest"

import { makeRecordingCtx, type PaintEvent } from "../frameInvariant.helpers"
import type { AimGuide } from "../types"

import { drawAimGuide } from "./paddle"

describe("drawAimGuide", () => {
  const guide: AimGuide = {
    x: 100,
    y: 300,
    dx: 0,
    dy: -1,
    hitX: 100,
    hitY: 100,
    bounceX: 100,
    bounceY: 100,
    bounceDx: 0,
    bounceDy: 1,
  }

  it("анимирует основной пунктир и рисует отражённый сегмент только по флагу", () => {
    const onlyAimPaints: PaintEvent[] = []
    drawAimGuide(makeRecordingCtx(onlyAimPaints).ctx, guide, 1, false)
    const bouncePaints: PaintEvent[] = []
    drawAimGuide(makeRecordingCtx(bouncePaints).ctx, guide, 1, true)
    expect(onlyAimPaints.filter((paint) => paint.op === "stroke")).toHaveLength(1)
    expect(bouncePaints.filter((paint) => paint.op === "stroke")).toHaveLength(2)
  })

  it("рисует прицельный луч синергии «Кинетический Снайпер» с бирюзовым цветом", () => {
    const sniperPaints: PaintEvent[] = []
    drawAimGuide(makeRecordingCtx(sniperPaints).ctx, guide, 1, false, true)
    const strokeEvents = sniperPaints.filter((p) => p.op === "stroke")
    expect(strokeEvents).toHaveLength(1)
    expect(strokeEvents[0].strokeStyle).toBe("#00f5d4")
    expect(strokeEvents[0].lineWidth).toBe(3.2)
  })
})
