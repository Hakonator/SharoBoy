import { beforeEach, describe, expect, it, vi } from "vitest"

import { makeEnv } from "./campaignFlow.helpers"
import { buyCosmeticItem, equipCosmeticItem, loadProgress, saveProgress } from "./game/progress"
import type { Game } from "./game"

describe("Интеграция косметики в Game движок", () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v)
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k]
      },
    })
  })

  it("loadProgress загружает дефолтную косметику при чистом профиле", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    loadProgress(game)

    expect(game.cosmetics.equipped.paddle).toBe("default")
    expect(game.cosmetics.equipped.ball).toBe("default")
    expect(game.cosmetics.equipped.theme).toBe("ocean")
    expect(game.cosmetics.unlocked).toContain("paddle:default")
  })

  it("покупка косметики списывает мета-кристаллы и экипирует скин", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.metaCrystals = 100
    saveProgress(game)

    const ok = buyCosmeticItem(game, "paddle", "cyberpunk") // cost: 50
    expect(ok).toBe(true)
    expect(game.metaCrystals).toBe(50)
    expect(game.cosmetics.equipped.paddle).toBe("cyberpunk")
    expect(game.cosmetics.unlocked).toContain("paddle:cyberpunk")

    // Проверяем сохранение в localStorage
    const game2 = makeEnv().g as unknown as Game
    loadProgress(game2)
    expect(game2.cosmetics.equipped.paddle).toBe("cyberpunk")
    expect(game2.metaCrystals).toBe(50)
  })

  it("покупка не срабатывает при нехватке кристаллов", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.metaCrystals = 20

    const ok = buyCosmeticItem(game, "paddle", "cyberpunk") // cost: 50
    expect(ok).toBe(false)
    expect(game.metaCrystals).toBe(20)
    expect(game.cosmetics.equipped.paddle).toBe("default")
  })

  it("экипировка скина переключает экипировку только для открытых предметов", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.metaCrystals = 100

    buyCosmeticItem(game, "ball", "fire")
    expect(game.cosmetics.equipped.ball).toBe("fire")

    // Возврат на дефолт
    equipCosmeticItem(game, "ball", "default")
    expect(game.cosmetics.equipped.ball).toBe("default")

    // Повторное надевание купленного
    equipCosmeticItem(game, "ball", "fire")
    expect(game.cosmetics.equipped.ball).toBe("fire")

    // Попытка надеть некупленный
    equipCosmeticItem(game, "ball", "rainbow")
    expect(game.cosmetics.equipped.ball).toBe("fire")
  })

  it("resetAccountData сбрасывает косметику на начальные значения", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.metaCrystals = 100
    buyCosmeticItem(game, "theme", "nebula")
    expect(game.cosmetics.equipped.theme).toBe("nebula")

    game.resetAccountData()
    expect(game.metaCrystals).toBe(0)
    expect(game.cosmetics.equipped.theme).toBe("ocean")
    expect(game.cosmetics.unlocked).toEqual(["paddle:default", "ball:default", "theme:ocean"])
  })
})
