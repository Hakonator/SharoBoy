/**
 * Supabase Edge Function «scores» — единственная точка записи и чтения
 * мирового топа (таблица public.sharoboy_scores).
 *
 * POST /functions/v1/scores      body: { nick, score, mode, wave, screen_class }
 *   Валидирует данные, подписывает их серверным секретом SCORE_SECRET
 *   и вставляет запись от имени service role (RLS не применяется).
 *
 * GET /functions/v1/scores?mode=endless&screen=fhd&from=ISO&limit=30
 *   Читает строки топа и отбрасывает записи с невалидной подписью —
 *   проверка выполняется здесь, секрет не покидает сервер.
 *
 * Секреты окружения:
 *   SCORE_SECRET — задаётся вручную: supabase secrets set SCORE_SECRET=…
 *   SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY — доступны в рантайме автоматически.
 *
 * Вызовы требуют JWT (verify_jwt включён по умолчанию): клиент шлёт свой
 * публичный anon-ключ в заголовках apikey/Authorization.
 */

import { sigFor, sigMatches, type ScoreMode, type SigRow, type SigScreen } from "./sig.ts"

const MODES: ScoreMode[] = ["campaign", "endless"]
const SCREENS: SigScreen[] = ["mobile", "fhd", "4k"]

/** Грубая отсечка заведомо накрученных значений. */
const MAX_SCORE = 10_000_000
const MAX_WAVE = 100_000
const MAX_NICK = 24

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  })
}

/** Строго целое число в диапазоне, иначе null. */
function asInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) return null
  return v
}

/** Окружение должно быть настроено: без этого функция отвечает 500. */
function checkEnv(): { url: string; key: string; secret: string } | Response {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const secret = Deno.env.get("SCORE_SECRET")
  if (!url || !key || !secret) {
    return json(
      {
        error: "Функция не настроена: нужны SCORE_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY",
      },
      500
    )
  }
  return { url, key, secret }
}

/** POST — сохранение очков: валидация, подпись, вставка через PostgREST. */
async function submitScore(req: Request): Promise<Response> {
  const env = checkEnv()
  if (env instanceof Response) return env

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return json({ error: "Ожидается JSON-тело" }, 400)

  const nick = typeof body.nick === "string" ? body.nick.trim() : ""
  const score = asInt(body.score, 0, MAX_SCORE)
  const wave = asInt(body.wave, 0, MAX_WAVE)
  const mode = MODES.includes(body.mode as ScoreMode) ? (body.mode as ScoreMode) : null
  const screen = SCREENS.includes(body.screen_class as SigScreen)
    ? (body.screen_class as SigScreen)
    : null

  if (!nick || nick.length > MAX_NICK) return json({ error: "Некорректный ник" }, 400)
  if (score === null) return json({ error: "Некорректные очки" }, 400)
  if (wave === null) return json({ error: "Некорректная волна" }, 400)
  if (!mode) return json({ error: "Некорректный режим" }, 400)
  if (!screen) return json({ error: "Некорректная категория экрана" }, 400)

  const res = await fetch(`${env.url}/rest/v1/sharoboy_scores`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      nick,
      score,
      mode,
      wave,
      screen_class: screen,
      client_sig: sigFor(nick, score, mode, wave, screen, env.secret),
    }),
  })
  if (!res.ok) {
    console.error("[scores] insert failed:", res.status, (await res.text()).slice(0, 300))
    return json({ error: "Не удалось сохранить запись" }, 502)
  }
  return json({ ok: true })
}

/** GET — топ: строки из базы, отфильтрованные по подписи на сервере. */
async function fetchTop(req: Request): Promise<Response> {
  const env = checkEnv()
  if (env instanceof Response) return env

  const q = new URL(req.url).searchParams
  const mode = q.get("mode")
  const screenParam = q.get("screen")
  const from = q.get("from")
  const limitRaw = Number(q.get("limit") ?? 30)
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30

  if (!mode || !MODES.includes(mode as ScoreMode)) {
    return json({ error: "Нужен параметр mode: campaign|endless" }, 400)
  }
  if (screenParam && !SCREENS.includes(screenParam as SigScreen)) {
    return json({ error: "Некорректная категория экрана" }, 400)
  }
  if (from && Number.isNaN(Date.parse(from))) {
    return json({ error: "Некорректный параметр from" }, 400)
  }
  const screen = screenParam ? (screenParam as SigScreen) : undefined

  const rest = new URLSearchParams({
    select: "nick,score,wave,screen_class,client_sig",
    mode: `eq.${mode}`,
    order: "score.desc",
    limit: String(limit),
  })
  if (screen) rest.set("screen_class", `eq.${screen}`)
  if (from) rest.set("created_at", `gte.${from}`)

  const res = await fetch(`${env.url}/rest/v1/sharoboy_scores?${rest}`, {
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}` },
  })
  if (!res.ok) {
    console.error("[scores] select failed:", res.status, (await res.text()).slice(0, 300))
    return json({ error: "Топ недоступен" }, 502)
  }
  const rows = (await res.json()) as SigRow[]
  return json({
    rows: rows
      .filter((r) => sigMatches(r, mode as ScoreMode, screen, env.secret))
      .map((r) => ({
        nick: r.nick,
        score: r.score,
        wave: r.wave ?? 0,
        screen_class: r.screen_class ?? null,
      })),
  })
}

Deno.serve((req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method === "POST") return submitScore(req)
  if (req.method === "GET") return fetchTop(req)
  return json({ error: "Метод не поддерживается" }, 405)
})
