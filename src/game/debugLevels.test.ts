import { describe, expect, it } from "vitest"

import { buildSpecialBlocks } from "./debugLevels"

describe("buildSpecialBlocks", () => {
  it("создаёт стенд всех спецтипов и парный портал в зоне экрана", () => {
    const blocks = buildSpecialBlocks(960, 640, 90)
    const kinds = blocks.map((block) => {
      const special = block.sp
      if (special?.portalId !== undefined) return "portal"
      if (special?.pulse) return "pulse"
      if (special?.spring) return "spring"
      if (special?.cotton) return "cotton"
      if (special?.rotVel !== undefined) return "spin"
      if (special?.armor !== undefined) return "armor"
      if (special?.brittle) return "brittle"
      if (special?.phase) return "phase"
      if (special?.magnet) return "magnet"
      if (block.debugLabel === "CHAIN") return "chain-target"
      return `drift-${special?.drift?.kind}`
    })
    expect(kinds).toEqual([
      "pulse",
      "spring",
      "cotton",
      "spin",
      "drift-h",
      "drift-v",
      "drift-circle",
      "portal",
      "portal",
      "armor",
      "armor",
      "armor",
      "brittle",
      "brittle",
      "brittle",
      "brittle",
      "brittle",
      "brittle",
      "brittle",
      "brittle",
      "brittle",
      "phase",
      "magnet",
    ])
    expect(blocks.filter((block) => block.sp?.portalId === 1)).toHaveLength(2)
    expect(blocks.every((block) => block.y < 430)).toBe(true)
    expect(blocks.every((block) => block.debugLabel)).toBe(true)
    expect(blocks.filter((block) => block.sp?.brittle)).toHaveLength(9)
    expect(blocks.filter((block) => block.sp?.brittle).every((block) => block.hp === 1)).toBe(true)
    for (const armor of [1, 2, 3]) {
      const sample = blocks.find((block) => block.debugLabel === `ARMOR ${armor}`)
      expect(sample?.sp?.armor).toBe(armor)
      expect(sample?.sp?.armorMax).toBe(armor)
    }
    const armorSamples = blocks.filter((block) => block.sp?.armor !== undefined)
    expect(armorSamples).toHaveLength(3)
    expect(Math.abs(armorSamples[1].x - armorSamples[0].x)).toBeGreaterThan(
      armorSamples[0].rx + armorSamples[1].rx
    )
    expect(Math.abs(armorSamples[2].x - armorSamples[1].x)).toBeGreaterThan(
      armorSamples[1].rx + armorSamples[2].rx
    )
    const spin = blocks.find((block) => block.sp?.rotDir !== undefined)
    expect(spin?.sp?.rotVel).toBe(0)
    expect(spin?.sp?.rotDir).toBeDefined()
    const magnet = blocks.find((block) => block.sp?.magnet)
    expect(magnet?.sp?.magnet?.radius).toBe(42 * 4)
  })
})
