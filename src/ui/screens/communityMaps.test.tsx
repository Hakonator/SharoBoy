import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CustomMapRecord } from "../../game/customMapsApi"
import { loadLocalMaps, saveLocalMap, setCurrentLocalMapId } from "../editor/localMapsStorage"

import { CommunityMaps, formatMapDate, mapWinConditionLabel } from "./communityMaps"

function mapWith(kind: "all-destructible" | "targets"): CustomMapRecord {
  return {
    id: "map-1",
    title: "Test Map",
    description: "Sample description",
    author_nick: "OtherPlayer",
    spec_json: {
      version: 1,
      id: "map-1",
      metadata: { title: "Test Map" },
      blocks: [],
      winCondition: kind === "targets" ? { kind, targetIds: [] } : { kind },
    },
    likes_count: 2,
    plays_count: 3,
    created_at: "2026-10-11T00:00:00.000Z",
  }
}

describe("community map cards", () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
  })

  it("formats dates and win conditions for the catalog", () => {
    expect(formatMapDate("not-a-date")).toBe("дата неизвестна")
    expect(formatMapDate("2026-10-11T00:00:00.000Z")).toContain("2026")
    expect(mapWinConditionLabel(mapWith("all-destructible"))).toBe("Все блоки")
    expect(mapWinConditionLabel(mapWith("targets"))).toBe("Цели")
  })

  it("renders community hub screen with navigation header and fallback", () => {
    const html = renderToStaticMarkup(<CommunityMaps onBack={() => {}} onPlay={() => {}} />)
    expect(html).toContain("COMMUNITY HUB")
    expect(html).toContain("Карты сообщества")
    expect(html).toContain("В меню")
  })

  it("supports cloning community map spec to local storage", () => {
    const original = mapWith("all-destructible")
    const newId = `map-${Date.now()}`
    const copyTitle = `${original.spec_json.metadata.title} (копия)`
    const clonedSpec = {
      ...original.spec_json,
      id: newId,
      metadata: {
        ...original.spec_json.metadata,
        title: copyTitle,
      },
    }

    saveLocalMap(clonedSpec)
    setCurrentLocalMapId(newId)

    const stored = loadLocalMaps()
    expect(stored.length).toBe(1)
    expect(stored[0].title).toBe("Test Map (копия)")
    expect(stored[0].id).toBe(newId)
  })
})
