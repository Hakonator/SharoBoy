/**
 * Подпись очков мирового топа — логика, общая для Edge Function «scores».
 * Файл чистый (без Deno- и браузерных API): импортируется и функцией, и
 * юнит-тестами vitest (src/game/leaderboard.test.ts), поэтому формат подписи
 * зафиксирован тестами с обеих сторон.
 */

export type ScoreMode = "campaign" | "endless"
export type SigScreen = "mobile" | "fhd" | "4k"

/** Простой 32-битный FNV-1a хеш строки — для подписи очков. */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, "0")
}

/** Строка таблицы sharoboy_scores, нужная для проверки подписи. */
export interface SigRow {
  nick: string
  score: number
  wave?: number
  screen_class?: string | null
  client_sig?: string | null
}

/** Сигнатура записи. Формат совпадает с историческим клиентским
 *  («nick:score:mode:wave[:screen]:secret»), чтобы записи, подписанные ещё
 *  в браузере до переезда на Edge Function, оставались валидными. */
export function sigFor(
  nick: string,
  score: number,
  mode: ScoreMode,
  wave: number,
  screen: SigScreen | undefined,
  secret: string
): string {
  return screen
    ? fnv1a(`${nick}:${score}:${mode}:${wave}:${screen}:${secret}`)
    : fnv1a(`${nick}:${score}:${mode}:${wave}:${secret}`)
}

/** Проверка подписи строки результата: нет подписи или бита — мимо.
 *  Принимаются и подписи с категорией экрана, и старые — без неё. */
export function sigMatches(
  row: SigRow,
  mode: ScoreMode,
  screen: SigScreen | undefined,
  secret: string
): boolean {
  if (!row.client_sig || row.client_sig.length !== 8) return false
  const wave = row.wave ?? 0
  if (screen && row.client_sig === sigFor(row.nick, row.score, mode, wave, screen, secret)) {
    return true
  }
  return row.client_sig === sigFor(row.nick, row.score, mode, wave, undefined, secret)
}
