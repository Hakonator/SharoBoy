import { Bubble } from "../types"
import { clamp } from "../utils"

import { gradient } from "./gradCache"
import { type Ctx } from "./shapes"

export function drawBackground(ctx: Ctx, w: number, h: number, combo: number, bubbles: Bubble[]) {
  const heat = clamp(combo / 12, 0, 1)
  ctx.fillStyle = gradient(ctx, `bg:${h}`, (c) => {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, "#0e3a4e")
    g.addColorStop(0.5, "#082434")
    g.addColorStop(1, "#04121c")
    return g
  })
  ctx.fillRect(0, 0, w, h)
  if (heat > 0.02) {
    /* Пульс жара зависит от комбо каждый кадр — выносим его в globalAlpha,
       чтобы градиент (с полной альфой) жил в кэше. */
    ctx.globalAlpha = heat
    ctx.fillStyle = gradient(ctx, `heat:${w}x${h}`, (c) => {
      const rg = c.createRadialGradient(w / 2, 0, 40, w / 2, 0, Math.max(w, h) * 0.8)
      rg.addColorStop(0, "rgba(255,201,77,0.14)")
      rg.addColorStop(0.5, "rgba(53,224,255,0.08)")
      rg.addColorStop(1, "rgba(0,0,0,0)")
      return rg
    })
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
  }
  for (const b of bubbles) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(140,220,255,0.07)"
    ctx.fill()
    ctx.strokeStyle = "rgba(140,220,255,0.12)"
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

/**
 * Затемнение неигровой HUD-зоны над верхней границей поля (Game.blockTop):
 * шары и блоки туда не заходят — зона читается как «стекло» над игрой, а
 * пунктирная линия показывает, от чего отскакивает шар. Показывается только
 * во время прохождения уровня на вертикальном экране — вне игры и в ландшафте
 * зоны нет вовсе (blockTop = 0). */
export function drawTopZone(ctx: Ctx, w: number, top: number, hidden: boolean) {
  if (hidden || top <= 0) return
  ctx.fillStyle = gradient(ctx, `topzone:${w}x${Math.round(top)}`, (c) => {
    const g = c.createLinearGradient(0, 0, 0, top)
    g.addColorStop(0, "rgba(2,8,14,0.6)")
    g.addColorStop(0.72, "rgba(2,8,14,0.32)")
    g.addColorStop(1, "rgba(2,8,14,0)")
    return g
  })
  ctx.fillRect(0, 0, w, top)
  ctx.strokeStyle = "rgba(53,224,255,0.3)"
  ctx.lineWidth = 2
  ctx.setLineDash([12, 10])
  ctx.beginPath()
  ctx.moveTo(0, top - 1)
  ctx.lineTo(w, top - 1)
  ctx.stroke()
  ctx.setLineDash([])
}

export function drawShieldLine(
  ctx: Ctx,
  w: number,
  h: number,
  time: number,
  shield: number,
  hidden: boolean
) {
  if (shield <= 0 || hidden) return
  const y = h - 14
  const a = 0.5 + Math.sin(time * 6) * 0.18
  /* Градиент в кэше (зависит только от h), пульсация — через globalAlpha. */
  ctx.globalAlpha = a
  ctx.fillStyle = gradient(ctx, `shield:${h}`, (c) => {
    const g = c.createLinearGradient(0, y - 9, 0, y + 9)
    g.addColorStop(0, "rgba(77,255,158,0)")
    g.addColorStop(0.5, "rgba(77,255,158,1)")
    g.addColorStop(1, "rgba(77,255,158,0)")
    return g
  })
  ctx.fillRect(0, y - 9, w, 18)
  ctx.globalAlpha = 1
  ctx.shadowColor = "#4dff9e"
  ctx.shadowBlur = 9
  for (let i = 0; i < shield; i++) {
    const px = w / 2 + (i - (shield - 1) / 2) * 15
    ctx.beginPath()
    ctx.arc(px, y, 4.2, 0, Math.PI * 2)
    ctx.fillStyle = "#4dff9e"
    ctx.fill()
  }
  ctx.shadowBlur = 0
}
