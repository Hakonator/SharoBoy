/**
 * Подключение мировой таблицы рекордов (Supabase).
 *
 * Как включить:
 *   1. Создайте бесплатный проект на https://supabase.com
 *   2. SQL Editor → выполните миграции из docs/DEVELOPMENT.md
 *      («Мировая таблица рекордов»)
 *   3. Задеплойте Edge Function «scores» и секрет SCORE_SECRET
 *      (пошагово — в docs/DEVELOPMENT.md)
 *   4. Скопируйте Project URL и anon public key в .env (см. .env.example)
 *
 * Ключ «anon» публичный по дизайну: он безопасен в клиентском коде и служит
 * JWT-подтверждением вызова Edge Function. Прямого доступа к таблице у клиента
 * нет: запись и чтение идут через функцию, секрет подписи очков живёт только
 * на сервере.
 *
 * Пока поля пустые, игра работает как раньше: рекорды хранятся локально.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ""
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""

export const LEADERBOARD_ENABLED = SUPABASE_URL.trim() !== "" && SUPABASE_ANON_KEY.trim() !== ""
