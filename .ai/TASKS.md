# Задачи (TASKS)

Здесь живут только актуальные задачи. Формат карточки описан в шапке
`.clinerules`; выполненные задачи удаляются — короткая сводка их результатов
остаётся в `.ai/STATE.md` (раздел «Текущая фаза») и в `memory-bank/progress.md`.

Правила ведения файла:

1. Подробные карточки сохраняются для **трёх последних** выполненных задач
   (чтобы архитектор мог перепроверить реализацию по acceptance criteria).
2. Более ранние выполненные карточки удаляются; в конце файла — таблица-архив
   «Выполнено ранее» со ссылкой на соответствующую запись в `.ai/STATE.md`.
3. Готовые к работе задачи (`ready`) идут первыми; заблокированные (`blocked`)
   — отдельным разделом с описанием блокера.
4. Если файл вырос больше ~600 строк — удаляй самые старые из трёх подробных
   карточек, оставляя строку в архиве.

---

## Готово к работе

Нет активных задач со статусом ready. Следующий этап — проектирование T-039 (расширение каталога реликвий + индикация в HUD).

---

## Дальше после шаров (карточки ещё не оформлены)

Порядок продиктован зависимостями: шары — новые ингредиенты для синергий, без
них два из трёх примеров §3.1 нереализуемы. Подробные карточки появятся
по мере продвижения T-037/T-038.

- **T-039**: расширение каталога реликвий с 4 до 8 + индикация активных
  реликвий в HUD. Четыре новые пассивки (`relic_frost` — потеря щита даёт мороз,
  `relic_combo` — комбо падает вдвое, а не в ноль, `relic_bulwark` — первая бомба
  боя без потери жизни, `relic_overdrive` — один раз за забег спасает от Game
  Over) с проверенными точками внедрения: `physics.ts:310`, `runFlow.ts:434`,
  `runFlow.ts:528`, `runFlow.ts:457`.
- **T-040**: движок синергий `src/game/synergies.ts` (AD-028: чистая логика
  условий + кэш `Set<SynergyId>` в `Game`, пересчёт только по событиям).
- **T-041+**: синергии из §3.1 — теперь все три примера реализуемы:
  «Кинетический Снайпер» (`pierce` + магнитная ракетка), «Цепной Резонанс»
  (`explosive` + `brittle`), «Гравитационный Джаггернаут» (`big` +
  `heavy_gravity`). Нарезать по возрастанию риска: сначала числовые, затем
  стихийные, затем правящие физику.

## Заблокировано

Нет.

---

## Последние выполненные задачи (подробные карточки)

### T-038: Увеличенный шар «Гравитационное ядро» (roadmap 3.1, ингредиент 3)

Status: done
Priority: high
Assigned to: Luna

Описание:

Третий шар. Единственный из трёх, кто меняет не поведение контакта, а сам
размер шара, — поэтому он и назван «увеличенным» в роадмапе.

1. Новый тип бонуса `big` («ЯДРО») и таймер `Game.bigUntil`.
2. Радиус шара ×1.6 (9 → 14.4) на 10 с, скорость −10% как компенсация.
3. Единый расчёт базового радиуса (`baseBallRadius(g)`) и применение множителя:
   - при активации — масштабировать `r` у всех шаров в игре;
   - при подаче нового шара (`serveBall`) — создавать сразу с учётом эффекта;
   - при окончании эффекта — вернуть базовый радиус всем шарам;
   - клоны из `multi` наследуют текущий радиус.
4. Рендер: `render/projectiles.ts` подхватывает радиус, добавлен цвет
   `BallView.big` (голубое гравитационное свечение) и индикатор в HUD.
5. Каркас по образцу T-036: `PowerType`, `POWER_META`, таблица дропа,
   `applyPower`, `bigActive()` в `PhysicsWorld` и `hosts.ts`, сброс в
   `loseLife`/`clearAllEffects`, `bigOn` в `HudData` и `hud.tsx`.
6. Выталкивание: шар не залипает в блоке при ударе и активации вплотную.

Allowed files:

- src/game/types.ts
- src/game/palette.ts
- src/game/physics.ts
- src/game/physics/collide.ts
- src/game/physics/collide.test.ts
- src/game/physics.test.ts
- src/game/physics/spark.test.ts
- src/game/physics/frost.test.ts
- src/game/physics/speed.ts
- src/game/physics/speed.test.ts
- src/game/game.ts
- src/game/game/hosts.ts
- src/game/game/levelBuild.ts
- src/game/game/runFlow.ts
- src/game/game/hudSync.ts
- src/game/game/drawScene.ts
- src/game/powers.ts
- src/game/powers/apply.ts
- src/game/powers/table.ts
- src/game/powers/table.test.ts
- src/game/powers.test.ts
- src/game/render/projectiles.ts
- src/ui/screens/hud.tsx
- src/App.tsx
- src/ui/screens/MenuCosmetics.test.tsx
- src/ui/screens/SettingsModal.test.tsx
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

Dependencies: T-036 (общий каркас)

Acceptance criteria:

- [x] Бонус `big` выпадает и отображается иконкой «ЯДРО»
- [x] Радиус шара растёт до ×1.6, скорость снижается на 10%
- [x] Шары, поданные во время эффекта, сразу создаются увеличенными
- [x] Клоны `multi` наследуют увеличенный радиус
- [x] После окончания эффекта радиус возвращается к базовому
- [x] Шар не залипает в блоке при активации вплотную
- [x] Эффект сбрасывается при потере жизни и между уровнями
- [x] `npm run typecheck`, `npm run lint`, `npm test` проходят (74 файла, 615 тестов)

Test plan:
`npm run typecheck`, `npm run lint`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

### T-037: Взрывной шар «Плазменный заряд» (roadmap 3.1, ингредиент 2)

Status: done
Priority: high
Assigned to: Luna

Описание:

Второй шар. В отличие от клинка не проникает, а бьёт по площади: после
обычного отскока и урона по блоку удара подрывает соседей в радиусе.

1. Новый тип бонуса `explosive` («ВЗРЫВ») и таймер `Game.explosiveUntil`.
2. Логика (`physics/collide.ts`, после `damageBlock`): взрыв радиусом 72
   наносит урон 1 всем живым блокам в радиусе, кроме блока удара.
   - взрывной урон идёт с `allowBrittle = false`, иначе получаем каскад
     «взрыв → хрупкий блок → цепная детонация → снова взрыв» и вечный цикл;
   - лимит 8 целей за взрыв, чтобы не убивать кадр на плотных рядах;
   - минибоссы, бомбы и фазовые неактивные блоки исключены.
3. Переиспользовать существующие рычаги: `damageBlock` и `fx.rings`/`fx.burst`
   (никакой новой системы взрывов не создавать — `boomQueue` занят бомбами).
4. Каркас по образцу T-036: `PowerType`, `POWER_META`, таблица дропа,
   `applyPower`, `explosiveActive()` в `PhysicsWorld` и `hosts.ts`,
   сброс в `loseLife`/`clearAllEffects`, цвет в `render/projectiles.ts`,
   `explosiveOn` в `HudData` и `hud.tsx`.
5. Баланс: длительность 8 с, вес в таблице 8, радиус 72, урон 1.

Точки внедрения: взрыв — в `physics/collide.ts` в ветви обычного отскока сразу
после `damageBlock` (`collideBlocks`), по образцу взрыва по площади у `brittle`
(`physics/destruction.ts`, ветка `b.sp.brittle`). Каркас бонуса — по образцу
уже реализованного `pierce` из T-036 (`pierceActive` в `physics.ts`,
реализация в `game/hosts.ts`, таймер в `game.ts`, сбросы в `game/runFlow.ts`,
цвет в `render/projectiles.ts`, `pierceOn` в `HudData` → здесь `explosiveOn`).

Allowed files:

- src/game/types.ts
- src/game/palette.ts
- src/game/physics.ts
- src/game/physics/collide.ts
- src/game/physics/collide.test.ts
- src/game/physics.test.ts
- src/game/physics/spark.test.ts
- src/game/physics/frost.test.ts
- src/game/game.ts
- src/game/game/hosts.ts
- src/game/game/runFlow.ts
- src/game/game/hudSync.ts
- src/game/game/drawScene.ts
- src/game/powers.ts
- src/game/powers/apply.ts
- src/game/powers/table.ts
- src/game/powers/table.test.ts
- src/game/powers.test.ts
- src/game/render/projectiles.ts
- src/ui/screens/hud.tsx
- src/App.tsx
- src/ui/screens/MenuCosmetics.test.tsx
- src/ui/screens/SettingsModal.test.tsx
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

Dependencies: T-036 (общий каркас типа бонуса и таймера)

Acceptance criteria:

- [x] Бонус `explosive` выпадает и отображается иконкой «ВЗРЫВ»
- [x] Попадание подрывает соседей в радиусе 72 на урон 1
- [x] Блок удара не получает двойной урон
- [x] Каскад с хрупкими блоками не зацикливается (лимит целей, `allowBrittle = false`)
- [x] Минибоссы, бомбы и неактивные фазовые блоки взрывом не задеваются
- [x] Эффект сбрасывается при потере жизни и между уровнями
- [x] `npm run typecheck`, `npm run lint`, `npm test` проходят (74 файла, 607 тестов)

Test plan:
`npm run typecheck`, `npm run lint`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

### T-036: Проникающий шар «Кинетический клинок» (roadmap 3.1, ингредиент 1)

Status: done
Priority: high
Assigned to: Luna

Описание:

Первый из трёх шаров, без которых примеры синергий из `ROADMAP.md` §3.1
нереализуемы. Важное уточнение по коду: **огонь уже проходит блоки насквозь**
(`physics/collide.ts:243-254` — «обычные блоки огонь прожигает насквозь, без
отскока»), поэтому новый шар обязан отличаться не поведением, а ролью.

1. Новый тип бонуса `pierce` («КЛИН») и таймер `Game.pierceUntil`:
   - шар пробивает **не более 3 блоков за один проход**, нанося каждому
     обычный урон 1; четвёртый блок он уже отражает как обычно;
   - «проход» — отрезок между двумя отскоками. Счётчик `Ball.pierceLeft`
     обнуляется при отскоке от ракетки, стены, минибосса и босса, поэтому
     тактика шара — выбрать угол, чтобы снять до трёх блоков в ряду;
   - от минибоссов и босса отскакивает всегда (лимит не расходуется) — иначе
     превращается в машину урона, на что уже наступали с огнём
     (`collide.ts:279-280`);
   - приоритет в цепочке стихий ниже огня: если активны и огонь, и клинок,
     побеждает огонь (×3 урон и неограниченное пробитие).
2. Каркас, общий для всех трёх шаров (делается здесь один раз):
   - `PowerType` += `"pierce"` (`types.ts`), запись в `POWER_META`
     (`palette.ts`: label, цвет, edge), вес в `buildPowerTable` (`powers/table.ts`),
     ветка в `applyPower` (`powers/apply.ts`), флаг `pierceActive()` в
     `PhysicsWorld` (`physics.ts`) и его реализация в `game/hosts.ts`;
   - сброс таймера в `loseLife` и `clearAllEffects` (`game/runFlow.ts`)
     рядом с `fireUntil`/`frostUntil`;
   - цвет шара в `render/projectiles.ts` (`BallView.pierce`), индикатор в
     `HudData` (`types.ts`) и `hud.tsx` (`pierceOn`), значение в `hudSync.ts`.
3. Баланс: длительность 10 с (дольше огня — это и есть ниша шара), вес в
   таблице дропа 8 (как у `fire`/`frost`/`spark`), лимит 3 блока за проход.
4. Тесты: юнит-тест на пробитие ровно трёх блоков и отскок от четвёртого;
   тест сброса `pierceLeft` после отскока от ракетки; тест `applyPower` на
   установку таймера; тест сброса эффекта в `clearAllEffects`.

Точки внедрения (проверены по коду):

- пробитие и лимит → `physics/collide.ts:243` (перед ветвью огня).
- сброс счётчика → `physics/collide.ts` (отскок от ракетки), `physics.ts`
  (отражение от стен).
- флаг активности → `physics.ts:95-100` (рядом с `fireActive`), реализация в
  `game/hosts.ts:320` (рядом с `fireActive`).
- таймер и сброс → `game.ts` (рядом с `fireUntil`), `game/runFlow.ts:444,541`.
- дроп → `powers/table.ts:19-31`, применение → `powers/apply.ts:45`.
- рендер → `render/projectiles.ts:61-83`.

Allowed files:

- src/game/types.ts
- src/game/palette.ts
- src/game/physics.ts
- src/game/physics/collide.ts
- src/game/physics/collide.test.ts
- src/game/game.ts
- src/game/game/hosts.ts
- src/game/game/runFlow.ts
- src/game/game/hudSync.ts
- src/game/powers.ts
- src/game/powers/apply.ts
- src/game/powers/table.ts
- src/game/powers/table.test.ts
- src/game/render/projectiles.ts
- src/ui/screens/hud.tsx
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

Dependencies: нет

Acceptance criteria:

- [x] Бонус `pierce` выпадает в бою и отображается иконкой «КЛИН»
- [x] Шар пробивает ровно 3 блока за проход и отражается от четвёртого
- [x] Каждому пробитому блоку наносится урон 1
- [x] Счётчик прохода сбрасывается после отскока от ракетки и от стены
- [x] От минибосса и босса клинок отскакивает, лимит не расходуется
- [x] При одновременных огне и клинке приоритет у огня
- [x] Эффект сбрасывается при потере жизни и между уровнями
- [x] Индикатор активного клинка виден в HUD
- [x] `npm run typecheck`, `npm run lint`, `npm test` проходят (74 файла, 599 тестов)

Test plan:
`npm run typecheck`, `npm run lint`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

## Выполнено ранее (архив)

Карточки удалены при чистке файла; подробности каждой задачи — в `.ai/STATE.md`
(раздел «Текущая фаза») и `memory-bank/progress.md`.

| Задача | Что сделано                                                                 |
| ------ | --------------------------------------------------------------------------- |
| T-035  | Прозрачный экран детального подсчёта очков (Score Breakdown) (roadmap 2.3)  |
| T-034  | Сюжетные терминалы станции «СФЕРА-1080» в событиях кампании (roadmap 2.2)   |
| T-033  | Спецблоки матрицы (armor, brittle, phase, magnet) в кампанию и редактор     |
| T-032  | Оружейная фаза Миноги (снаряд, потеря/отрастание головы, неуязвимость тела) |
| T-031  | Роадмап 1.2 — альтернативные боссы Актов I и II + углубление фаз + отладка  |
| T-030  | Аудио-оформление сюжета станции «СФЕРА-1080» (roadmap 1.1)                  |
| T-026  | Постоянное расстояние между ярусами карты кампании (2 ширины узла)          |
| T-025  | Защита от дублей карт и воркфлоу внесения изменений (Этап M5)               |
| T-024  | Админ-панель модерации кастомных карт (Этап M4)                             |
| T-023  | Каталог пользовательских карт сообщества в главном меню (Этап M3)           |
| T-022  | Клиентское API кастомных карт и диалог публикации в редакторе (Этап M2)     |
| T-021  | Backend Supabase: миграции БД и Edge Functions модерации/публикации         |
| T-020  | Унификация формы и инверсия цвета кнопок Toolbar                            |
| T-019  | Вертикальные цифры на блоках, исключение паразитных дробей угла             |
| T-018  | Недочёты UX редактора карт (селектор блоков, маркеры, слайдеры, шаг 5°)     |
| T-017  | Кольца брони на блоках, чистое перетаскивание, защита поля автора           |
| T-016  | Исправление багов редактора (Spacebar, ПКМ-меню, подсветка, выход из теста) |
| T-015  | Быстрое копирование блоков протяжкой (Quick Clone Handle)                   |
| T-014  | Маркеры трансформации, групповое выделение и буфер обмена                   |
| T-013  | Эргономика редактора карт, ПКМ, зона ракетки и плавный Snap                 |
| T-012  | Полноэкранный EditorView, модалка JSON и интеграция в игру                  |
| T-011  | Панель инструментов и свойств (Toolbar & Inspector)                         |
| T-010  | Интерактивный Canvas редактора карт (EditorCanvas)                          |
| T-009  | Модели состояния и редьюсер редактора карт (State & Reducer)                |
| T-008  | Единая верхняя HUD-зона во всех ориентациях                                 |
| T-007  | Магнитные блоки — пиктограмма, полярность и скрытие зоны действия           |
| T-006  | Исправление дублирования звука при пересоздании Game                        |
| T-005  | Базовый UI загрузчика/тестера карт (Этап A3)                                |
| T-004  | Интеграция режима «Пользовательская карта» в ядро игры (Этап A3)            |
| T-003  | Адаптер карты в уровень (Этап A2)                                           |
| T-002  | Валидатор карт (Этап A2)                                                    |
| T-001  | Типы Authoring Spec (`PlayerMapSpec`, Этап A1)                              |
| T-000  | Инициализация проекта                                                       |
