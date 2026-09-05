/**
 * Мировая таблица рекордов.
 *
 * Хранилище — Supabase (таблица sharoboy_scores), но клиент не обращается к
 * базе напрямую: запись и чтение идут через Edge Function «scores»
 * (supabase/functions/scores). Секрет подписи очков (SCORE_SECRET) существует
 * только в секретах функции — в клиентский бандл он больше не попадает.
 *
 * SDK не используется — обычный fetch, поэтому без конфигурации игра работает
 * как раньше (локальные рекорды), а вес бандла не растёт.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_ENABLED } from "../config"

export type LeadPeriod = "all" | "day" | "month"

/** Категория экрана для разделения мирового топа: очки сравнимы только внутри категории. */
export type ScreenClass = "mobile" | "fhd" | "4k"

/** Фильтр мирового топа: "all" — без разделения, иначе — категория экрана. */
export type ScreenFilter = ScreenClass | "all"

/**
 * Класс экрана по диагонали окна в CSS-пикселях — используется только для
 * разделения мирового топа (очки сравнимы внутри категории):
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
}

/** URL Edge Function «scores» — единственной точки входа в мировой топ. */
const API_URL = `${SUPABASE_URL}/functions/v1/scores`

/** Заголовки запроса. Anon-ключ публичный по дизайну: он служит JWT для
 *  проверки вызова функции (verify_jwt), прав к таблице у клиента нет. */
function apiHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  }
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
 * Строки запрашиваются у Edge Function «scores», которая сама отбрасывает
 * записи с невалидной подписью; повторные попытки одного игрока занимают
 * одну позицию — его лучший результат (строки отсортированы по score).
 * Ошибки не роняют игру — возвращаем [].
 */
export async function fetchTop(
  mode: "campaign" | "endless",
  period: LeadPeriod = "all",
  limit = 10,
  screen?: ScreenClass
): Promise<GlobalScore[]> {
  try {
    if (!LEADERBOARD_ENABLED) return []
    const params = new URLSearchParams({
      mode,
      limit: String(Math.min(limit * 3, 60)),
    })
    if (screen) params.set("screen", screen)
    const from = periodFromIso(period)
    if (from) params.set("from", from)
    const res = await fetch(`${API_URL}?${params}`, { headers: apiHeaders() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { rows?: GlobalScore[] }
    return dedupeTop(data.rows ?? []).slice(0, limit)
  } catch (e) {
    console.warn("[ШАРОБОЙ] мировой топ недоступен:", e)
    return []
  }
}

/**
 * Добавить очки в мировой топ. Возвращает null при успехе или текст ошибки.
 * Подпись ставит Edge Function «scores» своим серверным секретом; дубли не
 * плодятся: триггер sharoboy_scores_best_only хранит только лучший результат
 * игрока в каждом режиме.
 */
export async function submitScore(
  nick: string,
  score: number,
  mode: "campaign" | "endless",
  wave: number,
  screen: ScreenClass
): Promise<string | null> {
  try {
    if (!LEADERBOARD_ENABLED) return "Таблица рекордов не подключена"
    const res = await fetch(API_URL, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ nick, score, mode, wave, screen_class: screen }),
    })
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) return data?.error || `Ошибка отправки (${res.status})`
    return null
  } catch (e) {
    console.error("[ШАРОБОЙ] не удалось отправить очки:", e)
    return e instanceof Error ? e.message : String(e)
  }
}
