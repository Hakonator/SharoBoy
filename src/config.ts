/**
 * Подключение мировой таблицы рекордов (Supabase).
 *
 * Как включить (5 минут):
 *   1. Создайте бесплатный проект на https://supabase.com
 *   2. SQL Editor → выполните SQL из README (раздел «Мировая таблица рекордов»)
 *   3. Project Settings → API: скопируйте Project URL и anon public key сюда:
 *
 * Ключ «anon» публичный по дизайну: он безопасен в клиентском коде,
 * права доступа определяются RLS-политиками таблицы (см. SQL в README) —
 * читать и добавлять очки можно всем, изменять и удалять чужие — нельзя.
 *
 * Пока поля пустые, игра работает как раньше: рекорды хранятся локально.
 */
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

export const LEADERBOARD_ENABLED =
  SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== "";
