import { LEADERBOARD_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config"

import type { PlayerMapSpec } from "./mapSpec"

export interface CustomMapRecord {
  id: string
  title: string
  description: string
  author_nick: string
  spec_json: PlayerMapSpec
  status?: "pending" | "approved" | "rejected"
  reject_reason?: string | null
  map_uid?: string | null
  edit_status?: "none" | "requested" | "approved"
  edit_request_reason?: string | null
  likes_count: number
  plays_count: number
  created_at: string
}

export interface PublishCustomMapPayload {
  title: string
  description?: string
  author_nick: string
  spec: PlayerMapSpec
  map_uid?: string
}

export interface ApprovedMapsParams {
  sort?: "popular" | "newest"
  search?: string
  limit?: number
  offset?: number
}

const API_URL = `${SUPABASE_URL}/functions/v1/maps`
const VOTER_ID_KEY = "sharoboy-custom-map-voter-id"
const REQUEST_TIMEOUT_MS = 10_000

function headers(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...headers(), ...init.headers },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof data?.error === "string" ? data.error : `${fallback} (${response.status})`
}

function unavailable(): Error {
  return new Error("Карты сообщества недоступны: Supabase не подключён.")
}

export async function publishCustomMap(payload: PublishCustomMapPayload): Promise<CustomMapRecord> {
  if (!LEADERBOARD_ENABLED) throw unavailable()
  const response = await request("", {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      description: payload.description ?? "",
      author_nick: payload.author_nick,
      spec_json: payload.spec,
      map_uid: payload.map_uid ?? payload.spec.id,
    }),
  })
  if (!response.ok)
    throw new Error(await errorMessage(response, "Не удалось отправить карту на модерацию"))
  const data = (await response.json()) as { map?: CustomMapRecord }
  if (!data.map) throw new Error("Сервер не вернул опубликованную карту.")
  return data.map
}

export async function requestMapEdit(
  mapId: string,
  authorNick: string,
  reason: string
): Promise<void> {
  if (!LEADERBOARD_ENABLED) throw unavailable()
  const response = await request(`/${encodeURIComponent(mapId)}/request-edit`, {
    method: "POST",
    body: JSON.stringify({ author_nick: authorNick, reason: reason.trim() }),
  })
  if (!response.ok)
    throw new Error(await errorMessage(response, "Не удалось запросить редактирование"))
}

export async function updateMapSpec(mapId: string, spec: PlayerMapSpec): Promise<CustomMapRecord> {
  if (!LEADERBOARD_ENABLED) throw unavailable()
  const response = await request(`/${encodeURIComponent(mapId)}/update-spec`, {
    method: "PUT",
    body: JSON.stringify({ spec_json: spec }),
  })
  if (!response.ok)
    throw new Error(await errorMessage(response, "Не удалось отправить обновление карты"))
  const data = (await response.json()) as { map?: CustomMapRecord }
  if (!data.map) throw new Error("Сервер не вернул обновлённую карту.")
  return data.map
}

export async function fetchApprovedMaps(
  params: ApprovedMapsParams = {}
): Promise<CustomMapRecord[]> {
  if (!LEADERBOARD_ENABLED) return []
  const query = new URLSearchParams()
  if (params.sort) query.set("sort", params.sort)
  if (params.search?.trim()) query.set("search", params.search.trim())
  if (params.limit !== undefined)
    query.set("limit", String(Math.min(Math.max(Math.trunc(params.limit), 1), 100)))
  if (params.offset !== undefined)
    query.set("offset", String(Math.max(Math.trunc(params.offset), 0)))
  const response = await request(query.size > 0 ? `?${query}` : "")
  if (!response.ok)
    throw new Error(await errorMessage(response, "Не удалось загрузить каталог карт"))
  const data = (await response.json()) as { maps?: CustomMapRecord[] }
  return data.maps ?? []
}

export async function voteMap(mapId: string, voterId: string): Promise<void> {
  if (!LEADERBOARD_ENABLED) throw unavailable()
  const response = await request(`/${encodeURIComponent(mapId)}/vote`, {
    method: "POST",
    body: JSON.stringify({ voter_id: voterId }),
  })
  if (!response.ok) throw new Error(await errorMessage(response, "Не удалось поставить лайк"))
}

export async function recordMapPlay(mapId: string): Promise<void> {
  if (!LEADERBOARD_ENABLED) return
  const response = await request(`/${encodeURIComponent(mapId)}/play`, { method: "POST" })
  if (!response.ok)
    throw new Error(await errorMessage(response, "Не удалось засчитать запуск карты"))
}

export function getVoterId(): string {
  try {
    const existing = localStorage.getItem(VOTER_ID_KEY)
    if (existing) return existing
    const generated =
      globalThis.crypto?.randomUUID?.() ??
      `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(VOTER_ID_KEY, generated)
    return generated
  } catch {
    return "voter-session"
  }
}
