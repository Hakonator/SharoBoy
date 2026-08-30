# ШАРОБОЙ

Аркадный разбиватель: вместо кирпичей — шары и овалы, ракетка с закруглёнными углами.
Кампания из 4 уровней (финал — босс «Царь-шар») + бесконечный режим с сидом дня.

## Запуск
    npm install
    npm run dev      # http://localhost:3000
    npm run build    # продакшен-сборка в dist/
    npm run preview  # локальный предпросмотр продакшен-сборки

## Играть онлайн
Сайт публикуется автоматически на GitHub Pages при каждом пуше в main
(см. .github/workflows/deploy.yml):
    https://hakonator.github.io/SharoBoy/

## 🌍 Мировая таблица рекордов

Игроки могут вносить свои результаты под ником в общий рекордборд (Supabase).
Пока `src/config.ts` не заполнен, игра работает в локальном режиме — это нормально.

Как включить:
1.  Создайте бесплатный проект на https://supabase.com
2.  SQL Editor → выполните скрипт ниже
3.  Project Settings → API → Project URL (**без `/rest/v1`** — SDK добавит его сам)
    и anon public key вставьте в `src/config.ts`
4.  Пуш в main — сайт пересоберётся автоматически

```sql
create table if not exists public.sharoboy_scores (
  id         uuid primary key default gen_random_uuid(),
  nick       text        not null,
  score      int         not null check (score between 0 and 10000000),
  mode       text        not null default 'campaign' check (mode in ('campaign','endless')),
  wave       int         not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sharoboy_scores enable row level security;

create policy "sharoboy: публичное чтение"
  on public.sharoboy_scores for select using (true);

create policy "sharoboy: анонимная вставка"
  on public.sharoboy_scores for insert with check (
    char_length(trim(nick)) between 2 and 16
    and score between 0 and 10000000
    and mode in ('campaign', 'endless')
  );

create index if not exists sharoboy_scores_top
  on public.sharoboy_scores (mode, score desc);
```

RLS-политики разрешают только чтение и вставку: изменить или удалить чужие записи
через публичный anon-ключ нельзя. Ники дополнительно фильтруются на клиенте
(`src/game/profanity.ts` — ломает leet-подмены, регистр и разделители). Полной
защиты от накрутки очков в клиентской игре не существует — это казуальный проект.

## Структура
    index.html                заставка + точка входа
    src/main.tsx              монтирование React
    src/index.css             тема (Tailwind v4)
    src/App.tsx               HUD и экраны
    src/game/audio.ts         синтезатор звуков (WebAudio)
    src/game/game.ts          игровой движок: физика, уровни, босс, бонусы
    src/vite-env.d.ts         типы Vite (import.meta.env)

package-lock.json намеренно не включён — npm install создаст его заново.
