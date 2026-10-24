# Active Tasks

# Active Tasks

## Приоритет: High

### T-031: Роадмап 1.2 — альтернативные боссы Актов I и II + углубление фаз + диагностика

Status: done
Priority: high
Assigned to: none

Comment: Реализовано. «Крио-Дрон Утилизатор» (`src/game/bossCryo.ts`) и
«Глубинная Электрическая Минога» (`src/game/bossLamprey.ts`) добавлены в пулы
`ACT_BOSS_POOLS` (Акт I: king/jellyfish/cryo, Акт II: octopus/crab/lamprey).
Оба поддерживаются трансляциями, «голосом» в эфире, SVG-иконками узлов карты,
рендером и диагностическим режимом (`spawnDebugBoss` + пункты панели «Отладка»,
как просил пользователь). Углубление фаз: `bossPhasesFor`/`bossPhases` +
`BossSystem.setPhases` — промежуточная фаза на поздних узлах Актов, при ≥2
мутаторах и высоком ранге, баннер «// ФАЗА II».
Проверки: `npm run typecheck` чист, `npx eslint src` 0 проблем, `npx prettier
--check src` чист, `npm run test` — 70 файлов / 544 теста.

Описание:
Закрыть пункт 1.2 дорожной карты: добавить альтернативных боссов Актов I и II,
углубить фазы боссов при высокой сложности/мутаторах и вывести новых боссов в
диагностический режим.

Allowed files:

- src/game/bossCryo.ts
- src/game/bossLamprey.ts
- src/game/boss.ts
- src/game/bossVariants.ts
- src/game/bossDialogs.ts
- src/game/audio.ts
- src/game/types.ts
- src/game/game/levelBuild.ts
- src/game/game/campaignFlow.ts
- src/game/game/debug.ts
- src/game/render/boss.ts
- src/ui/icons.tsx
- src/ui/screens/menuPanels.tsx
- src/ui/useDebugControls.ts
- тесты рядом с исходниками

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-030

Acceptance criteria:

- [x] Крио-Дрон и Электрическая Минога доступны как альтернативы в пулах Актов I и II
- [x] У боссов свои механики (лёд/турбины и сегментированное тело/разряды)
- [x] Фазы углубляются при высоком ранге сложности и мутаторах
- [x] Новые боссы доступны в диагностическом режиме (панель «Отладка»)
- [x] Все тесты, `typecheck`, `lint` и Prettier проходят

Test plan:
`src/game/bossCompanions.test.ts` (механики обоих боссов),
`src/game/game/bossDiagnostics.test.ts` (спавн всех боссов пулов в отладке),
`src/game/bossVariants.test.ts` (пулы и фазы).

Verification commands:
npm run typecheck
npm run lint
npm run test


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

Comment: Ревью пройдено успешно: ввод пробела изолирован, ПКМ контекстное меню открывается корректно, активный инструмент подсвечивается ярким неоном, кнопка выхода из тест-прогона («⏹ В редактор») работает и по клику, и по Escape, плеер музыки в тулбаре переключает треки. Все 360 тестов, typecheck, lint и production build успешны.

Comment: Guard global input для editable controls; ПКМ cyber context menu на block/empty canvas; явный neon active-tool style; early custom-map exit через HUD button/Escape; editor music mute/next-track controls и audio API. Lint/typecheck/full test прошли (40 файлов, 360 тестов); ручной браузерный прогон не выполнялся.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. Проверить в браузере ввод пробела в описании, вызов контекстного меню ПКМ, подсветку кнопок, кнопку выхода из тест-прогона и переключение треков музыки.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-017: Кольца брони на блоках, чистое перетаскивание и защита поля автора

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-011 реализовать три улучшения редактора карт:

1. **Отрисовка колец брони как в игровом режиме (`src/ui/editor/EditorCanvas.tsx`)**:
   - В функции `drawBlock` при наличии эффекта брони (`effects.find(e => e.kind === "armor")`) отрисовывать концентрические кольца брони ровно по той же формуле и визуалу, что и в `src/game/render/blockKinds.ts`:
     - `ringGap = Math.max(3.5, Math.min(rx, ry) * 0.1)`
     - Цикл по уровням брони (`i = 0` до `amount`) с обводкой `#080808` толщиной `Math.max(3, Math.min(rx, ry) * 0.14)` и цветными эллиптическими разделителями цвета тира блока (`TIER[tier].base`).
   - Кольца масштабируются и поворачиваются вместе с блоком (для круга — круглые, для эллипса — эллиптические).

2. **Скрытие исходного положения при перетаскивании (`src/ui/editor/EditorCanvas.tsx`)**:
   - Во время перетаскивания (одиночного блока через `dragPreview` или группы через `groupPreview`):
     - В `drawWorld` исключать из отрисовки блоки, находящиеся в процессе перемещения (`draggedBlockIds`).
     - Полностью удалить фоновый призрак со старого места (убрать `drawBlock(context, dragPreview.block, false, 0.22)`).
     - Отображать только перемещаемые превью-блоки на их актуальных координатах с привязкой к сетке.

3. **Синхронизация и защита поля «Автор» (`src/App.tsx`, `src/ui/editor/EditorView.tsx`, `src/ui/editor/EditorInspector.tsx`, `src/ui/editor/types.ts`)**:
   - В `App.tsx` передавать текущее имя игрока `playerNick={nick}` в `EditorView`.
   - В `EditorView.tsx`:
     - Синхронизировать метаданные карты: `author = playerNick?.trim() ? playerNick.trim() : "не указано"`.
   - В `EditorInspector.tsx`:
     - Отображать вычисленное имя автора.
     - Заблокировать поле для ручного ввода (`readOnly`, `disabled`, неактивный стиль `bg-abyss/40 opacity-75 cursor-not-allowed`).
     - Добавить поясняющую подсказку: _«Берётся из имени игрока на главной странице»_.

Allowed files:

- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/EditorInspector.tsx
- src/ui/editor/EditorView.tsx
- src/ui/editor/types.ts
- src/App.tsx
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-016

Acceptance criteria:

- [x] Блоки с броней в редакторе отображают внешние концентрические защитные кольца в соответствии с игровым стилем
- [x] Во время перетаскивания блока или группы исходное статичное положение блока полностью скрывается
- [x] В поле «Автор» автоматически подставляется имя игрока из главной страницы (или «не указано», если имя не задано)
- [x] Поле «Автор» в редакторе заблокировано для ручного редактирования
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Ревью пройдено успешно: кольца брони отрисовываются в точном соответствии с боевым игровым стилем (концентрические эллипсы/круги с темной обводкой и разделителями цвета тира), исходное положение блоков полностью скрывается при одиночном и групповом drag-and-drop перемещении, поле автора автоматически заполняется из ника игрока на главной странице (или "не указано") и заблокировано от ручного ввода. Все 360 тестов, typecheck, lint и production build успешны.

Comment: Добавлены armor rings по формулам игрового рендера, скрытие исходных блоков при drag-preview, синхронизация автора с nick игрока и read-only Inspector поле. `npm run lint`, `npm run typecheck` и полный test прошли; из-за известного flaky timeout `campaignMap.test.ts` полный suite подтверждён также в последовательном режиме `npm run test -- --maxWorkers=1` (40 файлов, 360 тестов). Ручной браузерный прогон не выполнялся.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. Проверить в браузере визуализацию брони кольцами, перетаскивание без старого призрака и отображение поля автора.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-018: Недочёты UX редактора карт (селектор блоков, маркеры при drag, визуал спецэффектов, слайдеры, шаг 5° и кнопки)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-012 устранить 6 недочётов редактора карт:

1. **Прямое переключение выделения блока при клике (`src/ui/editor/EditorCanvas.tsx`)**:
   - В `onPointerDown` исправить логику выбора блока: если кликнули по блоку без зажатия Shift/Ctrl и этот блок отличается от текущего выбранного (`!state.selectedBlockIds.includes(block.id)` или `state.selectedBlockIds.length !== 1 || state.selectedBlockIds[0] !== block.id`), немедленно вызывать `dispatch({ type: "SELECT_BLOCK", blockId: block.id })`.
   - Клик по любому другому блоку должен сразу переключать выбор на него без необходимости предварительно кликать по пустому месту.

2. **Следование маркеров трансформации за перемещаемым блоком (`src/ui/editor/EditorCanvas.tsx`)**:
   - При активном одиночном выделении (`selected.length === 1`) маркеры изменения размера, рукоятка поворота и кнопка клонирования `+` должны отрисовываться вокруг актуальных координат превью:
     - Если активен `dragPreview` (одиночный блок) — вокруг `dragPreview.position`.
     - Если активен `groupPreview` (групповое перемещение) — вокруг `{ x: selected[0].position.x + groupPreview.delta.x, y: selected[0].position.y + groupPreview.delta.y }`.
   - Значки не должны оставаться на старом месте, а должны плавно двигаться вместе с фантомом блока.

3. **Аутентичный визуал всех типов спецблоков (`src/ui/editor/EditorCanvas.tsx`)**:
   - В `drawBlock` добавить стилизованную отрисовку тел и оверлеев эффектов в соответствии с `src/game/render/blockKinds.ts`:
     - **Портал (`portal`)**: тёмно-фиолетовая градиентная заливка ядра (`#0b0518` / `#2a1244`) и аккреционные дуги вихря (`rgba(176,108,255,0.85)`).
     - **Пружина (`spring`)**: жёлто-золотое тело и выразительные дуги витков пружины (`quadraticCurveTo`).
     - **Вата (`cotton`)**: мягкое облачно-белое тело (`rgba(246,243,255,0.95)`) с внутренними светлыми волокнами/бликами.
     - **Магнит (`magnet`)**: U-образная подкова прямо на теле блока с полюсными наконечниками (красный/синий для притяжения, бирюзовый/голубой для отталкивания).
     - **Пульсация (`pulse`)**: концентрические радарные волны (`#7cf5ff`).
     - **Вращение (`spin`)**: круговые стрелки вращения на теле блока.

4. **Ползунки для абсолютно всех числовых полей инспектора (`src/ui/editor/EditorInspector.tsx`)**:
   - Встроить ползунок `<input type="range" />` в компонент `NumberField` (или снабдить каждый числовой параметр спаренным слайдером):
     - Очки брони (1..5)
     - Магнит: радиус (50..500) и сила (-5000..5000)
     - Пульсация: амплитуда (0.1..2) и частота (0.1..5)
     - Пружина / Вата: множитель скорости (0.1..3) и длительность (1..10)
     - Каждое числовое поле свойств блока должно иметь интерактивный ползунок под инпутом.

5. **Шаг 5° для поворота и округление параметров (`src/ui/editor/EditorInspector.tsx`)**:
   - Для угла поворота в градусах установить слайдер и числовое поле с шагом `step={5}`. Значение поворота в градусах строго округлять до ближайшего кратного 5 (`Math.round(deg / 5) * 5`).
   - Для ширины, высоты и целочисленных параметров (HP, броня, радиус, координаты) применять строгое округление до целых чисел (`Math.round`). Дробные параметры округлять до 1 знака после запятой.

6. **Фиксированные размеры и шрифты кнопок инструментов (`src/ui/editor/EditorToolbar.tsx`)**:
   - Задать кнопкам инструментов (Выбор, Добавить блок, Удалить) одинаковую фиксированную толщину границы (`border border-line`), одинаковый шрифт (`font-semibold`) и неизменные размеры.
   - При выборе инструмента менять **только** цветовую заливку (`bg-cyan-neon text-ink border-cyan-neon shadow-[0_0_12px_rgba(53,224,255,0.6)]`), устранив любое изменение ширины/высоты и шрифта кнопок.

Allowed files:

- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/EditorInspector.tsx
- src/ui/editor/EditorToolbar.tsx
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-017

Acceptance criteria:

- [x] Клик по другому блоку при уже выделенном блоке сразу делает его активным без промежуточных кликов
- [x] При перемещении блока маркеры трансформации (углы, поворот, плюс) двигаются вместе с блоком
- [x] Спецблоки (портал, пружина, вата, магнит, пульсация, вращение) визуально отображают характерные боевые эффекты на холсте
- [x] Все числовые свойства блока в инспекторе оснащены синхронизированными слайдерами
- [x] Поле поворота работает с шагом 5 градусов; ширина, высота и целые параметры округлены до целых
- [x] Кнопки инструментов в Toolbar сохраняют неизменный размер и шрифт при переключении
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Ревью пройдено успешно: прямое переключение кликом на любой блок работает мгновенно, маркеры трансформации и кнопка клонирования плавно следуют за перемещаемым блоком, спецблоки (порталы, пружины, вата, магниты, пульсация, вращение) получили аутентичный боевой визуал на холсте, все числовые параметры инспектора снабжены удобными слайдерами, угол поворота работает со строгим шагом 5° с нормализацией до целых, а кнопки тулбара сохраняют идеальную неизменную геометрию. Все 361 тест, typecheck, lint и production build успешны.

Comment: Исправлено прямое переключение single-select, маркеры transform теперь следуют preview-позиции, добавлены характерные Canvas-визуалы portal/spring/cotton/magnet/pulse/spin, NumberField получил синхронные range-слайдеры и нормализацию, tool-кнопки получили стабильные размеры/шрифт. Добавлен reducer-тест округления. Lint/typecheck/full test прошли (40 файлов, 361 тест); ручной браузерный прогон не выполнялся.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. В браузере проверить переключение кликом между блоками, следование маркеров при drag, внешний вид портала/пружины/ваты/магнита, ползунки во всех числовых полях, шаг 5° и неизменность кнопок тулбара.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-019: Вертикальные цифры на блоках и исключение паразитных дробей угла поворота

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-013 реализовать два улучшения визуализации и инспектора редактора карт:

1. **Исключение паразитных дробей при отображении поворота (`src/ui/editor/EditorInspector.tsx`)**:
   - В поле «Поворот (°)» передавать нормализованное целочисленное значение градусов, строго кратное шагу 5:
     `value={Math.round((((block.rotation ?? 0) * 180) / Math.PI) / 5) * 5}`.
   - В `NumberField` внутри `<input type="number" />` отображать `normalize(value)`, чтобы исключить появление чисел вроде `59.9999999` или `48.000000001` при любых пересчётах радиан.
   - Пользователь должен видеть исключительно чистые значения с шагом 5 (0, 5, 10, ...).

2. **Неизменно вертикальное положение цифр HP на блоке (`src/ui/editor/EditorCanvas.tsx`)**:
   - В функции `drawBlock` при отрисовке текста HP (`block.hp`) исключить вращение шрифта вместе с телом блока.
   - Перед выводом текста цифры HP выполнять локальный обратный поворот `context.rotate(-(block.rotation ?? 0))` (или восстанавливать контекст с нулевым углом вокруг центра блока `(0, 0)`).
   - Цифры HP на всех блоках должны всегда оставаться строго вертикальными относительно экрана при любых углах поворота блока.

Allowed files:

- src/ui/editor/EditorCanvas.tsx
- src/ui/editor/EditorInspector.tsx
- src/ui/editor/editorState.ts
- src/ui/editor/editorState.test.ts

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-018

Acceptance criteria:

- [x] При регулировке угла поворота ползунком и вводе с клавиатуры в поле отображаются только чистые целые числа, кратные 5° (без паразитных хвостов 59.9999999 или 48.0000001)
- [x] Цифры HP на повернутых блоках на холсте редактора всегда отрисовываются строго вертикально (не наклоняются и не переворачиваются)
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Ревью пройдено успешно: паразитные дроби угла поворота полностью исключены (в поле и на слайдере отображаются исключительно аккуратные числа с шагом 5°), цифры HP на всех блоках отрисовываются с компенсацией поворота и сохраняют строгую вертикальную ориентацию независимо от угла наклона блока. Все 362 теста, typecheck, lint и production build успешны.

Comment: Значение поворота в Inspector нормализовано до целого шага 5° и `NumberField` нормализует отображаемое значение перед выводом. HP-текст рисуется с обратным поворотом относительно блока и остаётся вертикальным. Добавлен тест для floating-point угла 59.999999999°. Lint/typecheck/full test прошли (40 файлов, 362 теста); ручной браузерный прогон не выполнялся.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. В браузере повернуть блок на произвольный угол слайдером и убедиться, что цифры HP в центре остаются строго вертикальными, а в поле поворота отображаются чистые числа с шагом 5°.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-020: Унификация формы и инверсия цвета кнопок инструментов Toolbar

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-014 восстановить единообразную аркадную геометрию и поведение кнопок инструментов в `src/ui/editor/EditorToolbar.tsx`:

1. **Единый базовый стиль `.btn-ghost` для кнопок выбора инструментов**:
   - И активная, и неактивная кнопки выбора инструмента («Выбор», «Добавить блок», «Удалить») используют идентичный класс:
     `btn-ghost flex items-center gap-2 px-3 py-2 text-xs`.
   - Полностью исключить `rounded-lg`, фиксированную высоту `h-10` и сторонние веса шрифта (`font-semibold`/`font-black`), чтобы обе кнопки сохраняли оригинальный аркадный скошенный полигональный контур (`clip-path: polygon(...)`) и шрифт Russo One.

2. **Инверсия цвета и заливка при выборе**:
   - При `state.activeTool === tool.id` менять **только** заливку и инвертировать цвет шрифта:
     ```tsx
     style={
       state.activeTool === tool.id
         ? {
             backgroundColor: "#35e0ff",
             color: "#04121c",
             borderColor: "#35e0ff",
             boxShadow: "0 0 16px rgba(53, 224, 255, 0.7)",
           }
         : undefined
     }
     ```
   - При деактивации кнопка возвращается к штатным цветам `.btn-ghost` без малейшего изменения формы, размеров или шрифта.

Allowed files:

- src/ui/editor/EditorToolbar.tsx

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-019

Acceptance criteria:

- [x] Кнопки «Выбор», «Добавить блок», «Удалить» имеют одинаковую аркадную полигональную форму (`.btn-ghost`) во всех состояниях
- [x] При переключении инструмента не меняются размеры, форма и шрифт кнопок
- [x] У выбранного инструмента меняется только заливка (голубой `#35e0ff`) и инвертируется цвет шрифта (темный `#04121c`)
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Ревью пройдено успешно: кнопки «Выбор», «Добавить блок», «Удалить» полностью сохраняют аутентичный аркадный полигональный силуэт со скошенными углами (.btn-ghost) и шрифт Russo One, не меняя размеры при переключении. При выборе активируется только голубая неоновая заливка с инверсией цвета текста на тёмный (#04121c). Все 362 теста, typecheck, lint и production build успешны.

Comment: Все tool-кнопки возвращены к единому `btn-ghost flex items-center gap-2 px-3 py-2 text-xs` без изменения геометрии, размеров и шрифта. Active-состояние задаёт только inline-заливку, инверсию текста, border и glow по AD-014. Lint/typecheck/full test прошли (40 файлов, 362 теста); ручной браузерный прогон не выполнялся.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. В браузере переключать инструменты в Toolbar и убедиться, что кнопки сохраняют аутентичный аркадный контур, не меняют размеры и шрифт, а меняют только заливку и цвет шрифта.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-021: Backend Supabase: миграции БД для кастомных карт и Edge Functions модерации/публикации

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-015 реализовать серверную часть экосистемы кастомных карт в Supabase:

1. **SQL-миграция БД (`supabase/migrations/20250101000008_create_custom_maps.sql`)**:
   - Создать таблицу `public.sharoboy_custom_maps` с полями:
     - `id uuid primary key default gen_random_uuid()`
     - `title text not null`
     - `description text default ''`
     - `author_nick text not null`
     - `spec_json jsonb not null`
     - `status text not null default 'pending'` (`pending`, `approved`, `rejected`)
     - `reject_reason text default null`
     - `likes_count integer not null default 0`
     - `plays_count integer not null default 0`
     - `created_at timestamptz not null default now()`
     - `updated_at timestamptz not null default now()`
   - Создать таблицу `public.sharoboy_map_votes`:
     - `id bigint generated always as identity primary key`
     - `map_id uuid not null references public.sharoboy_custom_maps(id) on delete cascade`
     - `voter_id text not null`
     - `created_at timestamptz not null default now()`
     - `unique (map_id, voter_id)`
   - Настроить RLS:
     - `public.sharoboy_custom_maps`: чтение разрешено для `anon` и `authenticated` ТОЛЬКО для `status = 'approved'`. Прямые `insert`, `update`, `delete` запрещены (выполняются только через Edge Functions от имени `service_role`).
     - `public.sharoboy_map_votes`: чтение/запись закрыты, управляются через Edge Functions.
   - Создать полезные индексы для выборок (по `status`, `likes_count desc`, `created_at desc`).

2. **Edge Function `maps` (`supabase/functions/maps/index.ts`)**:
   - `OPTIONS`: CORS preflight.
   - `POST /functions/v1/maps`: отправка карты пользователем:
     - Валидация ника и названия на длину и мат (используя `validateNick` / регулярные проверки).
     - Валидация структуры `spec_json` (проверка наличия необходимых полей `blocks`, `winCondition`).
     - Сохранение записи в `sharoboy_custom_maps` со статусом `pending`.
   - `GET /functions/v1/maps`: получение одобренных карт (`status = 'approved'`):
     - Параметры: `sort` (`popular` | `newest`), `search` (по title/author), `limit` (по умолчанию 20), `offset`.
   - `POST /functions/v1/maps/:id/vote`: постановка лайка с защитой от дублей по `voter_id`.
   - `POST /functions/v1/maps/:id/play`: атомарный инкремент `plays_count`.

3. **Edge Function `admin-maps` (`supabase/functions/admin-maps/index.ts`)**:
   - `POST /functions/v1/admin-maps/login`:
     - Сверка входящего пароля с секретом `ADMIN_SECRET_KEY` (или `SCORE_SECRET` в качестве fallback).
     - Генерация подписанного HMAC-SHA256 токена со сроком жизни 4 часа (`exp`).
   - Все остальные запросы проверяют заголовок `X-Admin-Token` на валидность HMAC подписи и expiration:
     - `GET /functions/v1/admin-maps?status=pending`: получение списка карт для модерации.
     - `POST /functions/v1/admin-maps/:id/approve`: перевод карты в `status = 'approved'`.
     - `POST /functions/v1/admin-maps/:id/reject`: перевод карты в `status = 'rejected'` с сохранением `reject_reason`.

4. **Тесты**:
   - Создать модульные тесты для хэширования/валидации токенов и логики API в `supabase/functions/maps/maps.test.ts` и `supabase/functions/admin-maps/admin.test.ts`.

Allowed files:

- supabase/migrations/20250101000008_create_custom_maps.sql
- supabase/functions/maps/*
- supabase/functions/admin-maps/*

Forbidden files:

- vite.config.ts
- tsconfig.json
- src/*

Dependencies: none

Acceptance criteria:

- [x] SQL-миграция корректно объявляет таблицы, ограничения, индексы и RLS-политики
- [x] Edge Function `maps` обрабатывает публикацию со статусом pending, каталог approved-карт, лайки и счетчик запусков
- [x] Edge Function `admin-maps` предоставляет защищённую авторизацию по токену и функции одобрения/отклонения
- [x] Тесты для функций в Supabase написаны и успешно выполняются
- [x] Код строго типизирован и не содержит уязвимостей (SQL injection, auth bypass)

Comment: Реализованы миграция custom maps/votes с RLS, безопасные RPC-инкременты, публичная Edge Function `maps` для публикации, каталога, лайков и запусков, а также `admin-maps` с HMAC-SHA256 токенами на 4 часа и approve/reject. Typecheck, lint, полный test (42 файла, 366 тестов) и целевые тесты Edge Functions прошли.

Verification commands:
npm run test

### T-022: Клиентское API кастомных карт и диалог публикации в Редакторе Карт (Этап M2)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-015 реализовать клиентский сервис работы с кастомными картами и интегрировать возможность отправки созданной карты на модерацию прямо из Редактора Карт:

1. **Клиентский API-модуль кастомных карт (`src/game/customMapsApi.ts`)**:
   - `publishCustomMap(payload: { title: string; description?: string; author_nick: string; spec: PlayerMapSpec })`: отправляет `POST` на `/functions/v1/maps`. Возвращает созданную запись или ошибку.
   - `fetchApprovedMaps(params?: { sort?: 'popular' | 'newest'; search?: string; limit?: number; offset?: number })`: отправляет `GET` на `/functions/v1/maps`.
   - `voteMap(mapId: string, voterId: string)`: отправляет `POST` на `/functions/v1/maps/${mapId}/vote`.
   - `recordMapPlay(mapId: string)`: отправляет `POST` на `/functions/v1/maps/${mapId}/play`.
   - Генерация стабильного анонимного `voterId` игрока в `localStorage` (если ещё не создан).
   - Обработка сетевых ошибок, статусов ответов и понятные сообщения об ошибках на русском языке.

2. **Диалог публикации в Редакторе Карт (`src/ui/editor/EditorPublishModal.tsx`)**:
   - Модальное окно, открываемое по кнопке «Опубликовать» в тулбаре редактора.
   - Поля ввода:
     - **Название карты** (2–60 символов, обязательное).
     - **Описание карты** (до 300 символов, опциональное).
     - **Автор** (read-only, автоматически берётся из ника игрока / метаданных карты).
   - Интеграция с `validateMapSpec`: перед отправкой карта валидируется на клиенте. Если есть ошибки (нет разрушаемых блоков, блоки в запретной зоне ракетки и т.д.), отображается понятный список ошибок с запретом отправки.
   - Индикация процесса отправки («Отправка на модерацию...»).
   - Успешный результат: красивое подтверждение «Карта отправлена на модерацию! Она появится в общем каталоге после проверки администратором».

3. **Интеграция в `EditorToolbar.tsx` и `EditorView.tsx`**:
   - Добавить кнопку «Опубликовать» (с иконкой 🚀 / стилем `.btn-arcade` или `.btn-ghost`) в `EditorToolbar.tsx`.
   - Связать состояние открытия модалки в `EditorView.tsx`.
   - Если Supabase не подключен (`!LEADERBOARD_ENABLED`), показывать подсказку о необходимости настройки подключения.

4. **Тесты**:
   - Написать юнит-тесты для `customMapsApi` в `src/game/customMapsApi.test.ts` с mock-ответами `fetch`.

Allowed files:

- src/config.ts
- src/game/customMapsApi.ts
- src/game/customMapsApi.test.ts
- src/ui/editor/EditorPublishModal.tsx
- src/ui/editor/EditorToolbar.tsx
- src/ui/editor/EditorView.tsx
- src/ui/editor/index.ts

Forbidden files:

- vite.config.ts
- tsconfig.json
- src/game/physics/*

Dependencies: T-021

Acceptance criteria:

- [x] Модуль `customMapsApi.ts` типизирован и корректно взаимодействует с Edge Function `maps`
- [x] Модалка публикации валидирует карту через `validateMapSpec` и блокирует публикацию невалидных карт
- [x] Ник автора синхронизируется и защищён от ручного редактирования
- [x] Ошибки profanity и длины названия информативно выводятся пользователю
- [x] Кнопка «Опубликовать» гармонично встроена в `EditorToolbar`
- [x] Тесты `customMapsApi.test.ts` проходят, typecheck и lint чистые

Comment: Реализованы клиентский API custom maps с таймаутами, обработкой HTTP/сетевых ошибок и стабильным anonymous voter ID; EditorPublishModal валидирует карту, название, описание и profanity; кнопка публикации интегрирована в EditorToolbar и блокируется без Supabase. Полный suite: 43 файла, 370 тестов.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. Проверить в юнит-тестах успешную публикацию, обработку ошибок валидации и сетевых ошибок.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-023: Каталог пользовательских карт сообщества в главном меню игры (Этап M3)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-015 реализовать витрину (Hub) одобренных пользовательских карт в пользовательском интерфейсе игры:

1. **Экран каталога карт сообщества (`src/ui/screens/communityMaps.tsx`)**:
   - Вход в каталог из главного меню (кнопка «Карты сообщества» в `src/ui/screens/menu.tsx` / `menuPanels.tsx`).
   - Панель управления и фильтрации:
     - Вкладки: **«Популярные»** (сортировка по лайкам), **«Новые»** (сортировка по дате создания).
     - Поле быстрого поиска по названию карты или автору.
     - Кнопка «Обновить» список.
   - Карточки карт:
     - Название, неизменяемый автор, дата создания, описание.
     - Индикаторы: количество блоков, условие победы (`all-destructible` или `targets`), счётчик запусков.
     - Кнопка лайка ❤️ с отображением текущего количества лайков (вызывает `voteMap(map.id, voterId)` и защищает от повторного нажатия).
     - Кнопка запуска **«Играть»** (запускает кастомный уровень через `Game.startCustomMap(map.spec_json)` и вызывает `recordMapPlay`).
   - Состояния пустого каталога, процесса загрузки со спиннером и ошибок сети с кнопкой «Повторить».

2. **Интеграция в App lifecycle (`src/ui/App.tsx`, `src/ui/types.ts`)**:
   - Регистрация экрана `community-maps` в типах экранов и роутере приложения.
   - Кнопка «Назад» для возврата в главное меню.
   - Запуск выбранной карты сообщества с корректным callback возврата в каталог после завершения раунда (победа/поражение).

3. **Тесты**:
   - Написать unit/UI-тесты для отображения каталога карт сообщества в `src/ui/screens/communityMaps.test.tsx`.

Allowed files:

- src/ui/screens/communityMaps.tsx
- src/ui/screens/communityMaps.test.tsx
- src/ui/screens/menu.tsx
- src/ui/screens/menuPanels.tsx
- src/App.tsx
- src/ui/screens/types.ts

Forbidden files:

- vite.config.ts
- tsconfig.json
- src/game/physics/*

Dependencies: T-022

Acceptance criteria:

- [x] Экран каталога карт доступен из главного меню игры
- [x] Карты отображаются в виде карточек с подробной информацией (название, автор, блоки, дата)
- [x] Работают вкладки сортировки («Популярные», «Новые») и поиск по названию/автору
- [x] Кнопка «Играть» запускает выбранную карту через `Game.startCustomMap` с возвратом в каталог
- [x] Кнопка лайка ставит отметку и защищена от повторных кликов через `localStorage`/voterId
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Добавлен экран `CommunityMaps` с каталогом, сортировкой, поиском, обновлением, loading/error/empty состояниями, карточками карт, лайками и запуском. Интеграция выполнена через фактический `src/App.tsx`; callback `Game.startCustomMap` возвращает игрока в каталог. Полный suite: 44 файла, 371 тест.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. Проверить рендер карточек карт и обработку кликов запуска и лайка.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-024: Админ-панель модерации кастомных карт (Этап M4)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-015 реализовать закрытый интерфейс модерации пользовательских карт для администратора:

1. **Клиентский API модерации (`src/game/adminMapsApi.ts`)**:
   - `adminLogin(password: string): Promise<string>` — отправляет запрос на `/functions/v1/admin-maps/login`, сохраняет полученный JWT токен в памяти/`sessionStorage` и возвращает его.
   - `fetchPendingMaps(token: string): Promise<CustomMapRecord[]>` — отправляет `GET` на `/functions/v1/admin-maps?status=pending` с заголовком `X-Admin-Token`.
   - `approveMap(token: string, mapId: string): Promise<void>` — отправляет `POST` на `/functions/v1/admin-maps/${mapId}/approve`.
   - `rejectMap(token: string, mapId: string, reason: string): Promise<void>` — отправляет `POST` на `/functions/v1/admin-maps/${mapId}/reject` с телом `{ reason }`.
   - `adminLogout(): void` — сброс сессии.

2. **Компонент Админ-панели (`src/ui/screens/AdminPanel.tsx`)**:
   - **Экран авторизации**: если админ не авторизован — форма ввода пароля с валидацией, индикацией ошибки при неверном пароле и кнопкой отмены (возврат в меню).
   - **Экран модерации**:
     - Список карт со статусом `pending` (название, автор, дата, описание, количество блоков, тип условия победы).
     - **Интерактивный предпросмотр**: отображение поля уровня через `EditorCanvas` в режиме `readOnly` (или масштабированный холст с блоками).
     - **Тест-драйв**: кнопка «Протестировать карту», запускающая уровень через `Game.startCustomMap` с возвратом в админку.
     - **Кнопка «Одобрить»**: публикует карту в общий каталог (`approved`).
     - **Кнопка «Отклонить»**: открывает модалку/поле ввода причины отклонения (например: «Мат в названии», «Непроходимый уровень», «Слишком мало блоков») и переводит в `rejected`.
     - Кнопка «Выйти» (logout) и «Назад в меню».

3. **Интеграция в приложение (`src/App.tsx`, `src/ui/screens/menu.tsx`)**:
   - Кнопка входа в панель модератора (скрытая или аккуратная ссылка/кнопка 🛡️ в футере меню/настройках).
   - Поддержка переключения на экран `admin` и возврата в меню/каталог.

4. **Тесты**:
   - Написать unit/UI-тесты для `adminMapsApi.test.ts` и `AdminPanel.test.tsx`.

Allowed files:

- src/game/adminMapsApi.ts
- src/game/adminMapsApi.test.ts
- src/ui/screens/AdminPanel.tsx
- src/ui/screens/AdminPanel.test.tsx
- src/ui/screens/menu.tsx
- src/App.tsx
- src/ui/screens/types.ts

Forbidden files:

- vite.config.ts
- tsconfig.json
- src/game/physics/*

Dependencies: T-023

Acceptance criteria:

- [x] Модуль `adminMapsApi.ts` покрыт тестами и корректно взаимодействует с Edge Function `admin-maps`
- [x] Форма авторизации запрашивает пароль, получает токен сессии и обрабатывает неверный ввод
- [x] В админ-панели выводится очередь карт на модерации с возможностью предпросмотра и тест-драйва
- [x] Карты успешно одобряются (переходят в `approved`) и отклоняются с указанием причины
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Добавлены `adminMapsApi.ts` с sessionStorage-сессией и обработкой login/list/approve/reject/logout, `AdminPanel.tsx` с авторизацией, pending-очередью, read-only предпросмотром, тест-драйвом, approve/reject и logout. Панель подключена к меню и `Game.startCustomMap`; после тест-драйва callback возвращает админку. Полный suite: 46 файлов, 376 тестов. Reject использует фактическое поле Edge Function `reject_reason`.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. Проверить в тестах авторизацию админа, список карт и вызовы approve/reject.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-025: Защита от дублей карт и воркфлоу внесения изменений (Этап M5)

Status: done
Priority: high
Assigned to: luna

Описание:
Согласно AD-017 реализовать защиту от дублирования карт на модерации и сквозной воркфлоу обновления опубликованных карт:

1. **SQL-миграция (`supabase/migrations/20250101000009_map_edit_workflow.sql`)**:
   - Добавить в таблицу `public.sharoboy_custom_maps`:
     - `map_uid text` (клиентский уникальный идентификатор проекта карты).
     - `edit_status text not null default 'none' check (edit_status in ('none', 'requested', 'approved'))`.
     - `edit_request_reason text default null`.
   - Индекс для предотвращения спама дубликатов с одинаковым названием от одного автора или одинаковым `map_uid` в статусе `pending`.

2. **Обновление Edge Functions (`maps` и `admin-maps`)**:
   - `POST /functions/v1/maps`:
     - Проверка на существующую карту с тем же названием/автором в статусе `pending` (возвращать 409: «Карта с таким названием уже находится на проверке у модератора»).
     - Запись `map_uid` при публикации.
   - `POST /functions/v1/maps/:id/request-edit`:
     - Запрос автора на редактирование опубликованной карты (`status = 'approved'`). Записывает `edit_status = 'requested'` и `edit_request_reason`.
   - `POST /functions/v1/admin-maps/:id/approve-edit`:
     - Модератор подтверждает возможность внесения изменений (`edit_status = 'approved'`).
   - `PUT /functions/v1/maps/:id/update-spec`:
     - Отправка обновлённого `spec_json` для карты в статусе `edit_status = 'approved'`. Сохраняет `likes_count` и `plays_count`, обновляет `spec_json` и переводит `edit_status` обратно в `'none'`.

3. **Обновление интерфейсов в игре**:
   - **`src/ui/editor/EditorPublishModal.tsx` & `EditorView.tsx`**:
     - Блокировка повторной отправки одной и той же карты (состояние «На проверке»).
     - Индикация статуса карты: если для карты модератором одобрено редактирование — отображать плашку **«🟢 Одобрено для внесения изменений»**.
     - Возможность подставить готовый JSON карты (кнопка в модалке / импорт JSON прямо в редактируемый проект).
     - Кнопка «Отправить обновление» вместо первичной публикации, если обновляется существующая карта.
   - **`src/ui/screens/communityMaps.tsx`**:
     - Для карт, автором которых является текущий игрок (`author_nick === currentNick`), показывать кнопку «Запросить изменение» с вводом причины.
   - **`src/ui/screens/AdminPanel.tsx`**:
     - Вкладка / секция модератора «Запросы на редактирование» с отображением причины и кнопкой «Одобрить редактирование».

4. **Тесты**:
   - Обновить юнит-тесты в `supabase/functions/maps/maps.test.ts`, `customMapsApi.test.ts`, `adminMapsApi.test.ts` и UI-тесты.

Allowed files:
Существующие файлы (модификация):

- supabase/functions/maps/index.ts
- supabase/functions/maps/maps.test.ts
- supabase/functions/admin-maps/index.ts
- supabase/functions/admin-maps/admin.test.ts
- src/game/customMapsApi.ts
- src/game/customMapsApi.test.ts
- src/game/adminMapsApi.ts
- src/game/adminMapsApi.test.ts
- src/ui/editor/EditorPublishModal.tsx
- src/ui/editor/EditorView.tsx
- src/ui/screens/communityMaps.tsx
- src/ui/screens/AdminPanel.tsx

Новые файлы (создание):

- supabase/migrations/20250101000009_map_edit_workflow.sql

Forbidden files:

- vite.config.ts
- tsconfig.json
- src/game/physics/*

Dependencies: T-024

Acceptance criteria:

- [x] Сервер отклоняет повторную отправку карты с тем же названием/UID от того же автора на модерацию (409)
- [x] Автор опубликованной карты может подать запрос на исправление с указанием причины
- [x] В админ-панели модератор видит запросы на изменение и может их одобрить
- [x] При одобрении правок в редакторе выводится статус «Одобрено для внесения изменений» и возможность обновить спеку (в т.ч. через вставку JSON)
- [x] Обновление сохраняет ID, статистику лайков и запусков карты
- [x] Все тесты (`npm run test`), `typecheck` и `lint` проходят без ошибок

Comment: Добавлена миграция `20250101000009_map_edit_workflow.sql` с map_uid/edit_status/edit_request_reason и partial unique indexes. Edge Functions получили анти-дубликаты, request-edit/update-spec и approve-edit. Клиентские API и UI поддерживают запросы правок, админскую очередь, статус «На проверке», approved-edit workflow, импорт JSON и обновление спеки с сохранением статистики. Полный suite: 46 файлов, 380 тестов.

Test plan:

1. Запустить `npm run test`, `npm run typecheck` и `npm run lint`.
2. Проверить в тестах отсечку дубликатов и жизненный цикл запроса на изменение.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-026: Постоянное расстояние между ярусами карты кампании (2 ширины узла)

Status: done
Priority: high
Assigned to: luna

Описание:
На экране смартфона узлы карты кампании слипались: полотно карты растягивалось под ширину экрана (фиксированный `min-w-[1300px]`), поэтому при 30 ярусах горизонтальный шаг составлял ≈44 px — меньше самой пиктограммы узла, иконки наезжали друг на друга, а рёбра превращались в неразличимый пучок.

Требование: зафиксировать расстояние между ярусами в **2 ширины узла** для любого режима экрана и вынести шаг в доменный слой, чтобы его нельзя было случайно «перетянуть» изменением ширины контейнера.

1. **Домен (`src/game/campaignMapLayout.ts`)**:
   - Константа `TIER_STEP_NODE_WIDTHS = 2` — шаг яруса в ширинах узла.
   - Функция `layoutTiers(perTier, nodes)`: все узлы яруса получают общую x-координату (колонку); шаг между колонками — `TIER_STEP_NODE_WIDTHS` ширин узла, по краям полотна остаётся по половине ширины узла.
   - Полотно в ширинах узла — `(tiers − 1) · STEP + 1`; координата `x` нормализуется на эту ширину (диапазон 0..2 при STEP = 2), `y` остаётся долей высоты (0..1).

2. **Контракт (`src/game/campaignMap.ts`)**:
   - `TIER_STEP_NODE_WIDTHS` в фасадном реэкспорте.
   - Обновлённое описание полей `CampaignNode.x/y` (как читать нормализованные координаты оверлею).

3. **Оверлей (`src/ui/screens/map.tsx`)**:
   - Убрать растягивание под экран (`min-w-[1300px]`); задать полотну явную ширину `(tiers − 1) · step + nodeWidth` px (`data-testid="campaign-map-canvas"`).
   - Шаг и ширина узла в px: 44 px / 88 px на мобильных, 48 px / 96 px от `sm`; синхронизация px-раскладки с Tailwind-классами — хуком на `matchMedia` (`SM_MIN_WIDTH = 640`).
   - Позиционировать узлы, рёбра SVG (`viewBox="0 0 <width> 100"`) и прицел текущего узла в px через `nodeX(x) = x * canvasWidth`; автоцентрирование камеры — по той же формуле вместо `scrollWidth`.
   - Горизонтальный скролл карты сохраняется: на узком экране видно 4–5 ярусов, шаг не сжимается.

4. **Тесты (`src/ui/screens/map.test.tsx`)**:
   - Ассерты позиционирования рамки перевести с `%` на px.
   - Новый тест постоянного шага: ширина полотна, отступ крайних колонок на полширины узла, единая x внутри яруса, шаг между соседними ярусами = 2 ширины узла.

Allowed files:

- src/game/campaignMapLayout.ts
- src/game/campaignMap.ts
- src/ui/screens/map.tsx
- src/ui/screens/map.test.tsx
- memory-bank/activeContext.md
- memory-bank/systemPatterns.md

Forbidden files:

- vite.config.js
- tsconfig.json
- src/game/game/*

Dependencies: none (опирается на готовый граф карты из T-Campaign-Bosses-Meta)

Acceptance criteria:

- [x] Шаг между ярусами равен 2 ширинам узла и не зависит от ширины экрана (88 px на мобильных, 96 px от `sm`)
- [x] Узлы одного яруса стоят в одной колонке, крайние колонки отступают от краёв полотна на полширины узла
- [x] Рёбра SVG и прицел текущего узла совпадают с центрами пиктограмм (px-координаты, не проценты)
- [x] Автоцентрирование камеры использует px-геометрию полотна
- [x] На узком экране карта скроллится по горизонтали без сжатия узлов
- [x] Структурные инварианты `campaignMap.test.ts` (60 сидов) проходят без правок
- [x] `npm run lint`, `npm run typecheck`, `npm run test` проходят без ошибок

Comment: Шаг вынесен в домен (`TIER_STEP_NODE_WIDTHS` + `layoutTiers`), оверлей переведён с процентов на px-геометрию полотна `(tiers − 1) · step + nodeWidth`, добавлен хук `useDesktopLayout` для синхронизации с брейкпоинтом `sm`. `npm run lint` (0 errors, 0 warnings), `npm run typecheck` и полный suite (65 файлов, 498 тестов) зелёные. Ручной браузерный прогон на смартфоне архитектором ещё не выполнен.

Test plan:

1. Запустить `npm run typecheck`, `npm run lint`, `npm run test`.
2. В тестах проверить: ширину полотна, отступ крайних ярусов, единую x внутри яруса и шаг = 2 ширины узла.
3. Вручную (десктоп + узкий вьюпорт смартфона) убедиться, что узлы не слипаются, рёбра соединяют центры, камера центрируется на текущем узле при перемещении и телепорте.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-030: Аудио-оформление сюжета станции «СФЕРА-1080» (roadmap 1.1)

Status: done
Priority: high
Assigned to: luna

Описание:
Пункт 1.1 роадмапа — сюжетные сцены станции шли без своего звука: трансляция
босса появлялась в HUD молча, финальный экран победы с раскрытием створок и
стравливанием крио-биогеля звучал обычным арпеджио `win()`, а смена фазы
финальных боссов (Кракен, Хронос) не озвучивалась вообще.

Требование роадмапа:

1. Радиопомехи и статика при старте входящей трансляции босса.
2. Звук раскрытия бронестворок и стравливания давления крио-биогеля на финальном экране победы.
3. Уникальные акценты фазовых атак финальных боссов (Кракен, Хронос).

Реализация (всё синтезом, без внешних файлов и пакетов):

1. **`src/game/audio.ts`** — пять новых методов `SFX`:
   - `transmission(kind)`: щелчок реле, наплыв статики (шумовой буфер), гетеродин
     из двух близких тонов (биения «рации») и хвост помех. Высота — из таблицы
     `TRANSMISSION_PITCH` (по одному значению на шесть боссов), поэтому у
     каждого свой голос в эфире.
   - `stationHatch()`: низкий разгон сервоприводов (сабвуферный слайд вверх),
     четыре металлических «зуба» скрипа створок и гул разгерметизации.
   - `gelVent()`: длинный выдох белого шума (1,5 с), свист сопла вниз 2400 → 420 Гц
     и пять ледяных «звонов» кристаллизующегося геля.
   - `bossPhase(kind)`: для `chrono` — «тик-так» (два металлических удара и
     восходящий шлейф), для остальных — гул бездны и обвал вниз.
   - `anomalyJump()`: разгон вверх, шумовой хлопок и низкий удар прибытия.

2. **Точки вызова**:
   - `src/game/game/campaignFlow.ts`: `sfx.transmission(...)` в `startLevelBattle`
     и в `startMapBattle` (узел босса); `sfx.anomalyJump()` вместо `power()`
     в событии-аномалии, если игрока перебросило на другой узел.
   - `src/game/game/runFlow.ts`: `stationHatch()` + `gelVent()` на переходе в
     `phase = "won"` (финальный босс побеждён).
   - `src/game/boss.ts`: `sfx.bossPhase(...)` при первом переходе в «злую» фазу;
     флаг `BossState.angryPhase` (`src/game/types.ts`) гарантирует однократность.

3. **Тесты**: `src/game/audioStory.test.ts` (11 тестов) + фейковый
   `AudioContext` в `src/game/audioStory.helpers.ts`, который записывает тип
   волны, частоту, слайд, задержку и пиковую громкость каждого осциллятора и
   шумового источника. `src/game/boss.test.ts`: акцент смены фазы срабатывает
   один раз и выбирается по виду босса.

Allowed files:

- src/game/audio.ts
- src/game/audioStory.helpers.ts
- src/game/audioStory.test.ts
- src/game/boss.ts
- src/game/boss.test.ts
- src/game/game/campaignFlow.ts
- src/game/game/runFlow.ts
- src/game/types.ts
- docs/ROADMAP.md
- docs/DEVELOPMENT.md
- memory-bank/activeContext.md
- memory-bank/systemPatterns.md

Forbidden files:

- vite.config.js
- tsconfig.json
- package.json

Dependencies: —

Acceptance criteria:

- [x] Входящая трансляция босса сопровождается радиопомехами и статикой
- [x] У Кракена и Хроноса разные голоса в эфире (таблица высот)
- [x] Победа над финальным боссом звучит раскрытием створок и стравливанием геля
- [x] Смена фазы финальных боссов озвучена своим акцентом и звучит один раз
- [x] Ничего не добавлено в `package.json` и в `public/` — только синтез
- [x] Звуки молчат при выключенных эффектах (`muted`)
- [x] `npm run lint`, `npm run typecheck`, `npm run test` проходят

Comment: Реализовано синтезом на существующем `SFX` (новых пакетов и файлов нет). Звуки подключены в `campaignFlow.ts` (трансляция, аномалия), `runFlow.ts` (эпилог) и `boss.ts` (фаза). Тесты: 11 новых на фейковом `AudioContext` + тест однократности акцента в `boss.test.ts`. Проверки: typecheck чист, eslint 0, тесты — 68 файлов / 520 тестов.

Test plan:

1. `npm run typecheck`, `npm run lint`, `npm run test`.
2. Запустить бой с любым боссом — в момент баннера трансляции слышны помехи.
3. Отладка: боссы Кракен и Хронос — разные акценты при переходе в «злую» фазу.
4. Убить финального босса карты — на экране победы звучат створки и выход геля.
5. Пройти узел-аномалию с телепортом — слышен гиперпрыжок.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-029: Справка по управлению под способ ввода (тач / десктоп)

Status: done
Priority: high
Assigned to: luna

Описание:
Во вкладке «Справка» главного меню список управления был единым для всех
устройств: на смартфоне игрок видел клавиши `A`/`D`, `ПРОБЕЛ`, `P`/`ESC`, `M`,
которых у него физически нет, а тач-жесты были описаны одной строкой вперемешку
с мышью («Мышь / палец — … клик — запуск (на таче: веди пальцем и отпусти)»).

Требование: на сенсорном устройстве описывать только его органы управления
(жесты пальцем), на десктопе — только мышь и клавиатуру.

1. **`src/ui/useTouchDevice.ts`** (новый хук):
   - Определяет способ ввода через `matchMedia("(pointer: coarse)")` — тот же
     сигнал, что использует игровой ввод (`Game.touchMode`), поэтому справка и
     реальное управление не расходятся.
   - Подписывается на `change` (гибридные устройства, подключение мыши).
   - SSR/тесты без `matchMedia` — безопасный `false`.

2. **`src/ui/icons.tsx`** — `ControlsPanel({ touch })`:
   - `TouchControls`: ведение пальцем → ракетка следует за пальцем; нажатие
     слева/справа у края ракетки → наклон; отпускание пальца → запуск шара и
     выстрел; второй палец → наводка прицела; пауза/звук/музыка — кнопками HUD,
     громкость — в настройках (⚙).
   - `KeyboardControls`: мышь + ЛКМ (запуск и захват указателя); `←`/`→` и
     `A`/`D`; `ПРОБЕЛ`; колесо (наводка прицела); `P`/`ESC` (пауза); `M`/`N`
     (звук и музыка).
   - Новая иконка `IconTouch` (палец) для тач-строк.

3. **`src/ui/screens/menu.tsx`**: хук `useTouchDevice()` + `<ControlsPanel touch={touchDevice} />`.

4. **Тесты**:
   - `src/ui/icons.test.tsx` (новый): оба режима — тач не содержит «ПРОБЕЛ»/«ЛКМ»/«ESC»/«КОЛЕСО»,
     десктоп не содержит «пальцем»/«2 ПАЛЬЦА».
   - `src/ui/screens/menu.test.tsx`: проверки справки для обоих способов ввода
     и доступность вкладки «Справка» при подменённом `matchMedia`.

Allowed files:

- src/ui/useTouchDevice.ts
- src/ui/icons.tsx
- src/ui/icons.test.tsx
- src/ui/screens/menu.tsx
- src/ui/screens/menu.test.tsx
- memory-bank/activeContext.md

Forbidden files:

- vite.config.js
- tsconfig.json
- src/game/game/*
- src/game/input.ts

Dependencies: T-028

Acceptance criteria:

- [x] На смартфоне в справке только тач-жесты, без клавиш и мыши
- [x] На десктопе в справке только мышь и клавиатура, без тач-жестов
- [x] Способ ввода определяется тем же признаком, что и в игровом вводе (`pointer: coarse`)
- [x] При смене указателя (подключение мыши к планшету) справка обновляется без перезагрузки
- [x] `npm run lint`, `npm run typecheck`, `npm run test` проходят без ошибок

Comment: Добавлен хук `useTouchDevice` (+ подписка на `matchMedia`), `ControlsPanel` разделён на `TouchControls` и `KeyboardControls`, добавлена иконка `IconTouch`. Тач-набор описывает ведение пальцем, зоны наклона у краёв ракетки, запуск отпусканием, второй палец для прицела и кнопки HUD/настройки; десктопный — ЛКМ с захватом указателя, стрелки/AD, ПРОБЕЛ, колесо, P/ESC, M/N. Проверки: typecheck чистый, eslint 0 проблем, тесты — 67 файлов / 508 тестов.

Test plan:

1. Запустить `npm run typecheck`, `npm run lint`, `npm run test`.
2. На смартфоне: Меню → Справка → «Управление» — только жесты пальцем.
3. На десктопе: те же вкладки — только мышь и клавиши.
4. В DevTools с эмуляцией тача (`(pointer: coarse)`) справка переключается без перезагрузки.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-028: Компактный мобильный дизайн главного меню

Status: done
Priority: high
Assigned to: luna

Описание:
На смартфоне главное меню разъезжалось: кнопки «Тестер карт» и «Редактор карт»
(`absolute left-4 top-4` / `top-16` в `src/App.tsx`) наезжали на название
«ШАРОБОЙ!», угловые контролы музыки/звука с ползунками лежали поверх шапки,
а крупные кнопки режимов и поле ника растягивали колонку в высоту.

Требование: на мобильном все элементы (название, режимы, ник, контролы звука и
настроек, инструменты автора) размещены компактно и без перекрытий; размеры
меньше «обычного» десктопного вида, но читаемые и аккуратные. Десктопный вид
(`sm`+ / `md`+) не меняется.

1. **`src/ui/screens/menu.tsx`**:
   - Контейнер: `gap-4 p-4 pt-16` на мобильном (`sm:gap-6 sm:p-6 sm:pt-20`) —
     верхний отступ освобождает место под угловые контролы.
   - Заголовок: `text-5xl` на мобильном (`sm:text-7xl lg:text-8xl` сохраняются).
   - Левая колонка: `w-full max-w-xl` на мобильном (`md:w-auto md:max-w-xl`) —
     кнопки и ник больше не съезжают и не обрезаются.
   - Кнопки режимов компактнее: «Кампания» `px-4 py-2.5 text-sm sm:px-7 sm:py-3.5 sm:text-lg`,
     ghost-кнопки `px-3 py-2.5 text-xs sm:px-5 sm:py-3.5 sm:text-base`, чип «Рекорд»
     и строка «Панель модерации» (`text-[11px]`) тоже меньше.
   - Поле ника: чип `p-2`, input `h-8` на мобильном (`sm:p-2.5`, `sm:h-9`).

2. **`src/ui/screens/menuPanels.tsx`** — контролы в углу:
   - Кнопки `h-8 w-8` на мобильном (`sm:h-10 sm:w-10`), иконки `h-4 w-4` (`sm:h-5 sm:w-5`).
   - Ползунки громкости скрыты на смартфоне (`hidden sm:block`) — их дублирует
     модалка настроек, а в шапке они отнимали ~120 px ширины.

3. **`src/ui/icons.tsx`**: `IconMusic` / `IconSound` адаптивные — `h-4 w-4 sm:h-5 sm:w-5`.

4. **`src/App.tsx`** — инструменты автора:
   - Две кнопки объединены в общий контейнер `absolute left-3 top-3` →
     `sm:left-6 sm:top-6 sm:flex-col sm:gap-3`: на смартфоне они стоят в один ряд
     (`px-2 py-1.5 text-[11px]`), от `sm` — прежняя вертикальная стопка.

5. **Тесты (`src/ui/screens/menu.test.tsx`)**: три новых теста мобильного
   колонтитула — отступ `pt-16` под угловые контролы, `w-full max-w-xl shrink-0 md:w-auto`,
   компактные размеры кнопок и заголовка (`text-5xl`), скрытые ползунки
   (`vol-slider ... hidden sm:block`) и кнопки 32 px.

Allowed files:

- src/ui/screens/menu.tsx
- src/ui/screens/menuPanels.tsx
- src/ui/screens/menu.test.tsx
- src/ui/icons.tsx
- src/App.tsx
- memory-bank/activeContext.md

Forbidden files:

- vite.config.js
- tsconfig.json
- src/game/game/*

Dependencies: T-027

Acceptance criteria:

- [x] «Тестер карт» и «Редактор карт» не перекрывают название «ШАРОБОЙ!» ни на одной ширине экрана
- [x] Угловые контролы музыки/звука/настроек не наезжают на текст (верхний отступ `pt-16`)
- [x] Кнопки режимов, ник и контролы на смартфоне меньше десктопных, но читаемы
- [x] Высота мобильного блока меню сокращена (меньше заголовок, отступы, чипы)
- [x] Десктопный вид (`sm`+ / `md`+) не изменился
- [x] `npm run lint`, `npm run typecheck`, `npm run test` проходят без ошибок

Comment: Название уменьшено до `text-5xl` на мобильном, под шапку добавлен `pt-16`; кнопки режимов и ник ужаты (`sm:`-варианты сохраняют прежний вид), ползунки громкости на смартфоне скрыты (доступны в настройках), «Тестер карт»/«Редактор карт» собраны в один компактный ряд слева сверху вместо вертикальной стопки поверх логотипа. Проверки: lint 0/0, typecheck чистый, test — 66 файлов / 503 теста; сборка содержит все новые утилиты (`text-5xl`, `pt-16`, `sm:pt-20`, `md:w-auto`, `text-[11px]`, `sm:block`, `sm:h-10`).

Test plan:

1. Запустить `npm run typecheck`, `npm run lint`, `npm run test`.
2. Открыть меню на узком вьюпорте (360–430 px): название, кнопки, ник и угловые иконки не пересекаются, вертикального «раздувания» нет.
3. Проверить `sm`/`md`/`lg`: прежняя компоновка и ползунки громкости на месте.

Verification commands:
npm run typecheck
npm run lint
npm run test

### T-027: Прокрутка главного меню пальцем на смартфоне

Status: done
Priority: high
Assigned to: luna

Описание:
На смартфоне главное меню не прокручивалось свайпом: страницу нельзя было
«протянуть» пальцем ни в пустой области, ни на нижнем дашборде с табами.

Причины (две и обе блокировали цепочку прокрутки):

1. `body { touch-action: none }` в `src/index.css` отключает прокрутку пальцем
   во всём документе (это нужно игре, чтобы жесты браузера не мешали шару).
   У контейнера страницы меню (`overflow-y-auto`) не было обратного разрешения
   `touch-action: pan-y`, поэтому свайп по нему игнорировался.
2. Панель активного таба имела собственный скролл фиксированной высоты
   (`h-[360px] sm:h-[400px]`) с `overscroll-behavior: contain` (класс
   `.arcade-scrollbar`). Такой скролл перехватывает палец и запрещает передачу
   прокрутки родителю — по нижнему блоку меню нельзя было прокрутить страницу.

Требование: на любом участке меню свайп пальцем прокручивает страницу; на
десктопе поведение не меняется (панель табов — внутренний слайдер, окно не
скроллится).

1. **`src/index.css`**:
   - Новый класс `.page-scroll` — `touch-action: pan-y` +
     `-webkit-overflow-scrolling: touch` для контейнеров прокрутки страниц.
   - Из `.arcade-scrollbar` убрать `touch-action: pan-y` и
     `overscroll-behavior: contain`: класс отвечает только за вид неонового
     слайдера, а прокруткой управляет контейнер.

2. **`src/ui/screens/menu.tsx`**:
   - Корень меню получает `page-scroll`.
   - Панель активного таба: на мобильном растёт по контенту и скроллится вместе
     со страницей; внутренний скролл фиксированной высоты — только от `md`
     (`md:flex-1 md:min-h-0 md:overflow-y-auto md:h-[450px]`).

3. **Тесты (`src/ui/screens/menu.test.tsx`, новый файл)**:
   - Контейнер меню содержит `page-scroll` (иначе свайп не работает из-за
     `body { touch-action: none }`).
   - Панель табов содержит `md:overflow-y-auto` и не содержит мобильных
     фиксированных высот `h-[360px]`/`h-[400px]`.

Allowed files:

- src/index.css
- src/ui/screens/menu.tsx
- src/ui/screens/menu.test.tsx
- memory-bank/activeContext.md

Forbidden files:

- vite.config.js
- tsconfig.json
- src/game/game/*

Dependencies: none

Acceptance criteria:

- [x] Свайп пальцем прокручивает меню в любой его области (включая нижний блок с вкладками)
- [x] У контейнера страницы меню разрешён вертикальный жест (`touch-action: pan-y`)
- [x] Вложенный скролл панели табов на мобильном не перехватывает жест (`overscroll-behavior: contain` убран)
- [x] Десктопное поведение сохранено: панель табов — внутренний слайдер, окно не скроллится
- [x] `npm run lint`, `npm run typecheck`, `npm run test` проходят без ошибок

Comment: Добавлен класс `.page-scroll` (`touch-action: pan-y`), подключён к корню меню; у `.arcade-scrollbar` убраны `touch-action`/`overscroll-behavior`. Панель табов переведена на `md:`-варианты скролла с фиксированной высотой только для десктопа. Новый `menu.test.tsx` (2 теста). Проверки: lint 0/0, typecheck чистый, test — 66 файлов / 500 тестов; `npm run build` подтверждает наличие `.page-scroll` и `md:overflow-y-auto` в CSS.

Test plan:

1. Запустить `npm run typecheck`, `npm run lint`, `npm run test`.
2. На смартфоне: свайп по пустой области меню, по табам и по содержимому активной вкладки прокручивает страницу до самого низа.
3. На десктопе: окно не скроллится, панель табов имеет свой слайдер заданной высоты.

Verification commands:
npm run typecheck
npm run lint
npm run test
