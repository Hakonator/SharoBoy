import { describe, it, expect, beforeEach, vi } from "vitest"

import {
  CAMPAIGN_MODIFIERS,
  computeRunMultipliers,
  hasModifier,
  loadSelectedModifiers,
  saveSelectedModifiers,
} from "./campaignModifiers"
import { makeEnv } from "./campaignFlow.helpers"

function makeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  }
}

describe("Campaign Modifiers (Мутаторы забегов)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
  })

  it("содержит все ключевые модификаторы из дизайн-документа", () => {
    const ids = CAMPAIGN_MODIFIERS.map((m) => m.id)
    expect(ids).toContain("ironman")
    expect(ids).toContain("heavy_gravity")
    expect(ids).toContain("hyper_speed")
    expect(ids).toContain("dense_armor")
    expect(ids).toContain("glass_paddle")
    expect(ids).toContain("inverted_controls")
  })

  it("computeRunMultipliers корректно вычисляет множители очков и кристаллов", () => {
    // Без модификаторов
    const empty = computeRunMultipliers([])
    expect(empty.scoreMultiplier).toBe(1.0)
    expect(empty.crystalMultiplier).toBe(1.0)

    // Один модификатор: ironman (+50% очков, +50% кристаллов)
    const ironmanOnly = computeRunMultipliers(["ironman"])
    expect(ironmanOnly.scoreMultiplier).toBe(1.5)
    expect(ironmanOnly.crystalMultiplier).toBe(1.5)

    // Комбинация: ironman (+50%) + heavy_gravity (+30%) + dense_armor (+40%)
    // Суммарный бонус: +120% -> множитель 2.20
    const combo = computeRunMultipliers(["ironman", "heavy_gravity", "dense_armor"])
    expect(combo.scoreMultiplier).toBe(2.2)
    expect(combo.crystalMultiplier).toBe(2.2)
  })

  it("hasModifier проверяет активность модификатора", () => {
    expect(hasModifier(["ironman", "dense_armor"], "ironman")).toBe(true)
    expect(hasModifier(["ironman", "dense_armor"], "heavy_gravity")).toBe(false)
    expect(hasModifier(undefined, "ironman")).toBe(false)
  })

  it("loadSelectedModifiers и saveSelectedModifiers сохраняют выбор в localStorage", () => {
    expect(loadSelectedModifiers()).toEqual([])
    saveSelectedModifiers(["hyper_speed", "glass_paddle"])
    expect(loadSelectedModifiers()).toEqual(["hyper_speed", "glass_paddle"])
  })

  it("startGame с модификатором ironman устанавливает ровно 1 жизнь", () => {
    const { g } = makeEnv()
    g.startGame(["ironman"])

    expect(g.campaignModifiers).toEqual(["ironman"])
    expect(g.lives).toBe(1)
  })

  it("dense_armor увеличивает прочность блоков при создании уровня", () => {
    const env1 = makeEnv()
    env1.g.startGame([])
    const target1 = env1.g.campaign!.edges.find((e) => e.from === env1.g.campaignPlayerId)!.to
    env1.g.enterMapNode(target1)
    const regularHp = env1.g.blocks.find((b) => !b.isMiniboss)?.hp ?? 1

    const env2 = makeEnv()
    env2.g.startGame(["dense_armor"])
    const target2 = env2.g.campaign!.edges.find((e) => e.from === env2.g.campaignPlayerId)!.to
    env2.g.enterMapNode(target2)
    const armoredHp = env2.g.blocks.find((b) => !b.isMiniboss)?.hp ?? 1

    expect(armoredHp).toBe(regularHp + 1)
  })

  it("hyper_speed увеличивает начальную скорость шара на 25%", () => {
    const env1 = makeEnv()
    env1.g.startGame([])
    const target1 = env1.g.campaign!.edges.find((e) => e.from === env1.g.campaignPlayerId)!.to
    env1.g.enterMapNode(target1)
    const normalSpeed = env1.g.balls[0]?.speed ?? 0

    const env2 = makeEnv()
    env2.g.startGame(["hyper_speed"])
    const target2 = env2.g.campaign!.edges.find((e) => e.from === env2.g.campaignPlayerId)!.to
    env2.g.enterMapNode(target2)
    const boostedSpeed = env2.g.balls[0]?.speed ?? 0

    expect(boostedSpeed).toBeCloseTo(normalSpeed * 1.25, 0)
  })
})
