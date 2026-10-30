import { afterEach, describe, expect, it, vi } from "vitest"

import type { PlayerMapSpec } from "../../game/mapSpec"

import { createEditorState, editorReducer, loadEditorDraft, saveEditorDraft } from "./editorState"
import { getResizeCursor } from "./EditorCanvas"
import { blockCorners } from "./geometry"

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

  it("rounds geometry, rotation and numeric effect parameters", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, {
      type: "UPDATE_BLOCK",
      blockId: "a",
      updates: {
        position: { x: 101.8, y: 202.2 },
        size: { width: 41.7, height: 30.4 },
        hp: 2.6,
        rotation: (12.8 * Math.PI) / 180,
        effects: [
          { kind: "armor", amount: 2.7 },
          { kind: "pulse", amplitude: 0.56, frequency: 1.24 },
          { kind: "magnet", radius: 120.8, force: -400.7 },
          { kind: "brittle", radius: 89.6, damage: 1.9 },
          { kind: "phase", period: 3.24, activeFraction: 0.618, offset: 0.49 },
        ],
      },
    })
    const block = state.map.blocks[0]!
    expect(block.position).toEqual({ x: 102, y: 202 })
    expect(block.size).toEqual({ width: 42, height: 30 })
    expect(block.hp).toBe(3)
    expect(block.rotation).toBeCloseTo((15 * Math.PI) / 180)
    expect(block.effects).toEqual([
      { kind: "armor", amount: 3 },
      { kind: "pulse", amplitude: 0.6, frequency: 1.2 },
      { kind: "magnet", radius: 121, force: -401 },
      { kind: "brittle", radius: 90, damage: 2 },
      { kind: "phase", period: 3.2, activeFraction: 0.62, offset: 0.5 },
    ])
  })

  it("normalizes floating-point rotation values to the nearest five degrees", () => {
    const state = editorReducer(createEditorState(makeMap()), {
      type: "UPDATE_BLOCK",
      blockId: "a",
      updates: { rotation: (59.999999999 * Math.PI) / 180 },
    })

    expect(state.map.blocks[0]!.rotation).toBeCloseTo((60 * Math.PI) / 180)
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
    for (let i = 2; i <= 40; i += 1) {
      state = editorReducer(state, {
        type: "UPDATE_BLOCK",
        blockId: i % 2 === 0 ? "a" : "b",
        updates: { hp: (i % 8) + 1 },
      })
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

  it("rotates selected blocks around a specified center point and supports undo/redo", () => {
    const state = createEditorState(makeMap())
    // Set initial positions well inside playing field
    state.map.blocks[0]!.position = { x: 250, y: 300 }
    state.map.blocks[1]!.position = { x: 350, y: 300 }
    state.map.blocks[0]!.rotation = 0
    state.map.blocks[1]!.rotation = 0

    // Center is (300, 300), rotate +90 degrees (Math.PI / 2)
    const center = { x: 300, y: 300 }
    const rotated = editorReducer(state, {
      type: "ROTATE_GROUP",
      blockIds: ["a", "b"],
      center,
      angle: Math.PI / 2,
    })

    // After 90 deg clockwise rotation around (300, 300):
    // a (250, 300): dx = -50, dy = 0 -> nx = 300, ny = 250
    // b (350, 300): dx = 50, dy = 0  -> nx = 300, ny = 350
    const blockA = rotated.map.blocks.find((b) => b.id === "a")!
    const blockB = rotated.map.blocks.find((b) => b.id === "b")!

    expect(blockA.position).toEqual({ x: 300, y: 250 })
    expect(blockB.position).toEqual({ x: 300, y: 350 })
    expect(blockA.rotation).toBeCloseTo(Math.PI / 2)
    expect(blockB.rotation).toBeCloseTo(Math.PI / 2)

    // Undo restores original positions and rotations
    const undone = editorReducer(rotated, { type: "UNDO" })
    expect(undone.map.blocks[0]!.position).toEqual({ x: 250, y: 300 })
    expect(undone.map.blocks[1]!.position).toEqual({ x: 350, y: 300 })
    expect(undone.map.blocks[0]!.rotation).toBe(0)
    expect(undone.map.blocks[1]!.rotation).toBe(0)

    // Redo re-applies rotation
    const redone = editorReducer(undone, { type: "REDO" })
    expect(redone.map.blocks[0]!.position).toEqual({ x: 300, y: 250 })
    expect(redone.map.blocks[1]!.position).toEqual({ x: 300, y: 350 })

    // No-op on near-zero angle or empty block list
    const noop1 = editorReducer(state, {
      type: "ROTATE_GROUP",
      blockIds: ["a", "b"],
      center,
      angle: 0.0001,
    })
    expect(noop1).toBe(state)

    const noop2 = editorReducer(state, {
      type: "ROTATE_GROUP",
      blockIds: [],
      center,
      angle: Math.PI / 2,
    })
    expect(noop2).toBe(state)
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

  it("supports interactive paste phantom (START_PASTE, CANCEL_PASTE, COMMIT_PASTE) with portal remapping and undo/redo", () => {
    let state = createEditorState(makeMap())
    // Добавим портал для проверки ремаппинга связей при вставке
    state.map.blocks[0]!.effects = [{ kind: "portal", pairId: "portal-original" }]
    state.map.blocks[1]!.effects = [{ kind: "portal", pairId: "portal-original" }]
    state.map.blocks[0]!.links = [{ kind: "portal-pair", targetBlockId: "b" }]
    state.map.blocks[1]!.links = [{ kind: "portal-pair", targetBlockId: "a" }]

    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["a", "b"] })
    state = editorReducer(state, { type: "COPY_SELECTED" })
    expect(state.clipboard).toHaveLength(2)

    // Запуск фантома вставки
    state = editorReducer(state, { type: "START_PASTE" })
    expect(state.pastePhantom).toHaveLength(2)

    // Отмена фантома
    state = editorReducer(state, { type: "CANCEL_PASTE" })
    expect(state.pastePhantom).toBeNull()

    // Повторный запуск и закрепление в позиции (COMMIT_PASTE)
    state = editorReducer(state, { type: "START_PASTE" })
    const targetBlocks = state.pastePhantom!.map((block) => ({
      ...block,
      position: { x: block.position.x + 300, y: block.position.y + 200 },
    }))

    state = editorReducer(state, { type: "COMMIT_PASTE", blocks: targetBlocks })
    expect(state.pastePhantom).toBeNull()
    expect(state.map.blocks).toHaveLength(4)

    const pastedA = state.map.blocks[2]!
    const pastedB = state.map.blocks[3]!
    expect(pastedA.id).not.toBe("a")
    expect(pastedB.id).not.toBe("b")
    expect(state.selectedBlockIds).toEqual([pastedA.id, pastedB.id])

    // Порталы в скопированной группе получили новый уникальный pairId и ссылаются друг на друга
    const portalA = pastedA.effects?.find((e) => e.kind === "portal")
    const portalB = pastedB.effects?.find((e) => e.kind === "portal")
    expect(portalA?.pairId).toBeDefined()
    expect(portalA?.pairId).not.toBe("portal-original")
    expect(portalA?.pairId).toBe(portalB?.pairId)
    expect(pastedA.links?.[0]?.targetBlockId).toBe(pastedB.id)
    expect(pastedB.links?.[0]?.targetBlockId).toBe(pastedA.id)

    // Отмена (UNDO) полностью удаляет вставленные блоки
    const undone = editorReducer(state, { type: "UNDO" })
    expect(undone.map.blocks).toHaveLength(2)
    expect(undone.map.blocks.map((b) => b.id)).toEqual(["a", "b"])

    // Повтор (REDO) восстанавливает вставку
    const redone = editorReducer(undone, { type: "REDO" })
    expect(redone.map.blocks).toHaveLength(4)
  })

  it("supports moving a group of blocks with undo and redo", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["a", "b"] })
    state = editorReducer(state, {
      type: "MOVE_BLOCKS",
      blockIds: ["a", "b"],
      delta: { x: 50, y: 50 },
    })
    expect(state.map.blocks[0]!.position).toEqual({ x: 150, y: 155 })
    expect(state.map.blocks[1]!.position).toEqual({ x: 250, y: 155 })

    // Отмена возвращает всю группу обратно
    const undone = editorReducer(state, { type: "UNDO" })
    expect(undone.map.blocks[0]!.position).toEqual({ x: 100, y: 100 })
    expect(undone.map.blocks[1]!.position).toEqual({ x: 200, y: 100 })

    // Повтор возвращает смещение
    const redone = editorReducer(undone, { type: "REDO" })
    expect(redone.map.blocks[0]!.position).toEqual({ x: 150, y: 155 })
    expect(redone.map.blocks[1]!.position).toEqual({ x: 250, y: 155 })
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

  it("mass updates properties of selected blocks with validation and circle constraint", () => {
    let state = createEditorState(makeMap())
    // Make first block rect, second circle
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a", "b"],
      updates: { hp: 7, size: { width: 60, height: 40 } },
    })
    expect(state.map.blocks[0]!.hp).toBe(7)
    expect(state.map.blocks[1]!.hp).toBe(7)
    // Block "a" is ellipse -> 60x40
    expect(state.map.blocks[0]!.size).toEqual({ width: 60, height: 40 })
    // Block "b" is circle -> constraint: width === height -> 40x40 (min side)
    expect(state.map.blocks[1]!.size).toEqual({ width: 40, height: 40 })

    // Change shape to rect on all selected
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a", "b"],
      updates: { shape: "rect", size: { width: 80, height: 50 } },
    })
    expect(state.map.blocks[0]!.shape).toBe("rect")
    expect(state.map.blocks[1]!.shape).toBe("rect")
    expect(state.map.blocks[0]!.size).toEqual({ width: 80, height: 50 })
    expect(state.map.blocks[1]!.size).toEqual({ width: 80, height: 50 })

    // HP is clamped to [1, 8]
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a"],
      updates: { hp: 12 },
    })
    expect(state.map.blocks[0]!.hp).toBe(8)
  })

  it("handles mass effect toggling with mutual exclusion between spring and cotton", () => {
    let state = createEditorState(makeMap())
    // Enable spring on both blocks
    state = editorReducer(state, {
      type: "SET_BLOCKS_EFFECT",
      blockIds: ["a", "b"],
      kind: "spring",
      enabled: true,
    })
    expect(state.map.blocks[0]!.effects?.some((e) => e.kind === "spring")).toBe(true)
    expect(state.map.blocks[1]!.effects?.some((e) => e.kind === "spring")).toBe(true)

    // Now enable cotton -> spring MUST be automatically removed (mutual exclusion)
    state = editorReducer(state, {
      type: "SET_BLOCKS_EFFECT",
      blockIds: ["a", "b"],
      kind: "cotton",
      enabled: true,
    })
    expect(state.map.blocks[0]!.effects?.some((e) => e.kind === "cotton")).toBe(true)
    expect(state.map.blocks[0]!.effects?.some((e) => e.kind === "spring")).toBe(false)
    expect(state.map.blocks[1]!.effects?.some((e) => e.kind === "cotton")).toBe(true)
    expect(state.map.blocks[1]!.effects?.some((e) => e.kind === "spring")).toBe(false)

    // Disable cotton
    state = editorReducer(state, {
      type: "SET_BLOCKS_EFFECT",
      blockIds: ["a", "b"],
      kind: "cotton",
      enabled: false,
    })
    expect(state.map.blocks[0]!.effects).toBeUndefined()
    expect(state.map.blocks[1]!.effects).toBeUndefined()
  })

  it("links and unlinks portal pairs between selected blocks", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, {
      type: "LINK_PORTAL_PAIR",
      blockIds: ["a", "b"],
    })
    const effA = state.map.blocks[0]!.effects?.find((e) => e.kind === "portal")
    const effB = state.map.blocks[1]!.effects?.find((e) => e.kind === "portal")
    expect(effA?.kind).toBe("portal")
    expect(effB?.kind).toBe("portal")
    if (effA?.kind === "portal" && effB?.kind === "portal") {
      expect(effA.pairId).toBeTruthy()
      expect(effA.pairId).toBe(effB.pairId)
    }

    // Unlink portals
    state = editorReducer(state, {
      type: "UNLINK_PORTALS",
      blockIds: ["a", "b"],
    })
    expect(state.map.blocks[0]!.effects).toBeUndefined()
    expect(state.map.blocks[1]!.effects).toBeUndefined()
  })

  it("clones a group sequence preserving relative offsets and remapping complete portal pairs", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SET_SNAP_TO_GRID", enabled: false })
    // Move initial blocks safely below HUD (y >= 155)
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a", "b"],
      updates: { position: { x: 100, y: 200 } },
    })
    // Position b at x: 200, y: 200
    state = editorReducer(state, {
      type: "UPDATE_BLOCK",
      blockId: "b",
      updates: { position: { x: 200, y: 200 } },
    })

    // Add portal pair between a and b
    state = editorReducer(state, {
      type: "LINK_PORTAL_PAIR",
      blockIds: ["a", "b"],
    })
    const initialPairId = (
      state.map.blocks[0]!.effects!.find((e) => e.kind === "portal") as { pairId: string }
    ).pairId

    // Clone group with 2 steps
    state = editorReducer(state, {
      type: "CLONE_GROUP_SEQUENCE",
      blockIds: ["a", "b"],
      deltas: [
        { x: 128, y: 0 },
        { x: 256, y: 0 },
      ],
    })
    expect(state.map.blocks).toHaveLength(6) // 2 originals + 2 in step 1 + 2 in step 2
    // New blocks are selected
    expect(state.selectedBlockIds).toHaveLength(4)

    // Check positions for step 1
    expect(state.map.blocks[2]!.position).toEqual({ x: 100 + 128, y: 200 })
    expect(state.map.blocks[3]!.position).toEqual({ x: 200 + 128, y: 200 })

    // Check portal pair remapping for step 1
    const p1A = state.map.blocks[2]!.effects?.find((e) => e.kind === "portal") as {
      pairId: string
    }
    const p1B = state.map.blocks[3]!.effects?.find((e) => e.kind === "portal") as {
      pairId: string
    }
    expect(p1A.pairId).not.toBe(initialPairId)
    expect(p1A.pairId).toBe(p1B.pairId)

    // Check portal pair remapping for step 2
    const p2A = state.map.blocks[4]!.effects?.find((e) => e.kind === "portal") as {
      pairId: string
    }
    const p2B = state.map.blocks[5]!.effects?.find((e) => e.kind === "portal") as {
      pairId: string
    }
    expect(p2A.pairId).not.toBe(initialPairId)
    expect(p2A.pairId).not.toBe(p1A.pairId)
    expect(p2A.pairId).toBe(p2B.pairId)

    // Undo restores the 2 blocks
    const undone = editorReducer(state, { type: "UNDO" })
    expect(undone.map.blocks).toHaveLength(2)
  })

  it("updates and clamps single and group clone gap settings", () => {
    let state = createEditorState(makeMap())
    expect(state.singleCloneGap).toBe(0)
    expect(state.groupCloneGap).toBe(0)

    state = editorReducer(state, { type: "SET_SINGLE_CLONE_GAP", gap: 16 })
    expect(state.singleCloneGap).toBe(16)

    state = editorReducer(state, { type: "SET_GROUP_CLONE_GAP", gap: 32 })
    expect(state.groupCloneGap).toBe(32)

    // Clamps to [-60, 300]
    state = editorReducer(state, { type: "SET_SINGLE_CLONE_GAP", gap: -100 })
    expect(state.singleCloneGap).toBe(-60)

    state = editorReducer(state, { type: "SET_GROUP_CLONE_GAP", gap: 500 })
    expect(state.groupCloneGap).toBe(300)
  })

  it("flips blocks horizontally and vertically and supports undo/redo", () => {
    let state = createEditorState(makeMap())
    state.map.blocks[0]!.size = { width: 40, height: 30 }
    state.map.blocks[1]!.size = { width: 40, height: 30 }
    state.map.blocks[0]!.position = { x: 200, y: 300 }
    state.map.blocks[1]!.position = { x: 400, y: 300 }
    state.map.blocks[0]!.rotation = 0
    state.map.blocks[1]!.rotation = 0

    // Flip horizontally around selection center (center X = 300)
    // a (200) -> 2*300 - 200 = 400
    // b (400) -> 2*300 - 400 = 200
    state = editorReducer(state, {
      type: "FLIP_BLOCKS",
      blockIds: ["a", "b"],
      axis: "horizontal",
      origin: "selection",
    })
    expect(state.map.blocks[0]!.position.x).toBe(400)
    expect(state.map.blocks[1]!.position.x).toBe(200)

    // Undo restores original
    const undone = editorReducer(state, { type: "UNDO" })
    expect(undone.map.blocks[0]!.position.x).toBe(200)
    expect(undone.map.blocks[1]!.position.x).toBe(400)
  })

  it("creates a symmetric duplicate across arena center and selects copies", () => {
    const state = createEditorState(makeMap())
    state.map.blocks[0]!.position = { x: 200, y: 300 }
    state.map.blocks[1]!.position = { x: 300, y: 300 }

    // Arena center is 960. 2*960 - 200 = 1720, 2*960 - 300 = 1620
    const duplicated = editorReducer(state, {
      type: "SYMMETRIC_DUPLICATE",
      blockIds: ["a", "b"],
      axis: "horizontal",
    })

    expect(duplicated.map.blocks).toHaveLength(4)
    expect(duplicated.selectedBlockIds).toHaveLength(2)
    const cloneA = duplicated.map.blocks[2]!
    const cloneB = duplicated.map.blocks[3]!
    expect(cloneA.position.x).toBe(1720)
    expect(cloneB.position.x).toBe(1620)

    // Undo removes copies
    const undone = editorReducer(duplicated, { type: "UNDO" })
    expect(undone.map.blocks).toHaveLength(2)
  })

  it("aligns blocks to left, center and right edges", () => {
    const state = createEditorState(makeMap())
    state.map.blocks[0]!.position = { x: 200, y: 300 } // width 40 -> left = 180
    state.map.blocks[1]!.position = { x: 400, y: 300 } // width 30 -> right = 415

    // Align left: both start at left edge (minX = 180)
    const alignedLeft = editorReducer(state, {
      type: "ALIGN_BLOCKS",
      blockIds: ["a", "b"],
      alignment: "left",
    })
    expect(alignedLeft.map.blocks[0]!.position.x).toBe(180 + 20)
    expect(alignedLeft.map.blocks[1]!.position.x).toBe(180 + 15)
  })

  it("distributes blocks evenly along axis", () => {
    const state = createEditorState(makeMap())
    // Add third block
    state.map.blocks.push({
      id: "c",
      position: { x: 390, y: 100 },
      shape: "rect",
      size: { width: 30, height: 30 },
      hp: 1,
    })
    state.map.blocks[0]!.position = { x: 100, y: 300 }
    state.map.blocks[1]!.position = { x: 150, y: 300 }
    state.map.blocks[2]!.position = { x: 500, y: 300 }

    const distributed = editorReducer(state, {
      type: "DISTRIBUTE_BLOCKS",
      blockIds: ["a", "b", "c"],
      axis: "horizontal",
    })
    expect(distributed.map.blocks[0]!.position.x).toBe(100)
    expect(distributed.map.blocks[1]!.position.x).toBe(300)
    expect(distributed.map.blocks[2]!.position.x).toBe(500)
  })

  it("applies HP gradient and zebra pattern across blocks", () => {
    const state = createEditorState(makeMap())
    state.map.blocks[0]!.position = { x: 100, y: 200 }
    state.map.blocks[1]!.position = { x: 100, y: 400 }

    const gradient = editorReducer(state, {
      type: "APPLY_HP_GRADIENT",
      blockIds: ["a", "b"],
      direction: "vertical",
      fromHp: 1,
      toHp: 4,
    })
    expect(gradient.map.blocks[0]!.hp).toBe(1)
    expect(gradient.map.blocks[1]!.hp).toBe(4)

    const zebra = editorReducer(state, {
      type: "APPLY_ZEBRA_PATTERN",
      blockIds: ["a", "b"],
      kind: "shape",
      optionA: "circle",
      optionB: "rect",
    })
    expect(zebra.map.blocks[0]!.shape).toBe("circle")
    expect(zebra.map.blocks[1]!.shape).toBe("rect")
  })

  it("supports smart selection: similar, connected, and invert", () => {
    const state = createEditorState(makeMap())
    // Block a: hp 1, shape ellipse, (100, 100)
    // Block b: hp 2, shape circle, (200, 100)
    // Add Block c: hp 1, shape rect, (110, 100) -> touches a
    state.map.blocks.push({
      id: "c",
      position: { x: 110, y: 100 },
      shape: "rect",
      size: { width: 30, height: 30 },
      hp: 1,
    })

    // Select similar by HP: a and c have hp 1
    const similarHp = editorReducer(state, {
      type: "SELECT_SIMILAR",
      criterion: "hp",
      referenceBlockId: "a",
    })
    expect(similarHp.selectedBlockIds.sort()).toEqual(["a", "c"])

    // Select connected: c touches a, but b is at 200 (far away)
    const connected = editorReducer(state, {
      type: "SELECT_CONNECTED",
      referenceBlockId: "a",
    })
    expect(connected.selectedBlockIds.sort()).toEqual(["a", "c"])

    // Invert selection
    const inverted = editorReducer(
      { ...state, selectedBlockIds: ["a"] },
      { type: "INVERT_SELECTION" }
    )
    expect(inverted.selectedBlockIds.sort()).toEqual(["b", "c"])
  })

  it("coalesces consecutive group resize updates so all size tweaks undo in a single step", () => {
    let state = createEditorState(makeMap())
    const initialMap = state.map
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["a", "b"] })

    // Multiple consecutive size adjustments on the group (tweaking width and height like a slider)
    for (let w = 45; w <= 75; w += 1) {
      state = editorReducer(state, {
        type: "UPDATE_BLOCKS",
        blockIds: ["a", "b"],
        updates: { size: { width: w } },
      })
    }
    // Trying a preset
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a", "b"],
      updates: { size: { width: 80, height: 40 } },
    })

    // Only 1 snapshot was created for the entire resize sequence
    expect(state.history.past).toHaveLength(1)
    expect(state.map.blocks[0]!.size.width).toBe(80)

    // Undoing once completely restores the original sizes before the session began
    state = editorReducer(state, { type: "UNDO" })
    expect(state.map.blocks[0]!.size).toEqual(initialMap.blocks[0]!.size)
    expect(state.map.blocks[1]!.size).toEqual(initialMap.blocks[1]!.size)
  })

  it("coalesces consecutive single block resize updates into one undo step", () => {
    let state = createEditorState(makeMap())
    const initialSize = state.map.blocks[0]!.size

    for (let w = 41; w <= 70; w += 1) {
      state = editorReducer(state, {
        type: "UPDATE_BLOCK",
        blockId: "a",
        updates: { size: { width: w } },
      })
    }

    expect(state.history.past).toHaveLength(1)
    expect(state.map.blocks[0]!.size.width).toBe(70)

    state = editorReducer(state, { type: "UNDO" })
    expect(state.map.blocks[0]!.size).toEqual(initialSize)
  })

  it("ends the resize session when a non-size edit occurs", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a", "b"],
      updates: { size: { width: 60 } },
    })
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a", "b"],
      updates: { size: { width: 70 } },
    })
    expect(state.history.past).toHaveLength(1)

    // Move blocks (different operation)
    state = editorReducer(state, {
      type: "MOVE_BLOCKS",
      blockIds: ["a", "b"],
      delta: { x: 10, y: 0 },
    })
    expect(state.history.past).toHaveLength(2)

    // First undo undos move
    state = editorReducer(state, { type: "UNDO" })
    expect(state.map.blocks[0]!.size.width).toBe(70)

    // Second undo undos the entire resize session back to initial
    state = editorReducer(state, { type: "UNDO" })
    expect(state.map.blocks[0]!.size.width).not.toBe(70)
  })

  it("coalesces consecutive group rotation updates into a single undo step", () => {
    let state = createEditorState(makeMap())
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["a", "b"] })

    // Several group rotations (e.g. quick buttons +45°, +45°, +90°)
    state = editorReducer(state, {
      type: "ROTATE_GROUP",
      blockIds: ["a", "b"],
      center: { x: 150, y: 100 },
      angle: Math.PI / 4,
    })
    state = editorReducer(state, {
      type: "ROTATE_GROUP",
      blockIds: ["a", "b"],
      center: { x: 150, y: 100 },
      angle: Math.PI / 4,
    })
    // Slider adjustment on rotation
    state = editorReducer(state, {
      type: "UPDATE_BLOCKS",
      blockIds: ["a", "b"],
      updates: { rotation: Math.PI },
    })

    expect(state.history.past).toHaveLength(1)
    expect(state.map.blocks[0]!.rotation).toBe(Math.PI)

    // Single undo restores back to original
    state = editorReducer(state, { type: "UNDO" })
    expect(state.map.blocks[0]!.rotation ?? 0).toBe(0)
    expect(state.map.blocks[1]!.rotation ?? 0).toBe(0)
  })

  it("coalesces consecutive HP adjustments into a single undo step", () => {
    let state = createEditorState(makeMap())
    const initialHp = state.map.blocks[0]!.hp
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["a", "b"] })

    // User tries different HP values (slider / buttons: 2, 3, 5, 8)
    for (const hp of [2, 3, 5, 8]) {
      state = editorReducer(state, {
        type: "UPDATE_BLOCKS",
        blockIds: ["a", "b"],
        updates: { hp },
      })
    }

    expect(state.history.past).toHaveLength(1)
    expect(state.map.blocks[0]!.hp).toBe(8)

    // Single undo restores back to initial HP
    state = editorReducer(state, { type: "UNDO" })
    expect(state.map.blocks[0]!.hp).toBe(initialHp)
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

describe("resize handle cursors", () => {
  it("determines correct cursor for all 4 corners of a non-rotated block", () => {
    const block = {
      id: "test",
      position: { x: 500, y: 500 },
      shape: "rect" as const,
      size: { width: 60, height: 40 },
      hp: 1,
    }
    const corners = blockCorners(block)

    // Corner 0: top-left (NW) -> nwse-resize
    expect(getResizeCursor(block.position, corners[0]!)).toBe("nwse-resize")

    // Corner 1: top-right (NE) -> nesw-resize
    expect(getResizeCursor(block.position, corners[1]!)).toBe("nesw-resize")

    // Corner 2: bottom-right (SE) -> nwse-resize
    expect(getResizeCursor(block.position, corners[2]!)).toBe("nwse-resize")

    // Corner 3: bottom-left (SW) -> nesw-resize
    expect(getResizeCursor(block.position, corners[3]!)).toBe("nesw-resize")
  })

  it("adjusts cursor for rotated block corners according to screen direction", () => {
    const block = {
      id: "test-rotated",
      position: { x: 500, y: 500 },
      shape: "rect" as const,
      size: { width: 60, height: 40 },
      rotation: Math.PI / 2, // 90 degrees rotation
      hp: 1,
    }
    const corners = blockCorners(block)

    // With 90 deg rotation, corner 0 (top-left) rotated by 90 deg is at top-right -> nesw-resize
    expect(getResizeCursor(block.position, corners[0]!)).toBe("nesw-resize")
    // Corner 1 (top-right) rotated by 90 deg is at bottom-right -> nwse-resize
    expect(getResizeCursor(block.position, corners[1]!)).toBe("nwse-resize")
  })
})
