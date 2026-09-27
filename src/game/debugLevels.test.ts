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
    ])
    expect(blocks.filter((block) => block.sp?.portalId === 1)).toHaveLength(2)
    expect(blocks.every((block) => block.y < 430)).toBe(true)
    expect(blocks.every((block) => block.debugLabel)).toBe(true)
    const spin = blocks.find((block) => block.sp?.rotDir !== undefined)
    expect(spin?.sp?.rotVel).toBe(0)
    expect(spin?.sp?.rotDir).toBeDefined()
  })
})
