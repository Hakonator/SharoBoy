/**
 * Управление хранилищем данных аккаунта и прогресса игрока.
 */

/** Список ключей localStorage, относящихся к прогрессу аккаунта игрока. */
export const ACCOUNT_STORAGE_KEYS = [
  "sharoboy-coins",
  "sharoboy-meta-crystals",
  "sharoboy-upgrades",
  "sharoboy-best",
  "sharoboy-top",
  "sharoboy-top-endless",
  "sharoboy-achievements",
  "sharoboy-stats",
  "sharoboy-nick",
  "sharoboy-liked-community-maps",
  "sharoboy-cosmetics",
] as const

/** Безопасная очистка данных аккаунта из localStorage. */
export function clearAccountStorage(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      for (const key of ACCOUNT_STORAGE_KEYS) {
        window.localStorage.removeItem(key)
      }
      return
    }
    if (typeof localStorage !== "undefined") {
      for (const key of ACCOUNT_STORAGE_KEYS) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* sandbox SecurityError / private mode */
  }
}
