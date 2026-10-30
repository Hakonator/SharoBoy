/**
 * Подсистема «Ежедневные испытания» (Daily Runs, T-041, §3.2 Roadmap).
 *
 * Единый фиксированный сид дня для всех игроков мира, фиксированный суточный набор
 * мутаторов станции «СФЕРА-1080», отдельная таблица рекордов дня со сбросом в полночь UTC.
 */

import {
  CAMPAIGN_MODIFIERS,
  type CampaignModifierDef,
  type CampaignModifierId,
} from "./campaignModifiers"
import { daySeed, formatDayDate, mulberry32 } from "./utils"

export interface DailyRunInfo {
  /** Идентификатор даты дня (UTC): "YYYY-MM-DD" */
  readonly date: string
  /** Форматированная дата: "DD.MM.YYYY" */
  readonly dateFormatted: string
  /** 32-битный сид дня (YYYYMMDD) */
  readonly daySeed: number
  /** Детерминированный сид генерации карты кампании */
  readonly campaignSeed: number
  /** Список id мутаторов дня */
  readonly modifiers: readonly CampaignModifierId[]
  /** Полные описания активных мутаторов дня */
  readonly modifierDefs: readonly CampaignModifierDef[]
  /** Суммарный множитель очков за мутаторы (например, 0.70 = +70%) */
  readonly totalScoreBonus: number
  /** Суммарный множитель кристаллов за мутаторы */
  readonly totalCrystalBonus: number
}

/**
 * Детерминированно выбирает 2 различных мутатора из пула CAMPAIGN_MODIFIERS
 * для заданного календарного дня по UTC.
 */
export function getDailyModifiers(date = new Date()): CampaignModifierId[] {
  const seed = daySeed(date)
  const rng = mulberry32(seed * 7919 + 1013)
  const pool = [...CAMPAIGN_MODIFIERS]
  const idx1 = Math.floor(rng() * pool.length)
  const mod1 = pool.splice(idx1, 1)[0]
  const idx2 = Math.floor(rng() * pool.length)
  const mod2 = pool[idx2]
  return [mod1.id, mod2.id]
}

/**
 * Рассчитывает время до следующего сброса ежедневного испытания (полночь UTC).
 */
export function getDailyTimeUntilReset(now = new Date()): {
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
  formatted: string
} {
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  )
  const diffMs = Math.max(0, nextMidnightUtc - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  return { hours, minutes, seconds, totalSeconds, formatted }
}

/**
 * Возвращает полный объект метаданных ежедневного забега для заданной даты UTC.
 */
export function getDailyRunInfo(date = new Date()): DailyRunInfo {
  const seed = daySeed(date)
  // Константный оффсет станции СФЕРА-1080 для изоляции сида ежедневного забега от обычных прогонов
  const campaignSeed = (seed * 31 + 1080) | 0
  const modifierIds = getDailyModifiers(date)
  const modifierDefs = modifierIds
    .map((id) => CAMPAIGN_MODIFIERS.find((m) => m.id === id))
    .filter((m): m is CampaignModifierDef => Boolean(m))

  const totalScoreBonus = modifierDefs.reduce((acc, m) => acc + m.scoreBonus, 0)
  const totalCrystalBonus = modifierDefs.reduce((acc, m) => acc + m.crystalBonus, 0)

  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const year = date.getUTCFullYear()
  const isoDate = `${year}-${month}-${day}`
  const dateFormatted = formatDayDate(date)

  return {
    date: isoDate,
    dateFormatted,
    daySeed: seed,
    campaignSeed,
    modifiers: modifierIds,
    modifierDefs,
    totalScoreBonus,
    totalCrystalBonus,
  }
}

const STORAGE_KEY_LAST_DAILY = "sharoboy-last-daily-date"

/** Проверяет, запускал ли игрок испытание сегодня (для отметки/статистики). */
export function hasPlayedTodayDaily(date = new Date()): boolean {
  try {
    const lastDate = localStorage.getItem(STORAGE_KEY_LAST_DAILY)
    const today = getDailyRunInfo(date).date
    return lastDate === today
  } catch {
    return false
  }
}

/** Фиксирует запуск ежедневного испытания в локальном хранилище. */
export function markTodayDailyPlayed(date = new Date()): void {
  try {
    const today = getDailyRunInfo(date).date
    localStorage.setItem(STORAGE_KEY_LAST_DAILY, today)
  } catch {
    // игнорируем ошибку недоступности localStorage в приватном режиме
  }
}
