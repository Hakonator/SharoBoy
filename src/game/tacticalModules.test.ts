import { describe, it, expect, beforeEach, vi } from "vitest"

import {
  DEFAULT_TACTICAL_MODULES,
  loadTacticalModules,
  saveTacticalModules,
  validateTacticalModules,
} from "./tacticalModules"

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

describe("tacticalModules", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
  })

  it("возвращает дефолтные значения при пустом localStorage", () => {
    const modules = loadTacticalModules()
    expect(modules).toEqual(DEFAULT_TACTICAL_MODULES)
    expect(modules.paddleRotation).toBe(true)
    expect(modules.paddleImpulse).toBe(false)
    expect(modules.aimGuide).toBe(true)
    expect(modules.magnetStart).toBe(true)
  })

  it("корректно валидирует повреждённый или неполный объект", () => {
    expect(validateTacticalModules(null)).toEqual(DEFAULT_TACTICAL_MODULES)
    expect(validateTacticalModules("invalid")).toEqual(DEFAULT_TACTICAL_MODULES)
    expect(validateTacticalModules({})).toEqual(DEFAULT_TACTICAL_MODULES)

    const partial = validateTacticalModules({ paddleRotation: false })
    expect(partial.paddleRotation).toBe(false)
    expect(partial.paddleImpulse).toBe(false)
    expect(partial.aimGuide).toBe(true)
    expect(partial.magnetStart).toBe(true)
  })

  it("сохраняет и загружает изменения", () => {
    const saved = saveTacticalModules({ paddleRotation: false, paddleImpulse: true })
    expect(saved.paddleRotation).toBe(false)
    expect(saved.paddleImpulse).toBe(true)

    const loaded = loadTacticalModules()
    expect(loaded.paddleRotation).toBe(false)
    expect(loaded.paddleImpulse).toBe(true)
    expect(loaded.aimGuide).toBe(true)
  })

  it("патчит только переданные поля, сохраняя остальные", () => {
    saveTacticalModules({ aimGuide: false })
    const second = saveTacticalModules({ magnetStart: false })

    expect(second.aimGuide).toBe(false)
    expect(second.magnetStart).toBe(false)
    expect(second.paddleRotation).toBe(true)
  })
})

describe("tacticalModules Game integration", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
  })

  it("Game инициализирует tacticalModules и позволяет переключать их", async () => {
    localStorage.clear()
    const { makeEnv } = await import("./frameInvariant.helpers")
    const env = makeEnv()
    const { game } = env

    expect(game.tacticalModules.paddleRotation).toBe(true)
    expect(game.tacticalModules.paddleImpulse).toBe(false)

    // Переключение штурвала
    game.toggleTacticalModule("paddleRotation")
    expect(game.tacticalModules.paddleRotation).toBe(false)

    // Проверка isAimGuideActive
    game.upgrades = { aimGuide: 1 }
    expect(game.isAimGuideActive()).toBe(true)

    // Отключение модуля прицела
    game.setTacticalModule("aimGuide", false)
    expect(game.isAimGuideActive()).toBe(false)

    // Включение обратно
    game.setTacticalModule("aimGuide", true)
    expect(game.isAimGuideActive()).toBe(true)

    // Переключение импульса
    game.setTacticalModule("paddleImpulse", true)
    expect(game.tacticalModules.paddleImpulse).toBe(true)

    env.restoreRandom()
  })
})
