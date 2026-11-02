import { describe, expect, it } from "vitest"

/**
 * Контракт сервис-воркера (AD-036).
 *
 * Тест читает `public/sw.js` и проверяет инварианты, поломка которых вернула бы
 * инцидент 02.11.2026: деплой прошёл, а в игре остался прошлый номер билда.
 * Сам файл — не модуль ESM (он выполняется в ServiceWorkerGlobalScope), поэтому
 * читаем его исходник через `import.meta.glob(..., { query: "?raw" })` — это
 * работает и в Vitest, и в браузерной сборке, не требуя Node-типов.
 */
const sources = import.meta.glob<string>("../public/sw.js", {
  query: "?raw",
  import: "default",
  eager: true,
})
const SW_SOURCE = Object.values(sources)[0] ?? ""

describe("sw.js: версия кэша подставляется сборкой", () => {
  it("исходник сервис-воркера действительно прочитан", () => {
    // Без этого пустая строка прошла бы проверки «не содержит» вхолостую.
    expect(SW_SOURCE.length).toBeGreaterThan(500)
    expect(SW_SOURCE).toContain('self.addEventListener("fetch"')
  })

  it("содержит оба плейсхолдера, которые заменяет плагин vite.config.js", () => {
    expect(SW_SOURCE).toContain("__CACHE_SCOPE__")
    expect(SW_SOURCE).toContain("__CACHE_VERSION__")
  })

  it("имя кэша собрано из scope-префикса и версии, а не захардкожено", () => {
    const m = SW_SOURCE.match(/const CACHE_VERSION = "([^"]+)"/)
    expect(m).not.toBeNull()
    const literal = m![1]
    // Порядок важен: сначала scope, потом версия ("sharoboy-beta-357").
    expect(literal.indexOf("__CACHE_SCOPE__")).toBeGreaterThan(-1)
    expect(literal.indexOf("__CACHE_VERSION__")).toBeGreaterThan(literal.indexOf("__CACHE_SCOPE__"))
    // Старое захардкоженное имя в КОДЕ вернуло бы «залипание» на прошлом билде
    // (в комментарии оно остаётся как объяснение истории).
    expect(literal).not.toBe("sharoboy-v1")
  })

  it("не содержит лишних плейсхолдеров, которые никто не заменит", () => {
    // Комментарии сборка не трогает — проверяем только исполняемый код.
    const code = SW_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
    // Маркеры стоят вплотную, поэтому жадный regex видит их одним «словом».
    // Проверяем по отдельности: других плейсхолдеров в коде быть не должно.
    const names = [...code.matchAll(/__[A-Z_]+/g)].map((m) => m[0])
    for (const name of names) {
      const known = name.startsWith("__CACHE_SCOPE__") || name.startsWith("__CACHE_VERSION__")
      expect(known, `неизвестный плейсхолдер ${name}`).toBe(true)
    }
    // Оба маркера действительно присутствуют.
    expect(code).toContain("__CACHE_SCOPE__")
    expect(code).toContain("__CACHE_VERSION__")
  })
})

describe("sw.js: стратегии кэширования", () => {
  it("навигация и оболочка идут через сеть-первым", () => {
    // Устаревший index.html утащил бы старый бандл: оболочка не должна
    // отдаваться из кэша раньше сети.
    expect(SW_SOURCE).toContain('req.mode === "navigate"')
    expect(SW_SOURCE).toContain("networkFirst(req)")
    expect(SW_SOURCE).toContain("function networkFirst(")
  })

  it("ассеты остаются stale-while-revalidate (мгновенный запуск)", () => {
    expect(SW_SOURCE).toContain("return cached || refresh")
  })

  it("офлайн-фолбэк опирается на сохранённый index.html", () => {
    expect(SW_SOURCE).toContain("caches.match(INDEX_URL)")
  })

  it("активация удаляет кэши прошлых сборок", () => {
    // Код разбит переносами (`caches\n  .keys()`), поэтому проверяем по частям.
    expect(SW_SOURCE).toContain("caches.delete(k)")
    expect(SW_SOURCE).toMatch(/caches\s*\.keys\(\)/)
  })
})
