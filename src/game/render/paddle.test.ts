import { describe, expect, it } from "vitest"

import { makeRecordingCtx, type PaintEvent } from "../frameInvariant.helpers"
import type { AimGuide } from "../types"

import { drawAimGuide, drawPaddle, type PaddleView } from "./paddle"

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

describe("drawPaddle (T-060: рывок и индикатор заряда)", () => {
  const baseView: PaddleView = {
    time: 1,
    p: { x: 200, y: 400, w: 100, baseW: 100, h: 20, vx: 0, squash: 0 },
    wideUntil: 0,
    shrinkUntil: 0,
    laserUntil: 0,
    laserArmed: false,
    rocketUntil: 0,
    magnetUntil: 0,
  }

  it("смещает контекст на jerkY при активной анимации рывка платформы", () => {
    const paints: PaintEvent[] = []
    const view: PaddleView = {
      ...baseView,
      p: { ...baseView.p, jerkY: -8 },
    }
    drawPaddle(makeRecordingCtx(paints).ctx, view)
    const fills = paints.filter((p) => p.op === "fill")
    expect(fills.length).toBeGreaterThan(0)
    for (const fill of fills) {
      expect(fill.m[4]).toBe(200)
      expect(fill.m[5]).toBe(392)
    }
  })

  it("рисует полосу заряда при 0 < charge < 1", () => {
    const paintsBase: PaintEvent[] = []
    drawPaddle(makeRecordingCtx(paintsBase).ctx, baseView)
    const baseFills = paintsBase.filter((p) => p.op === "fill")

    const paintsCharged: PaintEvent[] = []
    const view: PaddleView = {
      ...baseView,
      p: { ...baseView.p, charge: 0.5 },
    }
    drawPaddle(makeRecordingCtx(paintsCharged).ctx, view)
    const chargedFills = paintsCharged.filter((p) => p.op === "fill")
    expect(chargedFills.length).toBe(baseFills.length + 1)
  })

  it("рисует янтарный заряд и энергетическую ауру при charge >= 1.0", () => {
    const paintsBase: PaintEvent[] = []
    drawPaddle(makeRecordingCtx(paintsBase).ctx, baseView)
    const baseFills = paintsBase.filter((p) => p.op === "fill")

    const paintsFull: PaintEvent[] = []
    const viewFull: PaddleView = {
      ...baseView,
      p: { ...baseView.p, charge: 1.0 },
    }
    drawPaddle(makeRecordingCtx(paintsFull).ctx, viewFull)
    const fullFills = paintsFull.filter((p) => p.op === "fill")
    expect(fullFills.length).toBe(baseFills.length + 1)
    const strokeAura = paintsFull.find(
      (p) =>
        p.op === "stroke" &&
        typeof p.strokeStyle === "string" &&
        p.strokeStyle.includes("255, 230, 0")
    )
    expect(strokeAura).toBeDefined()
  })
})
