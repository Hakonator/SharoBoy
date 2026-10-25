import { describe, expect, it } from "vitest"

import type { Game } from "./game"
import {
  BONUS_PER_CLUTCH,
  BONUS_PER_CRIT,
  BONUS_PER_FAST_CLEAR,
  BONUS_PER_LIFE,
  BONUS_PER_MAX_COMBO,
  BONUS_PER_SHIELD,
  applyFinalScoreBreakdown,
  computeScoreBreakdown,
  resetRunStats,
} from "./scoreBreakdown"

function makeMockGame(overrides: Partial<Game> = {}): Game {
  return {
    score: 1000,
    best: 5000,
    lives: 3,
    shield: 2,
    runBlocksDestroyed: 42,
    runBlocksScore: 1000,
    runBossKills: 1,
    runBossesScore: 2500,
    runMaxCombo: 7,
    runCritHits: 4,
    runClutchSaves: 2,
    runSectorsCleared: 5,
    runFastClears: 3,
    campaignModifiers: [],
    scoreBreakdown: null,
    newRecord: false,
    mode: "campaign",
    ...overrides,
  } as unknown as Game
}

describe("computeScoreBreakdown", () => {
  it("рассчитывает базовые очки и все категории бонусов без мутаторов", () => {
    const g = makeMockGame()
    const breakdown = computeScoreBreakdown(g)

    expect(breakdown.baseScore).toBe(1000)
    expect(breakdown.blocksDestroyed).toBe(42)
    expect(breakdown.blocksScore).toBe(1000)
    expect(breakdown.bossesDefeated).toBe(1)
    expect(breakdown.bossesScore).toBe(2500)

    expect(breakdown.livesRemaining).toBe(3)
    expect(breakdown.livesBonus).toBe(3 * BONUS_PER_LIFE)

    expect(breakdown.shieldsRemaining).toBe(2)
    expect(breakdown.shieldsBonus).toBe(2 * BONUS_PER_SHIELD)

    expect(breakdown.maxCombo).toBe(7)
    expect(breakdown.comboBonus).toBe(7 * BONUS_PER_MAX_COMBO)

    expect(breakdown.critHits).toBe(4)
    expect(breakdown.critBonus).toBe(4 * BONUS_PER_CRIT)

    expect(breakdown.clutchSaves).toBe(2)
    expect(breakdown.clutchBonus).toBe(2 * BONUS_PER_CLUTCH)

    expect(breakdown.fastClears).toBe(3)
    expect(breakdown.speedBonus).toBe(3 * BONUS_PER_FAST_CLEAR)

    const expectedBonus =
      3 * BONUS_PER_LIFE +
      2 * BONUS_PER_SHIELD +
      7 * BONUS_PER_MAX_COMBO +
      4 * BONUS_PER_CRIT +
      2 * BONUS_PER_CLUTCH +
      3 * BONUS_PER_FAST_CLEAR

    expect(breakdown.endBonusTotal).toBe(expectedBonus)
    expect(breakdown.finalScore).toBe(g.score + expectedBonus)
    expect(breakdown.mutatorBonusPercent).toBe(0)
    expect(breakdown.mutatorsMultiplier).toBe(1)

    // Проверяем наличие всех категорий в items
    const ids = breakdown.items.map((it) => it.id)
    expect(ids).toContain("blocks")
    expect(ids).toContain("bosses")
    expect(ids).toContain("lives")
    expect(ids).toContain("shields")
    expect(ids).toContain("combo")
    expect(ids).toContain("crits")
    expect(ids).toContain("clutch")
    expect(ids).toContain("speed")
  })

  it("масштабирует бонусы при активных мутаторах кампании", () => {
    const g = makeMockGame({
      // ironman (+50%), dense_armor (+40%) => +90% bonus, multiplier 1.9
      campaignModifiers: ["ironman", "dense_armor"],
    })
    const breakdown = computeScoreBreakdown(g)

    expect(breakdown.mutatorsMultiplier).toBe(1.9)
    expect(breakdown.mutatorBonusPercent).toBe(90)

    const rawBonus =
      3 * BONUS_PER_LIFE +
      2 * BONUS_PER_SHIELD +
      7 * BONUS_PER_MAX_COMBO +
      4 * BONUS_PER_CRIT +
      2 * BONUS_PER_CLUTCH +
      3 * BONUS_PER_FAST_CLEAR

    expect(breakdown.endBonusTotal).toBe(Math.round(rawBonus * 1.9))
    expect(breakdown.finalScore).toBe(g.score + Math.round(rawBonus * 1.9))

    const mutatorItem = breakdown.items.find((it) => it.id === "mutators")
    expect(mutatorItem).toBeDefined()
    expect(mutatorItem?.isMultiplier).toBe(true)
    expect(mutatorItem?.detail).toContain("+90%")
  })

  it("не начисляет бонус за комбо меньше 3 и пустые значения", () => {
    const g = makeMockGame({
      runBlocksDestroyed: 0,
      runBlocksScore: 0,
      runBossKills: 0,
      runBossesScore: 0,
      lives: 0,
      shield: 0,
      runMaxCombo: 2,
      runCritHits: 0,
      runClutchSaves: 0,
      runFastClears: 0,
    })
    const breakdown = computeScoreBreakdown(g)

    expect(breakdown.comboBonus).toBe(0)
    expect(breakdown.endBonusTotal).toBe(0)
    expect(breakdown.finalScore).toBe(g.score)
    expect(breakdown.items).toHaveLength(0)
  })
})

describe("applyFinalScoreBreakdown", () => {
  it("применяет бонус к счёту игры и фиксирует рекорд", () => {
    const g = makeMockGame({
      score: 4000,
      best: 5000,
    })
    const breakdown = applyFinalScoreBreakdown(g)

    expect(g.scoreBreakdown).toBe(breakdown)
    expect(g.score).toBe(breakdown.finalScore)
    expect(g.score).toBeGreaterThan(5000)
    expect(g.best).toBe(g.score)
    expect(g.newRecord).toBe(true)
  })

  it("идемпотентен и не удваивает очки при повторном вызове", () => {
    const g = makeMockGame({ score: 1000 })
    const b1 = applyFinalScoreBreakdown(g)
    const scoreAfterFirst = g.score

    const b2 = applyFinalScoreBreakdown(g)
    expect(b2).toBe(b1)
    expect(g.score).toBe(scoreAfterFirst)
  })
})

describe("resetRunStats", () => {
  it("сбрасывает все метрики забега в исходное состояние", () => {
    const g = makeMockGame({
      scoreBreakdown: {} as unknown as Game["scoreBreakdown"],
    })
    resetRunStats(g)

    expect(g.runBlocksDestroyed).toBe(0)
    expect(g.runBlocksScore).toBe(0)
    expect(g.runBossKills).toBe(0)
    expect(g.runBossesScore).toBe(0)
    expect(g.runMaxCombo).toBe(0)
    expect(g.runCritHits).toBe(0)
    expect(g.runClutchSaves).toBe(0)
    expect(g.runSectorsCleared).toBe(0)
    expect(g.runFastClears).toBe(0)
    expect(g.runSectorStartTime).toBe(0)
    expect(g.scoreBreakdown).toBeNull()
  })
})
