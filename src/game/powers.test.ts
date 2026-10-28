import { describe, expect, it } from "vitest"

import { PowersSystem, type PowersWorld } from "./powers"
import { applyPower } from "./powers/apply"

/** Неигровая HUD-зона: спавн блоков — только ниже неё. */
describe("PowersSystem — неигровая HUD-зона сверху", () => {
  function makeWorld(over: Partial<PowersWorld> = {}): PowersWorld {
    return {
      w: 800,
      h: 900,
      blockTop: 300,
      blockSpawnTop: 300,
      time: 0,
      paddle: { x: 400, y: 850, w: 90, h: 14 },
      balls: [],
      blocks: [],
      boss: null,
      blocksInitial: 5,
      mode: "campaign",
      powers: [],
      spawnTimer: 0,
      skyDropTimer: 0,
      fx: { rings: [], popups: [] },
      ...over,
    } as unknown as PowersWorld
  }

  it("периодический спавн не создаёт блоки в HUD-зоне", () => {
    const g = makeWorld()
    new PowersSystem(g).periodicSpawn(0.016)
    expect(g.blocks.length).toBeGreaterThan(0)
    for (const b of g.blocks) {
      expect(b.y - b.ry).toBeGreaterThanOrEqual(g.blockTop)
    }
  })

  it("периодический спавн оставляет landscape HUD свободным", () => {
    const g = makeWorld({ blockTop: 96, blockSpawnTop: 96 })
    new PowersSystem(g).periodicSpawn(0.016)
    expect(g.blocks.length).toBeGreaterThan(0)
    for (const block of g.blocks) {
      expect(block.y - block.ry).toBeGreaterThanOrEqual(96)
    }
  })

  it("бонус магнитной ракетки включает временный захват шара", () => {
    const g = {
      ...makeWorld({ time: 10 }),
      magneticPaddleUntil: 0,
      sfx: { power() {} },
      fx: { popups: [], burst() {} },
      pushHud() {},
    }
    applyPower(g as unknown as Parameters<typeof applyPower>[0], "magneticPaddle")
    expect(g.magneticPaddleUntil).toBe(22)
  })

  it("бонус клинка взводит проникающий шар на 10 секунд", () => {
    const g = {
      ...makeWorld({ time: 10 }),
      pierceUntil: 0,
      sfx: { power() {} },
      fx: { popups: [], burst() {} },
      pushHud() {},
    }
    applyPower(g as unknown as Parameters<typeof applyPower>[0], "pierce")
    expect(g.pierceUntil).toBe(20)
  })

  it("бонус плазменного заряда взводит взрывной шар на 8 секунд", () => {
    const g = {
      ...makeWorld({ time: 10 }),
      explosiveUntil: 0,
      sfx: { power() {} },
      fx: { popups: [], burst() {} },
      pushHud() {},
    }
    applyPower(g as unknown as Parameters<typeof applyPower>[0], "explosive")
    expect(g.explosiveUntil).toBe(18)
  })
})
