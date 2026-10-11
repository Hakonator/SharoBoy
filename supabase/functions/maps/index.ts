import { containsProfanity, validateNick } from "../scores/profanity.ts"

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}
const MAX_SPEC_BYTES = 1_000_000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  })
}

function env(): { url: string; key: string } | Response {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  return url && key ? { url, key } : json({ error: "Функция не настроена" }, 500)
}

function headers(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
}

async function body(req: Request): Promise<Record<string, unknown> | null> {
  const value: unknown = await req.json().catch(() => null)
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function validSpec(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const spec = value as Record<string, unknown>
  return (
    Array.isArray(spec.blocks) &&
    spec.blocks.length <= 200 &&
    typeof spec.winCondition === "object" &&
    spec.winCondition !== null
  )
}

function mapId(path: string, action: "vote" | "play"): string | null {
  const match = path.match(new RegExp(`^/([^/]+)/${action}$`))
  return match?.[1] && /^[0-9a-f-]{36}$/i.test(match[1]) ? match[1] : null
}

async function postMap(req: Request, e: { url: string; key: string }): Promise<Response> {
  const data = await body(req)
  const title = typeof data?.title === "string" ? data.title.trim() : ""
  const description = typeof data?.description === "string" ? data.description.trim() : ""
  const author = typeof data?.author_nick === "string" ? data.author_nick : ""
  const spec = data?.spec_json
  if (title.length < 2 || title.length > 60 || /[\u0000]/u.test(title) || containsProfanity(title))
    return json({ error: "Некорректное название" }, 400)
  if (description.length > 300) return json({ error: "Описание слишком длинное" }, 400)
  const nick = validateNick(author)
  if (!nick.ok) return json({ error: nick.error ?? "Некорректный ник" }, 400)
  if (!validSpec(spec) || JSON.stringify(spec).length > MAX_SPEC_BYTES)
    return json({ error: "Некорректная спецификация карты" }, 400)
  const res = await fetch(`${e.url}/rest/v1/sharoboy_custom_maps`, {
    method: "POST",
    headers: { ...headers(e.key), Prefer: "return=representation" },
    body: JSON.stringify({
      title,
      description,
      author_nick: nick.nick,
      spec_json: spec,
      status: "pending",
    }),
  })
  if (!res.ok) return json({ error: "Не удалось отправить карту" }, 502)
  const rows = (await res.json()) as unknown[]
  return json({ map: rows[0] ?? null }, 201)
}

async function listMaps(req: Request, e: { url: string; key: string }): Promise<Response> {
  const q = new URL(req.url).searchParams
  const sort = q.get("sort") ?? "newest"
  if (sort !== "popular" && sort !== "newest")
    return json({ error: "Некорректная сортировка" }, 400)
  const limitRaw = Number(q.get("limit") ?? 20)
  const offsetRaw = Number(q.get("offset") ?? 0)
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20
  const offset = Number.isInteger(offsetRaw) ? Math.min(Math.max(offsetRaw, 0), 100000) : 0
  const rest = new URLSearchParams({
    select: "id,title,description,author_nick,spec_json,likes_count,plays_count,created_at",
    status: "eq.approved",
    order: sort === "popular" ? "likes_count.desc,created_at.desc" : "created_at.desc",
    limit: String(limit),
    offset: String(offset),
  })
  const search = q.get("search")?.trim()
  if (search)
    rest.set(
      "or",
      `(title.ilike.*${search.replace(/[%,()]/gu, "")}*,author_nick.ilike.*${search.replace(/[%,()]/gu, "")}*)`
    )
  const res = await fetch(`${e.url}/rest/v1/sharoboy_custom_maps?${rest}`, {
    headers: headers(e.key),
  })
  if (!res.ok) return json({ error: "Каталог недоступен" }, 502)
  return json({ maps: await res.json() })
}

async function increment(
  req: Request,
  e: { url: string; key: string },
  id: string,
  action: "vote" | "play"
): Promise<Response> {
  const data = await body(req)
  if (action === "vote") {
    const voter = typeof data?.voter_id === "string" ? data.voter_id.trim() : ""
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(voter)) return json({ error: "Некорректный voter_id" }, 400)
    const vote = await fetch(`${e.url}/rest/v1/sharoboy_map_votes`, {
      method: "POST",
      headers: { ...headers(e.key), Prefer: "return=minimal" },
      body: JSON.stringify({ map_id: id, voter_id: voter }),
    })
    if (vote.status === 409) return json({ error: "Лайк уже поставлен" }, 409)
    if (!vote.ok) return json({ error: "Не удалось поставить лайк" }, 502)
    await fetch(`${e.url}/rest/v1/rpc/sharoboy_increment_map_likes`, {
      method: "POST",
      headers: headers(e.key),
      body: JSON.stringify({ map_uuid: id }),
    })
    return json({ ok: true }, 201)
  }
  const play = await fetch(`${e.url}/rest/v1/rpc/sharoboy_increment_map_plays`, {
    method: "POST",
    headers: headers(e.key),
    body: JSON.stringify({ map_uuid: id }),
  })
  return play.ok ? json({ ok: true }) : json({ error: "Не удалось засчитать запуск" }, 502)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  const e = env()
  if (e instanceof Response) return e
  const path = new URL(req.url).pathname.replace(/^\/functions\/v1\/maps/, "") || "/"
  if (req.method === "GET" && path === "/") return listMaps(req, e)
  if (req.method === "POST" && path === "/") return postMap(req, e)
  if (req.method === "POST") {
    const vote = mapId(path, "vote")
    const play = mapId(path, "play")
    if (vote) return increment(req, e, vote, "vote")
    if (play) return increment(req, e, play, "play")
  }
  return json({ error: "Маршрут не найден" }, 404)
})
