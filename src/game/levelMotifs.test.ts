import { describe, expect, it } from "vitest"

import { generateMotifSpec, LEVEL_MOTIF_NAMES } from "./levelMotifs"
import { densityFactor, layoutBlocks } from "./levelBuilder"
import type { Block } from "./types"

function overlap(a: Block, b: Block): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < Math.min(a.rx + b.rx, a.ry + b.ry) * 0.9
}

describe("generateMotifSpec", () => {
  it("воспроизводит полностью одинаковый уровень для одного seed", () => {
    expect(generateMotifSpec(741, 8, 500)).toEqual(generateMotifSpec(741, 8, 500))
  })

  it("выбирает все заданные мотивы на наборе seed и меняет композицию", () => {
    const specs = Array.from({ length: 300 }, (_, seed) => generateMotifSpec(seed + 1, 3, 400))
    const names = new Set(specs.map((spec) => spec.name))
    const layouts = new Set(specs.map((spec) => spec.layout.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(";")))
    expect(names.size).toBe(LEVEL_MOTIF_NAMES.length)
    expect(layouts.size).toBeGreaterThan(LEVEL_MOTIF_NAMES.length * 10)
  })

  it("сложность повышает скорость и прочность центра по мере продвижения", () => {
    const early = generateMotifSpec(123, 1, 400)
    const late = generateMotifSpec(123, 20, 400)
    expect(late.speed).toBeGreaterThan(early.speed)
    expect(late.layout.some((item) => item.hp === 3)).toBe(true)
  })

  it("раскладывает каждый мотив внутри поля на широком и портретном экранах", () => {
    for (const [seed, [w, h]] of [
      [11, [1920, 1080]],
      [22, [927, 2005]],
      [33, [2005, 927]],
      [44, [1920, 1080]],
      [55, [1920, 1080]],
      [66, [1920, 1080]],
      [77, [1920, 1080]],
    ] as const) {
      const spec = generateMotifSpec(seed, 8, 450)
      const blocks = layoutBlocks(spec, w, h, densityFactor(w, h), undefined, () => 0.5)
      for (const block of blocks) {
        expect(block.x - block.rx).toBeGreaterThanOrEqual(0)
        expect(block.x + block.rx).toBeLessThanOrEqual(w)
        expect(block.y - block.ry).toBeGreaterThanOrEqual(0)
        expect(block.y + block.ry).toBeLessThanOrEqual(h * 0.75)
      }
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          expect(overlap(blocks[i], blocks[j]), `${spec.name} ${w}x${h}: ${i}(${blocks[i].x},${blocks[i].y}) overlaps ${j}(${blocks[j].x},${blocks[j].y})`).toBe(false)
        }
      }
    }
  })
})