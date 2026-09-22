import type { Game } from "../game"

import { pushHud } from "./hudSync"

export function toggleMute(g: Game) {
  g.sfx.ensure() // клик по кнопке — жест, легально создаёт AudioContext
  g.sfx.muted = !g.sfx.muted
  if (!g.sfx.muted) g.sfx.ui()
  pushHud(g)
}

/** Переключить фоновую музыку (отдельно от эффектов). */
export function toggleMusic(g: Game) {
  g.sfx.ensure() // клик по кнопке — жест, легально создаёт AudioContext
  g.sfx.setMusicMuted(!g.sfx.musicMuted)
  pushHud(g)
}

/**
 * Скрытая отладочная клавиша («-» на цифровой клавиатуре): увеличивает
 * урон шара на +1 за нажатие. Работает в любом режиме (для тестирования).
 */
export function setMusicVolume(g: Game, v: number) {
  g.sfx.ensure()
  g.sfx.setMusicVolume(v)
  pushHud(g)
}

/** Ползунок громкости эффектов (0..1). */
export function setSfxVolume(g: Game, v: number) {
  g.sfx.ensure()
  g.sfx.setSfxVolume(v)
  pushHud(g)
}

/** Трек по фазе: в меню/финале — душевный медленный, в партии — боевой,
 *  на карте кампании — своя медленная загадочная мелодия (тихий синт-трек
 *  вместо MP3: игрок проводит на карте секунды, частые кроссфейды файлов
 *  «бой → карта → бой» раздражали). */
export function applyTrack(g: Game) {
  g.sfx.ensure() // музыка обязана звучать с первого момента уровня
  g.sfx.setTrack(
    g.phase === "playing" || g.phase === "paused" ? "game" : g.phase === "map" ? "map" : "menu"
  )
}

/** Полный сброс состояния партии перед стартом кампании/бесконечного режима. */
