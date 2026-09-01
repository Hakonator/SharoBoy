/**
 * Мировая таблица рекордов.
 *
 * Хранилище — Supabase (таблица sharoboy_scores, см. SQL в README).
 * SDK грузится лениво и только если заполнен src/config.ts, поэтому
 * без конфигурации игра работает как раньше (локальные рекорды), а вес
 * стартового бандла не растёт.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_ENABLED, SCORE_SECRET } from "../config"

export type LeadPeriod = "all" | "day" | "week"

export interface GlobalScore {
  nick: string
  score: number
  wave: number
  client_sig?: string | null
}

/* минимальный тип клиента — чтобы не тянуть типы SDK в главный чанк */
interface MinimalSelect {
  eq: (col: string, val: string) => MinimalSelect
  gte: (col: string, val: string) => MinimalSelect
  order: (col: string, opts: { ascending: boolean }) => MinimalSelect
  limit: (n: number) => Promise<{ data: unknown; error: { message: string } | null }>
}
interface MinimalTable {
  select: (cols: string) => MinimalSelect
  insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
}
interface MinimalClient {
  from: (table: string) => MinimalTable
}

let clientPromise: Promise<MinimalClient | null> | null = null

async function getClient(): Promise<MinimalClient | null> {
  if (!LEADERBOARD_ENABLED) return null
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(
        ({ createClient }) =>
          createClient(SUPABASE_URL, SUPABASE_ANON_KEY) as unknown as MinimalClient
      )
      .catch((e) => {
        console.warn("[ШАРОБОЙ] Supabase недоступен:", e)
        return null
      })
  }
  return clientPromise
}

/** Простой 32-битный FNV-1a хеш строки — для подписи очков. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/** Сигнатура записи — защита от фейковых очков через консоль. */
export function signScore(
  nick: string,
  score: number,
  mode: "campaign" | "endless",
  wave: number
): string {
  return fnv1a(`${nick}:${score}:${mode}:${wave}:${SCORE_SECRET}`)
}

/** Проверяем подпись строки результата (без сигнатуры или с битой — мимо). */
export function isSigValid(row: GlobalScore, mode: "campaign" | "endless"): boolean {
  if (!row.client_sig || row.client_sig.length !== 8) return false
  return row.client_sig === signScore(row.nick, row.score, mode, row.wave ?? 0)
}

/** Граница для фильтра по периоду. */
function periodFromIso(period: LeadPeriod): string | null {
  if (period === "all") return null
  const now = new Date()
  if (period === "day") {
    now.setHours(0, 0, 0, 0)
  } else {
    const day = now.getDay() === 0 ? 7 : now.getDay() // пн=1..вс=7
    now.setDate(now.getDate() - (day - 1))
    now.setHours(0, 0, 0, 0)
  }
  return now.toISOString()
}

/**
 * Топ мировых рекордов по режиму и периоду.
 * Записи с невалидной подписью отбрасываются. Ошибки не роняют игру — возвращаем [].
 */
export async function fetchTop(
  mode: "campaign" | "endless",
  period: LeadPeriod = "all",
  limit = 10
): Promise<GlobalScore[]> {
  try {
    const client = await getClient()
    if (!client) return []
    const from = periodFromIso(period)
    const lim = Math.min(limit * 3, 60)
    try {
      let q = client.from("sharoboy_scores").select("nick,score,wave,client_sig").eq("mode", mode)
      if (from) q = q.gte("created_at", from)
      const { data, error } = await q.order("score", { ascending: false }).limit(lim)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as GlobalScore[]
      return rows.filter((r) => isSigValid(r, mode)).slice(0, limit)
    } catch {
      /* Миграция с колонкой client_sig ещё не применена — читаем без подписи,
         чтобы топ не пропадал в переходный период. */
      let q = client.from("sharoboy_scores").select("nick,score,wave").eq("mode", mode)
      if (from) q = q.gte("created_at", from)
      const { data, error } = await q.order("score", { ascending: false }).limit(limit)
      if (error) throw new Error(error.message)
      return (data ?? []) as GlobalScore[]
    }
  } catch (e) {
    console.warn("[ШАРОБОЙ] мировой топ недоступен:", e)
    return []
  }
}

/** Добавить очки в мировой топ. Возвращает null при успехе или текст ошибки. */
export async function submitScore(
  nick: string,
  score: number,
  mode: "campaign" | "endless",
  wave: number
): Promise<string | null> {
  try {
    const client = await getClient()
    if (!client) return "Таблица рекордов не подключена"
    const client_sig = signScore(nick, score, mode, wave)
    const { error } = await client
      .from("sharoboy_scores")
      .insert({ nick, score, mode, wave, client_sig })
    if (error) return error.message
    return null
  } catch (e) {
    console.error("[ШАРОБОЙ] не удалось отправить очки:", e)
    return e instanceof Error ? e.message : String(e)
  }
}
