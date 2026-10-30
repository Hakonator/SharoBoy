-- Миграция №10: поддержка ежедневных испытаний (Daily Runs) в триггере sharoboy_scores_best_only.
--
-- Для режима 'daily' лучший результат игрока фиксируется отдельно для каждого календарного дня (UTC):
-- ключ лучшей попытки:
--   - для 'campaign' и 'endless': (mode, lower(nick), screen_class)
--   - для 'daily': (mode, lower(nick), screen_class, (created_at at time zone 'UTC')::date)
--
-- Повторные попытки игрока в течение одних календарных суток улучшают его суточный рекорд,
-- а рекорды предыдущих дней сохраняются в общей истории ежедневных испытаний.

create or replace function public.sharoboy_scores_best_only()
returns trigger
language plpgsql
security definer
as $$
declare
  existing_score integer;
  new_date date;
begin
  new_date := (coalesce(new.created_at, now()) at time zone 'UTC')::date;

  -- Ищем текущий рекорд игрока в том же режиме и той же категории экрана
  -- (для daily — строго внутри тех же календарных суток UTC).
  select s.score into existing_score
  from public.sharoboy_scores s
  where s.mode = new.mode
    and lower(s.nick) = lower(new.nick)
    and s.screen_class = new.screen_class
    and (new.mode != 'daily' or (s.created_at at time zone 'UTC')::date = new_date)
  order by s.score desc
  limit 1;

  if existing_score is null then
    -- Первая попытка игрока в этой категории (или сегодня в daily) — пропускаем.
    return new;
  end if;

  if new.score > existing_score then
    -- Новый рекорд категории (или дня) — удаляем старый, новый пропускаем.
    delete from public.sharoboy_scores
    where mode = new.mode
      and lower(nick) = lower(new.nick)
      and screen_class = new.screen_class
      and (new.mode != 'daily' or (created_at at time zone 'UTC')::date = new_date)
      and score = existing_score;
    return new;
  end if;

  -- Не рекорд — откатываем вставку.
  return null;
end;
$$;

comment on function public.sharoboy_scores_best_only is 'Хранит лучшую попытку игрока отдельно по категориям экрана, а для daily — отдельно по календарным суткам UTC';
