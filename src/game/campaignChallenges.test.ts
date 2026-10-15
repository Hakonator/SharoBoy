import { describe, it, expect, vi } from "vitest"

import {
  createCampaignChallenge,
  initActiveChallenge,
  updateActiveChallenge,
  recordChallengeBallLost,
  recordChallengeCrit,
  formatChallengeHud,
} from "./campaignChallenges"

describe("Campaign Challenges (Квестовые узлы-челленджи)", () => {
  it("детерминированно создаёт испытания по сиду узла", () => {
    const ch1 = createCampaignChallenge(12345, 5)
    const ch2 = createCampaignChallenge(12345, 5)

    expect(ch1).toEqual(ch2)
    expect(ch1.rewardCrystals).toBeGreaterThan(0)
    expect(ch1.rewardMeta).toBeGreaterThanOrEqual(1)
    expect(["speed_clear", "flawless", "survive_time", "crit_hunter"]).toContain(ch1.kind)
  })

  it("на поздних ярусах (tier >= 18) награда мета-кристаллами возрастает до 2", () => {
    const chLate = createCampaignChallenge(42, 20)
    expect(chLate.rewardMeta).toBe(2)
  })

  it("updateActiveChallenge для speed_clear отсчитывает время и проваливает при лимите", () => {
    const def = createCampaignChallenge(1, 4)
    const active = initActiveChallenge({
      ...def,
      kind: "speed_clear",
      targetValue: 10,
    })

    const onSurviveWin = vi.fn()
    const onTimeExpired = vi.fn()

    // 5 секунд прошло
    updateActiveChallenge(active, 5, { onSurviveWin, onTimeExpired })
    expect(active.progress).toBe(5)
    expect(active.failed).toBe(false)
    expect(onTimeExpired).not.toHaveBeenCalled()

    // Еще 6 секунд -> суммарно 11 >= 10
    updateActiveChallenge(active, 6, { onSurviveWin, onTimeExpired })
    expect(active.failed).toBe(true)
    expect(onTimeExpired).toHaveBeenCalledTimes(1)
  })

  it("updateActiveChallenge для survive_time засчитывает триумф при истечении времени", () => {
    const def = createCampaignChallenge(1, 4)
    const active = initActiveChallenge({
      ...def,
      kind: "survive_time",
      targetValue: 8,
    })

    const onSurviveWin = vi.fn()
    const onTimeExpired = vi.fn()

    updateActiveChallenge(active, 8.5, { onSurviveWin, onTimeExpired })
    expect(active.completed).toBe(true)
    expect(active.failed).toBe(false)
    expect(onSurviveWin).toHaveBeenCalledTimes(1)
  })

  it("recordChallengeBallLost проваливает flawless и survive_time при потере мяча", () => {
    const flawless = initActiveChallenge({
      kind: "flawless",
      title: "Без потерь",
      description: "Не терять мяч",
      targetValue: 1,
      rewardCrystals: 50,
      rewardMeta: 1,
    })

    const onFail = vi.fn()
    recordChallengeBallLost(flawless, onFail)

    expect(flawless.failed).toBe(true)
    expect(onFail).toHaveBeenCalledTimes(1)
  })

  it("recordChallengeCrit увеличивает счётчик критов и завершает при достижении цели", () => {
    const active = initActiveChallenge({
      kind: "crit_hunter",
      title: "Мастер критов",
      description: "3 крита",
      targetValue: 3,
      rewardCrystals: 50,
      rewardMeta: 1,
    })

    const onWin = vi.fn()
    recordChallengeCrit(active, onWin)
    expect(active.progress).toBe(1)
    expect(active.completed).toBe(false)

    recordChallengeCrit(active, onWin)
    expect(active.progress).toBe(2)
    expect(active.completed).toBe(false)

    recordChallengeCrit(active, onWin)
    expect(active.progress).toBe(3)
    expect(active.completed).toBe(true)
    expect(onWin).toHaveBeenCalledTimes(1)
  })

  it("formatChallengeHud формирует корректный снимок данных для UI", () => {
    const active = initActiveChallenge({
      kind: "speed_clear",
      title: "СПРИНТ",
      description: "За 40 сек",
      targetValue: 40,
      rewardCrystals: 50,
      rewardMeta: 1,
    })
    active.progress = 10

    const hud = formatChallengeHud(active)
    expect(hud.title).toBe("СПРИНТ")
    expect(hud.statusText).toContain("30.0")
    expect(hud.failed).toBe(false)
    expect(hud.rewardCrystals).toBe(50)
  })
})
