import { describe, expect, it } from "vitest"

import { densityFactor, gridBlocks, layoutBlocks } from "./levelBuilder"
import { LEVELS, type LayoutSpec, type PatternSpec } from "./levels"
import type { Block } from "./types"

function overlaps(a: Block, b: Block): boolean {
  const nx = a.rx + b.rx
  const ny = a.ry + b.ry
  if (nx <= 0 || ny <= 0) return true
  const dx = (a.x - b.x) / nx
  const dy = (a.y - b.y) / ny
  return dx * dx + dy * dy < 1
}

function countOverlaps(blocks: Block[]): number {
  let n = 0
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (overlaps(blocks[i], blocks[j])) n++
    }
  }
  return n
}

describe("densityFactor — мировые размеры поля", () => {
  it("эталонное окно — плотность 1", () => {
    expect(densityFactor(1920, 1080)).toBe(1)
  })

  it("телефон в мировых единицах (портрет и ландшафт) — около эталона", () => {
    expect(densityFactor(927, 2005)).toBeCloseTo(1, 2)
    expect(densityFactor(2005, 927)).toBeCloseTo(1, 2)
  })

  it("вытянутые поля мягко корректируются в пределах 0.65..1.35", () => {
    expect(densityFactor(1250, 1000)).toBeCloseTo(0.727, 2)
    expect(densityFactor(2560, 1080)).toBeCloseTo(1.261, 2)
    expect(densityFactor(5000, 2000)).toBe(1.35)
    expect(densityFactor(400, 400)).toBe(0.65)
  })
})

describe("gridBlocks", () => {
  const spec = LEVELS[1] as PatternSpec

  it("узкое окно даёт меньше блоков, чем эталонное поле", () => {
    const small = gridBlocks(spec, 1250, 1000, densityFactor(1250, 1000))
    const desktop = gridBlocks(spec, 1920, 1080, densityFactor(1920, 1080))
    expect(small.length).toBeLessThan(desktop.length)
    expect(small.length).toBeGreaterThan(3)
  })

  it("блоки не пересекаются на любых пропорциях поля", () => {
    for (const [w, h] of [
      [927, 2005], // телефон, портрет (мировые единицы)
      [2005, 927], // телефон, ландшафт
      [1920, 1080], // эталон
      [1250, 1000], // маленькое окно
    ] as const) {
      const blocks = gridBlocks(spec, w, h, densityFactor(w, h))
      expect(countOverlaps(blocks), `пересечения на ${w}x${h}`).toBe(0)
    }
  })
})

describe("layoutBlocks", () => {
  const spec = LEVELS[0] as LayoutSpec

  it("на эталонном поле — авторская раскладка без дополнений", () => {
    const desktop = layoutBlocks(spec, 1920, 1080, densityFactor(1920, 1080))
    expect(desktop.length).toBe(spec.layout.length)
  })

  it("на плотных полях добавляются заполнители, и блоки расталкиваются", () => {
    const dense = layoutBlocks(spec, 2560, 1080, densityFactor(2560, 1080))
    expect(dense.length).toBeGreaterThan(spec.layout.length)
    expect(countOverlaps(dense)).toBe(0)
  })

  it("на вытянутых полях раскладка вписывается в границы поля", () => {
    for (const [w, h] of [
      [927, 2005],
      [2005, 927],
    ] as const) {
      const blocks = layoutBlocks(spec, w, h, densityFactor(w, h))
      for (const b of blocks) {
        expect(b.x - b.rx, `${w}x${h}: левый край блока`).toBeGreaterThanOrEqual(0)
        expect(b.x + b.rx, `${w}x${h}: правый край блока`).toBeLessThanOrEqual(w)
        expect(b.y + b.ry, `${w}x${h}: низ блока`).toBeLessThanOrEqual(h * 0.75)
      }
    }
  })
})
