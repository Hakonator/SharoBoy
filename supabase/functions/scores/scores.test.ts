import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Тесты Edge Function «scores» без обращений к рабочему Supabase.
 * Подменяем глобальные Deno и fetch, затем динамически импортируем index.ts —
 * он регистрирует обработчик в Deno.serve, который мы и вызываем.
 */

const SECRET = "test-secret"
const SUPABASE_URL = "https://example.supabase.co"
const SERVICE_KEY = "service-key"

// Мок Deno.env.get
const envMock = vi.fn((key: string) => {
  if (key === "SUPABASE_URL") return SUPABASE_URL
  if (key === "SUPABASE_SERVICE_ROLE_KEY") return SERVICE_KEY
  if (key === "SCORE_SECRET") return SECRET
  return undefined
})

// Перехватчик обработчика, переданного в Deno.serve
let handler: ((req: Request) => Promise<Response>) | null = null

beforeEach(async () => {
  handler = null
  // @ts-expect-error — мок глобального Denо для Node-окружения vitest
  globalThis.Deno = {
    env: { get: envMock },
    serve: (h: (req: Request) => Promise<Response>) => {
      handler = h
    },
  }
  vi.resetModules()
})

afterEach(() => {
  // @ts-expect-error — очистка мока
  delete globalThis.Deno
  vi.restoreAllMocks()
})

async function callIndex(): Promise<void> {
  await import("./index.ts")
  if (!handler) throw new Error("Deno.serve не был вызван")
}

function makeRequest(method: string, path = "/", body?: unknown): Request {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new Request(`https://example.com${path}`, init)
}

describe("scores Edge Function — POST /submit", () => {
  it("сохраняет валидную запись (200)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    globalThis.fetch = fetchMock

    await callIndex()
    const res = await handler!(
      makeRequest("POST", "/", {
        nick: "Игрок",
        score: 1234,
        mode: "campaign",
        wave: 3,
        screen_class: "fhd",
      })
    )

    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("отклоняет ник с матом (400)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    globalThis.fetch = fetchMock

    await callIndex()
    const res = await handler!(
      makeRequest("POST", "/", {
        nick: "xyй",
        score: 100,
        mode: "campaign",
        wave: 1,
        screen_class: "fhd",
      })
    )

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("отклоняет слишком длинный ник (400)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    globalThis.fetch = fetchMock

    await callIndex()
    const res = await handler!(
      makeRequest("POST", "/", {
        nick: "этотникслишкомдлинныйдляигры",
        score: 100,
        mode: "campaign",
        wave: 1,
        screen_class: "fhd",
      })
    )

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("отклоняет некорректные очки (400)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    globalThis.fetch = fetchMock

    await callIndex()
    const res = await handler!(
      makeRequest("POST", "/", {
        nick: "Игрок",
        score: -1,
        mode: "campaign",
        wave: 1,
        screen_class: "fhd",
      })
    )

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("scores Edge Function — GET /top", () => {
  it("возвращает топ, отфильтрованный по подписи (200)", async () => {
    // Импортируем sigFor для генерации валидной подписи
    const { sigFor } = await import("./sig.ts")
    const validSig = sigFor("Игрок", 1234, "campaign", 3, "fhd", SECRET)

    const rows = [
      { nick: "Игрок", score: 1234, wave: 3, screen_class: "fhd", client_sig: validSig },
      { nick: "Мусор", score: 9999, wave: 1, screen_class: "fhd", client_sig: "invalid" },
    ]
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows), { status: 200 }))
    globalThis.fetch = fetchMock

    await callIndex()
    const res = await handler!(makeRequest("GET", "/?mode=campaign&screen=fhd"))

    expect(res.status).toBe(200)
    const json = (await res.json()) as { rows: Array<{ nick: string }> }
    expect(json.rows).toHaveLength(1)
    expect(json.rows[0].nick).toBe("Игрок")
  })

  it("отклоняет невалидный mode (400)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    globalThis.fetch = fetchMock

    await callIndex()
    const res = await handler!(makeRequest("GET", "/?mode=invalid"))

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("scores Edge Function — прочее", () => {
  it("отвечает 405 на неподдерживаемый метод", async () => {
    await callIndex()
    const res = await handler!(makeRequest("DELETE", "/"))
    expect(res.status).toBe(405)
  })

  it("отвечает 200 на OPTIONS (CORS preflight)", async () => {
    await callIndex()
    const res = await handler!(makeRequest("OPTIONS", "/"))
    expect(res.status).toBe(200)
  })
})
