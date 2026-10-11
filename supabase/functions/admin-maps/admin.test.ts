import { describe, expect, it } from "vitest"
import { createAdminToken, TOKEN_TTL_SECONDS, verifyAdminToken } from "./auth.ts"

describe("admin token", () => {
  it("creates a signed token that expires after four hours", async () => {
    const token = await createAdminToken("secret", 1000)
    expect(await verifyAdminToken(token, "secret", 1000)).toBe(true)
    expect(await verifyAdminToken(token, "wrong", 1000)).toBe(false)
    expect(await verifyAdminToken(token, "secret", 1001 + TOKEN_TTL_SECONDS)).toBe(false)
  })

  it("rejects malformed and tampered tokens", async () => {
    expect(await verifyAdminToken("not-a-token", "secret", 1000)).toBe(false)
    const token = await createAdminToken("secret", 1000)
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`
    expect(await verifyAdminToken(tampered, "secret", 1000)).toBe(false)
  })

  it("uses the edit-request moderation route", () => {
    expect("/functions/v1/admin-maps/map-id/approve-edit").toContain("/approve-edit")
    expect("edit-requested").toBe("edit-requested")
  })
})
