import { describe, expect, it } from "vitest"

import type { Game } from "../game"
import type { Block, BossState } from "../types"

import { realignOnOrientationChange } from "./rotateLayout"

/** Портретный фейковый Game: 390×844, scale 1 → blockTop = 140. */
function makeGame(over: Partial<Game> = {}): Game {
  return {
    w: 800,
    h: 1000,
    cssW: 390,
    cssH: 844,
    scale: 1,
    phase: "playing",
    blocks: [],
    bossSys: { boss: null },
    ...over,
  } as unknown as Game
}

function makeBlock(over: Partial<Block> = {}): Block {
  return {
    x: 200,
    y: 150,
    rx: 30,
    ry: 16,
    rot: 0,
    circle: false,
    hp: 2,
    maxHp: 2,
    tier: 1,
    flash: 0,
    seed: 0.5,
    dead: false,
    x0: 200,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
    ...over,
  }
}

describe("realignOnOrientationChange — пересчёт при перевороте", () => {
  it("ландшафт → портрет: блоки над зоной опускаются единым сдвигом", () => {
    const g = makeGame({
      blocks: [makeBlock({ y: 40, y0: 40 }), makeBlock({ y: 120, y0: 120 })],
    })
    realignOnOrientationChange(g, false)
    // dy = blockTop 140 + ry 16 − самый высокий y 40 = 116
    expect(g.blocks[0].y).toBe(156)
    expect(g.blocks[1].y).toBe(236)
    expect(g.blocks[0].y0).toBe(156) // база боба сдвинута так же
    expect(g.blocks[1].y0).toBe(236)
  })

  it("блоки уже ниже зоны — сдвига нет", () => {
    const g = makeGame({ blocks: [makeBlock({ y: 400, y0: 400 })] })
    realignOnOrientationChange(g, false)
    expect(g.blocks[0].y).toBe(400)
  })

  it("орбитальные/бомбовые блоки не сдвигаются — их ведёт босс", () => {
    const g = makeGame({
      blocks: [
        makeBlock({ y: 40, minionOrbit: { ang: 0, dir: 1, speed: 1, rad: 100 } }),
        makeBlock({ y: 40, bomb: true }),
      ],
      bossSys: {
        boss: { baseY: 120, r: 30 } as unknown as BossState,
      } as unknown as Game["bossSys"],
    })
    realignOnOrientationChange(g, false)
    // dy считает только босс: 140 + 30 − 120 = 50
    expect((g.bossSys.boss as BossState).baseY).toBe(170)
    expect(g.blocks[0].y).toBe(40)
    expect(g.blocks[1].y).toBe(40)
  })

  it("портрет → ландшафт: зона исчезла, ничего не двигаем", () => {
    const b = makeBlock({ y: 40, y0: 40 })
    const g = makeGame({
      w: 1000,
      h: 600,
      cssW: 1920,
      cssH: 1080,
      blocks: [b],
    })
    realignOnOrientationChange(g, true)
    expect(b.y).toBe(40)
  })

  it("вне уровня (меню/итоги) расстановка не трогается", () => {
    const b = makeBlock({ y: 40, y0: 40 })
    const g = makeGame({ blocks: [b], phase: "menu" })
    realignOnOrientationChange(g, false)
    expect(b.y).toBe(40)
  })

  it("та же ориентация (обычный ресайз) — без сдвига", () => {
    const b = makeBlock({ y: 40, y0: 40 })
    const g = makeGame({ blocks: [b] })
    realignOnOrientationChange(g, true)
    expect(b.y).toBe(40)
  })
})
