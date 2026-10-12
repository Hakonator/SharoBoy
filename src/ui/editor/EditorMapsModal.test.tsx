import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { CustomMapRecord } from "../../game/customMapsApi"
import type { PlayerMapSpec } from "../../game/mapSpec"

import { EditorMapsModal, formatLocalDate, MapStatusBadge } from "./EditorMapsModal"
import {
  createDefaultMap,
  deleteLocalMap,
  getCurrentLocalMapId,
  loadLocalMaps,
  loadRecordForMap,
  projectUidForMap,
  saveLocalMap,
  savePublishedRecord,
  setCurrentLocalMapId,
  type LocalMapEntry,
} from "./localMapsStorage"

const mockMap: PlayerMapSpec = {
  version: 1,
  id: "test-map-1",
  metadata: { title: "Первая тестовая" },
  blocks: [
    {
      id: "b1",
      position: { x: 500, y: 300 },
      shape: "ellipse",
      size: { width: 64, height: 40 },
      hp: 1,
    },
  ],
  winCondition: { kind: "all-destructible" },
}

describe("localMapsStorage", () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    })
  })

  it("creates, saves, loads and deletes local maps", () => {
    expect(loadLocalMaps()).toEqual([])
    const saved = saveLocalMap(mockMap)
    expect(saved).toHaveLength(1)
    expect(saved[0]?.title).toBe("Первая тестовая")

    const loaded = loadLocalMaps()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.spec.id).toBe("test-map-1")

    // Update existing map
    const updatedMap = {
      ...mockMap,
      metadata: { ...mockMap.metadata, title: "Обновлённое название" },
    }
    const updated = saveLocalMap(updatedMap)
    expect(updated).toHaveLength(1)
    expect(updated[0]?.title).toBe("Обновлённое название")

    // Current map id management
    setCurrentLocalMapId("test-map-1")
    expect(getCurrentLocalMapId()).toBe("test-map-1")
    setCurrentLocalMapId(null)
    expect(getCurrentLocalMapId()).toBeNull()

    // Delete map
    const afterDelete = deleteLocalMap("test-map-1")
    expect(afterDelete).toEqual([])
    expect(loadLocalMaps()).toEqual([])
  })

  it("maintains project uids and published records", () => {
    const uid1 = projectUidForMap("project-alpha")
    const uid2 = projectUidForMap("project-alpha")
    expect(uid1).toBe(uid2)

    const record: CustomMapRecord = {
      id: "server-id-1",
      title: "Alpha Map",
      description: "Test description",
      author_nick: "Player",
      spec_json: mockMap,
      status: "approved",
      edit_status: "approved",
      map_uid: uid1,
      likes_count: 5,
      plays_count: 10,
      created_at: new Date().toISOString(),
    }

    savePublishedRecord(record)
    const loaded = loadRecordForMap(uid1)
    expect(loaded).toEqual(record)
    expect(loadRecordForMap("other-uid")).toBeNull()
  })

  it("creates a valid default map", () => {
    const defaultMap = createDefaultMap("custom-1", "Тестовая карта")
    expect(defaultMap.version).toBe(1)
    expect(defaultMap.id).toBe("custom-1")
    expect(defaultMap.metadata.title).toBe("Тестовая карта")
    expect(defaultMap.blocks.length).toBeGreaterThan(0)
  })
})

describe("EditorMapsModal and MapStatusBadge", () => {
  it("renders status badges according to moderation state", () => {
    expect(renderToStaticMarkup(<MapStatusBadge record={null} />)).toContain("Черновик")

    const pendingRecord: CustomMapRecord = {
      id: "1",
      title: "M",
      description: "",
      author_nick: "A",
      spec_json: mockMap,
      status: "pending",
      likes_count: 0,
      plays_count: 0,
      created_at: "2026-10-11T00:00:00Z",
    }
    expect(renderToStaticMarkup(<MapStatusBadge record={pendingRecord} />)).toContain("На проверке")

    const approvedRecord: CustomMapRecord = {
      ...pendingRecord,
      status: "approved",
    }
    expect(renderToStaticMarkup(<MapStatusBadge record={approvedRecord} />)).toContain("Принята")

    const rejectedRecord: CustomMapRecord = {
      ...pendingRecord,
      status: "rejected",
      reject_reason: "Слишком простая",
    }
    expect(renderToStaticMarkup(<MapStatusBadge record={rejectedRecord} />)).toContain("Отклонена")

    const editApprovedRecord: CustomMapRecord = {
      ...pendingRecord,
      status: "approved",
      edit_status: "approved",
    }
    expect(renderToStaticMarkup(<MapStatusBadge record={editApprovedRecord} />)).toContain(
      "Изменение согласовано"
    )

    const editRequestedRecord: CustomMapRecord = {
      ...pendingRecord,
      status: "approved",
      edit_status: "requested",
    }
    expect(renderToStaticMarkup(<MapStatusBadge record={editRequestedRecord} />)).toContain(
      "Изменения на проверке"
    )
  })

  it("renders catalog modal with local map entries", () => {
    const entries: LocalMapEntry[] = [
      {
        id: "test-map-1",
        title: "Первая карта",
        createdAt: "2026-10-11T12:00:00Z",
        updatedAt: "2026-10-11T12:00:00Z",
        spec: mockMap,
      },
    ]

    const html = renderToStaticMarkup(
      <EditorMapsModal
        currentMapId="test-map-1"
        maps={entries}
        onClose={() => {}}
        onCreateMap={() => {}}
        onDeleteMap={() => {}}
        onSelectMap={() => {}}
      />
    )

    expect(html).toContain("Мои карты")
    expect(html).toContain("Первая карта")
    expect(html).toContain("Открыта сейчас")
    expect(html).toContain("Продолжить")
  })

  it("renders request edit button for approved maps", () => {
    savePublishedRecord({
      id: "published-1",
      title: "Одобренная карта",
      description: "Тест",
      author_nick: "Hakonator",
      spec_json: mockMap,
      status: "approved",
      edit_status: "none",
      map_uid: projectUidForMap("test-map-1"),
      likes_count: 5,
      plays_count: 10,
      created_at: new Date().toISOString(),
    })
    const entries: LocalMapEntry[] = [
      {
        id: "test-map-1",
        title: "Одобренная карта",
        createdAt: "2026-10-11T12:00:00Z",
        updatedAt: "2026-10-11T12:00:00Z",
        spec: mockMap,
      },
    ]
    const html = renderToStaticMarkup(
      <EditorMapsModal
        currentMapId="other"
        maps={entries}
        onClose={() => {}}
        onCreateMap={() => {}}
        onDeleteMap={() => {}}
        onSelectMap={() => {}}
      />
    )
    expect(html).toContain("✎ Запросить изменение")
  })

  it("formats dates gracefully", () => {
    expect(formatLocalDate("invalid-date")).toBe("недавно")
    expect(formatLocalDate(new Date().toISOString())).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })
})
