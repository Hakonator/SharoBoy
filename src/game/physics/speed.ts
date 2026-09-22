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
/** Максимальный перманентный разгон к полной зачистке уровня (+24%). */
export const CLEAR_RAMP_MAX = 0.24
/** Порог «шар разогнан»: фактическая скорость ≥ номинала × 1.5. */
export const SPEEDUP_RATIO = 1.5

export interface SpeedMode {
  /** Активен эффект замедления (приоритетен над ускорением). */
  slow: boolean
  /** Активен эффект ускорения. */
  fast: boolean
  /** Доля зачищенных блоков уровня, 0..1 (сверх — обрезается). */
  cleared: number
}

/** Полный множитель фактической скорости шара к его номиналу (ball.speed). */
export function ballSpeedMult(m: SpeedMode): number {
  const ramp = 1 + clamp(m.cleared, 0, 1) * CLEAR_RAMP_MAX
  return (m.slow ? SLOW_SPEED_MULT : m.fast ? FAST_SPEED_MULT : 1) * ramp
}

/** Разогнан ли шар до порога, при котором «замедление» становится спас-бонусом
 *  (иначе оно лишь тормозит и без того комфортную скорость). */
export function isBallSpedUp(m: SpeedMode): boolean {
  return ballSpeedMult(m) >= SPEEDUP_RATIO
}
