-- Добавление screen_class — категории экрана для раздельного рейтинга.
-- mobile (телефоны/планшеты), fhd (HD/FullHD/2K/ultrawide), 4k (4K+).
-- Категория определяется автоматически по диагонали окна и пишется клиентом.

alter table public.sharoboy_scores
  add column if not exists screen_class text not null default '';

comment on column public.sharoboy_scores.screen_class is 'mobile | fhd | 4k — категория экрана; пустая строка для записей до миграции';
