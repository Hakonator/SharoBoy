import { beforeEach, describe, expect, it, vi } from "vitest"

import { ACCOUNT_STORAGE_KEYS, clearAccountStorage } from "./account"

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

describe("clearAccountStorage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
  })

  it("удаляет все ключи аккаунта из localStorage, сохраняя посторонние настройки", () => {
    for (const key of ACCOUNT_STORAGE_KEYS) {
      localStorage.setItem(key, "data")
    }
    localStorage.setItem("sharoboy-game-settings", "keep-me")
    localStorage.setItem("other-key", "keep-too")

    clearAccountStorage()

    for (const key of ACCOUNT_STORAGE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull()
    }
    expect(localStorage.getItem("sharoboy-game-settings")).toBe("keep-me")
    expect(localStorage.getItem("other-key")).toBe("keep-too")
  })
})
