import type { PlayerMapSpec } from "../../game/mapSpec"

/** Сужаем тип условия победы до режима «Целевые блоки». */
export type TargetsWinCondition = Extract<PlayerMapSpec["winCondition"], { kind: "targets" }>

/** Условие «Целевые блоки» активно — список целей доступен для редактирования. */
export function getTargetsCondition(
  winCondition: PlayerMapSpec["winCondition"]
): TargetsWinCondition | null {
  return winCondition.kind === "targets" ? winCondition : null
}

/**
 * Приводит список целей к порядку блоков карты и убирает дубликаты и ссылки
 * на несуществующие блоки. Поле `targetIds` валидатор сверяет с `blocks`,
 * поэтому порядок всегда должен идти от карты.
 */
export function orderTargetIds(map: PlayerMapSpec, ids: readonly string[]): string[] {
  const wanted = new Set(ids)
  return map.blocks.filter((block) => wanted.has(block.id)).map((block) => block.id)
}

/** Переключает один блок в списке целей (клик по блоку или галочка в инспекторе). */
export function toggleTargetId(targetIds: readonly string[], blockId: string): string[] {
  const set = new Set(targetIds)
  if (set.has(blockId)) set.delete(blockId)
  else set.add(blockId)
  return [...set]
}

/**
 * Умное переключение группы (клавиша Space): если все блоки группы уже цели —
 * отметка снимается со всех, иначе целью становится каждый блок группы.
 * Одно нажатие — одна запись в истории отмены.
 */
export function toggleTargetIds(
  targetIds: readonly string[],
  blockIds: readonly string[]
): string[] {
  const group = [...new Set(blockIds)]
  if (group.length === 0) return [...targetIds]
  const set = new Set(targetIds)
  const allMarked = group.every((id) => set.has(id))
  for (const id of group) {
    if (allMarked) set.delete(id)
    else set.add(id)
  }
  return [...set]
}

/** Полная замена списка целей (кнопки «Все блоки» и «Снять все»). */
export function replaceTargetIds(blockIds: readonly string[]): string[] {
  return [...new Set(blockIds)]
}
