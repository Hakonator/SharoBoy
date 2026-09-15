import { afterEach, describe, expect, it, vi } from "vitest"

import { SFX } from "./audio"

/** Минимальный window с localStorage — проверяем сохранение ползунков.
 *  (В тестовом окружении node нет браузерных глобалов и Audio.) */
function stubStorage(store: Record<string, string> = {}): Record<string, string> {
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    },
  })
  return store
}

describe("SFX: раздельные ползунки громкости музыки и звука", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("по умолчанию обе громкости на максимуме", () => {
    stubStorage()
    const s = new SFX()
    expect(s.musicVolume).toBe(1)
    expect(s.sfxVolume).toBe(1)
  })

  it("музыка: значение ограничивается 0..1 и не меняет громкость звуков", () => {
    stubStorage()
    const s = new SFX()
    s.setMusicVolume(1.8)
    expect(s.musicVolume).toBe(1)
    s.setMusicVolume(-0.5)
    expect(s.musicVolume).toBe(0)
    s.setMusicVolume(0.35)
    expect(s.musicVolume).toBeCloseTo(0.35)
    expect(s.sfxVolume).toBe(1)
  })

  it("звуки: значение ограничивается 0..1 и не меняет громкость музыки", () => {
    stubStorage()
    const s = new SFX()
    s.setSfxVolume(2)
    expect(s.sfxVolume).toBe(1)
    s.setSfxVolume(-1)
    expect(s.sfxVolume).toBe(0)
    s.setSfxVolume(0.6)
    expect(s.sfxVolume).toBeCloseTo(0.6)
    expect(s.musicVolume).toBe(1)
  })

  it("громкости сохраняются между сессиями (localStorage)", () => {
    const store = stubStorage()
    const first = new SFX()
    first.setMusicVolume(0.25)
    first.setSfxVolume(0.75)
    expect(store["sharoboy-vol-music"]).toBe("0.25")
    expect(store["sharoboy-vol-sfx"]).toBe("0.75")
    // Новая сессия читает сохранённые значения, а не максимум
    const second = new SFX()
    expect(second.musicVolume).toBeCloseTo(0.25)
    expect(second.sfxVolume).toBeCloseTo(0.75)
  })

  it("мусор в хранилище не ломает громкость — берётся максимум", () => {
    stubStorage({ "sharoboy-vol-music": "abc", "sharoboy-vol-sfx": "NaN" })
    const s = new SFX()
    expect(s.musicVolume).toBe(1)
    expect(s.sfxVolume).toBe(1)
  })

  it("музыку и эффекты можно глушить независимо", () => {
    stubStorage()
    const s = new SFX()
    s.setMusicMuted(true)
    expect(s.musicMuted).toBe(true)
    expect(s.muted).toBe(false)
    s.muted = true
    expect(s.musicMuted).toBe(true)
    // Включение музыки не должно падать там, где нет медиа-окружения
    s.setMusicMuted(false)
    expect(s.musicMuted).toBe(false)
  })
})
