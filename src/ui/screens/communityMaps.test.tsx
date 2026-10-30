import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CustomMapRecord } from "../../game/customMapsApi"
import {
  deleteLocalPlaylist,
  loadLocalMaps,
  loadLocalPlaylists,
  saveLocalMap,
  saveLocalPlaylist,
  setCurrentLocalMapId,
} from "../editor/localMapsStorage"

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

  it("loads default starter playlist and allows saving and deleting playlists", () => {
    const initial = loadLocalPlaylists()
    expect(initial.length).toBe(1)
    expect(initial[0].title).toBe("Трилогия Бездны")
    expect(initial[0].spec.maps.length).toBe(3)

    const customEntry = saveLocalPlaylist({
      version: 1,
      id: "custom-test-playlist",
      metadata: {
        title: "Пользовательский тест",
        author: "Тестер",
        createdAt: "2026-10-30T00:00:00.000Z",
        updatedAt: "2026-10-30T00:00:00.000Z",
      },
      maps: initial[0].spec.maps.slice(0, 2),
    })

    expect(customEntry.length).toBe(2)
    const afterDelete = deleteLocalPlaylist("custom-test-playlist")
    expect(afterDelete.length).toBe(1)
    expect(afterDelete[0].id).toBe("playlist-starter-trilogy")
  })

  it("renders playlists toggle tab in community maps hub", () => {
    const html = renderToStaticMarkup(
      <CommunityMaps onBack={() => {}} onPlay={() => {}} onPlayPlaylist={() => {}} />
    )
    expect(html).toContain("Одиночные карты")
    expect(html).toContain("Плейлисты (Мини-кампании)")
  })
})
