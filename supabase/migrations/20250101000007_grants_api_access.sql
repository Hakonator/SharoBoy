-- Явные GRANT для Data API на public.sharoboy_scores.
--
-- С 30 октября Supabase перестаёт автоматически выдавать доступ через Data API
-- новым таблицам в public (в т.ч. созданным миграциями — новые проекты,
-- preview-ветки, локальный «supabase db reset»). Существующая боевая таблица
-- сохраняет старые гранты, но без этой миграции свежий reset/новый проект
-- даст permission denied даже для service_role (BYPASSRLS обходит RLS,
-- но не отсутствие привилегий).
--
-- Правило на будущее: любая новая таблица получает GRANT в своей же миграции.
-- Чтение топа — публичное (anon/authenticated), запись — только Edge Function
-- под service_role (см. 20250101000004_rls_and_cleanup.sql).

grant select
on public.sharoboy_scores
to anon, authenticated;

grant all
on public.sharoboy_scores
to service_role;