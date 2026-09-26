import { afterEach, describe, expect, it, vi } from "vitest"

import { SFX } from "./audio"
import { MAP_BASS, MAP_LEAD } from "./audio/tracks/map"

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

  it("у карты кампании свой трек — без MP3-кроссфейдов", () => {
    stubStorage()
    const s = new SFX()
    s.setTrack("map")
    const internals = s as unknown as { track: string; fileMode: boolean }
    expect(internals.track).toBe("map")
    // На карте играет тихий встроенный секвенсор, MP3-набор не тратится
    expect(internals.fileMode).toBe(false)
    // Обычные фазы по-прежнему используют MP3, если файлы есть
    s.setTrack("game")
    expect(internals.track).toBe("game")
  })

  it("останавливает таймер секвенсора при переключении в файловый трек", () => {
    stubStorage()
    const clearTimeout = vi.fn()
    vi.stubGlobal("window", {
      addEventListener: () => {},
      removeEventListener: () => {},
      clearTimeout,
      localStorage: { getItem: () => null, setItem: () => {} },
    })
    const s = new SFX() as unknown as {
      setTrack: (track: "game" | "map") => void
      musicOn: boolean
      musicTimer: number | null
      fileMode: boolean
    }
    s.musicOn = true
    s.musicTimer = 123
    s.setTrack("game")
    expect(s.fileMode).toBe(true)
    expect(s.musicTimer).toBeNull()
    expect(clearTimeout).toHaveBeenCalledWith(123)
  })

  it("тема карты — медленная, разреженная и в пределах MIDI", () => {
    const sfx = SFX as unknown as {
      stepFor: (t: "menu" | "game" | "map") => number
    }
    // темп карты — самый медленный из трёх
    expect(sfx.stepFor("map")).toBeGreaterThan(sfx.stepFor("menu"))
    expect(sfx.stepFor("menu")).toBeGreaterThan(sfx.stepFor("game"))
    const lead = MAP_LEAD
    const bass = MAP_BASS
    expect(lead.length).toBe(bass.length)
    // все значения — валидный MIDI (0 = пауза)
    for (const n of [...lead, ...bass]) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(100)
    }
    // ненавязчивость: пауз больше, чем нот, минимум двое к одному
    const notes = lead.filter((n) => n > 0).length
    expect(notes).toBeGreaterThan(0)
    expect(lead.length - notes).toBeGreaterThan(notes * 2)
  })
})
