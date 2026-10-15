import { Ball, Projectile, RenderView } from "../types"
import { getBallTrailDef, type BallTrailId } from "../cosmetics"

import { type Ctx } from "./shapes"

export function drawProjectiles(ctx: Ctx, projectiles: Projectile[], time: number) {
  for (const pr of projectiles) {
    ctx.save()
    ctx.translate(pr.x, pr.y)
    ctx.shadowColor = "#ffc94d"
    ctx.shadowBlur = 14
    const g = ctx.createLinearGradient(0, -11, 0, 8)
    g.addColorStop(0, "#ffe9a8")
    g.addColorStop(0.5, "#ffc94d")
    g.addColorStop(1, "#c07f0e")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, -11)
    ctx.quadraticCurveTo(6, -4, 5, 6)
    ctx.lineTo(-5, 6)
    ctx.quadraticCurveTo(-6, -4, 0, -11)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "#ff6a5c"
    ctx.beginPath()
    ctx.moveTo(0, -11)
    ctx.quadraticCurveTo(3.4, -7, 3, -4)
    ctx.lineTo(-3, -4)
    ctx.quadraticCurveTo(-3.4, -7, 0, -11)
    ctx.fill()
    const fl = 6 + Math.sin(time * 42) * 3
    ctx.fillStyle = "#ff8a3d"
    ctx.beginPath()
    ctx.moveTo(-3, 6)
    ctx.lineTo(0, 10 + fl)
    ctx.lineTo(3, 6)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

/** Снимок данных для отрисовки шаров. */
export interface BallView extends RenderView {
  fire: boolean
  frost: boolean
  spark: boolean
  slow: boolean
  fast: boolean
  /** Идентификатор экипированного шлейфа/скина шара. */
  trailSkin?: BallTrailId
}

export function drawBalls(ctx: Ctx, balls: Ball[], v: BallView) {
  if (v.hidden) return
  const isPowerActive = v.fire || v.frost || v.spark || v.slow || v.fast
  const skinDef = getBallTrailDef(v.trailSkin ?? "default")
  const isRainbow = !isPowerActive && skinDef.id === "rainbow"

  const mode = v.fire
    ? { trail: "rgba(255,138,61,", mid: "#ffe9a8", core: "#ff5347", glow: "#ff8a3d" }
    : v.frost
      ? { trail: "rgba(124,214,255,", mid: "#dff4ff", core: "#5db8e8", glow: "#8fd9ff" }
      : v.spark
        ? { trail: "rgba(255,233,92,", mid: "#fff9c4", core: "#f5c518", glow: "#ffe95c" }
        : v.slow
          ? { trail: "rgba(93,255,176,", mid: "#d2ffee", core: "#2fd98a", glow: "#5dffb0" }
          : v.fast
            ? { trail: "rgba(255,106,92,", mid: "#ffd9d4", core: "#ff5347", glow: "#ff6a5c" }
            : isRainbow
              ? {
                  trail: "",
                  mid: `hsl(${(v.time * 180 + 60) % 360}, 100%, 80%)`,
                  core: `hsl(${(v.time * 180) % 360}, 100%, 55%)`,
                  glow: `hsl(${(v.time * 180) % 360}, 100%, 60%)`,
                }
              : {
                  trail: skinDef.colors.trail,
                  mid: skinDef.colors.mid,
                  core: skinDef.colors.core,
                  glow: skinDef.colors.glow,
                }
  for (const b of balls) {
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i]
      const a = (i / b.trail.length) * 0.28
      ctx.beginPath()
      ctx.arc(t.x, t.y, b.r * (0.3 + (i / b.trail.length) * 0.6), 0, Math.PI * 2)
      ctx.fillStyle = isRainbow
        ? `hsla(${(v.time * 180 + i * 25) % 360}, 100%, 65%, ${a})`
        : `${mode.trail}${a})`
      ctx.fill()
    }
    if (b.stuck) {
      const pr = b.r + 6 + Math.sin(v.time * 6) * 2.5
      const c = Math.PI * 2 * pr
      const n = 18
      const seg = c / n
      ctx.beginPath()
      ctx.arc(b.x, b.y, pr, Math.PI / 2, Math.PI / 2 + Math.PI * 2)
      ctx.strokeStyle = isRainbow
        ? `hsla(${(v.time * 180) % 360}, 100%, 65%, 0.65)`
        : `${mode.trail}0.65)`
      ctx.lineWidth = 2
      ctx.setLineDash([seg * 0.45, seg * 0.55])
      ctx.lineDashOffset = -v.time * 30
      ctx.stroke()
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
    }
    const sq = b.squash * 0.28
    // электрошар искрится: короткие случайные разряды от края шара
    if (v.spark) {
      for (let i = 0; i < 2; i++) {
        const a0 = Math.random() * Math.PI * 2
        const len = b.r * (1.2 + Math.random() * 1.3)
        ctx.beginPath()
        ctx.moveTo(b.x + Math.cos(a0) * b.r, b.y + Math.sin(a0) * b.r)
        const mx = b.x + Math.cos(a0 + 0.35) * (b.r + len * 0.5)
        const my = b.y + Math.sin(a0 + 0.35) * (b.r + len * 0.5)
        ctx.lineTo(mx + (Math.random() - 0.5) * 8, my + (Math.random() - 0.5) * 8)
        ctx.lineTo(b.x + Math.cos(a0 + 0.5) * (b.r + len), b.y + Math.sin(a0 + 0.5) * (b.r + len))
        ctx.strokeStyle = i === 0 ? "rgba(255,249,196,0.9)" : "rgba(255,233,92,0.6)"
        ctx.lineWidth = 1.4
        ctx.stroke()
      }
    } else if (!isPowerActive && skinDef.colors.sparks) {
      for (let i = 0; i < 2; i++) {
        const a0 = (v.time * 6 + i * Math.PI) % (Math.PI * 2)
        const len = b.r * 0.8
        ctx.beginPath()
        ctx.moveTo(b.x + Math.cos(a0) * b.r, b.y + Math.sin(a0) * b.r)
        ctx.lineTo(b.x + Math.cos(a0) * (b.r + len), b.y + Math.sin(a0) * (b.r + len))
        ctx.strokeStyle = "rgba(255,245,120,0.7)"
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
    } else if (!isPowerActive && skinDef.colors.stars) {
      for (let i = 0; i < 3; i++) {
        const a0 = v.time * 2.5 + (i * Math.PI * 2) / 3
        const dist = b.r * (1.2 + Math.sin(v.time * 6 + i) * 0.3)
        const sx = b.x + Math.cos(a0) * dist
        const sy = b.y + Math.sin(a0) * dist
        ctx.fillStyle = "rgba(225,180,255,0.75)"
        ctx.beginPath()
        ctx.arc(sx, sy, 1.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.scale(1 + sq, 1 - sq)
    ctx.shadowColor = mode.glow
    ctx.shadowBlur = 16
    const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, b.r)
    g.addColorStop(0, "#ffffff")
    g.addColorStop(0.55, mode.mid)
    g.addColorStop(1, mode.core)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, b.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
