import type { Ball, Block, BossState, PaddleState, PowerUp, Projectile } from "../types"

/**
 * DEV-оверлеи (только DEV-сборка): хитбоксы сущностей (F2) и индикаторы
 * активных отладочных режимов — замедление (F3) и бессмертие (F4).
 */

const HITBOX_STROKE = "rgba(255, 77, 109, 0.95)"
const HITBOX_FILL = "rgba(255, 77, 109, 0.16)"

/** Снимок сущностей для отрисовки хитбоксов (формы совпадают с физикой). */
export interface HitboxView {
  blocks: Block[]
  balls: Ball[]
  paddle: PaddleState
  paddleRot: number
  boss: BossState | null
  powers: PowerUp[]
  projectiles: Projectile[]
}

/** Хитбоксы: эллипс блока, круг шара/босса/бонуса/снаряда, прямоугольник ракетки. */
export function drawHitboxes(ctx: CanvasRenderingContext2D, v: HitboxView): void {
  ctx.save()
  ctx.lineWidth = 2
  ctx.strokeStyle = HITBOX_STROKE
  ctx.fillStyle = HITBOX_FILL
  for (const b of v.blocks) {
    if (b.dead) continue
    // Блок — вращающийся эллипс: ровно та форма, с которой считает физика.
    ctx.beginPath()
    ctx.ellipse(b.x, b.y, b.rx, b.ry, b.rot, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  for (const ball of v.balls) {
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  // Ракетка — прямоугольник с поворотом (формы convex/concave — приближение).
  ctx.save()
  ctx.translate(v.paddle.x, v.paddle.y)
  ctx.rotate(v.paddleRot)
  ctx.beginPath()
  ctx.rect(-v.paddle.w / 2, -v.paddle.h / 2, v.paddle.w, v.paddle.h)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  if (v.boss) {
    ctx.beginPath()
    ctx.arc(v.boss.x, v.boss.y, v.boss.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  // Бонусы: круг чуть больше визуального (радиус капсулы в render/powers — 13).
  for (const p of v.powers) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  for (const pr of v.projectiles) {
    ctx.beginPath()
    ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/** Индикаторы активных DEV-режимов — над счётчиком FPS в левом нижнем углу. */
export function drawDebugFlags(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  slowMotion: boolean,
  invincible: boolean,
  fontPx: number
): void {
  if (!slowMotion && !invincible) return
  const flags: string[] = []
  if (slowMotion) flags.push("SLOW ×0.25")
  if (invincible) flags.push("GOD")
  ctx.save()
  ctx.font = `700 ${fontPx}px "Russo One", sans-serif`
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "rgba(255, 138, 92, 0.9)"
  ctx.fillText(`DEV: ${flags.join(" · ")}`, 8, h - 8 - fontPx * 1.6)
  ctx.restore()
}
