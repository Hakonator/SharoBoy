import { describe, expect, it } from "vitest"

import { mapSpecToBlocks } from "./mapAdapter"
import type { PlayerBlockSpec, PlayerMapSpec } from "./mapSpec"

function makeBlock(overrides: Partial<PlayerBlockSpec> = {}): PlayerBlockSpec {
  return {
    id: "block-1",
    position: { x: 320, y: 240 },
    shape: "ellipse",
    size: { width: 80, height: 40 },
    hp: 2,
    ...overrides,
  }
}

function makeMap(blocks: PlayerBlockSpec[]): PlayerMapSpec {
  return {
    version: 1,
    id: "map-1",
    metadata: { title: "Test map" },
    blocks,
    winCondition: { kind: "all-destructible" },
  }
}

describe("mapSpecToBlocks", () => {
  it("maps geometry, health and runtime defaults", () => {
    const [block] = mapSpecToBlocks(
      makeMap([makeBlock({ shape: "circle", rotation: Math.PI / 4, hp: 8 })])
    )

    expect(block).toMatchObject({
      x: 320,
      y: 240,
      rx: 40,
      ry: 20,
      rot: Math.PI / 4,
      circle: true,
      hp: 8,
      maxHp: 8,
      tier: 3,
      flash: 0,
      dead: false,
      x0: 320,
      swayAmp: 0,
      swayFreq: 0,
      swayPh: 0,
      bomb: false,
      splits: false,
    })
    expect(block.seed).toBeGreaterThanOrEqual(0)
    expect(block.seed).toBeLessThan(1)
  })

  it("maps armor, pulse, spring, cotton and spin into Block.sp", () => {
    const [block] = mapSpecToBlocks(
      makeMap([
        makeBlock({
          effects: [
            { kind: "armor", amount: 3 },
            { kind: "pulse", amplitude: 1.5, frequency: 2, phase: 0.25 },
            { kind: "spring", speedMultiplier: 2, duration: 3 },
            { kind: "cotton", speedMultiplier: 0.5, duration: 4 },
            { kind: "spin", direction: "counterclockwise" },
          ],
        }),
      ])
    )

    expect(block.sp).toEqual({
      armor: 3,
      armorMax: 3,
      pulse: { freq: 2, ph: 0.25, rx0: 40, ry0: 20 },
      spring: true,
      cotton: true,
      rotVel: 0,
      rotDir: -1,
    })
  })

  it("intentionally ignores dynamic pulse, spring and cotton values per AD-003", () => {
    const baseline = makeMap([
      makeBlock({
        effects: [
          { kind: "pulse", amplitude: 0.1, frequency: 2, phase: 0.25 },
          { kind: "spring", speedMultiplier: 1.1, duration: 1 },
          { kind: "cotton", speedMultiplier: 0.1, duration: 1 },
        ],
      }),
    ])
    const customized = makeMap([
      makeBlock({
        effects: [
          { kind: "pulse", amplitude: 2, frequency: 2, phase: 0.25 },
          { kind: "spring", speedMultiplier: 3, duration: 10 },
          { kind: "cotton", speedMultiplier: 0.9, duration: 10 },
        ],
      }),
    ])

    expect(mapSpecToBlocks(customized)[0].sp).toEqual(mapSpecToBlocks(baseline)[0].sp)
  })

  it("maps drift routes and initializes vertical base position", () => {
    const blocks = mapSpecToBlocks(
      makeMap([
        makeBlock({
          id: "horizontal",
          motion: { kind: "drift", path: "horizontal", amplitude: 50, frequency: 1.5 },
        }),
        makeBlock({
          id: "vertical",
          motion: { kind: "drift", path: "vertical", amplitude: 30, frequency: 0.5, phase: 1 },
        }),
        makeBlock({
          id: "circle",
          motion: { kind: "drift", path: "circle", radius: 25, frequency: 0.75 },
        }),
      ])
    )

    expect(blocks[0].sp?.drift).toEqual({ kind: "h", amp: 50, freq: 1.5, ph: 0 })
    expect(blocks[0].y0).toBeUndefined()
    expect(blocks[1].sp?.drift).toEqual({ kind: "v", amp: 30, freq: 0.5, ph: 1 })
    expect(blocks[1].y0).toBe(240)
    expect(blocks[2].sp?.drift).toEqual({ kind: "circle", amp: 25, freq: 0.75, ph: 0 })
    expect(blocks[2].y0).toBe(240)
  })

  it("assigns the same runtime portal ID to each member of a pair", () => {
    const blocks = mapSpecToBlocks(
      makeMap([
        makeBlock({ id: "portal-a", effects: [{ kind: "portal", pairId: "pair-alpha" }] }),
        makeBlock({ id: "portal-b", effects: [{ kind: "portal", pairId: "pair-alpha" }] }),
        makeBlock({ id: "portal-c", effects: [{ kind: "portal", pairId: "pair-beta" }] }),
      ])
    )

    expect(blocks[0].sp?.portalId).toBe(blocks[1].sp?.portalId)
    expect(blocks[2].sp?.portalId).not.toBe(blocks[0].sp?.portalId)
    expect(
      mapSpecToBlocks(
        makeMap([
          makeBlock({ id: "portal-a", effects: [{ kind: "portal", pairId: "pair-alpha" }] }),
          makeBlock({ id: "portal-b", effects: [{ kind: "portal", pairId: "pair-alpha" }] }),
        ])
      )[0].sp?.portalId
    ).toBe(blocks[0].sp?.portalId)
  })

  it("is deterministic and returns fresh runtime objects", () => {
    const map = makeMap([makeBlock({ effects: [{ kind: "spin" }] })])
    const first = mapSpecToBlocks(map)
    const second = mapSpecToBlocks(map)

    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second[0]).not.toBe(first[0])
  })
})
