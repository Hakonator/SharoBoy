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

Нет.

## Заблокировано

Нет.

---

## Последние выполненные задачи (подробные карточки)

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

### T-032: Фикс миноги по итогам ручной проверки

Status: done
Priority: high
Assigned to: none

Comment: Два дефекта. (1) Невидимые импульсы: снаряд создавался с флагом `bolt`,
который означает молнию медузы — её рисует только `drawJellyfishBoss`/`drawBolt`,
а `render/blocks.ts` такие блоки пропускает. Введён `Block.lampreyBolt` и рендер
`drawLampreyBolt` (ядро, ореол, зигзаг-хвост), собственные эффекты попадания в
`updateBombs`. (2) Голова исчезала, а минога продолжала двигаться и стрелять:
`stepLamprey` не проверял, жива ли голова, а `BossSystem.damage` через
`lampreyHeadExposed` пропускал урон «в пустоту» — бой становился непроходимым.
Теперь без головы минога стоит и не стреляет (`lampreyHeadAlive`), урон
заблокирован, через `HEAD_REGEN_TIME` (6 с) голова отрастает (`reviveLamprey`);
в рендере — кольцо реванша, линия тела начинается с первого живого сегмента.
`BossHost.bossState` даёт логике доступ к состоянию босса.
Проверки: typecheck чист, eslint 0, prettier чист, 70 файлов / 546 тестов.

Allowed files:

- src/game/bossLamprey.ts
- src/game/boss.ts
- src/game/types.ts
- src/game/render/boss.ts
- src/game/render/blocks.ts
- src/game/physics/destruction.ts
- src/game/game/hosts.ts
- тесты рядом с исходниками

Forbidden files:

- vite.config.ts
- tsconfig.json

Dependencies: T-031

Acceptance criteria:

- [x] Снаряд миноги виден на арене и эффект попадания отличим от бомб
- [x] После уничтожения головы босс не двигается и не стреляет
- [x] Урон по отбитой голове не снимает HP (бой остаётся проходимым)
- [x] Голова отрастает, бой продолжается
- [x] Все тесты, `typecheck`, `lint` и Prettier проходят

Test plan:
`src/game/bossCompanions.test.ts` (видимость снаряда, поведение без головы,
реванш), `src/game/game/bossDiagnostics.test.ts` (движковый сценарий «без
головы»).

Verification commands:
npm run typecheck
npm run lint
npm run test

---

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

---

## Выполнено ранее (архив)

Карточки удалены при чистке файла; подробности каждой задачи — в `.ai/STATE.md`
(раздел «Текущая фаза») и `memory-bank/progress.md`.

| Задача | Что сделано                                                                 |
| ------ | --------------------------------------------------------------------------- |
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
