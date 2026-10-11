# Agent State

**Последнее обновление**: 2026-10-11 18:52

## Текущая фаза

Этап M5 (Защита от дублей карт и воркфлоу внесения изменений): T-025 завершена Luna.

## Следующее действие

Gemini выполняет ревью T-025; следующий шаг — архитектурная проверка map edit workflow и миграции.

## Активные агенты

- Gemini (Antigravity): архитектурный надзор и планирование
- Luna (Cline): исполнитель (T-025 завершена)

## Блокирующие проблемы

Нет. T-025 передана на ревью Gemini.

## Результат последней задачи

T-025: добавлена миграция workflow изменений карт, анти-дубликаты pending-публикаций по автору/названию и map_uid, request-edit/update-spec/approve-edit маршруты, сохранение likes/plays при обновлении. Редактор получил стабильный project UID, статус «На проверке», approved-edit, JSON import и отправку обновления; каталог — запрос изменения для автора; админка — очередь edit-запросов. Typecheck, lint и полный test прошли (46 файлов, 380 тестов).

T-024: принята архитектором. Реализован клиентский модуль `adminMapsApi.ts` с тестами, экран `AdminPanel.tsx` с надёжной JWT-авторизацией через пароль, очередью `pending`-карт, интерактивным масштабируемым превью поля, тест-драйвом через `Game.startCustomMap` и возможностью одобрения или отклонения с указанием причины. Добавлена кнопка «🛡️ Панель модерации» в главное меню. Typecheck, lint и полный test suite (46 файлов, 376 тестов) пройдены без единой ошибки. Коммит отправлен в `origin/beta`.

T-023: принята архитектором. Реализован экран каталога карт `CommunityMaps` с вкладками «Популярные» и «Новые», поиском, лайками с защитой от накрутки, индикацией статусов и прямым запуском карт через `Game.startCustomMap`. Все 44 тест-файла (371 тест), typecheck и lint проходят без ошибок. Коммит отправлен в `origin/beta`.

T-022: принята архитектором. Реализован `customMapsApi.ts` с тестами, создан `EditorPublishModal.tsx` с валидатором `validatePlayerMapSpec`, проверкой нецензурной лексики и неизменяемым ником автора. В `EditorToolbar.tsx` добавлена кнопка публикации с блокировкой при отсутствии Supabase. Typecheck, lint и 43 тест-файла (370 тестов) успешно пройдены. Коммит отправлен в `origin/beta`.

T-021: утверждена архитектором; миграция `20250101000008_create_custom_maps.sql` применена к базе Supabase, таблицы `sharoboy_custom_maps` и `sharoboy_map_votes` созданы, Edge Functions `maps` и `admin-maps` задеплоены. 42 тест-файла, 366 тестов проходят.

T-020: tool-кнопки Toolbar используют единый `btn-ghost`-стиль без изменения формы/размеров/шрифта; active-состояние меняет только заливку, цвет текста, border и glow согласно AD-014. Typecheck/lint/full test прошли (40 файлов, 362 теста); ручной браузерный прогон не выполнялся.

T-019: угол поворота в Inspector отображается чистым целым числом, кратным 5°, NumberField нормализует отображаемые значения, а HP-текст на Canvas получает обратный поворот и остаётся вертикальным. Добавлен тест floating-point угла. Typecheck/lint/full test прошли (40 файлов, 362 теста); ручной браузерный прогон не выполнялся.

T-018: исправлено прямое single-select переключение, transform handles следуют drag preview, добавлены визуалы спецблоков portal/spring/cotton/magnet/pulse/spin, все NumberField получили range-слайдеры и нормализацию, tool-кнопки стабилизировали размеры и шрифт. Добавлен тест округления reducer. Typecheck/lint/full test прошли (40 файлов, 361 тест); ручной браузерный прогон не выполнялся.

T-017: добавлены armor rings по игровым формулам, скрытие исходных блоков при перемещении и синхронизация автора карты с nick игрока через read-only Inspector поле. Typecheck/lint/full test прошли (40 файлов, 360 тестов; полный suite подтверждён с `--maxWorkers=1` из-за известного flaky timeout); ручной браузерный прогон не выполнялся.

T-016: изолирован глобальный ввод в editable controls; добавлено контекстное меню ПКМ на блоке/холсте; активный tool имеет явный neon style; custom test mode можно прервать HUD-кнопкой или Escape с callback возврата; редактор получил mute/next-track управление и audio API. Typecheck/lint/full test прошли (40 файлов, 360 тестов); ручной браузерный прогон не выполнялся.

T-015: реализован отдельный quick-clone handle рядом с нижним правым resize-углом, copy cursor, live preview цепочки по преобладающей оси с учетом grid; portal-клон блокируется с toast; reducer action ограничивает safe-zone и MAX_BLOCKS=200, генерирует уникальные ID, выбирает клоны и поддерживает undo/redo. Добавлены reducer-тесты. Typecheck/lint/full test прошли (40 файлов, 360 тестов); ручной браузерный прогон не выполнялся.

T-014: реализованы multi-select (`selectedBlockIds`), marquee box selection, четыре resize handles и rotation handle, живое групповое перемещение с общим safe-zone clamp, clipboard copy/paste (+32,+32) с новыми ID и shortcuts Ctrl+C/V/Delete/Backspace. Добавлено 4 unit-теста reducer. Typecheck/lint/full test прошли (40 файлов, 358 тестов); ручная браузерная проверка не выполнялась.

T-013: выполнены AD-008 UX-улучшения: яркая подсветка активного инструмента, context menu actions, синхронные circle dimensions в reducer/Inspector, range-слайдеры, безопасная зона ракетки Y=880 с validator и Canvas-индикацией, clamping и live drag preview с snap ghost. `npm run lint`, `npm run typecheck` и полный `npm run test` прошли (40 файлов, 354 теста). Ручной браузерный прогон не выполнялся.

T-012: добавлены `EditorView`, `EditorJsonModal` и barrel `index.ts`; редактор доступен из меню, работает с draft localStorage, горячими клавишами, импортом/экспортом и валидацией. App вызывает `Game.startCustomMap` и возвращает автора в редактор после callback победы/поражения. Typecheck, lint, полный test (40 файлов, 350 тестов) и production build прошли. Ручной браузерный прогон не выполнялся.

T-011: добавлены `EditorToolbar` и `EditorInspector`. Toolbar переключает инструменты, undo/redo, snap/grid size, очистку карты и предоставляет callback-действия JSON/test/close. Inspector редактирует свойства блока и эффекты (armor, spring, cotton, pulse, magnet, portal), дублирует/удаляет блок; без выбора редактирует metadata/winCondition, цели и показывает статистику. Все обновления отправляются reducer actions. Typecheck, lint и полный test (40 файлов, 350 тестов) прошли.

T-010: создан `EditorCanvas` с полем 1920×1080 и масштабированием под контейнер, сеткой с режимом snap, верхней HUD-зоной, рендером блока по форме/размеру/повороту с HP-палитрой, эффектными метками и выделением. Реализованы hit-testing, перетаскивание с применением `MOVE_BLOCK`, добавление и удаление через reducer. Typecheck, lint и полный test (40 файлов, 350 тестов) прошли.

T-009: добавлены типы `EditorState`/`EditorAction` и чистый reducer карт с add/update/delete/move, метаданными, выбором/инструментами/сеткой, снаппингом и undo/redo (до 30 шагов). Удаление очищает ссылки в группах и winCondition. Добавлены безопасные функции draft localStorage и 8 unit-тестов. Typecheck, lint и полный test (40 файлов, 350 тестов) прошли.

T-004: реализованы `Game.startCustomMap(spec, onComplete?)`, custom HUD/runtime mode,
загрузка блоков через `mapSpecToBlocks`, win conditions `all-destructible` и
`targets`, возврат в меню по победе/поражению без перехода в кампанию, адаптация
PowersWorld, отключение отправки custom-результатов в leaderboard.
Проверки: `npm run typecheck`, `npm run lint`, `npm run test` — успешно.

T-005: добавлен MapTesterView для JSON-карт с проверкой структуры/валидатором,
выводом ошибок и запуском через `Game.startCustomMap`; callback возвращает в Sandbox,
JSON последней тестируемой карты сохраняется в UI. Проверки: typecheck, lint,
полный test и production build успешны.

T-006: `SFX` теперь хранит gesture handler и снимает pointerdown/keydown/touchstart
при destroy вместе с остановкой музыки; `Game` lifecycle вызывает этот teardown.
Существующее `destroy(tier)` для эффекта разрушения блока сохранено перегрузкой.
Проверки: typecheck, lint и полный test (39 файлов, 331 тест) прошли.

T-007: обычный рендер магнитных блоков больше не рисует радиус; debug-хитбоксы
показывают его цветом полярности. Добавлена U-образная подкова с разными полюсами,
притяжение/отталкивание в физике, эффект magnet в map spec, валидации и адаптере.
Проверки: lint, typecheck и полный test (39 файлов, 338 тестов) прошли.

T-008: `blockTop` действует во всех ориентациях; HUD-зона рисуется только в бою,
служит границей отскока и безопасной верхней границей генерации. Grid/layout,
boss arena и текущая расстановка уровня учитывают размеры блоков и орбиты при
повороте в обе стороны. Проверки: lint, typecheck и полный test (39 файлов,
342 теста) прошли. Ручной браузерный просмотр не выполнялся.
