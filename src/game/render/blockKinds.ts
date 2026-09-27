/**
 * Рендер специальных блоков (§6): тела пружины/ваты/портала заменяют
 * стандартное тело блока, пульсация/дрейф/вращение добавляют метки поверх.
 * Градиенты — через gradCache (координаты в единичной локальной системе).
 */
import { TIER } from "../palette"
import type { Block } from "../types"

import { gradient } from "./gradCache"
import { type Ctx } from "./shapes"

/** Пружинный блок: жёлтое тело с витками; при ударе сжимается (flash). */
function drawSpringBody(ctx: Ctx, b: Block, x: number, y: number) {
  const squash = 1 - b.flash * 0.35
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  ctx.scale(b.rx, b.ry * squash)
  const tier = TIER[2]
  ctx.fillStyle = gradient(ctx, "spring", (c) => {
    const rg = c.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15)
    rg.addColorStop(0, tier.light)
    rg.addColorStop(0.5, tier.base)
    rg.addColorStop(1, tier.dark)
    return rg
  })
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  // витки пружины: три дуги поперёк тела
  ctx.lineWidth = 2.2 / Math.max(b.rx, b.ry)
  ctx.strokeStyle = "rgba(90,50,0,0.6)"
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 0.45 - 0.18, -0.5)
    ctx.quadraticCurveTo(i * 0.45 + 0.28, 0, i * 0.45 - 0.18, 0.5)
    ctx.stroke()
  }
  ctx.restore()
}

/** Ватный блок: мягкий овальный силуэт с внутренними овальными волокнами. */
function drawCottonBody(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const wobble = Math.sin(time * 2 + b.seed) * 0.05
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  ctx.scale(b.rx, b.ry)
  ctx.fillStyle = "rgba(246,243,255,0.95)"
  ctx.beginPath()
  ctx.ellipse(0, wobble * 0.2, 1, 0.76, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,0.34)"
  ctx.beginPath()
  ctx.ellipse(-0.28, -0.28, 0.38, 0.12, -0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "rgba(190,180,220,0.22)"
  ctx.beginPath()
  ctx.ellipse(0.32, 0.25, 0.28, 0.11, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpinArrows(ctx: Ctx, b: Block, x: number, y: number) {
  const sp = b.sp
  if (!sp || sp.rotDir === undefined) return
  const dir = sp.rotDir
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  ctx.strokeStyle = "rgba(255,255,255,0.72)"
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  const arrowSize = Math.min(b.rx, b.ry) * 0.14
  for (const side of [-1, 1]) {
    const cx = side * b.rx * 0.48
    const cy = 0
    const start = side < 0 ? -Math.PI * 0.85 : Math.PI * 0.15
    const end = start + dir * Math.PI * 0.8
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(b.rx, b.ry) * 0.22, start, end, dir < 0)
    ctx.stroke()
    const tipX = cx + Math.cos(end) * Math.min(b.rx, b.ry) * 0.22
    const tipY = cy + Math.sin(end) * Math.min(b.rx, b.ry) * 0.22
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(
      tipX - Math.cos(end - dir * 0.6) * arrowSize,
      tipY - Math.sin(end - dir * 0.6) * arrowSize
    )
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(
      tipX - Math.cos(end + dir * 0.6) * arrowSize,
      tipY - Math.sin(end + dir * 0.6) * arrowSize
    )
    ctx.stroke()
  }
  ctx.fillStyle = "rgba(4,18,26,0.32)"
  ctx.beginPath()
  ctx.ellipse(0, 0, b.rx * 0.16, b.ry * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Телепорт «чёрная дыра»: тёмное ядро + вращающееся аккреционное кольцо. */
function drawPortalBody(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const r = Math.max(b.rx, b.ry)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  ctx.scale(b.rx, b.ry)
  ctx.fillStyle = gradient(ctx, "portal", (c) => {
    const rg = c.createRadialGradient(0, 0, 0.1, 0, 0, 1.1)
    rg.addColorStop(0, "#0b0518")
    rg.addColorStop(0.6, "#2a1244")
    rg.addColorStop(1, "#12082a")
    return rg
  })
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // кольцо: тускнеет на кулдауне пары
  const ready = (b.sp?.portalCd ?? 0) <= 0
  const spin = time * 2.4 + b.seed
  ctx.lineWidth = 2.4
  ctx.strokeStyle = ready ? "rgba(176,108,255,0.85)" : "rgba(176,108,255,0.3)"
  ctx.beginPath()
  ctx.arc(x, y, r * 1.12, spin, spin + Math.PI * 0.9)
  ctx.stroke()
  ctx.strokeStyle = ready ? "rgba(220,180,255,0.6)" : "rgba(220,180,255,0.2)"
  ctx.beginPath()
  ctx.arc(x, y, r * 1.28, -spin * 0.7, -spin * 0.7 + Math.PI * 0.7)
  ctx.stroke()
}

/** Полностью кастомные тела спецблоков (пружина/вата/портал). */
export function drawSpecialBody(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  if (b.sp?.portalId) drawPortalBody(ctx, b, x, y, time)
  else if (b.sp?.spring) drawSpringBody(ctx, b, x, y)
  else drawCottonBody(ctx, b, x, y, time)
}

/** Внутренние стрелки вращающегося блока: не создают внешний контур. */
export function drawSpinMarks(ctx: Ctx, b: Block, x: number, y: number) {
  if (b.sp?.rotVel !== undefined) drawSpinArrows(ctx, b, x, y)
}
