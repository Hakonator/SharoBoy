/**
 * Валидатор названий карт и защита от подмены букв (гомоглифов).
 * Ре-экспортирует общий модуль из Edge Function «maps» (supabase/functions/maps/titleValidator.ts).
 */
export {
  canonicalMapTitle,
  isTitleCollision,
  validateMapTitle,
  type TitleValidationResult,
} from "../../supabase/functions/maps/titleValidator"
