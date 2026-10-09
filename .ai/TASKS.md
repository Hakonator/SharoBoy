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

\n
