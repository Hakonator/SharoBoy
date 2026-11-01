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
T-052 выполнена 01.11.2026 (карточка ниже, в «Последние выполненные задачи»).
Остальные карточки в статусе `draft`: реализация начинается после утверждения пользователем
и перевода карточки в `ready` (AD-027, п. 3). Порядок — волнами; внутри волны задачи
независимы. Если по ходу выяснятся побочные правки, под них заводится промежуточная
карточка вида `T-0XXa` (не расширяя исходную).

Порядок исполнения:

- **Волна 1 (P0, все S):** ~~T-052~~ (done) → T-053 → T-054 → T-055.
- **Волна 2 (P1, M):** T-056 (после T-052) → T-057 → T-058 → T-059.
- **Волна 3 (P2, L):** T-060 → T-061.

Общий пакет проверок для каждой задачи:
`npm run typecheck` → `npm run lint:check` → `npm run format:check` → `npm run test`.
Общие запреты: `vite.config.ts`, `tsconfig.json`, `package.json`, `supabase/**`, `.github/**`.

### T-056: Бесконечный режим — драфт мутаторов каждые 5 волн

Status: done · Priority: high · Сложность: M · Зависимости: T-052 · Волна 2

Итог (02.11.2026):
Черновик мутаторов работает в бесконечном режиме; 87 файлов / 832 теста (+26).

Детали реализации и отклонения от исходного плана:

1. `src/game/endlessDraft.ts` — чистый модуль: `rollDraftOptions(seed, wave, taken)`,
   `applyDraftPick`, `isDraftWave`, `draftPicksLeft`, константы `DRAFT_MAX_PICKS = 3`,
   `DRAFT_WAVE_INTERVAL = 5`, `DRAFT_EXCLUDED_IDS = ["ironman", "inverted_controls"]`.
   Сид фиксируется на старте забега (`Game.draftSeed = daySeed()`), а не берётся заново
   на каждом выборе — иначе набор зависел бы от момента клика.
2. **Отклонение по п.3 плана:** выбранные мутаторы пишутся в новое поле
   `Game.draftModifiers`, а не в `g.campaignModifiers`. Добавлена функция
   `gameModifiers(g)`, объединяющая оба списка; все `hasModifier(g.campaignModifiers, …)`
   в `hosts.ts`, `levelBuild.ts`, `runFlow.ts` переведены на неё. Причина: приёмка
   требует, чтобы драфт **не** попадал в `computeRunMultipliers`, иначе бонусы за
   рискованную игру ломают сравнимость рекордов бесконечного режима.
3. **Исправлена семантика момента:** `advanceEndlessWave` инкрементирует волну до вызова
   драфта, поэтому проверка `isDraftWave(g.wave)` выдавала выбор после волны 10 вместо 5.
   Теперь передаётся номер **пройденной** волны (`openWaveDraft(g, clearedWave)`),
   защита от повтора — `Game.draftWaveHandled`.
4. Разовые эффекты выбранного посреди боя мутатора догоняются в `pickWaveDraft`
   (`dense_armor` — +1 HP/maxHp уже стоящим блокам, `hyper_speed` — ×1.25 к скорости
   летящих шаров). `glass_paddle` руками не правим: ширину ракетки каждый кадр
   пересчитывает `Physics.updatePaddle` от `baseW`.
5. UI: `WaveDraftModal` (`data-testid="wave-draft-modal"`, опции
   `wave-draft-option-<id>`, счётчик `n/3`, «Пропустить», Escape), состояние
   `HudData.waveDraft` + `draftModifiers`, бейдж «Мутаторы» в HUD дополнен иконками драфта.
6. Тесты: `endlessDraft.test.ts` (13), `endlessDraft.integration.test.ts` (10),
   `WaveDraftModal.test.tsx` (3).

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

- [x] драфт наступает только на волнах 5, 10, 15…; опции детерминированы сидом и волной
- [x] уже взятый мутатор не предлагается повторно; максимум 3 за забег
- [x] выбранный мутатор реально влияет на бой (тест через `hasModifier`)
- [x] драфт **не** попадает в `computeRunMultipliers` (рекорды остаются сравнимыми)
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

### T-055: Ранг сектора S / A / B

Status: done · Priority: medium · Сложность: S · Зависимости: — · Волна 1

Итог (01.11.2026):
Чистая функция ранга по статистике сектора, бонус кристаллов ровно один раз за сектор,
бейдж ранга и строка награды в окне промежуточного счёта. Тестов +13 (84 файла / 806 тестов).

Детали реализации:

1. `scoreBreakdown.ts`: `SectorRankInput`, `SectorRank = "S" | "A" | "B"`,
   `computeSectorRank(input, opts?)` и `sectorRankCrystals(rank)`. Пороги-константы:
   `SECTOR_RANK_S_COMBO = 8`, `SECTOR_RANK_A_PAR_MULT = 1.25`,
   `SECTOR_RANK_CRYSTALS = { S: 4, A: 2, B: 0 }`. `null` — при поражении (`{ won: false }`)
   и для испорченной статистики (NaN/∞ время или эталон); `par <= 0` даёт `B`;
   `lostBall` закрывает S и A.
2. `game/runFlow.ts`: рант считается в `showIntermediateScore` (единственная точка показа
   результата сектора), кладётся в `g.intermediateScore` (`sectorRank`,
   `sectorRankCrystals`, `sectorParSeconds`), кристаллы начисляются через `g.addCrystals`.
   Идемпотентность — новое поле `Game.sectorRankAwardedFor` (идентификатор сектора =
   `runSectorStartTime`), сбрасывается в `resetRunStats`.
3. `ui/screens/overlays.tsx`: круглый бейдж ранга (S золотой, A мятный, B циановый),
   подсказка «эталон 45 с · время N с», строка «Ранг S 💎 +4» в блоке сводки.

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

- [x] ранг детерминирован от статистики сектора, границы покрыты тестами
- [x] бонус кристаллов начисляется ровно один раз
- [x] на поражении ранг не показывается
- [x] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-054: «Последний рубеж» боссов

Status: done · Priority: high · Сложность: S · Зависимости: — · Волна 1

Итог (01.11.2026):
Одноразовое событие при HP ниже порога: баннер, двойное кольцо, звук, ускорение бомб и
подкрепление на орбите. Баланс боссов без бомб/миньонов не меняется — только визуал.
Тестов +7 (84 файла / 793 теста), `typecheck`, `lint`, `prettier` чистые.

Детали реализации:

1. `bossVariants.ts`: `BOSS_LAST_STAND_AT = 0.12`, `BOSS_LAST_STAND_PHASE_SHIFT = 0.02`;
   `BossVariant.lastStandAt`, у фазовых боссов (`phases > 1`) порог выше на 0.02, но всегда
   ниже `angryAt` — порядок фаз «промежуточная → злая → последний рубеж» сохраняется.
2. `types.ts`: `BossState.lastStandAt` (порог с арены), `lastStand` (событие израсходовано),
   `lastStandBombAccelerated` (идущий таймер бомбы уже ускорен).
3. `boss.ts`: срабатывание в `step()` рядом с `angryAt`; `startLastStand()` — баннер-попап,
   два кольца, взрыв искр, встряска, вспышка, `sfx.power()`; `LAST_STAND_BOMB_MULT = 0.6`
   (перемножается с `BOSS_FURY_BOMB_MULT`), ускоряется и уже идущий таймер (разово);
   `LAST_STAND_MINIONS = 2` миньона на орбите (радиус 120, скорость 1.05) — обычные
   `minionOrbit`-блоки, их штатно добивают и сметают при смерти босса.
4. Порог прокинут через конструкторы арен (`buildCrabBoss`, `buildChronoBoss`,
   `buildCryoDrone`, `buildOctopusBoss`, `buildJellyfishBoss`, `buildLampreyBoss`).

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

- [x] «последний рубеж» срабатывает ровно один раз за бой (тест на повторный вызов)
- [x] не конфликтует с промежуточной фазой (`phases > 1`) и с агрессией
- [x] боссы без бомб получают только визуальный сигнал
- [x] `typecheck`, `lint:check`, `format:check`, `test` — зелёные

### T-053: Челлендж-узлы 4 → 7 видов

Status: done · Priority: high · Сложность: S · Зависимости: — · Волна 1

Итог (01.11.2026):
Три новых вида испытаний, порог пула по ярусу, счётные фиксаторы прогресса и три хука
движка. Тестов +13 (84 файла / 786 тестов), `typecheck`, `lint`, `prettier` чистые.

Детали реализации:

1. `campaignChallenges.ts`: `CHALLENGE_KINDS` (7 видов, порядок фиксирован — выбор идёт по
   индексу `floor(rng() * pool.length)`, перестановка сломала бы детерминизм карт) и
   `CHALLENGE_FULL_POOL_TIER = 5`: ярусы 3–4 разыгрывают классическую четвёрку.
2. Цели и награды: `power_hunter` 3–6 бонусов (+5 💎), `chain_master` 3/5 детонаций (+10 💎),
   `armor_breaker` 3–8 единиц брони (+5 💎); `rewardMeta` по прежней формуле (2 при tier ≥ 18).
3. Фиксаторы через общий `advanceChallenge`: `recordChallengePower`, `recordChallengeChain`,
   `recordChallengeArmor` (мусорные/нулевые значения игнорируются, награда — ровно один раз).
4. Провал: `recordChallengeBallLost` по-прежнему только `flawless`/`survive_time`; добавлен
   предикат `isCollectiveChallenge(kind)` для счётных видов.
5. Хуки: `PowersWorld.onPowerPicked(type)` вызывается до применения эффекта;
   `PhysicsWorld.onArmorBroken(units)` — по фактически поглощённым щитам;
   `PhysicsWorld.onChainDetonation(affected)` — один раз на каскад (рекурсия идёт с
   `allowBrittle = false`, поэтому хук не повторяется).
6. `formatChallengeHud`: статусы `🎁 N / M`, `💥 N / M`, `🛡 N / M`.

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

- [x] новые виды детерминированно появляются по сиду узла (тест на выбор и на прогресс)
- [x] каждый вид можно завершить и провалить в юнит-тесте
- [x] награды начисляются ровно один раз за узел
- [x] существующие 4 вида ведут себя как раньше

## Выполнено ранее (архив)

Карточки удалены при чистке файла; подробности каждой задачи — в `.ai/STATE.md`
(раздел «Текущая фаза») и `memory-bank/progress.md`.

| Задача | Что сделано                                                                               |
| ------ | ----------------------------------------------------------------------------------------- |
| T-040  | Движок синергий перков, бонусов и реликвий (§3.1): 6 синергий, боевые эффекты, HUD-бейджи |
| T-039  | Расширение каталога реликвий (4 → 8) и HUD-индикация артефактов забега                    |
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
| T-052  | Мутаторы кампании 6 → 10 (no_powers, brittle_world, low_bounce, boss_fury)                |
| T-052  | Мутаторы кампании 6 → 10 (no_powers, brittle_world, low_bounce, boss_fury)                |
| T-051  | Выбор целей кликом по блоку и группой через Space в редакторе карт                        |
