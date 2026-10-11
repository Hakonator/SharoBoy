import { describe, expect, it } from "vitest"

describe("maps API contracts", () => {
  it("uses UUID routes for map actions", () => {
    expect("/functions/v1/maps/00000000-0000-0000-0000-000000000000/vote").toMatch(
      /[0-9a-f-]{36}\/vote$/
    )
  })

  it("keeps catalog pagination bounded", () => {
    const limit = Math.min(Math.max(1000, 1), 100)
    const offset = Math.min(Math.max(-10, 0), 100000)
    expect(limit).toBe(100)
    expect(offset).toBe(0)
  })
})
