# Документация для разработчика

Техническая информация: запуск, сборка, тесты, PWA, таблица рекордов, структура проекта.

## Подключение мирового топа (выполнено)

Мировой топ подключён: `.env` заполнен, секреты добавлены в GitHub,
SQL-миграции выполнены в Supabase. Для истории — что потребовалось:

- [x] **1. Заполнить локальный `.env`** (значения — из Supabase → _Project
      Settings → API_): `VITE_SUPABASE_URL` ← Project URL,
      `VITE_SUPABASE_ANON_KEY` ← anon public key, `VITE_SCORE_SECRET` ← любая
      случайная строка (анти-накрутка). После заполнения перезапустить
      `npm run dev`. Сам `.env` не коммитится (секреты, см. `.gitignore`) —
      поэтому этот шаг не отражается в git.
- [x] **2. Добавить те же 3 секрета в GitHub** — репозиторий → _Settings →
      Secrets and variables → Actions → New repository secret_:
      `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SCORE_SECRET`.
      Значения совпадают с `.env` (особенно `SCORE_SECRET`, иначе подписи
      «не сойдутся» и записи будут скрыты из топа). Пуш в `beta` пересобирает
      сайт — deploy.yml передаёт секреты в сборку. После переезда подписи на
      Edge Function секрет `VITE_SCORE_SECRET` из GitHub Secrets и из `.env`
      можно удалить (см. раздел «Мировая таблица рекордов» ниже).
- [x] **3. Выполнить миграции в Supabase → SQL Editor** (SQL — в разделе
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

## Масштабирование под экран

Логика движка считает координаты в «мировых единицах», привязанных к эталонному
окну 1920×1080 (`src/game/viewport.ts`). При изменении размера окна считается
один коэффициент `scale = diag(окна) / diag(эталона)` (ограничен 0.4..3), мир
получает размеры `cssW/scale × cssH/scale`, и канвас рисует всё одним трансформом
`setTransform(dpr * scale, …)`. Следствия:

- размеры и скорости всех сущностей одни и те же на телефоне, FHD и 4K —
  на экране отличается только физический размер объектов;
- отдельные множители скорости для «маленьких» и «4K» экранов не нужны (удалены);
- плотность расстановки блоков (`densityFactor` в levelBuilder.ts) зависит
  только от пропорций мирового поля (0.65..1.35), блоки не пересекаются;
- отступ ракетки от нижнего края в тач-режиме задан в CSS-пикселях и переводится
  в мир делением на `scale` — палец не закрывает ракетку на любом масштабе;
- категории мирового топа (📱/🖥/4K) остались: они делят таблицу рекордов по
  физическому размеру экрана, к балансу игры больше не привязаны.

## Мировая таблица рекордов (Supabase)

Клиент не обращается к базе напрямую: запись и чтение идут через Edge Function
`scores` (`supabase/functions/scores`). Секрет подписи очков (`SCORE_SECRET`)
хранится в секретах функции и в клиентский бандл не попадает; клиент знает
только публичный Project URL и anon-ключ (он же — JWT для вызова функции).

- **POST /functions/v1/scores** — отправка очков: функция валидирует данные
  (границы очков и волн, длина ника), считает подпись `client_sig` (FNV-1a от
  `nick:score:mode:wave:screen:secret`) и вставляет запись от имени service role;
- **GET /functions/v1/scores?mode=&screen=&from=&limit=** — топ: функция
  отбрасывает записи с неверной подписью (принимаются и старые — без категории
  экрана) и возвращает строки без подписи. Периоды (день / месяц / всё время)
  клиент задаёт параметром `from`, схлопывание повторов одного игрока —
  `dedupeTop` на клиенте.

### Деплой Edge Function

Выполняется один раз, до пуша этого кода на сайт:

    supabase login
    supabase link --project-ref <PROJECT_REF>   # Supabase → Project Settings → General
    supabase secrets set SCORE_SECRET=<тот же секрет, что был в .env>
    supabase functions deploy scores

Без CLI — то же в Dashboard: Supabase → _Edge Functions_ → Create function →
вставить код `supabase/functions/scores/index.ts` и `sig.ts`; затем в
_Edge Functions → Secrets_ добавить `SCORE_SECRET`. Значение должно совпадать
с прежним `VITE_SCORE_SECRET` из `.env`, иначе подписи старых записей
«не сойдутся» и они скроются из топа.

Миграция, закрывающая таблицу от прямых записей (Supabase → SQL Editor):

```sql
-- писать может только Edge Function (service role); anon/authenticated — только чтение
revoke insert, update, delete on table public.sharoboy_scores from anon;
revoke insert, update, delete on table public.sharoboy_scores from authenticated;

-- записи до эпохи подписей (client_sig = '') всегда скрывались клиентским
-- фильтром; теперь проверка на сервере — удаляем их
delete from public.sharoboy_scores where client_sig = '';
```

Подпись защищает от записей в обход функции (прямые вставки закрыты), но не от
накрутки через саму функцию — против неё работают лимиты валидации в коде
функции (границы очков и волн, длина ника).

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
    src/game/levelBuilder.ts  генерация уровней (плотность зависит от пропорций поля)
    src/game/viewport.ts      эталонное разрешение 1920×1080 и масштаб мира
    src/game/boss.ts          босс «Царь-шар» (фазы, негативные дропы)
    src/game/powers.ts        бонусы (позитивные и негативные дропы)
    src/game/achievements.ts  12 достижений (условия, localStorage)
    src/game/leaderboard.ts   клиент мирового топа (вызывает Edge Function)
    src/game/profanity.ts     фильтр запрещённых ников
    src/ui/screens.tsx        React-экраны (меню, топ, магазин, достижения)
    src/vite-env.d.ts         типы Vite (import.meta.env)
    supabase/functions/scores Edge Function «scores»: запись и чтение топа

См. также `docs/REFACTORING.md`.
