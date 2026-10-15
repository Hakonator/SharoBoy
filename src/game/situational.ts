import type { Game } from "./game"
import { clamp } from "./utils"
import { blockTop } from "./game/paddleControl"

/**
 * Ситуативная механика: «Гравитационный фокус» (Gravitational Focus).
 * Активируется, когда на поле осталось мало блоков (<= 3) или мяч долго летает
 * без попаданий по блокам (sinceHit >= 9.0 сек при наличии живых блоков).
 *
 * 1. Оставшиеся блоки плавно дрейфуют ближе к центру поля (по X к w / 2,
 *    по Y к удобной зоне), облегчая прицеливание.
 * 2. Раз в 3.2 сек блок испускает резонансный импульс (кольцо fx + искры).
 * 3. При пролёте шара в радиусе 180px блок создаёт мягкое притяжение к своему центру,
 *    помогая шару доворачивать в блок и исключая раздражающие промахи в 1px.
 */
export function stepGravitationalFocus(g: Game, dt: number) {
  if (g.phase !== "playing" || g.bossSys.boss) return

  // Живые обычные блоки (не миньоны и не минибоссы)
  const targets = g.blocks.filter((b) => !b.dead && !b.isMiniboss && !b.minionOrbit && !b.bolt)
  if (targets.length === 0) return

  const isLowBlocks = targets.length <= 3
  const isStall = g.balls.some((b) => !b.stuck && b.sinceHit >= 9.0)

  if (!isLowBlocks && !isStall) return

  // Первое появление на уровне: стильное оповещение
  if (!g.focusAlertShown) {
    g.focusAlertShown = true
    g.fx.popups.push({
      x: g.w / 2,
      y: g.h * 0.32,
      text: "ФОКУС ЦЕЛИ!",
      color: "#00f0ff",
      t: 0,
      size: 20,
    })
    g.sfx.levelClear()
  }

  // 1. Плавный дрейф оставшихся блоков к комфортной зоне в центре
  const top = blockTop(g)
  const centerY = clamp(g.h * 0.38, top + 50, g.h * 0.5)

  for (let idx = 0; idx < targets.length; idx++) {
    const b = targets[idx]
    // Распределяем блоки слегка по горизонтали вокруг центра, если их несколько
    const offset = targets.length === 1 ? 0 : (idx - (targets.length - 1) / 2) * (b.rx * 2.6)
    const targetX = clamp(g.w / 2 + offset, b.rx + 20, g.w - b.rx - 20)
    const targetY = clamp(centerY, top + b.ry + 10, g.h * 0.5)

    // Плавный дрейф базовой позиции
    b.x0 += (targetX - b.x0) * 0.7 * dt
    b.y += (targetY - b.y) * 0.7 * dt
  }

  // 2. Периодический резонансный импульс-маячок (раз в 3.2 сек)
  g.focusPulseTimer = (g.focusPulseTimer ?? 0) + dt
  if (g.focusPulseTimer >= 3.2) {
    g.focusPulseTimer = 0
    for (const b of targets) {
      g.fx.rings.push({
        x: b.x,
        y: b.y,
        r: 8,
        maxR: 90,
        color: "rgba(0, 240, 255, 0.75)",
        t: 0,
      })
      g.fx.burst(b.x, b.y, "#00f0ff", 6, 130)
    }
  }

  // 3. Мягкое гравитационное притяжение пролетающего шара к ближайшему блоку
  for (const ball of g.balls) {
    if (ball.stuck) continue
    let nearestBlock = targets[0]
    let nearestDist = Infinity
    for (const b of targets) {
      const d = Math.hypot(b.x - ball.x, b.y - ball.y)
      if (d < nearestDist) {
        nearestDist = d
        nearestBlock = b
      }
    }
    const steerRadius = 180
    if (nearestDist < steerRadius && nearestDist > 1) {
      const factor = 1 - nearestDist / steerRadius
      const dirX = (nearestBlock.x - ball.x) / nearestDist
      const dirY = (nearestBlock.y - ball.y) / nearestDist
      const pull = 240 * factor * dt
      ball.vx += dirX * pull
      ball.vy += dirY * pull
    }
  }
}
