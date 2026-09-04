/**
 * Пиксельный рендеринг игровой сцены — чистые функции над Canvas 2D.
 * Вся логика состояния остаётся в Game; сюда передаются снимки данных.
 */
import { POWER_META, TIER } from "./palette"
import type {
  Ball,
  Block,
  BossState,
  Bubble,
  PaddleState,
  Particle,
  Popup,
  PowerUp,
  Projectile,
  Ring,
} from "./types"
import { clamp, rotatedExtents } from "./utils"

type Ctx = CanvasRenderingContext2D

/** Скруглённый прямоугольник (строит путь, без заливки/обводки). */
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

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

function drawBomb(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const pulse = 0.6 + Math.sin(time * 9 + b.seed) * 0.4
  ctx.save()
  const g = ctx.createRadialGradient(x - b.rx * 0.3, y - b.ry * 0.35, 2, x, y, b.rx * 1.2)
  g.addColorStop(0, "#5a6b78")
  g.addColorStop(0.55, "#2b3a45")
  g.addColorStop(1, "#101b22")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, b.rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = "#ff8a3d"
  ctx.shadowBlur = 14 * pulse
  ctx.strokeStyle = `rgba(255,138,61,${0.45 + pulse * 0.4})`
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.shadowBlur = 0
  // фитиль
  ctx.strokeStyle = "#8a6b4a"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x, y - b.ry)
  ctx.quadraticCurveTo(x + 7, y - b.ry - 8, x + 12, y - b.ry - 4)
  ctx.stroke()
  ctx.fillStyle = `rgba(255,220,120,${pulse})`
  ctx.beginPath()
  ctx.arc(x + 12, y - b.ry - 4, 3 + pulse * 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawBlocks(ctx: Ctx, blocks: Block[], time: number) {
  for (const b of blocks) {
    if (b.dead) continue
    if (b.bomb) {
      drawBomb(ctx, b, b.x, b.y, time)
      continue
    }
    const x = b.x + Math.sin(time * 0.9 + b.seed) * 1.4
    const y = b.y + Math.cos(time * 0.8 + b.seed) * 1.4
    const tier = TIER[b.tier]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.rot)
    ctx.scale(b.rx, b.ry)
    const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15)
    g.addColorStop(0, tier.light)
    g.addColorStop(0.5, tier.base)
    g.addColorStop(1, tier.dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2.5 / Math.max(b.rx, b.ry)
    ctx.strokeStyle = "rgba(4,18,26,0.55)"
    ctx.stroke()
    if (b.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // трещины
    const dmg = b.maxHp - b.hp
    if (dmg > 0) {
      ctx.strokeStyle = "rgba(4,18,26,0.5)"
      ctx.lineWidth = 1.6
      for (let i = 0; i < dmg; i++) {
        const a0 = b.seed + i * 2.1
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a0) * b.rx * 0.2, y + Math.sin(a0) * b.ry * 0.2)
        ctx.lineTo(x + Math.cos(a0 + 0.5) * b.rx * 0.75, y + Math.sin(a0 + 0.5) * b.ry * 0.75)
        ctx.lineTo(x + Math.cos(a0 + 0.9) * b.rx * 0.55, y + Math.sin(a0 + 0.9) * b.ry * 0.55)
        ctx.stroke()
      }
    }

    // пипсы HP
    if (b.maxHp > 1 && b.hp > 1) {
      ctx.fillStyle = "rgba(4,18,26,0.75)"
      for (let i = 0; i < b.hp; i++) {
        ctx.beginPath()
        ctx.arc(x + (i - (b.hp - 1) / 2) * 8, y + b.ry * 0.55, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // «матрёшка»: мини-шарики внутри
    if (b.splits) {
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      for (let i = 0; i < 3; i++) {
        const aa = b.seed + (i * Math.PI * 2) / 3 + time * 0.9
        ctx.beginPath()
        ctx.ellipse(
          x + Math.cos(aa) * b.rx * 0.36,
          y + Math.sin(aa) * b.ry * 0.36,
          Math.max(3, b.rx * 0.17),
          Math.max(3, b.ry * 0.17),
          0,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    }
  }
}

export function drawBoss(ctx: Ctx, boss: BossState | null, balls: Ball[]) {
  const bo = boss
  if (!bo) return
  const angry = bo.hp < bo.maxHp * 0.4
  ctx.save()
  ctx.translate(bo.x, bo.y)
  const frac = clamp(bo.hp / bo.maxHp, 0, 1)
  ctx.lineWidth = 6
  ctx.strokeStyle = "rgba(4,18,26,0.7)"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
  ctx.stroke()
  ctx.shadowColor = angry ? "#ff5347" : "#ff5ca8"
  ctx.shadowBlur = 30
  const g = ctx.createRadialGradient(-bo.r * 0.35, -bo.r * 0.4, 4, 0, 0, bo.r * 1.2)
  if (angry) {
    g.addColorStop(0, "#ffd9d4")
    g.addColorStop(0.45, "#ff6a5c")
    g.addColorStop(1, "#5a0f08")
  } else {
    g.addColorStop(0, "#ffd0e8")
    g.addColorStop(0.45, "#ff5ca8")
    g.addColorStop(1, "#5a0f3c")
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  if (bo.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.7})`
    ctx.beginPath()
    ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
    ctx.fill()
  }
  // корона
  ctx.fillStyle = "#ffc94d"
  ctx.beginPath()
  const cy0 = -bo.r * 0.92
  ctx.moveTo(-bo.r * 0.42, cy0)
  ctx.lineTo(-bo.r * 0.42, cy0 - bo.r * 0.28)
  ctx.lineTo(-bo.r * 0.2, cy0 - bo.r * 0.1)
  ctx.lineTo(0, cy0 - bo.r * 0.34)
  ctx.lineTo(bo.r * 0.2, cy0 - bo.r * 0.1)
  ctx.lineTo(bo.r * 0.42, cy0 - bo.r * 0.28)
  ctx.lineTo(bo.r * 0.42, cy0)
  ctx.closePath()
  ctx.fill()
  // глаза следят за шаром
  const target = balls.find((b) => !b.stuck)
  let ex = 0
  let ey = 0
  if (target) {
    const dx = target.x - bo.x
    const dy = target.y - bo.y
    const dl = Math.hypot(dx, dy) || 1
    ex = (dx / dl) * bo.r * 0.08
    ey = (dy / dl) * bo.r * 0.08
  }
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.ellipse(sx * bo.r * 0.32, -bo.r * 0.15, bo.r * 0.2, bo.r * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#12222c"
    ctx.beginPath()
    ctx.arc(sx * bo.r * 0.32 + ex, -bo.r * 0.15 + ey, bo.r * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  // рот
  ctx.strokeStyle = "#3c0a26"
  ctx.lineWidth = bo.r * 0.07
  ctx.lineCap = "round"
  ctx.beginPath()
  if (angry) {
    ctx.moveTo(-bo.r * 0.3, bo.r * 0.42)
    for (let i = 0; i <= 6; i++) {
      ctx.lineTo(-bo.r * 0.3 + (i * bo.r * 0.6) / 6, bo.r * 0.42 + (i % 2 ? bo.r * 0.09 : 0))
    }
  } else {
    ctx.arc(0, bo.r * 0.28, bo.r * 0.3, 0.15, Math.PI - 0.15)
  }
  ctx.stroke()
  ctx.restore()
}

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
export interface LaserBeamView {
  time: number
  hidden: boolean
  laserUntil: number
  paddle: PaddleState
  blocks: Block[]
  boss: BossState | null
}

export function drawLaserBeams(ctx: Ctx, v: LaserBeamView) {
  if (v.time >= v.laserUntil || v.hidden) return
  const cyc = v.time % 0.3
  if (cyc >= 0.17) return
  const onAmt = 1 - cyc / 0.17
  const p = v.paddle
  const pylonY = p.y - p.h / 2 - 8
  for (const s of [-0.36, 0.36]) {
    const px = p.x + p.w * s
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
export interface BallView {
  time: number
  hidden: boolean
  fire: boolean
  slow: boolean
  fast: boolean
}

export function drawBalls(ctx: Ctx, balls: Ball[], v: BallView) {
  if (v.hidden) return
  const mode = v.fire
    ? { trail: "rgba(255,138,61,", mid: "#ffe9a8", core: "#ff5347", glow: "#ff8a3d" }
    : v.slow
      ? { trail: "rgba(93,255,176,", mid: "#d2ffee", core: "#2fd98a", glow: "#5dffb0" }
      : v.fast
        ? { trail: "rgba(255,106,92,", mid: "#ffd9d4", core: "#ff5347", glow: "#ff6a5c" }
        : { trail: "rgba(120,240,255,", mid: "#c9f6ff", core: "#38bcd8", glow: "#7cf5ff" }
  for (const b of balls) {
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i]
      const a = (i / b.trail.length) * 0.28
      ctx.beginPath()
      ctx.arc(t.x, t.y, b.r * (0.3 + (i / b.trail.length) * 0.6), 0, Math.PI * 2)
      ctx.fillStyle = `${mode.trail}${a})`
      ctx.fill()
    }
    if (b.stuck) {
      const pr = b.r + 6 + Math.sin(v.time * 6) * 2.5
      const c = Math.PI * 2 * pr
      const n = 18
      const seg = c / n
      ctx.beginPath()
      ctx.arc(b.x, b.y, pr, Math.PI / 2, Math.PI / 2 + Math.PI * 2)
      ctx.strokeStyle = `${mode.trail}0.65)`
      ctx.lineWidth = 2
      ctx.setLineDash([seg * 0.45, seg * 0.55])
      ctx.lineDashOffset = -v.time * 30
      ctx.stroke()
      ctx.setLineDash([])
      ctx.lineDashOffset = 0
    }
    const sq = b.squash * 0.28
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

/** Снимок данных для отрисовки ракетки (положение + таймеры эффектов). */
export interface PaddleView {
  p: PaddleState
  time: number
  wideUntil: number
  shrinkUntil: number
  laserUntil: number
  laserArmed: boolean
  rocketUntil: number
  magnetUntil: number
}

export function drawPaddle(ctx: Ctx, v: PaddleView) {
  const p = v.p
  const time = v.time
  const ww = p.w * (1 + p.squash * 0.12)
  const hh = p.h * (1 - p.squash * 0.3)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(clamp(p.vx * 0.00011, -0.1, 0.1))
  const wide = time < v.wideUntil
  const shrink = !wide && time < v.shrinkUntil
  ctx.shadowColor = wide ? "#ffc94d" : shrink ? "#ff5347" : "#35e0ff"
  ctx.shadowBlur = 22
  const g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2)
  if (wide) {
    g.addColorStop(0, "#ffe9a8")
    g.addColorStop(0.5, "#ffc94d")
    g.addColorStop(1, "#c07f0e")
  } else if (shrink) {
    g.addColorStop(0, "#ffb8b0")
    g.addColorStop(0.5, "#ff5347")
    g.addColorStop(1, "#8f1d12")
  } else {
    g.addColorStop(0, "#aef7ff")
    g.addColorStop(0.5, "#35e0ff")
    g.addColorStop(1, "#0e86a3")
  }
  ctx.fillStyle = g
  roundRect(ctx, -ww / 2, -hh / 2, ww, hh, hh / 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  roundRect(ctx, -ww / 2 + 6, -hh / 2 + 2.5, ww - 12, 4, 2)
  ctx.fill()
  ctx.fillStyle = "rgba(4,18,26,0.35)"
  ctx.beginPath()
  ctx.arc(-ww / 2 + hh / 2, 0, hh * 0.22, 0, Math.PI * 2)
  ctx.arc(ww / 2 - hh / 2, 0, hh * 0.22, 0, Math.PI * 2)
  ctx.fill()
  const laserOn = time < v.laserUntil
  const rocketOn = time < v.rocketUntil
  if (laserOn || v.laserArmed) {
    const charge = !laserOn && v.laserArmed ? 8 + Math.sin(time * 16) * 6 : 10
    ctx.shadowColor = "#7cf5ff"
    ctx.shadowBlur = charge
    ctx.fillStyle = !laserOn && v.laserArmed ? "#5fd8ef" : "#9df2ff"
    for (const s of [-0.36, 0.36]) {
      roundRect(ctx, ww * s - 3, -hh / 2 - 9, 6, 10, 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }
  if (rocketOn) {
    ctx.shadowColor = "#ffc94d"
    ctx.shadowBlur = 10
    ctx.fillStyle = "#ffe9a8"
    roundRect(ctx, -4.5, -hh / 2 - 13, 9, 14, 3)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "#ff6a5c"
    ctx.beginPath()
    ctx.arc(0, -hh / 2 - 13, 3, Math.PI, 0)
    ctx.fill()
  }
  if (time < v.magnetUntil) {
    const pulse = 0.5 + Math.sin(time * 8) * 0.25
    ctx.strokeStyle = `rgba(77,255,158,${pulse})`
    ctx.lineWidth = 2.5
    ctx.setLineDash([6, 7])
    ctx.lineDashOffset = -time * 30
    ctx.beginPath()
    ctx.arc(0, -hh / 2 - 4, ww * 0.44, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
  }
  ctx.restore()
}

export function drawParticles(ctx: Ctx, particles: Particle[]) {
  for (const p of particles) {
    const a = clamp(p.life / p.maxLife, 0, 1)
    ctx.globalAlpha = a
    ctx.fillStyle = p.color
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
