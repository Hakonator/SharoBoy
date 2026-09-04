/**
 * Мировая таблица рекордов.
 *
 * Хранилище — Supabase (таблица sharoboy_scores, см. SQL в README).
 * SDK грузится лениво и только если заполнен src/config.ts, поэтому
 * без конфигурации игра работает как раньше (локальные рекорды), а вес
 * стартового бандла не растёт.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_ENABLED, SCORE_SECRET } from "../config"

export type LeadPeriod = "all" | "day" | "month"

/** Категория экрана для разделения мирового топа: очки сравнимы только внутри категории. */
export type ScreenClass = "mobile" | "fhd" | "4k"

/** Фильтр мирового топа: "all" — без разделения, иначе — категория экрана. */
export type ScreenFilter = ScreenClass | "all"

/**
 * Класс экрана по разрешению (по диагонали в CSS-пикселях), согласован с
 * плотностью расстановки блоков в levelBuilder.densityFactor:
 * - мобильные (≤≈1700) — телефоны и планшеты;
 * - FHD (≤≈3800) — HD/FullHD/2K и ультраширокие;
 * - 4K (>≈3800) — 4K и выше.
 */
export function screenClass(w: number, h: number): ScreenClass {
  const diag = Math.hypot(w, h)
  if (diag <= 1700) return "mobile"
  if (diag <= 3800) return "fhd"
  return "4k"
}

export interface GlobalScore {
  nick: string
  score: number
  wave: number
  screen_class?: ScreenClass | string | null
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

/** Сигнатура записи — защита от фейковых очков через консоль.
 *  Опциональный `screen` включает категорию экрана в подпись (новые записи);
 *  без него — формат без категории, совместимый со старыми записями. */
export function signScore(
  nick: string,
  score: number,
  mode: "campaign" | "endless",
  wave: number,
  screen?: ScreenClass
): string {
  return screen
    ? fnv1a(`${nick}:${score}:${mode}:${wave}:${screen}:${SCORE_SECRET}`)
    : fnv1a(`${nick}:${score}:${mode}:${wave}:${SCORE_SECRET}`)
}

/** Проверяем подпись строки результата (без сигнатуры или с битой — мимо).
 *  Принимаются и подписи с категорией экрана, и старые — без неё. */
export function isSigValid(
  row: GlobalScore,
  mode: "campaign" | "endless",
  screen?: ScreenClass
): boolean {
  if (!row.client_sig || row.client_sig.length !== 8) return false
  const wave = row.wave ?? 0
  if (screen && row.client_sig === signScore(row.nick, row.score, mode, wave, screen)) return true
  return row.client_sig === signScore(row.nick, row.score, mode, wave)
}

/** Граница для фильтра по периоду. */
function periodFromIso(period: LeadPeriod): string | null {
  if (period === "all") return null
  const now = new Date()
  if (period === "day") {
    now.setHours(0, 0, 0, 0)
  } else if (period === "month") {
    now.setDate(1)
    now.setHours(0, 0, 0, 0)
  }
  return now.toISOString()
}

/**
 * Одна позиция топа на игрока: повторные попытки схлопываются в лучший
 * результат. Требует строки, отсортированные по score по убыванию, —
 * тогда первая встретившаяся строка ника и есть его рекорд.
 * Регистр ника не учитывается.
 */
export function dedupeTop(rows: GlobalScore[]): GlobalScore[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = r.nick.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Топ мировых рекордов по режиму и периоду (и, опционально, категории экрана).
 * Записи с невалидной подписью отбрасываются, повторные попытки одного
 * игрока занимают одну позицию — его лучший результат.
 * Ошибки не роняют игру — возвращаем [].
 */
export async function fetchTop(
  mode: "campaign" | "endless",
  period: LeadPeriod = "all",
  limit = 10,
  screen?: ScreenClass
): Promise<GlobalScore[]> {
  try {
    const client = await getClient()
    if (!client) return []
    const from = periodFromIso(period)
    const lim = Math.min(limit * 3, 60)
    try {
      let q = client.from("sharoboy_scores").select("nick,score,wave,screen_class,client_sig")
      q = q.eq("mode", mode)
      if (screen) q = q.eq("screen_class", screen)
      if (from) q = q.gte("created_at", from)
      const { data, error } = await q.order("score", { ascending: false }).limit(lim)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as GlobalScore[]
      return dedupeTop(rows.filter((r) => isSigValid(r, mode, screen))).slice(0, limit)
    } catch {
      /* Миграция с колонкой client_sig ещё не применена — читаем без подписи,
         чтобы топ не пропадал в переходный период. */
      let q = client.from("sharoboy_scores").select("nick,score,wave,screen_class")
      q = q.eq("mode", mode)
      if (screen) q = q.eq("screen_class", screen)
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

/**
 * Добавить очки в мировой топ. Возвращает null при успехе или текст ошибки.
 * Повторные попытки не плодят дубли: сервер (триггер sharoboy_scores_best_only
 * в Supabase) хранит только лучший результат игрока в каждом режиме.
 */
export async function submitScore(
  nick: string,
  score: number,
  mode: "campaign" | "endless",
  wave: number,
  screen: ScreenClass
): Promise<string | null> {
  try {
    const client = await getClient()
    if (!client) return "Таблица рекордов не подключена"
    const client_sig = signScore(nick, score, mode, wave, screen)
    const { error } = await client
      .from("sharoboy_scores")
      .insert({ nick, score, mode, wave, screen_class: screen, client_sig })
    if (error) return error.message
    return null
  } catch (e) {
    console.error("[ШАРОБОЙ] не удалось отправить очки:", e)
    return e instanceof Error ? e.message : String(e)
  }
}
