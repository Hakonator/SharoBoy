import { describe, expect, it } from "vitest"

import { validatePlayerMapSpec } from "./mapValidator"
import type { PlayerMapSpec } from "./mapSpec"

function makeMap(overrides: Partial<PlayerMapSpec> = {}): PlayerMapSpec {
  return {
    version: 1,
    id: "map-1",
    metadata: { title: "Test map" },
    blocks: [
      {
        id: "block-1",
        position: { x: 50, y: 50 },
        shape: "ellipse",
        size: { width: 20, height: 20 },
        hp: 1,
      },
    ],
    winCondition: { kind: "all-destructible" },
    ...overrides,
  }
}

describe("validatePlayerMapSpec", () => {
  it("accepts a valid map, including inclusive numeric limits", () => {
    const map = makeMap({
      blocks: [
        {
          id: "portal-a",
          position: { x: 10, y: 10 },
          shape: "circle",
          size: { width: 20, height: 20 },
          hp: 8,
          effects: [{ kind: "portal", pairId: "pair-1" }],
          links: [{ kind: "portal-pair", targetBlockId: "portal-b" }],
        },
        {
          id: "portal-b",
          position: { x: 1910, y: 870 },
          shape: "circle",
          size: { width: 20, height: 20 },
          hp: 1,
          effects: [{ kind: "portal", pairId: "pair-1" }],
          links: [{ kind: "portal-pair", targetBlockId: "portal-a" }],
        },
      ],
      groups: [{ id: "group-1", blockIds: ["portal-a"] }],
    })
    map.blocks[0].groupId = "group-1"

    expect(validatePlayerMapSpec(map)).toEqual([])
  })

  it("rejects blocks entering the paddle zone below Y=880", () => {
    const block = makeMap().blocks[0]
    const map = makeMap({
      blocks: [{ ...block, position: { x: 100, y: 860 }, size: { width: 40, height: 50 } }],
    })
    expect(validatePlayerMapSpec(map)).toContainEqual(
      expect.objectContaining({
        path: "blocks[0].position",
        code: "OUT_OF_BOUNDS",
        message: expect.stringContaining("зону ракетки"),
      })
    )
  })

  it("reports duplicate block and group IDs with paths", () => {
    const map = makeMap({
      blocks: [makeMap().blocks[0], { ...makeMap().blocks[0], id: "block-1" }],
      groups: [
        { id: "group-1", blockIds: [] },
        { id: "group-1", blockIds: [] },
      ],
    })

    expect(validatePlayerMapSpec(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "blocks[1].id", code: "DUPLICATE_BLOCK_ID" }),
        expect.objectContaining({ path: "groups[1].id", code: "DUPLICATE_GROUP_ID" }),
      ])
    )
  })

  it("reports unknown groups, members, link targets, and win targets", () => {
    const map = makeMap({
      blocks: [
        {
          ...makeMap().blocks[0],
          groupId: "missing-group",
          links: [{ kind: "portal-pair", targetBlockId: "missing-block" }],
        },
      ],
      groups: [{ id: "group-1", blockIds: ["missing-member"] }],
      winCondition: { kind: "targets", targetIds: ["missing-target"] },
    })

    expect(validatePlayerMapSpec(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "blocks[0].groupId", code: "UNKNOWN_GROUP" }),
        expect.objectContaining({
          path: "blocks[0].links[0].targetBlockId",
          code: "UNKNOWN_BLOCK",
        }),
        expect.objectContaining({ path: "groups[0].blockIds[0]", code: "UNKNOWN_BLOCK" }),
        expect.objectContaining({ path: "winCondition.targetIds[0]", code: "UNKNOWN_BLOCK" }),
      ])
    )
  })

  it("requires at least one target block for the targets win condition", () => {
    const empty = makeMap({ winCondition: { kind: "targets", targetIds: [] } })
    expect(validatePlayerMapSpec(empty)).toContainEqual(
      expect.objectContaining({ path: "winCondition.targetIds", code: "NO_TARGETS" })
    )

    const withTarget = makeMap({ winCondition: { kind: "targets", targetIds: ["block-1"] } })
    expect(validatePlayerMapSpec(withTarget)).toEqual([])
  })

  it("rejects inconsistent group membership", () => {
    const map = makeMap({ groups: [{ id: "group-1", blockIds: ["block-1"] }] })

    expect(validatePlayerMapSpec(map)).toContainEqual(
      expect.objectContaining({ path: "groups[0].blockIds[0]", code: "UNKNOWN_GROUP" })
    )
  })

  it("rejects duplicate membership and blocks listed by multiple groups", () => {
    const map = makeMap({
      blocks: [{ ...makeMap().blocks[0], groupId: "group-1" }],
      groups: [
        { id: "group-1", blockIds: ["block-1", "block-1"] },
        { id: "group-2", blockIds: ["block-1"] },
      ],
    })

    expect(validatePlayerMapSpec(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "groups[0].blockIds[1]",
          code: "DUPLICATE_GROUP_MEMBERSHIP",
        }),
        expect.objectContaining({ path: "blocks[0].groupId", code: "DUPLICATE_GROUP_MEMBERSHIP" }),
      ])
    )
  })

  it("requires each portal pair ID to identify exactly two portal blocks", () => {
    const map = makeMap({
      blocks: [{ ...makeMap().blocks[0], effects: [{ kind: "portal", pairId: "pair-1" }] }],
    })

    expect(validatePlayerMapSpec(map)).toContainEqual(
      expect.objectContaining({ path: "blocks[0].effects[0]", code: "INVALID_PORTAL_PAIR" })
    )
  })

  it("checks inclusive field edges against the whole block size", () => {
    const map = makeMap({
      blocks: [
        { ...makeMap().blocks[0], position: { x: 9, y: 50 } },
        { ...makeMap().blocks[0], id: "block-2", position: { x: 1911, y: 50 } },
      ],
    })

    expect(validatePlayerMapSpec(map)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "blocks[0].position", code: "OUT_OF_BOUNDS" }),
        expect.objectContaining({ path: "blocks[1].position", code: "OUT_OF_BOUNDS" }),
      ])
    )
  })

  it("validates agreed HP, geometry, armor and effect ranges", () => {
    const map = makeMap({
      blocks: [
        {
          ...makeMap().blocks[0],
          hp: 9,
          size: { width: 101, height: 19 },
          effects: [
            { kind: "armor", amount: 6 },
            { kind: "pulse", amplitude: 2.1, frequency: 0.05 },
            { kind: "spring", speedMultiplier: 1, duration: 11 },
            { kind: "cotton", speedMultiplier: 1, duration: 0 },
          ],
          motion: { kind: "drift", path: "horizontal", amplitude: 9, frequency: 6 },
        },
      ],
    })

    expect(validatePlayerMapSpec(map).map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "blocks[0].hp",
        "blocks[0].size.width",
        "blocks[0].size.height",
        "blocks[0].effects[0].amount",
        "blocks[0].effects[1].amplitude",
        "blocks[0].effects[1].frequency",
        "blocks[0].effects[2].speedMultiplier",
        "blocks[0].effects[2].duration",
        "blocks[0].effects[3].speedMultiplier",
        "blocks[0].effects[3].duration",
        "blocks[0].motion.amplitude",
        "blocks[0].motion.frequency",
      ])
    )
  })

  it("accepts magnet modes and rejects non-positive or non-finite magnet ranges", () => {
    const valid = makeMap({
      blocks: [
        {
          ...makeMap().blocks[0],
          effects: [{ kind: "magnet", radius: 80, force: -300, mode: "repel" }],
        },
      ],
    })
    const invalid = makeMap({
      blocks: [
        {
          ...makeMap().blocks[0],
          effects: [
            { kind: "magnet", radius: 0, force: Number.NaN },
            { kind: "magnet", radius: Number.POSITIVE_INFINITY },
          ],
        },
      ],
    })

    expect(validatePlayerMapSpec(valid)).toEqual([])
    expect(validatePlayerMapSpec(invalid).map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "blocks[0].effects[0].radius",
        "blocks[0].effects[0].force",
        "blocks[0].effects[1].radius",
      ])
    )
  })

  it("validates brittle and phase effect parameters within acceptable ranges", () => {
    const valid = makeMap({
      blocks: [
        {
          ...makeMap().blocks[0],
          effects: [
            { kind: "brittle", radius: 100, damage: 2 },
            { kind: "phase", period: 3.5, activeFraction: 0.6, offset: 0.5 },
          ],
        },
      ],
    })
    const invalid = makeMap({
      blocks: [
        {
          ...makeMap().blocks[0],
          effects: [
            { kind: "brittle", radius: 5, damage: 10 },
            { kind: "phase", period: 0.1, activeFraction: 1.5, offset: -1 },
          ],
        },
      ],
    })

    expect(validatePlayerMapSpec(valid)).toEqual([])
    expect(validatePlayerMapSpec(invalid).map((error) => error.path)).toEqual(
      expect.arrayContaining([
        "blocks[0].effects[0].radius",
        "blocks[0].effects[0].damage",
        "blocks[0].effects[1].period",
        "blocks[0].effects[1].activeFraction",
        "blocks[0].effects[1].offset",
      ])
    )
  })

  it("reports non-finite values and maps exceeding the block limit", () => {
    const template = makeMap().blocks[0]
    const map = makeMap({
      blocks: Array.from({ length: 201 }, (_, index) => ({
        ...template,
        id: `block-${index}`,
        position: { x: Number.NaN, y: 50 },
      })),
    })

    const errors = validatePlayerMapSpec(map)
    expect(errors).toContainEqual(expect.objectContaining({ path: "blocks", code: "BLOCK_LIMIT" }))
    expect(errors).toContainEqual(
      expect.objectContaining({ path: "blocks[0].position.x", code: "INVALID_NUMBER" })
    )
  })

  it("валидирует формы rect и round_rect и отклоняет неизвестные", () => {
    const validRectMap = makeMap({
      blocks: [
        {
          id: "rect-1",
          position: { x: 100, y: 100 },
          shape: "rect",
          size: { width: 50, height: 30 },
          hp: 2,
        },
        {
          id: "round-1",
          position: { x: 200, y: 100 },
          shape: "round_rect",
          size: { width: 50, height: 30 },
          hp: 3,
        },
      ],
    })
    expect(validatePlayerMapSpec(validRectMap)).toEqual([])

    const invalidShapeMap = makeMap({
      blocks: [
        {
          id: "bad-1",
          position: { x: 100, y: 100 },
          shape: "triangle" as unknown as "rect",
          size: { width: 50, height: 30 },
          hp: 1,
        },
      ],
    })
    expect(validatePlayerMapSpec(invalidShapeMap)).toContainEqual(
      expect.objectContaining({ path: "blocks[0].shape", code: "OUT_OF_RANGE" })
    )
  })
})
