import { useCallback, useEffect, useState } from "react"

import { LEADERBOARD_ENABLED } from "../../config"
import {
  fetchApprovedMaps,
  getVoterId,
  humanizeMapsApiError,
  voteMap,
  type CustomMapRecord,
} from "../../game/customMapsApi"
import type { MapPlaylistSpec, PlayerMapSpec } from "../../game/mapSpec"
import {
  createDefaultPlaylist,
  deleteLocalPlaylist,
  loadLocalMaps,
  loadLocalPlaylists,
  saveLocalMap,
  saveLocalPlaylist,
  setCurrentLocalMapId,
  type LocalPlaylistEntry,
} from "../editor/localMapsStorage"
import { MapThumbnail } from "../editor/MapThumbnail"

type CommunityMapsSort = "popular" | "newest"

const LIKED_MAPS_KEY = "sharoboy-liked-community-maps"

export interface CommunityMapsProps {
  onBack: () => void
  onPlay: (spec: PlayerMapSpec) => void
  onPlayPlaylist?: (playlist: MapPlaylistSpec) => void
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

export function CommunityMaps({ onBack, onPlay, onPlayPlaylist, onEditCopy }: CommunityMapsProps) {
  const [viewTab, setViewTab] = useState<"maps" | "playlists">("maps")
  const [sort, setSort] = useState<CommunityMapsSort>("popular")
  const [search, setSearch] = useState("")
  const [maps, setMaps] = useState<CustomMapRecord[]>([])
  const [playlists, setPlaylists] = useState<LocalPlaylistEntry[]>(() => loadLocalPlaylists())
  const [likedMaps, setLikedMaps] = useState<Set<string>>(loadLikedMaps)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [likingId, setLikingId] = useState<string | null>(null)
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null)

  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
  const [playlistTitle, setPlaylistTitle] = useState("")
  const [playlistDesc, setPlaylistDesc] = useState("")
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>([])

  const getAllAvailableMaps = useCallback((): PlayerMapSpec[] => {
    const local = loadLocalMaps().map((entry) => entry.spec)
    const community = maps.map((entry) => entry.spec_json)
    const combined = [...local, ...community]
    const mapById = new Map<string, PlayerMapSpec>()
    for (const m of combined) {
      if (!mapById.has(m.id)) {
        mapById.set(m.id, m)
      }
    }
    if (mapById.size < 2) {
      for (const m of createDefaultPlaylist().maps) {
        if (!mapById.has(m.id)) {
          mapById.set(m.id, m)
        }
      }
    }
    return Array.from(mapById.values())
  }, [maps])

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

        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-line/60 pb-3">
          <button
            type="button"
            onClick={() => setViewTab("maps")}
            className={`rounded-lg px-4 py-2 font-display text-sm transition ${
              viewTab === "maps"
                ? "border border-cyan-neon bg-cyan-neon/20 text-cyan-neon shadow-[0_0_12px_rgba(53,224,255,0.3)] font-bold"
                : "border border-line/60 bg-deep/50 text-dim hover:text-foam"
            }`}
          >
            🗺 Одиночные карты
          </button>
          <button
            type="button"
            onClick={() => {
              setViewTab("playlists")
              setPlaylists(loadLocalPlaylists())
            }}
            className={`rounded-lg px-4 py-2 font-display text-sm transition ${
              viewTab === "playlists"
                ? "border border-gold bg-gold/20 text-gold shadow-[0_0_12px_rgba(255,201,77,0.3)] font-bold"
                : "border border-line/60 bg-deep/50 text-dim hover:text-foam"
            }`}
          >
            📚 Плейлисты (Мини-кампании)
          </button>
        </div>

        {viewTab === "playlists" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-deep/80 p-4">
              <div>
                <h2 className="font-display text-xl text-gold font-bold">
                  Мини-кампании и плейлисты
                </h2>
                <p className="text-xs text-dim mt-0.5">
                  Последовательное прохождение карт с переносом счёта, жизней и наград
                </p>
              </div>
              <button
                type="button"
                className="btn-arcade px-4 py-2 text-sm shadow-[0_0_12px_rgba(255,201,77,0.3)]"
                onClick={() => {
                  setPlaylistTitle("")
                  setPlaylistDesc("")
                  setSelectedMapIds([])
                  setShowCreatePlaylist(true)
                }}
              >
                + Создать плейлист
              </button>
            </div>

            {playlists.length === 0 ? (
              <div className="hud-chip p-8 text-center text-dim">
                Плейлистов пока нет. Нажмите «+ Создать плейлист», чтобы собрать свою мини-кампанию!
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {playlists.map((entry) => (
                  <article
                    key={entry.id}
                    className="flex flex-col rounded-xl border border-gold/40 bg-deep/90 p-5 shadow-xl transition-all hover:border-gold/80"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3
                        className="font-display text-lg text-gold font-bold truncate"
                        title={entry.title}
                      >
                        {entry.title}
                      </h3>
                      <span className="rounded border border-gold/40 bg-gold/15 px-2 py-0.5 text-xs font-mono text-gold shrink-0">
                        {entry.spec.maps.length} секторов
                      </span>
                    </div>
                    {entry.author && <p className="mb-2 text-xs text-dim">Автор: {entry.author}</p>}
                    <p className="mb-3 text-xs text-foam/80 min-h-8">
                      {entry.description || "Серия секторов для проверки мастерства"}
                    </p>

                    <div className="mb-4 rounded-lg border border-line/50 bg-abyss/80 p-3">
                      <div className="hud-label text-[10px] mb-1.5 text-cyan-neon">
                        Маршрут мини-кампании:
                      </div>
                      <ol className="space-y-1 text-xs">
                        {entry.spec.maps.map((m, idx) => (
                          <li
                            key={m.id || idx}
                            className="flex items-center justify-between gap-2 text-foam/90"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono text-gold font-bold">{idx + 1}.</span>
                              <span className="truncate">{m.metadata.title}</span>
                            </div>
                            <span className="text-[10px] text-dim shrink-0">
                              🧱 {m.blocks.length}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="mt-auto flex items-center gap-2 pt-2 border-t border-line/40">
                      {playlists.length > 1 && (
                        <button
                          type="button"
                          className="btn-ghost px-2.5 py-2 text-xs text-coral hover:bg-coral/10"
                          onClick={() => {
                            const next = deleteLocalPlaylist(entry.id)
                            setPlaylists(next)
                          }}
                          title="Удалить плейлист"
                        >
                          🗑
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-arcade flex-1 py-2.5 text-sm font-bold shadow-[0_0_15px_rgba(255,201,77,0.3)]"
                        onClick={() => onPlayPlaylist?.(entry.spec)}
                      >
                        ▶ Начать кампанию ({entry.spec.maps.length} карт)
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {showCreatePlaylist && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-abyss/80 backdrop-blur-md anim-fade-in">
                <div className="relative w-full max-w-lg rounded-2xl border border-gold/50 bg-deep/95 p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto arcade-scrollbar text-foam">
                  <div className="flex items-center justify-between border-b border-line/60 pb-3 mb-4">
                    <h3 className="font-display text-lg text-gold font-bold">
                      Новый плейлист карт
                    </h3>
                    <button
                      type="button"
                      className="text-dim hover:text-foam text-lg"
                      onClick={() => setShowCreatePlaylist(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div>
                      <label className="hud-label block mb-1">Название плейлиста</label>
                      <input
                        className="w-full rounded border border-line bg-abyss px-3 py-2 text-sm text-foam outline-none focus:border-gold"
                        value={playlistTitle}
                        onChange={(e) => setPlaylistTitle(e.target.value)}
                        placeholder="Например: Испытание геометрии"
                        maxLength={60}
                      />
                    </div>

                    <div>
                      <label className="hud-label block mb-1">Описание (опционально)</label>
                      <textarea
                        className="w-full rounded border border-line bg-abyss px-3 py-2 text-sm text-foam outline-none focus:border-gold resize-none h-16"
                        value={playlistDesc}
                        onChange={(e) => setPlaylistDesc(e.target.value)}
                        placeholder="Краткое описание мини-кампании"
                        maxLength={200}
                      />
                    </div>

                    <div>
                      <label className="hud-label block mb-1.5">
                        Выберите карты ({selectedMapIds.length} выбрано, минимум 2):
                      </label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto arcade-scrollbar rounded border border-line/60 bg-abyss/60 p-2">
                        {getAllAvailableMaps().map((map) => {
                          const isChecked = selectedMapIds.includes(map.id)
                          return (
                            <label
                              key={map.id}
                              className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-foam/5 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMapIds([...selectedMapIds, map.id])
                                    } else {
                                      setSelectedMapIds(
                                        selectedMapIds.filter((id) => id !== map.id)
                                      )
                                    }
                                  }}
                                />
                                <span className="truncate">{map.metadata.title}</span>
                              </div>
                              <span className="text-[10px] text-dim shrink-0">
                                🧱 {map.blocks.length}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-line/50">
                      <button
                        type="button"
                        className="btn-ghost px-4 py-2"
                        onClick={() => setShowCreatePlaylist(false)}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        className="btn-arcade px-6 py-2"
                        disabled={!playlistTitle.trim() || selectedMapIds.length < 2}
                        onClick={() => {
                          const available = getAllAvailableMaps()
                          const chosen = selectedMapIds
                            .map((id) => available.find((m) => m.id === id))
                            .filter((m): m is PlayerMapSpec => Boolean(m))
                          if (chosen.length < 2) return
                          const spec: MapPlaylistSpec = {
                            version: 1,
                            id: `playlist-${Date.now()}`,
                            metadata: {
                              title: playlistTitle.trim(),
                              description: playlistDesc.trim() || undefined,
                              author: "Игрок",
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            },
                            maps: chosen,
                          }
                          const updated = saveLocalPlaylist(spec)
                          setPlaylists(updated)
                          setShowCreatePlaylist(false)
                        }}
                      >
                        Создать
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
