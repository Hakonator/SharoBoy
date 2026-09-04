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

describe("densityFactor", () => {
  it("мобильные экраны дают малую плотность", () => {
    expect(densityFactor(390, 844)).toBe(0.5)
    expect(densityFactor(768, 1024)).toBe(0.7)
  })

  it("HD/FHD — эталонная плотность", () => {
    expect(densityFactor(1920, 1080)).toBe(1)
    expect(densityFactor(2560, 1440)).toBe(1)
  })

  it("4K и выше — значительно плотнее", () => {
    expect(densityFactor(3840, 2160)).toBe(1.5)
    expect(densityFactor(5120, 2880)).toBe(1.5)
  })
})

describe("gridBlocks", () => {
  const spec = LEVELS[1] as PatternSpec

  it("маленький экран даёт заметно меньше блоков, чем FHD", () => {
    const phone = gridBlocks(spec, 390, 844, densityFactor(390, 844))
    const desktop = gridBlocks(spec, 1920, 1080, densityFactor(1920, 1080))
    expect(phone.length).toBeLessThan(desktop.length)
    expect(phone.length).toBeGreaterThan(3)
  })

  it("4K даёт заметно больше блоков, чем FHD", () => {
    const desktop = gridBlocks(spec, 1920, 1080, densityFactor(1920, 1080))
    const uhd = gridBlocks(spec, 3840, 2160, densityFactor(3840, 2160))
    expect(uhd.length).toBeGreaterThan(desktop.length * 1.3)
  })

  it("блоки не пересекаются ни на одном разрешении", () => {
    for (const [w, h] of [
      [390, 844],
      [1920, 1080],
      [3840, 2160],
    ] as const) {
      const blocks = gridBlocks(spec, w, h, densityFactor(w, h))
      expect(countOverlaps(blocks), `пересечения на ${w}x${h}`).toBe(0)
    }
  })
})

describe("layoutBlocks", () => {
  const spec = LEVELS[0] as LayoutSpec

  it("4K добавляет блоки-заполнители, FHD оставляет авторскую раскладку", () => {
    const desktop = layoutBlocks(spec, 1920, 1080, densityFactor(1920, 1080))
    const uhd = layoutBlocks(spec, 3840, 2160, densityFactor(3840, 2160))
    expect(desktop.length).toBe(spec.layout.length)
    expect(uhd.length).toBeGreaterThan(spec.layout.length)
    expect(countOverlaps(uhd)).toBe(0)
  })
})
