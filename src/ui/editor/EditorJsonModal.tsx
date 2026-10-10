import { useState } from "react"

import type { PlayerMapSpec } from "../../game/mapSpec"
import { validatePlayerMapSpec, type MapValidationError } from "../../game/mapValidator"

interface EditorJsonModalProps {
  map: PlayerMapSpec
  onImport: (map: PlayerMapSpec) => void
  onClose: () => void
}

export function EditorJsonModal({ map, onImport, onClose }: EditorJsonModalProps) {
  const [json, setJson] = useState(() => JSON.stringify(map, null, 2))
  const [errors, setErrors] = useState<MapValidationError[]>([])
  const [message, setMessage] = useState("")

  const importMap = () => {
    setErrors([])
    setMessage("")
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (error) {
      setMessage(
        error instanceof Error ? `Некорректный JSON: ${error.message}` : "Некорректный JSON."
      )
      return
    }
    if (!isPlayerMapShape(parsed)) {
      setMessage("Ожидается PlayerMapSpec версии 1 с metadata, blocks и winCondition.")
      return
    }
    try {
      const validationErrors = validatePlayerMapSpec(parsed)
      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        return
      }
      onImport(parsed)
    } catch {
      setMessage("Структура карты содержит поля неверного формата.")
    }
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(map, null, 2))
      setMessage("JSON карты скопирован в буфер обмена.")
    } catch {
      setJson(JSON.stringify(map, null, 2))
      setMessage("Не удалось скопировать автоматически. JSON карты помещён в поле для копирования.")
    }
  }

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <section
        aria-labelledby="editor-json-title"
        aria-modal="true"
        className="flex max-h-full w-full max-w-4xl flex-col gap-4 rounded-2xl border border-line bg-deep p-4 text-foam shadow-2xl sm:p-6"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="hud-label">IMPORT / EXPORT</p>
            <h2 className="font-display text-xl text-cyan-neon" id="editor-json-title">
              JSON карты
            </h2>
          </div>
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>
        <p className="text-sm text-dim">
          Экспортируйте карту или вставьте PlayerMapSpec версии 1. Импорт проверяется валидатором
          карт.
        </p>
        <textarea
          aria-label="JSON карты"
          className="min-h-48 flex-1 resize-y rounded-xl border border-line bg-abyss p-4 font-mono text-xs leading-5 text-foam outline-none focus:border-cyan-neon sm:min-h-80 sm:text-sm"
          onChange={(event) => {
            setJson(event.target.value)
            setErrors([])
            setMessage("")
          }}
          spellCheck={false}
          value={json}
        />
        {message && (
          <p
            className="rounded-lg border border-cyan-neon/40 bg-cyan-neon/10 p-3 text-sm text-cyan-neon"
            role="status"
          >
            {message}
          </p>
        )}
        {errors.length > 0 && (
          <ul
            aria-label="Ошибки валидации карты"
            className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-punch/40 bg-punch/10 p-3 text-sm text-punch"
            role="alert"
          >
            {errors.map((error, index) => (
              <li key={`${error.path}:${error.code}:${index}`}>
                <code>{error.path}</code>: {error.message}
              </li>
            ))}
          </ul>
        )}
        <footer className="flex flex-wrap justify-end gap-2">
          <button
            className="btn-ghost px-4 py-2 text-sm"
            onClick={() => void copyJson()}
            type="button"
          >
            Скопировать экспорт
          </button>
          <button
            className="btn-ghost px-4 py-2 text-sm"
            onClick={() => setJson(JSON.stringify(map, null, 2))}
            type="button"
          >
            Показать экспорт
          </button>
          <button className="btn-arcade px-5 py-2 text-sm" onClick={importMap} type="button">
            Импортировать
          </button>
        </footer>
      </section>
    </div>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPlayerMapShape(value: unknown): value is PlayerMapSpec {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== "string") return false
  if (!isRecord(value.metadata) || typeof value.metadata.title !== "string") return false
  if (!Array.isArray(value.blocks) || !isRecord(value.winCondition)) return false
  if (!value.blocks.every(isBlockShape)) return false
  const condition = value.winCondition
  return (
    condition.kind === "all-destructible" ||
    (condition.kind === "targets" &&
      Array.isArray(condition.targetIds) &&
      condition.targetIds.every((id) => typeof id === "string"))
  )
}

function isBlockShape(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isRecord(value.position) ||
    !isRecord(value.size)
  )
    return false
  return (
    typeof value.position.x === "number" &&
    typeof value.position.y === "number" &&
    typeof value.size.width === "number" &&
    typeof value.size.height === "number" &&
    (value.shape === "circle" || value.shape === "ellipse") &&
    typeof value.hp === "number"
  )
}
