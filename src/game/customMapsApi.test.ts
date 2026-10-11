import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchApprovedMaps,
  getVoterId,
  publishCustomMap,
  requestMapEdit,
  recordMapPlay,
  updateMapSpec,
  voteMap,
} from "./customMapsApi"
import type { PlayerMapSpec } from "./mapSpec"

const map: PlayerMapSpec = {
  version: 1,
  id: "test-map",
  metadata: { title: "Test map" },
  blocks: [
    {
      id: "block",
      position: { x: 100, y: 100 },
      shape: "circle",
      size: { width: 20, height: 20 },
      hp: 1,
    },
  ],
  winCondition: { kind: "all-destructible" },
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("customMapsApi", () => {
  it("publishes a map with the maps Edge Function contract", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ map: { id: "map-1", title: "Test" } }), { status: 201 })
      )
    vi.stubGlobal("fetch", fetchMock)

    await publishCustomMap({ title: "Test", author_nick: "Игрок", spec: map })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/maps"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"spec_json"'),
      })
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toHaveProperty(
      "map_uid",
      "test-map"
    )
  })

  it("builds catalog query and returns maps", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ maps: [{ id: "map-1" }] })))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      fetchApprovedMaps({ sort: "popular", search: "space", limit: 20, offset: 5 })
    ).resolves.toHaveLength(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain("sort=popular")
    expect(fetchMock.mock.calls[0]?.[0]).toContain("search=space")
  })

  it("returns server errors and sends vote/play actions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Лайк уже поставлен" }), { status: 409 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(voteMap("map/1", "voter")).rejects.toThrow("Лайк уже поставлен")
    await expect(recordMapPlay("map-1")).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[1]?.[0]).toContain("map-1/play")
  })

  it("persists one anonymous voter id", () => {
    const storage = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    })
    expect(getVoterId()).toBe(getVoterId())
    expect(storage.size).toBe(1)
  })

  it("supports edit requests and approved spec updates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ map: { id: "map-1" } })))
    vi.stubGlobal("fetch", fetchMock)
    await requestMapEdit("map-1", "Игрок", "Исправить расстановку")
    await expect(updateMapSpec("map-1", map)).resolves.toMatchObject({ id: "map-1" })
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/map-1/request-edit")
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PUT" })
  })
})
