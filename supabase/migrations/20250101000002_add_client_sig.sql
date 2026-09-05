-- Добавление client_sig — подписи очков (FNV-1a, 8 hex-символов).
-- Подпись считается Edge Function и защищает от записей в обход функции.
--
-- CHECK гарантирует: либо старая запись до эпохи подписей (пустая строка),
-- либо валидная подпись длины 8. Другие значения не пройдут.

alter table public.sharoboy_scores
  add column if not exists client_sig text not null default '';

-- 0 = старые записи до миграции (будут скрыты из топа проверкой подписи),
-- 8 = валидная подпись (fnv1a → 8 hex-символов).
alter table public.sharoboy_scores
  add constraint sharoboy_scores_sig_len check (char_length(client_sig) in (0, 8));

comment on column public.sharoboy_scores.client_sig is 'Подпись nick:score:mode:wave:screen:secret (8 hex), пустая строка для записей до эпохи подписей';
