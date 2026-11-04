#!/usr/bin/env node
/**
 * Подбор ПРОПОРЦИЙ тела угря: длина к толщине и длина носа.
 *
 * Почему отдельный стенд: форма носа не решает проблему, пока тело в 3 раза
 * толще, чем у настоящего угря. Расчёт (04.11.2026):
 *   в игре  — длина/толщина 4:1,  нос 15% длины
 *   реально — длина/толщина 20:1, нос 5-8% длины
 * При 4:1 любой профиль носа читается как «сигара с шипом».
 *
 * Стенд рисует одну и ту же форму при разных пропорциях, чтобы выбрать
 * отношение глазами и перенести его в `buildEel` (SEG_STEP / SEG_RADII).
 *
 *   node scripts/preview-eel-proportions.mjs
 *   node scripts/preview-eel-proportions.mjs --keep
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const stand = join(root, ".tmp-prop")
const outDir = join(stand, "out")
const buildDir = join(stand, "build")
const keep = process.argv.slice(2).includes("--keep")

const MAIN_TS = `const W = 1400
const H = 1000

const canvas = document.createElement("canvas")
canvas.width = W
canvas.height = H
document.body.appendChild(canvas)
const ctx = canvas.getContext("2d")!
ctx.fillStyle = "#04121c"
ctx.fillRect(0, 0, W, H)

const SEG_RADII = [9, 13, 15.5, 17, 15.5, 13, 9]
const CAP_RY = 15

/** Варианты: SEG_STEP (шаг) и длина носа в шагах. Радиусы те же, что в игре. */
const VARIANTS = [
  { step: 20, nose: 1.0, label: "текущий 4:1" },
  { step: 30, nose: 0.9, label: "удлинённый 6:1" },
  { step: 40, nose: 0.8, label: "8:1" },
  { step: 52, nose: 0.7, label: "10:1" },
  { step: 68, nose: 0.6, label: "13:1" },
]

function traceSmooth(pts, begin) {
  if (pts.length < 2) return
  if (begin) ctx.moveTo(pts[0].x, pts[0].y)
  else ctx.lineTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last.x, last.y)
}

function drawVariant(v, cy) {
  const bodyLen = (SEG_RADII.length - 1) * v.step
  // Центрируем по X в левой половине кадра.
  const totalLen = bodyLen + v.step * v.nose * 2
  const startX = 40 + (620 - totalLen) / 2

  // Узлы: нос → тело → хвост (симметрично, как в buildEel).
  const nodes = []
  const noseLen = v.step * v.nose
  const NOSE_N = 5
  for (let i = NOSE_N; i >= 1; i--) {
    const t = i / NOSE_N
    const ry = CAP_RY * Math.pow(1 - t * t, 0.75)
    nodes.push({ x: startX + noseLen * (1 - t), y: cy, ry })
  }
  SEG_RADII.forEach((r, i) => {
    nodes.push({ x: startX + noseLen + i * v.step, y: cy, ry: r })
  })
  // хвост: симметричное сужение
  for (let i = 1; i <= NOSE_N; i++) {
    const t = i / NOSE_N
    const ry = CAP_RY * Math.pow(1 - t * t, 0.75)
    nodes.push({ x: startX + noseLen + bodyLen + noseLen * t, y: cy, ry })
  }

  const top = nodes.map((n) => ({ x: n.x, y: n.y - n.ry }))
  const bottom = nodes.map((n) => ({ x: n.x, y: n.y + n.ry }))

  ctx.beginPath()
  traceSmooth(top, true)
  traceSmooth(bottom.slice().reverse(), false)
  ctx.closePath()

  const g = ctx.createLinearGradient(0, cy - 17, 0, cy + 17)
  g.addColorStop(0, "#0b6b45")
  g.addColorStop(0.45, "#2fe08a")
  g.addColorStop(1, "#0b6b45")
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = "#0b6b45"
  ctx.lineWidth = 1.2
  ctx.stroke()

  // глаз у головы
  const headNode = nodes[NOSE_N]
  ctx.beginPath()
  ctx.arc(headNode.x + 4, headNode.y - 8, 2.4, 0, Math.PI * 2)
  ctx.fillStyle = "#0a2b20"
  ctx.fill()

  const ratio = ((bodyLen + noseLen * 2) / (Math.max(...SEG_RADII) * 2)).toFixed(1)
  ctx.fillStyle = "rgba(220,255,245,0.9)"
  ctx.font = "600 15px monospace"
  ctx.fillText(v.label, 660, cy - 4)
  ctx.fillStyle = "rgba(150,200,185,0.7)"
  ctx.font = "12px monospace"
  ctx.fillText("step " + v.step + " · " + ratio + ":1", 660, cy + 14)
}

VARIANTS.forEach((v, i) => drawVariant(v, 100 + i * 190))

document.title = "preview ready"
`

const INDEX_HTML = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>eel proportions</title>
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

const viteBin = join(root, "node_modules", "vite", "bin", "vite.js")
const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: "pipe", encoding: "utf8" })

rmSync(buildDir, { recursive: true, force: true })
mkdirSync(stand, { recursive: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(join(stand, "main.ts"), MAIN_TS, "utf8")
writeFileSync(join(stand, "index.html"), INDEX_HTML, "utf8")

console.log("Сборка стенда…")
run(process.execPath, [viteBin, "build", stand, "--outDir", "build", "--logLevel", "warn"], root)

const indexPath = join(buildDir, "index.html")
const html = readFileSync(indexPath, "utf8").replace(/src="\/assets\//g, 'src="./assets/')
writeFileSync(indexPath, html, "utf8")

const browser = findBrowser()
const shot = join(outDir, "eel-proportions.png")
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
    "--window-size=1400,1000",
    "--virtual-time-budget=8000",
    url,
  ],
  root
)
console.log("Готово:", shot)

if (!keep) rmSync(buildDir, { recursive: true, force: true })
