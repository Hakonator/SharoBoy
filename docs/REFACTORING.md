# Памятка: рефакторинг движка SharoBoy

> Файл-состояние для продолжения работы в следующих сессиях.
> Обновляй после каждого завершённого шага.

## Цель

Разрезать монолит `src/game/game.ts` (изначально 2841 строку) на независимые
модули без изменения поведения. Публичный API для `App.tsx` не меняется:
`game.ts` ре-экспортирует `UPGRADES_ENABLED`, `UPGRADE_DEFS` и типы
`Block, HudData, Phase, PowerType` (строки 38–39 game.ts) — не удалять.

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

Текущий размер: **game.ts 1465 строк** (было 2841). Тесты 45/45, lint/typecheck/build чистые.

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

## Что осталось в game.ts (кандидаты, по порядку)

Номера строк на момент `efc1b20`, сдвигаются после правок.

1. **Бонусы/спавн → `powers.ts`** (~790–1040): `periodicSpawn`, `tryFieldShift`,
   `pickPowerType`, `dropPower`, `periodicPowerDrop`, `updatePowers`,
   `applyPower`. Много чтения таймеров — предикаты в хосте.
2. **Оружие → `weapons.ts`** (~1040–1180): `tryFire`, `updateLaser`,
   `beamHit`, `updateProjectiles`, `explode`. Используют `physics.damageBlock()`
   и `physics.spawnScatter()` — они уже публичные.
3. **Жизненный цикл партии** (`startGame`, `startEndless`, `toMenu`, `launch`,
   `serveBall`, `onLevelCleared`, `loseLife`, `clearAllEffects`, `saveTop`) —
   толстая склейка с состоянием; выносить только если выгода очевидна.
4. **Прогресс/апгрейды** (`loadProgress`, `saveProgress`, `addCoins`,
   `buyUpgrade`, `applyUpgrades`) — маленький блок, можно оставить.
5. `pushHud`, `syncEffectsHud`, `setBanner`, `addScore`, `draw()` — тонкая
   склейка с состоянием; **оставить в game.ts** (как оркестратор).

## Известные технические хвосты

- **lost-флаг шара**: в `physics.ts` ставится расширением типа
  `(ball as Ball & { lost?: boolean })` — оформить явным полем `lost?: boolean`
  в интерфейсе `Ball` (`types.ts`) и убрать касты.
- `render.ts` дублирует view-типы вместо общих — приемлемо, чинить не обязательно.
- Подпись очков (`signScore`) считается в клиенте: `VITE_SCORE_SECRET` попадает
  в бандл при заполненном `.env` — осознанный компромисс, будущее решение —
  Supabase Edge Function.
- `npm test` в CI строгий только на beta; на main — с `--if-present`.

## Соглашения

- Conventional commits, описание на русском (`refactor:`, `feat:`, `chore:`).
- Один логический шаг = один коммит; перед коммитом — полный цикл проверок.
- Комментарии в коде на русском, стиль — по `.prettierrc.json` (без полу,
  двойные кавычки, 100 колонок).
- Рабочая ветка `beta`; `main` — стабильная (деплой GH Pages: main → корень,
  beta → `/beta/`).
