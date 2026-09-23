/**
 * Рендер специальных блоков (§6): тела пружины/ваты/портала заменяют
 * стандартное тело блока, пульсация/дрейф/вращение добавляют метки поверх.
 * Градиенты — через gradCache (координаты в единичной локальной системе).
 */
import { PULSE_AMPLITUDE } from "../blockKinds"
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

/** Ватный блок: пушистое облако из перекрывающихся кругов, мягко дышит. */
function drawCottonBody(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const wobble = Math.sin(time * 2 + b.seed) * 0.05
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  ctx.scale(b.rx, b.ry)
  ctx.fillStyle = "rgba(246,243,255,0.95)"
  const puffs: [number, number, number][] = [
    [-0.35, -0.2, 0.55],
    [0.3, -0.3, 0.5],
    [0.05, 0.25, 0.6],
    [-0.1 + wobble, -0.45, 0.4],
  ]
  for (const [px, py, pr] of puffs) {
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = "rgba(160,140,200,0.5)"
  ctx.lineWidth = 1.8 / Math.max(b.rx, b.ry)
  ctx.beginPath()
  ctx.arc(0, 0, 0.95, 0, Math.PI * 2)
  ctx.stroke()
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

/**
 * Метки поверх стандартного тела: внешнее кольцо пульсации, штрихи маршрута
 * дрейфа, стрелки направления вращения.
 */
export function drawSpecialMarks(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const sp = b.sp!
  if (sp.pulse) {
    const k = 1 + Math.sin(time * sp.pulse.freq + sp.pulse.ph) * PULSE_AMPLITUDE
    ctx.strokeStyle = "rgba(255,255,255,0.35)"
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(x, y, b.rx * k * 1.16 + 3, b.ry * k * 1.16 + 3, b.rot, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (sp.drift) {
    const d = sp.drift
    ctx.strokeStyle = "rgba(255,255,255,0.28)"
    ctx.lineWidth = 1.2
    ctx.beginPath()
    if (d.kind === "h") {
      ctx.moveTo(x - b.rx - d.amp, y)
      ctx.lineTo(x - b.rx - 4, y)
      ctx.moveTo(x + b.rx + 4, y)
      ctx.lineTo(x + b.rx + d.amp, y)
    } else if (d.kind === "v") {
      ctx.moveTo(x, y - b.ry - d.amp)
      ctx.lineTo(x, y - b.ry - 4)
      ctx.moveTo(x, y + b.ry + 4)
      ctx.lineTo(x, y + b.ry + d.amp)
    } else {
      ctx.ellipse(x, b.y0 ?? y, d.amp + b.rx, (d.amp + b.ry) * 0.6, 0, 0, Math.PI * 2)
    }
    ctx.stroke()
  }
  if (sp.rotVel !== undefined) {
    // стрелки на концах длинной оси: показывают направление (и сам факт) вращения
    const dir = sp.rotVel >= 0 ? 1 : -1
    const alpha = sp.rotVel === 0 ? 0.18 : 0.5
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`
    ctx.lineWidth = 1.6
    const long = Math.max(b.rx, b.ry)
    for (const s of [-1, 1]) {
      const ax = Math.cos(b.rot) * long * 0.55 * s
      const ay = Math.sin(b.rot) * long * 0.55 * s
      ctx.beginPath()
      ctx.moveTo(x + ax - dir * ay * 0.25, y + ay + dir * ax * 0.25)
      ctx.lineTo(x + ax * 1.25, y + ay * 1.25)
      ctx.lineTo(x + ax + dir * ay * 0.25, y + ay - dir * ax * 0.25)
      ctx.stroke()
    }
  }
}
