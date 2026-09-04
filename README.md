# ШАРОБОЙ

Аркадный разбиватель: вместо кирпичей — шары и овалы, ракетка с закруглёнными углами.
Кампания из 4 уровней (финал — босс «Царь-шар») + бесконечный режим с сидом дня.
Мировая таблица рекордов (Supabase), прокачка постоянных улучшений за монеты
и 12 достижений с тостами в игре и витриной в меню.

## Запуск

    npm install
    npm run dev      # http://localhost:3000
    npm run build    # продакшен-сборка в dist/
    npm run preview  # локальный предпросмотр продакшен-сборки
    npm test         # тесты (vitest): фильтр ников
    npm run icons    # перегенерация PWA-иконок (scripts/make-icons.mjs)

## Играть онлайн

Сборка публикуется на GitHub Pages при каждом пуше в `beta` или `main`:

- 🟢 **Стабильная версия** (`main`): https://hakonator.github.io/SharoBoy/
- 🟠 **Бета-версия** (`beta`): https://hakonator.github.io/SharoBoy/beta/

## PWA (офлайн и установка)

Игра — полноценное PWA-приложение:

- `public/manifest.webmanifest` — метаданные (иконки, цвета, `display: fullscreen`);
- `public/sw.js` — сервис-воркер: страница и ассеты кэшируются, при офлайне
  игра открывается из кэша; ассеты обновляются в фоне (stale-while-revalidate);
- иконки генерируются скриптом `scripts/make-icons.mjs` (чистый Node, без
  зависимостей) и лежат в `public/`.

«Установить на телефон/компьютер» — через меню браузера («Добавить на главный
экран» / «Установить приложение»). Сервис-воркер регистрируется только в
продакшен-сборке, в dev-режиме он отключён.

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

### Рейтинг по типу экрана

Мировой топ можно фильтровать по категории экрана: `mobile` (телефоны и
планшеты), `fhd` (HD/FullHD/2K/ultrawide) и `4k` (4K и выше). Категория
определяется автоматически по диагонали окна и пишется в колонку
`screen_class`; очки сравнимы только внутри категории. Миграция:

```sql
alter table public.sharoboy_scores
  add column if not exists screen_class text not null default '';
```

Подпись новых записей включает категорию экрана (формат
`nick:score:mode:wave:screen_class:secret`); старые записи без категории
продолжают проходить проверку со старой подписью и видны в топе «Все».

### Одна запись на игрока

Каждая попытка писалась отдельной строкой, и один игрок мог занять несколько
мест в топе. `fetchTop` схлопывает повторные попытки в лучший результат
(регистр ника не учитывается), а в Supabase применена миграция с триггером
`sharoboy_scores_best_only`: в каждом режиме остаётся только лучшая попытка
игрока. Нюанс: топы «День»/«Неделя» показывают игрока, только если его рекорд
установлен в пределах периода.

## Структура

    index.html                заставка + точка входа (+ мета-теги PWA)
    public/                   manifest.webmanifest, sw.js, иконки
    scripts/make-icons.mjs    генератор PWA-иконок (node scripts/make-icons.mjs)
    src/main.tsx              монтирование React + регистрация сервис-воркера
    src/index.css             тема (Tailwind v4)
    src/App.tsx               HUD и экраны (в т.ч. магазин прокачки)
    src/config.ts             URL/ключ Supabase (рекордборд)
    src/game/audio.ts         синтезатор звуков (WebAudio)
    src/game/game.ts          движок: физика, уровни, босс, бонусы, прокачка
    src/game/achievements.ts  12 достижений (условия, localStorage)
    src/game/leaderboard.ts   клиент мировой таблицы рекордов
    src/game/profanity.ts     фильтр запрещённых ников
    src/game/profanity.test.ts  тесты фильтра (vitest, npm test)
    src/vite-env.d.ts         типы Vite (import.meta.env)
