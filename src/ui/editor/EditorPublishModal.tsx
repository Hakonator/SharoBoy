import { useEffect, useState } from "react"

import {
  fetchMapStatus,
  publishCustomMap,
  updateMapSpec,
  type CustomMapRecord,
} from "../../game/customMapsApi"
import type { PlayerMapSpec } from "../../game/mapSpec"
import { containsProfanity } from "../../game/profanity"
import { validatePlayerMapSpec, type MapValidationError } from "../../game/mapValidator"

interface EditorPublishModalProps {
  map: PlayerMapSpec
  author: string
  onClose: () => void
  onImportMap: (map: PlayerMapSpec) => void
}

import { loadRecordForMap, projectUidForMap, savePublishedRecord } from "./localMapsStorage"
import { MapThumbnail } from "./MapThumbnail"

export function EditorPublishModal({ map, author, onClose, onImportMap }: EditorPublishModalProps) {
  const [title, setTitle] = useState(map.metadata.title)
  const [description, setDescription] = useState(map.metadata.description ?? "")
  const [errors, setErrors] = useState<MapValidationError[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [json, setJson] = useState("")
  const [showJson, setShowJson] = useState(false)
  const mapUid = projectUidForMap(map.id)
  const [record, setRecord] = useState<CustomMapRecord | null>(() => loadRecordForMap(mapUid))

  useEffect(() => {
    let active = true
    void fetchMapStatus({ mapUid }).then((remote) => {
      if (!active || !remote) return
      setRecord(remote)
      savePublishedRecord(remote)
    })
    return () => {
      active = false
    }
  }, [mapUid])

  const submit = async () => {
    setErrors([])
    setMessage(null)
    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    const validationErrors = validatePlayerMapSpec(map)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    if (cleanTitle.length < 2 || cleanTitle.length > 60) {
      setMessage("Название карты должно содержать от 2 до 60 символов.")
      return
    }
    if (containsProfanity(cleanTitle)) {
      setMessage("Название содержит недопустимые выражения. Выберите другое название.")
      return
    }
    if (cleanDescription.length > 300) {
      setMessage("Описание карты не может быть длиннее 300 символов.")
      return
    }
    setSubmitting(true)
    try {
      const updated =
        record?.edit_status === "approved"
          ? await updateMapSpec(record.id, {
              spec: map,
              title: cleanTitle,
              description: cleanDescription,
            })
          : await publishCustomMap({
              title: cleanTitle,
              description: cleanDescription,
              author_nick: author,
              map_uid: mapUid,
              spec: map,
            })
      setRecord(updated)
      savePublishedRecord(updated)
      setMessage(
        record?.edit_status === "approved"
          ? "Обновление отправлено и опубликовано с сохранением статистики."
          : "Карта отправлена на модерацию! Повторная отправка этой карты заблокирована."
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Не удалось отправить карту на модерацию."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const importJson = () => {
    try {
      const parsed: unknown = JSON.parse(json)
      const candidate = parsed as PlayerMapSpec
      const errors = validatePlayerMapSpec(candidate)
      if (errors.length > 0) {
        setErrors(errors)
        return
      }
      if (typeof parsed === "object" && parsed !== null) {
        onImportMap(candidate)
        setMessage("JSON проверен. Нажмите отправку, чтобы сохранить изменения.")
        setErrors([])
      }
    } catch {
      setMessage("Некорректный JSON карты.")
    }
  }

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <section
        aria-labelledby="editor-publish-title"
        aria-modal="true"
        className="w-full max-w-xl space-y-4 rounded-2xl border border-line bg-deep p-5 text-foam shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="hud-label">COMMUNITY MAPS</p>
            <h2 className="font-display text-xl text-cyan-neon" id="editor-publish-title">
              {record?.edit_status === "approved" ? "Обновить карту" : "Опубликовать карту"}
            </h2>
          </div>
          <button
            className="btn-ghost px-4 py-2 text-sm"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            Закрыть
          </button>
        </header>
        <MapThumbnail className="h-28 w-full rounded-xl sm:h-36" spec={map} />
        <label className="block space-y-1 text-sm">
          <span>Название карты</span>
          <input
            aria-label="Название карты"
            className="w-full rounded-lg border border-line bg-abyss px-3 py-2 text-foam outline-none focus:border-cyan-neon"
            maxLength={60}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Описание</span>
          <textarea
            aria-label="Описание карты"
            className="min-h-24 w-full resize-y rounded-lg border border-line bg-abyss px-3 py-2 text-foam outline-none focus:border-cyan-neon"
            maxLength={300}
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
        <label className="block space-y-1 text-sm text-dim">
          <span>Автор</span>
          <input
            aria-label="Автор"
            className="w-full cursor-not-allowed rounded-lg border border-line bg-abyss/60 px-3 py-2 text-dim"
            readOnly
            value={author}
          />
        </label>
        {message && (
          <p
            className="rounded-lg border border-cyan-neon/40 bg-cyan-neon/10 p-3 text-sm text-cyan-neon"
            role="status"
          >
            {message}
          </p>
        )}
        {record?.status === "pending" && (
          <p
            className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-gold"
            role="status"
          >
            ⏳ На проверке — повторная отправка заблокирована.
          </p>
        )}
        {record?.status === "approved" && record?.edit_status !== "approved" && (
          <p
            className="rounded-lg border border-cyan-neon/40 bg-cyan-neon/10 p-3 text-sm text-cyan-neon"
            role="status"
          >
            ✓ Карта опубликована в каталоге сообщества.
          </p>
        )}
        {record?.status === "rejected" && (
          <p
            className="rounded-lg border border-punch/40 bg-punch/10 p-3 text-sm text-punch"
            role="status"
          >
            ✕ Отклонена модератором{record.reject_reason ? `: ${record.reject_reason}` : ""}
          </p>
        )}
        {record?.edit_status === "approved" && (
          <p
            className="rounded-lg border border-mint/40 bg-mint/10 p-3 text-sm text-mint"
            role="status"
          >
            🟢 Одобрено для внесения изменений
          </p>
        )}
        {errors.length > 0 && (
          <ul
            aria-label="Ошибки валидации карты"
            className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-punch/40 bg-punch/10 p-3 text-sm text-punch"
            role="alert"
          >
            {errors.map((error, index) => (
              <li key={`${error.path}:${index}`}>
                <code>{error.path}</code>: {error.message}
              </li>
            ))}
          </ul>
        )}
        <footer className="flex justify-end gap-2">
          <button
            className="btn-ghost px-4 py-2 text-sm"
            onClick={() => {
              setShowJson((value) => !value)
              setJson(JSON.stringify(map, null, 2))
            }}
            type="button"
          >
            {showJson ? "Скрыть JSON" : "Вставить готовый JSON"}
          </button>
          <button
            className="btn-ghost px-4 py-2 text-sm"
            disabled={submitting || record?.status === "pending"}
            onClick={onClose}
            type="button"
          >
            Отмена
          </button>
          <button
            className="btn-arcade px-5 py-2 text-sm"
            disabled={submitting}
            onClick={() => void submit()}
            type="button"
          >
            {submitting
              ? "Отправка..."
              : record?.edit_status === "approved"
                ? "🚀 Отправить обновление"
                : "🚀 Отправить"}
          </button>
        </footer>
        {showJson && (
          <div className="space-y-2 rounded-lg border border-line bg-abyss p-3">
            <textarea
              className="min-h-40 w-full border border-line bg-deep p-2 font-mono text-xs text-foam outline-none"
              onChange={(event) => setJson(event.target.value)}
              value={json}
            />
            <button className="btn-ghost px-3 py-2 text-sm" onClick={importJson} type="button">
              Проверить и подставить JSON
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
