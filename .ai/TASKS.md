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
Assigned to: Luna

Comment: Реализован Dev Sandbox: JSON editor, структурная проверка, отображение ошибок валидатора и запуск карты через Game.startCustomMap; callback возвращает в тестер. Typecheck, lint, test и production build проходят.

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
