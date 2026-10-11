import { describe, expect, it } from "vitest"

import type { CustomMapRecord } from "../../game/customMapsApi"

import { formatMapDate, mapWinConditionLabel } from "./communityMaps"

function mapWith(kind: "all-destructible" | "targets"): CustomMapRecord {
  return {
    id: "map-1",
    title: "Test",
    description: "",
    author_nick: "Player",
    spec_json: {
      version: 1,
      id: "map-1",
      metadata: { title: "Test" },
      blocks: [],
      winCondition: kind === "targets" ? { kind, targetIds: [] } : { kind },
    },
    likes_count: 2,
    plays_count: 3,
    created_at: "2026-10-11T00:00:00.000Z",
  }
}

describe("community map cards", () => {
  it("formats dates and win conditions for the catalog", () => {
    expect(formatMapDate("not-a-date")).toBe("дата неизвестна")
    expect(formatMapDate("2026-10-11T00:00:00.000Z")).toContain("2026")
    expect(mapWinConditionLabel(mapWith("all-destructible"))).toBe("Все блоки")
    expect(mapWinConditionLabel(mapWith("targets"))).toBe("Цели")
  })
})
