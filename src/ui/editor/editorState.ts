import type { PlayerBlockEffect, PlayerBlockSpec, PlayerMapSpec } from "../../game/mapSpec"
import { PADDLE_ZONE_TOP } from "../../game/mapValidator"

import type { EditorAction, EditorState, PlayerBlockUpdates } from "./types"

export const EDITOR_DRAFT_STORAGE_KEY = "sharoboy_custom_map_draft"
const HISTORY_LIMIT = 30
const HUD_ZONE_BOTTOM = 140
const MAX_BLOCKS = 200

export function createEditorState(map: PlayerMapSpec): EditorState {
  return {
    map: cloneMap(map),
    selectedBlockId: null,
    selectedBlockIds: [],
    clipboard: [],
    pastePhantom: null,
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
        selectedBlockIds: [],
        history: action.preserveHistory ? state.history : { past: [], future: [] },
        isDirty: action.preserveHistory ? true : false,
      }
    case "SELECT_BLOCK":
      return setSelection(state, action.blockId ? [action.blockId] : [])
    case "SELECT_BLOCKS":
      return setSelection(state, action.blockIds)
    case "TOGGLE_BLOCK_SELECTION": {
      const selected = state.selectedBlockIds.includes(action.blockId)
        ? state.selectedBlockIds.filter((id) => id !== action.blockId)
        : [...state.selectedBlockIds, action.blockId]
      return setSelection(state, selected)
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
      const presetSize = preset.size ? { ...preset.size } : { width: 64, height: 40 }
      if (preset.shape === "circle") {
        const side = Math.min(presetSize.width, presetSize.height)
        presetSize.width = side
        presetSize.height = side
      }
      const id =
        preset.id && !state.map.blocks.some((block) => block.id === preset.id)
          ? preset.id
          : createBlockId(state.map)
      const block: PlayerBlockSpec = {
        id,
        position: clampPosition(
          snapPosition(action.position, state),
          presetSize.width,
          presetSize.height
        ),
        shape: preset.shape ?? "ellipse",
        size: presetSize,
        hp: preset.hp ?? 1,
        ...(preset.rotation === undefined ? {} : { rotation: preset.rotation }),
        ...(preset.effects === undefined
          ? {}
          : { effects: preset.effects.map((effect) => ({ ...effect })) }),
        ...(preset.motion === undefined ? {} : { motion: { ...preset.motion } }),
      }
      return updateMap(state, { ...state.map, blocks: [...state.map.blocks, block] }, [id])
    }
    case "UPDATE_BLOCK": {
      const index = state.map.blocks.findIndex((block) => block.id === action.blockId)
      if (index < 0) return state
      const blocks = state.map.blocks.map((block) =>
        block.id === action.blockId
          ? mergeBlock(block, normalizeBlockUpdates(block, action.updates))
          : block
      )
      return updateMap(state, { ...state.map, blocks })
    }
    case "UPDATE_BLOCKS": {
      const selectedIds = new Set(action.blockIds)
      if (selectedIds.size === 0) return state
      const blocks = state.map.blocks.map((block) => {
        if (!selectedIds.has(block.id)) return block
        const normalized = normalizeBlockUpdates(block, action.updates)
        return mergeBlock(block, normalized)
      })
      return updateMap(state, { ...state.map, blocks })
    }
    case "SET_BLOCKS_EFFECT": {
      const selectedIds = new Set(action.blockIds)
      if (selectedIds.size === 0) return state
      const blocks = state.map.blocks.map((block) => {
        if (!selectedIds.has(block.id)) return block
        let effects = [...(block.effects ?? [])]
        effects = effects.filter((e) => e.kind !== action.kind)
        if (action.enabled) {
          if (action.kind === "spring") effects = effects.filter((e) => e.kind !== "cotton")
          if (action.kind === "cotton") effects = effects.filter((e) => e.kind !== "spring")
          const toAdd = action.effect ?? defaultEffect(action.kind, block)
          if (toAdd) effects.push(toAdd)
        }
        return {
          ...block,
          effects: effects.length > 0 ? sanitizeEffects(effects) : undefined,
        }
      })
      return updateMap(state, { ...state.map, blocks })
    }
    case "LINK_PORTAL_PAIR": {
      const [id1, id2] = action.blockIds
      if (!id1 || !id2 || id1 === id2) return state
      const b1 = state.map.blocks.find((b) => b.id === id1)
      const b2 = state.map.blocks.find((b) => b.id === id2)
      if (!b1 || !b2) return state
      const pairId = `portal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const blocks = state.map.blocks.map((block) => {
        if (block.id !== id1 && block.id !== id2) return block
        const filtered = (block.effects ?? []).filter((e) => e.kind !== "portal")
        return {
          ...block,
          effects: [...filtered, { kind: "portal" as const, pairId }],
        }
      })
      return updateMap(state, { ...state.map, blocks })
    }
    case "UNLINK_PORTALS": {
      const targetIds = new Set(action.blockIds)
      if (targetIds.size === 0) return state
      const blocks = state.map.blocks.map((block) => {
        if (!targetIds.has(block.id)) return block
        const filtered = (block.effects ?? []).filter((e) => e.kind !== "portal")
        return {
          ...block,
          effects: filtered.length > 0 ? filtered : undefined,
        }
      })
      return updateMap(state, { ...state.map, blocks })
    }
    case "DELETE_BLOCK": {
      const ids = action.blockId ? [action.blockId] : state.selectedBlockIds
      return deleteBlocks(state, ids)
    }
    case "DELETE_SELECTED_BLOCKS":
      return deleteBlocks(state, state.selectedBlockIds)
    case "MOVE_BLOCKS": {
      const selectedIds = new Set(action.blockIds)
      if (selectedIds.size === 0) return state
      const delta = clampGroupDelta(
        state.map.blocks.filter((block) => selectedIds.has(block.id)),
        action.delta
      )
      const blocks = state.map.blocks.map((block) =>
        selectedIds.has(block.id)
          ? {
              ...block,
              position: clampPosition(
                { x: block.position.x + delta.x, y: block.position.y + delta.y },
                block.size.width,
                block.size.height
              ),
            }
          : block
      )
      return updateMap(state, { ...state.map, blocks })
    }
    case "COPY_SELECTED": {
      const selected = new Set(state.selectedBlockIds)
      return {
        ...state,
        clipboard: cloneBlocks(state.map.blocks.filter((block) => selected.has(block.id))),
      }
    }
    case "PASTE_CLIPBOARD": {
      if (state.clipboard.length === 0) return state
      const copied = state.clipboard.map((block) => ({
        ...cloneBlocks([block])[0]!,
        id: createBlockId({ ...state.map, blocks: [...state.map.blocks, ...state.clipboard] }),
        position: clampPosition(
          snapPosition({ x: block.position.x + 32, y: block.position.y + 32 }, state),
          block.size.width,
          block.size.height
        ),
      }))
      const ids = copied.map((block) => block.id)
      return updateMap(state, { ...state.map, blocks: [...state.map.blocks, ...copied] }, ids)
    }
    case "START_PASTE": {
      const source =
        state.clipboard.length > 0
          ? state.clipboard
          : state.map.blocks.filter((block) => state.selectedBlockIds.includes(block.id))
      if (source.length === 0) return state
      return {
        ...state,
        clipboard: cloneBlocks(source),
        pastePhantom: cloneBlocks(source),
      }
    }
    case "CANCEL_PASTE":
      return state.pastePhantom ? { ...state, pastePhantom: null } : state
    case "COMMIT_PASTE": {
      const incoming = action.blocks
      if (!incoming || incoming.length === 0) {
        return { ...state, pastePhantom: null }
      }
      const available = Math.max(0, MAX_BLOCKS - state.map.blocks.length)
      if (available <= 0) {
        return { ...state, pastePhantom: null }
      }
      const toAdd = incoming.slice(0, available)
      const idMap = new Map<string, string>()
      const portalMap = new Map<string, string>()
      const currentIds = new Set(state.map.blocks.map((b) => b.id))

      for (const block of toAdd) {
        let newId: string
        do {
          newId = `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        } while (currentIds.has(newId) || Array.from(idMap.values()).includes(newId))
        idMap.set(block.id, newId)

        if (block.effects) {
          for (const effect of block.effects) {
            if (effect.kind === "portal" && effect.pairId && !portalMap.has(effect.pairId)) {
              portalMap.set(
                effect.pairId,
                `portal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
              )
            }
          }
        }
      }

      const finalBlocks: PlayerBlockSpec[] = toAdd.map((block) => {
        const newId = idMap.get(block.id) ?? createBlockId(state.map)
        const newEffects = block.effects?.map((effect) => {
          if (effect.kind === "portal" && effect.pairId) {
            return {
              ...effect,
              pairId: portalMap.get(effect.pairId) ?? effect.pairId,
            }
          }
          return { ...effect }
        })
        const newLinks = block.links?.map((link) => {
          if (link.targetBlockId && idMap.has(link.targetBlockId)) {
            return {
              ...link,
              targetBlockId: idMap.get(link.targetBlockId)!,
            }
          }
          return { ...link }
        })
        return {
          ...block,
          id: newId,
          position: clampPosition(
            snapPosition(block.position, state),
            block.size.width,
            block.size.height
          ),
          ...(newEffects ? { effects: newEffects } : {}),
          ...(newLinks ? { links: newLinks } : {}),
        }
      })

      const newIds = finalBlocks.map((b) => b.id)
      const nextMap = { ...state.map, blocks: [...state.map.blocks, ...finalBlocks] }
      return {
        ...updateMap(state, nextMap, newIds),
        pastePhantom: null,
      }
    }
    case "CLONE_SEQUENCE": {
      const source = state.map.blocks.find((block) => block.id === action.blockId)
      if (!source || source.effects?.some((effect) => effect.kind === "portal")) return state
      const available = Math.max(0, MAX_BLOCKS - state.map.blocks.length)
      const positions = action.positions
        .slice(0, available)
        .map((position) =>
          clampPosition(snapPosition(position, state), source.size.width, source.size.height)
        )
      if (positions.length === 0) return state
      const additions: PlayerBlockSpec[] = []
      for (const position of positions) {
        const mapWithCopies = { ...state.map, blocks: [...state.map.blocks, ...additions] }
        additions.push({ ...cloneBlocks([source])[0]!, id: createBlockId(mapWithCopies), position })
      }
      return updateMap(
        state,
        { ...state.map, blocks: [...state.map.blocks, ...additions] },
        additions.map((block) => block.id)
      )
    }
    case "CLONE_GROUP_SEQUENCE": {
      const sources = state.map.blocks.filter((block) => action.blockIds.includes(block.id))
      if (sources.length === 0 || action.deltas.length === 0) return state

      const portalMap = new Map<string, string[]>()
      for (const block of sources) {
        for (const effect of block.effects ?? []) {
          if (effect.kind === "portal") {
            const list = portalMap.get(effect.pairId) ?? []
            list.push(block.id)
            portalMap.set(effect.pairId, list)
          }
        }
      }
      for (const list of portalMap.values()) {
        if (list.length !== 2) return state
      }

      const available = Math.max(0, MAX_BLOCKS - state.map.blocks.length)
      const additions: PlayerBlockSpec[] = []
      let slotsLeft = available

      for (const delta of action.deltas) {
        if (slotsLeft < sources.length) break
        const stepPortalMap = new Map<string, string>()
        for (const pairId of portalMap.keys()) {
          stepPortalMap.set(
            pairId,
            `portal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          )
        }

        const stepBlocks: PlayerBlockSpec[] = []
        for (const source of sources) {
          const mapWithCopies = {
            ...state.map,
            blocks: [...state.map.blocks, ...additions, ...stepBlocks],
          }
          const newId = createBlockId(mapWithCopies)
          const newPosition = clampPosition(
            snapPosition({ x: source.position.x + delta.x, y: source.position.y + delta.y }, state),
            source.size.width,
            source.size.height
          )
          const newEffects = source.effects?.map((effect) => {
            if (effect.kind === "portal" && stepPortalMap.has(effect.pairId)) {
              return { ...effect, pairId: stepPortalMap.get(effect.pairId)! }
            }
            return { ...effect }
          })
          stepBlocks.push({
            ...cloneBlocks([source])[0]!,
            id: newId,
            position: newPosition,
            ...(newEffects ? { effects: newEffects } : {}),
          })
        }
        additions.push(...stepBlocks)
        slotsLeft -= sources.length
      }

      if (additions.length === 0) return state
      return updateMap(
        state,
        { ...state.map, blocks: [...state.map.blocks, ...additions] },
        additions.map((block) => block.id)
      )
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
        updates: {
          position: clampPosition(
            snapPosition(position, state),
            block.size.width,
            block.size.height
          ),
        },
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
        selectedBlockIds: [],
        pastePhantom: null,
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
        selectedBlockIds: [],
        pastePhantom: null,
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
  selectedBlockIds: string[] = state.selectedBlockIds
): EditorState {
  return {
    ...state,
    map,
    selectedBlockIds,
    selectedBlockId: selectedBlockIds[0] ?? null,
    history: {
      past: [...state.history.past, cloneMap(state.map)].slice(-HISTORY_LIMIT),
      future: [],
    },
    isDirty: true,
  }
}

function setSelection(state: EditorState, blockIds: string[]): EditorState {
  const available = new Set(state.map.blocks.map((block) => block.id))
  const selectedBlockIds = [...new Set(blockIds)].filter((id) => available.has(id))
  return { ...state, selectedBlockIds, selectedBlockId: selectedBlockIds[0] ?? null }
}

function deleteBlocks(state: EditorState, blockIds: string[]): EditorState {
  const ids = new Set(blockIds)
  if (![...ids].some((id) => state.map.blocks.some((block) => block.id === id))) return state
  const blocks = state.map.blocks.filter((block) => !ids.has(block.id))
  const groups = state.map.groups
    ?.map((group) => ({ ...group, blockIds: group.blockIds.filter((id) => !ids.has(id)) }))
    .filter((group) => group.blockIds.length > 0)
  const winCondition =
    state.map.winCondition.kind === "targets"
      ? {
          ...state.map.winCondition,
          targetIds: state.map.winCondition.targetIds.filter((id) => !ids.has(id)),
        }
      : state.map.winCondition
  return updateMap(state, { ...state.map, blocks, winCondition, ...(groups ? { groups } : {}) }, [])
}

function clampGroupDelta(blocks: PlayerBlockSpec[], delta: { x: number; y: number }) {
  if (blocks.length === 0) return { x: 0, y: 0 }
  const minX = Math.max(...blocks.map((block) => block.size.width / 2 - block.position.x))
  const maxX = Math.min(...blocks.map((block) => 1920 - block.size.width / 2 - block.position.x))
  const minY = Math.max(
    ...blocks.map((block) => HUD_ZONE_BOTTOM + block.size.height / 2 - block.position.y)
  )
  const maxY = Math.min(
    ...blocks.map((block) => PADDLE_ZONE_TOP - block.size.height / 2 - block.position.y)
  )
  return { x: Math.max(minX, Math.min(maxX, delta.x)), y: Math.max(minY, Math.min(maxY, delta.y)) }
}

function cloneBlocks(blocks: PlayerBlockSpec[]): PlayerBlockSpec[] {
  return structuredClone(blocks)
}

function snapPosition(position: { x: number; y: number }, state: EditorState) {
  if (!state.snapToGrid) return { ...position }
  return {
    x: Math.round(position.x / state.gridSize) * state.gridSize,
    y: Math.round(position.y / state.gridSize) * state.gridSize,
  }
}

function clampPosition(position: { x: number; y: number }, width: number, height: number) {
  return {
    x: Math.max(width / 2, Math.min(1920 - width / 2, position.x)),
    y: Math.max(HUD_ZONE_BOTTOM + height / 2, Math.min(PADDLE_ZONE_TOP - height / 2, position.y)),
  }
}

export function defaultEffect(
  kind: PlayerBlockEffect["kind"],
  _block?: PlayerBlockSpec
): PlayerBlockEffect | null {
  switch (kind) {
    case "armor":
      return { kind, amount: 1 }
    case "brittle":
      return { kind, radius: 120, damage: 1 }
    case "phase":
      return { kind, period: 3.2, activeFraction: 0.62, offset: 0 }
    case "spring":
      return { kind }
    case "cotton":
      return { kind }
    case "pulse":
      return { kind, amplitude: 0.5, frequency: 1 }
    case "magnet":
      return { kind, mode: "attract", radius: 240, force: 2200 }
    case "portal":
      return { kind, pairId: "portal-pair" }
    case "spin":
      return { kind, direction: "clockwise" }
    case "normal":
      return { kind }
  }
}

function findLastEffectIndex(list: PlayerBlockEffect[], kind: PlayerBlockEffect["kind"]): number {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]!.kind === kind) return i
  }
  return -1
}

export function sanitizeEffects(effects: PlayerBlockEffect[]): PlayerBlockEffect[] {
  // Mutual exclusion: spring vs cotton
  const hasSpring = effects.some((e) => e.kind === "spring")
  const hasCotton = effects.some((e) => e.kind === "cotton")
  let list = effects
  if (hasSpring && hasCotton) {
    const lastSpring = findLastEffectIndex(list, "spring")
    const lastCotton = findLastEffectIndex(list, "cotton")
    list =
      lastSpring > lastCotton
        ? list.filter((e) => e.kind !== "cotton")
        : list.filter((e) => e.kind !== "spring")
  }

  return list.map((effect) => {
    if (effect.kind === "armor") {
      return { ...effect, amount: Math.max(1, Math.min(5, Math.round(effect.amount))) }
    }
    if (effect.kind === "brittle") {
      return {
        ...effect,
        ...(effect.radius === undefined
          ? {}
          : { radius: Math.max(10, Math.min(1000, Math.round(effect.radius))) }),
        ...(effect.damage === undefined
          ? {}
          : { damage: Math.max(1, Math.min(5, Math.round(effect.damage))) }),
      }
    }
    if (effect.kind === "phase") {
      return {
        ...effect,
        ...(effect.period === undefined
          ? {}
          : { period: Math.max(0.5, Math.min(20, Math.round(effect.period * 10) / 10)) }),
        ...(effect.activeFraction === undefined
          ? {}
          : {
              activeFraction: Math.max(
                0.05,
                Math.min(0.95, Math.round(effect.activeFraction * 100) / 100)
              ),
            }),
        ...(effect.offset === undefined
          ? {}
          : { offset: Math.max(0, Math.min(100, Math.round(effect.offset * 10) / 10)) }),
      }
    }
    if (effect.kind === "magnet") {
      return {
        ...effect,
        ...(effect.radius === undefined
          ? {}
          : { radius: Math.max(50, Math.min(500, Math.round(effect.radius))) }),
        ...(effect.force === undefined
          ? {}
          : { force: Math.max(-5000, Math.min(5000, Math.round(effect.force))) }),
      }
    }
    if (effect.kind === "pulse") {
      return {
        ...effect,
        amplitude: Math.max(0.1, Math.min(2, Math.round(effect.amplitude * 10) / 10)),
        frequency: Math.max(0.1, Math.min(5, Math.round(effect.frequency * 10) / 10)),
      }
    }
    if (effect.kind === "spring" || effect.kind === "cotton") {
      const minMult = effect.kind === "spring" ? 1.1 : 0.1
      const maxMult = effect.kind === "spring" ? 3 : 0.9
      return {
        ...effect,
        ...(effect.speedMultiplier === undefined
          ? {}
          : {
              speedMultiplier: Math.max(
                minMult,
                Math.min(maxMult, Math.round(effect.speedMultiplier * 10) / 10)
              ),
            }),
        ...(effect.duration === undefined
          ? {}
          : { duration: Math.max(1, Math.min(10, Math.round(effect.duration * 10) / 10)) }),
      }
    }
    return effect
  })
}

function normalizeBlockUpdates(
  block: PlayerBlockSpec,
  updates: PlayerBlockUpdates
): Partial<PlayerBlockSpec> {
  const nextSize = updates.size
    ? {
        width:
          updates.size.width !== undefined
            ? Math.max(20, Math.min(100, Math.round(updates.size.width)))
            : block.size.width,
        height:
          updates.size.height !== undefined
            ? Math.max(20, Math.min(100, Math.round(updates.size.height)))
            : block.size.height,
      }
    : undefined

  const restUpdates = { ...updates }
  delete (restUpdates as { size?: unknown }).size
  const next: Partial<PlayerBlockSpec> = {
    ...restUpdates,
    ...(updates.position
      ? { position: { x: Math.round(updates.position.x), y: Math.round(updates.position.y) } }
      : {}),
    ...(nextSize ? { size: nextSize } : {}),
    ...(updates.hp === undefined ? {} : { hp: Math.max(1, Math.min(8, Math.round(updates.hp))) }),
    ...(updates.rotation === undefined
      ? {}
      : { rotation: (Math.round((updates.rotation * 180) / Math.PI / 5) * 5 * Math.PI) / 180 }),
    ...(updates.effects ? { effects: sanitizeEffects(updates.effects) } : {}),
  }
  if (updates.shape === "circle" || (updates.shape === undefined && block.shape === "circle")) {
    const size = next.size ?? block.size
    const side = Math.min(size.width, size.height)
    next.size = { width: side, height: side }
  }
  if (updates.position || updates.size) {
    const size = next.size ?? block.size
    next.position = clampPosition(next.position ?? block.position, size.width, size.height)
  }
  return next
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
