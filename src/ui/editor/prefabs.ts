import type { PlayerBlockSpec } from "../../game/mapSpec"

export interface EditorPrefab {
  id: string
  title: string
  description: string
  category: "geometry" | "tactical" | "shapes" | "custom"
  blocks: PlayerBlockSpec[]
}

const PREFABS_STORAGE_KEY = "sharoboy_editor_custom_prefabs"

export const BUILTIN_PREFABS: EditorPrefab[] = [
  {
    id: "prefab-shield",
    title: "🛡️ Щит Стража",
    description: "Бронированная защитная дуга с прочным центральным ядром (7 блоков)",
    category: "tactical",
    blocks: [
      {
        id: "p1",
        position: { x: -160, y: 30 },
        shape: "rect",
        size: { width: 64, height: 36 },
        hp: 2,
        rotation: -0.26,
      },
      {
        id: "p2",
        position: { x: -80, y: 10 },
        shape: "rect",
        size: { width: 64, height: 36 },
        hp: 3,
        rotation: -0.13,
      },
      {
        id: "p3",
        position: { x: 0, y: 0 },
        shape: "circle",
        size: { width: 50, height: 50 },
        hp: 4,
        effects: [{ kind: "armor", amount: 2 }],
      },
      {
        id: "p4",
        position: { x: 80, y: 10 },
        shape: "rect",
        size: { width: 64, height: 36 },
        hp: 3,
        rotation: 0.13,
      },
      {
        id: "p5",
        position: { x: 160, y: 30 },
        shape: "rect",
        size: { width: 64, height: 36 },
        hp: 2,
        rotation: 0.26,
      },
      {
        id: "p6",
        position: { x: -70, y: 55 },
        shape: "round_rect",
        size: { width: 56, height: 28 },
        hp: 1,
      },
      {
        id: "p7",
        position: { x: 70, y: 55 },
        shape: "round_rect",
        size: { width: 56, height: 28 },
        hp: 1,
      },
    ],
  },
  {
    id: "prefab-star",
    title: "⚙️ Звезда / Шестерёнка",
    description: "8-лучевое симметричное кольцо вокруг центрального импульсного ядра (9 блоков)",
    category: "geometry",
    blocks: [
      {
        id: "p0",
        position: { x: 0, y: 0 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 3,
        effects: [{ kind: "pulse", amplitude: 0.25, frequency: 1.5 }],
      },
      {
        id: "p1",
        position: { x: 0, y: -75 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: 0,
      },
      {
        id: "p2",
        position: { x: 53, y: -53 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: Math.PI / 4,
      },
      {
        id: "p3",
        position: { x: 75, y: 0 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: Math.PI / 2,
      },
      {
        id: "p4",
        position: { x: 53, y: 53 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: (3 * Math.PI) / 4,
      },
      {
        id: "p5",
        position: { x: 0, y: 75 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: Math.PI,
      },
      {
        id: "p6",
        position: { x: -53, y: 53 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: -(3 * Math.PI) / 4,
      },
      {
        id: "p7",
        position: { x: -75, y: 0 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: -Math.PI / 2,
      },
      {
        id: "p8",
        position: { x: -53, y: -53 },
        shape: "ellipse",
        size: { width: 36, height: 54 },
        hp: 2,
        rotation: -Math.PI / 4,
      },
    ],
  },
  {
    id: "prefab-arch",
    title: "🏛️ Квантовая Портал-Арка",
    description: "Портальные пилоны с парной телепортацией и неоновым сводом (6 блоков)",
    category: "tactical",
    blocks: [
      {
        id: "p1",
        position: { x: -140, y: 40 },
        shape: "rect",
        size: { width: 48, height: 80 },
        hp: 3,
        effects: [{ kind: "portal", pairId: "arch-gate" }],
        links: [{ kind: "portal-pair", targetBlockId: "p2" }],
      },
      {
        id: "p2",
        position: { x: 140, y: 40 },
        shape: "rect",
        size: { width: 48, height: 80 },
        hp: 3,
        effects: [{ kind: "portal", pairId: "arch-gate" }],
        links: [{ kind: "portal-pair", targetBlockId: "p1" }],
      },
      {
        id: "p3",
        position: { x: -90, y: -25 },
        shape: "round_rect",
        size: { width: 64, height: 32 },
        hp: 2,
        rotation: -0.2,
      },
      {
        id: "p4",
        position: { x: -30, y: -45 },
        shape: "rect",
        size: { width: 56, height: 32 },
        hp: 2,
      },
      {
        id: "p5",
        position: { x: 30, y: -45 },
        shape: "rect",
        size: { width: 56, height: 32 },
        hp: 2,
      },
      {
        id: "p6",
        position: { x: 90, y: -25 },
        shape: "round_rect",
        size: { width: 64, height: 32 },
        hp: 2,
        rotation: 0.2,
      },
    ],
  },
  {
    id: "prefab-cross",
    title: "➕ Крест Бездны",
    description: "Симметричный крест с пружинными ускорителями на лучах (5 блоков)",
    category: "shapes",
    blocks: [
      { id: "p0", position: { x: 0, y: 0 }, shape: "rect", size: { width: 50, height: 50 }, hp: 3 },
      {
        id: "p1",
        position: { x: 0, y: -65 },
        shape: "rect",
        size: { width: 44, height: 50 },
        hp: 2,
        effects: [{ kind: "spring", speedMultiplier: 1.4, duration: 1.5 }],
      },
      {
        id: "p2",
        position: { x: 0, y: 65 },
        shape: "rect",
        size: { width: 44, height: 50 },
        hp: 2,
        effects: [{ kind: "spring", speedMultiplier: 1.4, duration: 1.5 }],
      },
      {
        id: "p3",
        position: { x: -65, y: 0 },
        shape: "rect",
        size: { width: 50, height: 44 },
        hp: 2,
        effects: [{ kind: "spring", speedMultiplier: 1.4, duration: 1.5 }],
      },
      {
        id: "p4",
        position: { x: 65, y: 0 },
        shape: "rect",
        size: { width: 50, height: 44 },
        hp: 2,
        effects: [{ kind: "spring", speedMultiplier: 1.4, duration: 1.5 }],
      },
    ],
  },
  {
    id: "prefab-honeycomb",
    title: "⬡ Квантовые соты",
    description: "Плотный гексагональный кластер круглых блоков (7 блоков)",
    category: "geometry",
    blocks: [
      {
        id: "p0",
        position: { x: 0, y: 0 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 3,
      },
      {
        id: "p1",
        position: { x: 0, y: -52 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 2,
      },
      {
        id: "p2",
        position: { x: 45, y: -26 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 2,
      },
      {
        id: "p3",
        position: { x: 45, y: 26 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 2,
      },
      {
        id: "p4",
        position: { x: 0, y: 52 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 2,
      },
      {
        id: "p5",
        position: { x: -45, y: 26 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 2,
      },
      {
        id: "p6",
        position: { x: -45, y: -26 },
        shape: "circle",
        size: { width: 44, height: 44 },
        hp: 2,
      },
    ],
  },
  {
    id: "prefab-wave",
    title: "🌊 Синусоидная волна",
    description: "Плавная каскадная волна с градиентом прочности (6 блоков)",
    category: "shapes",
    blocks: [
      {
        id: "p1",
        position: { x: -160, y: 30 },
        shape: "ellipse",
        size: { width: 54, height: 32 },
        hp: 1,
        rotation: -0.3,
      },
      {
        id: "p2",
        position: { x: -95, y: -10 },
        shape: "ellipse",
        size: { width: 54, height: 32 },
        hp: 2,
        rotation: -0.15,
      },
      {
        id: "p3",
        position: { x: -30, y: -35 },
        shape: "ellipse",
        size: { width: 54, height: 32 },
        hp: 3,
        rotation: 0,
      },
      {
        id: "p4",
        position: { x: 35, y: -20 },
        shape: "ellipse",
        size: { width: 54, height: 32 },
        hp: 3,
        rotation: 0.2,
      },
      {
        id: "p5",
        position: { x: 100, y: 15 },
        shape: "ellipse",
        size: { width: 54, height: 32 },
        hp: 2,
        rotation: 0.35,
      },
      {
        id: "p6",
        position: { x: 165, y: 40 },
        shape: "ellipse",
        size: { width: 54, height: 32 },
        hp: 1,
        rotation: 0.1,
      },
    ],
  },
]

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage
  if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage
  return null
}

export function loadCustomPrefabs(): EditorPrefab[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(PREFABS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomPrefab(
  title: string,
  description: string,
  blocks: PlayerBlockSpec[]
): EditorPrefab {
  const existing = loadCustomPrefabs()
  // Normalize positions relative to bounding center
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const b of blocks) {
    minX = Math.min(minX, b.position.x)
    maxX = Math.max(maxX, b.position.x)
    minY = Math.min(minY, b.position.y)
    maxY = Math.max(maxY, b.position.y)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const normalizedBlocks: PlayerBlockSpec[] = blocks.map((b) => ({
    ...structuredClone(b),
    position: {
      x: Math.round(b.position.x - cx),
      y: Math.round(b.position.y - cy),
    },
  }))

  const newPrefab: EditorPrefab = {
    id: `custom-prefab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: title.trim() || `Шаблон (${blocks.length} бл.)`,
    description: description.trim() || `Пользовательский шаблон из ${blocks.length} блоков`,
    category: "custom",
    blocks: normalizedBlocks,
  }

  const updated = [newPrefab, ...existing]
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(PREFABS_STORAGE_KEY, JSON.stringify(updated))
    } catch (err) {
      console.error("Failed to save custom prefab to localStorage", err)
    }
  }
  return newPrefab
}

export function deleteCustomPrefab(id: string): void {
  const existing = loadCustomPrefabs()
  const updated = existing.filter((p) => p.id !== id)
  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(PREFABS_STORAGE_KEY, JSON.stringify(updated))
    } catch (err) {
      console.error("Failed to delete custom prefab", err)
    }
  }
}
