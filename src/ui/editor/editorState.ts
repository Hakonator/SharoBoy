import type { PlayerBlockSpec, PlayerMapSpec } from "../../game/mapSpec"

import type { EditorAction, EditorState } from "./types"

export const EDITOR_DRAFT_STORAGE_KEY = "sharoboy_custom_map_draft"
const HISTORY_LIMIT = 30

export function createEditorState(map: PlayerMapSpec): EditorState {
  return {
    map: cloneMap(map),
    selectedBlockId: null,
    activeTool: "select",
    addPreset: { shape: "ellipse", size: { width: 64, height: 40 }, hp: 1 },
    gridSize: 32,
    snapToGrid: true,
    history: { past: [], future: [] },
    isDirty: false,
  }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_MAP":
      return {
        ...state,
        map: cloneMap(action.map),
        selectedBlockId: null,
        history: action.preserveHistory ? state.history : { past: [], future: [] },
        isDirty: action.preserveHistory ? true : false,
      }
    case "SELECT_BLOCK":
      return {
        ...state,
        selectedBlockId:
          action.blockId && state.map.blocks.some((block) => block.id === action.blockId)
            ? action.blockId
            : null,
      }
    case "SET_TOOL":
      return { ...state, activeTool: action.tool }
    case "SET_ADD_PRESET":
      return { ...state, addPreset: { ...state.addPreset, ...action.preset } }
    case "SET_GRID_SIZE":
      return Number.isFinite(action.gridSize) && action.gridSize > 0
        ? { ...state, gridSize: action.gridSize }
        : state
    case "SET_SNAP_TO_GRID":
      return { ...state, snapToGrid: action.enabled }
    case "ADD_BLOCK": {
      const preset = { ...state.addPreset, ...action.block }
      const id =
        preset.id && !state.map.blocks.some((block) => block.id === preset.id)
          ? preset.id
          : createBlockId(state.map)
      const block: PlayerBlockSpec = {
        id,
        position: snapPosition(action.position, state),
        shape: preset.shape ?? "ellipse",
        size: preset.size ? { ...preset.size } : { width: 64, height: 40 },
        hp: preset.hp ?? 1,
        ...(preset.rotation === undefined ? {} : { rotation: preset.rotation }),
        ...(preset.effects === undefined
          ? {}
          : { effects: preset.effects.map((effect) => ({ ...effect })) }),
        ...(preset.motion === undefined ? {} : { motion: { ...preset.motion } }),
      }
      return updateMap(state, { ...state.map, blocks: [...state.map.blocks, block] }, id)
    }
    case "UPDATE_BLOCK": {
      const index = state.map.blocks.findIndex((block) => block.id === action.blockId)
      if (index < 0) return state
      const blocks = state.map.blocks.map((block) =>
        block.id === action.blockId ? mergeBlock(block, action.updates) : block
      )
      return updateMap(state, { ...state.map, blocks })
    }
    case "DELETE_BLOCK": {
      const blockId = action.blockId ?? state.selectedBlockId
      if (!blockId || !state.map.blocks.some((block) => block.id === blockId)) return state
      const blocks = state.map.blocks.filter((block) => block.id !== blockId)
      const groups = state.map.groups
        ?.map((group) => ({ ...group, blockIds: group.blockIds.filter((id) => id !== blockId) }))
        .filter((group) => group.blockIds.length > 0)
      const winCondition =
        state.map.winCondition.kind === "targets"
          ? {
              ...state.map.winCondition,
              targetIds: state.map.winCondition.targetIds.filter((id) => id !== blockId),
            }
          : state.map.winCondition
      const map: PlayerMapSpec = {
        ...state.map,
        blocks,
        winCondition,
        ...(groups ? { groups } : {}),
      }
      return updateMap(state, map, state.selectedBlockId === blockId ? null : state.selectedBlockId)
    }
    case "MOVE_BLOCK": {
      const block = state.map.blocks.find((item) => item.id === action.blockId)
      if (!block || (!action.position && !action.delta)) return state
      const position = action.position ?? {
        x: block.position.x + (action.delta?.x ?? 0),
        y: block.position.y + (action.delta?.y ?? 0),
      }
      return editorReducer(state, {
        type: "UPDATE_BLOCK",
        blockId: action.blockId,
        updates: { position: snapPosition(position, state) },
      })
    }
    case "UPDATE_METADATA": {
      const map: PlayerMapSpec = {
        ...state.map,
        metadata: action.metadata
          ? { ...state.map.metadata, ...action.metadata }
          : state.map.metadata,
        ...(action.winCondition ? { winCondition: action.winCondition } : {}),
      }
      return updateMap(state, map)
    }
    case "UNDO": {
      const previous = state.history.past[state.history.past.length - 1]
      if (!previous) return state
      return {
        ...state,
        map: cloneMap(previous),
        selectedBlockId: null,
        history: {
          past: state.history.past.slice(0, -1),
          future: [cloneMap(state.map), ...state.history.future],
        },
        isDirty: true,
      }
    }
    case "REDO": {
      const next = state.history.future[0]
      if (!next) return state
      return {
        ...state,
        map: cloneMap(next),
        selectedBlockId: null,
        history: {
          past: [...state.history.past, cloneMap(state.map)].slice(-HISTORY_LIMIT),
          future: state.history.future.slice(1),
        },
        isDirty: true,
      }
    }
    case "MARK_SAVED":
      return state.isDirty ? { ...state, isDirty: false } : state
  }
}

export function saveEditorDraft(map: PlayerMapSpec): boolean {
  try {
    if (typeof localStorage === "undefined") return false
    localStorage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(map))
    return true
  } catch {
    return false
  }
}

export function loadEditorDraft(): PlayerMapSpec | null {
  try {
    if (typeof localStorage === "undefined") return null
    const stored = localStorage.getItem(EDITOR_DRAFT_STORAGE_KEY)
    if (!stored) return null
    const value: unknown = JSON.parse(stored)
    return isPlayerMap(value) ? value : null
  } catch {
    return null
  }
}

function updateMap(
  state: EditorState,
  map: PlayerMapSpec,
  selectedBlockId = state.selectedBlockId
): EditorState {
  return {
    ...state,
    map,
    selectedBlockId,
    history: {
      past: [...state.history.past, cloneMap(state.map)].slice(-HISTORY_LIMIT),
      future: [],
    },
    isDirty: true,
  }
}

function snapPosition(position: { x: number; y: number }, state: EditorState) {
  if (!state.snapToGrid) return { ...position }
  return {
    x: Math.round(position.x / state.gridSize) * state.gridSize,
    y: Math.round(position.y / state.gridSize) * state.gridSize,
  }
}

function createBlockId(map: PlayerMapSpec): string {
  let id: string
  do {
    id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  } while (map.blocks.some((block) => block.id === id))
  return id
}

function mergeBlock(block: PlayerBlockSpec, updates: Partial<PlayerBlockSpec>): PlayerBlockSpec {
  return {
    ...block,
    ...updates,
    position: updates.position ? { ...updates.position } : block.position,
    size: updates.size ? { ...updates.size } : block.size,
    ...(updates.effects ? { effects: updates.effects.map((effect) => ({ ...effect })) } : {}),
  }
}

function cloneMap(map: PlayerMapSpec): PlayerMapSpec {
  return structuredClone(map)
}

function isPlayerMap(value: unknown): value is PlayerMapSpec {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<PlayerMapSpec>
  return (
    candidate.version === 1 &&
    typeof candidate.id === "string" &&
    typeof candidate.metadata === "object" &&
    candidate.metadata !== null &&
    Array.isArray(candidate.blocks) &&
    typeof candidate.winCondition === "object" &&
    candidate.winCondition !== null
  )
}
