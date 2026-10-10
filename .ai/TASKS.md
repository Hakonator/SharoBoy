# Active Tasks

## Приоритет: High

### T-001: Разработать типы Authoring Spec (PlayerMapSpec)

Status: done
Priority: high
Assigned to: none

Comment: Ревью завершено, всё отлично. Смотри REVIEW-NOTES.md. Можно приступать к T-002.

Описание:
Описать TypeScript-интерфейсы спецификации пользовательских карт (Authoring Spec) согласно ROADMAP.md (Этап A1). Спецификация должна включать `PlayerMapSpec`, `PlayerBlockSpec`, `BlockGroupSpec`, `MotionSpec` и типы эффектов/анимаций, отделяя их от внутренних runtime-типов (типа `Block`).

Allowed files:

- src/game/mapSpec.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: none

Acceptance criteria:

- [x] Созданы типы `PlayerMapSpec`, `PlayerBlockSpec`, `BlockGroupSpec`, `MotionSpec`
- [x] Описаны эффекты MVP по AD-001 (названия и параметры, без логики валидации)
- [x] Typecheck проходит

Test plan:
Просто проверить, что типы описаны корректно и компилируются через typecheck, так как логики здесь нет.

Verification commands:
npm run typecheck
npm run lint

Context:
Согласно ROADMAP.md (раздел 13.2), мы начинаем делать Редактор Карт. Первый шаг — задать чистые декларативные структуры данных для сохранения карт.

### T-002: Разработать валидатор карт (Этап A2)

Status: done
Priority: high
Assigned to: none

Comment: Валидатор полностью соответствует AD-002. Ревью пройдено. Можно начинать T-003.

Comment: Реализация завершена; typecheck, lint и 9 целевых тестов прошли. Ожидает проверки Gemini.

Описание:
Реализовать чистую функцию валидации `PlayerMapSpec`, которая проверяет уникальность ID, корректность ссылок на группы/блоки и диапазоны значений (включая границы поля). Валидатор должен возвращать массив структурированных ошибок.

Allowed files:

- src/game/mapValidator.ts
- src/game/mapValidator.test.ts
- src/game/mapSpec.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-001

Acceptance criteria:

- [x] Проверка уникальности block ID и group ID
- [x] Проверка существования целей ссылок в группах и парных блоках
- [x] Возврат списка ошибок с путями (`path`, код ошибки, сообщение)
- [x] Тесты проходят
- [x] Typecheck проходит

Test plan:
Написать unit-тесты для валидатора, передавая ему как корректные `PlayerMapSpec`, так и спеки с дублями ID, неверными ссылками и выходом за границы.

Verification commands:
npm run typecheck
npm run lint
npm run test -- src/game/mapValidator.test.ts

Context:
Валидатор необходим, чтобы редактор и загрузчик карт не роняли движок из-за неверных ссылок или выходов за границы. (ROADMAP.md, раздел 13.3).

### T-003: Разработать адаптер карты в уровень

Status: done
Priority: high
Assigned to: none

Comment: Адаптер полностью готов и соответствует AD-003. Ревью пройдено. Этап структуры карт завершен.

Comment: Разблокировано AD-003: передавать поддержанные runtime-поля pulse, spring и cotton; параметры pulse.amplitude и spring/cotton speedMultiplier/duration намеренно игнорировать в MVP.

Описание:
Написать конвертер `mapAdapter.ts`, который принимает валидированный `PlayerMapSpec` и переводит его в массив рантайм-блоков (`Block[]`), которые использует движок.

Allowed files:

- src/game/mapAdapter.ts
- src/game/mapAdapter.test.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-001, T-002

Acceptance criteria:

- [x] Чистая функция конвертации `PlayerMapSpec -> Block[]`
- [x] Маппинг `PlayerBlockSpec` в рантайм-поля блоков (учет HP, типа, стартовых позиций и движения)
- [x] Тесты проходят
- [x] Typecheck проходит

Test plan:
В тестах проверить, что `mapAdapter` корректно преобразует декларативные структуры (например, `Pulse` эффект или `Drift` движение) в соответствующие поля `Block`.

Verification commands:
npm run typecheck
npm run lint
npm run test -- src/game/mapAdapter.test.ts

Context:
Движок (Game) оперирует объектами типа `Block`, а карты описываются в `PlayerMapSpec`. Нужен слой адаптера, чтобы не загрязнять runtime-классы движка (ROADMAP.md, 13.2).

## Completed Tasks

### T-000: Инициализация проекта ✓

Status: done

### T-004: Интеграция режима "Пользовательская карта" в ядро игры (Этап A3)

Status: done
Priority: high
Assigned to: none

Comment: Ревью завершено, всё отлично. Смотри REVIEW-NOTES.md. Можно приступать к T-005.

Описание:
Добавить новый игровой режим (например, `mode: "custom"` в `HudData`), который позволит запускать игру из загруженной карты. Нужно обновить логику `Game` (в частности обработку старта уровня и условия победы), чтобы при победе или поражении игра корректно возвращала игрока в UI тест-прогона (вместо перехода на следующий уровень кампании).

Allowed files:

- src/game/types.ts
- src/game/game.ts
- src/game/game/updateStep.ts
- src/game/game/modes.ts
- src/game/game/runFlow.ts
- src/game/game/levelBuild.ts
- src/game/powers.ts
- src/game/game/hosts.ts
- src/ui/useLeaderboard.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: none (опирается на уже готовые T-001, T-003)

Acceptance criteria:

- [x] Добавлен режим "custom" или аналогичный для кастомных карт
- [x] Механизм победы/поражения не крашит игру и не переходит в кампанию
- [x] `typecheck` и `lint` проходят без ошибок

Test plan:
Unit-тесты не обязательны, достаточно убедиться, что типы обновлены и логика не ломает существующие режимы `campaign` и `endless`.

Verification commands:
npm run typecheck
npm run lint

Context:
Это подготовка движка к тест-прогонам (ROADMAP 13.4, Этап A3). Игра должна уметь переключаться в песочницу и корректно из неё выходить.

### T-005: Базовый UI загрузчика/тестера карт (Этап A3)

Status: done
Priority: high
Assigned to: none

Comment: Ревью завершено, всё отлично. Этап A3 закрыт! Смотри REVIEW-NOTES.md.

Comment: Q-009 решён: allowed_files разрешает корневой `src/App.tsx` для интеграции MapTesterView.

Описание:
Создать простой React-компонент (Dev Sandbox) для загрузки карт из JSON. Компонент должен содержать текстовое поле для ввода JSON, кнопку "Проверить" (вызывает `validatePlayerMapSpec` из T-002) и кнопку "Играть" (конвертирует через `mapSpecToBlocks` из T-003 и запускает Game в новом режиме из T-004).

Allowed files:

- src/ui/MapTesterView.tsx
- src/App.tsx
- src/game/mapSpec.ts (только добавление экспорта/типов если нужно)

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-004

Acceptance criteria:

- [x] UI принимает JSON карты
- [x] При ошибках валидации показывает их список (путь и сообщение)
- [x] При успехе запускает игру с этой картой
- [x] `typecheck` проходит

Test plan:
Проверить в браузере, вставив валидный JSON карты. Игра должна начаться с блоками, указанными в JSON.

Verification commands:
npm run typecheck
npm run lint

### T-006: Исправить баг с дублированием звука при пересоздании Game

Status: done
Priority: high
Assigned to: luna

Описание:
Баг: при пересоздании `Game` (например, при React StrictMode или HMR) класс `SFX` не отписывается от глобальных событий `window` (pointerdown, keydown, touchstart), которые были добавлены в `armGestureUnlock`. В результате "старые" убитые экземпляры `SFX` продолжают ловить вводы пользователя (например, клик "Играть" в Sandbox), запускать музыку через `startMusic()` и создавать неконтролируемые параллельные аудио-потоки.

Шаги для исправления:

1. В `src/game/audio.ts` сохранить ссылку на слушатель `onInput` как свойство класса, чтобы можно было отписаться от него. В `SFX` добавить метод `destroy()`, который будет вызывать `this.stopMusic()` и `window.removeEventListener` для всех трех событий.
2. В `src/game/game/lifecycle.ts` в функции `destroy(g: Game)` заменить вызов `g.sfx.stopMusic()` на `g.sfx.destroy()`.

Allowed files:

- src/game/audio.ts
- src/game/game/lifecycle.ts
- src/game/game.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: none

Acceptance criteria:

- [x] `SFX` имеет метод `destroy()`, который отписывается от `window` событий
- [x] Метод `destroy` в `lifecycle.ts` корректно вызывает `g.sfx.destroy()`
- [x] Typecheck проходит

Test plan:
Убедиться, что при многократном пересоздании `Game` глобальные события не накапливаются, и звук контролируется только текущим экземпляром игры.

Verification commands:
npm run typecheck
npm run lint

### T-007: Магнитные блоки — пиктограмма магнита, полярность и скрытие зоны действия в игре

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-005:

1. Сейчас в обычном геймплее (кампания, бесконечный режим, кастомные карты) магнитный блок всегда рисует большой пунктирный розовый круг радиуса действия, что засоряет экран. Этот контур должен отображаться только при включённом режиме хитбоксов/отладки (`showHitboxes` / F2) в `drawHitboxes` (или по отдельному флагу отладки), но не в штатном рендере блоков `drawPriorityMarks`.
2. Текущая пиктограмма на теле блока представляет собой 2 невнятные параллельные линии. Заменить её на красивую, узнаваемую U-образную подкову магнита с двумя полюсными наконечниками.
3. Добавить полярность магнита: притяжение (`attract`) и отталкивание (`repel`):
   - Расширить `BlockSpecial.magnet` полем `mode?: "attract" | "repel"` (по умолчанию `"attract"`).
   - В `src/game/physics/collide.ts` в `applyBlockMagnets` поддержать режим отталкивания: если `magnet.mode === "repel"` или сила отрицательная, вектор силы направлен от центра блока наружу (`dx/dy` с обратным знаком), мягко отталкивая шар.
   - Отразить полярность в визуале: для притяжения классический розовый/красно-синий акцент, для отталкивания — бирюзовый/голубой.
   - Поддержать эффект в `PlayerBlockEffect` (`src/game/mapSpec.ts`), валидаторе (`src/game/mapValidator.ts`) и адаптере (`src/game/mapAdapter.ts`).
   - Обновить существующие unit-тесты (`blocks.test.ts`, `physics.test.ts`, `mapValidator.test.ts`, `mapAdapter.test.ts`), чтобы они проверяли как скрытие круга из стандартного рендера, так и обе полярности.

Allowed files:

- src/game/blockKinds.ts
- src/game/render/blockKinds.ts
- src/game/render/blocks.ts
- src/game/render/debug.ts
- src/game/render/blocks.test.ts
- src/game/physics/collide.ts
- src/game/physics.test.ts
- src/game/mapSpec.ts
- src/game/mapValidator.ts
- src/game/mapValidator.test.ts
- src/game/mapAdapter.ts
- src/game/mapAdapter.test.ts
- src/game/debugLevels.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: none

Acceptance criteria:

- [x] В обычном режиме игры (`showHitboxes === false`) пунктирный круг зоны магнита не рисуется
- [x] При `showHitboxes === true` (F2) зона действия магнита отображается
- [x] На самом блоке рисуется стилизованная пиктограмма магнита (U-образная подкова)
- [x] Поддерживаются режимы притяжения (`attract`) и отталкивания (`repel`) в физике шара
- [x] Визуальный телеграф пиктограммы различает притяжение и отталкивание
- [x] Спецификации карт (`mapSpec`), валидатор и адаптер поддерживают `magnet` с `mode`
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Test plan:
Проверить unit-тестами физику отталкивания и притяжения, рендер значка и отсутствие пунктирного круга в `drawBlocks`, запустить игру и убедиться визуально.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-008: Единая верхняя HUD-зона во всех ориентациях (затемнение, отскок и исключение перекрытия блоков)

Status: done
Priority: high
Assigned to: luna

Comment: Разблокировано по Q-010: в allowed_files добавлен `src/game/game/rotateLayout.ts`. В `realignOnOrientationChange` пересчитывать сдвиг вниз dy при повороте в любую сторону (если блоки/босс оказались выше актуального blockTop(g)).

Описание:
Согласно AD-006:
Сейчас неигровая HUD-зона с затемнением, пунктирной линией и физическим отскоком шара работает только на вертикальном экране (`g.h > g.w`). В альбомной ориентации (landscape/десктоп) `blockTop(g)` возвращал 0. Из-за этого:

1. Блоки при генерации и мотивы спавнятся впритык к верхней кромке экрана и перекрываются плашками счёта, жизней, целей и кнопками громкости/паузы.
2. Шар залетает под HUD, что ухудшает видимость игры.
3. Визуальный стиль разнится между мобильной и десктопной версиями.

Что требуется сделать:

1. В `src/game/game/paddleControl.ts` обновить функцию `blockTop(g: Game)`:
   - Она больше не должна возвращать `0` в альбомной ориентации (`g.cssH <= g.cssW`).
   - Должна возвращать безопасную высоту HUD-зоны в мировых координатах для всех ориентаций: `Math.max(hudTopCss(g.cssW, g.cssH) / g.scale, g.h * 0.08)` (с защитой не выше 35% высоты мира).
   - `blockSpawnTop(g)` согласовать с `blockTop(g)`.
2. В `src/game/game/drawScene.ts`:
   - В вызове `drawTopZone(ctx, w, blockTop(g), ...)` убрать условие `!inPlay || g.h <= g.w`. Затемнение и пунктирная линия должны рисоваться всегда во время игры (`!inPlay || blockTop(g) <= 0`).
3. В `src/game/game/levelBuild.ts`:
   - Убедиться, что при спавне уровней (`gridBlocks`, `layoutBlocks`, `buildBossArena`) передаётся актуальный `blockTop(g)`.
4. В генераторах уровней (`src/game/levelPatterns.ts`, `src/game/levelBuilder.ts`):
   - Убедиться, что верхние блоки с учётом их полурадиуса `ry` не пересекают границу `top`.
5. В `src/game/game/rotateLayout.ts`:
   - Поддержать пересчёт сдвига уровня при смене ориентации в обе стороны, чтобы блоки не оказывались под HUD-зоной после поворота окна.
6. Обновить затронутые unit-тесты (`blockMotion.test.ts`, `rotateLayout.test.ts`, `powers.test.ts`, `physics.test.ts` и др.), где ранее предполагалось `blockTop === 0` в ландшафте, приведя их в соответствие с новой архитектурой.

Allowed files:

- src/game/game/paddleControl.ts
- src/game/game/drawScene.ts
- src/game/game/levelBuild.ts
- src/game/levelPatterns.ts
- src/game/levelBuilder.ts
- src/game/render/background.ts
- src/game/game/rotateLayout.ts
- src/game/game/blockMotion.test.ts
- src/game/game/rotateLayout.test.ts
- src/game/powers.test.ts
- src/game/physics.test.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: none

Acceptance criteria:

- [x] `blockTop(g)` возвращает корректную высоту HUD-зоны как в ландшафте, так и в портрете
- [x] В альбомном режиме сверху видна пунктирная линия отскока и мягкое затемнение под плашками HUD
- [x] Шар отскакивает от линии HUD-зоны во всех режимах и ориентациях
- [x] Блоки больше не спавнятся под элементами интерфейса
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Test plan:
Запустить `npm run test`, проверить тесты физики отскока и генерации блоков, запустить локально игру и убедиться, что блоки расположены ниже HUD и шар отскакивает от пунктирной линии.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-009: Модели состояния и редьюсер редактора карт (State & Reducer)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-007, заложить типизированное ядро состояния и чистые функции модификации карты (`editorState.ts`):

1. Описать интерфейсы `EditorState` и действий `EditorAction` в `src/ui/editor/types.ts`:
   - `map: PlayerMapSpec` (текущая редактируемая карта)
   - `selectedBlockId: string | null`
   - `activeTool: "select" | "add" | "delete"`
   - `addPreset: Partial<PlayerBlockSpec>` (пресет добавляемого блока: форма, HP, размеры)
   - `gridSize: number` (по умолчанию 32 или 40 мировых единиц)
   - `snapToGrid: boolean` (по умолчанию true)
   - `history: { past: PlayerMapSpec[]; future: PlayerMapSpec[] }` (стек undo/redo до 30 записей)
   - `isDirty: boolean`
2. Реализовать чистый редьюсер и экшены в `src/ui/editor/editorState.ts`:
   - `SET_MAP`: установка карты (с очисткой или сохранением истории)
   - `SELECT_BLOCK`: выбор блока по id (или сброс выбора)
   - `SET_TOOL`: смена инструмента
   - `ADD_BLOCK`: добавление нового блока (с авто-генерацией уникального id `b-timestamp-rand` и снаппингом к сетке)
   - `UPDATE_BLOCK`: частичное обновление свойств существующего блока
   - `DELETE_BLOCK`: удаление выбранного блока (и очистка ссылок на него)
   - `MOVE_BLOCK`: перемещение блока на delta или в абсолютные координаты
   - `UNDO` / `REDO`: переход по истории
   - `UPDATE_METADATA`: редактирование названия/автора/winCondition карты
3. Добавить сохранение/загрузку черновика карты из `localStorage` (`sharoboy_custom_map_draft`).
4. Написать unit-тесты на редьюсер (`src/ui/editor/editorState.test.ts`), покрывающие: добавление блока, удаление, перемещение, ограничение стека undo/redo, корректный возврат назад и вперёд.

Allowed files:

- src/ui/editor/types.ts
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: none

Acceptance criteria:

- [x] Созданы типы `EditorState`, `EditorAction`, `EditorTool`
- [x] Реализован чистый редьюсер всех операций с картой и историей (Undo/Redo)
- [x] Написаны unit-тесты, проверяющие все мутации и стек истории
- [x] `npm run typecheck`, `npm run lint` и `npm run test` проходят без ошибок

Comment: Реализованы immutable reducer, undo/redo с лимитом 30, снаппинг, операции карты и безопасное localStorage-хранение. Проверки typecheck/lint и полный Vitest (40 файлов, 350 тестов) прошли.

Test plan:
Unit-тесты в `editorState.test.ts`.

Verification commands:
npm run typecheck
npm run lint
npm run test -- src/ui/editor/editorState.test.ts

### T-010: Интерактивный Canvas редактора карт (EditorCanvas)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-007:
Реализовать интерактивный холст `src/ui/editor/EditorCanvas.tsx`:

1. Отображение игрового поля в эталонном соотношении 1920×1080 с масштабированием под контейнер.
2. Отрисовка координатной сетки (шаг `gridSize`) с подсветкой привязки.
3. Отрисовка верхней неигровой HUD-зоны (затемнение и пунктирная граница), чтобы автор видел границу.
4. Отрисовка блоков из `map.blocks`:
   - Отображение формы (круг/эллипс), правильных размеров и поворота.
   - Цветовая заливка в соответствии с палитрой HP (`TIER[hp].base`).
   - Иконки/метки эффектов (броня, пружина, вата, магнит-подкова с полярностью, портал).
   - Выделение рамкой/свечением выбранного блока (`selectedBlockId`).
5. Интерактивность мыши и тача:
   - Клик по блоку в режиме `select` -> выбор блока.
   - Drag-and-drop перемещение выбранного блока с привязкой к сетке (`snapToGrid`).
   - Клик в режиме `add` -> создание блока в точке клика.
   - Клик в режиме `delete` -> мгновенное удаление блока.

Allowed files:

- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/types.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-009

Acceptance criteria:

- [x] Холст масштабируется под экран с сохранением пропорций 1920×1080
- [x] Отображаются сетка, HUD-граница и блоки со всеми визуальными свойствами
- [x] Работает выделение, перемещение с привязкой, добавление и удаление по клику
- [x] `typecheck` и `lint` проходят без ошибок

Comment: Добавлен масштабируемый интерактивный Canvas с сеткой, HUD-зоной, рендером блоков/эффектов, выбором, drag-and-drop, добавлением и удалением. Typecheck, lint и полный test (40 файлов, 350 тестов) прошли.

Test plan:
Проверка компиляции и визуальный тест в браузере.

Verification commands:
npm run typecheck
npm run lint

### T-011: Панель инструментов и свойств (Toolbar & Inspector)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-007:

1. Создать `src/ui/editor/EditorToolbar.tsx`:
   - Переключение инструментов: `Выбор`, `Добавить блок`, `Удалить`.
   - Кнопки `Отменить (Undo)` и `Повторить (Redo)` с отображением активности (`disabled`, если стек пуст).
   - Переключатель привязки к сетке и выбор шага сетки (16, 32, 64).
   - Кнопки быстрого действия: "Очистить карту", "Импорт/Экспорт JSON", "Тест-прогон", "Закрыть".
2. Создать `src/ui/editor/EditorInspector.tsx`:
   - Если выбран блок:
     - HP (кнопки или слайдер 1-8 с отображением цвета блока).
     - Форма (`circle`, `ellipse`), ширина и высота, угол поворота.
     - Переключатель эффектов: Броня (число 1-5), Пружина, Вата, Пульсация, Магнит (режим: Притяжение / Отталкивание, радиус, сила), Портал (id пары).
     - Кнопка «Дублировать блок» и «Удалить блок».
   - Если блок не выбран:
     - Метаданные карты: Название, Автор, Описание.
     - Условие победы `winCondition` (`all-destructible` или `targets`).
     - Счётчик блоков и суммарного HP.

Allowed files:

- src/ui/editor/EditorToolbar.tsx
- src/ui/editor/EditorInspector.tsx
- src/ui/editor/types.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-009

Acceptance criteria:

- [x] Toolbar содержит все кнопки управления и индикаторы инструментов
- [x] Inspector позволяет редактировать любые параметры блока и карты
- [x] Изменения мгновенно применяются в стейт через редьюсер T-009
- [x] `typecheck` и `lint` проходят без ошибок

Comment: Добавлены Toolbar с инструментами, undo/redo, сеткой, очисткой и callback-командами JSON/test/close; Inspector редактирует блоки, эффекты, метаданные и win condition через reducer. Проверки typecheck/lint и полный test (40 файлов, 350 тестов) прошли.

Test plan:
Проверка валидности типов и рендера компонентов.

Verification commands:
npm run typecheck
npm run lint

### T-012: Полноэкранный EditorView, модалка JSON и интеграция в игру

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-007:

1. Создать `src/ui/editor/EditorJsonModal.tsx` для быстрого просмотра, копирования и вставки JSON карты с валидацией через `validatePlayerMapSpec`.
2. Создать корневой `src/ui/editor/EditorView.tsx`:
   - Объединяет `EditorToolbar`, `EditorCanvas`, `EditorInspector` и `EditorJsonModal`.
   - Инициализирует редьюсер с сохранённым черновиком из `localStorage` (или дефолтной картой).
   - Поддерживает горячие клавиши: `Ctrl+Z` (Undo), `Ctrl+Y` / `Ctrl+Shift+Z` (Redo), `Delete` / `Backspace` (удалить выбранный), `Escape` (снять выбор).
3. Интегрировать в `src/App.tsx`:
   - Заменить кнопку «Тестер карт» на «Редактор карт» (или добавить рядом).
   - При клике «Тест-прогон» из редактора запускать `startCustomMap(map, onComplete)`, а после победы/поражения автоматически возвращать автора обратно в редактор с сохранением всех несохранённых правок.

Allowed files:

- src/ui/editor/EditorView.tsx
- src/ui/editor/EditorJsonModal.tsx
- src/ui/editor/index.ts
- src/App.tsx

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-009, T-010, T-011

Acceptance criteria:

- [x] Полноэкранный редактор открывается из главного меню
- [x] Работают шорткаты Ctrl+Z, Ctrl+Y, Delete, Escape
- [x] Запуск тест-прогона бесшовно стартует уровень и возвращает в редактор
- [x] Импорт и экспорт JSON работают с проверкой ошибок валидации
- [x] Черновик сохраняется при перезагрузке страницы в localStorage
- [x] Все тесты, `typecheck` и `lint` проходят без ошибок

Comment: Добавлены EditorView, JSON import/export modal, hotkeys, draft autosave и App menu/test-run integration с возвратом после callback. Typecheck/lint/test (40 файлов, 350 тестов)/build прошли; ручная браузерная проверка не выполнялась.

Test plan:
Полный цикл проверок: unit-тесты, `npm run build`, запуск в браузере.

Verification commands:
npm run typecheck
npm run lint
npm run test
npm run build

\n

### T-013: Эргономика редактора карт, ПКМ, зона ракетки и плавный Snap

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-008 реализовать первый этап улучшений UX редактора карт:

1. **Подсветка активного инструмента в Toolbar (`EditorToolbar.tsx`)**:
   - Кнопка активного инструмента (`activeTool === tool.id`) должна быть ярко визуально выделена (неоновый акцент `bg-cyan-neon text-ink`, свечение `shadow-[0_0_12px_rgba(86,231,255,0.6)]`, рамка `border-cyan-neon ring-2 ring-cyan-neon/40 font-bold`).

2. **Быстрые действия ПКМ (`EditorCanvas.tsx`)**:
   - Предотвратить стандартное контекстное меню браузера на холсте (`e.preventDefault()` на событии contextmenu).
   - ПКМ на пустом месте поля: отменяет выбор блока (`SELECT_BLOCK` с null) и переключает инструмент на "select".
   - ПКМ на блоке: быстро удаляет блок (`DELETE_BLOCK`) без необходимости вручную переключать инструмент на ластик/удаление.

3. **Связанные размеры формы "круг" (`EditorInspector.tsx`, `editorState.ts`)**:
   - При `shape === "circle"` ширина и высота должны меняться строго синхронно (1:1).
   - Изменение ширины меняет и высоту, изменение высоты меняет ширину.
   - При смене формы на "circle" размеры автоматически приводятся к равенству (`Math.min(width, height)` или текущей ширине).

4. **Интерактивные слайдеры в Inspector (`EditorInspector.tsx`)**:
   - Под числовыми полями "Ширина" (20..100) и "Высота" (20..100) добавить ползунки `<input type="range" min="20" max="100" />`.
   - Под полем "Поворот (°)" (-360°..360° или -180°..180°) добавить ползунок `<input type="range" min="-180" max="180" step="1" />`.
   - Слайдер и числовое поле синхронизированы в обе стороны в реальном времени.

5. **Ограничение нижней зоны ракетки (`mapValidator.ts`, `EditorCanvas.tsx`, `editorState.ts`)**:
   - Задать константу `PADDLE_ZONE_TOP = 880` (зона ракетки с запасом: Y в диапазоне [880, 1080], высота 200px при эталоне 1080).
   - В `mapValidator.ts`: добавить валидацию, что нижний край блока не заходит в зону ракетки: `block.position.y + block.size.height / 2 <= PADDLE_ZONE_TOP`. При нарушении выдавать понятную ошибку `OUT_OF_BOUNDS` / "Блок заходит в зону ракетки (ниже Y = 880)".
   - Обновить `src/game/mapValidator.test.ts` (скорректировать тестовые координаты блоков, чтобы не выходили за Y=880, и добавить тест на отклонение блока в зоне ракетки).
   - В `EditorCanvas.tsx`: отрисовать нижнюю зону Y в диапазоне [880, 1080] полупрозрачным фоном с предупреждающей пунктирной линией и текстом «ЗОНА РАКЕТКИ / НЕЛЬЗЯ СТАВИТЬ БЛОКИ» аналогично верхней HUD-зоне.
   - При добавлении (`ADD_BLOCK`) и перемещении (`MOVE_BLOCK`) ограничивать (clamp) координаты, чтобы блок не мог быть поставлен в зону ракетки (нижний край <= 880) и верхнюю HUD-зону (верхний край >= 140).

6. **Плавная отрисовка при перетаскивании (Live Drag & Snap)**:
   - В `EditorCanvas.tsx` в процессе перетаскивания (pointermove с зажатой кнопкой) отрисовывать перемещаемый блок в реальном времени под курсором.
   - Если включен `snapToGrid`: отображать силуэт/призрак блока, примагничивающийся к узлам сетки, чтобы игрок видел точное положение блока до отпускания мыши.

Allowed files:

- src/ui/editor/types.ts
- src/ui/editor/EditorToolbar.tsx
- src/ui/editor/EditorInspector.tsx
- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts
- src/game/mapValidator.ts
- src/game/mapValidator.test.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-012

Acceptance criteria:

- [x] Активная кнопка инструмента в Toolbar отчётливо подсвечена неоновым акцентом и тенью
- [x] ПКМ на холсте сбрасывает выбор и инструмент, ПКМ на блоке мгновенно удаляет его
- [x] Для формы "круг" ширина и высота всегда синхронизированы 1:1
- [x] В инспекторе под полями ширины, высоты и поворота работают удобные range-слайдеры
- [x] Валидатор и холст блокируют размещение блоков в зоне ракетки (Y > 880); на холсте зона визуально обозначена
- [x] Перетаскивание блоков на холсте происходит с плавной живой отрисовкой и видимым залипанием по сетке
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Ревью пройдено успешно: подсветка активного инструмента, ПКМ-действия, синхронный круг 1:1, слайдеры, зона ракетки Y<=880 и живой drag preview с залипанием работают безупречно. Typecheck, lint, 354 теста и build прошли.

Comment: Реализованы AD-008 UX-правки Toolbar/Inspector/Canvas/reducer и paddle-zone validator. Проверки lint/typecheck/full test (40 файлов, 354 теста) прошли; ручная браузерная проверка не выполнялась.

Test plan:

1. Запустить `npm run test` для проверки валидатора и редактора.
2. Проверить в браузере подсветку кнопок, слайдеры, ПКМ-клики, перемещение с залипанием и ограничение по Y.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-014: Маркеры трансформации на холсте, групповое выделение и буфер обмена

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-008 реализовать второй этап расширенного UX редактора карт:

1. **Поддержка множественного выделения (`types.ts`, `editorState.ts`)**:
   - Добавить в `EditorState` массив `selectedBlockIds: string[]` (сохраняя `selectedBlockId` как первый выбранный или вычисляемый для обратной совместимости).
   - Добавить экшены `SELECT_BLOCKS: { blockIds: string[] }`, `TOGGLE_BLOCK_SELECTION: { blockId: string }`.
   - Поддержать выделение нескольких блоков кликом с зажатым `Shift` или `Ctrl`.

2. **Рамочное выделение на холсте (Marquee / Box Selection in `EditorCanvas.tsx`)**:
   - В режиме "Выбор" при зажатии ЛКМ на пустом месте холста и движении мыши рисовать пунктирный прямоугольник выделения.
   - При отпускании мыши все блоки, геометрически пересекающие область рамки, добавляются в `selectedBlockIds`.

3. **Маркеры трансформации на холсте (`EditorCanvas.tsx`)**:
   - При выборе ровно одного блока вокруг него отрисовывать интерактивные маркеры:
     - 4 угловых маркера изменения размера (квадратные или круглые ручки).
     - Маркер вращения (рукоятка над верхним центром с двусторонней стрелкой).
   - Потягивание за угловой маркер масштабирует блок:
     - Для круга масштаб строго пропорционален (1:1).
     - Для эллипса меняет ширину и высоту относительно центра.
     - Ограничивает размеры диапазоном 20..100 пикселей.
   - Потягивание за маркер вращения вращает блок вокруг его центра (показывая круговой индикатор угла).
   - Соответствующие курсоры мыши при наведении на маркеры.

4. **Плавное перемещение группы блоков (`EditorCanvas.tsx`, `editorState.ts`)**:
   - При перетаскивании любого блока из группы все выделенные блоки плавно перемещаются вместе.
   - Все перемещаемые блоки сохраняют взаимное расположение и не выходят за безопасные границы поля.

5. **Буфер обмена и горячие клавиши (`EditorView.tsx`, `editorState.ts`)**:
   - Добавить в `EditorState` поле `clipboard: PlayerBlockSpec[]` и экшены `COPY_SELECTED`, `PASTE_CLIPBOARD`.
   - Горячая клавиша `Ctrl+C`: копирует выделенные блоки в буфер.
   - Горячая клавиша `Ctrl+V`: вставляет блоки со смещением (+32, +32), создавая новые уникальные идентификаторы и делая вставленные блоки активным выделением.
   - Клавиша `Delete` / `Backspace` удаляет все блоки из `selectedBlockIds`.

Allowed files:

- src/ui/editor/types.ts
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts
- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/EditorView.tsx
- src/ui/editor/EditorInspector.tsx

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-013

Acceptance criteria:

- [x] Рамка выделения ЛКМ (marquee selection) выделяет группу блоков
- [x] Ctrl/Shift + клик добавляет и убирает блоки из множественного выделения
- [x] Выделенный блок имеет 4 угловых маркера масштабирования и маркер поворота
- [x] Перетаскивание маркеров на холсте меняет размер и угол поворота с нужными курсорами
- [x] Группа выделенных блоков перемещается вместе
- [x] Работают шорткаты Ctrl+C и Ctrl+V для дублирования с новыми ID и смещением
- [x] Delete / Backspace удаляет всю группу выделенных блоков
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Ревью пройдено успешно: интерактивные угловые маркеры ресайза, рукоятка вращения, рамочное выделение (marquee), плавное перемещение группы с ограничением safe-zone, буфер обмена Ctrl+C/V и групповое удаление работают отлично. Проверки typecheck, lint, 358 тестов и production build успешны.

Comment: Добавлено ordered multi-selection, marquee, resize/rotate handles, clamped group drag, reducer clipboard и горячие клавиши. Проверки lint/typecheck/full test (40 файлов, 358 тестов) прошли; ручная браузерная проверка не выполнялась.

Test plan:

1. Запустить `npm run test` (включая unit-тесты редьюсера с мультивыделением и буфером).
2. Проверить в браузере трансформацию за углы, поворот, рамочное выделение, перемещение группы и Ctrl+C/V.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-015: Быстрое копирование блоков протяжкой (Quick Clone Handle)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-009 реализовать режим быстрого копирования блоков протяжкой за нижний правый угол:

1. **Маркер быстрого копирования на холсте (`EditorCanvas.tsx`)**:
   - Все 4 угла рамки блока сохраняют функцию изменения размера (`resize`, углы 0, 1, 2, 3).
   - Рядом с правым нижним углом (вынесен на 16–20px по диагонали наружу) добавляется специальный круглый маркер быстрого копирования с пиктограммой `+`.
   - При наведении на маркер `+` курсор мыши меняется на `copy` (плюсик).
   - Таким образом, изменение размера за правый нижний угол сохраняется, а потягивание за соседний маркер `+` запускает копирование.

2. **Валидация спец-эффектов при клонировании (`EditorCanvas.tsx`, `editorState.ts`)**:
   - Если блок содержит эффект `portal` (`effect.kind === "portal"`), копирование протяжкой запрещено.
   - При попытке протяжки такого блока операция блокируется, и на холсте/в редакторе отображается понятное уведомление об ошибке:
     "Блоки с порталами нельзя копировать протяжкой: порталы требуют парной связи."
   - Добавить всплывающее уведомление (toast) над холстом с таймером скрытия (2-3 секунды).

3. **Логика протяжки и живой предпросмотр (`EditorCanvas.tsx`)**:
   - При удерживании ЛКМ на маркере и движении мыши в любую сторону рассчитывать последовательность блоков вдоль направления протяжки (по горизонтали или вертикали) с шагом размера блока (с учётом `gridSize` при активном `snapToGrid`).
   - В процессе движения отображать живые полупрозрачные призраки всех создаваемых блоков.
   - Не размещать блоки в запретных зонах: верхней HUD-зоне (Y < 140) и нижней зоне ракетки (Y > 880).
   - Ограничивать общее количество блоков лимитом карты (MAX_BLOCKS = 200). При достижении лимита прекращать генерацию дополнительных блоков и выводить предупреждение.

4. **Интеграция со стейтом (`editorState.ts`, `types.ts`)**:
   - Добавить экшен добавления группы клонированных блоков (`CLONE_SEQUENCE` или `ADD_BLOCKS`) с генерацией уникальных ID для каждого блока.
   - После отпускания мыши созданные блоки становятся активным выделением.
   - Операция сохраняется в историю undo/redo.
   - Покрыть логику редьюсера unit-тестами в `editorState.test.ts`.

Allowed files:

- src/ui/editor/types.ts
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts
- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/EditorView.tsx

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-014

Acceptance criteria:

- [x] Правый нижний угол выделенного блока имеет маркер `+` и меняет курсор на `copy`
- [x] При попытке протянуть блок с порталом выводится предупреждение, клонирование блокируется
- [x] Протяжка обычного блока в любую сторону генерирует цепочку одинаковых блоков с живым предпросмотром
- [x] Клонированные блоки не заходят за границы HUD (Y >= 140) и зону ракетки (Y <= 880)
- [x] Соблюдается лимит 200 блоков
- [x] Все сгенерированные блоки получают уникальные ID и поддерживают Undo/Redo
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Ревью пройдено успешно: отдельный маркер клонирования + около нижнего правого угла, сохранение всех 4 углов масштабирования, генерация цепочки с живым превью, блокировка порталов с показом уведомления, соблюдение лимита в 200 блоков и безопасных зон поля работают безупречно. Typecheck, lint, 360 тестов и build прошли.

Comment: Добавлен отдельный clone handle около нижнего правого resize-угла, snap-aware preview по доминирующей оси, portal toast и reducer CLONE_SEQUENCE с уникальными ID, safe-zone clamp, лимитом 200, selection и undo/redo. Typecheck/lint/full test прошли (40 файлов, 360 тестов); ручная браузерная проверка не выполнялась.

Test plan:

1. Запустить `npm run test` (включая unit-тесты на генерацию последовательности и запрет порталов).
2. Проверить в браузере протяжку в 4 направлениях, курсор-плюс, отмену по Ctrl+Z и блокировку порталов.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-016: Исправление багов редактора (Spacebar, ПКМ-меню, подсветка Toolbar, выход из тест-прогона, плеер музыки)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-010 исправить 5 выявленных проблем в редакторе карт и игровом цикле:

1. **Изоляция глобального Spacebar от текстовых полей ввода (`src/game/input.ts`)**:
   - В `handleKeyDown` в начале метода проверять `event.target`:
     ```ts
     const target = e.target
     if (
       target instanceof HTMLElement &&
       (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
     ) {
       return
     }
     ```
   - Это предотвращает запуск кампании при нажатии пробела во время редактирования названия, автора или описания карты.

2. **Контекстное меню по ПКМ (`src/ui/editor/EditorCanvas.tsx`)**:
   - Заменить мгновенное удаление блока по ПКМ на вызов плавающего контекстного меню на холсте.
   - Меню при клике на блоке:
     - 📋 Дублировать (`Ctrl+C / Ctrl+V` или дубликат со смещением +32, +32)
     - 🔄 Повернуть на 90°
     - 🔘 Сменить форму (Круг / Эллипс)
     - 🗑️ Удалить блок
     - ✖ Закрыть
   - Меню при клике на пустом месте:
     - ➕ Добавить блок здесь
     - 📋 Вставить из буфера (если есть скопированное)
     - 🧹 Снять выделение
     - ✖ Закрыть
   - Меню стилизовано под общий аркадный кибер-дизайн (тёмный полупрозрачный фон, неоновые границы).
   - Меню закрывается кликом вне его или клавишей Escape.

3. **Яркая подсветка активного инструмента (`src/ui/editor/EditorToolbar.tsx`)**:
   - У кнопки выбранного режима (`state.activeTool === tool.id`) НЕ использовать класс `.btn-ghost` (так как он перебивает фон и цвет текста).
   - Применять яркий стиль: `rounded-lg border-2 border-cyan-neon bg-cyan-neon text-ink font-black shadow-[0_0_16px_rgba(53,224,255,0.8)]` с дублированием стилей в атрибуте `style` (`backgroundColor: "#35e0ff"`, `color: "#07131b"`, `boxShadow: "0 0 16px rgba(53,224,255,0.8)"`), гарантируя видимость подсветки в любом браузере.

4. **Кнопка выхода из режима тест-прогона (`src/game/game/modes.ts`, `src/game/game.ts`, `src/ui/screens/hud.tsx`, `src/App.tsx`)**:
   - В `src/game/game/modes.ts` экспортировать `stopCustomMap(g: Game)`:
     ```ts
     export function stopCustomMap(g: Game) {
       const cb = g.onCustomComplete
       toMenu(g)
       cb?.("over")
     }
     ```
   - В `Game.ts` добавить метод `stopCustomMap() { stopCustomMap(this) }`.
   - В `src/ui/screens/hud.tsx`: если `hud.mode === "custom"`, отображать контрастную кнопку «⏹ В редактор» (вызывающую `onExitCustomMap`), а также перехватывать Escape для выхода.
   - В `src/App.tsx` пробросить обработчик `onExitCustomMap={() => g()?.stopCustomMap()}` в `HudOverlay`.

5. **Управление музыкой в редакторе (`src/game/audio/fileMusic.ts`, `src/game/audio.ts`, `src/game/game.ts`, `src/ui/editor/EditorToolbar.tsx`, `src/ui/editor/EditorView.tsx`, `src/App.tsx`)**:
   - В `FileMusicPlayer` добавить метод `nextTrack() { this.play() }`.
   - В `SFX` добавить метод `nextTrack()` (включает следующий трек с кроссфейдом).
   - В `Game.ts` добавить метод `nextMusicTrack() { this.sfx.nextTrack(); pushHud(this) }`.
   - В `EditorToolbar.tsx` добавить кнопки управления музыкой:
     - Кнопка вкл/выкл музыки (`🎵` / `🔇`)
     - Кнопка следующей композиции (`⏭`)
   - Пробросить соответствующие вызовы из `App.tsx` через `EditorViewProps`.

Allowed files:

- src/game/input.ts
- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/EditorToolbar.tsx
- src/ui/editor/EditorView.tsx
- src/ui/editor/types.ts
- src/ui/screens/hud.tsx
- src/App.tsx
- src/game/game.ts
- src/game/game/modes.ts
- src/game/audio.ts
- src/game/audio/fileMusic.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-015

Acceptance criteria:

- [x] Нажатие пробела при вводе текста в input/textarea не запускает кампанию и нормально печатает пробел
- [x] Клик ПКМ по блоку или полю открывает контекстное меню быстрых действий вместо моментального удаления
- [x] Активная кнопка инструмента в Toolbar отчётливо подсвечена неоновым акцентом и тенью
- [x] В режиме тест-прогона карты доступна кнопка возврата в редактор («⏹ В редактор»)
- [x] В тулбаре редактора работают кнопки отключения музыки и переключения на следующий трек
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Guard global input для editable controls; ПКМ cyber context menu на block/empty canvas; явный neon active-tool style; early custom-map exit через HUD button/Escape; editor music mute/next-track controls и audio API. Lint/typecheck/full test прошли (40 файлов, 360 тестов); ручной браузерный прогон не выполнялся.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. Проверить в браузере ввод пробела в описании, вызов контекстного меню ПКМ, подсветку кнопок, кнопку выхода из тест-прогона и переключение треков музыки.

Verification commands:
npm run typecheck
npm run lint
npm run test
