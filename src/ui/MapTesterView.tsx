import { useState } from "react"

import type { PlayerMapSpec } from "../game/mapSpec"
import { validatePlayerMapSpec, type MapValidationError } from "../game/mapValidator"

const EXAMPLE_MAP: PlayerMapSpec = {
  version: 1,
  id: "sandbox-example",
  metadata: { title: "Тестовая карта" },
  blocks: [
    {
      id: "block-1",
      position: { x: 960, y: 300 },
      shape: "ellipse",
      size: { width: 80, height: 40 },
      hp: 1,
    },
  ],
  winCondition: { kind: "all-destructible" },
}

interface MapTesterViewProps {
  onPlay: (spec: PlayerMapSpec) => void
  onClose: () => void
  initialJson?: string
}

export function MapTesterView({ onPlay, onClose, initialJson }: MapTesterViewProps) {
  const [json, setJson] = useState(() => initialJson ?? JSON.stringify(EXAMPLE_MAP, null, 2))
  const [errors, setErrors] = useState<MapValidationError[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [validSpec, setValidSpec] = useState<PlayerMapSpec | null>(null)

  const checkMap = () => {
    setParseError(null)
    setErrors([])
    setValidSpec(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Некорректный JSON.")
      return
    }

    if (!isPlayerMapShape(parsed)) {
      setParseError("Ожидается объект карты версии 1 с metadata, blocks и winCondition.")
      return
    }

    try {
      const validationErrors = validatePlayerMapSpec(parsed)
      setErrors(validationErrors)
      if (validationErrors.length === 0) setValidSpec(parsed)
    } catch {
      setErrors([
        {
          path: "$",
          code: "INVALID_NUMBER",
          message: "Структура карты содержит поля неверного формата.",
        },
      ])
    }
  }

  return (
    <section className="absolute inset-0 z-50 flex flex-col overflow-y-auto bg-deep/95 p-4 text-foam sm:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="hud-label">DEV SANDBOX</p>
            <h1 className="font-display text-3xl text-cyan-neon sm:text-4xl">Тестер карт</h1>
          </div>
          <button className="btn-ghost shrink-0 px-4 py-2" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>

        <p className="text-sm text-dim">
          Вставьте JSON карты формата PlayerMapSpec. Можно начать с примера и изменить его.
        </p>

        <label className="flex min-h-64 flex-1 flex-col gap-2">
          <span className="hud-label">JSON карты</span>
          <textarea
            aria-label="JSON карты"
            className="min-h-64 flex-1 touch-pan-y resize-y select-text rounded-xl border border-line bg-ink p-4 font-mono text-xs leading-5 text-foam outline-none focus:border-cyan-neon sm:text-sm"
            spellCheck={false}
            value={json}
            onChange={(event) => {
              setJson(event.target.value)
              setErrors([])
              setParseError(null)
              setValidSpec(null)
            }}
          />
        </label>

        {parseError && (
          <p
            className="rounded-lg border border-punch/50 bg-punch/10 p-3 text-sm text-punch"
            role="alert"
          >
            Ошибка JSON: {parseError}
          </p>
        )}

        {errors.length > 0 && (
          <ul
            className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-punch/50 bg-punch/10 p-3 text-sm text-punch"
            aria-label="Ошибки карты"
            role="alert"
          >
            {errors.map((error, index) => (
              <li key={`${error.path}:${error.code}:${index}`}>
                <code>{error.path}</code>: {error.message}
              </li>
            ))}
          </ul>
        )}

        {validSpec && (
          <p
            className="rounded-lg border border-cyan-neon/50 bg-cyan-neon/10 p-3 text-sm text-cyan-neon"
            role="status"
          >
            Карта прошла проверку. Блоков: {validSpec.blocks.length}.
          </p>
        )}

        <footer className="flex flex-wrap justify-end gap-3 pb-2">
          <button className="btn-ghost px-4 py-2" onClick={checkMap} type="button">
            Проверить
          </button>
          <button
            className="btn-arcade px-5 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!validSpec}
            onClick={() => validSpec && onPlay(validSpec)}
            type="button"
          >
            Играть
          </button>
        </footer>
      </div>
    </section>
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPlayerMapShape(value: unknown): value is PlayerMapSpec {
  if (!isRecord(value) || value.version !== 1 || typeof value.id !== "string") return false
  if (!isRecord(value.metadata) || typeof value.metadata.title !== "string") return false
  if (!Array.isArray(value.blocks) || !isRecord(value.winCondition)) return false

  const condition = value.winCondition
  if (condition.kind === "all-destructible") return true
  return (
    condition.kind === "targets" &&
    Array.isArray(condition.targetIds) &&
    condition.targetIds.every((id: unknown) => typeof id === "string")
  )
}
