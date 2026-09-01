import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ACHIEVEMENTS, evaluateAch, loadUnlocked, type AchContext } from "./achievements"

/** Мок localStorage (в node-окружении vitest его нет). */
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

/** Базовый контекст партии — ничего не открыто. */
const baseCtx: AchContext = {
  score: 0,
  combo: 0,
  wave: 0,
  won: false,
  bossKills: 0,
  livesLost: 0,
  coins: 0,
  upgradeLevels: 0,
  upgradesMaxed: false,
}

const ids = (defs: { id: string }[]) => defs.map((d) => d.id).sort()

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ACHIEVEMENTS — справочник", () => {
  it("содержит 12 достижений с уникальными id", () => {
    expect(ACHIEVEMENTS).toHaveLength(12)
    const set = new Set(ACHIEVEMENTS.map((d) => d.id))
    expect(set.size).toBe(12)
  })

  it("у каждого достижения заполнены name и desc", () => {
    for (const d of ACHIEVEMENTS) {
      expect(d.name.length, d.id).toBeGreaterThan(0)
      expect(d.desc.length, d.id).toBeGreaterThan(0)
      expect(d.icon.length, d.id).toBeGreaterThan(0)
    }
  })
})

describe("evaluateAch — условия разблокировки", () => {
  it("на пустом контексте ничего не открывает", () => {
    expect(evaluateAch(baseCtx)).toEqual([])
  })

  it("победа с потерянной жизнью открывает только first-win", () => {
    expect(ids(evaluateAch({ ...baseCtx, won: true, livesLost: 1 }))).toEqual(["first-win"])
  })

  it("победа без потери жизней открывает first-win и flawless", () => {
    expect(ids(evaluateAch({ ...baseCtx, won: true, livesLost: 0 }))).toEqual([
      "first-win",
      "flawless",
    ])
  })

  it("флосс не открывается без победы", () => {
    expect(evaluateAch({ ...baseCtx, won: false, livesLost: 0 })).not.toContainEqual(
      expect.objectContaining({ id: "flawless" })
    )
  })

  it("босс открывается по bossKills", () => {
    expect(ids(evaluateAch({ ...baseCtx, bossKills: 1 }))).toEqual(["boss-slayer"])
    expect(evaluateAch({ ...baseCtx, bossKills: 5 })).toEqual([]) // уже открыт
  })

  it("пороги очков: 1k, затем 5k (накопление)", () => {
    expect(ids(evaluateAch({ ...baseCtx, score: 999 }))).toEqual([])
    expect(ids(evaluateAch({ ...baseCtx, score: 1000 }))).toEqual(["score-1k"])
    // score-1k уже открыт на прошлом шаге — свежим будет только score-5k
    expect(ids(evaluateAch({ ...baseCtx, score: 5000 }))).toEqual(["score-5k"])
  })

  it("пороги серий: 10, затем 15 (накопление)", () => {
    expect(ids(evaluateAch({ ...baseCtx, combo: 10 }))).toEqual(["combo-10"])
    expect(ids(evaluateAch({ ...baseCtx, combo: 15 }))).toEqual(["combo-15"])
  })

  it("пороги волн: 5, затем 10 (накопление)", () => {
    expect(ids(evaluateAch({ ...baseCtx, wave: 5 }))).toEqual(["wave-5"])
    expect(ids(evaluateAch({ ...baseCtx, wave: 10 }))).toEqual(["wave-10"])
  })

  it("монеты и улучшения", () => {
    expect(ids(evaluateAch({ ...baseCtx, coins: 100 }))).toEqual(["coins-100"])
    expect(ids(evaluateAch({ ...baseCtx, upgradeLevels: 1 }))).toEqual(["upgrade-1"])
    expect(ids(evaluateAch({ ...baseCtx, upgradesMaxed: true }))).toEqual(["upgrade-all"])
  })

  it("повторный вызов не выдаёт уже открытые достижения", () => {
    const first = evaluateAch({ ...baseCtx, won: true, livesLost: 1 })
    expect(first).toHaveLength(1)
    const second = evaluateAch({ ...baseCtx, won: true, livesLost: 1 })
    expect(second).toEqual([])
  })
})

describe("loadUnlocked — чтение из localStorage", () => {
  it("возвращает {} при пустом хранилище", () => {
    expect(loadUnlocked()).toEqual({})
  })

  it("возвращает сохранённые разблокировки", () => {
    ;(localStorage as Storage).setItem(
      "sharoboy-achievements",
      JSON.stringify({ "first-win": 1700000000000 })
    )
    expect(loadUnlocked()).toEqual({ "first-win": 1700000000000 })
  })

  it("отбрасывает записи с нечисловой меткой времени", () => {
    ;(localStorage as Storage).setItem(
      "sharoboy-achievements",
      JSON.stringify({ "first-win": 1700000000000, "score-1k": "мусор", "combo-10": null })
    )
    expect(loadUnlocked()).toEqual({ "first-win": 1700000000000 })
  })

  it("возвращает {} на битый JSON", () => {
    ;(localStorage as Storage).setItem("sharoboy-achievements", "{не-json")
    expect(loadUnlocked()).toEqual({})
  })

  it("evaluateAch сохраняет новые разблокировки в localStorage", () => {
    evaluateAch({ ...baseCtx, won: true })
    const saved = JSON.parse(
      (localStorage as Storage).getItem("sharoboy-achievements") ?? "{}"
    ) as Record<string, unknown>
    expect(typeof saved["first-win"]).toBe("number")
  })
})
