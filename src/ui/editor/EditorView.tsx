import { useEffect, useReducer, useState } from "react"

import type { PlayerMapSpec } from "../../game/mapSpec"
import { validatePlayerMapSpec } from "../../game/mapValidator"

import { EditorCanvas } from "./EditorCanvas"
import { EditorInspector } from "./EditorInspector"
import { EditorJsonModal } from "./EditorJsonModal"
import { createEditorState, editorReducer, loadEditorDraft, saveEditorDraft } from "./editorState"
import { EditorToolbar } from "./EditorToolbar"
import type { EditorState } from "./types"

const DEFAULT_MAP: PlayerMapSpec = {
  version: 1,
  id: "custom-map",
  metadata: { title: "Новая карта" },
  blocks: [
    {
      id: "block-1",
      position: { x: 960, y: 300 },
      shape: "ellipse",
      size: { width: 80, height: 44 },
      hp: 1,
    },
    {
      id: "block-2",
      position: { x: 860, y: 380 },
      shape: "circle",
      size: { width: 52, height: 52 },
      hp: 2,
    },
    {
      id: "block-3",
      position: { x: 1060, y: 380 },
      shape: "ellipse",
      size: { width: 72, height: 42 },
      hp: 3,
    },
  ],
  winCondition: { kind: "all-destructible" },
}

interface EditorViewProps {
  onClose: () => void
  onTestRun: (map: PlayerMapSpec) => void
}

export function EditorView({ onClose, onTestRun }: EditorViewProps) {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState)
  const [showJson, setShowJson] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    saveEditorDraft(state.map)
    if (state.isDirty) dispatch({ type: "MARK_SAVED" })
  }, [state.map, state.isDirty])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const isEditingText =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if (isEditingText) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        dispatch({ type: event.shiftKey ? "REDO" : "UNDO" })
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault()
        dispatch({ type: "REDO" })
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (state.selectedBlockIds.length > 0) {
          event.preventDefault()
          dispatch({ type: "COPY_SELECTED" })
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault()
        dispatch({ type: "PASTE_CLIPBOARD" })
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (state.selectedBlockIds.length > 0) {
          event.preventDefault()
          dispatch({ type: "DELETE_SELECTED_BLOCKS" })
        }
      } else if (event.key === "Escape") {
        if (showJson) setShowJson(false)
        else if (state.selectedBlockIds.length > 0)
          dispatch({ type: "SELECT_BLOCKS", blockIds: [] })
        else onClose()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, showJson, state.selectedBlockIds])

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

  return (
    <section className="absolute inset-0 z-50 flex flex-col gap-3 overflow-hidden bg-abyss p-3 text-foam sm:p-5">
      <EditorToolbar
        dispatch={dispatch}
        onClose={onClose}
        onImportExport={() => setShowJson(true)}
        onTestRun={testRun}
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
        <EditorInspector dispatch={dispatch} state={state} />
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
    </section>
  )
}

function createInitialState(): EditorState {
  return createEditorState(loadEditorDraft() ?? DEFAULT_MAP)
}
