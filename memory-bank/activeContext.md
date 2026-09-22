# Активный контекст (Active Context)

> Обновлять в конце каждой сессии.

## Где мы сейчас (2026-09-22)

Завершён полный рефакторинг под лимит 300 строк (`.clinerules`):

- Волна 1 (стадии A–F): `render/`, `ui/screens/`, `audio/`, `physics/`, хуки UI,
  `powers/apply.ts`, `inputHost.ts`, `campaignMapLayout.ts`, `levelPatterns.ts`,
  тестовые хелперы. Подробнее — `docs/REFACTORING.md`.
- Волна 2 (финальная фаза): `game.ts` 2366 → **299** строк, логика — в 16 модулей
  `src/game/game/*` (свободные функции `(g: Game, ...)`), хосты — `hosts.ts` +
  `hostsWorld.ts`, тип `MinibossCreature` — в `types.ts`.
- Восстановлена кодировка (инцидент PowerShell/cp1251), U+FFFD в `src` — 0.
- Валидация: typecheck ✓, lint 0 ошибок ✓, 132/132 теста ✓, build ✓.

## Незакрытые шаги

1. **Закоммитить** 29 изменённых файлов (ветка `beta`, Conventional Commits, EN),
   прогон pre-commit: lint → typecheck → test.
2. Обновить статусный блок `docs/REFACTORING.md` (дописать волну 2) — частично
   сделано при инициализации memory-bank.

## Следующие задачи

Баги и фичи поверх текущей базы — направления в `docs/ROADMAP.md` (лор, боссы,
прогрессия и т.д.).
