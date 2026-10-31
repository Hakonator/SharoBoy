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

Очередь зафиксирована 31.10.2026 (план «геймплейное разнообразие» T-052…T-061).
Все карточки в статусе `draft`: реализация начинается после утверждения пользователем
и перевода карточки в `ready` (AD-027, п. 3). Порядок — волнами; внутри волны задачи
независимы. Если по ходу выяснятся побочные правки, под них заводится промежуточная
карточка вида `T-0XXa` (не расширяя исходную).

Порядок исполнения:

- **Волна 1 (P0, все S):** T-052 → T-053 → T-054 → T-055.
- **Волна 2 (P1, M):** T-056 (после T-052) → T-057 → T-058 → T-059.
- **Волна 3 (P2, L):** T-060 → T-061.

Общий пакет проверок для каждой задачи:
`npm run typecheck` → `npm run lint:check` → `npm run format:check` → `npm run test`.
Общие запреты: `vite.config.ts`, `tsconfig.json`, `package.json`, `supabase/**`, `.github/**`.

### T-052: Мутаторы кампании 6 → 10

Status: draft · Priority: high · Сложность: S · Зависимости: — · Волна 1

Описание:
Пул `CampaignModifierId` расширяется четырьмя правилами — вариативность растёт сразу в трёх
режимах, потому что кампания, ежедневное испытание и бесконечный режим читают
`g.campaignModifiers` через `hasModifier` (`levelBuild.ts`, `hosts.ts`, `runFlow.ts`).

1. `no_powers` «Сухой закон»: бонусы не выпадают (`powers.ts::dropPower`, `periodicPowerDrop`),
   не летят «спас-бонусы» из `runFlow.ts` и отрицательные дропы босса (`boss.ts`); +45% к очкам
   и кристаллам.
2. `brittle_world` «Хрупкий мир»: после сборки боя все обычные блоки получают `sp.brittle`
   с радиусом по умолчанию — по образцу `dense_armor` в `game/levelBuild.ts`.
3. `low_bounce` «Вязкая бездна»: вертикальный отскок от ракетки и потолка ×0.8
   (`physics/collide.ts`); +25% к очкам.
4. `boss_fury` «Ярость бездны»: интервал бомб `bombEvery` ×0.7 (`boss.ts`), +35% к очкам.
5. Эпоха пула: `MODIFIER_POOL_EPOCH` (дата релиза UTC) в `campaignModifiers.ts`, чтобы
   daily-наборы для дат до эпохи не пересчитывались (`daily.ts::getDailyModifiers`).

Allowed files:

- src/game/campaignModifiers.ts
- src/game/campaignModifiers.test.ts
- src/game/daily.ts
- src/game/daily.test.ts
- src/game/powers.ts
- src/game/powers/table.ts
- src/game/game/levelBuild.ts
- src/game/physics/collide.ts
- src/game/boss.ts
- src/ui/screens/hud.tsx
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] 4 новых мутатора доступны в выборе, в HUD-бейджах и в daily-пуле
- [ ] каждый эффект покрыт юнит-тестом (множители, дроп бонусов, хрупкость, интервал бомб)
- [ ] daily-набор для дат до `MODIFIER_POOL_EPOCH` не меняется (тест)
- [ ] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-053: Челлендж-узлы 4 → 7 видов

Status: draft · Priority: high · Сложность: S · Зависимости: — · Волна 1

Описание:
В `ChallengeKind` добавляются три вида: `power_hunter` («собрать N бонусов»), `chain_master`
(«вызвать N цепных детонаций»), `armor_breaker` («снять N единиц брони»). Механика узлов,
награды и HUD-плашка уже есть — нужны новые условия и хуки.

1. `createCampaignChallenge`: расширить пул видов, задать титулы/описания и `targetValue`
   с масштабированием по ярусу; награды — по текущей формуле.
2. Новые фиксаторы прогресса по образцу `recordChallengeCrit`: `recordChallengePower`,
   `recordChallengeChain`, `recordChallengeArmor`.
3. Точки вызова: подбор бонуса и урон по броне в `game/hosts.ts`, цепная детонация в
   `physics/spark.ts` / `physics/destruction.ts`.
4. `updateActiveChallenge` и `formatChallengeHud` — статусы новых видов; провал по потере
   шара (`recordChallengeBallLost`) остаётся только у `flawless`/`survive_time`.

Allowed files:

- src/game/campaignChallenges.ts
- src/game/campaignChallenges.test.ts
- src/game/game/hosts.ts
- src/game/physics/spark.ts
- src/game/physics/destruction.ts
- src/game/campaignMapLayout.ts
- src/ui/screens/hud.tsx
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] новые виды детерминированно появляются по сиду узла (тест на выбор и на прогресс)
- [ ] каждый вид можно завершить и провалить в юнит-тесте
- [ ] награды начисляются ровно один раз за узел
- [ ] существующие 4 вида ведут себя как раньше

### T-054: «Последний рубеж» боссов

Status: draft · Priority: high · Сложность: S · Зависимости: — · Волна 1

Описание:
При падении HP босса ниже порога он один раз за бой входит в «последний рубеж»: бомбы чаще,
на орбите появляется подкрепление, включаются баннер и кольца. Сейчас у боссов есть только
`angryAt`, поэтому конец боя «вянет».

1. `BossVariant` и `KIND_DEFAULTS` (`bossVariants.ts`): поле `lastStandAt` (по умолчанию 0.12)
   с корректировкой для фазовых боссов.
2. `BossState` (`types.ts`): флаг `lastStand`; срабатывание в `boss.ts` рядом с логикой
   `angryAt`, интервал бомб ×0.6, `+2` миньона при наличии орбиты.
3. Оповещение: баннер и кольца через `hudSync.ts`, звук `sfx.power()`.
4. Боссы без бомб и миньонов получают только визуальный сигнал — без изменения баланса.

Allowed files:

- src/game/bossVariants.ts
- src/game/bossVariants.test.ts
- src/game/types.ts
- src/game/boss.ts
- src/game/boss.test.ts
- src/game/game/hudSync.ts
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] «последний рубеж» срабатывает ровно один раз за бой (тест на повторный вызов)
- [ ] не конфликтует с промежуточной фазой (`phases > 1`) и с агрессией
- [ ] боссы без бомб получают только визуальный сигнал
- [ ] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-055: Ранг сектора S / A / B

Status: draft · Priority: medium · Сложность: S · Зависимости: — · Волна 1

Описание:
Чистая функция ранга по статистике сектора (время, потерянные шары, максимальное комбо) и
бонус кристаллов за высокий ранг. Ранг показывается в окне промежуточного счёта.

1. `scoreBreakdown.ts`: `computeSectorRank({ timeSeconds, par, lostBall, maxCombo })`
   → `"S" | "A" | "B" | null`. S — без потерь, время ≤ par, комбо ≥ 8; A — без потерь и
   ≤ 1.25 × par; B — победа в остальных случаях; `null` при поражении.
2. `game/runFlow.ts`: ранг попадает в `g.intermediateScore`, бонус кристаллов начисляется
   один раз (S +4, A +2).
3. `ui/screens/overlays.tsx`: бейдж ранга и строка в детализации очков.

Allowed files:

- src/game/scoreBreakdown.ts
- src/game/scoreBreakdown.test.ts
- src/game/game/runFlow.ts
- src/game/types.ts
- src/ui/screens/overlays.tsx
- src/ui/screens/overlays.test.tsx
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] ранг детерминирован от статистики сектора, границы покрыты тестами
- [ ] бонус кристаллов начисляется ровно один раз
- [ ] на поражении ранг не показывается
- [ ] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-056: Бесконечный режим — драфт мутаторов каждые 5 волн

Status: draft · Priority: high · Сложность: M · Зависимости: T-052 · Волна 2

Описание:
Бесконечный режим сейчас только наращивает скорость и HP. После каждой 5-й (боссовой) волны
игрок выбирает 1 из 3 мутаторов; выбранные накапливаются (максимум 3) и живут до конца забега.

1. Новый чистый модуль `src/game/endlessDraft.ts`: `rollDraftOptions(seed, wave, taken)` —
   3 разных мутатора детерминированно от сида дня и номера волны; `applyDraftPick` возвращает
   обновлённый список.
2. `game/runFlow.ts::advanceEndlessWave`: на волнах, кратных 5, сначала открывается драфт,
   затем `buildWave` — без изменения порядка подачи шара.
3. Выбранные мутаторы пишутся в `g.campaignModifiers`, чтобы все существующие `hasModifier`-
   проверки работали без правок; HUD-бейджи мутаторов уже рисуются (`hud.tsx`).
4. Новая модалка `src/ui/screens/WaveDraftModal.tsx` по образцу `DailyRunModal`, показ через
   `App.tsx`/`hud` состоянием в `HudData`.

Allowed files:

- src/game/endlessDraft.ts
- src/game/endlessDraft.test.ts
- src/game/game/runFlow.ts
- src/game/types.ts
- src/ui/screens/WaveDraftModal.tsx
- src/ui/screens/WaveDraftModal.test.tsx
- src/ui/screens.tsx
- src/ui/screens/hud.tsx
- src/game/game/hudSync.ts
- src/App.tsx
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] драфт наступает только на волнах 5, 10, 15…; опции детерминированы сидом и волной
- [ ] уже взятый мутатор не предлагается повторно; максимум 3 за забег
- [ ] выбранный мутатор реально влияет на бой (тест через `hasModifier`)
- [ ] драфт **не** попадает в `computeRunMultipliers` (рекорды остаются сравнимыми)
- [ ] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-057: Третья волна реликвий и синергий (8 → 10, 6 → 7)

Status: draft · Priority: medium · Сложность: M · Зависимости: — · Волна 2

Описание:
Две реликвии и одна синергия на уже готовом движке (AD-028 + AD-033: детекторы считаются по
требованию, новых подсистем не требуется).

1. Реликвии: `relic_kindle` «Тлеющий фитиль» (при комбо ≥ 5 включает огненный шар на 3 с) и
   `relic_anchor` «Глубинный якорь» (на последней жизни шар замедляется на 15%).
2. Синергия `thermal_lance` («Термокопьё»): `pierce` + `fire` — пробивание оставляет огненный
   след с уроном 1 в радиусе 40 px на 1.5 с.
3. Магазин: новые позиции в `campaignShop.ts` с проверкой «УЖЕ АКТИВНА»; цены — 42 и 48 💎.
4. `campaignRelics.ts` (`CampaignRelicId`, `CAMPAIGN_RELICS_META`, `RELIC_ID_TO_KEY`),
   детектор и метаданные в `synergies.ts`, эффекты в `physics/collide.ts` и `game/hosts.ts`.

Allowed files:

- src/game/campaignRelics.ts
- src/game/campaignRelics.test.ts
- src/game/campaignShop.ts
- src/game/synergies.ts
- src/game/synergies.test.ts
- src/game/physics/collide.ts
- src/game/physics/collide.test.ts
- src/game/game/hosts.ts
- src/ui/screens/hud.tsx
- src/ui/screens/hud.test.tsx
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/DECISIONS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] реликвии покупаются ровно один раз и видны на карте и в HUD
- [ ] синергия появляется в HUD-бейджах и срабатывает только при обоих ингредиентах (тест)
- [ ] боевые эффекты покрыты тестами (включая взаимодействие с существующими синергиями)
- [ ] балансовые числа зафиксированы в карточке и в CHANGELOG

### T-058: Минибоссы 2 → 4

Status: draft · Priority: medium · Сложность: M · Зависимости: — · Волна 2

Описание:
К «Рыбе-шару» и «Медузе» добавляются двое: «Панцирный краб» (тело с вращающимся слабым
местом) и «Скользкий угорь» (двигается по горизонтали рывками). Появление, pity-система и
награда за уничтожение остаются прежними.

1. `minibosses.ts`: новые значения `MinibossKind`, HP-кривая по ярусу, поведение (угол слабого
   места у краба, тайминг рывков у угря) — чистыми функциями.
2. Спавн и рантайм: `game/runFlow.ts` / `game/minibossRuntime.ts` (позиция, движение, урон в
   пул HP), шанс дуэта и pity не меняются.
3. Рендер: силуэты существ в соответствующем модуле `src/game/render/` по образцу текущих.
4. HUD-полоска HP и дроп жизни (`MINIBOSS_LIFE_CHANCE`) работают без изменений.

Allowed files:

- src/game/minibosses.ts
- src/game/minibosses.test.ts
- src/game/game/minibossRuntime.ts
- src/game/game/minibossRuntime.test.ts
- src/game/render/
- src/game/types.ts
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] новые существа появляются с той же частотой, что и старые (детерминированный тест)
- [ ] урон идёт в пул HP существа, уничтожение даёт жизнь по прежнему шансу
- [ ] поведение (слабое место / рывки) проверено юнит-тестами
- [ ] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-059: Ежедневные задания (bounties)

Status: draft · Priority: medium · Сложность: M · Зависимости: — (желательно после T-052) · Волна 2

Описание:
Три задания дня из пула («разбить N бронированных блоков», «N крит-сэйвов», «N цепных
каскадов», «победить босса», «собрать N бонусов»). Прогресс считается в любом режиме и
хранится локально, награда — мета-кристаллы, один раз за день.

1. Новый чистый модуль `src/game/dailyQuests.ts`: `getDailyQuests(date)` детерминированно от
   сида дня, `recordQuestProgress(date, stats)`, `claimDailyQuestReward(date)`.
2. Хранение — localStorage по дате (паттерн `achievements.ts`: загрузка/сохранение с
   защитой от приватного режима).
3. Интеграция счётчиков: `game/hudSync.ts` (инкременты из боевых событий), UI — блок
   «Задания дня» в `MenuScreen` и в `DailyRunModal`.
4. Экономика: награда 1–3 мета-кристалла за задание, выдача строго один раз за дату.

Allowed files:

- src/game/dailyQuests.ts
- src/game/dailyQuests.test.ts
- src/game/daily.ts
- src/game/daily.test.ts
- src/game/game/hudSync.ts
- src/ui/screens/MenuScreen.tsx
- src/ui/screens/MenuScreen.test.tsx
- src/ui/screens/DailyRunModal.tsx
- src/ui/screens/DailyRunModal.test.tsx
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] задания дня детерминированы по дате и не меняются в течение суток UTC
- [ ] прогресс не сбрасывается между сессиями и не дублируется
- [ ] награда выдаётся ровно один раз за дату (тест)
- [ ] задания не влияют на таблицы рекордов

### T-060: Ракетка с заряженным отскоком

Status: draft · Priority: low · Сложность: L · Зависимости: — · Волна 3

Описание:
Удержание ввода (мышь, палец, пробел на десктопе) заряжает ракетку за 0.6 с, отпускание даёт
шару импульс вдоль нормали (+18% скорости) и короткий рывок платформы. Механика добавляет
«активное» измерение в управление, не ломая базовую подачу и лазер.

1. `input.ts`: состояние `charge` (0…1) и события начала/конца удержания. Лазер и подача шара
   сохраняют текущий приоритет: заряд работает только когда шар в полёте.
2. `game/paddleControl.ts`: расчёт заряда и импульса; `physics.ts`: применение импульса через
   существующий механизм отскока, без новых сущностей.
3. `render/paddle.ts`: индикатор заряда на платформе; `ui/screens/hud.tsx`: краткая подсказка
   при первом появлении механики.
4. `settings.ts` + `SettingsModal`: переключатель «Заряженный отскок» (по умолчанию включён),
   чтобы консервативное управление оставалось доступным.

Allowed files:

- src/game/input.ts
- src/game/input.test.ts
- src/game/game/paddleControl.ts
- src/game/physics.ts
- src/game/physics.test.ts
- src/game/render/paddle.ts
- src/game/render/paddle.test.ts
- src/game/settings.ts
- src/game/settings.test.ts
- src/ui/screens/SettingsModal.tsx
- src/ui/screens/hud.tsx
- src/game/types.ts
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/DECISIONS.md
- .ai/STATE.md
- memory-bank/systemPatterns.md
- memory-bank/activeContext.md

Приёмка:

- [ ] заряд не мешает подаче шара, лазеру и pointer lock (тесты на приоритеты ввода)
- [ ] на мобильных быстрый тап работает как раньше; заряд требует удержания > 0.2 с
- [ ] настройка отключает механику полностью, включая индикатор
- [ ] архитектурное решение по вводу зафиксировано в `.ai/DECISIONS.md` (новый AD)
- [ ] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-061: Мутатор `dark_arena` («Слепой сектор»)

Status: draft · Priority: low · Сложность: L · Зависимости: — (желательно после T-052) · Волна 3

Описание:
Новый мутатор ограничивает видимость: поле затемнено, кроме круга вокруг шара и ракетки
(радиус 260 px). Работает во всех режимах как обычный мутатор и попадает в daily-пул.

1. `campaignModifiers.ts`: id `dark_arena`, заголовок «Слепой сектор», множители +50% к очкам
   и кристаллам; подсказка в выборе мутаторов.
2. Новый рендер-модуль `src/game/render/darkArena.ts`: затемнение с двумя «вырезанными»
   кругами через `globalCompositeOperation = "destination-out"`; рисуется поверх поля, но
   под HUD-слоем.
3. Подключение в цепочке отрисовки (`render.ts` / `game/drawScene.ts`) по флагу `hasModifier`.
4. Производительность: один проход маски за кадр, без создания изображений на каждом кадре.

Allowed files:

- src/game/campaignModifiers.ts
- src/game/campaignModifiers.test.ts
- src/game/render/darkArena.ts
- src/game/render/darkArena.test.ts
- src/game/render.ts
- src/game/game/drawScene.ts
- src/ui/screens/hud.tsx
- docs/ROADMAP.md
- docs/CHANGELOG.md
- .ai/TASKS.md
- .ai/STATE.md
- memory-bank/activeContext.md

Приёмка:

- [ ] маска не перекрывает HUD, оверлеи и экранные подсказки (тест на порядок слоёв)
- [ ] мутатор виден в бейджах и учитывается в множителях очков/кристаллов
- [ ] кадровое время не растёт больше чем на 1 ms на типичном устройстве
- [ ] геометрия кругов видимости покрыта юнит-тестами
- [ ] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

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

## Выполнено ранее (архив)

Карточки удалены при чистке файла; подробности каждой задачи — в `.ai/STATE.md`
(раздел «Текущая фаза») и `memory-bank/progress.md`.

| Задача | Что сделано                                                                               |
| ------ | ----------------------------------------------------------------------------------------- |
| T-040  | Движок синергий перков, бонусов и реликвий (§3.1): 6 синергий, боевые эффекты, HUD-бейджи |
| T-039  | Расширение каталога реликвий (4 → 8) и HUD-индикация артефактов забега                    |
| T-038b | Блок тактических модулей платформы (включаемые апгрейды в паузе)                          |
| T-038  | Увеличенный шар «Гравитационное ядро» (roadmap 3.1, ингредиент 3)                         |
| T-037  | Взрывной шар «Плазменный заряд» (roadmap 3.1, ингредиент 2)                               |
| T-036  | Проникающий шар «Кинетический клинок» (roadmap 3.1, ингредиент 1)                         |
| T-035  | Прозрачный экран детального подсчёта очков (Score Breakdown) (roadmap 2.3)                |
| T-034  | Сюжетные терминалы станции «СФЕРА-1080» в событиях кампании (roadmap 2.2)                 |
| T-033  | Спецблоки матрицы (armor, brittle, phase, magnet) в кампанию и редактор                   |
| T-032  | Оружейная фаза Миноги (снаряд, потеря/отрастание головы, неуязвимость тела)               |
| T-031  | Роадмап 1.2 — альтернативные боссы Актов I и II + углубление фаз + отладка                |
| T-030  | Аудио-оформление сюжета станции «СФЕРА-1080» (roadmap 1.1)                                |
| T-026  | Постоянное расстояние между ярусами карты кампании (2 ширины узла)                        |
| T-025  | Защита от дублей карт и воркфлоу внесения изменений (Этап M5)                             |
| T-024  | Админ-панель модерации кастомных карт (Этап M4)                                           |
| T-023  | Каталог пользовательских карт сообщества в главном меню (Этап M3)                         |
| T-022  | Клиентское API кастомных карт и диалог публикации в редакторе (Этап M2)                   |
| T-021  | Backend Supabase: миграции БД и Edge Functions модерации/публикации                       |
| T-020  | Унификация формы и инверсия цвета кнопок Toolbar                                          |
| T-019  | Вертикальные цифры на блоках, исключение паразитных дробей угла                           |
| T-018  | Недочёты UX редактора карт (селектор блоков, маркеры, слайдеры, шаг 5°)                   |
| T-017  | Кольца брони на блоках, чистое перетаскивание, защита поля автора                         |
| T-016  | Исправление багов редактора (Spacebar, ПКМ-меню, подсветка, выход из теста)               |
| T-015  | Быстрое копирование блоков протяжкой (Quick Clone Handle)                                 |
| T-014  | Маркеры трансформации, групповое выделение и буфер обмена                                 |
| T-013  | Эргономика редактора карт, ПКМ, зона ракетки и плавный Snap                               |
| T-012  | Полноэкранный EditorView, модалка JSON и интеграция в игру                                |
| T-011  | Панель инструментов и свойств (Toolbar & Inspector)                                       |
| T-010  | Интерактивный Canvas редактора карт (EditorCanvas)                                        |
| T-009  | Модели состояния и редьюсер редактора карт (State & Reducer)                              |
| T-008  | Единая верхняя HUD-зона во всех ориентациях                                               |
| T-007  | Магнитные блоки — пиктограмма, полярность и скрытие зоны действия                         |
| T-006  | Исправление дублирования звука при пересоздании Game                                      |
| T-005  | Базовый UI загрузчика/тестера карт (Этап A3)                                              |
| T-004  | Интеграция режима «Пользовательская карта» в ядро игры (Этап A3)                          |
| T-003  | Адаптер карты в уровень (Этап A2)                                                         |
| T-002  | Валидатор карт (Этап A2)                                                                  |
| T-001  | Типы Authoring Spec (`PlayerMapSpec`, Этап A1)                                            |
| T-000  | Инициализация проекта                                                                     |
