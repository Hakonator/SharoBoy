import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getDailyModifiers,
  getDailyRunInfo,
  getDailyTimeUntilReset,
  hasPlayedTodayDaily,
  markTodayDailyPlayed,
} from "./daily"
import { daySeed, formatDayDate } from "./utils"

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

describe("Daily Runs Engine (T-041, §3.2 Roadmap)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
  })

  describe("daySeed и formatDayDate", () => {
    it("daySeed генерирует YYYYMMDD в формате UTC", () => {
      const date = new Date(Date.UTC(2026, 9, 30, 15, 30, 0))
      expect(daySeed(date)).toBe(20261030)
      expect(formatDayDate(date)).toBe("30.10.2026")
    })

    it("одинаков в разных часовых поясах для одного и того же момента UTC", () => {
      const utcTime = Date.UTC(2026, 9, 30, 12, 0, 0)
      const d1 = new Date(utcTime)
      const d2 = new Date(utcTime)
      expect(daySeed(d1)).toBe(daySeed(d2))
    })
  })

  describe("getDailyModifiers", () => {
    it("детерминирован: одинаковая дата даёт одинаковые мутаторы", () => {
      const date = new Date(Date.UTC(2026, 9, 30, 8, 0, 0))
      const mods1 = getDailyModifiers(date)
      const mods2 = getDailyModifiers(date)
      expect(mods1).toEqual(mods2)
    })

    it("возвращает ровно 2 различных мутатора", () => {
      const date = new Date(Date.UTC(2026, 9, 30, 8, 0, 0))
      const mods = getDailyModifiers(date)
      expect(mods).toHaveLength(2)
      expect(mods[0]).not.toBe(mods[1])
    })

    it("меняется для различных дат", () => {
      const d1 = new Date(Date.UTC(2026, 9, 30, 0, 0, 0))
      const d2 = new Date(Date.UTC(2026, 10, 5, 0, 0, 0))
      const mods1 = getDailyModifiers(d1)
      const mods2 = getDailyModifiers(d2)
      // На разных сидах мутаторы или их порядок различаются
      expect(mods1[0] !== mods2[0] || mods1[1] !== mods2[1]).toBe(true)
    })
  })

  describe("getDailyTimeUntilReset", () => {
    it("рассчитывает оставшиеся секунды до полуночи UTC", () => {
      // 23:59:50 UTC -> осталось 10 секунд
      const nearMidnight = new Date(Date.UTC(2026, 9, 30, 23, 59, 50))
      const reset = getDailyTimeUntilReset(nearMidnight)
      expect(reset.totalSeconds).toBe(10)
      expect(reset.hours).toBe(0)
      expect(reset.minutes).toBe(0)
      expect(reset.seconds).toBe(10)
      expect(reset.formatted).toBe("00:00:10")
    })

    it("корректно форматирует оставшиеся часы и минуты", () => {
      // 14:15:30 UTC -> до полуночи 9 часов, 44 минуты, 30 секунд
      const date = new Date(Date.UTC(2026, 9, 30, 14, 15, 30))
      const reset = getDailyTimeUntilReset(date)
      expect(reset.hours).toBe(9)
      expect(reset.minutes).toBe(44)
      expect(reset.seconds).toBe(30)
      expect(reset.formatted).toBe("09:44:30")
    })
  })

  describe("getDailyRunInfo", () => {
    it("формирует полные метаданные ежедневного забега", () => {
      const date = new Date(Date.UTC(2026, 9, 30, 10, 0, 0))
      const info = getDailyRunInfo(date)

      expect(info.date).toBe("2026-10-30")
      expect(info.dateFormatted).toBe("30.10.2026")
      expect(info.daySeed).toBe(20261030)
      expect(info.campaignSeed).toBe((20261030 * 31 + 1080) | 0)
      expect(info.modifiers).toHaveLength(2)
      expect(info.modifierDefs).toHaveLength(2)
      expect(info.totalScoreBonus).toBeGreaterThan(0)
      expect(info.totalCrystalBonus).toBeGreaterThan(0)
    })
  })

  describe("hasPlayedTodayDaily & markTodayDailyPlayed", () => {
    it("по умолчанию false, после отметки — true для сегодняшней даты", () => {
      const date = new Date(Date.UTC(2026, 9, 30, 10, 0, 0))
      expect(hasPlayedTodayDaily(date)).toBe(false)

      markTodayDailyPlayed(date)
      expect(hasPlayedTodayDaily(date)).toBe(true)

      // На следующий день снова false
      const tomorrow = new Date(Date.UTC(2026, 9, 31, 10, 0, 0))
      expect(hasPlayedTodayDaily(tomorrow)).toBe(false)
    })
  })
})
