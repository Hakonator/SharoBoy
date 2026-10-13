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
  fetchApprovedMaps,
  fetchMapStatus,
  getVoterId,
  humanizeMapsApiError,
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

  it("supports edit requests and approved spec updates with title and description", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ map: { id: "map-1", title: "Новый заголовок" } }))
      )
    vi.stubGlobal("fetch", fetchMock)
    await requestMapEdit("map-1", {
      author_nick: "Игрок",
      reason: "Исправить расстановку",
      spec: map,
      title: "Новый заголовок",
      description: "Новое описание",
    })
    await expect(
      updateMapSpec("map-1", {
        spec: map,
        title: "Новый заголовок",
        description: "Новое описание",
      })
    ).resolves.toMatchObject({ id: "map-1", title: "Новый заголовок" })
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/map-1/request-edit")
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" })
    const editBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(editBody).toMatchObject({
      author_nick: "Игрок",
      reason: "Исправить расстановку",
      title: "Новый заголовок",
      description: "Новое описание",
    })
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PUT" })
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(body).toMatchObject({
      title: "Новый заголовок",
      description: "Новое описание",
    })
  })

  it("fetches map status by map_uid or id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          map: { id: "map-1", status: "approved", edit_status: "approved" },
        })
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    const result = await fetchMapStatus({ mapUid: "uid-123" })
    expect(result).toMatchObject({
      id: "map-1",
      status: "approved",
      edit_status: "approved",
    })
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/status?map_uid=uid-123")
  })

  it("humanizes network, timeout, and server errors into friendly Russian messages", () => {
    const abortDomError = new DOMException("The user aborted a request.", "AbortError")
    expect(humanizeMapsApiError(abortDomError)).toBe(
      "Время ожидания ответа сервера истекло. Пожалуйста, попробуйте обновить список ещё раз."
    )

    const abortError = new Error("The operation was aborted due to timeout")
    expect(humanizeMapsApiError(abortError)).toBe(
      "Время ожидания ответа сервера истекло. Пожалуйста, попробуйте обновить список ещё раз."
    )

    const failedFetch = new TypeError("Failed to fetch")
    expect(humanizeMapsApiError(failedFetch)).toBe(
      "Сервер карт временно недоступен или отсутствует подключение к сети. Пожалуйста, повторите попытку."
    )

    const russianError = new Error("Карта не прошла валидацию")
    expect(humanizeMapsApiError(russianError)).toBe("Карта не прошла валидацию")

    expect(humanizeMapsApiError(12345, "Запасная ошибка")).toBe("Запасная ошибка")
  })
})
