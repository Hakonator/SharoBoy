import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  _clearSettingsCache,
  loadSettings,
  particleLimitForQuality,
  resetSettings,
  saveSettings,
  subscribeSettings,
} from "./settings"

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

describe("game/settings", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
    _clearSettingsCache()
    resetSettings()
  })

  it("loads default settings when storage is empty", () => {
    const settings = loadSettings()
    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(settings.graphicsQuality).toBe("high")
    expect(settings.screenShake).toBe(1)
    expect(settings.screenFlash).toBe(1)
    expect(settings.stereoPanning).toBe(true)
    expect(settings.comboPitch).toBe(true)
    expect(settings.underwaterFilter).toBe(true)
  })

  it("saves and updates settings with validation", () => {
    saveSettings({
      graphicsQuality: "ultra",
      screenShake: 0.5,
      screenFlash: 0,
      stereoPanning: false,
    })

    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)
    expect(stored.graphicsQuality).toBe("ultra")
    expect(stored.screenShake).toBe(0.5)
    expect(stored.screenFlash).toBe(0)
    expect(stored.stereoPanning).toBe(false)
    expect(stored.comboPitch).toBe(true) // retained default

    const loaded = loadSettings()
    expect(loaded.graphicsQuality).toBe("ultra")
    expect(loaded.screenShake).toBe(0.5)
    expect(loaded.screenFlash).toBe(0)
  })

  it("ignores invalid values and falls back to defaults", () => {
    // @ts-expect-error test invalid value
    saveSettings({ graphicsQuality: "super-extreme", screenShake: 99 })
    const loaded = loadSettings()
    expect(loaded.graphicsQuality).toBe("high")
    expect(loaded.screenShake).toBe(1)
  })

  it("notifies subscribers when settings change", () => {
    let notified = false
    let lastQuality = ""
    const unsub = subscribeSettings((s) => {
      notified = true
      lastQuality = s.graphicsQuality
    })

    saveSettings({ graphicsQuality: "eco" })
    expect(notified).toBe(true)
    expect(lastQuality).toBe("eco")

    notified = false
    unsub()
    saveSettings({ graphicsQuality: "ultra" })
    expect(notified).toBe(false)
  })

  it("maps graphics quality to appropriate particle limits", () => {
    expect(particleLimitForQuality("ultra")).toBe(650)
    expect(particleLimitForQuality("high")).toBe(400)
    expect(particleLimitForQuality("eco")).toBe(150)
  })

  it("resets settings back to defaults", () => {
    saveSettings({ graphicsQuality: "eco", screenShake: 0 })
    expect(loadSettings().graphicsQuality).toBe("eco")

    resetSettings()
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
