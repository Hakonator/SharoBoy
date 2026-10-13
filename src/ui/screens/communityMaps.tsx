import { useCallback, useEffect, useState } from "react"

import { LEADERBOARD_ENABLED } from "../../config"
import {
  fetchApprovedMaps,
  getVoterId,
  humanizeMapsApiError,
  voteMap,
  type CustomMapRecord,
} from "../../game/customMapsApi"
import type { PlayerMapSpec } from "../../game/mapSpec"
import { saveLocalMap, setCurrentLocalMapId } from "../editor/localMapsStorage"
import { MapThumbnail } from "../editor/MapThumbnail"

type CommunityMapsSort = "popular" | "newest"

const LIKED_MAPS_KEY = "sharoboy-liked-community-maps"

export interface CommunityMapsProps {
  onBack: () => void
  onPlay: (spec: PlayerMapSpec) => void
  onEditCopy?: (spec: PlayerMapSpec) => void
}

export function formatMapDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "дата неизвестна"
    : date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
}

export function mapWinConditionLabel(map: CustomMapRecord): string {
  return map.spec_json.winCondition.kind === "targets" ? "Цели" : "Все блоки"
}

function loadLikedMaps(): Set<string> {
  try {
    const stored = localStorage.getItem(LIKED_MAPS_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
    )
  } catch {
    return new Set()
  }
}

function saveLikedMaps(ids: Set<string>): void {
  try {
    localStorage.setItem(LIKED_MAPS_KEY, JSON.stringify([...ids]))
  } catch {
    /* Private browsing can disable localStorage; the current session still works. */
  }
}

export function CommunityMaps({ onBack, onPlay, onEditCopy }: CommunityMapsProps) {
  const [sort, setSort] = useState<CommunityMapsSort>("popular")
  const [search, setSearch] = useState("")
  const [maps, setMaps] = useState<CustomMapRecord[]>([])
  const [likedMaps, setLikedMaps] = useState<Set<string>>(loadLikedMaps)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [likingId, setLikingId] = useState<string | null>(null)
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null)

  const loadMaps = useCallback(async () => {
    if (!LEADERBOARD_ENABLED) return
    setLoading(true)
    setError(null)
    try {
      setMaps(await fetchApprovedMaps({ sort, search, limit: 50 }))
    } catch (reason) {
      setError(
        humanizeMapsApiError(
          reason,
          "Не удалось загрузить каталог карт. Сервер временно недоступен."
        )
      )
    } finally {
      setLoading(false)
    }
  }, [search, sort])

  useEffect(() => {
    void loadMaps()
  }, [loadMaps])

  const like = async (map: CustomMapRecord) => {
    if (likedMaps.has(map.id) || likingId) return
    setLikingId(map.id)
    try {
      await voteMap(map.id, getVoterId())
      const next = new Set(likedMaps)
      next.add(map.id)
      setLikedMaps(next)
      saveLikedMaps(next)
      setMaps((current) =>
        current.map((item) =>
          item.id === map.id ? { ...item, likes_count: item.likes_count + 1 } : item
        )
      )
    } catch (reason) {
      setError(
        humanizeMapsApiError(reason, "Не удалось поставить лайк. Сервер временно недоступен.")
      )
    } finally {
      setLikingId(null)
    }
  }

  const handleCopyMap = (map: CustomMapRecord) => {
    const newId = `map-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const baseTitle = map.spec_json.metadata.title || map.title
    const copyTitle = `${baseTitle} (копия)`.slice(0, 60)
    const clonedSpec: PlayerMapSpec = {
      ...map.spec_json,
      id: newId,
      metadata: {
        ...map.spec_json.metadata,
        title: copyTitle,
      },
    }
    saveLocalMap(clonedSpec)
    setCurrentLocalMapId(newId)
    if (onEditCopy) {
      onEditCopy(clonedSpec)
    } else {
      setCopiedNotice(`Копия «${copyTitle}» добавлена в ваши карты!`)
      setTimeout(() => setCopiedNotice(null), 4000)
    }
  }

  return (
    <section className="absolute inset-0 z-50 overflow-y-auto bg-abyss p-4 text-foam sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="hud-label">COMMUNITY HUB</p>
            <h1 className="font-display text-3xl text-cyan-neon sm:text-5xl">Карты сообщества</h1>
          </div>
          <button className="btn-ghost px-5 py-2.5" onClick={onBack} type="button">
            ← В меню
          </button>
        </header>

        {!LEADERBOARD_ENABLED ? (
          <div className="hud-chip p-6 text-center text-dim">
            Каталог карт недоступен: подключение Supabase не настроено.
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-deep/80 p-3">
              <div className="flex gap-1" role="tablist" aria-label="Сортировка карт">
                {(["popular", "newest"] as CommunityMapsSort[]).map((value) => (
                  <button
                    aria-selected={sort === value}
                    className={`rounded border px-3 py-2 text-sm ${sort === value ? "border-cyan-neon bg-cyan-neon/15 text-cyan-neon" : "border-line text-dim"}`}
                    key={value}
                    onClick={() => setSort(value)}
                    role="tab"
                    type="button"
                  >
                    {value === "popular" ? "Популярные" : "Новые"}
                  </button>
                ))}
              </div>
              <input
                aria-label="Поиск карт"
                className="min-w-48 flex-1 rounded border border-line bg-abyss px-3 py-2 text-sm text-foam outline-none focus:border-cyan-neon"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Название или автор"
                value={search}
              />
              <button
                className="btn-ghost px-4 py-2 text-sm"
                disabled={loading}
                onClick={() => void loadMaps()}
                type="button"
              >
                ↻ Обновить
              </button>
            </div>

            {error && (
              <div
                className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-punch/50 bg-punch/10 p-3 text-sm text-punch"
                role="alert"
              >
                <span>{error}</span>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => void loadMaps()}
                  type="button"
                >
                  Повторить
                </button>
              </div>
            )}
            {copiedNotice && (
              <div
                className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-mint/50 bg-mint/10 p-3 text-sm text-mint"
                role="status"
              >
                <span>{copiedNotice}</span>
                <button
                  className="btn-ghost px-2 py-1 text-xs"
                  onClick={() => setCopiedNotice(null)}
                  type="button"
                >
                  ✕
                </button>
              </div>
            )}
            {loading && (
              <p className="py-10 text-center text-dim" role="status">
                Загрузка карт…
              </p>
            )}
            {!loading && !error && maps.length === 0 && (
              <p className="py-10 text-center text-dim">Одобренных карт пока нет.</p>
            )}
            {!loading && maps.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {maps.map((map) => (
                  <article
                    className="flex flex-col rounded-xl border border-line bg-deep/90 p-4 shadow-lg"
                    key={map.id}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h2
                        className="min-w-0 truncate font-display text-lg text-foam"
                        title={map.title}
                      >
                        {map.title}
                      </h2>
                      <span className="shrink-0 text-xs text-dim">
                        {formatMapDate(map.created_at)}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-cyan-neon">Автор: {map.author_nick}</p>
                    <MapThumbnail
                      alt={`Миниатюра ${map.title}`}
                      className="mb-3 w-full"
                      spec={map.spec_json}
                    />
                    <p className="mb-4 min-h-10 text-sm text-dim">
                      {map.description || "Без описания"}
                    </p>
                    <div className="mb-4 flex flex-wrap gap-1.5 text-xs text-dim">
                      <span className="rounded border border-line px-2 py-1">
                        Блоков: {map.spec_json.blocks.length}
                      </span>
                      <span className="rounded border border-line px-2 py-1">
                        Цель: {mapWinConditionLabel(map)}
                      </span>
                      <span className="rounded border border-line px-2 py-1">
                        ▶ {map.plays_count}
                      </span>
                    </div>
                    <div className="mt-auto flex gap-2">
                      <button
                        aria-label={`Лайк карте ${map.title}`}
                        className={`btn-ghost px-3 py-2 text-sm ${likedMaps.has(map.id) ? "text-punch" : ""}`}
                        disabled={likedMaps.has(map.id) || likingId === map.id}
                        onClick={() => void like(map)}
                        type="button"
                      >
                        ❤️ {map.likes_count}
                      </button>
                      <button
                        aria-label={`Создать копию карты ${map.title} в редакторе`}
                        className="btn-ghost flex-1 px-3 py-2 text-sm text-cyan-neon hover:bg-cyan-neon/10"
                        onClick={() => handleCopyMap(map)}
                        title="Создать копию в ваших картах и открыть в редакторе"
                        type="button"
                      >
                        📋 В редактор
                      </button>
                      <button
                        className="btn-arcade flex-1 px-3 py-2 text-sm"
                        onClick={() => onPlay(map.spec_json)}
                        type="button"
                      >
                        ▶ Играть
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
