-- Миграция мировой таблицы рекордов: одна запись на игрока.
--
-- Проблема: каждая попытка писалась отдельной строкой, поэтому один игрок
-- занимал несколько мест в топе (вплоть до всех трёх призовых).
-- Решение: чистим накопленные дубли и ставим триггер — при новой попытке
-- игрока обновляется его лучшая строка, а новая строка не создаётся.
--
-- Применять в Supabase → SQL Editor после миграции client_sig (см. README).
-- Скрипт идемпотентен: можно запускать повторно.
--
-- Нюанс семантики периодов: строка игрока хранит рекорд за всё время, поэтому
-- в топах «День»/«Неделя» игрок виден, только если рекорд установлен в
-- пределах периода. Если нужен «лучший результат за период» — не применяйте
-- шаг 3: достаточно клиентского дедупа в fetchTop (src/game/leaderboard.ts).

-- 1) Чистка дублей: на пару (mode, lower(nick)) оставляем строку с максимальным
--    score; при равенстве — самую раннюю created_at (первое достижение рекорда).
delete from public.sharoboy_scores a
using public.sharoboy_scores b
where a.mode = b.mode
  and lower(a.nick) = lower(b.nick)
  and (
    b.score > a.score
    or (b.score = a.score and b.created_at < a.created_at)
    or (b.score = a.score and b.created_at = a.created_at and b.ctid < a.ctid)
  );

-- 2) Индекс под поиск «лучшей строки игрока» (ускоряет триггер и выборки топа).
create index if not exists sharoboy_scores_mode_nick_idx
  on public.sharoboy_scores (mode, lower(nick), score desc);

-- 3) Триггер: вместо новой строки обновляем лучшую попытку игрока.
--    Рекорд побит — переписываем очки, волну, подпись и дату; иначе просто
--    пропускаем вставку (клиент получит успех без новой строки).
create or replace function public.sharoboy_scores_best_only()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  best record;
begin
  select ctid, score into best
  from public.sharoboy_scores
  where mode = new.mode and lower(nick) = lower(new.nick)
  order by score desc, created_at asc
  limit 1
  for update;

  if not found then
    return new; -- первая попытка игрока — пишем как обычно
  end if;

  if new.score > best.score then
    update public.sharoboy_scores
    set score = new.score,
        wave = new.wave,
        client_sig = new.client_sig,
        created_at = now()
    where ctid = best.ctid;
  end if;

  return null; -- новая строка не нужна ни в каком случае
end;
$$;

drop trigger if exists sharoboy_scores_best_only on public.sharoboy_scores;
create trigger sharoboy_scores_best_only
  before insert on public.sharoboy_scores
  for each row execute function public.sharoboy_scores_best_only();

-- 4) Триггерную функцию не даём дёргать напрямую через PostgREST RPC
--    (на работу триггера права EXECUTE не влияют).
revoke execute on function public.sharoboy_scores_best_only() from anon, authenticated, public;
