/**
 * Режимы скорости шара: эффекты замедления/ускорения и перманентный разгон
 * по мере зачистки уровня. Формула одна и та же для физики (пересчёт вектора
 * скорости) и для системы дропов (когда «замедление» полезно).
 */
import { clamp } from "../utils"

/** Множитель скорости шара под эффектом замедления. */
export const SLOW_SPEED_MULT = 0.72
/** Множитель скорости шара под эффектом ускорения. */
export const FAST_SPEED_MULT = 1.32
/** Базовый радиус шара. */
export const BASE_BALL_RADIUS = 9
/** Множитель радиуса шара под эффектом «Гравитационное ядро». */
export const BIG_BALL_RADIUS_MULT = 1.6
/** Радиус шара под эффектом «Гравитационное ядро» (9 * 1.6 = 14.4). */
export const BIG_BALL_RADIUS = 14.4
/** Множитель скорости шара под эффектом «Гравитационное ядро» (-10%). */
export const BIG_BALL_SPEED_MULT = 0.9
/** Максимальный перманентный разгон к полной зачистке уровня (+24%). */
export const CLEAR_RAMP_MAX = 0.24
/** Порог «шар разогнан»: фактическая скорость ≥ номинала × 1.5. */
export const SPEEDUP_RATIO = 1.5

export interface SpeedMode {
  /** Активен эффект замедления (приоритетен над ускорением). */
  slow: boolean
  /** Активен эффект ускорения. */
  fast: boolean
  /** Активен эффект «Гравитационное ядро» (компенсация скорости -10%). */
  big?: boolean
  /** Доля зачищенных блоков уровня, 0..1 (сверх — обрезается). */
  cleared: number
}

/** Полный множитель фактической скорости шара к его номиналу (ball.speed). */
export function ballSpeedMult(m: SpeedMode): number {
  const ramp = 1 + clamp(m.cleared, 0, 1) * CLEAR_RAMP_MAX
  const base = m.slow ? SLOW_SPEED_MULT : m.fast ? FAST_SPEED_MULT : 1
  const bigMult = m.big ? BIG_BALL_SPEED_MULT : 1
  return base * bigMult * ramp
}

/** Единый расчёт базового радиуса шара с учётом эффекта «Гравитационное ядро». */
export function baseBallRadius(
  g?: { bigActive?: () => boolean } | { time: number; bigUntil: number }
): number {
  if (!g) return BASE_BALL_RADIUS
  if ("bigActive" in g && typeof g.bigActive === "function") {
    return g.bigActive() ? BIG_BALL_RADIUS : BASE_BALL_RADIUS
  }
  if ("time" in g && "bigUntil" in g) {
    return (g as { time: number; bigUntil: number }).time <
      (g as { time: number; bigUntil: number }).bigUntil
      ? BIG_BALL_RADIUS
      : BASE_BALL_RADIUS
  }
  return BASE_BALL_RADIUS
}

/** Разогнан ли шар до порога, при котором «замедление» становится спас-бонусом
 *  (иначе оно лишь тормозит и без того комфортную скорость). */
export function isBallSpedUp(m: SpeedMode): boolean {
  return ballSpeedMult(m) >= SPEEDUP_RATIO
}
