import { lsGet, lsSet } from "./utils"

export interface TacticalModulesSettings {
  /** Наклон ракетки на ±30° (Штурвал глубин). */
  paddleRotation: boolean
  /** Импульсный щелчок-флиппер вместо плавного наклона ракетки. */
  paddleImpulse: boolean
  /** Траекторный прицел при старте мяча. */
  aimGuide: boolean
  /** Магнитный старт (автозахват мяча в начале партии). */
  magnetStart: boolean
}

export const TACTICAL_MODULES_STORAGE_KEY = "sharoboy-tactical-modules"

export const DEFAULT_TACTICAL_MODULES: TacticalModulesSettings = {
  paddleRotation: true,
  paddleImpulse: false,
  aimGuide: true,
  magnetStart: true,
}

/** Безопасная валидация загруженного объекта тактических модулей. */
export function validateTacticalModules(raw: unknown): TacticalModulesSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TACTICAL_MODULES }
  const obj = raw as Record<string, unknown>

  return {
    paddleRotation:
      typeof obj.paddleRotation === "boolean"
        ? obj.paddleRotation
        : DEFAULT_TACTICAL_MODULES.paddleRotation,
    paddleImpulse:
      typeof obj.paddleImpulse === "boolean"
        ? obj.paddleImpulse
        : DEFAULT_TACTICAL_MODULES.paddleImpulse,
    aimGuide: typeof obj.aimGuide === "boolean" ? obj.aimGuide : DEFAULT_TACTICAL_MODULES.aimGuide,
    magnetStart:
      typeof obj.magnetStart === "boolean" ? obj.magnetStart : DEFAULT_TACTICAL_MODULES.magnetStart,
  }
}

/** Загрузка настроек тактических модулей из localStorage. */
export function loadTacticalModules(): TacticalModulesSettings {
  const raw = lsGet(TACTICAL_MODULES_STORAGE_KEY)
  if (!raw) return { ...DEFAULT_TACTICAL_MODULES }
  try {
    return validateTacticalModules(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_TACTICAL_MODULES }
  }
}

/** Сохранение настроек тактических модулей в localStorage. */
export function saveTacticalModules(
  patch: Partial<TacticalModulesSettings>
): TacticalModulesSettings {
  const current = loadTacticalModules()
  const updated: TacticalModulesSettings = {
    ...current,
    ...patch,
  }
  lsSet(TACTICAL_MODULES_STORAGE_KEY, JSON.stringify(updated))
  return updated
}
