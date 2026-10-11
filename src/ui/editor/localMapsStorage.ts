import type { CustomMapRecord } from "../../game/customMapsApi"
import type { PlayerMapSpec } from "../../game/mapSpec"

export const LOCAL_MAPS_STORAGE_KEY = "sharoboy-local-custom-maps"
export const CURRENT_MAP_ID_STORAGE_KEY = "sharoboy-current-map-id"
export const PUBLISHED_MAPS_KEY = "sharoboy-published-map-records"
export const PROJECT_UIDS_KEY = "sharoboy-map-project-uids"

export interface LocalMapEntry {
  id: string
  title: string
  updatedAt: string
  createdAt: string
  spec: PlayerMapSpec
}

export function createDefaultMap(id = `map-${Date.now()}`, title = "Новая карта"): PlayerMapSpec {
  return {
    version: 1,
    id,
    metadata: { title },
    blocks: [
      {
        id: "block-1",
        position: { x: 960, y: 300 },
        shape: "ellipse",
        size: { width: 80, height: 44 },
        hp: 1,
      },
      {
        id: "block-2",
        position: { x: 860, y: 380 },
        shape: "circle",
        size: { width: 52, height: 52 },
        hp: 2,
      },
      {
        id: "block-3",
        position: { x: 1060, y: 380 },
        shape: "ellipse",
        size: { width: 72, height: 42 },
        hp: 3,
      },
    ],
    winCondition: { kind: "all-destructible" },
  }
}

function isValidMapSpec(value: unknown): value is PlayerMapSpec {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<PlayerMapSpec>
  return (
    candidate.version === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.metadata === "object" &&
    candidate.metadata !== null &&
    Array.isArray(candidate.blocks) &&
    typeof candidate.winCondition === "object" &&
    candidate.winCondition !== null
  )
}

export function loadLocalMaps(): LocalMapEntry[] {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(LOCAL_MAPS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid: LocalMapEntry[] = []
    for (const item of parsed) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        isValidMapSpec(item.spec)
      ) {
        valid.push({
          id: item.id,
          title:
            item.spec.metadata.title ||
            (typeof item.title === "string" ? item.title : "Без названия"),
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          spec: item.spec,
        })
      }
    }
    return valid
  } catch {
    return []
  }
}

export function saveLocalMaps(maps: LocalMapEntry[]): void {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(LOCAL_MAPS_STORAGE_KEY, JSON.stringify(maps))
  } catch {
    /* localStorage quota or privacy restrictions */
  }
}

export function saveLocalMap(spec: PlayerMapSpec): LocalMapEntry[] {
  const maps = loadLocalMaps()
  const now = new Date().toISOString()
  const title = spec.metadata.title.trim() || "Без названия"
  const existingIndex = maps.findIndex((m) => m.id === spec.id)
  let updated: LocalMapEntry[]
  if (existingIndex >= 0) {
    updated = maps.map((entry, idx) =>
      idx === existingIndex
        ? {
            ...entry,
            title,
            updatedAt: now,
            spec,
          }
        : entry
    )
  } else {
    updated = [
      {
        id: spec.id,
        title,
        createdAt: now,
        updatedAt: now,
        spec,
      },
      ...maps,
    ]
  }
  saveLocalMaps(updated)
  return updated
}

export function deleteLocalMap(id: string): LocalMapEntry[] {
  const maps = loadLocalMaps()
  const filtered = maps.filter((m) => m.id !== id)
  saveLocalMaps(filtered)
  return filtered
}

export function getCurrentLocalMapId(): string | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(CURRENT_MAP_ID_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setCurrentLocalMapId(id: string | null): void {
  try {
    if (typeof localStorage === "undefined") return
    if (id) {
      localStorage.setItem(CURRENT_MAP_ID_STORAGE_KEY, id)
    } else {
      localStorage.removeItem(CURRENT_MAP_ID_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function projectUidForMap(projectId: string): string {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROJECT_UIDS_KEY) ?? "{}")
    const records =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
    if (typeof records[projectId] === "string" && records[projectId]) {
      return records[projectId] as string
    }
    const generated =
      globalThis.crypto?.randomUUID?.() ??
      `map-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(PROJECT_UIDS_KEY, JSON.stringify({ ...records, [projectId]: generated }))
    return generated
  } catch {
    return projectId
  }
}

export function loadPublishedRecords(): CustomMapRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PUBLISHED_MAPS_KEY) ?? "[]")
    if (!Array.isArray(value)) return []
    return value.filter(
      (item): item is CustomMapRecord => typeof item === "object" && item !== null
    )
  } catch {
    return []
  }
}

export function loadRecordForMap(mapUid: string): CustomMapRecord | null {
  const records = loadPublishedRecords()
  return records.find((item) => item.map_uid === mapUid) ?? null
}

export function savePublishedRecord(record: CustomMapRecord): void {
  try {
    const records = loadPublishedRecords()
    const next = records.filter((item) => item.map_uid !== record.map_uid && item.id !== record.id)
    localStorage.setItem(PUBLISHED_MAPS_KEY, JSON.stringify([...next, record]))
  } catch {
    /* ignore */
  }
}
