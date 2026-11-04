import { TIER } from "../palette"
import type { Block } from "../types"

import { bboxOf, type Ctx } from "./shapes"

/** Насколько пластины панциря «дышат» со временем (амплитуда подъёма, px). */
const SHELL_BREATH = 2

/**
 * «Панцирный краб» (T-058, переделка T-063): широкий корпус, ТРИ отдельных
 * щитка на спине, две клешни-пинцеры на вынесенных «предплечьях» и восемь
 * ходильных ног по четыре на сторону.
 *
 * Клешня рисуется наружу от корпуса: предплечье → ладонь → два широких
 * пальца, раскрытых в характерную «V». Ось пинцера смотрит вниз-наружу,
 * поэтому он читается как клешня, а не как нарост у панциря.
 */
export function drawCrab(ctx: Ctx, parts: Block[], time: number) {
  const body = parts.filter((p) => p.mbPart === "crab_body")
  const shells = parts.filter((p) => p.mbPart === "shell").sort((a, b) => a.x - b.x)
  const claws = parts.filter((p) => p.mbPart === "claw")
  const gap = parts.find((p) => p.mbPart === "gap") ?? null
  const eyes = parts.filter((p) => p.mbPart === "eye")
  if (!body.length || !shells.length) return

  const flash = Math.max(...parts.map((p) => p.flash))
  const breathe = Math.sin(time * 1.6) * SHELL_BREATH
  const b = bboxOf(body)
  const cx = b.x + b.w / 2
  const midY = b.y + b.h / 2

  drawLegs(ctx, b, cx, midY, time)
  drawCarapace(ctx, b, cx, midY)

  for (const c of claws) {
    const outward = c.x >= cx ? 1 : -1
    ctx.save()
    // Ось наружу: локальный +x — направление «от тела».
    ctx.translate(c.x, c.y)
    ctx.scale(outward, 1)
    drawPincer(ctx, c.rx, c.ry, time)
    ctx.restore()
  }

  if (gap) drawGap(ctx, gap, time)

  // панцирь: три пластины, посаженные ВПЛОТНУЮ — единый купол с двумя швами.
  // Боковые щитки рисуются под центральным, поэтому стык читается линией, а не
  // зазором между отдельными «ракушками». Все три лежат на одной линии: прежний
  // сдвиг боковых пластин вниз давал перекошенный купол.
  const order = shells.length === 3 ? [0, 2, 1] : shells.map((_, i) => i)
  for (const idx of order) {
    const s = shells[idx]!
    const isCenter = idx === 1 || shells.length !== 3
    ctx.save()
    ctx.translate(s.x, s.y + breathe * (isCenter ? 1 : 0.65))
    ctx.rotate(s.rot)
    drawPlate(ctx, s.rx, s.ry, isCenter)
    ctx.restore()
  }
  // швы поверх всех пластин: граница купола должна быть непрерывной линией.
  // Пары берём по порядку слева-направо ([0,1] и [1,2]) — обход `order` дал бы
  // второй шов между правой и центральной пластиной под неверным углом.
  const byX = shells.slice().sort((a, b) => a.x - b.x)
  for (let i = 1; i < byX.length; i++) drawSeam(ctx, byX[i - 1]!, byX[i]!, breathe)

  for (const e of eyes) drawEye(ctx, e)

  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.45
    ctx.beginPath()
    ctx.ellipse(cx, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

/**
 * Ходильные ноги: по четыре на сторону, каждая из двух сегментов (бедро вверх-
 * наружу, голень вниз), с суставом-точкой. Соседние ноги шагают в противофазе.
 * Раньше это были 5 коротких чёрточек, торчавших из-под корпуса.
 */
function drawLegs(
  ctx: Ctx,
  b: { x: number; y: number; w: number; h: number },
  cx: number,
  midY: number,
  time: number
) {
  ctx.strokeStyle = TIER[2].dark
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const spread = 0.26 + i * 0.14
      const hipX = cx + side * b.w * spread
      const hipY = midY + b.h * 0.22
      const lift = Math.sin(time * 2.2 + i * 1.1 + (side < 0 ? Math.PI : 0)) * 3
      // бедро уходит вверх-наружу, голень — вниз: характерная «арка» ноги
      const kneeX = hipX + side * (13 + i * 3)
      const kneeY = hipY - 7 + lift
      const footX = kneeX + side * (7 + i * 2)
      const footY = kneeY + 19 + lift * 0.4
      ctx.lineWidth = 4.2
      ctx.beginPath()
      ctx.moveTo(hipX, hipY)
      ctx.lineTo(kneeX, kneeY)
      ctx.stroke()
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(kneeX, kneeY)
      ctx.lineTo(footX, footY)
      ctx.stroke()
      // сустав
      ctx.beginPath()
      ctx.arc(kneeX, kneeY, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = TIER[2].dark
      ctx.fill()
    }
  }
}

/** Корпус: сплюснутый овал с объёмным градиентом, под панцирем и клешнями. */
function drawCarapace(
  ctx: Ctx,
  b: { x: number; y: number; w: number; h: number },
  cx: number,
  midY: number
) {
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  bg.addColorStop(0, TIER[2].light)
  bg.addColorStop(0.55, TIER[2].base)
  bg.addColorStop(1, TIER[2].dark)
  ctx.beginPath()
  ctx.ellipse(cx, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = TIER[2].dark
  ctx.lineWidth = 1.6
  ctx.stroke()
  // нижняя тень — корпус «садится» на ноги
  ctx.globalAlpha = 0.25
  ctx.beginPath()
  ctx.ellipse(cx, midY + b.h * 0.3, b.w * 0.36, b.h * 0.2, 0, 0, Math.PI * 2)
  ctx.fillStyle = TIER[2].dark
  ctx.fill()
  ctx.globalAlpha = 1
}

/**
 * Клешня-пинцер, вид сбоку. Локальный +x — наружу от корпуса.
 *
 * Анатомия, которую нужно было нарисовать (и которой не хватало):
 * 1) короткое предплечье у корпуса (локальный −x);
 * 2) отделённая от него **ладонь** — массивное основание клешни;
 * 3) два **широких плоских пальца**, расходящихся в «V»: верхний изогнут
 *    вниз крюком, нижний — вверх; между ними хорошо читаемый просвет;
 * 4) кончики пальцев почти сходятся — именно это читается как «клешня».
 *
 * Пальцы поворачиваются вокруг основания в противофазе, поэтому клешня
 * «щёлкает». Раньше здесь были эллипс и два узких крюка, из-за чего силуэт
 * читался как куриное крыло.
 */
function drawPincer(ctx: Ctx, rx: number, ry: number, time: number) {
  const edge = TIER[2].dark
  const shell = ctx.createLinearGradient(0, -ry, 0, ry)
  shell.addColorStop(0, TIER[3].light)
  shell.addColorStop(0.45, TIER[2].base)
  shell.addColorStop(1, TIER[2].dark)

  // 1. предплечье — от корпуса к ладони
  ctx.beginPath()
  ctx.moveTo(-rx * 0.55, -ry * 0.34)
  ctx.lineTo(-rx * 1.25, -ry * 0.5)
  ctx.lineTo(-rx * 1.25, ry * 0.5)
  ctx.lineTo(-rx * 0.55, ry * 0.34)
  ctx.closePath()
  ctx.fillStyle = shell
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.2
  ctx.stroke()

  // 2. ладонь — массивное основание
  ctx.beginPath()
  ctx.ellipse(-rx * 0.1, 0, rx * 0.62, ry * 0.92, 0, 0, Math.PI * 2)
  ctx.fillStyle = shell
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.3
  ctx.stroke()
  // блик на ладони
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.ellipse(-rx * 0.2, -ry * 0.35, rx * 0.3, ry * 0.3, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1

  const open = 0.5 + 0.5 * Math.sin(time * 1.7)
  const base = { x: rx * 0.34, y: 0 }

  // 3a. верхний палец (неподвижный крюк) — изгиб вниз, к оси
  ctx.save()
  ctx.translate(base.x, base.y)
  ctx.rotate(-0.1 - open * 0.08)
  ctx.beginPath()
  ctx.moveTo(0, -ry * 0.82)
  ctx.quadraticCurveTo(rx * 0.75, -ry * 0.72, rx * 1.05, -ry * 0.12)
  ctx.quadraticCurveTo(rx * 1.16, ry * 0.02, rx * 1.02, ry * 0.1)
  ctx.quadraticCurveTo(rx * 0.82, -ry * 0.16, rx * 0.42, -ry * 0.3)
  ctx.quadraticCurveTo(rx * 0.14, -ry * 0.4, 0, -ry * 0.34)
  ctx.closePath()
  ctx.fillStyle = shell
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()

  // 3b. нижний палец (подвижный дактиль) — изгиб вверх, зеркально верхнему
  ctx.save()
  ctx.translate(base.x, base.y)
  ctx.rotate(0.1 + open * 0.14)
  ctx.beginPath()
  ctx.moveTo(0, ry * 0.82)
  ctx.quadraticCurveTo(rx * 0.75, ry * 0.72, rx * 1.05, ry * 0.12)
  ctx.quadraticCurveTo(rx * 1.16, -ry * 0.02, rx * 1.02, -ry * 0.1)
  ctx.quadraticCurveTo(rx * 0.82, ry * 0.16, rx * 0.42, ry * 0.3)
  ctx.quadraticCurveTo(rx * 0.14, ry * 0.4, 0, ry * 0.34)
  ctx.closePath()
  ctx.fillStyle = shell
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()

  // сустав у основания пальцев
  ctx.beginPath()
  ctx.arc(base.x, 0, Math.max(1.4, ry * 0.12), 0, Math.PI * 2)
  ctx.fillStyle = edge
  ctx.fill()
}

/**
 * Уязвимая щель: **вентиляционная прорезь** в нижней части корпуса — узкая
 * горизонтальная щель с зубцами внутри. Не круглая и не овальная: круглая
 * форма читалась как второй глаз.
 */
function drawGap(ctx: Ctx, gap: Block, time: number) {
  const glow = 0.5 + 0.5 * Math.sin(time * 3.1)
  const w = gap.rx
  const h = gap.ry * 0.75
  // контур: заострённые концы, ровные кромки — «прорезь», а не глаз
  ctx.beginPath()
  ctx.moveTo(gap.x - w, gap.y)
  ctx.quadraticCurveTo(gap.x - w * 0.35, gap.y - h, gap.x, gap.y - h * 0.9)
  ctx.quadraticCurveTo(gap.x + w * 0.35, gap.y - h, gap.x + w, gap.y)
  ctx.quadraticCurveTo(gap.x + w * 0.35, gap.y + h, gap.x, gap.y + h * 0.9)
  ctx.quadraticCurveTo(gap.x - w * 0.35, gap.y + h, gap.x - w, gap.y)
  ctx.closePath()
  ctx.fillStyle = `rgba(3, 10, 16, ${0.92 + glow * 0.06})`
  ctx.fill()
  ctx.strokeStyle = `rgba(125, 211, 252, ${0.5 + glow * 0.45})`
  ctx.lineWidth = 1.4
  ctx.stroke()

  // зубцы-перемычки внутри прорези: сразу читается как решётка/вентиляция
  ctx.strokeStyle = `rgba(125, 211, 252, ${0.35 + glow * 0.35})`
  ctx.lineWidth = 1.1
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath()
    ctx.moveTo(gap.x + w * k, gap.y - h * 0.85)
    ctx.lineTo(gap.x + w * k, gap.y + h * 0.85)
    ctx.stroke()
  }
}

/** Глаз на коротком стебельке: белок, радужка, зрачок и блик. */
function drawEye(ctx: Ctx, e: Block) {
  const r = e.rx
  // стебелёк
  ctx.beginPath()
  ctx.moveTo(e.x, e.y + r * 2.2)
  ctx.lineTo(e.x, e.y + r * 0.9)
  ctx.strokeStyle = TIER[2].dark
  ctx.lineWidth = 2.2
  ctx.lineCap = "round"
  ctx.stroke()
  // белок
  ctx.beginPath()
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
  ctx.fillStyle = "#f4fbff"
  ctx.fill()
  ctx.strokeStyle = "rgba(4, 18, 26, 0.8)"
  ctx.lineWidth = 1.1
  ctx.stroke()
  // зрачок смотрит вниз-вперёд (к ракетке)
  ctx.beginPath()
  ctx.arc(e.x, e.y + r * 0.3, r * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = "#071820"
  ctx.fill()
  // блик
  ctx.beginPath()
  ctx.arc(e.x - r * 0.25, e.y + r * 0.1, r * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  ctx.fill()
}

/**
 * Щиток панциря: выгнутая верхняя кромка, ребро-киль и тёмная кромка по низу.
 *
 * Пластины садятся вплотную и перекрываются, поэтому собственный «шов» внутри
 * щитка больше не рисуется: он давал три отдельные замкнутые ракушки с зазором
 * (замечание 04.11.2026). Границу между пластинами рисует `drawSeam` — один
 * непрерывный шов поверх купола.
 */
function drawPlate(ctx: Ctx, rx: number, ry: number, isCenter: boolean) {
  ctx.beginPath()
  ctx.moveTo(-rx, ry * 0.24)
  ctx.quadraticCurveTo(-rx * 0.9, -ry * 1.02, 0, -ry * 1.12)
  ctx.quadraticCurveTo(rx * 0.9, -ry * 1.02, rx, ry * 0.24)
  // нижняя кромка чуть вогнута: пластина «лежит» на корпусе
  ctx.quadraticCurveTo(rx * 0.45, ry * 0.92, 0, ry * 1.0)
  ctx.quadraticCurveTo(-rx * 0.45, ry * 0.92, -rx, ry * 0.24)
  ctx.closePath()
  const sg = ctx.createLinearGradient(0, -ry, 0, ry)
  sg.addColorStop(0, TIER[3].light)
  sg.addColorStop(0.5, TIER[3].base)
  sg.addColorStop(1, TIER[3].dark)
  ctx.fillStyle = sg
  ctx.fill()
  ctx.strokeStyle = TIER[3].dark
  ctx.lineWidth = isCenter ? 2 : 1.7
  ctx.stroke()

  // киль — ребро жёсткости по центру пластины
  ctx.beginPath()
  ctx.moveTo(0, -ry * 1.0)
  ctx.quadraticCurveTo(rx * 0.12, 0, 0, ry * 0.95)
  ctx.strokeStyle = "rgba(4, 18, 26, 0.4)"
  ctx.lineWidth = 1.4
  ctx.stroke()

  // заклёпки у кромки
  ctx.fillStyle = "rgba(4, 18, 26, 0.5)"
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath()
    ctx.arc(rx * k, ry * 0.24, 1.7, 0, Math.PI * 2)
    ctx.fill()
  }

  // блик
  ctx.globalAlpha = 0.28
  ctx.beginPath()
  ctx.ellipse(-rx * 0.3, -ry * 0.5, rx * 0.4, ry * 0.22, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1
}

/**
 * Шов между двумя соседними пластинами: короткая тёмная дуга по месту стыка.
 *
 * Считается из геометрии блоков (общая середина между центрами, высота — по
 * меньшему из щитков), поэтому следует за любым изменением `shell` в данных
 * и не дублирует построение контура щитка.
 */
function drawSeam(ctx: Ctx, left: Block, right: Block, breathe: number) {
  const x = (left.x + right.x) / 2
  const y = (left.y + right.y) / 2 + breathe * 0.8
  const ry = Math.min(left.ry, right.ry)
  const tilt = Math.abs((right.rot ?? 0) - (left.rot ?? 0))
  ctx.beginPath()
  ctx.moveTo(x + ry * 0.1, y - ry * 1.02)
  ctx.quadraticCurveTo(x - ry * 0.16 - tilt * ry * 2, y, x + ry * 0.1, y + ry * 0.98)
  ctx.strokeStyle = "rgba(4, 18, 26, 0.8)"
  ctx.lineWidth = 1.8
  ctx.lineCap = "round"
  ctx.stroke()
}
