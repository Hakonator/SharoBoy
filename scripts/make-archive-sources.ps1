# Генерирует src/archive-sources.ts — вшивает актуальные исходники проекта
# в ленивый чанк для кнопки «Скачать проект» (ZIP). Запускать из корня проекта:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make-archive-sources.ps1
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$cwd = (Get-Location).Path
$pairs = @(
  @('sharoboy/index.html','index.html'),
  @('sharoboy/package.json','package.json'),
  @('sharoboy/tsconfig.json','tsconfig.json'),
  @('sharoboy/vite.config.js','vite.config.js'),
  @('sharoboy/src/main.tsx','src/main.tsx'),
  @('sharoboy/src/index.css','src/index.css'),
  @('sharoboy/src/App.tsx','src/App.tsx'),
  @('sharoboy/src/config.ts','src/config.ts'),
  @('sharoboy/src/game/audio.ts','src/game/audio.ts'),
  @('sharoboy/src/game/game.ts','src/game/game.ts'),
  @('sharoboy/src/game/leaderboard.ts','src/game/leaderboard.ts'),
  @('sharoboy/src/game/profanity.ts','src/game/profanity.ts')
)
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('/* Lazy chunk: project sources for the "Download project" button (ZIP). */')
$lines.Add('')
$lines.Add('export const ARCHIVE_FILES: { path: string; content: string }[] = [')
foreach ($p in $pairs) {
  $content = [System.IO.File]::ReadAllText((Join-Path $cwd $p[1]))
  $json = $content | ConvertTo-Json -Compress
  $lines.Add(('  { path: "' + $p[0] + '", content: ' + $json + ' },'))
}
$lines.Add('];')
$lines.Add('')
[System.IO.File]::WriteAllText((Join-Path $cwd 'src\archive-sources.ts'), ($lines -join "`n"), $utf8)
'archive-sources.ts regenerated: ' + (Get-Item (Join-Path $cwd 'src\archive-sources.ts')).Length + ' bytes'
