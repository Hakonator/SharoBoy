import { describe, expect, it, vi } from "vitest"

import { BUILTIN_PREFABS, deleteCustomPrefab, loadCustomPrefabs, saveCustomPrefab } from "./prefabs"

describe("prefabs", () => {
  it("provides built-in tactical and geometric prefabs", () => {
    expect(BUILTIN_PREFABS.length).toBeGreaterThanOrEqual(6)
    const shield = BUILTIN_PREFABS.find((p) => p.id === "prefab-shield")
    expect(shield).toBeDefined()
    expect(shield!.blocks.length).toBe(7)

    const star = BUILTIN_PREFABS.find((p) => p.id === "prefab-star")
    expect(star).toBeDefined()
    expect(star!.blocks.length).toBe(9)

    const arch = BUILTIN_PREFABS.find((p) => p.id === "prefab-arch")
    expect(arch).toBeDefined()
    expect(arch!.blocks.some((b) => b.effects?.some((e) => e.kind === "portal"))).toBe(true)
  })

  it("saves, loads and deletes custom prefabs from localStorage", () => {
    const storage = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
    })

    const sampleBlocks = [
      {
        id: "b1",
        position: { x: 500, y: 300 },
        shape: "circle" as const,
        size: { width: 40, height: 40 },
        hp: 3,
      },
      {
        id: "b2",
        position: { x: 600, y: 300 },
        shape: "rect" as const,
        size: { width: 60, height: 40 },
        hp: 2,
      },
    ]

    const saved = saveCustomPrefab("Мой кластер", "Тестовый шаблон", sampleBlocks)
    expect(saved.id).toMatch(/^custom-prefab-/)
    expect(saved.title).toBe("Мой кластер")
    // Normalized to center (dx = -50, dx = 50)
    expect(saved.blocks[0]!.position.x).toBe(-50)
    expect(saved.blocks[1]!.position.x).toBe(50)

    const loaded = loadCustomPrefabs()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.id).toBe(saved.id)

    deleteCustomPrefab(saved.id)
    expect(loadCustomPrefabs()).toHaveLength(0)

    vi.unstubAllGlobals()
  })
})
