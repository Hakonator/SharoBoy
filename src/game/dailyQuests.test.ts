import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DAILY_QUEST_COUNT,
  DAILY_QUEST_KINDS,
  claimDailyQuestReward,
  getDailyQuestDefs,
  getDailyQuests,
  pendingQuestReward,
  recordQuestProgress,
  type DailyQuestKind,
  type DailyQuestStats,
} from "./dailyQuests"

/** Минимальный localStorage-шим: модуль ходит через `lsGet`/`lsSet`. */
function installStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  })
  return data
}

const DAY_A = new Date(Date.UTC(2026, 10, 4, 12, 0, 0)) // 04.11.2026
const DAY_A_LATE = new Date(Date.UTC(2026, 10, 4, 23, 59, 59))
const DAY_B = new Date(Date.UTC(2026, 10, 5, 0, 0, 1)) // 05.11.2026

describe("dailyQuests (T-059)", () => {
  beforeEach(() => {
    installStorage()
  })

  describe("детерминизм набора дня", () => {
    it("набор из трёх заданий и он одинаков в течение суток UTC", () => {
      const early = getDailyQuestDefs(DAY_A)
      const late = getDailyQuestDefs(DAY_A_LATE)
      expect(early).toHaveLength(DAILY_QUEST_COUNT)
      expect(late).toEqual(early)
    })

    it("набор одинаков для всех игроков — случайности вне сида нет", () => {
      const a = getDailyQuestDefs(DAY_A)
      const b = getDailyQuestDefs(new Date(Date.UTC(2026, 10, 4, 3, 14, 15)))
      expect(b).toEqual(a)
    })

    it("задания дня уникальны — одно не выпадает дважды", () => {
      for (let d = 1; d <= 28; d++) {
        const defs = getDailyQuestDefs(new Date(Date.UTC(2026, 10, d, 12)))
        const kinds = defs.map((q) => q.kind)
        expect(new Set(kinds).size).toBe(kinds.length)
        expect(defs).toHaveLength(DAILY_QUEST_COUNT)
      }
    })

    it("разные дни (и граница суток UTC) дают разные наборы", () => {
      const signatures = new Set<string>()
      for (let d = 1; d <= 28; d++) {
        signatures.add(
          getDailyQuestDefs(new Date(Date.UTC(2026, 10, d, 12)))
            .map((q) => `${q.kind}:${q.target}`)
            .join("|")
        )
      }
      expect(signatures.size).toBeGreaterThan(1)
      expect(JSON.stringify(getDailyQuestDefs(DAY_A_LATE))).not.toBe(
        JSON.stringify(getDailyQuestDefs(DAY_B))
      )
    })

    it("цель и награда в допустимых пределах", () => {
      for (let d = 1; d <= 28; d++) {
        for (const q of getDailyQuestDefs(new Date(Date.UTC(2026, 10, d, 12)))) {
          expect(q.target).toBeGreaterThan(0)
          expect(Number.isInteger(q.target)).toBe(true)
          expect(q.rewardMeta).toBeGreaterThanOrEqual(1)
          expect(q.rewardMeta).toBeLessThanOrEqual(3)
          expect(DAILY_QUEST_KINDS).toContain(q.kind)
        }
      }
    })
  })
})

describe("dailyQuests — прогресс", () => {
  beforeEach(() => {
    installStorage()
  })

  it("накапливается и обрезается по цели", () => {
    const defs = getDailyQuestDefs(DAY_A)
    for (const d of defs) recordQuestProgress(bump(d.kind, d.target * 5), DAY_A)
    for (const q of getDailyQuests(DAY_A)) {
      expect(q.progress).toBe(q.def.target)
    }
  })

  it("не сбрасывается между «сессиями» — читается из хранилища", () => {
    const first = getDailyQuestDefs(DAY_A)[0]!
    recordQuestProgress(bump(first.kind, 5), DAY_A)
    const again = getDailyQuests(DAY_A).find((q) => q.def.kind === first.kind)!
    expect(again.progress).toBe(5)
  })

  it("события других видов не трогают прогресс чужих заданий", () => {
    const defs = getDailyQuestDefs(DAY_A)
    const target = defs[0]!
    const other = DAILY_QUEST_KINDS.find((k) => !defs.some((d) => d.kind === k))
    if (!other) return // в дне не нашлось свободного вида
    recordQuestProgress(bump(other, 10), DAY_A)
    const state = getDailyQuests(DAY_A).find((q) => q.def.kind === target.kind)!
    expect(state.progress).toBe(0)
  })

  it("отрицательные и нечисловые значения игнорируются", () => {
    const first = getDailyQuestDefs(DAY_A)[0]!
    recordQuestProgress({ [statKey(first.kind)]: -5 } as DailyQuestStats, DAY_A)
    recordQuestProgress({ [statKey(first.kind)]: Number.NaN } as DailyQuestStats, DAY_A)
    const state = getDailyQuests(DAY_A).find((q) => q.def.kind === first.kind)!
    expect(state.progress).toBe(0)
  })

  it("прогресс вчерашнего дня не переносится на сегодня", () => {
    const yesterday = getDailyQuestDefs(DAY_A)[0]!
    recordQuestProgress(bump(yesterday.kind, yesterday.target), DAY_A)
    const today = getDailyQuests(DAY_B)
    expect(today.every((q) => q.progress === 0)).toBe(true)
  })

  it("битые данные в хранилище не роняют модуль", () => {
    installStorage({ "sharoboy-daily-quests": "{не json" })
    expect(() => getDailyQuests(DAY_A)).not.toThrow()
    expect(getDailyQuests(DAY_A)).toHaveLength(DAILY_QUEST_COUNT)
    installStorage({
      "sharoboy-daily-quests": JSON.stringify({ date: 42, progress: [], claimed: "x" }),
    })
    expect(getDailyQuests(DAY_A).every((q) => q.progress === 0)).toBe(true)
  })
})

describe("dailyQuests — награда", () => {
  beforeEach(() => {
    installStorage()
  })

  it("выдаётся ровно один раз за дату", () => {
    const defs = getDailyQuestDefs(DAY_A)
    for (const d of defs) recordQuestProgress(bump(d.kind, d.target), DAY_A)
    const expected = defs.reduce((a, d) => a + d.rewardMeta, 0)

    expect(claimDailyQuestReward(DAY_A)).toEqual({ reward: expected, ok: true })
    // повторные нажатия кнопки — ничего
    expect(claimDailyQuestReward(DAY_A)).toEqual({ reward: 0, ok: false })
    expect(claimDailyQuestReward(DAY_A)).toEqual({ reward: 0, ok: false })
  })

  it("не выдаёт награду за невыполненное задание", () => {
    const first = getDailyQuestDefs(DAY_A)[0]!
    recordQuestProgress(bump(first.kind, first.target - 1), DAY_A)
    expect(claimDailyQuestReward(DAY_A)).toEqual({ reward: 0, ok: false })
    expect(getDailyQuests(DAY_A).every((q) => !q.claimed)).toBe(true)
  })

  it("частично выполненный набор платит только за готовые задания", () => {
    const defs = getDailyQuestDefs(DAY_A)
    recordQuestProgress(bump(defs[0]!.kind, defs[0]!.target), DAY_A)
    expect(claimDailyQuestReward(DAY_A).reward).toBe(defs[0]!.rewardMeta)
    const state = getDailyQuests(DAY_A)
    expect(state.filter((q) => q.claimed)).toHaveLength(1)
    expect(pendingQuestReward(DAY_A)).toBe(0)
  })

  it("награда нового дня не блокируется выдачей вчера", () => {
    for (const d of getDailyQuestDefs(DAY_A)) recordQuestProgress(bump(d.kind, d.target), DAY_A)
    expect(claimDailyQuestReward(DAY_A).ok).toBe(true)
    for (const d of getDailyQuestDefs(DAY_B)) recordQuestProgress(bump(d.kind, d.target), DAY_B)
    expect(claimDailyQuestReward(DAY_B).ok).toBe(true)
  })

  it("pendingQuestReward считает только неполученное", () => {
    const defs = getDailyQuestDefs(DAY_A)
    expect(pendingQuestReward(DAY_A)).toBe(0)
    recordQuestProgress(bump(defs[0]!.kind, defs[0]!.target), DAY_A)
    recordQuestProgress(bump(defs[1]!.kind, defs[1]!.target), DAY_A)
    expect(pendingQuestReward(DAY_A)).toBe(defs[0]!.rewardMeta + defs[1]!.rewardMeta)
    claimDailyQuestReward(DAY_A)
    expect(pendingQuestReward(DAY_A)).toBe(0)
  })
})

/** Поле статистики, соответствующее виду задания. */
function statKey(kind: DailyQuestKind): keyof DailyQuestStats {
  switch (kind) {
    case "break_blocks":
      return "blocksDestroyed"
    case "crit_saves":
      return "clutchSaves"
    case "chain_cascades":
      return "chainDetonations"
    case "boss_kills":
      return "bossKills"
    case "power_ups":
      return "powerUps"
  }
}

/** Статистика с одним ненулевым полем — по виду задания. */
function bump(kind: DailyQuestKind, n: number): DailyQuestStats {
  return { [statKey(kind)]: n }
}
