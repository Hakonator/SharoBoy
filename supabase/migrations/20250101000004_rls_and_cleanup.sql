-- RLS: закрыть таблицу от прямых записей для anon/authenticated.
-- Писать может только Edge Function (через service role).
-- Читать может кто угодно (публичное чтение топа).

alter table public.sharoboy_scores enable row level security;

-- Политика чтения: любой может читать топ.
create policy "sharoboy_scores_select_anon"
  on public.sharoboy_scores
  for select
  to anon, authenticated
  using (true);

-- Явно запрещаем вставку/обновление/удаление для anon и authenticated.
-- (RLS без политики на INSERT/UPDATE/DELETE запрещает их по умолчанию,
--  но явный revoke страхует от случайного создания разрешающей политики.)
revoke insert, update, delete on table public.sharoboy_scores from anon;
revoke insert, update, delete on table public.sharoboy_scores from authenticated;

-- Записи до эпохи подписей (client_sig = '') всегда скрывались клиентским
-- фильтром; теперь проверка выполняется на сервере в Edge Function —
-- удаляем их, чтобы не хранить мусор.
delete from public.sharoboy_scores where client_sig = '';
