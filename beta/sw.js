/* Сервис-воркер ШАРОБОЯ: офлайн-режим и быстрая повторная загрузка.
 *
 * Стратегии:
 *  - навигация (запрос страницы): сначала сеть, при офлайне — кэш index.html;
 *  - остальные same-origin GET (JS/CSS/иконки/манифест): кэш с фоновым
 *    обновлением (stale-while-revalidate);
 *  - кросс-доменные запросы (Supabase, Google Fonts) не перехватываем.
 *
 * ПЛЕЙСХОЛДЕРЫ НИЖЕ ПОДСТАВЛЯЕТ СБОРКА (AD-036):
 *   386 — номер прогона деплой-воркфлоу (github.run_number).
 *   beta-   — путь scope сборки: "" для корня сайта, "beta-" для /beta/.
 * Оба маркера заменяются плагином в vite.config.js при `npm run build`, поэтому
 * каждый деплой публикует НОВЫЙ sw.js: браузер видит байтовое отличие, ставит
 * новую версию, а `activate` удаляет все кэши прошлых сборок. Раньше
 * CACHE_VERSION был захардкожен ("sharoboy-v1"), SW не обновлялся никогда и
 * stale-while-revalidate навсегда отдавал старый бандл — в игре оставался
 * прежний номер билда (инцидент 02.11.2026: деплой 357, в игре 356).
 *
 * Префикс scope нужен потому, что обе сборки (корень и /beta/) живут на одном
 * origin `*.github.io` и делят ХРАНИЛИЩЕ кэшей. Без префикса beta и stable
 * удаляли кэши друг друга при активации.
 */
const CACHE_VERSION = "sharoboy-beta-386"
const SCOPE_URL = new URL(self.registration.scope)
const INDEX_URL = new URL("index.html", SCOPE_URL).href

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([INDEX_URL, new URL("manifest.webmanifest", SCOPE_URL).href]))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  if (url.origin !== location.origin) return // Supabase / шрифты — мимо кэша

  // Переход по адресу игры и явный запрос оболочки: сеть в приоритете.
  if (req.mode === "navigate" || url.pathname === new URL(INDEX_URL).pathname) {
    event.respondWith(networkFirst(req))
    return
  }

  // Ассеты: мгновенно из кэша, параллельно обновляем копию в фоне
  event.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const copy = resp.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy))
          }
          return resp
        })
        .catch(() => cached)
      return cached || refresh
    })
  )
})

/**
 * Сеть в приоритете, кэш — только резерв (офлайн). Ответ из сети обновляет
 * сохранённую копию, поэтому офлайн-запуск после успешной загрузки актуален.
 * Через networkFirst идёт и навигация, и явный запрос index.html: оболочка
 * ссылается на хешированные ассеты, и устаревший HTML утащил бы старый бандл.
 */
function networkFirst(req) {
  return fetch(req)
    .then((resp) => {
      if (resp && resp.status === 200 && resp.type === "basic") {
        const copy = resp.clone()
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy))
      }
      return resp
    })
    .catch(() => caches.match(req).then((cached) => cached || caches.match(INDEX_URL)))
}
