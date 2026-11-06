import { describe, expect, it } from "vitest"

import { makeEnv } from "./campaignFlow.helpers"
import type { Game } from "./game"
import { BOSS_RUSH_SEQUENCE } from "./game/levelBuild"
import { onLevelCleared } from "./game/runFlow"

describe("Режим «Босс-раш» (Boss Rush)", () => {
  it("последовательность содержит 8 уникальных боссов", () => {
    expect(BOSS_RUSH_SEQUENCE).toHaveLength(8)
    const unique = new Set(BOSS_RUSH_SEQUENCE)
    expect(unique.size).toBe(8)
    expect(BOSS_RUSH_SEQUENCE[0]).toBe("king")
    expect(BOSS_RUSH_SEQUENCE[7]).toBe("kraken")
  })

  it("startBossRush инициализирует режим, 4 жизни и спавнит первого босса (Царь-шар)", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game

    game.startBossRush()

    expect(game.mode).toBe("boss_rush")
    expect(game.bossRushIndex).toBe(0)
    expect(game.level).toBe(1)
    expect(game.lives).toBe(4)
    expect(game.phase).toBe("playing")
    expect(game.activeBossKind).toBe("king")
    expect(game.bossSys.boss).not.toBeNull()
    expect(game.banner).toContain("БОСС-РАШ [1/8]")

    g.destroy()
  })

  it("последовательно строит этапы для каждого из 8 боссов", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game

    game.startBossRush()

    for (let i = 0; i < BOSS_RUSH_SEQUENCE.length; i++) {
      expect(game.bossRushIndex).toBe(i)
      expect(game.activeBossKind).toBe(BOSS_RUSH_SEQUENCE[i])
      expect(game.bossSys.boss).not.toBeNull()

      if (i + 1 < BOSS_RUSH_SEQUENCE.length) {
        // Убиваем босса и вызываем зачистку
        game.bossSys.clear()
        onLevelCleared(game)
        expect(game.intermediateScore).not.toBeNull()
        expect(game.intermediateScore?.title).toContain(`БОСС ${i + 1}/8 ПОВЕРЖЕН`)

        // Нажимаем продолжить — переход к следующему боссу
        game.continueFromIntermediateScore()
      }
    }

    g.destroy()
  })

  it("победа над 8-м боссом (Кракен) завершает забег победой, даёт кристаллы и сохраняет рекорд", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game

    game.startBossRush()
    game.bossRushIndex = 7
    game.level = 8
    game.score = 12000
    const initialMeta = game.metaCrystals

    game.bossSys.clear()
    onLevelCleared(game)

    expect(game.phase).toBe("won")
    expect(game.metaCrystals).toBe(initialMeta + 250)
    expect(game.topBossRush.length).toBeGreaterThan(0)
    expect(game.topBossRush[0].score).toBeGreaterThan(12000)

    g.destroy()
  })
})
