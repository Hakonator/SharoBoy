import { TIER } from "../palette"
import type { Block } from "../types"

import { bboxOf, type Ctx } from "./shapes"

/** Насколько пластины панциря «дышат» со временем (амплитуда подъёма, px). */
const SHELL_BREATH = 2.5

/**
 * «Панцирный краб» (T-058): приземистый корпус, панцирные пластины сверху,
 * две клешни по бокам и светящаяся щель между ними — уязвимая точка.
 * Пока броня цела, пластины рисуются толстыми и с заклёпками; когда броня
 * снята (`block.flash` и отсутствие брони не различить по блоку), краб
 * остаётся визуально тем же, но щель подсвечивается ярче.
 */
export function drawCrab(ctx: Ctx, parts: Block[], time: number) {
  const body = parts.filter((p) => p.mbPart === "crab_body")
  const shell = parts.filter((p) => p.mbPart === "shell")
  const claws = parts.filter((p) => p.mbPart === "claw")
  const gap = parts.find((p) => p.mbPart === "gap") ?? null
  const eyes = parts.filter((p) => p.mbPart === "eye")
  if (!body.length || !shell.length) return

  const flash = Math.max(...parts.map((p) => p.flash))
  const breathe = Math.sin(time * 1.6) * SHELL_BREATH

  // ноги-опоры под корпусом: короткие штрихи, покачиваются вместе с телом
  const b = bboxOf(body)
  const midY = b.y + b.h / 2
  ctx.strokeStyle = TIER[2].dark
  ctx.lineWidth = 3
  ctx.lineCap = "round"
  for (let i = -2; i <= 2; i++) {
    const legX = b.x + b.w * (0.5 + i * 0.17)
    ctx.beginPath()
    ctx.moveTo(legX, midY + b.h * 0.34)
    ctx.lineTo(legX + i * 4, midY + b.h * 0.34 + 12 + Math.abs(i) * 2)
    ctx.stroke()
  }

  // корпус: сплюснутый овал с градиентом
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  bg.addColorStop(0, TIER[2].light)
  bg.addColorStop(0.6, TIER[2].base)
  bg.addColorStop(1, TIER[2].dark)
  ctx.beginPath()
  ctx.ellipse(b.x + b.w / 2, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = TIER[2].dark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // клешни: две дуги с вырезом, развёрнутые к ракетке
  for (const c of claws) {
    const side = c.x < b.x + b.w / 2 ? -1 : 1
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.rotate(c.rot + side * 0.08 * Math.sin(time * 1.4))
    const rx = c.rx
    const ry = c.ry
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
    const cg = ctx.createLinearGradient(-rx, 0, rx, 0)
    cg.addColorStop(0, TIER[2].base)
    cg.addColorStop(1, TIER[3].light)
    ctx.fillStyle = cg
    ctx.fill()
    ctx.strokeStyle = TIER[2].dark
    ctx.lineWidth = 1.5
    ctx.stroke()
    // вырез клешни
    ctx.beginPath()
    ctx.moveTo(side * rx * 0.15, -ry * 0.1)
    ctx.quadraticCurveTo(side * rx * 0.95, -ry * 0.55, side * rx * 0.75, -ry * 0.95)
    ctx.quadraticCurveTo(side * rx * 0.45, -ry * 0.35, side * rx * 0.15, ry * 0.15)
    ctx.closePath()
    ctx.fillStyle = TIER[2].dark
    ctx.fill()
    ctx.restore()
  }

  // щель между клешнями: тёмная впадина с бегущим бликом — уязвимая точка
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

  // панцирь: пластины «черепицей», слегка приподнимаются при дыхании
  for (const s of shell) {
    const offset = s.rot * -6 - breathe
    ctx.save()
    ctx.translate(s.x, s.y + offset)
    ctx.rotate(s.rot)
    ctx.beginPath()
    ctx.moveTo(-s.rx, s.ry * 0.55)
    ctx.quadraticCurveTo(-s.rx * 0.72, -s.ry, 0, -s.ry)
    ctx.quadraticCurveTo(s.rx * 0.72, -s.ry, s.rx, s.ry * 0.55)
    ctx.quadraticCurveTo(0, s.ry * 1.05, -s.rx, s.ry * 0.55)
    ctx.closePath()
    const sg = ctx.createLinearGradient(0, -s.ry, 0, s.ry)
    sg.addColorStop(0, TIER[3].light)
    sg.addColorStop(0.55, TIER[3].base)
    sg.addColorStop(1, TIER[3].dark)
    ctx.fillStyle = sg
    ctx.fill()
    ctx.strokeStyle = TIER[3].dark
    ctx.lineWidth = 1.6
    ctx.stroke()
    // заклёпки по краю пластины — «бронированный» вид
    ctx.fillStyle = "rgba(4, 18, 26, 0.55)"
    for (const k of [-0.55, 0, 0.55]) {
      ctx.beginPath()
      ctx.arc(s.rx * k, s.ry * 0.35, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    // блик
    ctx.globalAlpha = 0.32
    ctx.beginPath()
    ctx.ellipse(-s.rx * 0.25, -s.ry * 0.45, s.rx * 0.42, s.ry * 0.26, -0.3, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // глаза на стебельках
  for (const e of eyes) {
    ctx.beginPath()
    ctx.moveTo(e.x, e.y + e.ry * 3)
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

  // вспышка урона по всему телу
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.5
    ctx.beginPath()
    ctx.ellipse(b.x + b.w / 2, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
    ctx.globalAlpha = 1
  }
}
