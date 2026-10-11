import { LEADERBOARD_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config"

import type { CustomMapRecord } from "./customMapsApi"

const TOKEN_KEY = "sharoboy-admin-token"
const REQUEST_TIMEOUT_MS = 10_000
const API_URL = `${SUPABASE_URL}/functions/v1/admin-maps`

function unavailable(): Error {
  return new Error("Панель модерации недоступна: Supabase не подключён.")
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!LEADERBOARD_ENABLED) throw unavailable()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function message(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null
  return typeof data?.error === "string" ? data.error : `${fallback} (${response.status})`
}

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function adminLogin(password: string): Promise<string> {
  const response = await request("/login", { method: "POST", body: JSON.stringify({ password }) })
  if (!response.ok) throw new Error(await message(response, "Не удалось войти в панель модерации"))
  const data = (await response.json()) as { token?: unknown }
  if (typeof data.token !== "string" || data.token.length === 0)
    throw new Error("Сервер не вернул токен администратора.")
  try {
    sessionStorage.setItem(TOKEN_KEY, data.token)
  } catch {
    /* Session storage may be unavailable; the caller still receives the token. */
  }
  return data.token
}

export async function fetchPendingMaps(token: string): Promise<CustomMapRecord[]> {
  const response = await request("?status=pending", { headers: { "X-Admin-Token": token } })
  if (!response.ok)
    throw new Error(await message(response, "Не удалось загрузить очередь модерации"))
  const data = (await response.json()) as { maps?: unknown }
  return Array.isArray(data.maps) ? (data.maps as CustomMapRecord[]) : []
}

export async function approveMap(token: string, mapId: string): Promise<void> {
  const response = await request(`/${encodeURIComponent(mapId)}/approve`, {
    method: "POST",
    headers: { "X-Admin-Token": token },
  })
  if (!response.ok) throw new Error(await message(response, "Не удалось одобрить карту"))
}

export async function rejectMap(token: string, mapId: string, reason: string): Promise<void> {
  const trimmed = reason.trim()
  if (!trimmed) throw new Error("Укажите причину отклонения.")
  const response = await request(`/${encodeURIComponent(mapId)}/reject`, {
    method: "POST",
    headers: { "X-Admin-Token": token },
    body: JSON.stringify({ reject_reason: trimmed }),
  })
  if (!response.ok) throw new Error(await message(response, "Не удалось отклонить карту"))
}

export function adminLogout(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* Nothing to clear when session storage is unavailable. */
  }
}
