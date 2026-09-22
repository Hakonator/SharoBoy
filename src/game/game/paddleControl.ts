import type { PaddleShapeKind } from "../types"
import type { Game } from "../game"
import { HUD_TOP_CSS } from "../viewport"

import { isDebugEffectActive } from "./debug"

/** Текущая форма верхней поверхности ракетки (из эффектов отладки).
 *  Единый источник для физики, ловли бонусов, оружия и рендера. */
export function paddleShape(g: Game): PaddleShapeKind {
  if (isDebugEffectActive(g, "paddleConvex")) return "convex"
  if (isDebugEffectActive(g, "paddleConcave")) return "concave"
  return "flat"
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

/** Верх зоны блоков в мировых единицах: 14% высоты мира, но не выше нижней
 *  границы HUD-плашек — на масштабах < 1 (телефоны) плашки занимают больше
 *  «мира», и блоки опускаются ниже, чтобы плашки их не перекрывали. */
export function blockTop(g: Game): number {
  return Math.min(Math.max(g.h * 0.14, HUD_TOP_CSS / g.scale), g.h * 0.35)
}
