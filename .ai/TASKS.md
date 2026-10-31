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

### T-040: Движок синергий перков и реликвий (§3.1 Дорожной карты)

Status: ready
Priority: high
Assigned to: Luna

Описание:
В рамках §3.1 Дорожной карты реализовать движок синергий `src/game/synergies.ts` (AD-028: чистая логика условий + кэш `Set<SynergyId>` в `Game`, пересчёт только по событиям) и первые синергии («Кинетический Снайпер», «Цепной Резонанс», «Гравитационный Джаггернаут»).

---

## Заблокировано

Нет.

---

## Последние выполненные задачи (подробные карточки)

### T-051: Выбор целей кликом по блоку и группой через Space в редакторе карт

Status: done
Priority: medium
Assigned to: Luna

Описание:
В режиме условия победы «Целевые блоки» список `targetIds` заполнялся всеми блоками
автоматически, поэтому выбрать отдельные цели было невозможно. Нужно: список целей
изначально пуст, клик по блоку на поле переключает галочку соответствующей записи,
а выделенная группа отмечается/снимается одним нажатием `Space` (умный переключатель:
отмечены все — снять, иначе отметить всю группу).

1. Чистая логика выбора целей (`src/ui/editor/targetSelection.ts`):
   - `getTargetsCondition`, `orderTargetIds`, `toggleTargetId`, `toggleTargetIds`,
     `replaceTargetIds`;
   - `targetIds` всегда нормализуется к порядку блоков карты (контракт `blocks` ↔ `targetIds`).
2. Редьюсер (`editorState.ts`, `types.ts`): действия `TOGGLE_TARGET`, `TOGGLE_TARGETS`,
   `SET_TARGETS`; каждое — ровно один шаг `Ctrl+Z`; в режиме `all-destructible` игнорируются.
3. Инспектор (`EditorInspector.tsx`):
   - при переключении условия на «Целевые блоки» список целей создаётся пустым;
   - единая панель `TargetsPicker` доступна в свойствах карты, свойствах блока и групповом
     инспекторе: счётчик `N / M`, кнопки «Все блоки» / «Снять все» / «Отметить выделение»,
     прокручиваемый список галочек с подсветкой выделенных блоков и предупреждение о пустом списке.
4. Холст (`EditorCanvas.tsx`):
   - обычный клик по блоку (без перетаскивания) переключает цель;
   - отмеченные блоки подсвечены янтарной пунктирной рамкой и значком «Ц»;
   - счётчик-подсказка внизу холста и пункт «🎯 Отметить целью / Снять цель» в ПКМ-меню;
   - `pointercancel` цель не переключает.
5. Клавиатура (`EditorView.tsx`): `Space` переключает цели всех выделенных блоков,
   не перехватывается у кнопок/ссылок, автоповтор игнорируется.
6. Валидатор (`mapValidator.ts`): новый код `NO_TARGETS` — условие «Целевые блоки» с пустым
   `targetIds` не проходит проверку (иначе `every` по пустому массиву делает карту мгновенно
   пройденной).
7. Тесты: `targetSelection.test.ts` (+7), редьюсер (+6), инспектор (+3), валидатор (+1).
   Все 83 файла / 756 тестов проходят, `typecheck`, `lint`, `prettier` чистые.

Allowed files:

- src/ui/editor/targetSelection.ts
- src/ui/editor/targetSelection.test.ts
- src/ui/editor/types.ts
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts
- src/ui/editor/EditorInspector.tsx
- src/ui/editor/EditorInspector.test.tsx
- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/EditorView.tsx
- src/game/mapValidator.ts
- src/game/mapValidator.test.ts
- docs/CHANGELOG.md
- docs/ROADMAP.md
- .ai/DECISIONS.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- src/game/game/updateStep.ts
- src/game/game/modes.ts
- vite.config.ts
- tsconfig.json
- package.json

Acceptance criteria:

- [x] При выборе условия «Целевые блоки» список целей пуст, галочки не стоят
- [x] Клик по блоку на холсте переключает его галочку в списке целей инспектора
- [x] Перетаскивание и `pointercancel` цель не переключают
- [x] `Space` отмечает всю выделенную группу, повторное нажатие снимает отметки
- [x] Отмеченные цели видны на холсте (янтарная рамка и значок «Ц»)
- [x] `Ctrl+Z` отменяет переключение целей за один шаг
- [x] Пустой список целей блокирует запуск/публикацию карты (`NO_TARGETS`)
- [x] `npm run typecheck`, `npm run lint`, `npm test` проходят (83 файла, 756 тестов)

Test plan:
`npm run typecheck`, `npm run lint`, `npm test`

Verification commands:
npm run typecheck
npm run lint:check
npm run format:check
npm test

---

### T-039: Расширение каталога реликвий (4 → 8) и HUD-индикация артефактов забега

Status: done
Priority: high
Assigned to: Luna

Описание:
В рамках §3.1 Дорожной карты расширен каталог пассивных реликвий забега с 4 до 8 и добавлена наглядная индикация собранного пассивного билда в HUD и на карте.

1. Каталог и механика 4 новых реликвий:
   - `relic_frost` («Крио-резонатор», 36 💎): при потере/срабатывании щита ракетки активирует морозный мяч на 6 сек.
   - `relic_combo` («Нейро-стабилизатор», 34 💎): при ударе о ракетку сохраняет минимум 50% комбо; при потере жизни комбо уполовинивается, а не сбрасывается в 0.
   - `relic_bulwark` («Броневой бастион», 40 💎): первая бомба босса за бой, попавшая в ракетку, поглощается без потери жизни.
   - `relic_overdrive` («Аварийный овердрайв», 50 💎): 1 раз за весь забег при потере последней жизни спасает от Game Over (восстанавливает 1 жизнь, 1 щит, баннер «АВАРИЙНЫЙ ОВЕРДРАЙВ!»).
2. Интеграция в движок и магазин:
   - Добавлены реликвии в `SHOP_CATALOG` (`campaignShop.ts`) с ценами, описаниями и иконками.
   - Поддержаны в `Game.campaignRelics` флаги `relicFrost`, `relicCombo`, `relicBulwark`, `relicOverdrive`.
   - Внедрены триггеры `bulwarkBlockedThisLevel` (сброс в начале каждого боя) и `overdriveUsedThisRun` (сброс при старте забега).
   - Защита от повторной покупки в магазине: кнопка показывает «УЖЕ АКТИВНА».
3. HUD-индикация:
   - Добавлен `activeRelics: CampaignRelicId[]` в `HudData` и `hudSync.ts`.
   - Метаданные `CAMPAIGN_RELICS_META` (имя, краткое описание, цвет, иконка).
   - Отображение активных реликвий компактными бейджами с подсказкой при наведении/тапе в `hud.tsx` (в бою) и `map.tsx` (на карте).
4. Тесты:
   - Юнит-тесты на каждую новую реликвию (`src/game/campaignRelics.test.ts`, `hud.test.tsx`, `map.test.tsx`): 641 тест в 76 файлах (100% pass).

Allowed files:

- src/game/types.ts
- src/game/game.ts
- src/game/campaignShop.ts
- src/game/campaignShop.test.ts
- src/game/campaignRelics.ts
- src/game/campaignRelics.test.ts
- src/game/physics.ts
- src/game/physics/collide.ts
- src/game/physics/collide.test.ts
- src/game/game/hosts.ts
- src/game/game/runFlow.ts
- src/game/game/hudSync.ts
- src/game/game/campaignFlow.ts
- src/game/game/modes.ts
- src/ui/screens/hud.tsx
- src/ui/screens/hud.test.tsx
- src/ui/screens/map.tsx
- src/ui/screens/map.test.tsx
- src/App.tsx
- docs/CHANGELOG.md
- docs/ROADMAP.md
- .ai/DECISIONS.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

---

### T-038b: Блок тактических модулей платформы (включаемые апгрейды в паузе)

Status: done
Priority: high
Assigned to: Luna

Описание:
Улучшение «Штурвал глубин» (наклон ракетки ±30°) и другие активные апгрейды стали переключаемыми на лету.

1. Модуль `src/game/tacticalModules.ts` с интерфейсом `TacticalModulesSettings`:
   - `paddleRotation`: boolean (по умолчанию true)
   - `paddleImpulse`: boolean (false = плавный наклон, true = импульсный щелчок)
   - `aimGuide`: boolean (по умолчанию true)
   - `magnetStart`: boolean (по умолчанию true)
     с хранением в `localStorage` (`sharoboy-tactical-modules`).
2. Интеграция в движок `Game`:
   - `paddleRotatable()` учитывает `paddleRotation`.
   - `impulseActive` активируется при `paddleRotation && paddleImpulse`.
   - `isAimGuideActive()` учитывает `aimGuide`.
   - Стартовый магнит в `campaignFlow.ts` и `modes.ts` накладывается только при `magnetStart === true`.
3. UI в экране паузы (`PauseScreen`) и в настройках (`SettingsModal`):
   - Блок «ТАКТИЧЕСКИЕ МОДУЛИ» отображает тумблеры ТОЛЬКО для купленных игроком улучшений.
   - Рядом со «Штурвалом глубин» — чекбокс «Импульсный щелчок».
4. Тесты: `src/game/tacticalModules.test.ts`, `src/ui/screens/overlays.test.tsx` (624 теста, 100% pass).

Allowed files:

- src/game/tacticalModules.ts
- src/game/tacticalModules.test.ts
- src/game/types.ts
- src/game/game.ts
- src/game/game/hosts.ts
- src/game/game/paddleControl.ts
- src/game/game/hudSync.ts
- src/game/game/campaignFlow.ts
- src/game/game/modes.ts
- src/ui/screens/overlays.tsx
- src/ui/screens/overlays.test.tsx
- src/ui/screens/SettingsModal.tsx
- src/ui/screens/SettingsModal.test.tsx
- src/App.tsx
- docs/CHANGELOG.md
- docs/ROADMAP.md
- .ai/DECISIONS.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Forbidden files:

- vite.config.ts
- tsconfig.json
- package.json

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

## Выполнено ранее (архив)

Карточки удалены при чистке файла; подробности каждой задачи — в `.ai/STATE.md`
(раздел «Текущая фаза») и `memory-bank/progress.md`.

| Задача | Что сделано                                                                 |
| ------ | --------------------------------------------------------------------------- |
| T-037  | Взрывной шар «Плазменный заряд» (roadmap 3.1, ингредиент 2)                 |
| T-036  | Проникающий шар «Кинетический клинок» (roadmap 3.1, ингредиент 1)           |
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
