import { Particle, Popup, Ring } from "../types"
import { clamp } from "../utils"

import { type Ctx } from "./shapes"

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

export function drawParticles(ctx: Ctx, particles: Particle[]) {
  for (const p of particles) {
    const a = clamp(p.life / p.maxLife, 0, 1)
    ctx.globalAlpha = a
    ctx.fillStyle = p.color
    if (p.shape === "shard") {
      // осколок: неровный треугольник с собственным вращением (лёд)
      const s = p.size * (0.55 + 0.45 * a)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot ?? 0)
      ctx.beginPath()
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.6, s * 0.7)
      ctx.lineTo(-s * 0.5, s * 0.55)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      continue
    }
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

/**
 * Мини-счётчик FPS: мелкий текст в левом нижнем углу поверх всего кадра.
 * Рисуется вне общей трансформации сцены (после ctx.restore), поэтому затемнение
 * и виньетка его не трогают. Размер шрифта передаётся в мировых единицах —
 * вызывающий компенсирует масштаб мира, чтобы текст был мелким на экране.
 */
export function drawFps(ctx: Ctx, w: number, h: number, fps: number, fontPx: number) {
  ctx.save()
  ctx.font = `700 ${fontPx}px "Russo One", sans-serif`
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "rgba(159, 214, 234, 0.8)"
  ctx.fillText(`${fps} FPS`, 8, h - 8)
  ctx.restore()
}
