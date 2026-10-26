import { describe, expect, it, vi } from "vitest"

import { makeEnv } from "./campaignFlow.helpers"
import type { Game } from "./game"
import { advanceClassicLevel, onLevelCleared, showIntermediateScore } from "./game/runFlow"

describe("Промежуточный подсчёт очков после уровня (IntermediateScore)", () => {
  it("showIntermediateScore формирует полные данные для отображения в HUD", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.score = 3500
    game.levelScoreStart = 2000
    game.runBlocksDestroyed = 25
    game.levelBlocksStart = 10
    game.lives = 3
    game.shield = 1
    game.runMaxCombo = 5
    game.levelLostBall = false

    const continueFn = vi.fn()
    showIntermediateScore(game, continueFn, {
      title: "СЕКТОР ЗАЧИЩЕН",
      subtitle: "Боевой сектор",
      crystals: 20,
    })

    expect(game.intermediateScore).toBeTruthy()
    expect(game.intermediateScore?.title).toBe("СЕКТОР ЗАЧИЩЕН")
    expect(game.intermediateScore?.subtitle).toBe("Боевой сектор")
    expect(game.intermediateScore?.levelScore).toBe(1500)
    expect(game.intermediateScore?.previousScore).toBe(2000)
    expect(game.intermediateScore?.totalScore).toBe(3500)
    expect(game.intermediateScore?.levelBlocks).toBe(15)
    expect(game.intermediateScore?.totalBlocks).toBe(25)
    expect(game.intermediateScore?.isCleanClear).toBe(true)
    expect(game.intermediateScore?.crystalsEarned).toBe(20)

    // Выход по кнопке "продолжить"
    game.continueFromIntermediateScore()
    expect(game.intermediateScore).toBeNull()
    expect(continueFn).toHaveBeenCalledTimes(1)
  })

  it("в режиме прямых уровней зачистка уровня показывает окно и продолжает на следующий уровень", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.mode = "campaign"
    game.campaign = null
    game.level = 1
    game.score = 800
    game.levelScoreStart = 0
    game.levelLostBall = false
    game.phase = "playing"

    onLevelCleared(game)

    // Проверяем появление промежуточного окна
    expect(game.intermediateScore).toBeTruthy()
    expect(game.intermediateScore?.title).toBe("УРОВЕНЬ 1 ЗАВЕРШЁН")
    expect(game.intermediateScore?.totalScore).toBe(1300) // 800 + 500 за чистую игру

    // До нажатия "Продолжить" уровень остаётся 1
    expect(game.level).toBe(1)

    // Нажатие "Продолжить" переводит на следующий уровень
    game.continueFromIntermediateScore()
    expect(game.intermediateScore).toBeNull()
    expect(game.level).toBe(2)
    expect(game.balls.length).toBeGreaterThan(0)
    expect(game.balls[0].stuck).toBe(true)
  })

  it("advanceClassicLevel корректно собирает следующий уровень", () => {
    const { g } = makeEnv()
    const game = g as unknown as Game
    game.mode = "campaign"
    game.campaign = null
    game.level = 2

    advanceClassicLevel(game)
    expect(game.level).toBe(3)
    expect(game.blocks.length).toBeGreaterThan(0)
    expect(game.balls.length).toBe(1)
    expect(game.balls[0].stuck).toBe(true)
  })
})
