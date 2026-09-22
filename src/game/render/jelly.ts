import { TIER } from "../palette"
import { Block } from "../types"

import { bboxOf, type Ctx } from "./shapes"

/** Медуза: пульсирующий купол и волнующиеся щупальца-цепочки. */
export function drawJelly(ctx: Ctx, parts: Block[], time: number) {
  const domeBig = parts.filter((p) => p.mbPart === "dome")
  const fringe = parts.filter((p) => p.mbPart === "fringe")
  const tents = parts.filter((p) => p.mbPart === "tentacle")
  if (!domeBig.length) return
  const d = bboxOf(domeBig)
  const cx = d.x + d.w / 2
  const flash = Math.max(...parts.map((p) => p.flash))
  // пульс: купол сжимается по ширине и вытягивается по высоте, низ на месте
  const pulse = Math.sin(time * 2.2)
  const w = d.w * (1 + 0.05 * pulse)
  const h = d.h * (1 - 0.07 * pulse)
  const left = cx - w / 2
  const right = cx + w / 2
  const top = d.y + d.h - h
  const bottom = d.y + d.h

  // щупальца: цепочки, качающиеся волной с амплитудой, растущей к кончикам
  const sorted = [...tents].sort((a, b) => a.x - b.x || a.y - b.y)
  const chains: Block[][] = []
  for (const p of sorted) {
    const last = chains[chains.length - 1]
    if (last && p.x - last[0].x < 9) last.push(p)
    else chains.push([p])
  }
  ctx.lineCap = "round"
  for (let ci = 0; ci < chains.length; ci++) {
    const chain = chains[ci]
    if (chain.length < 2) continue
    const base = [...chain].sort((a, b) => a.y - b.y)
    const pts = base.map((p, i) => ({
      x: p.x + Math.sin(time * 2.4 + ci * 0.9 + i * 0.85) * (2.5 + i * 2.8),
      y: p.y + Math.cos(time * 2.2 + ci * 0.9 + i * 0.85) * 1.6 * i,
    }))
    for (const pass of [
      { width: 5, color: "rgba(15,143,91,0.35)" },
      { width: 2.5, color: TIER[1].base },
    ]) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1].x + pts[i].x) / 2
        const my = (pts[i - 1].y + pts[i].y) / 2
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my)
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
      ctx.strokeStyle = pass.color
      ctx.lineWidth = pass.width
      ctx.stroke()
    }
  }

  // купол: верх — гладкая арка, низ — фестоны, всё дышит пульсом
  ctx.beginPath()
  ctx.moveTo(left, bottom)
  const n = 7
  const wseg = w / n
  for (let i = 0; i < n; i++) {
    const sx = left + wseg * i
    ctx.quadraticCurveTo(sx + wseg / 2, bottom + 9 + pulse * 2, sx + wseg, bottom)
  }
  ctx.bezierCurveTo(right, top + h * 0.35, right - w * 0.28, top, cx, top)
  ctx.bezierCurveTo(left + w * 0.28, top, left, top + h * 0.35, left, bottom)
  ctx.closePath()
  const dg = ctx.createLinearGradient(0, top, 0, bottom)
  dg.addColorStop(0, TIER[3].light)
  dg.addColorStop(0.6, TIER[3].base)
  dg.addColorStop(1, TIER[3].dark)
  ctx.fillStyle = dg
  ctx.fill()
  ctx.strokeStyle = TIER[3].dark
  ctx.lineWidth = 1.5
  ctx.stroke()

  // бахрома по нижнему краю — следует за пульсом по ширине
  for (const f of fringe) {
    ctx.beginPath()
    ctx.arc(cx + (f.x - cx) * (w / d.w), f.y, f.rx, 0, Math.PI * 2)
    ctx.fillStyle = TIER[3].base
    ctx.fill()
    ctx.strokeStyle = TIER[3].dark
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // блик внутри купола — чуть дышит вместе с пульсом
  ctx.globalAlpha = 0.3 + 0.08 * pulse
  ctx.beginPath()
  ctx.ellipse(cx - w * 0.12, top + h * 0.38, w * 0.22, h * 0.16, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1

  // вспышка урона
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.5
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.ellipse(cx, top + h * 0.55, w / 2, h * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}
