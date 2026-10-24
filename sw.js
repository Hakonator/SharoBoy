/* Сервис-воркер ШАРОБОЯ: офлайн-режим и быстрая повторная загрузка.
 *
 * Стратегии:
 *  - навигация (запрос страницы): сначала сеть, при офлайне — кэш index.html;
 *  - остальные same-origin GET (JS/CSS/иконки/манифест): кэш с фоновым
 *    обновлением (stale-while-revalidate);
 *  - кросс-доменные запросы (Supabase, Google Fonts) не перехватываем.
 *
 * При выпуске новой версии достаточно поднять CACHE_VERSION — при активации
 * старые кэши удаляются, а skipWaiting+clients.claim подхватывают обновление.
 */
const CACHE_VERSION = "sharoboy-v1";
const SCOPE_URL = new URL(self.registration.scope);
const INDEX_URL = new URL("index.html", SCOPE_URL).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([INDEX_URL, new URL("manifest.webmanifest", SCOPE_URL).href]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Supabase / шрифты — мимо кэша

  // Переход по адресу игры: сеть, при отсутствии сети — сохранённая оболочка
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(INDEX_URL).then((r) => r || caches.match(SCOPE_URL.href))
      )
    );
    return;
  }

  // Ассеты: мгновенно из кэша, параллельно обновляем копию в фоне
  event.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});