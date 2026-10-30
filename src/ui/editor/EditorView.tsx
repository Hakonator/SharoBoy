import { useEffect, useReducer, useState } from "react"

import { LEADERBOARD_ENABLED } from "../../config"
import type { PlayerMapSpec } from "../../game/mapSpec"
import { validatePlayerMapSpec } from "../../game/mapValidator"

import { EditorCanvas } from "./EditorCanvas"
import { EditorInspector } from "./EditorInspector"
import { EditorJsonModal } from "./EditorJsonModal"
import { EditorMapsModal } from "./EditorMapsModal"
import { EditorPrefabsModal } from "./EditorPrefabsModal"
import { EditorPublishModal } from "./EditorPublishModal"
import { createEditorState, editorReducer, saveEditorDraft } from "./editorState"
import { EditorToolbar } from "./EditorToolbar"
import {
  createDefaultMap,
  deleteLocalMap,
  getCurrentLocalMapId,
  loadLocalMaps,
  saveLocalMap,
  setCurrentLocalMapId,
  type LocalMapEntry,
} from "./localMapsStorage"
import type { EditorState } from "./types"

interface EditorViewProps {
  onClose: () => void
  onTestRun: (map: PlayerMapSpec) => void
  playerNick: string
  musicMuted: boolean
  onToggleMusic: () => void
  onNextMusicTrack: () => void
  initialMap?: PlayerMapSpec | null
}

export function EditorView({
  onClose,
  onTestRun,
  playerNick,
  musicMuted,
  onToggleMusic,
  onNextMusicTrack,
  initialMap,
}: EditorViewProps) {
  const [localMaps, setLocalMaps] = useState<LocalMapEntry[]>(() => loadLocalMaps())
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    createInitialState(initialMap)
  )
  const [showJson, setShowJson] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showMapsModal, setShowMapsModal] = useState(false)
  const [showPrefabsModal, setShowPrefabsModal] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const author = playerNick.trim() || "не указано"

  useEffect(() => {
    if (state.map.metadata.author !== author) {
      dispatch({ type: "UPDATE_METADATA", metadata: { author } })
    }
  }, [author, state.map.metadata.author])

  useEffect(() => {
    saveEditorDraft(state.map)
    const updated = saveLocalMap(state.map)
    setLocalMaps(updated)
    setCurrentLocalMapId(state.map.id)
    if (state.isDirty) dispatch({ type: "MARK_SAVED" })
  }, [state.map, state.isDirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if (isEditingText) return

      const isCtrlOrMeta = event.ctrlKey || event.metaKey
      const isKeyZ =
        event.code === "KeyZ" || event.key.toLowerCase() === "z" || event.key.toLowerCase() === "я"
      const isKeyY =
        event.code === "KeyY" || event.key.toLowerCase() === "y" || event.key.toLowerCase() === "н"
      const isKeyC =
        event.code === "KeyC" || event.key.toLowerCase() === "c" || event.key.toLowerCase() === "с"
      const isKeyV =
        event.code === "KeyV" || event.key.toLowerCase() === "v" || event.key.toLowerCase() === "м"
      const isKeyA =
        event.code === "KeyA" || event.key.toLowerCase() === "a" || event.key.toLowerCase() === "ф"
      const isKeyI =
        event.code === "KeyI" || event.key.toLowerCase() === "i" || event.key.toLowerCase() === "ш"

      if (isCtrlOrMeta && isKeyA) {
        event.preventDefault()
        dispatch({ type: "SELECT_BLOCKS", blockIds: state.map.blocks.map((b) => b.id) })
      } else if (isCtrlOrMeta && isKeyI) {
        event.preventDefault()
        dispatch({ type: "INVERT_SELECTION" })
      } else if (isCtrlOrMeta && isKeyZ) {
        event.preventDefault()
        dispatch({ type: event.shiftKey ? "REDO" : "UNDO" })
      } else if (isCtrlOrMeta && isKeyY) {
        event.preventDefault()
        dispatch({ type: "REDO" })
      } else if (isCtrlOrMeta && isKeyC) {
        if (state.selectedBlockIds.length > 0) {
          event.preventDefault()
          dispatch({ type: "COPY_SELECTED" })
        }
      } else if (isCtrlOrMeta && isKeyV) {
        event.preventDefault()
        dispatch({ type: "START_PASTE" })
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (state.selectedBlockIds.length > 0) {
          event.preventDefault()
          dispatch({ type: "DELETE_SELECTED_BLOCKS" })
        }
      } else if (event.key === "Escape") {
        if (state.pastePhantom) {
          event.preventDefault()
          dispatch({ type: "CANCEL_PASTE" })
        } else if (showPrefabsModal) setShowPrefabsModal(false)
        else if (showMapsModal) setShowMapsModal(false)
        else if (showPublish) setShowPublish(false)
        else if (showJson) setShowJson(false)
        else if (state.selectedBlockIds.length > 0)
          dispatch({ type: "SELECT_BLOCKS", blockIds: [] })
        else onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    onClose,
    showJson,
    showMapsModal,
    showPrefabsModal,
    showPublish,
    state.map.blocks,
    state.selectedBlockIds,
    state.pastePhantom,
  ])

  const testRun = () => {
    const errors = validatePlayerMapSpec(state.map)
    if (errors.length > 0) {
      setRunError(
        `Исправьте ошибки карты перед запуском: ${errors
          .slice(0, 3)
          .map((error) => `${error.path}: ${error.message}`)
          .join("; ")}`
      )
      setShowJson(true)
      return
    }
    setRunError(null)
    onTestRun(state.map)
  }

  const handleSelectMap = (map: PlayerMapSpec) => {
    dispatch({ type: "SET_MAP", map, preserveHistory: false })
    setCurrentLocalMapId(map.id)
    saveEditorDraft(map)
  }

  const handleCreateMap = (map: PlayerMapSpec) => {
    const updated = saveLocalMap(map)
    setLocalMaps(updated)
    setCurrentLocalMapId(map.id)
    saveEditorDraft(map)
    dispatch({ type: "SET_MAP", map, preserveHistory: false })
  }

  const handleDeleteMap = (id: string) => {
    const updated = deleteLocalMap(id)
    setLocalMaps(updated)
    if (state.map.id === id) {
      const fallback = updated[0]?.spec ?? createDefaultMap()
      handleSelectMap(fallback)
    }
  }

  return (
    <section className="absolute inset-0 z-50 flex flex-col gap-3 overflow-hidden bg-abyss p-3 text-foam sm:p-5">
      <EditorToolbar
        dispatch={dispatch}
        musicMuted={musicMuted}
        onClose={onClose}
        onImportExport={() => setShowJson(true)}
        onNextMusicTrack={onNextMusicTrack}
        onOpenMaps={() => setShowMapsModal(true)}
        onOpenPrefabs={() => setShowPrefabsModal(true)}
        onPublish={() => setShowPublish(true)}
        onTestRun={testRun}
        onToggleMusic={onToggleMusic}
        publishingEnabled={LEADERBOARD_ENABLED}
        state={state}
      />
      {runError && (
        <p
          className="rounded-lg border border-punch/40 bg-punch/10 px-3 py-2 text-sm text-punch"
          role="alert"
        >
          {runError}
        </p>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <EditorCanvas className="min-h-64" dispatch={dispatch} state={state} />
        <EditorInspector author={author} dispatch={dispatch} state={state} />
      </div>
      {showJson && (
        <EditorJsonModal
          map={state.map}
          onClose={() => setShowJson(false)}
          onImport={(map) => {
            dispatch({ type: "SET_MAP", map, preserveHistory: true })
            setRunError(null)
            setShowJson(false)
          }}
        />
      )}
      {showPublish && LEADERBOARD_ENABLED && (
        <EditorPublishModal
          author={author}
          map={state.map}
          onClose={() => setShowPublish(false)}
          onImportMap={(map) => dispatch({ type: "SET_MAP", map, preserveHistory: true })}
        />
      )}
      {showMapsModal && (
        <EditorMapsModal
          currentMapId={state.map.id}
          maps={localMaps}
          onClose={() => setShowMapsModal(false)}
          onCreateMap={handleCreateMap}
          onDeleteMap={handleDeleteMap}
          onSelectMap={handleSelectMap}
        />
      )}
      {showPrefabsModal && (
        <EditorPrefabsModal
          dispatch={dispatch}
          onClose={() => setShowPrefabsModal(false)}
          state={state}
        />
      )}
    </section>
  )
}

function createInitialState(initialMap?: PlayerMapSpec | null): EditorState {
  if (initialMap) return createEditorState(initialMap)
  const localMaps = loadLocalMaps()
  const currentId = getCurrentLocalMapId()
  if (currentId) {
    const existing = localMaps.find((m) => m.id === currentId)
    if (existing) return createEditorState(existing.spec)
  }
  if (localMaps.length > 0 && localMaps[0]?.spec) {
    return createEditorState(localMaps[0].spec)
  }
  const defaultMap = createDefaultMap()
  saveLocalMap(defaultMap)
  return createEditorState(defaultMap)
}
