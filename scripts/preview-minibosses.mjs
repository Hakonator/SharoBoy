#!/usr/bin/env node
/**
 * Стенд визуальной проверки: рендерит силуэты минибоссов настоящим игровым
 * кодом и снимает скриншот headless-браузером (Chrome/Edge — уже установлены).
 *
 * Зачем: юнит-тесты ловят вылеты за границы, симметрию и число форм, но НЕ
 * ловят «на краба не похоже». Визуальные задачи нельзя закрывать без картинки.
 *
 * Использование:
 *   node scripts/preview-minibosses.mjs                # краб + угорь, 2 масштаба
 *   node scripts/preview-minibosses.mjs --keep         # не удалять .tmp-preview*
 *   node scripts/preview-minibosses.mjs --what=eel     # только угорь
 *
 * Внутри: Vite собирает `.tmp-preview/` во временный каталог, путь к бандлу
 * в index.html переписывается на относительный (иначе file:// даёт пустую
 * страницу), затем headless-браузер пишет PNG в `.tmp-preview/out/`.
 * Готовые PNG открываются инструментом чтения изображений — так и проверяем.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const stand = join(root, ".tmp-preview")
const outDir = join(stand, "out")
const buildDir = join(stand, "build")

const args = process.argv.slice(2)
const keep = args.includes("--keep")
const what = (args.find((a) => a.startsWith("--what=")) ?? "--what=all").split("=")[1]

/** Ищем браузер в стандартных местах Windows. */
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean)
  const found = candidates.find((p) => existsSync(p))
  if (!found) throw new Error("Не найден Chrome/Edge. Задайте CHROME_PATH.")
  return found
}

const MAIN_TS = `import { buildArmoredCrab, buildEel } from "../src/game/minibosses.ts"
import { drawCrab } from "../src/game/render/minibossCrab.ts"
import { drawEel } from "../src/game/render/minibossEel.ts"

const W = 1400
const H = 900
const TOP = 120
// Значение подставляется генератором: query-параметры в file://-URL ломают
// загрузку относительных ассетов в headless-Chrome.
const what = "__WHAT__"

const canvas = document.createElement("canvas")
canvas.width = W
canvas.height = H
document.body.appendChild(canvas)
const ctx = canvas.getContext("2d")!
ctx.fillStyle = "#04121c"
ctx.fillRect(0, 0, W, H)

/** Рисует существо с увеличением вокруг точки — для разбора деталей. */
function zoomed(build, draw, cx, cy, scale) {
  const parts = build(cx)
  // Центр существа по Y: сдвигаем к точке обзора, чтобы масштаб был вокруг него.
  const meanY = parts.reduce((s, p) => s + p.y, 0) / parts.length
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -(meanY + (cy - meanY) / scale))
  draw(ctx, parts, 0.8)
  ctx.restore()
}

if (what === "crab" || what === "all") {
  zoomed((cx) => buildArmoredCrab(W, H, TOP, 1, cx), drawCrab, W * 0.22, 220, 1)
  zoomed((cx) => buildArmoredCrab(W, H, TOP, 2, cx), drawCrab, W * 0.68, 220, 2.4)
}

if (what === "eel" || what === "all") {
  for (const [group, facing, px, targetY] of [
    [3, 1, 0.24, 560],
    [4, -1, 0.72, 760],
  ]) {
    const eel = buildEel(W, H, TOP, group, W * px)
    const meanY = eel.reduce((s, b) => s + b.y, 0) / eel.length
    for (const b of eel) {
      b.y += targetY - meanY
      b.y0 = b.y
      b.mbFacing = facing
    }
    drawEel(ctx, eel, facing === 1 ? 0.8 : 1.9)
  }
}

// Крупный план головы: детали (глаз, рот, стык) не видны в общем масштабе.
{
  const eel = buildEel(W, H, TOP, 9, W * 0.5)
  const meanY = eel.reduce((s, b) => s + b.y, 0) / eel.length
  const head = eel.find((b) => b.mbPart === "eel_head")
  for (const b of eel) {
    b.y += 330 - meanY
    b.y0 = b.y
    b.mbFacing = 1
  }
  ctx.save()
  ctx.translate(W * 0.5, 330)
  ctx.scale(7, 7)
  ctx.translate(-(head.x + 20), -330)
  drawEel(ctx, eel, 0.8)
  ctx.restore()
}

document.title = "preview ready"
`

const INDEX_HTML = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>miniboss preview</title>
    <style>
      html, body { margin: 0; background: #04121c; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
`

/** Vite запускаем через node напрямую: execFileSync("npx.cmd") на Windows → EINVAL. */
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js")
const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: "pipe", encoding: "utf8" })

// 1. готовим стенд
rmSync(buildDir, { recursive: true, force: true })
mkdirSync(stand, { recursive: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(join(stand, "main.ts"), MAIN_TS.replace("__WHAT__", what), "utf8")
writeFileSync(join(stand, "index.html"), INDEX_HTML, "utf8")

// 2. собираем (outDir относительный — Vite кладёт его рядом со стендом)
console.log("Сборка стенда…")
run(process.execPath, [viteBin, "build", stand, "--outDir", "build", "--logLevel", "warn"], root)

// 3. переписываем абсолютный путь к бандлу на относительный: иначе file:// пуст
const indexPath = join(buildDir, "index.html")
const html = readFileSync(indexPath, "utf8").replace(/src="\/assets\//g, 'src="./assets/')
writeFileSync(indexPath, html, "utf8")

// 4. снимок
const browser = findBrowser()
const shot = join(outDir, `minibosses-${what}.png`)
const url = `file:///${indexPath.replace(/\\/g, "/")}`
console.log("Снимок через", browser.split("\\").pop(), "…")
run(
  browser,
  [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    `--screenshot=${shot}`,
    "--window-size=1400,900",
    "--virtual-time-budget=8000",
    url,
  ],
  root
)
console.log("Готово:", shot)

if (!keep) {
  rmSync(buildDir, { recursive: true, force: true })
}
