import type { Game } from "../game"
import { InputController } from "../input"
import { clamp, rand, lsGet } from "../utils"
import { computeScale } from "../viewport"
import type { ScoreEntry } from "../types"

import { toggleMusic, toggleMute } from "./audioControls"
import { enterNextNodeOnAction } from "./campaignFlow"
import {
  debugDamageUp,
  debugSkipLevel,
  toggleFps,
  toggleHitboxes,
  toggleInvincible,
  toggleSlowMotion,
} from "./debug"
import { pushHud } from "./hudSync"
import { startGame, togglePause } from "./modes"
import { paddleBottomOffset } from "./paddleControl"
import { realignOnOrientationChange } from "./rotateLayout"
import { launch } from "./runFlow"

export function attach(g: Game) {
  g.handleResize()
  window.addEventListener("resize", g.handleResize)
  g.input.attach()
  for (let i = 0; i < 26; i++) {
    g.bubbles.push({
      x: Math.random() * g.w,
      y: Math.random() * g.h,
      r: rand(2, 7),
      vy: rand(14, 46),
      ph: rand(0, Math.PI * 2),
    })
  }
  g.last = performance.now()
  g.raf = requestAnimationFrame(g.loop)
  // Музыка стартует сразу при запуске игры; если браузер требует жест,
  // SFX сам повторит запуск при первом клике/тапе/клавише.
  g.sfx.autostart()
  pushHud(g)
}

export function setNick(g: Game, nick: string) {
  g.nick = nick
}

export function destroy(g: Game) {
  g.destroyed = true
  cancelAnimationFrame(g.raf)
  window.removeEventListener("resize", g.handleResize)
  g.input.destroy()
  // Движок уничтожен (например, пересоздание в dev-режиме) — музыка не должна
  // остаться играть «вторым» экземпляром.
  g.sfx.stopMusic()
}

export function resizeHandler(g: Game) {
  g.dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssW = window.innerWidth
  const cssH = window.innerHeight
  g.cssW = cssW
  g.cssH = cssH
  const ow = g.w
  const oh = g.h
  /* Единый масштаб мира (viewport.ts): логика считает в «эталонных» единицах
       (окно 1920×1080 = масштаб 1), а канвас рисует весь мир одним трансформом.
       Поэтому размеры/скорости сущностей одинаковы на телефоне, FHD и 4K. */
  g.scale = computeScale(cssW, cssH)
  g.w = cssW / g.scale
  g.h = cssH / g.scale
  g.canvas.width = Math.floor(cssW * g.dpr)
  g.canvas.height = Math.floor(cssH * g.dpr)
  g.ctx.setTransform(g.dpr * g.scale, 0, 0, g.dpr * g.scale, 0, 0)
  // Экранный размер канваса задаём явно: canvas — replaced-элемент, без явных
  // CSS-размеров он берёт размер атрибутов (w*dpr × h*dpr) и при
  // devicePixelRatio != 1 (масштаб ОС 125%/150%, Retina) вылезает за экран.
  g.canvas.style.width = `${cssW}px`
  g.canvas.style.height = `${cssH}px`
  g.paddle.baseW = clamp(g.w * 0.18, 110, 200) * g.paddleWidthMult
  g.paddle.y = g.h - paddleBottomOffset(g)
  g.paddle.x = clamp(g.paddle.x, g.paddle.w / 2 + 4, g.w - g.paddle.w / 2 - 4)
  const wasPortrait = oh > ow
  if (ow && oh && g.blocks.length && (ow !== g.w || oh !== g.h)) {
    const sx = g.w / ow
    const sy = g.h / oh
    for (const b of g.blocks) {
      b.x = clamp(b.x * sx, b.rx + 6, g.w - b.rx - 6)
      b.x0 = clamp(b.x0 * sx, b.rx + 6, g.w - b.rx - 6)
      b.y = clamp(b.y * sy, b.ry + 6, g.h * 0.75)
    }
  }
  // Смена ориентации посреди уровня: пропорционального масштабирования мало —
  // в портрете опускаем блоки/босса ниже неигровой HUD-зоны (rotateLayout.ts).
  realignOnOrientationChange(g, wasPortrait)
}
/** Загрузка рекордов из localStorage с миграцией со старого формата (number[]). */
export function loadScoreEntries(g: Game, key: string): ScoreEntry[] {
  try {
    const parsed = JSON.parse(lsGet(key) || "[]") as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item: unknown): ScoreEntry | null => {
        if (typeof item === "number") {
          return { score: item, nick: "" }
        }
        if (typeof item === "object" && item !== null && "score" in item) {
          const entry = item as { score: unknown; nick?: unknown }
          return {
            score: typeof entry.score === "number" ? entry.score : 0,
            nick: typeof entry.nick === "string" ? entry.nick : "",
          }
        }
        return null
      })
      .filter((e): e is ScoreEntry => e !== null)
  } catch {
    return []
  }
}

/** Первый тач-ввод (в т.ч. на гибридных устройствах) — поднимаем ракетку. */
export function enableTouchMode(g: Game) {
  if (g.touchMode) return
  g.touchMode = true
  g.paddle.y = g.h - paddleBottomOffset(g)
}
/** Фабрика контроллера ввода с хост-колбэками на живой Game. */
export function createInput(g: Game, canvas: HTMLCanvasElement): InputController {
  return new InputController(canvas, {
    paddleX: () => g.paddle.x,
    paddleY: () => g.paddle.y,
    paddleWidth: () => g.paddle.w,
    worldWidth: () => g.w,
    worldHeight: () => g.h,
    sfxEnsure: () => g.sfx.ensure(),
    isPlaying: () => g.phase === "playing",
    primaryAction: () => {
      if (g.phase === "menu" || g.phase === "over" || g.phase === "won") startGame(g)
      else if (g.phase === "playing") launch(g)
      else if (g.phase === "map") enterNextNodeOnAction(g)
    },
    launchIfPlaying: () => {
      if (g.phase === "playing") launch(g)
    },
    onTouchInput: () => enableTouchMode(g),
    togglePause: () => togglePause(g),
    toggleMute: () => toggleMute(g),
    toggleMusic: () => toggleMusic(g),
    // DEV-отладка (F1–F4): DEV-гейт внутри toggle-функций (game/debug.ts).
    toggleFpsOverlay: () => {
      toggleFps(g)
    },
    toggleHitboxes: () => {
      toggleHitboxes(g)
    },
    toggleSlowMotion: () => {
      toggleSlowMotion(g)
    },
    toggleInvincible: () => {
      toggleInvincible(g)
    },
    debugDamageUp: () => debugDamageUp(g),
    debugSkipLevel: () => debugSkipLevel(g),
    onBlur: () => {
      if (g.phase === "playing") togglePause(g)
    },
    // Первый Esc при pointer lock браузер перехватывает (keydown не
    // доставляется) — потеря захвата без нашего запроса = нажатие Esc.
    // onBlur уже мог поставить паузу (alt-tab): фаз-гард не даёт
    // случайно «снять» её повторным вызовом.
    onLockLostUnexpectedly: () => {
      if (g.phase === "playing") togglePause(g)
    },
  })
}
