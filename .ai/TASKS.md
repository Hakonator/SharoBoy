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
