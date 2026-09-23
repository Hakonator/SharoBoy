import { afterEach, describe, expect, it, vi } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"
import type { Game } from "../game"

import { createInput } from "./lifecycle"
import { loseLife } from "./runFlow"

/** Форма события keydown, которое получает обработчик контроллера ввода. */
type KeyEvent = { code: string; preventDefault: () => void }

/**
 * Перехватывает window.addEventListener фейкового окна (makeEnv) и
 * регистрирует контроллер ввода напрямую: так эмулируем нажатия клавиш
 * браузера и проверяем всю цепочку keydown → InputHost → Game.
 */
function captureKeydown(game: Game): (code: string) => void {
  let keydown: ((e: KeyEvent) => void) | null = null
  const win = window as unknown as {
    addEventListener: (type: string, fn: (e: KeyEvent) => void) => void
  }
  win.addEventListener = (type, fn) => {
    if (type === "keydown") keydown = fn
  }
  createInput(game, game.canvas).attach()
  return (code) => {
    if (!keydown) throw new Error("keydown-обработчик не зарегистрирован")
    keydown({ code, preventDefault: () => {} })
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("DEV-отладка: горячие клавиши F1–F4", () => {
  it("нажатия F1–F4 переключают флаги через контроллер ввода", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      const press = captureKeydown(game)
      expect(game.showFps).toBe(false)
      press("F1")
      expect(game.showFps).toBe(true)
      press("F1")
      expect(game.showFps).toBe(false)

      press("F2")
      expect(game.showHitboxes).toBe(true)

      press("F3")
      expect(game.slowMotion).toBe(true)

      press("F4")
      expect(game.invincible).toBe(true)

      // Повторное нажатие выключает режим.
      press("F3")
      expect(game.slowMotion).toBe(false)
    } finally {
      game.destroy()
      restoreRandom()
    }
  })
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
