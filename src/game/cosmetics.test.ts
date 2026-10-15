import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  buyCosmetic,
  DEFAULT_EQUIPPED_COSMETICS,
  DEFAULT_UNLOCKED_COSMETICS,
  equipCosmetic,
  getBallTrailDef,
  getPaddleSkinDef,
  getTableThemeDef,
  isCosmeticUnlocked,
  loadPlayerCosmetics,
  PADDLE_SKINS,
  savePlayerCosmetics,
} from "./cosmetics"

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => {
      map.clear()
    },
  }
}

describe("cosmetics", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
  })

  it("возвращает дефолтный набор при пустом хранилище", () => {
    const data = loadPlayerCosmetics()
    expect(data.equipped).toEqual(DEFAULT_EQUIPPED_COSMETICS)
    expect(data.unlocked).toEqual(DEFAULT_UNLOCKED_COSMETICS)
  })

  it("сохраняет и загружает состояние кастомизации", () => {
    savePlayerCosmetics({
      unlocked: ["paddle:default", "paddle:cyberpunk", "ball:default", "theme:ocean"],
      equipped: { paddle: "cyberpunk", ball: "default", theme: "ocean" },
    })

    const data = loadPlayerCosmetics()
    expect(data.equipped.paddle).toBe("cyberpunk")
    expect(data.unlocked).toContain("paddle:cyberpunk")
  })

  it("проверяет разблокированность косметических предметов", () => {
    const cosmetics = loadPlayerCosmetics()
    expect(isCosmeticUnlocked("paddle", "default", cosmetics)).toBe(true)
    expect(isCosmeticUnlocked("theme", "ocean", cosmetics)).toBe(true)
    expect(isCosmeticUnlocked("paddle", "gold", cosmetics)).toBe(false)
  })

  it("экипирует только разблокированные предметы", () => {
    const initial = loadPlayerCosmetics()
    // Попытка надеть заблокированное не меняет экипировку
    const afterFailed = equipCosmetic("paddle", "gold", initial)
    expect(afterFailed.equipped.paddle).toBe("default")

    // Разблокированный предмет успешно надевается
    const withGold = {
      ...initial,
      unlocked: [...initial.unlocked, "paddle:gold"],
    }
    const afterSuccess = equipCosmetic("paddle", "gold", withGold)
    expect(afterSuccess.equipped.paddle).toBe("gold")
  })

  it("покупка предмета списывает кристаллы и разблокирует предмет", () => {
    const initial = loadPlayerCosmetics()
    const goldCost = PADDLE_SKINS.find((p) => p.id === "gold")?.cost ?? 75

    // Недостаточно кристаллов
    const resFail = buyCosmetic("paddle", "gold", goldCost - 10, initial)
    expect(resFail.success).toBe(false)
    expect(resFail.newCrystals).toBe(goldCost - 10)
    expect(resFail.newCosmetics.equipped.paddle).toBe("default")

    // Достаточно кристаллов
    const resOk = buyCosmetic("paddle", "gold", 100, initial)
    expect(resOk.success).toBe(true)
    expect(resOk.newCrystals).toBe(100 - goldCost)
    expect(resOk.newCosmetics.unlocked).toContain("paddle:gold")
    expect(resOk.newCosmetics.equipped.paddle).toBe("gold")
  })

  it("getDef функции возвращают корректные дефиниции с фоллбэком", () => {
    expect(getPaddleSkinDef("cyberpunk").name).toBe("Киберпанк")
    expect(getBallTrailDef("fire").name).toBe("Огненный Метеор")
    expect(getTableThemeDef("nebula").name).toBe("Космическая Туманность")
    // @ts-expect-error Тест некорректного id
    expect(getPaddleSkinDef("unknown").id).toBe("default")
  })
})
