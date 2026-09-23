import type { Game } from "../game"
import { fixedVariant } from "../bossVariants"
import { minibossName } from "../minibosses"
import { lsSet } from "../utils"
import type { MinibossKind } from "../minibosses"

import { pushHud, setBanner } from "./hudSync"
import { buildOctopusBoss, buildWave, serveBall } from "./levelBuild"
import { addMiniboss, resetMiniboss } from "./minibossRuntime"

/** Ключ localStorage для настройки «показывать счётчик FPS». */
export const FPS_LS_KEY = "sharoboy-fps"

/** DEV-режим сборки (vite): отладочные функции доступны только в нём. */
const DEV = import.meta.env.DEV

/* ---------- отладка ---------- */

/** Переключение режима отладки. */
export function toggleDebug(g: Game) {
  g.debug = !g.debug
  if (!g.debug) g.debugEffects.clear()
  pushHud(g)
}

/** Переключение счётчика FPS (F1); возвращает новое состояние (для UI). Только DEV. */
export function toggleFps(g: Game): boolean {
  if (!DEV) return false
  g.showFps = !g.showFps
  lsSet(FPS_LS_KEY, g.showFps ? "1" : "0")
  return g.showFps
}

/** DEV (F2): переключение отрисовки хитбоксов сущностей. */
export function toggleHitboxes(g: Game): boolean {
  if (!DEV) return false
  g.showHitboxes = !g.showHitboxes
  console.log(`[ШАРОБОЙ][debug] хитбоксы: ${g.showHitboxes ? "вкл" : "выкл"}`)
  return g.showHitboxes
}

/** DEV (F3): замедление игры ×0.25 — видно медленно летящий шар и эффекты. */
export function toggleSlowMotion(g: Game): boolean {
  if (!DEV) return false
  g.slowMotion = !g.slowMotion
  console.log(`[ШАРОБОЙ][debug] замедление: ${g.slowMotion ? "вкл (×0.25)" : "выкл"}`)
  return g.slowMotion
}

/** DEV (F4): бессмертие — потеря шара/бомба не списывают жизни. */
export function toggleInvincible(g: Game): boolean {
  if (!DEV) return false
  g.invincible = !g.invincible
  console.log(`[ШАРОБОЙ][debug] бессмертие: ${g.invincible ? "вкл" : "выкл"}`)
  return g.invincible
}

/** Переключение эффекта отладки (вкл/выкл). */
export function toggleDebugEffect(g: Game, id: string) {
  const turnOn = !g.debugEffects.has(id)
  // Режимы формы/поворота ракетки взаимоисключающие: физика отскока и
  // управление реализуют один и тот же ресурс (форма/угол ракетки).
  const paddleModes = ["paddleRotation", "paddleImpulse", "paddleConvex", "paddleConcave"]
  if (turnOn) {
    for (const m of paddleModes) if (m !== id) g.debugEffects.delete(m)
  }
  if (g.debugEffects.has(id)) g.debugEffects.delete(id)
  else g.debugEffects.add(id)
  // Сброс поворота при смене режима, чтобы не оставался наклон
  if (paddleModes.includes(id)) {
    g.paddle.rot = 0
    g.paddleImpulse = null
    g.prevLeftDown = false
    g.prevRightDown = false
  }
  pushHud(g)
}

/** Активен ли эффект отладки. */
export function isDebugEffectActive(g: Game, id: string) {
  return g.debugEffects.has(id)
}
/** Принудительно спавнит щупальцевого босса (осьминог/кракен) для тестирования. */
export function spawnDebugBoss(g: Game, kind: "octopus" | "kraken") {
  g.debugBossType = kind
  // Арена отладки живёт по правилам бесконечного режима: mode по умолчанию
  // «campaign», и после убийства босса onLevelCleared ушёл бы на экран карты,
  // которого в отладке нет (campaign = null) — поле зависало пустым.
  g.mode = "endless"
  g.onBossNode = false
  g.blocks = []
  g.balls = []
  g.powers = []
  g.projectiles = []
  g.bossSys.clear()
  resetMiniboss(g)
  // Канонические параметры вида (как в кампании на 3-м ярусе боссов).
  const variant = fixedVariant(kind)
  const boss = buildOctopusBoss(g, variant.hp, variant)
  g.bossSys.spawn(boss)
  g.blocksInitial = Math.max(1, g.blocks.length)
  setBanner(g, `ФИНАЛЬНЫЙ БОСС: ${variant.name}`)
  if (g.phase === "menu") {
    g.phase = "playing"
    serveBall(g)
  }
  pushHud(g)
}
/** Отладочный спавн минибосса: обычная волна 1 + существо для тестирования. */
export function spawnDebugMiniboss(g: Game, kind: MinibossKind) {
  g.debugBossType = null
  g.mode = "endless"
  g.onBossNode = false
  g.balls = []
  g.powers = []
  g.projectiles = []
  g.bossSys.clear()
  g.boomQueue = []
  resetMiniboss(g)
  buildWave(g, 1)
  addMiniboss(g, kind)
  if (g.phase === "menu") g.phase = "playing"
  serveBall(g)
  setBanner(g, `МИНИ-БОСС: ${minibossName(kind)}`)
  pushHud(g)
}
export function debugDamageUp(g: Game) {
  g.debugBallDamage += 1
  g.sfx.ensure()
  g.sfx.ui()
  console.log(`[ШАРОБОЙ][debug] урон шара: ${g.debugBallDamage}`)
  pushHud(g)
}

/**
 * Скрытая отладочная клавиша («+» на цифровой клавиатуре): мгновенная
 * зачистка текущего уровня — блоки, минибоссы и босс убираются без взрывов
 * и без розыгрыша жизни, после чего обычный цикл сам переведёт кампанию
 * на карту (или бесконечный режим на следующую волну). ВРЕМЕННАЯ помощь
 * для быстрого прохождения уровней при отладке.
 */
export function debugSkipLevel(g: Game) {
  g.sfx.ensure()
  if (g.phase !== "playing") return
  g.minibosses = []
  g.mouthBubbles = []
  g.fishMouth = false
  g.blocks = []
  g.bossSys.clear()
  g.boomQueue = []
  // зачистка ждёт упавшую жизнь — для мгновенного перехода убираем её
  g.powers = g.powers.filter((p) => p.type !== "life")
  console.log("[ШАРОБОЙ][debug] уровень зачищен клавишей «+»")
  pushHud(g)
}

/** Ползунок громкости музыки (0..1). */
