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
  `hosts`.

## Ключевые паттерны

- **Host-pattern**: подсистемы (`Physics`, `PowersSystem`, `BossSystem`,
  `WeaponsSystem`) получают мир через интерфейсы (`PhysicsWorld`, `PowersWorld`,
  `BossHost`, `WeaponsWorld`); фабрики хостов — `game/hosts.ts`.
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
- **Общий контур фигуры (fill + полоска HP)**: путь строится из одних формул —
  `render/bossJellyDome.ts` (`traceJellyDome` — настоящие кривые для заливки,
  `jellyDomeContour` — полилиния той же геометрии). Canvas не умеет измерять
  длину пути, поэтому длину меряют по полилинии и рисуют обрезок по доле
  (`jellyHpContourSlice`, симметрия от макушки). Оверлеи по контуру вызывать
  ВНУТРИ трансформа сущности (translate/scale пульса) — наследуют деформацию
  без пересчёта координат.
- **Записывающий ctx в тестах**: `makeRecordingCtx` (`frameInvariant.helpers.ts`)
  пишет каждый fill/stroke с матрицей трансформа, alpha, strokeStyle и
  lineWidth — так проверяется «нарисовано под трансформом и при alpha=1» без
  браузера.
- **Геометрия карты кампании в px, не в %**: шаг ярусов задаёт домен
  (`campaignMapLayout.ts`: `TIER_STEP_NODE_WIDTHS` + `layoutTiers` — единая
  x-координата на ярус), а оверлей (`ui/screens/map.tsx`) переводит её в px
  умножением на ширину полотна `(tiers − 1) · step + nodeWidth`. Ширина полотна
  не зависит от экрана (на узком карта скроллится), поэтому расстояние между
  узлами одинаково на смартфоне и десктопе; размеры узла/шага берутся из одних
  констант, а точка перелома `sm` дублируется хуком `useDesktopLayout`
  (`matchMedia`), чтобы px-раскладка совпадала с Tailwind-классами.
- **Сюжетные звуки — синтез, не файлы**: сцена получает свой звук новым методом
  `SFX` (`transmission`, `stationHatch`, `gelVent`, `bossPhase`, `anomalyJump`),
  собранным из двух примитивов (`blip` / `noise`) с задержкой `delay` — так
  одноразовый «спектакль» (створки + выдох геля) планируется без таймеров в
  игровом цикле. Вариативность по сущности (голос босса) — таблицей констант
  (`TRANSMISSION_PITCH`), событие «один раз за бой» — флагом в состоянии
  (`BossState.angryPhase`), а не счётчиком в `BossSystem`.
- **Проверка синтеза без браузера**: фейковый `AudioContext`
  (`audioStory.helpers.ts`) пишет для каждого осциллятора тип волны, частоту,
  слайд, задержку и пик громкости, для шумовых источников — длительность и
  задержку. Конструктор подменяется в `window.AudioContext` (именно там его
  читает `SFX.ensure()`), тест утверждает характер звука, а не только отсутствие
  исключений.
- Размер файла не является жёстким лимитом: модули группируются по бизнес-смыслу и
  высокой связности, искусственное дробление ради счётчика строк запрещено. Если
  файл становится действительно гигантским (например, >1000 строк) и теряет фокус,
  разделять его по зонам ответственности. Никаких `any`/`@ts-ignore`, только ESM.
