import { TIER } from "../palette"
import type { Block } from "../types"

import type { Ctx } from "./shapes"

/** Волна тела: амплитуда у хвоста, px. */
const WAVE_AMP = 3.4
/** Частота волны (рад/с) — гребень бежит от носа к хвосту, как у живой рыбы. */
const WAVE_FREQ = 2.3
/** Сдвиг фазы между соседними частями тела: чем больше, тем «змеинее» волна. */
const WAVE_PHASE_STEP = 0.85
/** Полувысота силуэта относительно радиуса блока — тело чуть тоньше хитбокса. */
const BODY_FLATTEN = 0.94

interface Point {
  x: number
  y: number
}

interface Node extends Point {
  ry: number
}

/**
 * «Скользкий угорь» (T-058, доработка T-063): гладкое змеевидное тело из
 * цельного контура, голова с пастью, глазом и жаберной щелью, спинной гребень
 * и сужающийся хвост с плавником.
 *
 * Силуэт рисуется в отражённой системе координат по `mbFacing`: нос всегда
 * смотрит по ходу движения, поэтому угорь не «плывёт задом» и разворачивается
 * у стен. Тело зеркально симметрично (см. `buildEel`), поэтому отражение
 * попадает ровно в те же эллипсы, что и физика.
 */
export function drawEel(ctx: Ctx, parts: Block[], time: number) {
  const head = parts.find((p) => p.mbPart === "eel_head")
  const fin = parts.find((p) => p.mbPart === "eel_fin")
  const segs = parts.filter((p) => p.mbPart === "eel_seg")
  if (!head || !segs.length) return

  // От носа к хвосту; хвост последний, поэтому волна бежит назад.
  const spine = (fin ? [head, ...segs, fin] : [head, ...segs]).sort((a, b) => b.x - a.x)
  const left = Math.min(...spine.map((p) => p.x - p.rx))
  const right = Math.max(...spine.map((p) => p.x + p.rx))
  const cx = (left + right) / 2
  const flash = Math.max(...parts.map((p) => p.flash))

  const nodes: Node[] = spine.map((p, i) => {
    const k = i / Math.max(1, spine.length - 1)
    const wave = Math.sin(time * WAVE_FREQ - i * WAVE_PHASE_STEP) * WAVE_AMP * (0.3 + 0.7 * k)
    return { x: p.x - cx, y: p.y + wave, ry: p.ry * BODY_FLATTEN }
  })
  const midY = nodes.reduce((s, n) => s + n.y, 0) / nodes.length

  ctx.save()
  // Отражение вокруг центра существа: локальный +x — всегда «вперёд».
  ctx.translate(cx, 0)
  ctx.scale(head.mbFacing ?? 1, 1)

  // 1. Тело: цельный контур из верхней и нижней кромок узлов — без «швов»
  //    между блоками, силуэт не распадается на отдельные эллипсы.
  const topEdge = nodes.map((n) => ({ x: n.x, y: n.y - n.ry }))
  const bottomEdge = nodes.map((n) => ({ x: n.x, y: n.y + n.ry })).reverse()
  ctx.beginPath()
  traceSmooth(ctx, topEdge, true)
  traceSmooth(ctx, bottomEdge, false)
  ctx.closePath()
  const bodyGrad = ctx.createLinearGradient(0, midY - head.ry, 0, midY + head.ry)
  bodyGrad.addColorStop(0, TIER[1].dark)
  bodyGrad.addColorStop(0.45, TIER[1].base)
  bodyGrad.addColorStop(1, TIER[1].light)
  ctx.fillStyle = bodyGrad
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.2
  ctx.stroke()

  // 2. Боковая линия — тонкий светлый пунктир вдоль оси: «скользкая» фактура.
  ctx.beginPath()
  traceSmooth(
    ctx,
    nodes.map((n) => ({ x: n.x, y: n.y + n.ry * 0.15 })),
    true
  )
  ctx.setLineDash([5, 7])
  ctx.strokeStyle = "rgba(234, 255, 244, 0.4)"
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.setLineDash([])

  // 3. Спинной и подхвостовой гребни: непрерывная складка по задней половине.
  const ridgeFrom = Math.floor(nodes.length * 0.35)
  const ridgeTop = nodes.slice(ridgeFrom).map((n) => ({ x: n.x, y: n.y - n.ry * 0.92 }))
  const ridgeBottom = nodes.slice(ridgeFrom).map((n) => ({ x: n.x, y: n.y + n.ry * 0.92 }))
  strokeFringe(ctx, ridgeTop, -1, "rgba(93, 255, 176, 0.5)")
  strokeFringe(ctx, ridgeBottom, 1, "rgba(234, 255, 244, 0.35)")

  drawTail(ctx, nodes[nodes.length - 1]!, time)
  drawHead(ctx, head, nodes[0]!, time)

  // 4. Вспышка урона — по эллипсам частей, а не по контуру.
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.45
    ctx.fillStyle = "#ffffff"
    for (const n of nodes) {
      ctx.beginPath()
      ctx.ellipse(n.x, n.y, n.ry * 1.3, n.ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

/** Плавная ломаная по серединам отрезков; `begin` — начинать ли новый путь. */
function traceSmooth(ctx: Ctx, pts: Point[], begin: boolean) {
  if (!pts.length) return
  if (begin) ctx.moveTo(pts[0]!.x, pts[0]!.y)
  else ctx.lineTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const cur = pts[i]!
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2)
  }
  const last = pts[pts.length - 1]!
  ctx.lineTo(last.x, last.y)
}

/** Гребень-складка вдоль кромки тела: мягкая волна наружу от оси. */
function strokeFringe(ctx: Ctx, pts: Point[], side: number, color: string) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const cur = pts[i]!
    ctx.quadraticCurveTo(
      prev.x,
      prev.y + side * 2.4,
      (prev.x + cur.x) / 2,
      (prev.y + cur.y) / 2 + side * 1.2
    )
  }
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = color
  ctx.lineWidth = 2.4
  ctx.stroke()
}

/**
 * Хвост: сужение в остриё с плавником-«лопатой». Рисуется одной замкнутой
 * формой — раньше две вращающиеся лопасти читались как «ножницы».
 */
function drawTail(ctx: Ctx, tail: Node, time: number) {
  const wag = Math.sin(time * 3.1) * 0.16
  ctx.save()
  ctx.translate(tail.x, tail.y)
  ctx.rotate(wag)
  const ry = tail.ry
  // Кончик не длиннее хитбокса хвоста + 4 px: у стены плавник не срезается.
  const tip = -ry * 1.5
  ctx.beginPath()
  ctx.moveTo(ry * 0.3, -ry * 0.95)
  ctx.quadraticCurveTo(tip * 0.55, -ry * 1.45, tip, -ry * 0.1)
  ctx.quadraticCurveTo(tip * 0.6, ry * 0.95, ry * 0.3, ry * 0.95)
  ctx.quadraticCurveTo(ry * 0.1, 0, ry * 0.3, -ry * 0.95)
  ctx.closePath()
  const finGrad = ctx.createLinearGradient(0, -ry, 0, ry)
  finGrad.addColorStop(0, TIER[1].base)
  finGrad.addColorStop(0.5, TIER[1].light)
  finGrad.addColorStop(1, TIER[1].base)
  ctx.fillStyle = finGrad
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.1
  ctx.stroke()
  // луч плавника
  ctx.beginPath()
  ctx.moveTo(ry * 0.2, 0)
  ctx.quadraticCurveTo(tip * 0.5, 0, tip * 0.92, -ry * 0.05)
  ctx.strokeStyle = "rgba(4, 18, 26, 0.35)"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

/** Голова: клин-морда, пасть, глаз с бликом и жаберная щель. */
function drawHead(ctx: Ctx, head: Block, node: Node, time: number) {
  const rx = head.rx
  const ry = head.ry
  ctx.save()
  ctx.translate(node.x, node.y)

  // вытянутая морда: клин вперёд, чуть шире блока на кончике
  ctx.beginPath()
  ctx.moveTo(-rx * 0.2, -ry * 0.9)
  ctx.quadraticCurveTo(rx * 0.85, -ry * 0.86, rx * 1.12, -ry * 0.06)
  ctx.quadraticCurveTo(rx * 1.0, ry * 0.6, rx * 0.1, ry * 0.95)
  ctx.quadraticCurveTo(-rx * 0.65, ry * 0.9, -rx * 0.98, 0)
  ctx.quadraticCurveTo(-rx * 0.65, -ry * 0.9, -rx * 0.2, -ry * 0.9)
  ctx.closePath()
  const headGrad = ctx.createLinearGradient(0, -ry, 0, ry)
  headGrad.addColorStop(0, TIER[1].light)
  headGrad.addColorStop(0.55, TIER[1].base)
  headGrad.addColorStop(1, TIER[1].dark)
  ctx.fillStyle = headGrad
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.3
  ctx.stroke()

  // блик «скользкости» вдоль спины
  ctx.globalAlpha = 0.34 + 0.12 * Math.sin(time * 2.8)
  ctx.beginPath()
  ctx.ellipse(-rx * 0.1, -ry * 0.42, rx * 0.5, ry * 0.24, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1

  // пасть: от кончика морды назад к углу челюсти
  ctx.beginPath()
  ctx.moveTo(rx * 1.04, ry * 0.1)
  ctx.quadraticCurveTo(rx * 0.62, ry * 0.42, rx * 0.2, ry * 0.5)
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.5
  ctx.lineCap = "round"
  ctx.stroke()

  // жаберная щель за головой
  ctx.beginPath()
  ctx.moveTo(-rx * 0.42, -ry * 0.5)
  ctx.quadraticCurveTo(-rx * 0.68, 0, -rx * 0.38, ry * 0.58)
  ctx.strokeStyle = "rgba(4, 18, 26, 0.45)"
  ctx.lineWidth = 1.2
  ctx.stroke()

  // глаз: чуть выше оси и ближе к морде
  const eyeX = rx * 0.46
  const eyeY = -ry * 0.3
  const eyeR = ry * 0.28
  ctx.beginPath()
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2)
  ctx.fillStyle = "#eaf7ff"
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(eyeX + eyeR * 0.28, eyeY, eyeR * 0.52, 0, Math.PI * 2)
  ctx.fillStyle = "#04121c"
  ctx.fill()
  // блик зрачка — смотрит в сторону движения (локальный +x)
  ctx.beginPath()
  ctx.arc(eyeX + eyeR * 0.5, eyeY - eyeR * 0.12, eyeR * 0.16, 0, Math.PI * 2)
  ctx.fillStyle = "#eaf7ff"
  ctx.fill()

  ctx.restore()
}
