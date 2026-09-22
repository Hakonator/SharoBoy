# Технологический контекст (Tech Context)

- Стек: TypeScript ^5.7 (strict), Vite ^6.3 + @vitejs/plugin-react, TailwindCSS 4
  (CSS-first `@theme` в `src/index.css`), Vitest ^4.1, ESLint 9 (flat config),
  Prettier 3, ESM. Сборка статики — GitHub Pages (ветка `beta`).
- Supabase: мировой топ (`sharoboy_scores`), Edge Function «scores», секреты
  `VITE_SUPABASE_URL/ANON_KEY`, `VITE_SCORE_SECRET` (см. `docs/DEVELOPMENT.md`).
- Команды: `npm run dev` (:3000), `build`, `test` (vitest), `typecheck`
  (tsc --noEmit), `lint` / `lint:check`.
- Pre-commit: husky + lint-staged (не ломать); коммиты на английском, Conventional
  Commits, целевая ветка `beta`.
- Терминал: Git Bash; PowerShell-правки файлов НЕ использовать для UTF-8 файлов
  (Get-Content/Set-Content портят кириллицу — инцидент 2026-09, чинить только node).
- Тесты: `*.test.ts` рядом с исходниками; e2e-подобные: `campaignFlow.test.ts`,
  `frame.invariant.test.ts` (хелперы: `campaignFlow.helpers.ts`,
  `frameInvariant.helpers.ts` обращаются к internals `Game` — не переименовывать
  поля/методы `Game` без правки хелперов).
