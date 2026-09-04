# Документация для разработчика

Техническая информация: запуск, сборка, тесты, PWA, таблица рекордов, структура проекта.

## ⚠️ TODO: доделать подключение мирового топа

Сейчас Supabase не подключён (`.env` пуст) — рекорды только локальные, в
Supabase записи не уходят. Код готов, осталось 3 шага:

- [ ] **1. Заполнить локальный `.env`** (файл уже создан, значения — из
      Supabase → _Project Settings → API_): - `VITE_SUPABASE_URL` ← Project URL - `VITE_SUPABASE_ANON_KEY` ← anon public key - `VITE_SCORE_SECRET` ← любая случайная строка (анти-накрутка)
      После заполнения перезапустить `npm run dev`.
- [ ] **2. Добавить те же 3 секрета в GitHub** — репозиторий → _Settings →
      Secrets and variables → Actions → New repository secret_:
      `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SCORE_SECRET`.
      Значения должны **совпадать** с `.env` (особенно `SCORE_SECRET`, иначе
      подписи «не сойдутся» и записи будут скрыты из топа). Пуш в `beta`
      пересоберёт сайт — deploy.yml уже передаёт секреты в сборку.
- [ ] **3. Выполнить миграции в Supabase → SQL Editor** (SQL — в разделе
      «Мировая таблица рекордов» ниже): `created_at`, `client_sig` + CHECK,
      `screen_class`. Без колонки `screen_class` вставка новой записи упадёт
      с ошибкой.

**Проверка после шагов:** в меню появился «🌍 Мировой топ» → ввести ник в
поле «Ник для рекордов» → сыграть партию в бесконечном режиме → выйти в меню →
в таблице `sharoboy_scores` появилась запись с заполненными `screen_class` и
`client_sig`. Кампания уходит в топ через форму на экране поражения/победы.

## Запуск

    npm install
    npm run dev      # http://localhost:3000
    npm run build    # продакшен-сборка в dist/
    npm run preview  # локальный предпросмотр продакшен-сборки
    npm test         # тесты (vitest)
    npm run icons    # перегенерация PWA-иконок (scripts/make-icons.mjs)

Тесты покрывают: фильтр ников (`profanity.test.ts`), рендер (`render.test.ts`),
сборку уровней и плотность расстановки (`levelBuilder.test.ts`),
клиент таблицы рекордов (`leaderboard.test.ts`).

## PWA (офлайн и установка)

- `public/manifest.webmanifest` — метаданные (иконки, цвета, `display: fullscreen`);
- `public/sw.js` — сервис-воркер: страница и ассеты кэшируются, при офлайне
  игра открывается из кэша; ассеты обновляются в фоне (stale-while-revalidate);
- иконки генерируются скриптом `scripts/make-icons.mjs` (чистый Node, без
  зависимостей) и лежат в `public/`.

Сервис-воркер регистрируется только в продакшен-сборке, в dev-режиме он отключён.

## Мировая таблица рекордов (Supabase)

Клиент пишет очки в таблицу `public.sharoboy_scores` и читает топ по периодам
(день / месяц / всё время). Для защиты от фейковых записей очки дополняются
клиентской подписью `client_sig` (см. `SCORE_SECRET` в `src/config.ts`):
при чтении топа записи с неверной подписью отбрасываются.

Если таблица уже создана, выполните в Supabase → SQL Editor миграцию:

```sql
-- дата и время записи (используется для периодов «День»/«Месяц»)
alter table public.sharoboy_scores
  add column if not exists created_at timestamptz not null default now();

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

Мировой топ фильтруется по категории экрана: `mobile` (телефоны и планшеты),
`fhd` (HD/FullHD/2K/ultrawide) и `4k` (4K и выше). Категория определяется
автоматически по диагонали окна и пишется в колонку `screen_class`; очки
сравнимы только внутри категории. Миграция:

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
игрока. Нюанс: топы «День»/«Месяц» показывают игрока, только если его рекорд
установлен в пределах периода.

### Оба режима в общей таблице

Кампания и бесконечный режим пишутся в одну таблицу, различаясь полем `mode`
(`campaign` / `endless`). Очки бесконечного режима фиксируются автоматически
при выходе в меню (см. `endlessSubmitRef` в `src/App.tsx`).

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
    src/game/levelBuilder.ts  генерация уровней (плотность зависит от экрана)
    src/game/boss.ts          босс «Царь-шар» (фазы, негативные дропы)
    src/game/powers.ts        бонусы (позитивные и негативные дропы)
    src/game/achievements.ts  12 достижений (условия, localStorage)
    src/game/leaderboard.ts   клиент мировой таблицы рекордов
    src/game/profanity.ts     фильтр запрещённых ников
    src/ui/screens.tsx        React-экраны (меню, топ, магазин, достижения)
    src/vite-env.d.ts         типы Vite (import.meta.env)

См. также `docs/REFACTORING.md`.
