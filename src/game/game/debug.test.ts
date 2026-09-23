import { afterEach, describe, expect, it, vi } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"

import { loseLife } from "./runFlow"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DEV-отладка (F2–F4)", () => {
  it("toggle-функции переключают флаги и возвращают новое состояние", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      expect(game.showHitboxes).toBe(false)
      expect(game.toggleHitboxes()).toBe(true)
      expect(game.showHitboxes).toBe(true)

      expect(game.toggleSlowMotion()).toBe(true)
      expect(game.slowMotion).toBe(true)

      expect(game.toggleInvincible()).toBe(true)
      expect(game.invincible).toBe(true)

      // Повторное переключение выключает режим.
      expect(game.toggleSlowMotion()).toBe(false)
      expect(game.slowMotion).toBe(false)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("бессмертие: потеря шара не списывает жизнь и подаёт новый шар", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      game.startLevelBattle(1)
      game.invincible = true
      game.balls = []
      const lives = game.lives

      loseLife(game)

      expect(game.lives).toBe(lives)
      expect(game.balls.length).toBeGreaterThan(0)
      expect(game.phase).toBe("playing")
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("без бессмертия жизнь списывается (контрольный)", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      game.startLevelBattle(1)
      game.balls = []
      const lives = game.lives

      loseLife(game)

      expect(game.lives).toBe(lives - 1)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })

  it("замедление: игровой цикл шагает временем в 4 раза медленнее", () => {
    const { game, step, restoreRandom } = makeEnv()
    try {
      const before = game.time
      step(1)
      const normal = game.time - before

      game.slowMotion = true
      const before2 = game.time
      step(1)
      const slowed = game.time - before2

      expect(slowed).toBeCloseTo(normal * 0.25, 5)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })
})
