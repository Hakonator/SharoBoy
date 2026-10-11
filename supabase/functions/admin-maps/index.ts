import { createAdminToken, verifyAdminToken } from "./auth.ts"

declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  })
}

function env(): { url: string; key: string; secret: string } | Response {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const secret = Deno.env.get("ADMIN_SECRET_KEY") ?? Deno.env.get("SCORE_SECRET")
  return url && key && secret ? { url, key, secret } : json({ error: "Функция не настроена" }, 500)
}

function h(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
}

async function parsed(req: Request): Promise<Record<string, unknown> | null> {
  const value: unknown = await req.json().catch(() => null)
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

async function login(req: Request, secret: string): Promise<Response> {
  const data = await parsed(req)
  if (typeof data?.password !== "string" || data.password.length === 0 || data.password !== secret)
    return json({ error: "Неверный пароль" }, 401)
  return json({ token: await createAdminToken(secret), expires_in: 4 * 60 * 60 })
}

function idFrom(path: string, action: "approve" | "reject"): string | null {
  const match = path.match(new RegExp(`^/([^/]+)/${action}$`))
  return match?.[1] && /^[0-9a-f-]{36}$/i.test(match[1]) ? match[1] : null
}

async function handle(req: Request): Promise<Response> {
  const e = env()
  if (e instanceof Response) return e
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/functions\/v1\/admin-maps/, "") || "/"
  if (req.method === "POST" && path === "/login") return login(req, e.secret)
  const token = req.headers.get("X-Admin-Token")
  if (!token || !(await verifyAdminToken(token, e.secret)))
    return json({ error: "Требуется действительная админ-сессия" }, 401)
  if (req.method === "GET" && path === "/") {
    const status = url.searchParams.get("status") ?? "pending"
    if (!["pending", "approved", "rejected"].includes(status))
      return json({ error: "Некорректный статус" }, 400)
    const query = new URLSearchParams({
      select: "*",
      status: `eq.${status}`,
      order: "created_at.desc",
    })
    const res = await fetch(`${e.url}/rest/v1/sharoboy_custom_maps?${query}`, { headers: h(e.key) })
    return res.ok ? json({ maps: await res.json() }) : json({ error: "Модерация недоступна" }, 502)
  }
  const approve = idFrom(path, "approve")
  const reject = idFrom(path, "reject")
  if (req.method !== "POST" || (!approve && !reject))
    return json({ error: "Маршрут не найден" }, 404)
  const id = approve ?? reject
  const data = reject ? await parsed(req) : null
  const reason = reject
    ? typeof data?.reject_reason === "string"
      ? data.reject_reason.trim()
      : ""
    : null
  if (reject && (reason.length < 1 || reason.length > 300))
    return json({ error: "Укажите причину отклонения" }, 400)
  const update = reject
    ? { status: "rejected", reject_reason: reason }
    : { status: "approved", reject_reason: null }
  const res = await fetch(`${e.url}/rest/v1/sharoboy_custom_maps?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...h(e.key), Prefer: "return=representation" },
    body: JSON.stringify(update),
  })
  if (!res.ok) return json({ error: "Не удалось изменить статус" }, 502)
  return json({ map: ((await res.json()) as unknown[])[0] ?? null })
}

Deno.serve((req) =>
  req.method === "OPTIONS" ? new Response("ok", { headers: CORS }) : handle(req)
)
