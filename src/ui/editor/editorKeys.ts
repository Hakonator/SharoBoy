/**
 * Клавиатурный контракт полноэкранного редактора карт.
 *
 * Редактор — модальный оверлей поверх главного меню, а игровой `InputController`
 * слушает `window` и на `Space`/`Enter` вызывает `primaryAction()` → `startGame()`
 * → карту кампании. Поэтому редактор обязан забирать служебные клавиши игры вне
 * зависимости от режима условия победы и наличия выделения.
 *
 * Логика вынесена в чистую функцию, чтобы регресс «Space открывает кампанию»
 * проверялся без DOM и без игрового движка.
 */
import type { PlayerMapSpec } from "../../game/mapSpec"

/** Служебные клавиши, которые игровой ввод обрабатывает на `window`. */
export type EditorGameKey = "space" | "enter" | "mute" | "music" | "pause"

export interface EditorKeyInput {
  key: EditorGameKey
  winCondition: PlayerMapSpec["winCondition"]
  selectedBlockIds: readonly string[]
  /** Фокус на кнопке/ссылке: браузер сам активирует элемент по Space/Enter. */
  interactiveTarget: boolean
  /** Автоповтор удержанной клавиши. */
  repeat: boolean
}

export interface EditorKeyDecision {
  /** Отменять ли браузерное действие по умолчанию (активацию кнопки, скролл). */
  preventDefault: boolean
  /** Блоки, у которых нужно переключить цель (`TOGGLE_TARGETS`), либо `null`. */
  toggleTargetIds: string[] | null
}

/**
 * Решение по служебной клавише игры, пока открыт редактор.
 * Вызывающая сторона обязана в любом случае остановить всплытие события:
 * иначе `InputController` увидит клавишу и запустит игру.
 */
export function resolveEditorKey(input: EditorKeyInput): EditorKeyDecision {
  const { key, winCondition, selectedBlockIds, interactiveTarget, repeat } = input

  // Музыка и пауза: у редактора свои кнопки, в движок клавиши не отдаём.
  if (key === "mute" || key === "music" || key === "pause") {
    return { preventDefault: false, toggleTargetIds: null }
  }

  // Кнопки и ссылки активируются браузером сами — отменять действие нельзя,
  // но всплытие всё равно глушим, чтобы игра не стартовала.
  if (interactiveTarget) return { preventDefault: false, toggleTargetIds: null }

  if (key === "enter") return { preventDefault: true, toggleTargetIds: null }

  // Space: всегда принадлежит редактору, даже когда переключать нечего.
  if (repeat) return { preventDefault: true, toggleTargetIds: null }
  if (winCondition.kind === "targets" && selectedBlockIds.length > 0) {
    return { preventDefault: true, toggleTargetIds: [...selectedBlockIds] }
  }
  return { preventDefault: true, toggleTargetIds: null }
}
