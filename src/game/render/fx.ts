import { Lightning, Particle, Popup, Ring } from "../types"
import { clamp, rand } from "../utils"

import { type Ctx } from "./shapes"

export function drawRings(ctx: Ctx, rings: Ring[]) {
  for (const r of rings) {
    const a = clamp(1 - r.t, 0, 1)
    ctx.globalAlpha = a
    ctx.beginPath()
    // Нелинейное расширение ударной волны: быстрый взрывной фронт с замедлением на излёте
    const ease = 1 - (1 - r.t) * (1 - r.t)
    ctx.arc(r.x, r.y, r.r + ease * r.maxR, 0, Math.PI * 2)
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
      // осколок: неровный треугольник с вращением; рисуем прямо в мировых координатах
      // без вызовов ctx.save/translate/rotate, что в разы быстрее и не сдвигает стек матриц
      const s = p.size * (0.55 + 0.45 * a)
      const rot = p.rot ?? 0
      const c = Math.cos(rot)
      const sn = Math.sin(rot)
      // v1 = (0, -s)
      const x1 = p.x + s * sn
      const y1 = p.y - s * c
      // v2 = (0.6s, 0.7s)
      const x2 = p.x + s * 0.6 * c - s * 0.7 * sn
      const y2 = p.y + s * 0.6 * sn + s * 0.7 * c
      // v3 = (-0.5s, 0.55s)
      const x3 = p.x + -s * 0.5 * c - s * 0.55 * sn
      const y3 = p.y + -s * 0.5 * sn + s * 0.55 * c
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.lineTo(x3, y3)
      ctx.closePath()
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * Молнии цепи искр: ломаная с джиттером в два прохода — широкое свечение
 * и тонкий яркий ствол. Форма ломаной обновляется каждый кадр — разряд
 * «дрожит», как настоящая молния.
 */
export function drawLightnings(ctx: Ctx, bolts: Lightning[]) {
  for (const b of bolts) {
    const a = clamp(1 - b.t, 0, 1)
    if (a <= 0) continue
    const trace = () => {
      ctx.beginPath()
      ctx.moveTo(b.x1, b.y1)
      const segs = 5
      for (let i = 1; i < segs; i++) {
        const k = i / segs
        const jit = rand(-6, 6) * Math.sin(k * Math.PI)
        ctx.lineTo(
          b.x1 + (b.x2 - b.x1) * k + jit,
          b.y1 + (b.y2 - b.y1) * k + rand(-6, 6) * Math.sin(k * Math.PI)
        )
      }
      ctx.lineTo(b.x2, b.y2)
    }
    ctx.globalAlpha = a
    ctx.strokeStyle = "rgba(255,233,92,0.5)"
    ctx.lineWidth = 5
    trace()
    ctx.stroke()
    ctx.strokeStyle = "#fffde7"
    ctx.lineWidth = 1.8
    trace()
    ctx.stroke()
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
