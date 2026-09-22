import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  makeEnv,
  paintedBall,
  paintedPaddle,
  translated,
  type GameInternals,
  type PaintEvent,
} from "./frameInvariant.helpers"

describe("инвариант альфы при отрисовке (мигание шара/ракетки)", () => {
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function expectCleanFrame(
    paints: PaintEvent[],
    g: GameInternals,
    shake: [number, number],
    label: string
  ): boolean {
    expect(errSpy.mock.calls, `${label}: цикл не должен падать`).toHaveLength(0)
    const bad = translated(paints, shake).filter((p) => p.alpha !== 1)
    expect(
      bad,
      `${label}: отрисовки шара/ракетки с протёкшей альфой: ${JSON.stringify(bad.slice(0, 3))}`
    ).toHaveLength(0)
    /* Главный инвариант — если в этом кадре шар рисуется, то с полной альфой.
       Возвращаем, был ли шар реально отрисован в кадре: на граничных позициях
       (например, почти у верхнего края) событие может отсутствовать в записи,
       и требовать его в КАЖДОМ кадре означает ложно-негативные провалы. */
    expect(
      paintedPaddle(paints, g.paddle, shake),
      `${label}: ракетка должна быть нарисована с полной альфой`
    ).toBe(true)
    return g.balls.some((b) => paintedBall(paints, b, shake))
  }

  it("после разбивания блока шар и ракетка не мигают (кольцо, искры, попап, бонус)", () => {
    const { g, step, paints, shake, restoreRandom } = makeEnv()
    g.startLevelBattle(1)
    step(80) // баннер старта угасает (2.2 с → порог фриза 1.1 с)
    g.launch()
    step(3)

    const block = g.blocks[0]
    expect(block).toBeTruthy()
    g.physics.damageBlock(block, 999)
    // Гарантированный бонус в полёте (столб света рисуется первые 0.5 с жизни)
    g.powers.push({ x: g.w / 2, y: 160, vy: 150, type: "wide", t: 0 })

    let everDrawn = false
    for (let i = 0; i < 30; i++) {
      step()
      everDrawn = expectCleanFrame(paints, g, shake(), `кадр ${i} после разбивания`) || everDrawn
    }
    expect(everDrawn, "шар хотя бы раз должен быть нарисован за сценарий").toBe(true)
    g.destroy()
    restoreRandom()
  })

  it("после ловли бонуса шар и ракетка не мигают (всплеск, попап, HUD)", () => {
    const { g, step, paints, shake, restoreRandom } = makeEnv()
    g.startLevelBattle(1)
    step(80)
    g.launch()
    step(3)

    let everDrawn = false
    for (const type of ["wide", "coin", "laser", "multi", "fire", "magnet"] as const) {
      // Бонус прямо над ракеткой — updatePowers подберёт его в ближайшем кадре
      g.powers.push({ x: g.paddle.x, y: g.paddle.y - 13, vy: 150, type, t: 3 })
      step(2) // кадр подбора + кадр применения
      for (let i = 0; i < 20; i++) {
        step()
        everDrawn = expectCleanFrame(paints, g, shake(), `бонус ${type}, кадр ${i}`) || everDrawn
      }
    }
    expect(everDrawn, "шар хотя бы раз должен быть нарисован за сценарий").toBe(true)
    g.destroy()
    restoreRandom()
  })
})
