-- Создание таблицы мирового топа public.sharoboy_scores.
-- Оба режима (campaign / endless) пишутся в одну таблицу, различаясь полем mode.
--
-- Последующие миграции добавляют: created_at, client_sig, screen_class,
-- RLS-политики и триггер sharoboy_scores_best_only.

create table if not exists public.sharoboy_scores (
  id          bigint generated always as identity primary key,
  nick        text not null,
  score       integer not null,
  mode        text not null,
  wave        integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Индекс для быстрой выборки топа (score desc) внутри режима.
create index if not exists sharoboy_scores_mode_score_idx
  on public.sharoboy_scores (mode, score desc);

comment on table public.sharoboy_scores is 'Мировой топ: очки кампании и бесконечного режима';
comment on column public.sharoboy_scores.mode is 'campaign | endless';
comment on column public.sharoboy_scores.wave is 'Волна/уровень, на котором достигнут счёт';
