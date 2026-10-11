import { useState } from "react"

import { publishCustomMap } from "../../game/customMapsApi"
import type { PlayerMapSpec } from "../../game/mapSpec"
import { containsProfanity } from "../../game/profanity"
import { validatePlayerMapSpec, type MapValidationError } from "../../game/mapValidator"

interface EditorPublishModalProps {
  map: PlayerMapSpec
  author: string
  onClose: () => void
}

export function EditorPublishModal({ map, author, onClose }: EditorPublishModalProps) {
  const [title, setTitle] = useState(map.metadata.title)
  const [description, setDescription] = useState(map.metadata.description ?? "")
  const [errors, setErrors] = useState<MapValidationError[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      await publishCustomMap({
        title: cleanTitle,
        description: cleanDescription,
        author_nick: author,
        spec: map,
      })
      setMessage(
        "Карта отправлена на модерацию! Она появится в общем каталоге после проверки администратором."
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Не удалось отправить карту на модерацию."
      )
    } finally {
      setSubmitting(false)
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
              Опубликовать карту
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
            disabled={submitting}
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
            {submitting ? "Отправка на модерацию..." : "🚀 Отправить"}
          </button>
        </footer>
      </section>
    </div>
  )
}
