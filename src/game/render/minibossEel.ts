import { TIER } from "../palette"
import type { Block } from "../types"

import type { Ctx } from "./shapes"

/** Волна тела угря: амплитуда и частота бокового покачивания сегментов. */
const EEL_WAVE_AMP = 5
const EEL_WAVE_FREQ = 2.6

/**
 * «Скользкий угорь» (T-058): тело из цепочки сегментов, проведённое одной
 * сужающейся линией (как щупальца медузы — так силуэт не распадается на
 * отдельные эллипсы), голова с глазами и раздвоенный хвостовой плавник.
 * Голова всегда смотрит вправо, к ракетке.
 */
export function drawEel(ctx: Ctx, parts: Block[], time: number) {
  const head = parts.find((p) => p.mbPart === "eel_head")
  const segs = parts.filter((p) => p.mbPart === "eel_seg").sort((a, b) => b.x - a.x)
  const fins = parts.filter((p) => p.mbPart === "eel_fin")
  const eye = parts.find((p) => p.mbPart === "eye")
  if (!head || !segs.length) return

  const flash = Math.max(...parts.map((p) => p.flash))

  // Осевая линия: от головы к хвосту, с волной — угорь «плывёт».
  const spine = [head, ...segs].map((p, i) => ({
    x: p.x,
    y: p.y + Math.sin(time * EEL_WAVE_FREQ + i * 0.7) * EEL_WAVE_AMP,
    r: p.ry,
  }))

  // Тело: два прохода — тёмная обводка и светлая сердцевина.
  for (const pass of [
    { mult: 1.25, color: TIER[2].dark },
    { mult: 1, color: TIER[2].base },
  ]) {
    ctx.beginPath()
    ctx.moveTo(spine[0].x, spine[0].y)
    for (let i = 1; i < spine.length; i++) {
      const mx = (spine[i - 1].x + spine[i].x) / 2
      const my = (spine[i - 1].y + spine[i].y) / 2
      ctx.quadraticCurveTo(spine[i - 1].x, spine[i - 1].y, mx, my)
    }
    const last = spine[spine.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    // толщина падает к хвосту — тело сужается естественно
    ctx.strokeStyle = pass.color
    ctx.lineWidth = head.ry * 1.5 * pass.mult
    ctx.stroke()
    if (pass.mult === 1) {
      // повторяем тем же путём, но тоньше и светлее — объём
      ctx.strokeStyle = TIER[2].light
      ctx.lineWidth = head.ry * 0.85
      ctx.stroke()
    }
  }

  // Хвостовой плавник: две лопасти, машут в противофазе корпусу.
  for (const f of fins) {
    ctx.save()
    ctx.translate(f.x, f.y + Math.sin(time * EEL_WAVE_FREQ + 4.4) * EEL_WAVE_AMP)
    ctx.rotate(f.rot + Math.sin(time * 3.4) * 0.16 * Math.sign(f.rot || 1))
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(-f.rx * 0.7, -f.ry * 0.9, -f.rx * 1.5, -f.ry * 1.5)
    ctx.quadraticCurveTo(-f.rx * 0.55, -f.ry * 0.15, 0, 0)
    ctx.closePath()
    const fg = ctx.createLinearGradient(0, 0, -f.rx * 1.5, -f.ry * 1.5)
    fg.addColorStop(0, TIER[1].base)
    fg.addColorStop(1, TIER[1].light)
    ctx.fillStyle = fg
    ctx.fill()
    ctx.strokeStyle = TIER[1].dark
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  // Голова: округлый клин, «скользкий» блик вдоль спины.
  ctx.save()
  ctx.translate(head.x, head.y + Math.sin(time * EEL_WAVE_FREQ) * EEL_WAVE_AMP)
  ctx.beginPath()
  ctx.ellipse(0, 0, head.rx, head.ry, 0, 0, Math.PI * 2)
  const hg = ctx.createLinearGradient(0, -head.ry, 0, head.ry)
  hg.addColorStop(0, TIER[3].light)
  hg.addColorStop(0.6, TIER[2].base)
  hg.addColorStop(1, TIER[2].dark)
  ctx.fillStyle = hg
  ctx.fill()
  ctx.strokeStyle = TIER[2].dark
  ctx.lineWidth = 1.5
  ctx.stroke()
  // блик-«скользкость»
  ctx.globalAlpha = 0.38 + 0.12 * Math.sin(time * 2.8)
  ctx.beginPath()
  ctx.ellipse(-head.rx * 0.2, -head.ry * 0.4, head.rx * 0.55, head.ry * 0.28, -0.35, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1
  // пасть
  ctx.beginPath()
  ctx.moveTo(head.rx * 0.35, head.ry * 0.35)
  ctx.lineTo(head.rx * 0.92, head.ry * 0.12)
  ctx.strokeStyle = TIER[2].dark
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.restore()

  // Глаз
  if (eye) {
    ctx.beginPath()
    ctx.arc(eye.x, eye.y, eye.rx, 0, Math.PI * 2)
    ctx.fillStyle = "#eaf7ff"
    ctx.fill()
    ctx.strokeStyle = TIER[2].dark
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(eye.x + eye.rx * 0.3, eye.y, eye.rx * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = "#04121c"
    ctx.fill()
  }

  // вспышка урона
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.45
    for (const p of [head, ...segs]) {
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = "#ffffff"
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}
