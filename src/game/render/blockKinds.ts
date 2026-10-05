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

/** Хрупкий кристалл: стеклянная заливка, световой кант, грани и блики. */
function drawBrittleBody(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const shimmer = 0.78 + Math.sin(time * 2.5 + b.seed) * 0.12
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  ctx.scale(b.rx, b.ry)
  ctx.fillStyle = gradient(ctx, "brittle", (c) => {
    const rg = c.createRadialGradient(-0.35, -0.38, 0.04, 0, 0, 1.1)
    rg.addColorStop(0, "rgba(245,255,255,0.42)")
    rg.addColorStop(0.58, "rgba(110,231,255,0.22)")
    rg.addColorStop(1, "rgba(77,160,220,0.34)")
    return rg
  })
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2.2 / Math.max(b.rx, b.ry)
  ctx.strokeStyle = "rgba(185,247,255,0.95)"
  ctx.shadowColor = "#83eeff"
  ctx.shadowBlur = 8 * shimmer
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.lineWidth = 1.4 / Math.max(b.rx, b.ry)
  ctx.strokeStyle = `rgba(229,255,255,${0.68 * shimmer})`
  ctx.beginPath()
  ctx.moveTo(-0.62, -0.28)
  ctx.lineTo(-0.12, -0.58)
  ctx.lineTo(0.13, -0.08)
  ctx.lineTo(0.55, -0.38)
  ctx.moveTo(-0.12, -0.58)
  ctx.lineTo(-0.38, 0.15)
  ctx.lineTo(0.13, -0.08)
  ctx.lineTo(0.36, 0.46)
  ctx.stroke()
  ctx.fillStyle = `rgba(255,255,255,${0.58 * shimmer})`
  ctx.beginPath()
  ctx.ellipse(-0.28, -0.43, 0.3, 0.075, -0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${0.9 * shimmer})`
  ctx.beginPath()
  ctx.arc(0.48, -0.47, 0.055, 0, Math.PI * 2)
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

/** Оверлеи новых механик: броня, фазы и поле магнита. */
export function drawPriorityMarks(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const sp = b.sp
  if (!sp) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  if (sp.armor && sp.armor > 0) {
    const currentArmor = Math.max(0, Math.floor(sp.armor))
    const maxArmor = Math.max(currentArmor, Math.floor(sp.armorMax ?? currentArmor))
    const removedArmor = maxArmor - currentArmor
    const rx = b.rx
    const ry = b.ry
    const ringGap = Math.max(3.5, Math.min(rx, ry) * 0.1)
    for (let i = removedArmor; i < maxArmor; i++) {
      const offset = ringGap * (maxArmor - i)
      const ringRx = rx + offset
      const ringRy = ry + offset
      ctx.lineWidth = Math.max(3, Math.min(rx, ry) * 0.14)
      ctx.strokeStyle = "#080808"
      ctx.beginPath()
      ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2)
      ctx.stroke()
      if (i + 1 >= maxArmor) continue
      ctx.strokeStyle = TIER[b.tier].base
      ctx.lineWidth = Math.max(1.2, Math.min(rx, ry) * 0.04)
      ctx.beginPath()
      ctx.ellipse(0, 0, ringRx - ringGap / 2, ringRy - ringGap / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  if (sp.brittle) {
    ctx.strokeStyle = "rgba(255,245,190,0.8)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-b.rx * 0.45, -b.ry * 0.45)
    ctx.lineTo(-b.rx * 0.08, 0)
    ctx.lineTo(-b.rx * 0.28, b.ry * 0.42)
    ctx.moveTo(-b.rx * 0.08, 0)
    ctx.lineTo(b.rx * 0.3, -b.ry * 0.22)
    ctx.lineTo(b.rx * 0.43, b.ry * 0.34)
    ctx.stroke()
  }
  if (sp.phase) {
    const position =
      (((time + sp.phase.offset) % sp.phase.period) + sp.phase.period) % sp.phase.period
    const active = position < sp.phase.period * sp.phase.active
    ctx.globalAlpha = active ? 0.9 : 0.32
    ctx.strokeStyle = active ? "#7cf5ff" : "#b8c0cc"
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, 0, Math.min(b.rx, b.ry) * 0.38, 0, Math.PI * 2 * sp.phase.active)
    ctx.stroke()
  }
  if (sp.magnet) {
    ctx.strokeStyle = "rgba(255,110,210,0.72)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-b.rx * 0.4, -b.ry * 0.2)
    ctx.lineTo(b.rx * 0.35, -b.ry * 0.2)
    ctx.moveTo(-b.rx * 0.4, b.ry * 0.2)
    ctx.lineTo(b.rx * 0.35, b.ry * 0.2)
    ctx.stroke()
  }
  const magnet = sp.magnet
  ctx.restore()
  if (magnet && Number.isFinite(magnet.radius) && magnet.radius > 0) {
    ctx.save()
    ctx.globalAlpha *= 0.62
    ctx.strokeStyle = "rgba(255,110,210,0.9)"
    ctx.lineWidth = 1.8
    ctx.setLineDash([7, 6])
    ctx.beginPath()
    ctx.arc(x, y, magnet.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}

export function drawBrittleBlock(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  drawBrittleBody(ctx, b, x, y, time)
}
