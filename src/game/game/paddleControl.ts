import type { PaddleShapeKind } from "../types"
import type { Game } from "../game"
import { hudTopCss } from "../viewport"
import { convexBump } from "../physics/shapes"

import { isDebugEffectActive } from "./debug"

/** Текущая форма верхней поверхности ракетки (из эффектов отладки).
 *  Единый источник для физики, ловли бонусов, оружия и рендера. */
export function paddleShape(g: Game): PaddleShapeKind {
  if (isDebugEffectActive(g, "paddleConvex")) return "convex"
  if (isDebugEffectActive(g, "paddleConcave")) return "concave"
  return "flat"
}

/** Выходное направление вертикально падающего шара от формы ракетки в точке x. */
export function paddleLaunchAngle(kind: PaddleShapeKind, rel: number, halfW: number): number {
  if (kind === "flat") return -Math.PI / 2 + rel * 1.05
  const sign = kind === "concave" ? -1 : 1
  const slope = (sign * 2 * convexBump(halfW) * rel) / halfW
  const length = Math.hypot(slope, 1)
  const nx = slope / length
  const ny = -1 / length
  const dot = ny
  const vx = -2 * dot * nx
  const vy = 1 - 2 * dot * ny
  return Math.atan2(-Math.abs(vy), vx)
}

/** Обновление поворота ракетки (режим отладки: ЛКМ/ПКМ = ±30°). */
export function updatePaddleRotation(g: Game, dt: number) {
  const p = g.paddle
  const ROT_MAX = (30 * Math.PI) / 180 // 30 градусов
  const ROT_SPEED = 12 // скорость поворота
  const inp = g.input
  const active = isDebugEffectActive(g, "paddleRotation")
  const impulseActive = isDebugEffectActive(g, "paddleImpulse")
  // Блокируем поворот при старте мяча (мяч прилип к ракетке)
  const ballStuck = g.balls.some((b) => b.stuck)

  if (impulseActive) {
    // --- Импульсный режим: однократный резкий доворот и автоматический возврат ---
    const edgeLeft = inp.leftButton && !g.prevLeftDown
    const edgeRight = inp.rightButton && !g.prevRightDown
    g.prevLeftDown = inp.leftButton
    g.prevRightDown = inp.rightButton
    if (!ballStuck && g.paddleImpulse === null) {
      if (edgeLeft && !edgeRight) {
        g.paddleImpulse = { dir: 1, t: 0 }
      } else if (edgeRight && !edgeLeft) {
        g.paddleImpulse = { dir: -1, t: 0 }
      }
    }
    if (g.paddleImpulse) {
      g.paddleImpulse.t += dt
      const t = g.paddleImpulse.t
      const total = 0.35 // полный цикл: доворот + удержание + возврат
      const rise = 0.08 // резкий доворот
      const hold = 0.14 // удержание угла
      let k: number
      if (t < rise) {
        k = t / rise // 0 → 1
      } else if (t < rise + hold) {
        k = 1 // держим максимум
      } else {
        const f = (t - rise - hold) / (total - rise - hold) // 0 → 1
        k = 1 - f * f * (3 - 2 * f) // smoothstep-возврат
      }
      p.rot = g.paddleImpulse.dir * ROT_MAX * k
      if (t >= total) {
        p.rot = 0
        g.paddleImpulse = null
      }
    }
    return
  }

  if (!active) {
    // Эффект выключен — плавно возвращаем в 0
    if (p.rot) {
      p.rot *= Math.exp(-dt * 6)
      if (Math.abs(p.rot) < 0.01) p.rot = 0
    }
    return
  }
  if (ballStuck) return
  let target = 0
  if (inp.leftButton && !inp.rightButton) target = ROT_MAX
  else if (inp.rightButton && !inp.leftButton) target = -ROT_MAX
  // Плавно подходим к целевому углу
  p.rot = (p.rot ?? 0) + (target - (p.rot ?? 0)) * Math.min(1, dt * ROT_SPEED)
}
/** Отступ ракетки от нижнего края: на таче выше — палец не закрывает ракетку.
 *  Задаётся в CSS-пикселях (размер пальца физический и от масштаба мира не
 *  зависит), поэтому в мировые единицы переводим делением. */
export function paddleBottomOffset(g: Game): number {
  // Поднято на 10px против прежних 34/100: низ чаши-ленты не задевает щит.
  return (g.touchMode ? 110 : 44) / g.scale
}

/** Верх неигровой HUD-зоны в мировых единицах для любой ориентации. */
export function blockTop(g: Game): number {
  return Math.min(Math.max(hudTopCss(g.cssW, g.cssH) / g.scale, g.h * 0.08), g.h * 0.35)
}

/** Верхняя безопасная граница спавна блоков совпадает с границей отскока. */
export function blockSpawnTop(g: Game): number {
  return blockTop(g)
}
