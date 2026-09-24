import { describe, expect, it } from "vitest"

import { PowersSystem, type PowersWorld } from "./powers"
import type { Block } from "./types"

/** Неигровая HUD-зона: спавн блоков и дрейф поля — только ниже неё. */
describe("PowersSystem — неигровая HUD-зона сверху", () => {
  function makeWorld(over: Partial<PowersWorld> = {}): PowersWorld {
    return {
      w: 800,
      h: 900,
      blockTop: 300,
      time: 0,
      paddle: { x: 400, y: 850, w: 90, h: 14 },
      balls: [],
      blocks: [],
      boss: null,
      blocksInitial: 5,
      mode: "campaign",
      powers: [],
      fieldShift: null,
      spawnTimer: 0,
      skyDropTimer: 0,
      shiftTimer: 0,
      fx: { rings: [], popups: [] },
      ...over,
    } as unknown as PowersWorld
  }

  function blockAt(x: number, y: number): Block {
    return {
      x,
      y,
      rx: 30,
      ry: 20,
      rot: 0,
      circle: false,
      hp: 1,
      maxHp: 1,
      tier: 1,
      flash: 0,
      seed: 1,
      dead: false,
      x0: x,
      swayAmp: 0,
      swayFreq: 0,
      swayPh: 0,
      bomb: false,
      splits: false,
    }
  }

  it("периодический спавн не создаёт блоки в HUD-зоне", () => {
    const g = makeWorld()
    new PowersSystem(g).periodicSpawn(0.016)
    expect(g.blocks.length).toBeGreaterThan(0)
    for (const b of g.blocks) {
      expect(b.y - b.ry).toBeGreaterThanOrEqual(g.blockTop)
    }
  })

  it("дрейф поля не выталкивает блоки в HUD-зону", () => {
    const g = makeWorld()
    g.blocks.push(blockAt(400, 250)) // minY = 230 < blockTop 300
    new PowersSystem(g).tryFieldShift(0.016)
    // случайный dy всегда в пределах ±24, поэтому зажимается до blockTop − minY
    expect(g.fieldShift).not.toBeNull()
    expect(g.fieldShift!.dy).toBeCloseTo((g.blockTop - 230) * 2.2)
  })
})
