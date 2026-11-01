/**
 * Черновик мутаторов бесконечного режима (T-056).
 *
 * Чистый модуль без зависимостей от движка: после каждой боссовой волны игрок
 * выбирает один из трёх мутаторов, выбранные накапливаются до конца забега.
 *
 * Инварианты, которые нельзя ломать:
 * 1. Опции детерминированы парой (сид забега, номер волны) — повторный вызов
 *    с теми же аргументами возвращает тот же набор. Порядок `CAMPAIGN_MODIFIERS`
 *    и `DRAFT_MODIFIER_IDS` фиксирован, поэтому расширение пула тоже меняет
 *    прошлые забеги — расширять можно только дописыванием в конец.
 * 2. Уже взятые мутаторы и мутаторы, неприменимые в бесконечном режиме
 *    (`DRAFT_EXCLUDED_IDS`), в опции не попадают.
 * 3. Список взятых никогда не длиннее `DRAFT_MAX_PICKS`.
 */

import { CAMPAIGN_MODIFIERS, type CampaignModifierId } from "./campaignModifiers"
import { mulberry32 } from "./utils"

/** Сколько мутаторов можно взять за один забег. */
export const DRAFT_MAX_PICKS = 3
/** Через сколько волн открывается черновик. */
export const DRAFT_WAVE_INTERVAL = 5

/**
 * Мутаторы, которые нельзя выдавать в бесконечном режиме:
 * — `ironman` обнуляет забег при первом промахе и превращает драфт в наказание;
 * — `inverted_controls` ломает управление на тач-устройствах посреди забега.
 */
export const DRAFT_EXCLUDED_IDS: readonly CampaignModifierId[] = ["ironman", "inverted_controls"]

/** Пул черновика: все мутаторы, кроме исключённых из бесконечного режима. */
export const DRAFT_MODIFIER_IDS: readonly CampaignModifierId[] = CAMPAIGN_MODIFIERS.map(
  (m) => m.id
).filter((id) => !DRAFT_EXCLUDED_IDS.includes(id))

/** Момент черновика — после боссовой волны 5, 10, 15… */
export function isDraftWave(wave: number): boolean {
  return Number.isFinite(wave) && wave > 0 && wave % DRAFT_WAVE_INTERVAL === 0
}

/** Сколько мутаторов ещё можно взять. */
export function draftPicksLeft(taken: readonly CampaignModifierId[]): number {
  return Math.max(0, DRAFT_MAX_PICKS - taken.length)
}

/**
 * Три различных мутатора для драфта — детерминированно от сида и номера волны.
 *
 * @param seed  сид забега (для бесконечного режима — 32-битный сид дня старта)
 * @param wave  номер завершённой волны (5, 10, 15…)
 * @param taken уже выбранные мутаторы — исключаются из опций
 */
export function rollDraftOptions(
  seed: number,
  wave: number,
  taken: readonly CampaignModifierId[] = []
): CampaignModifierId[] {
  const available = DRAFT_MODIFIER_IDS.filter((id) => !taken.includes(id))
  // Детерминированный сид: старший бит сида проверяется отдельно, чтобы
  // `seed * 7919` не терял знак при переполнении 32 бит.
  const rng = mulberry32(((seed | 0) * 7919 + wave * 104729) | 0)
  const picks: CampaignModifierId[] = []
  const count = Math.min(DRAFT_MAX_PICKS, available.length)
  const pool = [...available]
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length)
    picks.push(pool[idx]!)
    pool.splice(idx, 1)
  }
  return picks
}

/**
 * Результат выбора в черновике: обновлённый список взятых мутаторов.
 * Повторный выбор уже взятого мутатора или четвёртый выбор игнорируется.
 */
export function applyDraftPick(
  taken: readonly CampaignModifierId[],
  pick: CampaignModifierId | null | undefined
): CampaignModifierId[] {
  if (!pick) return [...taken]
  if (taken.includes(pick)) return [...taken]
  if (taken.length >= DRAFT_MAX_PICKS) return [...taken]
  if (!DRAFT_MODIFIER_IDS.includes(pick)) return [...taken]
  return [...taken, pick]
}
