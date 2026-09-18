/**
 * Пиксельный рендеринг игровой сцены — чистые функции над Canvas 2D.
 * Вся логика состояния остаётся в Game; сюда передаются снимки данных.
 */
import { POWER_META, TIER } from "./palette"
import type {
  Ball,
  Block,
  BossState,
  Bubble,
  MouthBubble,
  PaddleShapeKind,
  PaddleState,
  Particle,
  Popup,
  PowerUp,
  Projectile,
  RenderView,
  Ring,
} from "./types"
import { Physics } from "./physics"
import { clamp, rotatedExtents } from "./utils"

type Ctx = CanvasRenderingContext2D

/** Скруглённый прямоугольник (строит путь, без заливки/обводки). */
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function drawBackground(ctx: Ctx, w: number, h: number, combo: number, bubbles: Bubble[]) {
  const heat = clamp(combo / 12, 0, 1)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "#0e3a4e")
  g.addColorStop(0.5, "#082434")
  g.addColorStop(1, "#04121c")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  if (heat > 0.02) {
    const rg = ctx.createRadialGradient(w / 2, 0, 40, w / 2, 0, Math.max(w, h) * 0.8)
    rg.addColorStop(0, `rgba(255,201,77,${0.14 * heat})`)
    rg.addColorStop(0.5, `rgba(53,224,255,${0.08 * heat})`)
    rg.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, w, h)
  }
  for (const b of bubbles) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(140,220,255,0.07)"
    ctx.fill()
    ctx.strokeStyle = "rgba(140,220,255,0.12)"
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

export function drawShieldLine(
  ctx: Ctx,
  w: number,
  h: number,
  time: number,
  shield: number,
  hidden: boolean
) {
  if (shield <= 0 || hidden) return
  const y = h - 14
  const a = 0.5 + Math.sin(time * 6) * 0.18
  const g = ctx.createLinearGradient(0, y - 9, 0, y + 9)
  g.addColorStop(0, "rgba(77,255,158,0)")
  g.addColorStop(0.5, `rgba(77,255,158,${a})`)
  g.addColorStop(1, "rgba(77,255,158,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, y - 9, w, 18)
  ctx.shadowColor = "#4dff9e"
  ctx.shadowBlur = 9
  for (let i = 0; i < shield; i++) {
    const px = w / 2 + (i - (shield - 1) / 2) * 15
    ctx.beginPath()
    ctx.arc(px, y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = "#4dff9e"
    ctx.fill()
  }
  ctx.shadowBlur = 0
}

function drawBomb(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const pulse = 0.6 + Math.sin(time * 9 + b.seed) * 0.4
  ctx.save()
  const g = ctx.createRadialGradient(x - b.rx * 0.3, y - b.ry * 0.35, 2, x, y, b.rx * 1.2)
  g.addColorStop(0, "#5a6b78")
  g.addColorStop(0.55, "#2b3a45")
  g.addColorStop(1, "#101b22")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, b.rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = "#ff8a3d"
  ctx.shadowBlur = 14 * pulse
  ctx.strokeStyle = `rgba(255,138,61,${0.45 + pulse * 0.4})`
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.shadowBlur = 0
  // фитиль
  ctx.strokeStyle = "#8a6b4a"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x, y - b.ry)
  ctx.quadraticCurveTo(x + 7, y - b.ry - 8, x + 12, y - b.ry - 4)
  ctx.stroke()
  ctx.fillStyle = `rgba(255,220,120,${pulse})`
  ctx.beginPath()
  ctx.arc(x + 12, y - b.ry - 4, 3 + pulse * 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/* ---------- мини-боссы: специализированная отрисовка силуэтов ---------- */

/** Габариты группы частей существа. */
interface MbBox {
  x: number
  y: number
  w: number
  h: number
}

function bboxOf(parts: Block[]): MbBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of parts) {
    minX = Math.min(minX, p.x - p.rx)
    maxX = Math.max(maxX, p.x + p.rx)
    minY = Math.min(minY, p.y - p.ry)
    maxY = Math.max(maxY, p.y + p.ry)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Частота sway рыбы — синхронизирована с buildFish (minibosses.ts). */
const FISH_SWAY_FREQ = 0.45

/**
 * Направление взгляда рыбы [-1..1]: скорость патруля ∝ cos(time·freq).
 * Разворот быстрый и гладкий: рыба почти всё время смотрит по ходу движения
 * и за ~0.35 с переходит через середину — без долгого «схлопывания».
 */
export function fishFacing(parts: Block[], time: number): number {
  const f = parts.find((p) => p.mbPart === "body")?.swayFreq ?? 0
  if (!f) return 1
  // tanh резко спрямляет cos у нуля: ширина зоны перехода подобрана так,
  // чтобы флип занимал ~0.35 с при частоте патруля рыбы
  return Math.tanh(Math.cos(time * f) * 48)
}

/** Рыба: анимированные хвост и плавники, рот; части собираются по тегам. */
function drawFish(ctx: Ctx, parts: Block[], time: number) {
  const body = parts.filter((p) => p.mbPart === "body")
  const tail = parts.filter((p) => p.mbPart === "tail")
  const dorsal = parts.find((p) => p.mbPart === "dorsal")
  const pectoral = parts.find((p) => p.mbPart === "pectoral")
  const eye = parts.find((p) => p.mbPart === "eye")
  if (!body.length || !tail.length) return
  const b = bboxOf(body)
  const t = bboxOf(tail)
  const midY = b.y + b.h / 2
  const flash = Math.max(...parts.map((p) => p.flash))
  // разворот: быстрый гладкий флип по X вокруг центра тела + лёгкое
  // округление по Y в момент поворота — контур меняется непрерывно
  const facing = fishFacing(parts, time)
  const fx = b.x + b.w / 2
  const sx = (Math.sign(facing) || 1) * Math.max(Math.abs(facing), 0.25)
  const sy = 1 + 0.2 * (1 - Math.abs(facing))
  ctx.save()
  ctx.translate(fx, midY)
  ctx.scale(sx, sy)
  ctx.translate(-fx, -midY)
  // хвост отстаёт от корпуса: рыба плывёт по синусоиде, хвост качается в противофазе
  const swing = -Math.cos(time * FISH_SWAY_FREQ) * 0.17 + Math.sin(time * 2.1) * 0.035
  const jointX = b.x + b.w * 0.05
  const L = (jointX - (t.x - t.w * 0.15)) * 1.25 + 20
  const H = t.h * 1.6 + 22

  ctx.save()
  ctx.translate(jointX, midY)
  ctx.rotate(swing)
  // массивный раздвоенный хвост: две лопасти с выемкой, плавные кривые
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-L * 0.42, -H * 0.34, -L, -H * 0.74)
  ctx.quadraticCurveTo(-L * 0.5, -H * 0.16, -L * 0.46, 0)
  ctx.quadraticCurveTo(-L * 0.5, H * 0.16, -L, H * 0.74)
  ctx.quadraticCurveTo(-L * 0.42, H * 0.34, 0, 0)
  ctx.closePath()
  const tg = ctx.createLinearGradient(-L, -H * 0.7, 0, H * 0.7)
  tg.addColorStop(0, TIER[1].light)
  tg.addColorStop(1, TIER[1].dark)
  ctx.fillStyle = tg
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.45
    ctx.fillStyle = "#ffffff"
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // спинной плавник: колышется рябью
  if (dorsal) {
    const ripple = Math.sin(time * 2.3) * 3.5
    ctx.beginPath()
    ctx.moveTo(dorsal.x - dorsal.rx * 1.35, b.y + 8)
    ctx.quadraticCurveTo(
      dorsal.x - dorsal.rx * 0.3,
      dorsal.y - dorsal.ry * 0.95,
      dorsal.x + ripple,
      dorsal.y - dorsal.ry * 1.45
    )
    ctx.quadraticCurveTo(
      dorsal.x + dorsal.rx * 0.55,
      dorsal.y - dorsal.ry * 0.35,
      dorsal.x + dorsal.rx * 1.35,
      b.y + 8
    )
    ctx.closePath()
    ctx.fillStyle = TIER[1].base
    ctx.fill()
    ctx.strokeStyle = TIER[1].dark
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // тело: цельный вытянутый овал — одна замкнутая кривая без стыков:
  // максимальная высота ближе к голове, плавное сужение к хвосту
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  bg.addColorStop(0, TIER[2].light)
  bg.addColorStop(0.55, TIER[2].base)
  bg.addColorStop(1, TIER[2].dark)
  ctx.fillStyle = bg
  const noseX = b.x + b.w
  const tailX = b.x + b.w * 0.03
  const topH = b.h * 0.5
  const peakX = b.x + b.w * 0.62 // самое высокое сечение
  ctx.beginPath()
  // верхняя кромка: нос → спина → сужение к хвосту
  ctx.moveTo(noseX, midY)
  ctx.bezierCurveTo(
    noseX - b.w * 0.02,
    midY - topH * 0.7,
    peakX + b.w * 0.1,
    midY - topH,
    peakX,
    midY - topH
  )
  ctx.bezierCurveTo(
    peakX - b.w * 0.28,
    midY - topH,
    tailX + b.w * 0.08,
    midY - topH * 0.55,
    tailX,
    midY - topH * 0.3
  )
  // хвостовой торец
  ctx.lineTo(tailX, midY + topH * 0.3)
  // нижняя кромка: зеркало верхней
  ctx.bezierCurveTo(
    tailX + b.w * 0.08,
    midY + topH * 0.55,
    peakX - b.w * 0.28,
    midY + topH,
    peakX,
    midY + topH
  )
  ctx.bezierCurveTo(
    peakX + b.w * 0.1,
    midY + topH,
    noseX - b.w * 0.02,
    midY + topH * 0.7,
    noseX,
    midY
  )
  ctx.closePath()
  ctx.fill()
  // брюшная тень для объёма
  ctx.globalAlpha = 0.16
  ctx.fillStyle = TIER[2].dark
  ctx.beginPath()
  ctx.ellipse(b.x + b.w * 0.45, midY + b.h * 0.28, b.w * 0.38, b.h * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // жабры: дуга ближе к голове
  ctx.beginPath()
  ctx.ellipse(b.x + b.w * 0.66, midY, b.w * 0.085, b.h * 0.34, 0, -1.15, 1.15)
  ctx.strokeStyle = "rgba(176,114,10,0.75)"
  ctx.lineWidth = 1.5
  ctx.stroke()

  // грудной плавник: гребёт с небольшой амплитудой
  if (pectoral) {
    const row = Math.sin(time * 2.7 + 0.8) * 0.3
    ctx.save()
    ctx.translate(pectoral.x - 3, pectoral.y - 2)
    ctx.rotate(pectoral.rot + row)
    ctx.beginPath()
    ctx.ellipse(pectoral.rx, 0, pectoral.rx * 1.3, pectoral.ry * 0.8, 0, 0, Math.PI * 2)
    ctx.fillStyle = TIER[1].base
    ctx.fill()
    ctx.strokeStyle = TIER[1].dark
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  // рот: шарнирная нижняя челюсть у самого носа. Тёмная полость — это вырез
  // в передней части головы: верхняя дуга неподвижна, нижняя кромка полости —
  // повернутая линия смыкания, и лоскут челюсти рисуется ровно по ней,
  // поэтому челюсть, губа и полость всегда сомкнуты без щелей
  const open = Math.max(0, Math.sin(time * 0.85))
  const phi = open * 0.3 // угол открытия челюсти, рад (~17°)
  const p0x = b.x + b.w * 0.78 // шарнир (угол рта)
  const p0y = midY + b.h * 0.1
  const lx = b.x + b.w * 0.985 // кончик губ у самого носа
  const ly = midY + b.h * 0.04
  const midX = (p0x + lx) / 2
  const midM = (p0y + ly) / 2
  const rot = (x: number, y: number) => {
    const dx = x - p0x
    const dy = y - p0y
    const c = Math.cos(phi)
    const s = Math.sin(phi)
    return { x: p0x + dx * c - dy * s, y: p0y + dx * s + dy * c }
  }
  const li = rot(lx, ly)
  const ci = rot(midX, midM + b.h * 0.03)
  // полость: заметно тёмный клин между верхней дугой и челюстью
  ctx.beginPath()
  ctx.moveTo(p0x, p0y)
  ctx.quadraticCurveTo(midX, midM - b.h * 0.05, lx, ly)
  ctx.quadraticCurveTo(ci.x, ci.y, li.x, li.y)
  ctx.closePath()
  const cg = ctx.createLinearGradient(0, p0y - 4, 0, p0y + 14)
  cg.addColorStop(0, "#8a1a24")
  cg.addColorStop(1, "#1a0305")
  ctx.fillStyle = cg
  ctx.fill()
  // нижняя челюсть-лоскут: тот же шарнир, тот же угол, что у кромки полости
  ctx.save()
  ctx.translate(p0x, p0y)
  ctx.rotate(phi)
  ctx.translate(-p0x, -p0y)
  ctx.beginPath()
  ctx.moveTo(p0x, p0y)
  ctx.quadraticCurveTo(midX, midM + b.h * 0.03, lx, ly) // линия смыкания рта
  ctx.quadraticCurveTo(midX + b.w * 0.02, p0y + b.h * 0.14, p0x, p0y + b.h * 0.16) // подбородок
  ctx.closePath()
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = "rgba(0,0,0,0.25)" // тень под челюстью — отделяет её от головы
  ctx.lineWidth = 1.2
  ctx.stroke()
  // губы по линии смыкания: складка и влажный блик — едут вместе с челюстью
  for (const pass of [
    { w: 3.2, c: "rgba(122,74,8,0.85)" },
    { w: 1.2, c: "rgba(255,214,140,0.6)" },
  ]) {
    ctx.beginPath()
    ctx.moveTo(p0x, p0y)
    ctx.quadraticCurveTo(midX, midM + b.h * 0.03, lx, ly)
    ctx.strokeStyle = pass.c
    ctx.lineWidth = pass.w
    ctx.stroke()
  }
  ctx.restore()
  // верхняя губа: неподвижные складка и блик по верхней дуге
  for (const pass of [
    { w: 3.2, c: "rgba(122,74,8,0.85)" },
    { w: 1.2, c: "rgba(255,214,140,0.6)" },
  ]) {
    ctx.beginPath()
    ctx.moveTo(p0x, p0y)
    ctx.quadraticCurveTo(midX, midM - b.h * 0.05, lx, ly)
    ctx.strokeStyle = pass.c
    ctx.lineWidth = pass.w
    ctx.stroke()
  }

  // глаз: белок, зрачок (смещён к носу), блик
  if (eye) {
    const r = eye.rx * 1.7
    ctx.beginPath()
    ctx.arc(eye.x, eye.y, r, 0, Math.PI * 2)
    ctx.fillStyle = "#f4feff"
    ctx.fill()
    ctx.strokeStyle = "rgba(4,18,28,0.6)"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(eye.x + r * 0.28, eye.y, r * 0.52, 0, Math.PI * 2)
    ctx.fillStyle = "#04121c"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(eye.x + r * 0.1, eye.y - r * 0.24, r * 0.16, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
  }

  // вспышка урона на теле (хвост вспыхивает в своём блоке выше)
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.5
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.ellipse(b.x + b.w / 2, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

/** Медуза: пульсирующий купол и волнующиеся щупальца-цепочки. */
function drawJelly(ctx: Ctx, parts: Block[], time: number) {
  const domeBig = parts.filter((p) => p.mbPart === "dome")
  const fringe = parts.filter((p) => p.mbPart === "fringe")
  const tents = parts.filter((p) => p.mbPart === "tentacle")
  if (!domeBig.length) return
  const d = bboxOf(domeBig)
  const cx = d.x + d.w / 2
  const flash = Math.max(...parts.map((p) => p.flash))
  // пульс: купол сжимается по ширине и вытягивается по высоте, низ на месте
  const pulse = Math.sin(time * 2.2)
  const w = d.w * (1 + 0.05 * pulse)
  const h = d.h * (1 - 0.07 * pulse)
  const left = cx - w / 2
  const right = cx + w / 2
  const top = d.y + d.h - h
  const bottom = d.y + d.h

  // щупальца: цепочки, качающиеся волной с амплитудой, растущей к кончикам
  const sorted = [...tents].sort((a, b) => a.x - b.x || a.y - b.y)
  const chains: Block[][] = []
  for (const p of sorted) {
    const last = chains[chains.length - 1]
    if (last && p.x - last[0].x < 9) last.push(p)
    else chains.push([p])
  }
  ctx.lineCap = "round"
  for (let ci = 0; ci < chains.length; ci++) {
    const chain = chains[ci]
    if (chain.length < 2) continue
    const base = [...chain].sort((a, b) => a.y - b.y)
    const pts = base.map((p, i) => ({
      x: p.x + Math.sin(time * 2.4 + ci * 0.9 + i * 0.85) * (2.5 + i * 2.8),
      y: p.y + Math.cos(time * 2.2 + ci * 0.9 + i * 0.85) * 1.6 * i,
    }))
    for (const pass of [
      { width: 5, color: "rgba(15,143,91,0.35)" },
      { width: 2.5, color: TIER[1].base },
    ]) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1].x + pts[i].x) / 2
        const my = (pts[i - 1].y + pts[i].y) / 2
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.strokeStyle = pass.color
      ctx.lineWidth = pass.width
      ctx.stroke()
    }
  }

  // купол: верх — гладкая арка, низ — фестоны, всё дышит пульсом
  ctx.beginPath()
  ctx.moveTo(left, bottom)
  const n = 7
  const wseg = w / n
  for (let i = 0; i < n; i++) {
    const sx = left + wseg * i
    ctx.quadraticCurveTo(sx + wseg / 2, bottom + 9 + pulse * 2, sx + wseg, bottom)
  }
  ctx.bezierCurveTo(right, top + h * 0.35, right - w * 0.28, top, cx, top)
  ctx.bezierCurveTo(left + w * 0.28, top, left, top + h * 0.35, left, bottom)
  ctx.closePath()
  const dg = ctx.createLinearGradient(0, top, 0, bottom)
  dg.addColorStop(0, TIER[3].light)
  dg.addColorStop(0.6, TIER[3].base)
  dg.addColorStop(1, TIER[3].dark)
  ctx.fillStyle = dg
  ctx.fill()
  ctx.strokeStyle = TIER[3].dark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // бахрома по нижнему краю — следует за пульсом по ширине
  for (const f of fringe) {
    ctx.beginPath()
    ctx.arc(cx + (f.x - cx) * (w / d.w), f.y, f.rx, 0, Math.PI * 2)
    ctx.fillStyle = TIER[3].base
    ctx.fill()
    ctx.strokeStyle = TIER[3].dark
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // блик внутри купола — чуть дышит вместе с пульсом
  ctx.globalAlpha = 0.3 + 0.08 * pulse
  ctx.beginPath()
  ctx.ellipse(cx - w * 0.12, top + h * 0.38, w * 0.22, h * 0.16, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1

  // вспышка урона
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.5
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.ellipse(cx, top + h * 0.55, w / 2, h * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

/**
 * Отрисовка минибоссов: блоки существа не рисуются генериком, вместо этого
 * части собираются в реалистичный силуэт (рыба/медуза) по тегам mbPart.
 * time нужен для анимации плавников/хвоста рыбы и пульса медузы.
 */
export function drawMinibosses(ctx: Ctx, blocks: Block[], time: number) {
  const parts = blocks.filter((b) => b.isMiniboss && !b.dead && b.mbPart)
  if (!parts.length) return
  if (parts.some((p) => p.mbPart === "dome")) drawJelly(ctx, parts, time)
  else drawFish(ctx, parts, time)
}

/** Пузырьк�� воздуха изо рта рыбы: поднимаются, покачиваясь, и лопаются. */
export function drawMouthBubbles(ctx: Ctx, bubbles: MouthBubble[]) {
  for (const b of bubbles) {
    const a = Math.max(0, 1 - b.t / b.life)
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(234,247,255,0.14)"
    ctx.fill()
    ctx.strokeStyle = "rgba(234,247,255,0.75)"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.32, Math.max(b.r * 0.22, 0.7), 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * Полоска HP над мини-боссом: общий пул существа по текущим границам его
 * блоков. Ничего не рисует, если минибосса нет или он уже уничтожен.
 */
export function drawMinibossBar(ctx: Ctx, hp: number, maxHp: number, blocks: Block[]) {
  if (hp <= 0 || maxHp <= 0) return
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  for (const b of blocks) {
    if (!b.isMiniboss || b.dead) continue
    minX = Math.min(minX, b.x - b.rx)
    maxX = Math.max(maxX, b.x + b.rx)
    minY = Math.min(minY, b.y - b.ry)
  }
  if (minX > maxX) return
  const w = maxX - minX
  const x = minX
  const y = minY - 18
  const pct = clamp(hp / maxHp, 0, 1)
  // подложка
  ctx.fillStyle = "rgba(4,16,26,0.78)"
  roundRect(ctx, x - 2, y - 2, w + 4, 12, 6)
  ctx.fill()
  // заполнение: зелёный → жёлтый → розовый по остатку HP
  ctx.fillStyle = pct > 0.5 ? "#5dffb0" : pct > 0.25 ? "#ffc94d" : "#ff5ca8"
  if (pct > 0.02) {
    roundRect(ctx, x, y, Math.max(w * pct, 4), 8, 4)
    ctx.fill()
  }
  // рамка
  ctx.strokeStyle = "rgba(234,247,255,0.55)"
  ctx.lineWidth = 1
  roundRect(ctx, x - 2, y - 2, w + 4, 12, 6)
  ctx.stroke()
}

export function drawBlocks(ctx: Ctx, blocks: Block[], time: number) {
  for (const b of blocks) {
    if (b.dead) continue
    // Минибоссы рисуются специализированным рендером (drawMinibosses).
    if (b.isMiniboss) continue
    if (b.bomb) {
      drawBomb(ctx, b, b.x, b.y, time)
      continue
    }
    const x = b.x + Math.sin(time * 0.9 + b.seed) * 1.4
    const y = b.y + Math.cos(time * 0.8 + b.seed) * 1.4
    const tier = TIER[b.tier]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.rot)
    ctx.scale(b.rx, b.ry)
    const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15)
    g.addColorStop(0, tier.light)
    g.addColorStop(0.5, tier.base)
    g.addColorStop(1, tier.dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2.5 / Math.max(b.rx, b.ry)
    ctx.strokeStyle = "rgba(4,18,26,0.55)"
    ctx.stroke()
    if (b.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // трещины
    const dmg = b.maxHp - b.hp
    if (dmg > 0) {
      ctx.strokeStyle = "rgba(4,18,26,0.5)"
      ctx.lineWidth = 1.6
      for (let i = 0; i < dmg; i++) {
        const a0 = b.seed + i * 2.1
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a0) * b.rx * 0.2, y + Math.sin(a0) * b.ry * 0.2)
        ctx.lineTo(x + Math.cos(a0 + 0.5) * b.rx * 0.75, y + Math.sin(a0 + 0.5) * b.ry * 0.75)
        ctx.lineTo(x + Math.cos(a0 + 0.9) * b.rx * 0.55, y + Math.sin(a0 + 0.9) * b.ry * 0.55)
        ctx.stroke()
      }
    }

    // пипсы HP
    if (b.maxHp > 1 && b.hp > 1) {
      ctx.fillStyle = "rgba(4,18,26,0.75)"
      for (let i = 0; i < b.hp; i++) {
        ctx.beginPath()
        ctx.arc(x + (i - (b.hp - 1) / 2) * 8, y + b.ry * 0.55, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // «матрёшка»: мини-шарики внутри
    if (b.splits) {
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      for (let i = 0; i < 3; i++) {
        const aa = b.seed + (i * Math.PI * 2) / 3 + time * 0.9
        ctx.beginPath()
        ctx.ellipse(
          x + Math.cos(aa) * b.rx * 0.36,
          y + Math.sin(aa) * b.ry * 0.36,
          Math.max(3, b.rx * 0.17),
          Math.max(3, b.ry * 0.17),
          0,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    }
  }
}

export function drawBoss(ctx: Ctx, boss: BossState | null, balls: Ball[], blocks: Block[]) {
  const bo = boss
  if (!bo) return
  const angry = bo.hp < bo.maxHp * 0.4
  ctx.save()
  ctx.translate(bo.x, bo.y)
  const frac = clamp(bo.hp / bo.maxHp, 0, 1)
  ctx.lineWidth = 6
  ctx.strokeStyle = "rgba(4,18,26,0.7)"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
  ctx.stroke()
  ctx.shadowColor = angry ? "#ff5347" : "#ff5ca8"
  ctx.shadowBlur = 30
  const g = ctx.createRadialGradient(-bo.r * 0.35, -bo.r * 0.4, 4, 0, 0, bo.r * 1.2)
  if (angry) {
    g.addColorStop(0, "#ffd9d4")
    g.addColorStop(0.45, "#ff6a5c")
    g.addColorStop(1, "#5a0f08")
  } else {
    g.addColorStop(0, "#ffd0e8")
    g.addColorStop(0.45, "#ff5ca8")
    g.addColorStop(1, "#5a0f3c")
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  if (bo.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.7})`
    ctx.beginPath()
    ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
    ctx.fill()
  }
  // корона
  ctx.fillStyle = "#ffc94d"
  ctx.beginPath()
  const cy0 = -bo.r * 0.92
  ctx.moveTo(-bo.r * 0.42, cy0)
  ctx.lineTo(-bo.r * 0.42, cy0 - bo.r * 0.28)
  ctx.lineTo(-bo.r * 0.2, cy0 - bo.r * 0.1)
  ctx.lineTo(0, cy0 - bo.r * 0.34)
  ctx.lineTo(bo.r * 0.2, cy0 - bo.r * 0.1)
  ctx.lineTo(bo.r * 0.42, cy0 - bo.r * 0.28)
  ctx.lineTo(bo.r * 0.42, cy0)
  ctx.closePath()
  ctx.fill()
  // глаза следят за шаром
  const target = balls.find((b) => !b.stuck)
  let ex = 0
  let ey = 0
  if (target) {
    const dx = target.x - bo.x
    const dy = target.y - bo.y
    const dl = Math.hypot(dx, dy) || 1
    ex = (dx / dl) * bo.r * 0.08
    ey = (dy / dl) * bo.r * 0.08
  }
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.ellipse(sx * bo.r * 0.32, -bo.r * 0.15, bo.r * 0.2, bo.r * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#12222c"
    ctx.beginPath()
    ctx.arc(sx * bo.r * 0.32 + ex, -bo.r * 0.15 + ey, bo.r * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  // рот
  ctx.strokeStyle = "#3c0a26"
  ctx.lineWidth = bo.r * 0.07
  ctx.lineCap = "round"
  ctx.beginPath()
  if (bo.isOctopus) {
    // Выражение лица осьминога зависит от числа живых щупалец.
    // Мёртвые блоки удаляются из blocks, поэтому исходное количество
    // щупалец хранится в bo.totalTentacles.
    // больше половины — улыбка (дуга вверх), половина и меньше —
    // прямая горизонтальная линия, ни одного — грустная дуга (вниз).
    const alive = new Set<number>()
    for (const b of blocks) {
      if (!b.isTentacle || b.dead) continue
      alive.add((b as Block & { tentacleId: number }).tentacleId)
    }
    const total = bo.totalTentacles ?? 1
    if (alive.size === 0) {
      // грусть: дуга вниз
      ctx.arc(0, bo.r * 0.48, bo.r * 0.3, Math.PI + 0.15, Math.PI * 2 - 0.15)
    } else if (alive.size * 2 <= total) {
      // половина щупалец и меньше: прямая горизонтальная линия
      ctx.moveTo(-bo.r * 0.3, bo.r * 0.42)
      ctx.lineTo(bo.r * 0.3, bo.r * 0.42)
    } else {
      // больше половины: улыбка (дуга вверх)
      ctx.arc(0, bo.r * 0.28, bo.r * 0.3, 0.15, Math.PI - 0.15)
    }
  } else if (angry) {
    ctx.moveTo(-bo.r * 0.3, bo.r * 0.42)
    for (let i = 0; i <= 6; i++) {
      ctx.lineTo(-bo.r * 0.3 + (i * bo.r * 0.6) / 6, bo.r * 0.42 + (i % 2 ? bo.r * 0.09 : 0))
    }
  } else {
    ctx.arc(0, bo.r * 0.28, bo.r * 0.3, 0.15, Math.PI - 0.15)
  }
  ctx.stroke()
  ctx.restore()

  // Щупальца осьминога — сегменты-шарики вдоль луча от центра.
  if (bo.isOctopus) {
    const tentacles = blocks.filter((b) => b.isTentacle && !b.dead) as (Block & {
      tentacleId: number
      tentacleSeg: number
    })[]
    const byId = new Map<number, typeof tentacles>()
    for (const t of tentacles) {
      const arr = byId.get(t.tentacleId) ?? []
      arr.push(t)
      byId.set(t.tentacleId, arr)
    }
    const segColor = (t: (typeof tentacles)[0]) => {
      // Цвет сегмента по его собственному здоровью — темнее, когда сегмент повреждён.
      const frac = clamp((t.hp ?? 1) / (t.maxHp ?? 1), 0, 1)
      if (frac > 0.6) return `rgba(93,255,176,${0.85})`
      if (frac > 0.3) return `rgba(255,201,77,${0.8})`
      return `rgba(255,70,70,${0.75})`
    }
    for (const segs of byId.values()) {
      // Рисуем связи между сегментами (линии).
      if (segs.length > 1) {
        segs.sort((a, b) => a.tentacleSeg! - b.tentacleSeg!)
        ctx.strokeStyle = "rgba(40,40,60,0.55)"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(segs[0].x, segs[0].y)
        for (let k = 1; k < segs.length; k++) {
          ctx.lineTo(segs[k].x, segs[k].y)
        }
        ctx.stroke()
      }
      // Рисуем сегменты-шарики.
      for (const seg of segs) {
        const r = seg.rx
        ctx.save()
        ctx.shadowColor = segColor(seg)
        ctx.shadowBlur = 14
        const g = ctx.createRadialGradient(
          seg.x - r * 0.3,
          seg.y - r * 0.3,
          1,
          seg.x,
          seg.y,
          r * 1.2
        )
        g.addColorStop(0, "#ffffff")
        g.addColorStop(0.45, segColor(seg))
        g.addColorStop(1, "rgba(30,20,40,0.55)")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        // У Yank-уцепление с колой — постепенно светится.
        if (seg.hp < seg.maxHp) {
          ctx.fillStyle = `rgba(255,255,255,${(1 - seg.hp / seg.maxHp) * 0.4})`
          ctx.beginPath()
          ctx.arc(seg.x, seg.y, r * 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }
  }
}

export function drawRings(ctx: Ctx, rings: Ring[]) {
  for (const r of rings) {
    const a = clamp(1 - r.t, 0, 1)
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.r + r.t * r.maxR, 0, Math.PI * 2)
    ctx.strokeStyle = r.color
    ctx.lineWidth = 3 * a + 1
    ctx.stroke()
  }
  /* Обязательно сбрасываем: кольца рисуются до бонусов/шара/ракетки, и
     «протёкший» globalAlpha гасил бы их до конца кадра (мигание после
     касаний — ring живёт ~0.4 с и его альфа затухает от 1 до 0). */
  ctx.globalAlpha = 1
}

function drawCoin(ctx: Ctx, pw: PowerUp) {
  const R = 13
  const sx = Math.abs(Math.cos(pw.t * 4.5))
  ctx.save()
  ctx.translate(pw.x, pw.y)
  ctx.scale(Math.max(0.25, sx), 1)
  ctx.shadowColor = "#ffc94d"
  ctx.shadowBlur = 16
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 1, 0, 0, R * 1.15)
  g.addColorStop(0, "#fff3d1")
  g.addColorStop(0.5, "#ffc94d")
  g.addColorStop(1, "#b0720a")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = "#8a5a06"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = "rgba(255,243,209,0.8)"
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = "#8a5a06"
  ctx.font = '700 12px "Russo One", sans-serif'
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("★", 0, 1.5)
  ctx.restore()
}

export function drawPowers(ctx: Ctx, powers: PowerUp[]) {
  for (const pw of powers) {
    const meta = POWER_META[pw.type]
    // столб света сверху в первые мгновения падения
    if (pw.t < 0.5 && pw.y > 0) {
      const a = (0.5 - pw.t) / 0.5
      ctx.fillStyle = meta.color + "30"
      ctx.fillRect(pw.x - 4, 0, 8, pw.y)
      ctx.fillStyle = `rgba(240,255,255,${0.55 * a})`
      ctx.fillRect(pw.x - 1.2, 0, 2.4, pw.y)
    }
    if (pw.type === "coin") {
      drawCoin(ctx, pw)
      continue
    }
    ctx.save()
    ctx.translate(pw.x, pw.y)
    ctx.rotate(Math.sin(pw.t * 5) * 0.12)
    const pulse = 1 + Math.sin(pw.t * 9) * 0.05
    ctx.scale(pulse, pulse)
    ctx.shadowColor = meta.color
    ctx.shadowBlur = 20
    ctx.fillStyle = meta.color
    roundRect(ctx, -24, -16, 48, 32, 16)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = meta.edge
    ctx.lineWidth = 2.5
    roundRect(ctx, -24, -16, 48, 32, 16)
    ctx.stroke()
    ctx.fillStyle = "rgba(255,255,255,0.38)"
    roundRect(ctx, -18, -12.5, 36, 10, 8)
    ctx.fill()
    ctx.fillStyle = "#04121c"
    ctx.font = '700 15px "Russo One", sans-serif'
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(meta.label, 0, 2)
    ctx.restore()
  }
}

/** Снимок данных для отрисовки лазерных лучей. */
export interface LaserBeamView extends RenderView {
  laserUntil: number
  paddle: PaddleState
  blocks: Block[]
  boss: BossState | null
  /** Форма верхней поверхности ракетки: пилоны стоят на ней. */
  shape?: PaddleShapeKind
}

export function drawLaserBeams(ctx: Ctx, v: LaserBeamView) {
  if (v.time >= v.laserUntil || v.hidden) return
  const cyc = v.time % 0.3
  if (cyc >= 0.17) return
  const onAmt = 1 - cyc / 0.17
  const p = v.paddle
  // Пилоны лазера стоят на поверхности формы ракетки (Physics.surfaceAt):
  // купол выше грани, чаша — ниже; над поверхностью пилон торчит на 8px.
  for (const s of [-0.36, 0.36]) {
    const px = p.x + p.w * s
    const dome = Physics.surfaceAt(p.w / 2, s, v.shape ?? "flat", p.h)
    const pylonY = p.y - p.h / 2 - dome - 8
    let hitY = -30
    let best: Block | null = null
    for (const b of v.blocks) {
      if (b.dead) continue
      const e = rotatedExtents(b.rx, b.ry, b.rot)
      if (Math.abs(b.x - px) > e.hw + 3 || b.y + e.hh >= pylonY) continue
      if (!best || b.y > best.y) best = b
    }
    if (best) hitY = best.y + rotatedExtents(best.rx, best.ry, best.rot).hh - 2
    else if (v.boss && Math.abs(v.boss.x - px) < v.boss.r && v.boss.y + v.boss.r < pylonY)
      hitY = v.boss.y + v.boss.r - 2
    const wdt = 2.5 + 5 * onAmt
    ctx.save()
    ctx.globalAlpha = 0.25 * onAmt
    ctx.fillStyle = "#7cf5ff"
    ctx.fillRect(px - wdt * 2.4, hitY, wdt * 4.8, pylonY - hitY)
    ctx.globalAlpha = 0.95 * onAmt
    ctx.shadowColor = "#7cf5ff"
    ctx.shadowBlur = 18
    const g = ctx.createLinearGradient(px - wdt / 2, 0, px + wdt / 2, 0)
    g.addColorStop(0, "rgba(124,245,255,0.1)")
    g.addColorStop(0.5, "#f2ffff")
    g.addColorStop(1, "rgba(124,245,255,0.1)")
    ctx.fillStyle = g
    ctx.fillRect(px - wdt / 2, hitY, wdt, pylonY - hitY)
    ctx.beginPath()
    ctx.arc(px, hitY + 3, 4.5 + 4.5 * onAmt, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(240,255,255,0.95)"
    ctx.fill()
    ctx.restore()
  }
}

export function drawProjectiles(ctx: Ctx, projectiles: Projectile[], time: number) {
  for (const pr of projectiles) {
    ctx.save()
    ctx.translate(pr.x, pr.y)
    ctx.shadowColor = "#ffc94d"
    ctx.shadowBlur = 14
    const g = ctx.createLinearGradient(0, -11, 0, 8)
    g.addColorStop(0, "#ffe9a8")
    g.addColorStop(0.5, "#ffc94d")
    g.addColorStop(1, "#c07f0e")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, -11)
    ctx.quadraticCurveTo(6, -4, 5, 6)
    ctx.lineTo(-5, 6)
    ctx.quadraticCurveTo(-6, -4, 0, -11)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "#ff6a5c"
    ctx.beginPath()
    ctx.moveTo(0, -11)
    ctx.quadraticCurveTo(3.4, -7, 3, -4)
    ctx.lineTo(-3, -4)
    ctx.quadraticCurveTo(-3.4, -7, 0, -11)
    ctx.fill()
    const fl = 6 + Math.sin(time * 42) * 3
    ctx.fillStyle = "#ff8a3d"
    ctx.beginPath()
    ctx.moveTo(-3, 6)
    ctx.lineTo(0, 10 + fl)
    ctx.lineTo(3, 6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

/** Снимок данных для отрисовки шаров. */
export interface BallView extends RenderView {
  fire: boolean
  slow: boolean
  fast: boolean
}

export function drawBalls(ctx: Ctx, balls: Ball[], v: BallView) {
  if (v.hidden) return
  const mode = v.fire
    ? { trail: "rgba(255,138,61,", mid: "#ffe9a8", core: "#ff5347", glow: "#ff8a3d" }
    : v.slow
      ? { trail: "rgba(93,255,176,", mid: "#d2ffee", core: "#2fd98a", glow: "#5dffb0" }
      : v.fast
        ? { trail: "rgba(255,106,92,", mid: "#ffd9d4", core: "#ff5347", glow: "#ff6a5c" }
        : { trail: "rgba(120,240,255,", mid: "#c9f6ff", core: "#38bcd8", glow: "#7cf5ff" }
  for (const b of balls) {
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i]
      const a = (i / b.trail.length) * 0.28
      ctx.beginPath()
      ctx.arc(t.x, t.y, b.r * (0.3 + (i / b.trail.length) * 0.6), 0, Math.PI * 2)
      ctx.fillStyle = `${mode.trail}${a})`
      ctx.fill()
    }
    if (b.stuck) {
      const pr = b.r + 6 + Math.sin(v.time * 6) * 2.5
      const c = Math.PI * 2 * pr
      const n = 18
      const seg = c / n
      ctx.beginPath()
      ctx.arc(b.x, b.y, pr, Math.PI / 2, Math.PI / 2 + Math.PI * 2)
      ctx.strokeStyle = `${mode.trail}0.65)`
      ctx.lineWidth = 2
      ctx.setLineDash([seg * 0.45, seg * 0.55])
      ctx.lineDashOffset = -v.time * 30
      ctx.stroke()
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
    }
    const sq = b.squash * 0.28
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.scale(1 + sq, 1 - sq)
    ctx.shadowColor = mode.glow
    ctx.shadowBlur = 16
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, b.r)
    g.addColorStop(0, "#ffffff")
    g.addColorStop(0.55, mode.mid)
    g.addColorStop(1, mode.core)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, b.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** Снимок данных для отрисовки ракетки (положение + таймеры эффектов). */
export interface PaddleView extends RenderView {
  p: PaddleState
  wideUntil: number
  shrinkUntil: number
  laserUntil: number
  laserArmed: boolean
  rocketUntil: number
  magnetUntil: number
  /** Форма верхней поверхности: «convex» — купол, «concave» — чаша. */
  shape?: PaddleShapeKind
}

export function drawPaddle(ctx: Ctx, v: PaddleView) {
  const p = v.p
  const time = v.time
  const ww = p.w * (1 + p.squash * 0.12)
  const hh = p.h * (1 - p.squash * 0.3)
  ctx.save()
  ctx.translate(p.x, p.y)
  // В режиме отладки ракетка поворачивается по ЛКМ/ПКМ, иначе — лёгкий наклон от скорости
  ctx.rotate(p.rot ?? clamp(p.vx * 0.00011, -0.1, 0.1))
  const wide = time < v.wideUntil
  const shrink = !wide && time < v.shrinkUntil
  ctx.shadowColor = wide ? "#ffc94d" : shrink ? "#ff5347" : "#35e0ff"
  ctx.shadowBlur = 22
  const g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2)
  if (wide) {
    g.addColorStop(0, "#ffe9a8")
    g.addColorStop(0.5, "#ffc94d")
    g.addColorStop(1, "#c07f0e")
  } else if (shrink) {
    g.addColorStop(0, "#ffb8b0")
    g.addColorStop(0.5, "#ff5347")
    g.addColorStop(1, "#8f1d12")
  } else {
    g.addColorStop(0, "#aef7ff")
    g.addColorStop(0.5, "#35e0ff")
    g.addColorStop(1, "#0e86a3")
  }
  ctx.fillStyle = g
  const shape = v.shape ?? "flat"
  if (shape === "convex") {
    // Купол — лента постоянной толщины hh (парабола ∩): верх приподнят,
    // нижняя поверхность — та же дуга, сдвинутая на hh вниз. Торцы скруглены.
    const bump = Physics.convexBump(ww / 2)
    const rr = Math.min(hh * 0.5, 9)
    const cap = bump * 0.16
    const topE = -hh / 2 - cap
    const topC = -hh / 2 - bump
    const botC = topC + hh
    ctx.beginPath()
    ctx.moveTo(-ww / 2 + rr, hh / 2)
    ctx.quadraticCurveTo(-ww / 2, hh / 2, -ww / 2, hh / 2 - rr)
    ctx.lineTo(-ww / 2, -hh / 2 + rr)
    ctx.quadraticCurveTo(-ww / 2, -hh / 2, -ww / 2 + rr * 1.4, topE)
    ctx.quadraticCurveTo(-ww / 4, topC, 0, topC)
    ctx.quadraticCurveTo(ww / 4, topC, ww / 2 - rr * 1.4, topE)
    ctx.quadraticCurveTo(ww / 2, -hh / 2, ww / 2, -hh / 2 + rr)
    ctx.lineTo(ww / 2, hh / 2 - rr)
    ctx.quadraticCurveTo(ww / 2, hh / 2, ww / 2 - rr, hh / 2)
    ctx.quadraticCurveTo(ww / 4, botC, 0, botC)
    ctx.quadraticCurveTo(-ww / 4, botC, -ww / 2 + rr, hh / 2)
    ctx.closePath()
    ctx.fill()
  } else if (shape === "concave") {
    // Чаша — лента постоянной толщины hh, инверсия купола. Верх и низ — дуги ∪
    // (края подняты на bump, центр на грани; низ — та же дуга ниже на hh),
    // торцы — полукруги радиуса hh/2 (как у купола): гладкая капсула-конец.
    const depth = Physics.convexBump(ww / 2)
    const topE = -hh / 2 - depth // край верха (поднят)
    const topC = -hh / 2 // центр верха на грани
    const botE = topE + hh // край низа
    const botC = topC + hh // центр низа
    const hr = hh / 2 // радиус торцового полукруга
    const cy = topE + hr // центр торцов (середина толщины)
    const cxL = -ww / 2 + hr
    const cxR = ww / 2 - hr
    ctx.beginPath()
    // левый торец → верхняя дуга → правый торец
    ctx.moveTo(cxL, topE)
    ctx.quadraticCurveTo(-ww / 4, topC, 0, topC)
    ctx.quadraticCurveTo(ww / 4, topC, cxR, topE)
    ctx.arc(cxR, cy, hr, -Math.PI / 2, Math.PI / 2, false)
    // нижняя дуга (та же ∪-дуга на hh ниже)
    ctx.quadraticCurveTo(ww / 4, botC, 0, botC)
    ctx.quadraticCurveTo(-ww / 4, botC, cxL, botE)
    ctx.arc(cxL, cy, hr, -Math.PI / 2, Math.PI / 2, true)
    ctx.closePath()
    ctx.fill()
  } else {
    roundRect(ctx, -ww / 2, -hh / 2, ww, hh, hh / 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  if (shape === "convex") {
    const bump = Physics.convexBump(ww / 2)
    const topC = -hh / 2 - bump
    ctx.strokeStyle = "rgba(255,255,255,0.45)"
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-ww / 2 + 8, -hh / 2 + 2)
    ctx.quadraticCurveTo(-ww / 4, topC + 5, 0, topC + 3)
    ctx.quadraticCurveTo(ww / 4, topC + 5, ww / 2 - 8, -hh / 2 + 2)
    ctx.stroke()
  } else if (shape === "concave") {
    // Блик вдоль верхней ∪-дуги чаши (зеркало купольного).
    const depth = Physics.convexBump(ww / 2)
    const topE = -hh / 2 - depth
    const topC = -hh / 2
    ctx.strokeStyle = "rgba(255,255,255,0.4)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-ww / 2 + 8, topE + 3)
    ctx.quadraticCurveTo(-ww / 4, topC + 5, 0, topC + 3)
    ctx.quadraticCurveTo(ww / 4, topC + 5, ww / 2 - 8, topE + 3)
    ctx.stroke()
  } else {
    roundRect(ctx, -ww / 2 + 6, -hh / 2 + 2.5, ww - 12, 4, 2)
    ctx.fill()
  }
  // Оси по бокам — у чаши они в центре торцового полукруга (подняты на depth)
  const hubY = shape === "concave" ? -Physics.convexBump(ww / 2) : 0
  ctx.fillStyle = "rgba(4,18,26,0.35)"
  ctx.beginPath()
  ctx.arc(-ww / 2 + hh / 2, hubY, hh * 0.22, 0, Math.PI * 2)
  ctx.arc(ww / 2 - hh / 2, hubY, hh * 0.22, 0, Math.PI * 2)
  ctx.fill()
  const laserOn = time < v.laserUntil
  const rocketOn = time < v.rocketUntil
  // Пилоны оружия (лазер, ракета) стоят на поверхности формы ракетки под
  // своей точкой: Physics.surfaceAt (купол выше грани, чаша — ниже).
  const domeBump = (s: number) => Physics.surfaceAt(ww / 2, s, shape, hh)
  const topAt = (s: number) => -hh / 2 - domeBump(s)
  if (laserOn || v.laserArmed) {
    const charge = !laserOn && v.laserArmed ? 8 + Math.sin(time * 16) * 6 : 10
    ctx.shadowColor = "#7cf5ff"
    ctx.shadowBlur = charge
    ctx.fillStyle = !laserOn && v.laserArmed ? "#5fd8ef" : "#9df2ff"
    for (const s of [-0.36, 0.36]) {
      roundRect(ctx, ww * s - 3, topAt(s) - 9, 6, 10, 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }
  if (rocketOn) {
    const top0 = topAt(0)
    ctx.shadowColor = "#ffc94d"
    ctx.shadowBlur = 10
    ctx.fillStyle = "#ffe9a8"
    roundRect(ctx, -4.5, top0 - 13, 9, 14, 3)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "#ff6a5c"
    ctx.beginPath()
    ctx.arc(0, top0 - 13, 3, Math.PI, 0)
    ctx.fill()
  }
  if (time < v.magnetUntil) {
    const pulse = 0.5 + Math.sin(time * 8) * 0.25
    ctx.strokeStyle = `rgba(77,255,158,${pulse})`
    ctx.lineWidth = 2.5
    ctx.setLineDash([6, 7])
    ctx.lineDashOffset = -time * 30
    ctx.beginPath()
    ctx.arc(0, -hh / 2 - 4, ww * 0.44, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
  }
  ctx.restore()
}

export function drawParticles(ctx: Ctx, particles: Particle[]) {
  for (const p of particles) {
    const a = clamp(p.life / p.maxLife, 0, 1)
    ctx.globalAlpha = a
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function drawPopups(ctx: Ctx, popups: Popup[]) {
  for (const p of popups) {
    const a = clamp(1 - p.t, 0, 1)
    ctx.globalAlpha = a
    ctx.font = `700 ${p.size}px "Russo One", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = p.color
    ctx.shadowBlur = 12
    ctx.fillStyle = p.color
    ctx.fillText(p.text, p.x, p.y)
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1
}
