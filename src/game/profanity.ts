/**
 * Фильтр запрещённых ников — ре-экспорт общего модуля Edge Function «scores»,
 * чтобы у клиента и сервера была одна копия кода (см. supabase/functions/scores/profanity.ts).
 * Файл чистый (без Deno- и браузерных API), поэтому безопасен для клиентского бандла.
 */
export {
  containsProfanity,
  MAX_NICK,
  normalizeForCheck,
  validateNick,
} from "../../supabase/functions/scores/profanity"
export type { NickCheck } from "../../supabase/functions/scores/profanity"
