import { TIER } from "../palette"
import type { Block } from "../types"

import { bboxOf, type Ctx } from "./shapes"

/** Насколько пластины панциря «дышат» со временем (амплитуда подъёма, px). */
const SHELL_BREATH = 2.2
/** Наклон клешни: пинцер смотрит вниз-наружу, к ракетке. */
const CLAW_TILT = 0.8

/**
 * «Панцирный краб» (T-058, доработка T-063): приземистый корпус на четырёх
 * парах ног, ТРИ отдельных щитка панциря на спине, две настоящие клешни-пинцеры
 * (ладонь + два пальца с просветом) и светящаяся щель — единственная уязвимая
 * точка, пока броня цела.
 *
 * Пластины рисуются каждая в своей системе координат и с тёмным швом по нижней
 * кромке: раньше три перекрывающихся купола сливались в один.
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

  // 1. Ноги: четыре пары, бедро + голень, шагают вразнобой.
  ctx.strokeStyle = TIER[2].dark
  ctx.lineCap = "round"
  ctx.lineWidth = 3
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const hipX = cx + side * b.w * (0.3 + i * 0.11)
      const hipY = midY + b.h * 0.28
      const step = Math.sin(time * 2.4 + i * 0.9 + (side < 0 ? Math.PI : 0)) * 2.4
      const kneeX = hipX + side * (11 + i * 2)
      const kneeY = hipY + 9
      ctx.beginPath()
      ctx.moveTo(hipX, hipY)
      ctx.lineTo(kneeX, kneeY)
      ctx.lineTo(kneeX + side * 3, kneeY + 12 + step)
      ctx.stroke()
    }
  }

  // 2. Корпус: сплюснутый овал с градиентом (под панцирем и клешнями).
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  bg.addColorStop(0, TIER[2].light)
  bg.addColorStop(0.6, TIER[2].base)
  bg.addColorStop(1, TIER[2].dark)
  ctx.beginPath()
  ctx.ellipse(cx, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = TIER[2].dark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // 3. Клешни: ладонь пинцера и два пальца с просветом между ними.
  for (const c of claws) {
    // Левая клешня — зеркальная копия правой: локальный +x всегда наружу.
    const outward = c.x >= cx ? 1 : -1
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.scale(outward, 1)
    ctx.rotate(CLAW_TILT)
    drawPincer(ctx, c.rx, c.ry, time)
    ctx.restore()
  }

  // 4. Щель между клешнями: тёмная впадина с бегущим бликом — уязвимая точка.
  if (gap) {
    const glow = 0.5 + 0.5 * Math.sin(time * 3.1)
    ctx.beginPath()
    ctx.ellipse(gap.x, gap.y, gap.rx, gap.ry, 0, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(6, 24, 36, ${0.75 + glow * 0.15})`
    ctx.fill()
    ctx.strokeStyle = `rgba(125, 211, 252, ${0.45 + glow * 0.45})`
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // 5. Панцирь: боковые щитки под центральным — три пластины, три шва.
  const plateOrder = shells.length === 3 ? [0, 2, 1] : shells.map((_, i) => i)
  for (const idx of plateOrder) {
    const s = shells[idx]!
    ctx.save()
    const lift = breathe * (idx === 1 ? 1 : 0.55)
    const sink = idx === 1 ? 0 : 2
    ctx.translate(s.x, s.y + lift + sink)
    ctx.rotate(s.rot)
    drawPlate(ctx, s.rx, s.ry, idx === 1)
    ctx.restore()
  }

  // 6. Глаза на стебельках поверх панциря.
  for (const e of eyes) {
    ctx.beginPath()
    ctx.moveTo(e.x, e.y + e.ry * 2.6)
    ctx.lineTo(e.x, e.y + e.ry)
    ctx.strokeStyle = TIER[2].dark
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.rx, 0, Math.PI * 2)
    ctx.fillStyle = "#eaf7ff"
    ctx.fill()
    ctx.strokeStyle = TIER[2].dark
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(e.x + e.rx * 0.25, e.y, e.rx * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = "#04121c"
    ctx.fill()
  }

  // 7. Вспышка урона по всему телу.
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.5
    ctx.beginPath()
    ctx.ellipse(cx, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

/**
 * Настоящая клешня-пинцер: «предплечье» к корпусу, ладонь и два пальца —
 * неподвижный крюк и подвижный дактиль, который открывается и закрывается.
 * Раньше это был просто эллипс с вырезом, из-за чего клешня читалась как
 * бесформенное пятно.
 */
function drawPincer(ctx: Ctx, rx: number, ry: number, time: number) {
  const edge = TIER[2].dark
  const grad = ctx.createLinearGradient(0, -ry, 0, ry)
  grad.addColorStop(0, TIER[3].light)
  grad.addColorStop(0.5, TIER[2].base)
  grad.addColorStop(1, TIER[2].dark)

  // «предплечье»: сужается к корпусу (локальный −x)
  ctx.beginPath()
  ctx.moveTo(-rx * 1.15, -ry * 0.42)
  ctx.quadraticCurveTo(-rx * 0.45, -ry * 0.72, rx * 0.12, -ry * 0.4)
  ctx.lineTo(rx * 0.12, ry * 0.4)
  ctx.quadraticCurveTo(-rx * 0.45, ry * 0.72, -rx * 1.15, ry * 0.42)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.3
  ctx.stroke()

  // ладонь
  const palmX = rx * 0.12
  const palmRx = rx * 0.62
  const palmRy = ry * 0.8
  ctx.beginPath()
  ctx.ellipse(palmX, 0, palmRx, palmRy, 0, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.3
  ctx.stroke()

  // неподвижный палец — изогнутый крюк над просветом
  ctx.beginPath()
  ctx.moveTo(palmX + palmRx * 0.2, -palmRy * 0.62)
  ctx.quadraticCurveTo(palmX + palmRx * 1.1, -palmRy * 0.72, palmX + palmRx * 1.62, -palmRy * 0.1)
  ctx.quadraticCurveTo(palmX + palmRx * 1.02, -palmRy * 0.26, palmX + palmRx * 0.16, -palmRy * 0.1)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.2
  ctx.stroke()

  // подвижный палец (дактиль): поворачивается, как у живого краба
  const open = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(time * 2.1))
  ctx.save()
  ctx.translate(palmX + palmRx * 0.24, palmRy * 0.05)
  ctx.rotate(open)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(palmRx * 0.72, palmRy * 0.3, palmRx * 1.5, palmRy * 0.14)
  ctx.quadraticCurveTo(palmRx * 0.8, -palmRy * 0.02, 0, -palmRy * 0.26)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()
}

/**
 * Щиток панциря: выгнутая верхняя кромка, киль по центру и тёмный шов по
 * нижнему краю. Шов обязателен — без него соседние пластины сливаются.
 */
function drawPlate(ctx: Ctx, rx: number, ry: number, isCenter: boolean) {
  ctx.beginPath()
  ctx.moveTo(-rx, ry * 0.3)
  ctx.quadraticCurveTo(-rx * 0.92, -ry * 0.95, 0, -ry * 1.05)
  ctx.quadraticCurveTo(rx * 0.92, -ry * 0.95, rx, ry * 0.3)
  ctx.quadraticCurveTo(rx * 0.46, ry * 1.12, 0, ry * 1.18)
  ctx.quadraticCurveTo(-rx * 0.46, ry * 1.12, -rx, ry * 0.3)
  ctx.closePath()
  const sg = ctx.createLinearGradient(0, -ry, 0, ry)
  sg.addColorStop(0, TIER[3].light)
  sg.addColorStop(0.55, TIER[3].base)
  sg.addColorStop(1, TIER[3].dark)
  ctx.fillStyle = sg
  ctx.fill()
  ctx.strokeStyle = TIER[3].dark
  ctx.lineWidth = isCenter ? 1.9 : 1.6
  ctx.stroke()

  // киль — ребро жёсткости по центру пластины
  ctx.beginPath()
  ctx.moveTo(0, -ry * 0.95)
  ctx.quadraticCurveTo(rx * 0.14, 0, 0, ry * 1.05)
  ctx.strokeStyle = "rgba(4, 18, 26, 0.42)"
  ctx.lineWidth = 1.4
  ctx.stroke()

  // шов по нижней кромке: граница между пластинами
  ctx.beginPath()
  ctx.moveTo(-rx * 0.9, ry * 0.42)
  ctx.quadraticCurveTo(0, ry * 1.42, rx * 0.9, ry * 0.42)
  ctx.strokeStyle = "rgba(4, 18, 26, 0.8)"
  ctx.lineWidth = 2
  ctx.stroke()

  // заклёпки у кромки
  ctx.fillStyle = "rgba(4, 18, 26, 0.55)"
  for (const k of [-0.55, 0, 0.55]) {
    ctx.beginPath()
    ctx.arc(rx * k, ry * 0.32, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // блик
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.ellipse(-rx * 0.28, -ry * 0.42, rx * 0.4, ry * 0.24, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1
}
