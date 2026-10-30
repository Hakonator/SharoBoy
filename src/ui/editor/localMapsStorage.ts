import type { CustomMapRecord } from "../../game/customMapsApi"
import type { MapPlaylistSpec, PlayerMapSpec } from "../../game/mapSpec"

export const LOCAL_MAPS_STORAGE_KEY = "sharoboy-local-custom-maps"
export const CURRENT_MAP_ID_STORAGE_KEY = "sharoboy-current-map-id"
export const PUBLISHED_MAPS_KEY = "sharoboy-published-map-records"
export const PROJECT_UIDS_KEY = "sharoboy-map-project-uids"
export const LOCAL_PLAYLISTS_STORAGE_KEY = "sharoboy-local-custom-playlists"

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

export interface LocalPlaylistEntry {
  id: string
  title: string
  description?: string
  author?: string
  updatedAt: string
  createdAt: string
  spec: MapPlaylistSpec
}

export function createDefaultPlaylist(maps?: PlayerMapSpec[]): MapPlaylistSpec {
  const chosenMaps: PlayerMapSpec[] =
    maps && maps.length >= 2
      ? maps
      : [
          createDefaultMap("map-intro-1", "1. Вводный рубеж"),
          {
            version: 1,
            id: "map-intro-2",
            metadata: {
              title: "2. Неоновая геометрия",
              description: "Прямоугольные и бронированные блоки",
            },
            blocks: [
              {
                id: "b-r1",
                position: { x: 760, y: 320 },
                shape: "rect",
                size: { width: 70, height: 36 },
                hp: 2,
              },
              {
                id: "b-r2",
                position: { x: 960, y: 320 },
                shape: "round_rect",
                size: { width: 80, height: 40 },
                hp: 3,
                effects: [{ kind: "armor", amount: 1 }],
              },
              {
                id: "b-r3",
                position: { x: 1160, y: 320 },
                shape: "rect",
                size: { width: 70, height: 36 },
                hp: 2,
              },
              {
                id: "b-r4",
                position: { x: 860, y: 400 },
                shape: "round_rect",
                size: { width: 64, height: 36 },
                hp: 1,
                effects: [{ kind: "spring" }],
              },
              {
                id: "b-r5",
                position: { x: 1060, y: 400 },
                shape: "round_rect",
                size: { width: 64, height: 36 },
                hp: 1,
                effects: [{ kind: "cotton" }],
              },
            ],
            winCondition: { kind: "all-destructible" },
          },
          {
            version: 1,
            id: "map-intro-3",
            metadata: { title: "3. Квантовый финал", description: "Порталы и силовые магниты" },
            blocks: [
              {
                id: "b-p1",
                position: { x: 700, y: 280 },
                shape: "circle",
                size: { width: 48, height: 48 },
                hp: 1,
                effects: [{ kind: "portal", pairId: "portal-alpha" }],
                links: [{ kind: "portal-pair", targetBlockId: "b-p2" }],
              },
              {
                id: "b-p2",
                position: { x: 1220, y: 280 },
                shape: "circle",
                size: { width: 48, height: 48 },
                hp: 1,
                effects: [{ kind: "portal", pairId: "portal-alpha" }],
                links: [{ kind: "portal-pair", targetBlockId: "b-p1" }],
              },
              {
                id: "b-m1",
                position: { x: 960, y: 240 },
                shape: "round_rect",
                size: { width: 90, height: 42 },
                hp: 3,
                effects: [{ kind: "magnet", mode: "attract", radius: 140, force: 120 }],
              },
              {
                id: "b-c1",
                position: { x: 860, y: 360 },
                shape: "rect",
                size: { width: 72, height: 36 },
                hp: 2,
              },
              {
                id: "b-c2",
                position: { x: 1060, y: 360 },
                shape: "rect",
                size: { width: 72, height: 36 },
                hp: 2,
              },
            ],
            winCondition: { kind: "all-destructible" },
          },
        ]

  return {
    version: 1,
    id: "playlist-starter-trilogy",
    metadata: {
      title: "Трилогия Бездны",
      description: "Мини-кампания из 3 секторов с разными типами и формами блоков",
      author: "SharoBoy",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    maps: chosenMaps,
  }
}

export function loadLocalPlaylists(): LocalPlaylistEntry[] {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(LOCAL_PLAYLISTS_STORAGE_KEY)
    if (!raw) {
      // Инициализируем стартовый плейлист, чтобы у игрока сразу была готовая мини-кампания
      const def = createDefaultPlaylist()
      const initialEntry: LocalPlaylistEntry = {
        id: def.id,
        title: def.metadata.title,
        description: def.metadata.description,
        author: def.metadata.author,
        createdAt: def.metadata.createdAt ?? new Date().toISOString(),
        updatedAt: def.metadata.updatedAt ?? new Date().toISOString(),
        spec: def,
      }
      saveLocalPlaylists([initialEntry])
      return [initialEntry]
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is LocalPlaylistEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.spec === "object" &&
        item.spec !== null &&
        Array.isArray(item.spec.maps)
    )
  } catch {
    return []
  }
}

export function saveLocalPlaylists(playlists: LocalPlaylistEntry[]): void {
  try {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(LOCAL_PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists))
  } catch {
    /* ignore */
  }
}

export function saveLocalPlaylist(spec: MapPlaylistSpec): LocalPlaylistEntry[] {
  const playlists = loadLocalPlaylists()
  const now = new Date().toISOString()
  const title = spec.metadata.title.trim() || "Новый плейлист"
  const existingIndex = playlists.findIndex((p) => p.id === spec.id)
  let updated: LocalPlaylistEntry[]
  if (existingIndex >= 0) {
    updated = playlists.map((entry, idx) =>
      idx === existingIndex
        ? {
            ...entry,
            title,
            description: spec.metadata.description,
            author: spec.metadata.author,
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
        description: spec.metadata.description,
        author: spec.metadata.author,
        createdAt: now,
        updatedAt: now,
        spec,
      },
      ...playlists,
    ]
  }
  saveLocalPlaylists(updated)
  return updated
}

export function deleteLocalPlaylist(id: string): LocalPlaylistEntry[] {
  const playlists = loadLocalPlaylists()
  const filtered = playlists.filter((p) => p.id !== id)
  saveLocalPlaylists(filtered)
  return filtered
}
