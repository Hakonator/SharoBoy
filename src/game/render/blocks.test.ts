import { describe, expect, it } from "vitest"

import type { Block } from "../types"

import { drawBlocks } from "./blocks"

function block(hp: number): Block {
  return {
    x: 40,
    y: 30,
    rx: 12,
    ry: 8,
    rot: 0,
    circle: true,
    hp,
    maxHp: 3,
    tier: 3,
    flash: 0,
    seed: 1,
    dead: false,
    x0: 40,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
  }
}

function recordBlock(hp: number) {
  const fills: unknown[] = []
  const strokes: unknown[] = []
  const gradientColors: string[] = []
  let currentPathArcs: { x: number; y: number; r: number }[] = []
  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    beginPath: () => {
      currentPathArcs = []
    },
    arc: (x: number, y: number, r: number) => {
      currentPathArcs.push({ x, y, r })
    },
    fill: () => fills.push({ style: ctx.fillStyle, arcs: [...currentPathArcs] }),
    stroke: () => strokes.push({ style: ctx.strokeStyle, arcs: [...currentPathArcs] }),
    createRadialGradient: () => ({
      addColorStop: (_offset: number, color: string) => gradientColors.push(color),
    }),
  } as unknown as CanvasRenderingContext2D

  drawBlocks(ctx, [block(hp)], 0)
  return { fills, strokes, gradientColors }
}

function recordHpSequence(hps: number[]) {
  const gradientColors: string[] = []
  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    createRadialGradient: () => ({
      addColorStop: (_offset: number, color: string) => gradientColors.push(color),
    }),
  } as unknown as CanvasRenderingContext2D
  const target = block(hps[0])
  for (const hp of hps) {
    target.hp = hp
    drawBlocks(ctx, [target], 0)
  }
  return gradientColors
}

describe("drawBlocks", () => {
  it("рисует отличительные оверлеи новых механик", () => {
    const arcs: number[] = []
    const dashes: number[][] = []
    const ctx = {
      globalAlpha: 1,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      setLineDash(value: number[]) {
        dashes.push(value)
      },
      beginPath() {},
      arc(_x: number, _y: number, radius: number) {
        arcs.push(radius)
      },
      ellipse(_x: number, _y: number, rx: number) {
        arcs.push(rx)
      },
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      createRadialGradient: () => ({ addColorStop() {} }),
    } as unknown as CanvasRenderingContext2D
    const target = block(2)
    target.sp = {
      armor: 1,
      brittle: { radius: 40, damage: 1 },
      phase: { period: 2, active: 0.5, offset: 0 },
      magnet: { radius: 60, force: 400 },
    }

    drawBlocks(ctx, [target], 0.2)

    expect(arcs.length).toBeGreaterThan(0)
    expect(arcs).toContain(60)
    expect(dashes).toContainEqual([7, 6])
  })

  it("броня рисует внешние чёрные эллипсы и цветные разделители по числу зарядов", () => {
    const ellipses: { rx: number; ry: number; color: unknown }[] = []
    const ctx = {
      globalAlpha: 1,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      beginPath() {},
      arc() {},
      ellipse(_x: number, _y: number, rx: number, ry: number) {
        ellipses.push({ rx, ry, color: ctx.strokeStyle })
      },
      fill() {},
      stroke() {},
      moveTo() {},
      lineTo() {},
      createRadialGradient: () => ({ addColorStop() {} }),
    } as unknown as CanvasRenderingContext2D
    const target = block(2)
    target.sp = { armor: 2, armorMax: 2 }

    drawBlocks(ctx, [target], 0)
    expect(ellipses.filter((ellipse) => ellipse.color === "#080808")).toHaveLength(2)
    expect(ellipses.filter((ellipse) => ellipse.color === "#ff6a5c")).toHaveLength(1)
    for (const [index, ellipse] of ellipses.filter((item) => item.color === "#080808").entries()) {
      const expectedOffset = Math.max(3.5, Math.min(target.rx, target.ry) * 0.1) * (2 - index)
      expect(ellipse.rx).toBeCloseTo(target.rx + expectedOffset)
      expect(ellipse.ry).toBeCloseTo(target.ry + expectedOffset)
    }

    ellipses.length = 0
    target.sp.armor = 1
    drawBlocks(ctx, [target], 0)
    expect(ellipses.filter((ellipse) => ellipse.color === "#080808")).toHaveLength(1)
    expect(ellipses.filter((ellipse) => ellipse.color === "#ff6a5c")).toHaveLength(0)
  })

  it.each([
    [1, "#5dffb0"],
    [2, "#ffc94d"],
    [3, "#ff6a5c"],
  ])("цвет обычного блока с %i HP соответствует уровню HP", (hp, color) => {
    const { gradientColors } = recordBlock(hp)
    expect(gradientColors).toContain(color)
  })

  it.each([
    [
      [3, 2, 1],
      ["#ff6a5c", "#ffc94d", "#5dffb0"],
    ],
    [
      [2, 1],
      ["#ffc94d", "#5dffb0"],
    ],
  ])("обновляет цвет блока при переходе HP %j в одном Canvas", (hps, colors) => {
    const baseColors = recordHpSequence(hps).filter((color) =>
      ["#ff6a5c", "#ffc94d", "#5dffb0"].includes(color)
    )
    expect(baseColors).toEqual(colors)
  })

  it("не рисует трещины и точки HP на обычном блоке", () => {
    const { fills, strokes } = recordBlock(2)
    // Единственная заливка — тело блока; дополнительной заливки индикаторов нет.
    expect(fills).toHaveLength(1)
    expect(strokes).toHaveLength(1)
  })
})
