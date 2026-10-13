import { lsGet, lsSet } from "./utils"

export type GraphicsQuality = "ultra" | "high" | "eco"
export type ShakeMultiplier = 0 | 0.5 | 1
export type FlashMultiplier = 0 | 0.5 | 1

export interface GameSettings {
  /** Качество графики: лимит частиц и эффектов свечения. */
  graphicsQuality: GraphicsQuality
  /** Множитель тряски экрана при взрывах и ударах (0 = выкл, 0.5 = 50%, 1 = 100%). */
  screenShake: ShakeMultiplier
  /** Множитель полноэкранных вспышек (0 = выкл, 0.5 = 50%, 1 = 100%). */
  screenFlash: FlashMultiplier
  /** Пространственное стерео (панорамирование звуков по координате X). */
  stereoPanning: boolean
  /** Восходящий тон при серии попаданий по блокам (комбо). */
  comboPitch: boolean
  /** Подводный muffling-фильтр низких частот во время паузы. */
  underwaterFilter: boolean
}

export const SETTINGS_STORAGE_KEY = "sharoboy-game-settings"

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: "high",
  screenShake: 1,
  screenFlash: 1,
  stereoPanning: true,
  comboPitch: true,
  underwaterFilter: true,
}

type SettingsListener = (settings: GameSettings) => void
const listeners = new Set<SettingsListener>()

/** Безопасная валидация загруженного объекта настроек. */
function validateSettings(raw: unknown): GameSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS }
  const obj = raw as Record<string, unknown>

  const graphicsQuality: GraphicsQuality =
    obj.graphicsQuality === "ultra" ||
    obj.graphicsQuality === "eco" ||
    obj.graphicsQuality === "high"
      ? obj.graphicsQuality
      : DEFAULT_SETTINGS.graphicsQuality

  const screenShake: ShakeMultiplier =
    obj.screenShake === 0 || obj.screenShake === 0.5 || obj.screenShake === 1
      ? obj.screenShake
      : DEFAULT_SETTINGS.screenShake

  const screenFlash: FlashMultiplier =
    obj.screenFlash === 0 || obj.screenFlash === 0.5 || obj.screenFlash === 1
      ? obj.screenFlash
      : DEFAULT_SETTINGS.screenFlash

  const stereoPanning =
    typeof obj.stereoPanning === "boolean" ? obj.stereoPanning : DEFAULT_SETTINGS.stereoPanning

  const comboPitch =
    typeof obj.comboPitch === "boolean" ? obj.comboPitch : DEFAULT_SETTINGS.comboPitch

  const underwaterFilter =
    typeof obj.underwaterFilter === "boolean"
      ? obj.underwaterFilter
      : DEFAULT_SETTINGS.underwaterFilter

  return {
    graphicsQuality,
    screenShake,
    screenFlash,
    stereoPanning,
    comboPitch,
    underwaterFilter,
  }
}

let cachedSettings: GameSettings | null = null

/** Загрузить сохранённые настройки из localStorage с fallback на значения по умолчанию. */
export function loadSettings(): GameSettings {
  if (cachedSettings) return { ...cachedSettings }
  const raw = lsGet(SETTINGS_STORAGE_KEY)
  if (!raw) {
    cachedSettings = { ...DEFAULT_SETTINGS }
    return { ...cachedSettings }
  }
  try {
    const parsed = JSON.parse(raw)
    cachedSettings = validateSettings(parsed)
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS }
  }
  return { ...cachedSettings }
}

/** Сохранить изменения настроек и уведомить слушателей. */
export function saveSettings(partial: Partial<GameSettings>): GameSettings {
  const current = loadSettings()
  const updated: GameSettings = validateSettings({ ...current, ...partial })
  cachedSettings = updated
  lsSet(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
  listeners.forEach((fn) => {
    try {
      fn(updated)
    } catch {
      /* игнорируем ошибку в слушателе */
    }
  })
  return { ...updated }
}

/** Сбросить настройки на исходные по умолчанию. */
export function resetSettings(): GameSettings {
  cachedSettings = null
  return saveSettings(DEFAULT_SETTINGS)
}

/** Сбросить кэш настроек в памяти (для тестов). */
export function _clearSettingsCache(): void {
  cachedSettings = null
}

/** Подписаться на изменение настроек. Возвращает функцию отписки. */
export function subscribeSettings(fn: SettingsListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Максимальный лимит частиц в зависимости от пресета качества. */
export function particleLimitForQuality(quality: GraphicsQuality): number {
  switch (quality) {
    case "ultra":
      return 650
    case "eco":
      return 150
    case "high":
    default:
      return 400
  }
}
