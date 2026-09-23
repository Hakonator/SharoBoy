# Архитектурные паттерны (System Patterns)

## Слои

- `src/game/*` — чистый TypeScript без React. Рендер — только `render/` (функции
  над Canvas), звук — только `audio/` (Web Audio, `SFX` + `FileMusicPlayer`).
- `src/ui/*` — React 18: `App.tsx` (оркестрация), `screens/`, `icons.tsx`, хуки
  (`useAchToasts`, `usePlayerStats`, `useLeaderboard`, `useDebugControls`).
- `src/game/game/` — ядро движка: класс `Game` (299 строк) — только состояние,
  конструктор и публичный API-делегаты; вся логика — свободные функции
  `(g: Game, ...)` в соседних модулях: `updateStep`, `drawScene`, `runFlow`,
  `campaignFlow`, `levelBuild`, `minibossRuntime`/`minibossFx`, `lifecycle`,
  `modes`, `audioControls`, `paddleControl`, `debug`, `hudSync`, `progress`,
  `hosts`/`hostsWorld`.

## Ключевые паттерны

- **Host-pattern**: подсистемы (`Physics`, `PowersSystem`, `BossSystem`,
  `WeaponsSystem`) получают мир через интерфейсы (`PhysicsWorld`, `PowersWorld`,
  `BossHost`, `WeaponsWorld`); фабрики хостов — `game/hosts.ts`, `game/hostsWorld.ts`.
- **Facade re-export**: фасады `game.ts`, `render.ts`, `audio.ts`, `physics.ts`,
  `powers.ts`, `screens.tsx` сохраняют старые пути импорта потребителей.
- **Кэш градиентов**: `render/gradCache.ts` — CanvasGradient создаётся один раз
  (ключ = всё, от чего зависят координаты/цвета), динамическая альфа — через
  `globalAlpha`, не через пересоздание градиента.
- **Zero-alloc цикл**: в горячем пути (каждый кадр) `.filter()` запрещён —
  `utils.compactInPlace` (массивы сущностей) и `utils.drainQueue` (очереди
  отложенных событий, append-safe). Разовые `.filter()` вне цикла — допустимы.
- **Границы подсистем**: `Game` передаёт `this` свободным функциям; взаимные вызовы
  модулей — прямые `fn(g, ...)`, без циклов значений (только type-import `Game`).
- Лимит размера: ≤300 строк (≤500 для `render/` и `audio.ts`), разбивать по единой
  ответственности. Никаких `any`/`@ts-ignore`, только ESM.
