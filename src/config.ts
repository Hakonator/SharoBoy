/**
 * Подключение мировой таблицы рекордов (Supabase).
 *
 * Как включить (5 минут):
 *   1. Создайте бесплатный проект на https://supabase.com
 *   2. SQL Editor → выполните SQL из README (раздел «Мировая таблица рекордов»)
 *   3. Project Settings → API: скопируйте Project URL (без /rest/v1 — SDK
 *      добавит его сам) и anon public key сюда:
 *
 * Ключ «anon» публичный по дизайну: он безопасен в клиентском коде,
 * права доступа определяются RLS-политиками таблицы (см. SQL в README) —
 * читать и добавлять очки можно всем, изменять и удалять чужие — нельзя.
 *
 * Пока поля пустые, игра работает как раньше: рекорды хранятся локально.
 */
export const SUPABASE_URL = "https://wbidprepvccgxtujqsjy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_af_ESvQDUWkDxBWzQ7fJ3w_VEK-f8Uk";

export const LEADERBOARD_ENABLED = SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== "";

/**
 * Секрет для подписи очков (анти-накрутка).
 *
 * Перед записью в мировой топ клиент считает сигнатуру
 *   client_sig = hash(nick + score + wave + mode + SCORE_SECRET)
 * и сохраняет её в таблице. При чтении топа записи с неверной подписью
 * отбрасываются, а в SQL добавлен CHECK-констрейнт на длину сигнатуры.
 *
 * Это не панацея (секрет виден в коде сайта), но закрывает «фейковые»
 * записи через консоль для обычных игроков. Смените секрет перед релизом.
 */
export const SCORE_SECRET = "sharoboy-bump-2026-change-me";
