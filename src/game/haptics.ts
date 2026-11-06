/**
 * Тактильный отклик (Haptic Feedback / Vibration API) для мобильных устройств (T-066).
 *
 * Безопасная обёртка вокруг navigator.vibrate с защитой от отсутствия API
 * (iOS Safari, Desktop) и поддержкой переключателя в настройках.
 */

export type HapticPattern = "light" | "medium" | "heavy" | "save" | "damage"

export const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  /** Лёгкий щелчок (15 мс) — искры, ореол, касания */
  light: 15,
  /** Средний импульс (35 мс) — заряженный отскок ракетки, подбор бонуса */
  medium: 35,
  /** Тяжёлый удар (65 мс) — взрыв ракеты/бомбы, критический удар */
  heavy: 65,
  /** Пульсирующий ритм спасения — клатч-сэйв у нижней границы */
  save: [30, 40, 50],
  /** Тревожная двойная вибрация — раскол щита или потеря жизни */
  damage: [60, 50, 80],
}

/**
 * Запуск вибрации устройства с учётом флага активности в настройках.
 *
 * @param pattern Имя паттерна или число/массив миллисекунд
 * @param enabled Флаг из настроек игрока (по умолчанию true)
 * @returns true, если вызов navigator.vibrate состоялся успешно
 */
export function triggerHaptic(pattern: HapticPattern | number | number[], enabled = true): boolean {
  if (!enabled) return false
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return false
  }

  const durationOrPattern = typeof pattern === "string" ? (HAPTIC_PATTERNS[pattern] ?? 20) : pattern

  try {
    return navigator.vibrate(durationOrPattern)
  } catch {
    return false
  }
}
