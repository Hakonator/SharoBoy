import fs from "node:fs"
import path from "node:path"

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/**
 * Подстановка версии в public/sw.js (AD-036).
 *
 * `public/` копируется в `dist/` уже ПОСЛЕ формирования бандла, поэтому
 * плейсхолдеры `__CACHE_VERSION__` и `__CACHE_SCOPE__` заменяются в готовом
 * файле на хуке `closeBundle`. Имя кэша становится уникальным для каждой
 * сборки → браузер видит новый sw.js, активирует его и удаляет кэши прошлых
 * версий.
 *
 * Значения берутся из окружения:
 *   VITE_BUILD_VERSION — номер прогона деплой-воркфлоу (CI задаёт github.run_number);
 *   GH_PAGES_BASE      — базовый путь; "/SharoBoy/beta/" даёт префикс "beta-",
 *                        корень сайта — пустой префикс.
 * В локальной сборке версия — "dev", префикс пустой.
 */
function serviceWorkerVersion() {
  return {
    name: "sharoboy:sw-version",
    apply: "build",
    closeBundle() {
      const version = process.env.VITE_BUILD_VERSION || "dev"
      const base = process.env.GH_PAGES_BASE || "/"
      // Префикс scope — сегменты пути после имени репозитория; они разводят
      // кэши стабильной и бета-сборок, живущих на одном origin.
      // /SharoBoy/      → ""        (стабильная версия)
      // /SharoBoy/beta/ → "beta-"   (бета-версия)
      const segments = base.split("/").filter(Boolean)
      const scope = segments.length > 1 ? `${segments.slice(1).join("-")}-` : ""
      // outDir повторяет base в проде (GH_PAGES_BASE), но надёжнее взять файл
      // из корня dist: public/ всегда копируется туда.
      const file = path.resolve("dist", "sw.js")
      if (!fs.existsSync(file)) return
      const source = fs.readFileSync(file, "utf8")
      const patched = source
        .replaceAll("__CACHE_SCOPE__", scope)
        .replaceAll("__CACHE_VERSION__", version)
      if (patched !== source) fs.writeFileSync(file, patched, "utf8")
    },
  }
}

// Базовый путь сборки:
//   локальный дев-сервер:                      "/"
//   GitHub Pages, стабильная версия (main):    "/SharoBoy/"  (CI=true)
//   GitHub Pages, бета-версия (beta):          "/SharoBoy/beta/"  (задаётся
//     переменной GH_PAGES_BASE в .github/workflows/deploy.yml)
export default defineConfig({
  base: process.env.GH_PAGES_BASE || (process.env.CI ? "/SharoBoy/" : "/"),
  plugins: [react(), tailwindcss(), serviceWorkerVersion()],

  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
  test: {
    testTimeout: 15000,
  },
})
