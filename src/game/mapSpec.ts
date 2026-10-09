/**
 * Версионируемый декларативный контракт пользовательской карты (MVP).
 * Намеренно не использует runtime-типы Block/BlockSpecial: состояние игры
 * вычисляется адаптером при запуске карты.
 */

export type PlayerMapId = string
export type PlayerBlockId = string
export type BlockGroupId = string

export interface PlayerMapMetadata {
  title: string
  description?: string
  author?: string
  createdAt?: string
  updatedAt?: string
  /** Seed нужен только картам с детерминированной случайной генерацией. */
  seed?: number
}

export type PlayerMapWinCondition =
  { kind: "all-destructible" } | { kind: "targets"; targetIds: PlayerBlockId[] }

export interface PlayerMapSpec {
  /** Версия формата; начальный MVP-контракт — версия 1. */
  version: 1
  id: PlayerMapId
  metadata: PlayerMapMetadata
  blocks: PlayerBlockSpec[]
  groups?: BlockGroupSpec[]
  winCondition: PlayerMapWinCondition
}

export type PlayerBlockShape = "circle" | "ellipse"

export interface PlayerBlockSpec {
  id: PlayerBlockId
  /** Нормализованные координаты относительно игрового поля 1920×1080. */
  position: { x: number; y: number }
  shape: PlayerBlockShape
  /** Полный размер в координатах карты, а не runtime-полуоси. */
  size: { width: number; height: number }
  rotation?: number
  hp: number
  effects?: PlayerBlockEffect[]
  motion?: MotionSpec
  groupId?: BlockGroupId
  links?: PlayerBlockLink[]
}

export type PlayerBlockEffect =
  | { kind: "normal" }
  | { kind: "armor"; amount: number }
  | { kind: "pulse"; amplitude: number; frequency: number; phase?: number }
  | { kind: "spring"; speedMultiplier?: number; duration?: number }
  | { kind: "cotton"; speedMultiplier?: number; duration?: number }
  | { kind: "spin"; direction?: "clockwise" | "counterclockwise" }
  | { kind: "portal"; pairId: string }

export interface PlayerBlockLink {
  kind: "portal-pair"
  targetBlockId: PlayerBlockId
}

export type MotionSpec =
  | {
      kind: "drift"
      path: "horizontal" | "vertical"
      amplitude: number
      frequency: number
      phase?: number
    }
  | { kind: "drift"; path: "circle"; radius: number; frequency: number; phase?: number }

/** Группа MVP служит только для объединения блоков в редакторе. */
export interface BlockGroupSpec {
  id: BlockGroupId
  blockIds: PlayerBlockId[]
}
