#!/usr/bin/env node
/**
 * Подбор профиля носа угря: рисует НЕСКОЛЬКО вариантов формы рядом на одном
 * скриншоте, чтобы выбрать вариант глазами и потом перенести его в код ОДИН раз.
 *
 * Зачем отдельный стенд: подбирать коэффициенты вслепую по одному варианту за
 * прогон — это 15 итераций и каждый раз новая деформация. Здесь все профили
 * строятся одной и той же лентой узлов, отличается только функция сужения.
 *
 *   node scripts/preview-eel-nose.mjs
 *   node scripts/preview-eel-nose.mjs --keep
 *
 * Каждый ряд: тело + нос ОДНИМ замкнутым контуром (как должно быть в игре),
 * слева — название профиля и его формула.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const stand = join(root, ".tmp-nose")
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

/**
 * Профили сужения носа: t в [0,1] от кончика к затылку, возвращает множитель
 * радиуса тела. 1 = полная толщина головы, 0 = острие.
 */
const PROFILES = [
  { name: "A current cos", hint: "1 - 0.86*(1-cos(pi*t))/2", fn: (t) => 1 - 0.86 * (1 - Math.cos(Math.PI * t)) / 2 },
  { name: "B linear", hint: "1 - 0.85*t", fn: (t) => 1 - 0.85 * t },
  { name: "C sqrt concave", hint: "0.92*(1-t)^0.55", fn: (t) => 0.92 * Math.pow(1 - t, 0.55) },
  { name: "D quad convex", hint: "(1-t^1.7)^0.9", fn: (t) => Math.pow(1 - Math.pow(t, 1.7), 0.9) },
  { name: "E long taper", hint: "(1-t^2.4)^1.1", fn: (t) => Math.pow(1 - Math.pow(t, 2.4), 1.1) },
]

const BODY = [7.5, 10, 12.5, 14, 14, 12.5, 10, 7.5]
const STEP = 26
const NOSE = 6

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

function drawVariant(profile, cx, cy) {
  const headRy = BODY[0]
  const noseStep = headRy * 0.6
  const nodes = []
  for (let i = NOSE; i >= 1; i--) {
    const t = i / NOSE
    nodes.push({ x: cx + noseStep * i, y: cy, ry: headRy * profile.fn(t) })
  }
  nodes.push({ x: cx, y: cy, ry: headRy })
  for (let i = 1; i < BODY.length; i++) {
    nodes.push({ x: cx - STEP * i, y: cy, ry: BODY[i] })
  }

  const top = nodes.map((n) => ({ x: n.x, y: n.y - n.ry }))
  const bottom = nodes.map((n) => ({ x: n.x, y: n.y + n.ry }))
  const tip = nodes[0]

  ctx.beginPath()
  traceSmooth(top, true)
  const tailPt = bottom[bottom.length - 1]
  ctx.lineTo(tailPt.x, tailPt.y)
  traceSmooth(bottom.slice().reverse(), false)
  ctx.quadraticCurveTo(tip.x - tip.ry * 0.6, tip.y - tip.ry * 0.8, top[0].x, top[0].y)
  ctx.closePath()

  const g = ctx.createLinearGradient(0, cy - 16, 0, cy + 16)
  g.addColorStop(0, "#0b6b45")
  g.addColorStop(0.45, "#2fe08a")
  g.addColorStop(1, "#0b6b45")
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = "#0b6b45"
  ctx.lineWidth = 1.3
  ctx.stroke()

  const eyeX = cx + headRy * 0.1
  const eyeY = cy - headRy * 0.5
  ctx.beginPath()
  ctx.arc(eyeX, eyeY, 2.2, 0, Math.PI * 2)
  ctx.fillStyle = "#0a2b20"
  ctx.fill()

  ctx.fillStyle = "rgba(220,255,245,0.92)"
  ctx.font = "600 15px monospace"
  ctx.fillText(profile.name, 24, cy - 6)
  ctx.fillStyle = "rgba(150,200,185,0.7)"
  ctx.font = "12px monospace"
  ctx.fillText(profile.hint, 24, cy + 12)
}

PROFILES.forEach((p, i) => drawVariant(p, 1000, 90 + i * 185))

// Крупный план: при малом масштабе профили почти не различимы, а форма носа
// читается именно вблизи.
PROFILES.forEach((p, i) => {
  ctx.save()
  ctx.translate(560, 90 + i * 185)
  ctx.scale(3.4, 3.4)
  ctx.translate(-1000, 0)
  drawVariant(p, 1000, 0)
  ctx.restore()
})

document.title = "preview ready"
`

const INDEX_HTML = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>eel nose profiles</title>
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
    "C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
    "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
    "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
    "C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
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
const shot = join(outDir, "eel-nose.png")
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
