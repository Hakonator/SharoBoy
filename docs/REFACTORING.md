# Памятка: рефакторинг движка SharoBoy

> Файл-состояние для продолжения работы в следующих сессиях.
> Обновляй после каждого завершённого шага.

> **СТАТУС: РЕФАКТОРИНГ ЗАВЕРШЁН (обе волны).** Монолит `game.ts` (2841 строки)
> разобран на системы, UI-монолит `App.tsx` (932 строки) — на `ui/screens.tsx` +
> `ui/icons.tsx`. Вторая волна (2026-09) довела все файлы `src/` до лимита
> `.clinerules` (≤300, ≤500 для render/audio): `game.ts` 2366 → **299** строк,
> логика вынесена в 16 модулей `src/game/game/*` (свободные функции
> `(g: Game, ...)` по хост-паттерну), UI-хуки — в `src/ui/*`. Актуальное
> состояние и следующий шаг — в `memory-bank/activeContext.md`.
> Дальнейшая работа — баги и фичи поверх этой базы.
>
> **Роль документа:** исторический журнал рефакторинга (волна 1 — по коммитам,
> волна 2 — краткой сводкой в конце). Оперативное «состояние сессий» ведётся в
> `memory-bank/activeContext.md`, поэтому разделы ниже описывают состояние
> **на конец волны 1** (помечено по тексту).

## Цель

Разрезать монолит `src/game/game.ts` (изначально 2841 строку) на независимые
модули без изменения поведения, затем разрезать `App.tsx` на UI-компоненты.
Публичный API для `App.tsx` не меняется: `game.ts` ре-экспортирует
`UPGRADES_ENABLED`, `UPGRADE_DEFS` и типы `Block, HudData, Phase, PowerType` —
не удалять (при этом `ui/screens.tsx` берёт `UPGRADE_*` напрямую из
`game/upgrades.ts`, а `LEADERBOARD_ENABLED` — из `config.ts`).

## Выполнено (ветка `beta`)

| Коммит    | Что сделано                                                                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ecd2620` | ESLint (flat-config) + Prettier + husky/lint-staged, CI-шаги lint/test/typecheck в deploy.yml, секреты в `import.meta.env` (`.env.example`, `vite-env.d.ts`), тесты `leaderboard` (+`isSigValid` экспортирована) и `achievements` |
| `dcaa6d6` | Prettier-реформатинг всей базы                                                                                                                                                                                                    |
| `478f29a` | Вынесены `types.ts`, `palette.ts`, `levels.ts`, `upgrades.ts`, `utils.ts`                                                                                                                                                         |
| `5021da3` | Отрисовка → `render.ts` (чистые функции над Canvas, снимки-типы `BallView`/`PaddleView`/`LaserBeamView`)                                                                                                                          |
| `405b644` | Построение уровней → `levelBuilder.ts` (чистые функции: `layoutBlocks`, `gridBlocks`, `buildBossArena`)                                                                                                                           |
| `815b2df` | Ввод → `InputController` (`input.ts`); мёртвое поле `lockFailed` удалено                                                                                                                                                          |
| `361f052` | Эффекты → `Effects` (`effects.ts`) + юнит-тесты (`effects.test.ts`, +6 тестов)                                                                                                                                                    |
| `d6e0def` | Босс → `BossSystem` (`boss.ts`): update/damage/kill, спавн миньонов/бомб; наружу только `addRawScore` и `onBossKilled`                                                                                                            |
| `efc1b20` | Физика → `Physics` (`physics.ts`): `updatePaddle`, `updateBall`, `collidePaddle/Blocks/Boss`, `damageBlock`, `spawnScatter`, приватный `comboMult`                                                                                |
| `8cbe7b7` | Явное поле `lost?: boolean` у `Ball` вместо расширения типа `(ball as Ball & { lost?: boolean })` — касты убраны                                                                                                                  |
| `6e393a4` | Бонусы/спавн → `PowersSystem` (`powers.ts`): `periodicSpawn`, `tryFieldShift`, `pickPowerType`, `dropPower`, `periodicPowerDrop`, `updatePowers`, `applyPower`; заодно явное `taken?: boolean` у `PowerUp` (второй «каст-хвост»)  |
| `8200c3c` | Оружие → `WeaponsSystem` (`weapons.ts`): `tryFire`, `updateLaser`, `beamHit`, `updateProjectiles`, `explode`; урон боссу/блокам делегируется хосту                                                                                |
| `fdfdd55` | game.ts: хосты систем собраны в фабричные методы вместо инлайновых литералов; старт партии унифицирован через `resetRun()`                                                                                                        |
| `c670354` | UI: иконки и мелкие компоненты → `ui/icons.tsx` (`IconBall`, `IconPlay`, `Key`, `EffectChip`, `ControlsPanel`, `FloatingBalls` и др.)                                                                                             |
| `e968ba4` | UI: экраны и оверлеи → `ui/screens.tsx` (`BootErrorScreen`, `AchToasts`, `HudOverlay`, `MenuScreen`, `PauseScreen`, `GameOverScreen`, `WinScreen`, `TopSubmit`); `App.tsx` — только оркестрация состояния                         |

Размер после волны 1: **game.ts 1253 строки** (изначально 2841), **App.tsx 274
строки** (изначально 932), `ui/screens.tsx` 821, `ui/icons.tsx` 182.
Тесты 45/45, lint/typecheck/build чистые.

> После волны 2 (2026-09): `game.ts` — **299 строк**, все модули ≤300
> (кроме `audio.ts` 414 ≤500 — разрешено правилами), тесты 132/132.

## Паттерн «система + хост» (так выносим подсистемы)

1. Новый файл `xxx.ts`: класс `XxxSystem`/`Xxx`, в конструкторе — **узкий
   хост-интерфейс** (`const g = this` внутри Game при создании: геттеры для
   реактивных полей, предикаты для таймеров, методы-колбэки для последствий).
2. Система не знает о фазах игры и HUD — все решения через хост.
3. В game.ts: поле `private xxx = new Xxx({...})`, механическая замена
   `this.field` → `this.xxx.field` на затронутом участке, удаление старых методов.
4. Большие переносы — временным node-скриптом в `scripts/` (файл после
   использования удалять, в репо не оставлять: PowerShell ломается на кавычках
   inline-кода).
5. Один шаг = один коммит (`refactor: ...` на русском) после полного цикла проверок.

## Цикл верификации после каждого шага

```bash
npx prettier --write src/game/game.ts src/game/<новый>.ts
npm run typecheck   # ловит пропущенные миграции
npm test            # 45 тестов (4 файла)
npm run lint:check
npm run build
```

husky pre-commit сам гоняет `eslint --fix` + `prettier --write` на staged
(шумный вывод lint-staged — норма, не ошибка).

## Финальная структура волны 1: что осознанно оставалось в game.ts

> ⚠️ Устарело: во второй волне (2026-09) всё перечисленное ниже вынесено из
> `game.ts` в модули `src/game/game/*` (`runFlow.ts`, `progress.ts`, `hudSync.ts`,
> `drawScene.ts`, `modes.ts`, `lifecycle.ts` и др.); `game.ts` — только состояние,
> конструктор, игровой цикл и делегаты публичного API (299 строк). Раздел сохранён
> как запись обоснований волны 1.

1. **Жизненный цикл партии** (`startGame`, `startEndless`, `toMenu`, `launch`,
   `serveBall`, `onLevelCleared`, `loseLife`, `clearAllEffects`, `saveTop`) —
   толстая склейка с состоянием; решено не выносить (выгода не окупает связность).
2. **Прогресс/апгрейды** (`loadProgress`, `saveProgress`, `addCoins`,
   `buyUpgrade`, `applyUpgrades`) — маленький блок, оставлен.
3. `pushHud`, `syncEffectsHud`, `setBanner`, `addScore`, `draw()` — тонкая
   склейка с состоянием; оставлены (game.ts — оркестратор партии).

## Известные технические хвосты

- `npm test` в CI строгий только на beta; на main — с `--if-present`.

## Соглашения

- Conventional commits, описание на русском (`refactor:`, `feat:`, `chore:`).
- Один логический шаг = один коммит; перед коммитом — полный цикл проверок.
- Комментарии в коде на русском, стиль — по `.prettierrc.json` (без полу,
  двойные кавычки, 100 колонок).
- Рабочая ветка `beta`; `main` — стабильная (деплой GH Pages: main → корень,
  beta → `/beta/`).

---

## Волна 2 (2026-09): доведение до лимита 300 строк

Цель — соблюсти `.clinerules` (≤300 строк, ≤500 для `render/`/`audio.ts`).
Стадии:

- **A** `render.ts` (1388) → `src/game/render/`: shapes, background, blocks,
  fish+fishParts, jelly, minibosses, boss, powers, projectiles, paddle, fx + фасад.
- **B** `screens.tsx` (1409) → `src/ui/screens/`: типы, boot, top, hud, map,
  shared, menu, menuTop, menuPanels, menuPanels2, overlays + фасад.
- **C** `audio.ts` (1028) → `src/game/audio/`: `tracks/{map,menu,game,gameTheme}`,
  новый класс `FileMusicPlayer` (развязан с `SFX` через колбэки `getVolume`,
  `shouldPlay`); `audio.ts` хранит `SFX` (414 строк — исключение правил).
- **D** `physics.ts` (629) → `src/game/physics/`: shapes, collide, destruction;
  `Physics` — оркестратор с static-обёртками (публичный API сохранён).
- **E** `App.tsx` (470 → 219) → хуки `src/ui/`: useAchToasts, usePlayerStats,
  useLeaderboard, useDebugControls.
- **F** мелкие: `powers/apply.ts`, `inputHost.ts`, `campaignMapLayout.ts`,
  `levelPatterns.ts`, тестовые хелперы `campaignFlow.helpers.ts`,
  `frameInvariant.helpers.ts`.
- **Финал** `game.ts` (2366 → **299**): тела методов — свободные функции
  `(g: Game, ...)` в `src/game/game/*` (hosts, hostsWorld, updateStep, drawScene,
  runFlow, campaignFlow, levelBuild, minibossRuntime, minibossFx, lifecycle,
  modes, audioControls, paddleControl, debug, hudSync, progress); класс сохраняет
  поля, конструктор, `loop` и 25 однострочных делегатов публичного API; тип
  `MinibossCreature` — в `types.ts`.

Инцидент: промежуточные PowerShell-правки перекодировали кириллицу
(cp1251 → mojibake) в `game.ts`/`drawScene.ts` — восстановлено обратным
преобразованием; **урок: UTF-8 файлы править только node/редактором, не PowerShell**.

Итог волны 2: typecheck ✓, lint 0 ошибок ✓, 132/132 теста ✓, build ✓.
