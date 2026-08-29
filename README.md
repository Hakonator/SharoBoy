# ШАРОБОЙ

Аркадный разбиватель: вместо кирпичей — шары и овалы, ракетка с закруглёнными углами.
Кампания из 4 уровней (финал — босс «Царь-шар») + бесконечный режим с сидом дня.

## Запуск
    npm install
    npm run dev      # http://localhost:3000
    npm run build    # продакшен-сборка в dist/
    npm run preview  # локальный предпросмотр продакшен-сборки

## Играть онлайн
Сайт публикуется автоматически на GitHub Pages при каждом пуше в main
(см. .github/workflows/deploy.yml):
    https://hakonator.github.io/SharoBoy/

## Структура
    index.html                заставка + точка входа
    src/main.tsx              монтирование React
    src/index.css             тема (Tailwind v4)
    src/App.tsx               HUD и экраны
    src/game/audio.ts         синтезатор звуков (WebAudio)
    src/game/game.ts          игровой движок: физика, уровни, босс, бонусы
    src/archive-sources.ts    исходники для кнопки «Скачать проект» (ленивый чанк)
    src/vite-env.d.ts         типы Vite (import.meta.env)

package-lock.json намеренно не включён — npm install создаст его заново.
