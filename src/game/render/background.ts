import { Bubble } from "../types"
import { clamp } from "../utils"

import { type Ctx } from "./shapes"

export function drawBackground(ctx: Ctx, w: number, h: number, combo: number, bubbles: Bubble[]) {
  const heat = clamp(combo / 12, 0, 1)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, "#0e3a4e")
  g.addColorStop(0.5, "#082434")
  g.addColorStop(1, "#04121c")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  if (heat > 0.02) {
    const rg = ctx.createRadialGradient(w / 2, 0, 40, w / 2, 0, Math.max(w, h) * 0.8)
    rg.addColorStop(0, `rgba(255,201,77,${0.14 * heat})`)
    rg.addColorStop(0.5, `rgba(53,224,255,${0.08 * heat})`)
    rg.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = rg
    ctx.fillRect(0, 0, w, h)
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
  const g = ctx.createLinearGradient(0, y - 9, 0, y + 9)
  g.addColorStop(0, "rgba(77,255,158,0)")
  g.addColorStop(0.5, `rgba(77,255,158,${a})`)
  g.addColorStop(1, "rgba(77,255,158,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, y - 9, w, 18)
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
