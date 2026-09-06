-- Триггер sharoboy_scores_best_only: рекорды одного игрока в разных категориях
-- экрана хранятся НЕЗАВИСИМО. Ключ лучшей попытки — (mode, nick, screen_class):
--   - если у игрока в этой категории ещё нет записи — вставка проходит;
--   - если новая запись лучше (score выше) — старая в этой же категории
--     удаляется, новая остаётся;
--   - если новая запись не лучше — вставка отменяется.
-- Рекорд, поставленный на телефоне, больше не вытесняется результатом с ПК:
-- у игрока своя позиция в каждой категории (и своя — в топе «Все»).
--
-- Нюанс: топы «День»/«Месяц» показывают игрока, только если его рекорд
-- установлен в пределах периода (фильтр created_at на клиенте).

create or replace function public.sharoboy_scores_best_only()
returns trigger
language plpgsql
security definer
as $$
declare
  existing_score integer;
begin
  -- Ищем текущий рекорд игрока в том же режиме и той же категории экрана
  -- (регистр ника не учитывается; screen_class not null default '').
  select s.score into existing_score
  from public.sharoboy_scores s
  where s.mode = new.mode
    and lower(s.nick) = lower(new.nick)
    and s.screen_class = new.screen_class
  order by s.score desc
  limit 1;

  if existing_score is null then
    -- Первая попытка в этой категории — пропускаем.
    return new;
  end if;

  if new.score > existing_score then
    -- Новый рекорд категории — удаляем старый, новый пропускаем.
    delete from public.sharoboy_scores
    where mode = new.mode
      and lower(nick) = lower(new.nick)
      and screen_class = new.screen_class
      and score = existing_score;
    return new;
  end if;

  -- Не рекорд — откатываем вставку.
  return null;
end;
$$;

-- Привязываем триггер к таблице.
drop trigger if exists sharoboy_scores_best_only on public.sharoboy_scores;
create trigger sharoboy_scores_best_only
  before insert on public.sharoboy_scores
  for each row
  execute function public.sharoboy_scores_best_only();

comment on function public.sharoboy_scores_best_only is 'Хранит лучшую попытку игрока отдельно в каждой категории экрана (регистр ника не учитывается)';