import type { PlayerBlockSpec, PlayerMapSpec } from "../../game/mapSpec"

export type EditorTool = "select" | "add" | "delete"

export interface EditorHistory {
  past: PlayerMapSpec[]
  future: PlayerMapSpec[]
}

export interface EditorState {
  map: PlayerMapSpec
  selectedBlockId: string | null
  activeTool: EditorTool
  addPreset: Partial<PlayerBlockSpec>
  gridSize: number
  snapToGrid: boolean
  history: EditorHistory
  isDirty: boolean
}

export interface EditorCanvasProps {
  state: EditorState
  dispatch: (action: EditorAction) => void
  className?: string
}

export interface EditorToolbarProps {
  state: EditorState
  dispatch: (action: EditorAction) => void
  onImportExport: () => void
  onTestRun: () => void
  onClose: () => void
}

export interface EditorInspectorProps {
  state: EditorState
  dispatch: (action: EditorAction) => void
}

export type EditorAction =
  | { type: "SET_MAP"; map: PlayerMapSpec; preserveHistory?: boolean }
  | { type: "SELECT_BLOCK"; blockId: string | null }
  | { type: "SET_TOOL"; tool: EditorTool }
  | { type: "SET_ADD_PRESET"; preset: Partial<PlayerBlockSpec> }
  | { type: "SET_GRID_SIZE"; gridSize: number }
  | { type: "SET_SNAP_TO_GRID"; enabled: boolean }
  | { type: "ADD_BLOCK"; block?: Partial<PlayerBlockSpec>; position: { x: number; y: number } }
  | { type: "UPDATE_BLOCK"; blockId: string; updates: Partial<PlayerBlockSpec> }
  | { type: "DELETE_BLOCK"; blockId?: string }
  | {
      type: "MOVE_BLOCK"
      blockId: string
      position?: { x: number; y: number }
      delta?: { x: number; y: number }
    }
  | {
      type: "UPDATE_METADATA"
      metadata?: Partial<PlayerMapSpec["metadata"]>
      winCondition?: PlayerMapSpec["winCondition"]
    }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "MARK_SAVED" }
