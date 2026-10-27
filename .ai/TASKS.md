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

### T-036: Проникающий шар «Кинетический клинок» (roadmap 3.1, ингредиент 1)

Status: draft (переводится в ready после утверждения дизайна пользователем)
Priority: high
Assigned to: Luna

Описание:

Первый из трёх шаров, без которых примеры синергий из `ROADMAP.md` §3.1
нереализуемы. Важное уточнение по коду: **огонь уже проходит блоки насквозь**
(`physics/collide.ts:243-254` — «обычные блоки огонь прожигает насквозь, без
отскока»), поэтому новый шар обязан отличаться не поведением, а ролью.

1. Новый тип бонуса `pierce` («КЛИН») и таймер `Game.pierceUntil`:
   - шар проходит сквозь обычные блоки без отскока, нанося **обычный** урон
     (в отличие от огня, который бьёт ×3);
   - **снимает броню целиком** за одно попадание: `b.sp.armor` обнуляется перед
     `damageBlock`, вместо того чтобы поглощать урон слоями. Это и есть роль
     шара — вскрывать бронированные ряды поздних ярусов (там `armor` до 3 слоёв);
   - от минибоссов и босса отскакивает как обычный шар — иначе превращается
     в машину урона, на что уже наступали с огнём (`collide.ts:279-280`);
   - приоритет в цепочке стихий ниже огня: если активны и огонь, и клинок,
     побеждает огонь (×3 важнее брони).
2. Каркас, общий для всех трёх шаров (делается здесь один раз):
   - `PowerType` += `"pierce"` (`types.ts`), запись в `POWER_META`
     (`palette.ts`: label, цвет, edge), вес в `buildPowerTable` (`powers/table.ts`),
     ветка в `applyPower` (`powers/apply.ts`), флаг `pierceActive()` в
     `PhysicsWorld` (`physics.ts`) и его реализация в `game/hosts.ts`;
   - сброс таймера в `loseLife` и `clearAllEffects` (`game/runFlow.ts`)
     рядом с `fireUntil`/`frostUntil`;
   - цвет шара в `render/projectiles.ts` (`BallView.pierce`), индикатор в
     `HudData` (`types.ts`) и `hud.tsx` (`pierceOn`), значение в `hudSync.ts`.
3. Баланс: длительность 8 с, вес в таблице дропа 8 (как у `fire`/`frost`/`spark`).
4. Тесты: юнит-тест на обнуление брони при попадании клинка и на сохранение
   отскока от минибосса; тест `applyPower` на установку таймера; тест сброса
   эффекта в `clearAllEffects`.

Точки внедрения (проверены по коду):

- пробитие и снятие брони → `physics/collide.ts:243` (перед ветвью огня).
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

- [ ] Бонус `pierce` выпадает в бою и отображается иконкой «КЛИН»
- [ ] Шар проходит сквозь обычный блок без отскока, нанося урон 1
- [ ] Броня блока с `armor` обнуляется одним попаданием клинка
- [ ] От минибосса и босса клинок отскакивает (урон идёт как обычно)
- [ ] При одновременных огне и клинке приоритет у огня
- [ ] Эффект сбрасывается при потере жизни и между уровнями
- [ ] Индикатор активного клинка виден в HUD
- [ ] `npm run typecheck`, `npm run lint`, `npm test` проходят

Test plan:
`npm run typecheck`, `npm run lint`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

### T-037: Взрывной шар «Плазменный заряд» (roadmap 3.1, ингредиент 2)

Status: draft
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

Точки внедрения: `physics/collide.ts:301` (сразу после `damageBlock`),
`physics/destruction.ts:101-113` (образец взрыва по площади у `brittle`).

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

Dependencies: T-036 (общий каркас типа бонуса и таймера)

Acceptance criteria:

- [ ] Бонус `explosive` выпадает и отображается иконкой «ВЗРЫВ»
- [ ] Попадание подрывает соседей в радиусе 72 на урон 1
- [ ] Блок удара не получает двойной урон
- [ ] Каскад с хрупкими блоками не зацикливается (лимит целей, `allowBrittle = false`)
- [ ] Минибоссы, бомбы и неактивные фазовые блоки взрывом не задеваются
- [ ] Эффект сбрасывается при потере жизни и между уровнями
- [ ] `npm run typecheck`, `npm run lint`, `npm test` проходят

Test plan:
`npm run typecheck`, `npm run lint`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

### T-038: Увеличенный шар «Гравитационное ядро» (roadmap 3.1, ингредиент 3)

Status: draft
Priority: high
Assigned to: Luna

Описание:

Третий шар. Единственный из трёх, кто меняет не поведение контакта, а сам
размер шара, — поэтому он и назван «увеличенным» в роадмапе.

1. Новый тип бонуса `big` («ЯДРО») и таймер `Game.bigUntil`.
2. Радиус шара ×1.6 (9 → 14.4) на 10 с, скорость −10% как компенсация.
3. Критично: радиус шара сейчас задаётся жёстко (`serveBall`, `r: 9`), а
   `multi` клонирует шары с `r: d.r`. Нужна единая функция базового радиуса
   (`baseBallRadius(g)`) и применение множителя:
   - при активации — масштабировать `r` у всех шаров в игре;
   - при подаче нового шара (`serveBall`) — создавать сразу с учётом эффекта;
   - при окончании эффекта — вернуть базовый радиус всем шарам;
   - клоны из `multi` наследуют текущий радиус (поведение не меняется).
4. Рендер не трогаем: `render/projectiles.ts` уже использует `b.r` для тела,
   шлейфа и кольца «на ракетке» — визуал подхватится сам. Нужен только цвет
   (`BallView.big`) и индикатор в HUD.
5. Каркас по образцу T-036: `PowerType`, `POWER_META`, таблица дропа,
   `applyPower`, `bigActive()` в `PhysicsWorld` и `hosts.ts`, сброс в
   `loseLife`/`clearAllEffects`, `bigOn` в `HudData` и `hud.tsx`.
6. Риск и его снятие: изменение `r` на лету может «вдавить» шар в блок.
   `collideBlocks` уже выталкивает шар по нормали на 0.8 единицы, но тест
   обязан проверить, что после активации рядом с блоком шар не залипает.

Точки внедрения: `game/levelBuild.ts` (`serveBall`, `r: 9`),
`powers/apply.ts`, `game/runFlow.ts:444,541` (сбросы), `game/hosts.ts:320`.

Allowed files:

- src/game/types.ts
- src/game/palette.ts
- src/game/physics.ts
- src/game/game.ts
- src/game/game/hosts.ts
- src/game/game/levelBuild.ts
- src/game/game/runFlow.ts
- src/game/game/hudSync.ts
- src/game/powers.ts
- src/game/powers/apply.ts
- src/game/powers/table.ts
- src/game/powers/table.test.ts
- src/game/physics.test.ts
- src/game/render/projectiles.ts
- src/ui/screens/hud.tsx
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

Dependencies: T-036 (общий каркас)

Acceptance criteria:

- [ ] Бонус `big` выпадает и отображается иконкой «ЯДРО»
- [ ] Радиус шара растёт до ×1.6, скорость снижается на 10%
- [ ] Шары, поданные во время эффекта, сразу создаются увеличенными
- [ ] Клоны `multi` наследуют увеличенный радиус
- [ ] После окончания эффекта радиус возвращается к базовому
- [ ] Шар не залипает в блоке при активации вплотную
- [ ] Эффект сбрасывается при потере жизни и между уровнями
- [ ] `npm run typecheck`, `npm run lint`, `npm test` проходят

Test plan:
`npm run typecheck`, `npm run lint`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

## Дальше после шаров (не начинать без подтверждения)

Порядок продиктован зависимостями: шары — новые ингредиенты для синергий, без
них два из трёх примеров §3.1 нереализуемы.

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

### T-035: Прозрачный экран детального подсчёта очков (Score Breakdown) (roadmap 2.3)

Status: done
Priority: high
Assigned to: Luna

Описание:
Пункт 2.3 дорожной карты:

1. Модель детального подсчёта очков `RunScoreBreakdown`:
   - Очки за блоки и поверженных боссов.
   - Бонусы за оставшиеся жизни (`500` за жизнь) и щиты (`250` за щит).
   - Множители за выбранные мутаторы забега (до `+240%`).
   - Бонусы за серии комбо (`100` за максимальное комбо), критические рикошеты ×3 (`300` за крит) и сэйвы на грани ракетки (`400` за сэйв).
   - Бонус за скорость зачистки секторов (`600` за сектор под нормативом времени 45 сек).
2. Накопление статистики забега в движке (`Game`, `hosts.ts`, `runFlow.ts`, `destruction.ts`):
   - Отслеживание блоков, боссов, секторов, комбо, критических ударов, сэйвов на грани и времени секторов.
   - Вычисление breakdown и начисление бонусов при завершении забега (победа или поражение).
   - Проброс `scoreBreakdown` в `HudData`.
3. UI экрана окончания игры (`src/ui/screens/overlays.tsx`):
   - Компонент `ScoreBreakdownTable`: неоновая кибер-таблица с детальным разбором каждого источника очков, бейджами активных мутаторов забега и итоговым счётом.
   - Интеграция в `GameOverScreen` (поражение) и `WinScreen` (победа в кампании и победа в остальных режимах).
4. Тесты:
   - Модульные тесты расчёта `ScoreBreakdown` (`src/game/scoreBreakdown.test.ts`).
   - Регрессионные тесты UI в `src/ui/screens/overlays.test.tsx`.
   - Прохождение полного набора тестов (`npm test`: 72 файла, 585 тестов), typecheck и линтеров.

Allowed files:

- src/game/types.ts
- src/game/game.ts
- src/game/scoreBreakdown.ts
- src/game/scoreBreakdown.test.ts
- src/game/game/runFlow.ts
- src/game/game/hosts.ts
- src/game/game/hudSync.ts
- src/game/game/levelBuild.ts
- src/game/game/modes.ts
- src/game/game/campaignFlow.ts
- src/game/physics.ts
- src/game/physics/destruction.ts
- src/ui/screens/overlays.tsx
- src/ui/screens/overlays.test.tsx
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

Dependencies: T-034

Acceptance criteria:

- [x] Тип `RunScoreBreakdown` определён в `types.ts` и синхронизируется в `HudData`
- [x] Статистика забега (блоки, боссы, комбо, криты, сэйвы, время) корректно аккумулируется
- [x] При победе и поражении начисляются бонусы за жизни, щиты, комбо, криты, сэйвы и скорость
- [x] Учитываются активные мутаторы кампании (множитель до +240%)
- [x] Таблица детального расчёта очков встроена в `GameOverScreen` и `WinScreen`
- [x] Unit-тесты расчёта очков и рендера UI проходят
- [x] `npm run typecheck`, `npm run lint:check`, `npm run format:check` и `npm test` проходят

Test plan:
`npm run typecheck`, `npm run lint:check`, `npm run format:check`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

### T-034: Сюжетные терминалы станции «СФЕРА-1080» в событиях кампании (roadmap 2.2)

Status: done
Priority: high
Assigned to: Luna

Описание:
Пункт 2.2 дорожной карты:

1. Интеграция записей бортового журнала станции «СФЕРА-1080» в узлы-события карты кампании по Актам:
   - Акт I: «АРХИВ КРИО-КОНТУРА» (Журнал #108-A, д-р Воронов) — почему квантовый кластер затоплен крио-биогелем, и как авария активировала защитный карантин (Царь-Шар, Медуза, Крио-Дрон).
   - Акт II: «АРХИВ БИОГЕЛЯ» (Журнал #442-B, д-р Эмма Чо) — природа биогеля как полимерной нейросети, создание Хранителей глубин из сервисных дроидов и кабелей (Спрут, Краб, Минога), проект импульсного зонда «СФЕРА».
   - Акт III: «КОНСОЛЬ ОПЕРАТОРА» (Журнал #991-Omega, Директор Ковалёв) — раскрытие статуса Оператора как резервной оцифрованной матрицы сознания экипажа, запущенной для ручного сброса хладагента в космос и спасения станции.
2. Интерактивные выборы для каждого терминала с осмысленными механиками (калибровка хладагента, дешифровка схем, нейросетевая синхронизация, протокол Оператора).
3. Визуальное и звуковое оформление:
   - Особая иконка терминала `IconTerminal` и бирюзово-неоновое выделение на карте узлов.
   - Оформление модального окна события как неонового бортового журнала станции (бейдж «🛰 ОРБИТАЛЬНАЯ СТАНЦИЯ «СФЕРА-1080» // БОРТОВОЙ ЖУРНАЛ», автор, дата, код записи).
   - Звуковой эффект входящего дата-пакета/трансляции `terminalLog()` при открытии терминала.
4. Гарантированный спавн сюжетных терминалов по Актам кампании (при сохранении детерминизма генерации карты).

Allowed files:

- src/game/types.ts
- src/game/campaignMap.ts
- src/game/campaignMapLayout.ts
- src/game/campaignEvents.ts
- src/game/audio.ts
- src/ui/icons.tsx
- src/ui/icons.test.tsx
- src/ui/screens/map.tsx
- src/game/campaignMap.test.ts
- src/game/campaignFlow.test.ts
- src/ui/screens/map.test.tsx
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

Dependencies: T-033

Acceptance criteria:

- [x] Терминалы станции «СФЕРА-1080» интегрированы в события карты для Актов I, II и III
- [x] Раскрыта предыстория биогеля, Хранителей и истинная сущность Оператора
- [x] Каждый терминал имеет сбалансированные интерактивные выборы (перки, щиты, кристаллы, риски)
- [x] На карте кампании терминалы отображаются отдельной иконкой и подсветкой
- [x] Модалка события стилизована под бортовой компьютер «СФЕРА-1080» с аудио-сопровождением
- [x] Unit-тесты для генерации терминалов, вариантов выбора и рендера UI проходят
- [x] `typecheck`, `lint:check`, `format:check` и все тесты проходят без ошибок

Test plan:
`npm run typecheck`, `npm run lint:check`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

### T-033: Спецблоки матрицы (armor, brittle, phase, magnet) в кампанию и редактор

Status: done
Priority: high
Assigned to: Luna

Comment: Реализация пункта 2.1 роадмапа:

1. MapSpec: добавление `brittle` ({ radius?, damage? }) и `phase` ({ period?, activeFraction?, offset? }) в `PlayerBlockEffect`. Поддержка `mode: "attract" | "repel"` для `magnet`.
2. MapAdapter & MapValidator: маппинг `brittle`, `phase` и `magnet.mode` в runtime `Block.sp`, валидация допустимых диапазонов параметров.
3. Редактор карт (`EditorInspector`, `EditorCanvas`, `editorState`): UI-контролы и числовые поля для brittle и phase, переключатель притяжение/отталкивание для магнитов, оверлеи на холсте (хрупкие трещины, фазовый пунктир) и бейджи эффектов (`💥`, `👻`, `🧲-`/`🧲+`).
4. Кампания (`blockSpawn.ts`): генерация `armor` (масштабирование до 2-3 на старших ярусах), `brittle`, `phase` и `magnet` (с долей `repel`), увеличение доли спецблоков с 30% до 60% к поздним уровням.
5. Тесты: `mapAdapter.test.ts`, `mapValidator.test.ts`, `editorState.test.ts`, `blockSpawn.test.ts`. Все 71 тестовый файл / 572 теста зелёные, typecheck/lint/prettier чистые.

Allowed files:

- src/game/mapSpec.ts
- src/game/mapAdapter.ts
- src/game/mapValidator.ts
- src/ui/editor/editorState.ts
- src/ui/editor/EditorInspector.tsx
- src/ui/editor/EditorCanvas.tsx
- src/game/game/blockSpawn.ts
- src/game/mapAdapter.test.ts
- src/game/mapValidator.test.ts
- src/ui/editor/editorState.test.ts
- src/game/game/blockSpawn.test.ts
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Acceptance criteria:

- [x] MapSpec: поддержка `brittle`, `phase` и `magnet.mode`
- [x] MapAdapter: перенос новых спецэффектов в runtime `Block.sp`
- [x] MapValidator: проверка границ радиуса, урона, периода, доли активности и фазового сдвига
- [x] Map Editor: редактирование параметров в инспекторе и визуализация на холсте
- [x] Кампания: генерация новых блоков и масштабирование брони/спецблоков по уровням
- [x] Полный набор тестов (71 файл, 572 теста), typecheck, lint и prettier проходят

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
