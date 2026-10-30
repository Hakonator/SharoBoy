import type { PlayerBlockEffect, PlayerBlockSpec, PlayerMapSpec } from "../../game/mapSpec"

export type EditorTool = "select" | "add" | "delete"

export interface EditorHistory {
  past: PlayerMapSpec[]
  future: PlayerMapSpec[]
}

export interface HistorySession {
  kind: "resize"
  blockIds: string[]
}

export interface EditorState {
  map: PlayerMapSpec
  selectedBlockId: string | null
  selectedBlockIds: string[]
  clipboard: PlayerBlockSpec[]
  pastePhantom: PlayerBlockSpec[] | null
  activeTool: EditorTool
  addPreset: Partial<PlayerBlockSpec>
  gridSize: number
  snapToGrid: boolean
  singleCloneGap: number
  groupCloneGap: number
  history: EditorHistory
  historySession?: HistorySession | null
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
  onOpenMaps?: () => void
  onOpenPrefabs?: () => void
  musicMuted: boolean
  onToggleMusic: () => void
  onNextMusicTrack: () => void
}

export interface EditorInspectorProps {
  state: EditorState
  dispatch: (action: EditorAction) => void
  author: string
}

export type PlayerBlockUpdates = Partial<Omit<PlayerBlockSpec, "size">> & {
  size?: Partial<PlayerBlockSpec["size"]>
}

export type EditorAction =
  | { type: "SET_MAP"; map: PlayerMapSpec; preserveHistory?: boolean }
  | { type: "SELECT_BLOCK"; blockId: string | null }
  | { type: "SELECT_BLOCKS"; blockIds: string[] }
  | { type: "TOGGLE_BLOCK_SELECTION"; blockId: string }
  | { type: "SET_TOOL"; tool: EditorTool }
  | { type: "SET_ADD_PRESET"; preset: Partial<PlayerBlockSpec> }
  | { type: "SET_GRID_SIZE"; gridSize: number }
  | { type: "SET_SNAP_TO_GRID"; enabled: boolean }
  | { type: "SET_SINGLE_CLONE_GAP"; gap: number }
  | { type: "SET_GROUP_CLONE_GAP"; gap: number }
  | { type: "ADD_BLOCK"; block?: Partial<PlayerBlockSpec>; position: { x: number; y: number } }
  | { type: "UPDATE_BLOCK"; blockId: string; updates: PlayerBlockUpdates }
  | { type: "UPDATE_BLOCKS"; blockIds: string[]; updates: PlayerBlockUpdates }
  | {
      type: "SET_BLOCKS_EFFECT"
      blockIds: string[]
      kind: PlayerBlockEffect["kind"]
      enabled: boolean
      effect?: PlayerBlockEffect
    }
  | { type: "LINK_PORTAL_PAIR"; blockIds: [string, string] }
  | { type: "UNLINK_PORTALS"; blockIds: string[] }
  | { type: "DELETE_BLOCK"; blockId?: string }
  | { type: "DELETE_SELECTED_BLOCKS" }
  | {
      type: "MOVE_BLOCK"
      blockId: string
      position?: { x: number; y: number }
      delta?: { x: number; y: number }
    }
  | { type: "MOVE_BLOCKS"; blockIds: string[]; delta: { x: number; y: number } }
  | {
      type: "ROTATE_GROUP"
      blockIds: string[]
      center: { x: number; y: number }
      angle: number
    }
  | {
      type: "FLIP_BLOCKS"
      blockIds: string[]
      axis: "horizontal" | "vertical"
      origin?: "selection" | "center"
    }
  | {
      type: "SYMMETRIC_DUPLICATE"
      blockIds: string[]
      axis: "horizontal" | "vertical"
      mirrorLine?: number
    }
  | {
      type: "ALIGN_BLOCKS"
      blockIds: string[]
      alignment: "left" | "right" | "top" | "bottom" | "center_x" | "center_y"
    }
  | { type: "DISTRIBUTE_BLOCKS"; blockIds: string[]; axis: "horizontal" | "vertical" }
  | { type: "SNAP_BLOCKS_TO_GRID"; blockIds: string[] }
  | {
      type: "APPLY_HP_GRADIENT"
      blockIds: string[]
      direction: "horizontal" | "vertical"
      fromHp: number
      toHp: number
    }
  | {
      type: "RANDOMIZE_BLOCKS"
      blockIds: string[]
      options: {
        hpMin?: number
        hpMax?: number
        addEffects?: boolean
        jitterDeg?: number
      }
    }
  | {
      type: "APPLY_ZEBRA_PATTERN"
      blockIds: string[]
      kind: "hp" | "shape"
      optionA: number | PlayerBlockSpec["shape"]
      optionB: number | PlayerBlockSpec["shape"]
    }
  | {
      type: "SELECT_SIMILAR"
      criterion: "hp" | "shape" | "effect"
      referenceBlockId: string
    }
  | { type: "SELECT_CONNECTED"; referenceBlockId: string }
  | { type: "INVERT_SELECTION" }
  | { type: "COPY_SELECTED" }
  | { type: "PASTE_CLIPBOARD" }
  | { type: "START_PASTE" }
  | { type: "CANCEL_PASTE" }
  | { type: "COMMIT_PASTE"; blocks: PlayerBlockSpec[] }
  | { type: "CLONE_SEQUENCE"; blockId: string; positions: { x: number; y: number }[] }
  | { type: "CLONE_GROUP_SEQUENCE"; blockIds: string[]; deltas: { x: number; y: number }[] }
  | {
      type: "UPDATE_METADATA"
      metadata?: Partial<PlayerMapSpec["metadata"]>
      winCondition?: PlayerMapSpec["winCondition"]
    }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "MARK_SAVED" }
