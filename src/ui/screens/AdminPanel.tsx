import { useCallback, useEffect, useState } from "react"

import type { CustomMapRecord } from "../../game/customMapsApi"
import {
  adminLogin,
  adminLogout,
  approveMap,
  approveMapEdit,
  fetchEditRequests,
  fetchPendingMaps,
  getAdminToken,
  rejectMap,
} from "../../game/adminMapsApi"
import type { PlayerMapSpec } from "../../game/mapSpec"
import { MapThumbnail } from "../editor/MapThumbnail"

export interface AdminPanelProps {
  onBack: () => void
  onTestRun: (map: PlayerMapSpec) => void
}

export function formatAdminDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "дата неизвестна" : date.toLocaleDateString("ru-RU")
}

function Preview({ map }: { map: CustomMapRecord }) {
  return <MapThumbnail alt="Предпросмотр карты" className="w-full" spec={map.spec_json} />
}

export function AdminPanel({ onBack, onTestRun }: AdminPanelProps) {
  const [token, setToken] = useState<string | null>(getAdminToken)
  const [password, setPassword] = useState("")
  const [maps, setMaps] = useState<CustomMapRecord[]>([])
  const [editRequests, setEditRequests] = useState<CustomMapRecord[]>([])
  const [view, setView] = useState<"pending" | "edits">("pending")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (currentToken: string) => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchPendingMaps(currentToken)
      const edits = await fetchEditRequests(currentToken)
      setMaps(next)
      setEditRequests(edits)
      setSelectedId((current) =>
        next.some((map) => map.id === current) ? current : (next[0]?.id ?? null)
      )
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось загрузить очередь.")
      setToken(null)
      adminLogout()
    } finally {
      setLoading(false)
    }
  }, [])

  const approveEdit = async (map: CustomMapRecord) => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      await approveMapEdit(token, map.id)
      await load(token)
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось одобрить редактирование.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (token) void load(token)
  }, [load, token])

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const nextToken = await adminLogin(password)
      setPassword("")
      setToken(nextToken)
    } catch (value) {
      setError(value instanceof Error ? value.message : "Неверный пароль.")
    } finally {
      setBusy(false)
    }
  }

  const decide = async (map: CustomMapRecord, decision: "approve" | "reject") => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      if (decision === "approve") await approveMap(token, map.id)
      else {
        if (!reason.trim()) {
          setError("Укажите причину отклонения.")
          return
        }
        await rejectMap(token, map.id, reason)
      }
      setReason("")
      setRejectingId(null)
      await load(token)
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось изменить статус карты.")
    } finally {
      setBusy(false)
    }
  }

  const selected = maps.find((map) => map.id === selectedId) ?? null

  return (
    <section className="absolute inset-0 z-50 overflow-y-auto bg-abyss p-4 text-foam sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="hud-label">MODERATION</p>
            <h1 className="font-display text-3xl text-gold sm:text-5xl">Панель модерации</h1>
          </div>
          <div className="flex gap-2">
            {token && (
              <button
                className="btn-ghost px-4 py-2"
                disabled={busy}
                onClick={() => {
                  adminLogout()
                  setToken(null)
                  setMaps([])
                }}
                type="button"
              >
                Выйти
              </button>
            )}
            <button className="btn-ghost px-4 py-2" onClick={onBack} type="button">
              ← В меню
            </button>
          </div>
        </header>

        {!token ? (
          <form
            className="mx-auto max-w-sm rounded-xl border border-line bg-deep/90 p-6"
            onSubmit={(event) => void login(event)}
          >
            <h2 className="font-display text-xl text-foam">Вход администратора</h2>
            <p className="mt-2 text-sm text-dim">Секретный пароль хранится только на сервере.</p>
            <input
              autoFocus
              className="mt-5 w-full border border-line bg-abyss px-3 py-3 text-foam outline-none focus:border-gold"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Пароль"
              type="password"
              value={password}
            />
            {error && (
              <p className="mt-3 text-sm text-punch" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn-arcade mt-5 w-full px-4 py-3"
              disabled={busy || !password}
              type="submit"
            >
              {busy ? "Проверка…" : "Войти"}
            </button>
          </form>
        ) : (
          <>
            {error && (
              <p
                className="mb-4 rounded border border-punch/50 bg-punch/10 p-3 text-sm text-punch"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="mb-4 flex gap-2">
              <button
                className={`btn-ghost px-4 py-2 text-sm ${view === "pending" ? "text-gold" : ""}`}
                onClick={() => setView("pending")}
                type="button"
              >
                Очередь карт ({maps.length})
              </button>
              <button
                className={`btn-ghost px-4 py-2 text-sm ${view === "edits" ? "text-gold" : ""}`}
                onClick={() => setView("edits")}
                type="button"
              >
                Запросы на редактирование ({editRequests.length})
              </button>
            </div>
            {view === "edits" ? (
              editRequests.length === 0 ? (
                <p className="rounded-xl border border-line bg-deep/80 p-8 text-center text-dim">
                  Запросов на редактирование нет.
                </p>
              ) : (
                <div className="space-y-3">
                  {editRequests.map((map) => (
                    <article className="rounded-xl border border-line bg-deep/90 p-4" key={map.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl text-foam">{map.title}</h2>
                          <p className="text-sm text-cyan-neon">Автор: {map.author_nick}</p>
                        </div>
                        <button
                          className="btn-arcade px-4 py-2 text-sm"
                          disabled={busy}
                          onClick={() => void approveEdit(map)}
                          type="button"
                        >
                          ✓ Одобрить редактирование
                        </button>
                      </div>
                      <p className="mt-3 rounded border border-gold/30 bg-gold/10 p-3 text-sm text-gold">
                        Причина: {map.edit_request_reason || "не указана"}
                      </p>
                    </article>
                  ))}
                </div>
              )
            ) : loading ? (
              <p className="py-10 text-center text-dim">Загрузка очереди…</p>
            ) : maps.length === 0 ? (
              <p className="rounded-xl border border-line bg-deep/80 p-8 text-center text-dim">
                Очередь модерации пуста.
              </p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <div className="space-y-2">
                  {maps.map((map) => (
                    <button
                      className={`w-full rounded-lg border p-3 text-left ${map.id === selectedId ? "border-gold bg-gold/10" : "border-line bg-deep/80"}`}
                      key={map.id}
                      onClick={() => setSelectedId(map.id)}
                      type="button"
                    >
                      <div className="flex justify-between gap-2">
                        <strong className="truncate font-display">{map.title}</strong>
                        <span className="text-xs text-dim">{formatAdminDate(map.created_at)}</span>
                      </div>
                      <div className="mt-1 text-xs text-cyan-neon">
                        {map.author_nick} · {map.spec_json.blocks.length} блоков
                      </div>
                      <p className="mt-1 truncate text-xs text-dim">
                        {map.description || "Без описания"}
                      </p>
                    </button>
                  ))}
                </div>
                {selected && (
                  <article className="rounded-xl border border-line bg-deep/90 p-4">
                    <div className="mb-3 flex flex-wrap justify-between gap-2">
                      <div>
                        <h2 className="font-display text-2xl text-foam">{selected.title}</h2>
                        <p className="text-sm text-cyan-neon">
                          Автор: {selected.author_nick} · {formatAdminDate(selected.created_at)}
                        </p>
                      </div>
                      <span className="text-xs text-dim">pending</span>
                    </div>
                    <p className="mb-4 text-sm text-dim">
                      {selected.description || "Без описания"}
                    </p>
                    <Preview map={selected} />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="btn-ghost px-4 py-2"
                        disabled={busy}
                        onClick={() => onTestRun(selected.spec_json)}
                        type="button"
                      >
                        ▶ Протестировать карту
                      </button>
                      <button
                        className="btn-arcade px-4 py-2"
                        disabled={busy}
                        onClick={() => void decide(selected, "approve")}
                        type="button"
                      >
                        ✓ Одобрить
                      </button>
                      <button
                        className="btn-ghost px-4 py-2 text-punch"
                        disabled={busy}
                        onClick={() => setRejectingId(selected.id)}
                        type="button"
                      >
                        ✕ Отклонить
                      </button>
                    </div>
                    {rejectingId === selected.id && (
                      <div className="mt-4 border-t border-line pt-4">
                        <label className="hud-label" htmlFor="reject-reason">
                          Причина отклонения
                        </label>
                        <textarea
                          className="mt-2 min-h-20 w-full border border-line bg-abyss p-3 text-sm text-foam outline-none focus:border-punch"
                          id="reject-reason"
                          maxLength={300}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Например: непроходимый уровень"
                          value={reason}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            className="btn-ghost px-3 py-2"
                            onClick={() => setRejectingId(null)}
                            type="button"
                          >
                            Отмена
                          </button>
                          <button
                            className="btn-ghost px-3 py-2 text-punch"
                            disabled={busy || !reason.trim()}
                            onClick={() => void decide(selected, "reject")}
                            type="button"
                          >
                            Подтвердить отклонение
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
