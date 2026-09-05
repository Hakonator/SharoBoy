-- Триггер sharoboy_scores_best_only: в каждом режиме остаётся только лучшая
-- попытка игрока (регистр ника не учитывается). При вставке новой записи:
--   - если у игрока в этом режиме ещё нет записи — вставка проходит;
--   - если новая запись лучше (score выше) — старая удаляется, новая остаётся;
--   - если новая запись не лучше — вставка отменяется.
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
  -- Ищем текущий рекорд игрока в том же режиме (без учёта регистра ника).
  select s.score into existing_score
  from public.sharoboy_scores s
  where s.mode = new.mode
    and lower(s.nick) = lower(new.nick)
  order by s.score desc
  limit 1;

  if existing_score is null then
    -- Первая попытка в этом режиме — пропускаем.
    return new;
  end if;

  if new.score > existing_score then
    -- Новый рекорд — удаляем старый, новый пропускаем.
    delete from public.sharoboy_scores
    where mode = new.mode
      and lower(nick) = lower(new.nick)
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

comment on function public.sharoboy_scores_best_only is 'Оставляет в каждом режиме только лучшую попытку игрока (регистр ника не учитывается)';
