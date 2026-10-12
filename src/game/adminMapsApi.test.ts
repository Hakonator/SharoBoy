import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../config", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../config")
  return {
    ...actual,
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key",
    LEADERBOARD_ENABLED: true,
  }
})

import {
  adminLogin,
  adminLogout,
  approveMap,
  approveMapEdit,
  fetchEditRequests,
  fetchPendingMaps,
  rejectMap,
  rejectMapEdit,
} from "./adminMapsApi"

const response = (body: unknown, ok = true, status = 200) =>
  ({
    json: async () => body,
    ok,
    status,
  }) as unknown as Response

function installSessionStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  })
}

describe("admin maps API", () => {
  afterEach(() => vi.restoreAllMocks())

  it("logs in, stores the token and loads pending maps", async () => {
    installSessionStorage()
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ token: "admin-token" }))
      .mockResolvedValueOnce(response({ maps: [] }))
    await expect(adminLogin("secret")).resolves.toBe("admin-token")
    await expect(fetchPendingMaps("admin-token")).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sessionStorage.getItem("sharoboy-admin-token")).toBe("admin-token")
    adminLogout()
    expect(sessionStorage.getItem("sharoboy-admin-token")).toBeNull()
  })

  it("sends approve and reject requests with the expected payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response({ map: null }))
    await approveMap("token", "map-id")
    await rejectMap("token", "map-id", "Непроходимый уровень")
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/map-id/approve")
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ reject_reason: "Непроходимый уровень" }),
    })
  })

  it("loads edit requests and approves or rejects an edit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response({ maps: [] }))
    await expect(fetchEditRequests("token")).resolves.toEqual([])
    await approveMapEdit("token", "map-id")
    await rejectMapEdit("token", "map-id", "Нарушен баланс")
    expect(fetchMock.mock.calls[0]?.[0]).toContain("status=edit-requested")
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/map-id/approve-edit")
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/map-id/reject-edit")
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ reason: "Нарушен баланс" }),
    })
  })

  it("reports server errors and rejects an empty reason", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response({ error: "Неверный пароль" }, false, 401)
    )
    await expect(adminLogin("wrong")).rejects.toThrow("Неверный пароль")
    await expect(rejectMap("token", "map-id", "  ")).rejects.toThrow("Укажите причину")
  })
})
