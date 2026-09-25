# Технологический контекст (Tech Context)

- Стек: TypeScript ^5.7 (strict), Vite ^6.3 + @vitejs/plugin-react, TailwindCSS 4
  (CSS-first `@theme` в `src/index.css`), Vitest ^4.1, ESLint 9 (flat config),
  Prettier 3, ESM. Сборка статики — GitHub Pages (ветка `beta`).
- Supabase: мировой топ (`sharoboy_scores`), Edge Function «scores», секреты
  `VITE_SUPABASE_URL/ANON_KEY`, `VITE_SCORE_SECRET` (см. `docs/DEVELOPMENT.md`).
  Правило с 30.10.2025: новые таблицы в `public` НЕ получают Data API-доступ
  автоматически — явные `grant` (anon/authenticated/service_role) обязательны
  в той же миграции, что и `create table`
  (`20250101000007_grants_api_access.sql`).
- Команды: `npm run dev` (:3000), `build`, `test` (vitest), `typecheck`
  (tsc --noEmit), `lint` / `lint:check`.
- Pre-commit: husky + lint-staged (не ломать); коммиты на английском, Conventional
  Commits, целевая ветка `beta`.
- Терминал: Git Bash — явным вызовом `"C:\Program Files\Git\bin\bash.exe" -lc '...'`,
  потому что оболочка по умолчанию PowerShell 5.1: `&&` нельзя (сепаратор `;`),
  `$_:` в строках требует `${_}`. PowerShell-правки файлов НЕ использовать для
  UTF-8 файлов (Get-Content/Set-Content портят кириллицу — инцидент 2026-09,
  чинить только node/редактором).
- Git: многострочные сообщения — `git commit -F <файл>`; `-m "..."` из
  PowerShell в bash теряет кавычки и коммит получает `feat:` вместо полного
  сообщения (инцидент 25.09.2026, чинилось `--amend -F`).
- Тесты: `*.test.ts` рядом с исходниками; e2e-подобные: `campaignFlow.test.ts`,
  `frame.invariant.test.ts` (хелперы: `campaignFlow.helpers.ts`,
  `frameInvariant.helpers.ts` обращаются к internals `Game` — не переименовывать
  поля/методы `Game` без правки хелперов).
- Известный флаки: `campaignMap.test.ts` «структурные инварианты» (~4–5 с) под
  полной параллельной нагрузкой превышает дефолтный таймаут Vitest 5 с —
  перезапуск сьюта, не бага; таймаут не поднимать без причины.
- Тесты рендера: `makeRecordingCtx` (`frameInvariant.helpers.ts`) записывает
  op/матрицу трансформа/alpha/strokeStyle/lineWidth — им проверяют, что полоски
  рисуются внутри трансформа сущности при `globalAlpha === 1`.
- Визуальная проверка Canvas-геометрии без браузера: отрисовать те же кривые
  PowerShell GDI+ (`System.Drawing`) в PNG и посмотреть картинку — так проверяли
  контур купола медузы (25.09.2026).
