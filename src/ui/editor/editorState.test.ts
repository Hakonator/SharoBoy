import { afterEach, describe, expect, it, vi } from "vitest"

import type { PlayerMapSpec } from "../../game/mapSpec"

import { createEditorState, editorReducer, loadEditorDraft, saveEditorDraft } from "./editorState"

function makeMap(): PlayerMapSpec {
  return {
    version: 1,
    id: "editor-test",
    metadata: { title: "Test map" },
    blocks: [
      {
        id: "a",
        position: { x: 100, y: 100 },
        shape: "ellipse",
        size: { width: 40, height: 30 },
        hp: 1,
      },
      {
        id: "b",
        position: { x: 200, y: 100 },
        shape: "circle",
        size: { width: 30, height: 30 },
        hp: 2,
      },
    ],
    groups: [{ id: "g", blockIds: ["a", "b"] }],
    winCondition: { kind: "targets", targetIds: ["a", "b"] },
  }
}

describe("editorReducer", () => {
  it("adds a unique block at a snapped position and supports undo/redo", () => {
    const initial = createEditorState(makeMap())
    const added = editorReducer(initial, { type: "ADD_BLOCK", position: { x: 121, y: 141 } })
    expect(added.map.blocks).toHaveLength(3)
    expect(added.map.blocks[2].position).toEqual({ x: 128, y: 160 })
    expect(added.map.blocks[2].id).toMatch(/^b-\d+-[a-z0-9]+$/)
    expect(added.isDirty).toBe(true)
    expect(editorReducer(added, { type: "UNDO" }).map).toEqual(initial.map)
    expect(editorReducer(editorReducer(added, { type: "UNDO" }), { type: "REDO" }).map).toEqual(
      added.map
    )
  })

  it("applies the add preset and allows disabling grid snapping", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SET_ADD_PRESET", preset: { hp: 5, shape: "circle" } })
    state = editorReducer(state, { type: "SET_SNAP_TO_GRID", enabled: false })
    state = editorReducer(state, { type: "ADD_BLOCK", position: { x: 121, y: 141 } })
    expect(state.map.blocks[2]).toMatchObject({
      hp: 5,
      shape: "circle",
      position: { x: 121, y: 160 },
    })
  })

  it("updates, moves and deletes blocks while cleaning map references", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "UPDATE_BLOCK", blockId: "a", updates: { hp: 4 } })
    expect(state.map.blocks[0].hp).toBe(4)
    state = editorReducer(state, { type: "MOVE_BLOCK", blockId: "a", delta: { x: 64, y: 32 } })
    expect(state.map.blocks[0].position).toEqual({ x: 160, y: 155 })
    state = editorReducer(state, { type: "SELECT_BLOCK", blockId: "a" })
    state = editorReducer(state, { type: "DELETE_BLOCK" })
    expect(state.map.blocks.map((block) => block.id)).toEqual(["b"])
    expect(state.map.groups).toEqual([{ id: "g", blockIds: ["b"] }])
    expect(state.map.winCondition).toEqual({ kind: "targets", targetIds: ["b"] })
    expect(state.selectedBlockId).toBeNull()
  })

  it("updates metadata and selection/tool/grid settings without map history", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SELECT_BLOCK", blockId: "a" })
    state = editorReducer(state, { type: "SET_TOOL", tool: "delete" })
    state = editorReducer(state, { type: "SET_GRID_SIZE", gridSize: 64 })
    state = editorReducer(state, { type: "UPDATE_METADATA", metadata: { title: "Changed" } })
    expect(state).toMatchObject({ selectedBlockId: "a", activeTool: "delete", gridSize: 64 })
    expect(state.map.metadata.title).toBe("Changed")
    expect(state.history.past).toHaveLength(1)
    expect(editorReducer(state, { type: "SET_GRID_SIZE", gridSize: 0 })).toBe(state)
  })

  it("caps undo history at 30 entries and clears redo after a new edit", () => {
    let state = createEditorState(makeMap())
    for (let hp = 2; hp <= 40; hp += 1) {
      state = editorReducer(state, { type: "UPDATE_BLOCK", blockId: "a", updates: { hp } })
    }
    expect(state.history.past).toHaveLength(30)
    state = editorReducer(state, { type: "UNDO" })
    expect(state.history.future).toHaveLength(1)
    state = editorReducer(state, { type: "UPDATE_BLOCK", blockId: "a", updates: { hp: 3 } })
    expect(state.history.future).toHaveLength(0)
  })

  it("sets and resets map history according to SET_MAP options", () => {
    const changed = editorReducer(createEditorState(makeMap()), {
      type: "UPDATE_METADATA",
      metadata: { title: "Changed" },
    })
    const fresh = editorReducer(changed, { type: "SET_MAP", map: makeMap() })
    expect(fresh.history).toEqual({ past: [], future: [] })
    expect(fresh.isDirty).toBe(false)
    const preserved = editorReducer(changed, {
      type: "SET_MAP",
      map: makeMap(),
      preserveHistory: true,
    })
    expect(preserved.history).toEqual(changed.history)
    expect(preserved.isDirty).toBe(true)
  })

  it("keeps circles square and clamps blocks outside the playable editor area", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, {
      type: "UPDATE_BLOCK",
      blockId: "a",
      updates: { shape: "circle", size: { width: 92, height: 48 }, position: { x: 20, y: 1050 } },
    })
    expect(state.map.blocks[0].size).toEqual({ width: 48, height: 48 })
    expect(state.map.blocks[0].position).toEqual({ x: 24, y: 856 })
    state = editorReducer(state, {
      type: "MOVE_BLOCK",
      blockId: "a",
      position: { x: 2000, y: 1000 },
    })
    expect(state.map.blocks[0].position).toEqual({ x: 1896, y: 856 })
  })

  it("normalizes circle presets when adding blocks", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, {
      type: "SET_ADD_PRESET",
      preset: { shape: "circle", size: { width: 80, height: 40 } },
    })
    state = editorReducer(state, { type: "ADD_BLOCK", position: { x: 300, y: 300 } })
    expect(state.map.blocks[2].size).toEqual({ width: 40, height: 40 })
  })

  it("clamps added blocks below the HUD and above the paddle zone", () => {
    const state = editorReducer(createEditorState(makeMap()), {
      type: "ADD_BLOCK",
      position: { x: -50, y: 1050 },
      block: { size: { width: 80, height: 80 } },
    })
    expect(state.map.blocks[2].position).toEqual({ x: 40, y: 840 })
  })

  it("supports ordered multi-selection and toggle selection", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["b", "missing", "a", "a"] })
    expect(state.selectedBlockIds).toEqual(["b", "a"])
    expect(state.selectedBlockId).toBe("b")
    state = editorReducer(state, { type: "TOGGLE_BLOCK_SELECTION", blockId: "b" })
    expect(state.selectedBlockIds).toEqual(["a"])
    state = editorReducer(state, { type: "TOGGLE_BLOCK_SELECTION", blockId: "b" })
    expect(state.selectedBlockIds).toEqual(["a", "b"])
  })

  it("moves selected blocks together with a common safe-clamped delta", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, {
      type: "MOVE_BLOCKS",
      blockIds: ["a", "b"],
      delta: { x: 64, y: 900 },
    })
    expect(state.map.blocks.map((block) => block.position)).toEqual([
      { x: 164, y: 865 },
      { x: 264, y: 865 },
    ])
  })

  it("copies and pastes selected blocks with unique ids and +32 offset", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["a", "b"] })
    state = editorReducer(state, { type: "COPY_SELECTED" })
    state = editorReducer(state, { type: "PASTE_CLIPBOARD" })
    expect(state.map.blocks).toHaveLength(4)
    expect(state.map.blocks[2].position).toEqual({ x: 128, y: 155 })
    expect(state.map.blocks[3].position).toEqual({ x: 224, y: 155 })
    expect(new Set(state.map.blocks.map((block) => block.id)).size).toBe(4)
    expect(state.selectedBlockIds).toEqual(state.map.blocks.slice(2).map((block) => block.id))
  })

  it("deletes all selected blocks and cleans group and win-condition references", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["a", "b"] })
    state = editorReducer(state, { type: "DELETE_SELECTED_BLOCKS" })
    expect(state.map.blocks).toEqual([])
    expect(state.map.groups).toEqual([])
    expect(state.map.winCondition).toEqual({ kind: "targets", targetIds: [] })
    expect(state.selectedBlockIds).toEqual([])
  })

  it("clones a sequence with unique ids, selection, and undo/redo history", () => {
    const initial = createEditorState(makeMap())
    const cloned = editorReducer(initial, {
      type: "CLONE_SEQUENCE",
      blockId: "a",
      positions: [
        { x: 300, y: 200 },
        { x: 400, y: 200 },
      ],
    })
    expect(cloned.map.blocks).toHaveLength(4)
    expect(cloned.map.blocks.slice(2).map((block) => block.position)).toEqual([
      { x: 288, y: 192 },
      { x: 416, y: 192 },
    ])
    expect(new Set(cloned.map.blocks.map((block) => block.id)).size).toBe(4)
    expect(cloned.selectedBlockIds).toEqual(cloned.map.blocks.slice(2).map((block) => block.id))
    expect(editorReducer(cloned, { type: "UNDO" }).map).toEqual(initial.map)
    expect(editorReducer(editorReducer(cloned, { type: "UNDO" }), { type: "REDO" }).map).toEqual(
      cloned.map
    )
  })

  it("rejects quick-cloning portals and caps clone sequence to 200 blocks", () => {
    let state = createEditorState(makeMap())
    state.map.blocks[0]!.effects = [{ kind: "portal", pairId: "pair" }]
    const rejected = editorReducer(state, {
      type: "CLONE_SEQUENCE",
      blockId: "a",
      positions: [{ x: 300, y: 200 }],
    })
    expect(rejected.map.blocks).toHaveLength(2)

    const fullMap = makeMap()
    fullMap.blocks = Array.from({ length: 199 }, (_, index) => ({
      id: `block-${index}`,
      position: { x: 100 + index, y: 200 },
      shape: "ellipse" as const,
      size: { width: 40, height: 30 },
      hp: 1,
    }))
    state = createEditorState(fullMap)
    const limited = editorReducer(state, {
      type: "CLONE_SEQUENCE",
      blockId: "block-0",
      positions: [
        { x: 300, y: 200 },
        { x: 400, y: 200 },
      ],
    })
    expect(limited.map.blocks).toHaveLength(200)
  })
})

describe("editor draft storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("saves and loads a valid map from localStorage", () => {
    const storage = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
    })
    const map = makeMap()
    expect(saveEditorDraft(map)).toBe(true)
    expect(loadEditorDraft()).toEqual(map)
  })

  it("returns false/null when storage is unavailable or malformed", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(saveEditorDraft(makeMap())).toBe(false)
    expect(loadEditorDraft()).toBeNull()

    const storage = new Map<string, string>([["sharoboy_custom_map_draft", "not json"]])
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null })
    expect(loadEditorDraft()).toBeNull()
  })
})
