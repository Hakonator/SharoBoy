# Краткое описание проекта (Project Brief)

**SharoBoy** — браузерная игра в жанре «аркада-пинбол» (ракетка + шар), без игровых
движков. TypeScript-ядро чистой логики (`src/game/*`), рендер на Canvas 2D, звук на
Web Audio (чиптюн-секвенсор), UI на React 18. PWA, деплой на GitHub Pages из ветки
`beta` (`.github/workflows/deploy.yml`).

- Цель проекта: отзывчивая одностраничная игра с кампанией (карта узлов), боссами,
  минибоссами, прокачкой и мировым топом.
- Подробности: `docs/DEVELOPMENT.md` (запуск/CI/Supabase), `docs/ROADMAP.md` (план),
  `docs/REFACTORING.md` (история рефакторинга).
- Правила кода: `.clinerules` (лимит 300 строк на файл, 500 для render/audio).
