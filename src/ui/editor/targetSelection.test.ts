import { describe, expect, it } from "vitest"

import type { PlayerMapSpec } from "../../game/mapSpec"

import {
  getTargetsCondition,
  orderTargetIds,
  replaceTargetIds,
  toggleTargetId,
  toggleTargetIds,
} from "./targetSelection"

function makeMap(): PlayerMapSpec {
  return {
    version: 1,
    id: "targets-test",
    metadata: { title: "Targets" },
    blocks: [
      {
        id: "a",
        position: { x: 100, y: 200 },
        shape: "ellipse",
        size: { width: 40, height: 30 },
        hp: 1,
      },
      {
        id: "b",
        position: { x: 300, y: 200 },
        shape: "circle",
        size: { width: 30, height: 30 },
        hp: 2,
      },
      {
        id: "c",
        position: { x: 500, y: 200 },
        shape: "rect",
        size: { width: 60, height: 40 },
        hp: 3,
      },
    ],
    winCondition: { kind: "targets", targetIds: [] },
  }
}

describe("targetSelection", () => {
  it("narrows the win condition to the targets mode", () => {
    expect(getTargetsCondition({ kind: "all-destructible" })).toBeNull()
    expect(getTargetsCondition({ kind: "targets", targetIds: ["a"] })).toEqual({
      kind: "targets",
      targetIds: ["a"],
    })
  })

  it("orders target ids by map blocks and drops unknown ones", () => {
    expect(orderTargetIds(makeMap(), ["c", "a", "ghost", "a"])).toEqual(["a", "c"])
  })

  it("toggles a single target on and off", () => {
    expect(toggleTargetId([], "a")).toEqual(["a"])
    expect(toggleTargetId(["a"], "a")).toEqual([])
    expect(toggleTargetId(["a", "b"], "c")).toEqual(["a", "b", "c"])
  })

  it("marks the whole group when at least one block is not a target yet", () => {
    expect(toggleTargetIds(["a"], ["a", "b"])).toEqual(["a", "b"])
    expect(toggleTargetIds([], ["a", "b", "c"])).toEqual(["a", "b", "c"])
  })

  it("clears the whole group when every block is already a target", () => {
    expect(toggleTargetIds(["a", "b", "c"], ["a", "b"])).toEqual(["c"])
    expect(toggleTargetIds(["a"], ["a"])).toEqual([])
  })

  it("keeps other targets untouched and ignores empty selections", () => {
    expect(toggleTargetIds(["a", "c"], ["b"])).toEqual(["a", "c", "b"])
    expect(toggleTargetIds(["a"], [])).toEqual(["a"])
  })

  it("replaces the target list without duplicates", () => {
    expect(replaceTargetIds(["a", "b", "a"])).toEqual(["a", "b"])
    expect(replaceTargetIds([])).toEqual([])
  })
})
