import { useEffect, useState } from "react"

import { fetchMapStatus, requestMapEdit, type CustomMapRecord } from "../../game/customMapsApi"
import type { PlayerMapSpec } from "../../game/mapSpec"

import {
  createDefaultMap,
  deleteLocalMap,
  loadRecordForMap,
  projectUidForMap,
  savePublishedRecord,
  type LocalMapEntry,
} from "./localMapsStorage"
import { MapThumbnail } from "./MapThumbnail"

interface EditorMapsModalProps {
  currentMapId: string
  maps: LocalMapEntry[]
  onClose: () => void
  onSelectMap: (map: PlayerMapSpec) => void
  onCreateMap: (map: PlayerMapSpec) => void
  onDeleteMap: (id: string) => void
}

export function formatLocalDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "недавно"
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "недавно"
  }
}

interface StatusBadgeProps {
  record: CustomMapRecord | null
}

export function MapStatusBadge({ record }: StatusBadgeProps) {
  if (!record) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-dim/30 bg-abyss/80 px-2 py-0.5 text-xs text-dim">
        Черновик
      </span>
    )
  }

  if (record.edit_status === "approved") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-mint/60 bg-mint/15 px-2 py-0.5 text-xs font-medium text-mint"
        title="Модератор одобрил редактирование. Откройте карту и опубликуйте обновлённую версию"
      >
        🟢 Изменение согласовано
      </span>
    )
  }

  if (record.edit_status === "requested") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-gold/60 bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold"
        title="Изменения карты находятся на проверке у модератора"
      >
        ⏳ Изменения на проверке
      </span>
    )
  }

  if (record.status === "approved") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-cyan-neon/60 bg-cyan-neon/15 px-2 py-0.5 text-xs font-medium text-cyan-neon"
        title="Карта одобрена и опубликована в каталоге сообщества"
      >
        ✓ Принята
      </span>
    )
  }

  if (record.status === "rejected") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-punch/60 bg-punch/15 px-2 py-0.5 text-xs font-medium text-punch"
        title={record.reject_reason ? `Причина: ${record.reject_reason}` : "Отклонена модератором"}
      >
        ✕ Отклонена
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-gold/60 bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold"
      title="Карта находится на проверке у модератора"
    >
      ⏳ На проверке
    </span>
  )
}

export function EditorMapsModal({
  currentMapId,
  maps,
  onClose,
  onSelectMap,
  onCreateMap,
  onDeleteMap,
}: EditorMapsModalProps) {
  const [newTitle, setNewTitle] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [remoteRecords, setRemoteRecords] = useState<Record<string, CustomMapRecord>>({})
  const [requestEditMapEntry, setRequestEditMapEntry] = useState<LocalMapEntry | null>(null)
  const [editReasonText, setEditReasonText] = useState("")
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    for (const entry of maps) {
      const uid = projectUidForMap(entry.id)
      void fetchMapStatus({ mapUid: uid }).then((remote) => {
        if (!active || !remote) return
        savePublishedRecord(remote)
        setRemoteRecords((prev) => ({ ...prev, [uid]: remote }))
      })
    }
    return () => {
      active = false
    }
  }, [maps])

  const handleSendEditRequest = async () => {
    if (!requestEditMapEntry) return
    const uid = projectUidForMap(requestEditMapEntry.id)
    const rec = remoteRecords[uid] ?? loadRecordForMap(uid)
    if (!rec) return
    setSubmittingEdit(true)
    setEditError(null)
    try {
      await requestMapEdit(rec.id, {
        author_nick: rec.author_nick,
        reason: editReasonText.trim(),
        spec: requestEditMapEntry.spec,
        title: requestEditMapEntry.title,
        description: rec.description,
      })
      const updated: CustomMapRecord = {
        ...rec,
        edit_status: "requested",
        edit_request_reason: editReasonText.trim(),
      }
      savePublishedRecord(updated)
      setRemoteRecords((prev) => ({ ...prev, [uid]: updated }))
      setRequestEditMapEntry(null)
      setEditReasonText("")
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Не удалось отправить запрос")
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleCreate = () => {
    const title = newTitle.trim() || "Новая карта"
    const newMap = createDefaultMap(
      `map-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title
    )
    onCreateMap(newMap)
    setNewTitle("")
    setShowCreateForm(false)
  }

  const handleDelete = (id: string) => {
    deleteLocalMap(id)
    onDeleteMap(id)
    setConfirmDeleteId(null)
  }

  return (
    <div
      aria-label="Мои карты"
      aria-modal="true"
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 sm:p-6"
      role="dialog"
    >
      <section className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-deep text-foam shadow-2xl">
        <header className="flex items-center justify-between border-b border-line p-4 sm:p-5">
          <div>
            <p className="hud-label">LOCAL STORAGE</p>
            <h2 className="font-display text-xl text-cyan-neon sm:text-2xl">Мои карты</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-arcade px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
              onClick={() => setShowCreateForm(true)}
              type="button"
            >
              + Создать новую
            </button>
            <button
              aria-label="Закрыть"
              className="btn-ghost px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
        </header>

        {showCreateForm && (
          <div className="border-b border-line bg-abyss/80 p-4">
            <h3 className="mb-2 font-display text-sm text-cyan-neon">Создание новой карты</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                className="min-w-48 flex-1 rounded-lg border border-line bg-deep px-3 py-2 text-sm text-foam outline-none focus:border-cyan-neon"
                maxLength={60}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") setShowCreateForm(false)
                }}
                placeholder="Название карты"
                value={newTitle}
              />
              <button className="btn-arcade px-4 py-2 text-xs" onClick={handleCreate} type="button">
                Создать
              </button>
              <button
                className="btn-ghost px-3 py-2 text-xs"
                onClick={() => setShowCreateForm(false)}
                type="button"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {maps.length === 0 ? (
            <div className="py-12 text-center text-dim">
              <p className="text-base">У вас пока нет сохранённых карт.</p>
              <p className="mt-1 text-xs">Создайте новую карту или начните рисовать в редакторе.</p>
            </div>
          ) : (
            <ul className="space-y-3" role="list">
              {maps.map((entry) => {
                const isCurrent = entry.id === currentMapId
                const mapUid = projectUidForMap(entry.id)
                const record = remoteRecords[mapUid] ?? loadRecordForMap(mapUid)

                return (
                  <li
                    className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      isCurrent
                        ? "border-cyan-neon bg-cyan-neon/10 shadow-lg shadow-cyan-neon/10"
                        : "border-line bg-abyss/60 hover:border-line/80 hover:bg-abyss"
                    }`}
                    key={entry.id}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                      <MapThumbnail
                        alt={`Миниатюра ${entry.title}`}
                        className="h-16 w-28 shrink-0 rounded-lg sm:h-20 sm:w-36"
                        spec={entry.spec}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-display text-base text-foam sm:text-lg">
                            {entry.title || "Без названия"}
                          </h3>
                          {isCurrent && (
                            <span className="rounded bg-cyan-neon/20 px-2 py-0.5 text-2xs font-semibold text-cyan-neon">
                              Открыта сейчас
                            </span>
                          )}
                          <MapStatusBadge record={record} />
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
                          <span>Блоков: {entry.spec.blocks.length}</span>
                          <span>Изменена: {formatLocalDate(entry.updatedAt)}</span>
                          {record?.reject_reason && record.status === "rejected" && (
                            <span className="text-punch">
                              Причина отказа: {record.reject_reason}
                            </span>
                          )}
                          {record?.edit_request_reason &&
                            record.edit_status === "none" &&
                            record.edit_request_reason.startsWith("Отклонено:") && (
                              <span className="text-punch">{record.edit_request_reason}</span>
                            )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                      {record?.status === "approved" && record?.edit_status !== "requested" && (
                        <button
                          className="btn-ghost px-2.5 py-1.5 text-xs text-gold sm:px-3 sm:py-2"
                          onClick={() => {
                            setRequestEditMapEntry(entry)
                            setEditReasonText("")
                            setEditError(null)
                          }}
                          title="Запросить изменение опубликованной карты"
                          type="button"
                        >
                          ✎ Запросить изменение
                        </button>
                      )}
                      <button
                        className={`px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm ${
                          isCurrent ? "btn-ghost" : "btn-arcade"
                        }`}
                        onClick={() => {
                          onSelectMap(entry.spec)
                          onClose()
                        }}
                        type="button"
                      >
                        {isCurrent ? "Продолжить" : "Редактировать"}
                      </button>

                      {confirmDeleteId === entry.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            className="rounded-lg bg-punch px-2.5 py-1 text-xs font-semibold text-foam hover:bg-punch/80"
                            onClick={() => handleDelete(entry.id)}
                            type="button"
                          >
                            Да, удалить
                          </button>
                          <button
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                            type="button"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <button
                          aria-label={`Удалить карту ${entry.title}`}
                          className="btn-ghost px-2.5 py-1.5 text-xs text-dim hover:border-punch/50 hover:text-punch"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          title="Удалить карту"
                          type="button"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {requestEditMapEntry && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md space-y-4 rounded-xl border border-line bg-deep p-5 text-foam shadow-2xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg text-gold">Запрос изменения карты</h3>
                  <p className="text-xs text-dim">«{requestEditMapEntry.title}»</p>
                </div>
                <button
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => {
                    setRequestEditMapEntry(null)
                    setEditReasonText("")
                    setEditError(null)
                  }}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <MapThumbnail className="h-28 w-full" spec={requestEditMapEntry.spec} />

              <label className="block space-y-1 text-xs">
                <span>Что вы хотите изменить (комментарий для модератора)</span>
                <textarea
                  className="min-h-20 w-full resize-y rounded-lg border border-line bg-abyss p-2.5 text-sm text-foam outline-none focus:border-gold"
                  maxLength={300}
                  onChange={(e) => setEditReasonText(e.target.value)}
                  placeholder="Например: исправил застревание шара, изменил расстановку блоков"
                  value={editReasonText}
                />
              </label>

              {editError && (
                <p className="rounded border border-punch/50 bg-punch/10 p-2 text-xs text-punch">
                  {editError}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  className="btn-ghost px-3 py-2 text-xs"
                  onClick={() => {
                    onSelectMap(requestEditMapEntry.spec)
                    setRequestEditMapEntry(null)
                    onClose()
                  }}
                  type="button"
                >
                  Перейти в редактор
                </button>
                <button
                  className="btn-arcade px-4 py-2 text-xs"
                  disabled={submittingEdit || editReasonText.trim().length < 3}
                  onClick={() => void handleSendEditRequest()}
                  type="button"
                >
                  {submittingEdit ? "Отправка..." : "Отправить на проверку"}
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="flex items-center justify-between border-t border-line bg-abyss/40 p-4 text-xs text-dim">
          <span>Всего карт: {maps.length}</span>
          <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onClose} type="button">
            Закрыть
          </button>
        </footer>
      </section>
    </div>
  )
}
