import { POWER_META } from "../palette"
import { Block, BossState, PaddleShapeKind, PaddleState, PowerUp, RenderView } from "../types"
import { Physics } from "../physics"
import { rotatedExtents } from "../utils"

import { roundRect, type Ctx } from "./shapes"

function drawCoin(ctx: Ctx, pw: PowerUp) {
  const R = 13
  const sx = Math.abs(Math.cos(pw.t * 4.5))
  ctx.save()
  ctx.translate(pw.x, pw.y)
  ctx.scale(Math.max(0.25, sx), 1)
  ctx.shadowColor = "#ffc94d"
  ctx.shadowBlur = 16
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 1, 0, 0, R * 1.15)
  g.addColorStop(0, "#fff3d1")
  g.addColorStop(0.5, "#ffc94d")
  g.addColorStop(1, "#b0720a")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = "#8a5a06"
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = "rgba(255,243,209,0.8)"
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = "#8a5a06"
  ctx.font = '700 12px "Russo One", sans-serif'
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("★", 0, 1.5)
  ctx.restore()
}

export function drawPowers(ctx: Ctx, powers: PowerUp[]) {
  for (const pw of powers) {
    const meta = POWER_META[pw.type]
    // столб света сверху в первые мгновения падения
    if (pw.t < 0.5 && pw.y > 0) {
      const a = (0.5 - pw.t) / 0.5
      ctx.fillStyle = meta.color + "30"
      ctx.fillRect(pw.x - 4, 0, 8, pw.y)
      ctx.fillStyle = `rgba(240,255,255,${0.55 * a})`
      ctx.fillRect(pw.x - 1.2, 0, 2.4, pw.y)
    }
    if (pw.type === "coin") {
      drawCoin(ctx, pw)
      continue
    }
    ctx.save()
    ctx.translate(pw.x, pw.y)
    ctx.rotate(Math.sin(pw.t * 5) * 0.12)
    const pulse = 1 + Math.sin(pw.t * 9) * 0.05
    ctx.scale(pulse, pulse)
    ctx.shadowColor = meta.color
    ctx.shadowBlur = 20
    ctx.fillStyle = meta.color
    roundRect(ctx, -24, -16, 48, 32, 16)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = meta.edge
    ctx.lineWidth = 2.5
    roundRect(ctx, -24, -16, 48, 32, 16)
    ctx.stroke()
    ctx.fillStyle = "rgba(255,255,255,0.38)"
    roundRect(ctx, -18, -12.5, 36, 10, 8)
    ctx.fill()
    ctx.fillStyle = "#04121c"
    ctx.font = '700 15px "Russo One", sans-serif'
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(meta.label, 0, 2)
    ctx.restore()
  }
}

/** Снимок данных для отрисовки лазерных лучей. */
export interface LaserBeamView extends RenderView {
  laserUntil: number
  paddle: PaddleState
  blocks: Block[]
  boss: BossState | null
  /** Форма верхней поверхности ракетки: пилоны стоят на ней. */
  shape?: PaddleShapeKind
}

export function drawLaserBeams(ctx: Ctx, v: LaserBeamView) {
  if (v.time >= v.laserUntil || v.hidden) return
  const cyc = v.time % 0.3
  if (cyc >= 0.17) return
  const onAmt = 1 - cyc / 0.17
  const p = v.paddle
  // Пилоны лазера стоят на поверхности формы ракетки (Physics.surfaceAt):
  // купол выше грани, чаша — ниже; над поверхностью пилон торчит на 8px.
  for (const s of [-0.36, 0.36]) {
    const px = p.x + p.w * s
    const dome = Physics.surfaceAt(p.w / 2, s, v.shape ?? "flat", p.h)
    const pylonY = p.y - p.h / 2 - dome - 8
    let hitY = -30
    let best: Block | null = null
    for (const b of v.blocks) {
      if (b.dead) continue
      const e = rotatedExtents(b.rx, b.ry, b.rot)
      if (Math.abs(b.x - px) > e.hw + 3 || b.y + e.hh >= pylonY) continue
      if (!best || b.y > best.y) best = b
    }
    if (best) hitY = best.y + rotatedExtents(best.rx, best.ry, best.rot).hh - 2
    else if (v.boss && Math.abs(v.boss.x - px) < v.boss.r && v.boss.y + v.boss.r < pylonY)
      hitY = v.boss.y + v.boss.r - 2
    const wdt = 2.5 + 5 * onAmt
    ctx.save()
    ctx.globalAlpha = 0.25 * onAmt
    ctx.fillStyle = "#7cf5ff"
    ctx.fillRect(px - wdt * 2.4, hitY, wdt * 4.8, pylonY - hitY)
    ctx.globalAlpha = 0.95 * onAmt
    ctx.shadowColor = "#7cf5ff"
    ctx.shadowBlur = 18
    const g = ctx.createLinearGradient(px - wdt / 2, 0, px + wdt / 2, 0)
    g.addColorStop(0, "rgba(124,245,255,0.1)")
    g.addColorStop(0.5, "#f2ffff")
    g.addColorStop(1, "rgba(124,245,255,0.1)")
    ctx.fillStyle = g
    ctx.fillRect(px - wdt / 2, hitY, wdt, pylonY - hitY)
    ctx.beginPath()
    ctx.arc(px, hitY + 3, 4.5 + 4.5 * onAmt, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(240,255,255,0.95)"
    ctx.fill()
    ctx.restore()
  }
}
