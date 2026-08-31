# ШАРОБОЙ

Аркадный разбиватель: вместо кирпичей — шары и овалы, ракетка с закруглёнными углами.
Кампания из 4 уровней (финал — босс «Царь-шар») + бесконечный режим с сидом дня.
Мировая таблица рекордов (Supabase) и прокачка постоянных улучшений за монеты.

## Запуск
    npm install
    npm run dev      # http://localhost:3000
    npm run build    # продакшен-сборка в dist/
    npm run preview  # локальный предпросмотр продакшен-сборки

## Играть онлайн
Сборка публикуется на GitHub Pages при каждом пуше в `beta` или `main`:

- 🟢 **Стабильная версия** (`main`): https://hakonator.github.io/SharoBoy/
- 🟠 **Бета-версия** (`beta`): https://hakonator.github.io/SharoBoy/beta/

## Мировая таблица рекордов (Supabase)

Клиент пишет очки в таблицу `public.sharoboy_scores` и читает топ по периодам
(день / неделя / всё время). Для защиты от фейковых записей очки дополняются
клиентской подписью `client_sig` (см. `SCORE_SECRET` в `src/config.ts`):
при чтении топа записи с неверной подписью отбрасываются.

Если таблица уже создана, выполните в Supabase → SQL Editor миграцию:

```sql
alter table public.sharoboy_scores
  add column if not exists client_sig text not null default '';

-- 0 = старые записи до миграции (будут скрыты из топа), 8 = валидная подпись
alter table public.sharoboy_scores
  add constraint sharoboy_scores_sig_len check (char_length(client_sig) in (0, 8));
```

Новые записи будут попадать в таблицу только с валидной подписью. Подписи
не защищают от накрутки на 100% (секрет виден в клиентском коде) — это
защита от случайных злоупотреблений через консоль.

## Структура
    index.html                заставка + точка входа
    src/main.tsx              монтирование React
    src/index.css             тема (Tailwind v4)
    src/App.tsx               HUD и экраны (в т.ч. магазин прокачки)
    src/config.ts             URL/ключ Supabase (рекордборд)
    src/game/audio.ts         синтезатор звуков (WebAudio)
    src/game/game.ts          движок: физика, уровни, босс, бонусы, прокачка
    src/game/leaderboard.ts   клиент мировой таблицы рекордов
    src/game/profanity.ts     фильтр запрещённых ников
    src/vite-env.d.ts         типы Vite (import.meta.env)

package-lock.json намеренно не включён — npm install создаст его заново.
