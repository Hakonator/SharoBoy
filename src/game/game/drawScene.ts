import { DEBUG_TOOLS } from "../../config"
import { gradient } from "../render/gradCache"
import type { Game } from "../game"
import {
  drawBackground,
  drawBalls,
  drawBlocks,
  drawBoss,
  drawDebugFlags,
  drawFps,
  drawHitboxes,
  drawLaserBeams,
  drawMinibossBar,
  drawMinibosses,
  drawLightnings,
  drawMouthBubbles,
  drawPaddle,
  drawParticles,
  drawPopups,
  drawPowers,
  drawProjectiles,
  drawRings,
  drawShieldLine,
  drawTopZone,
} from "../render"
import { rand } from "../utils"

import { blockTop } from "./paddleControl"

export function draw(g: Game) {
  const { ctx, w, h } = g
  ctx.clearRect(0, 0, w, h)

  /* Страховка от «мигания»: если какой-то кадр упал посреди отрисовки
       (ошибка гасится в loop), глобальное состояние контекста могло остаться
       грязным — начинаем каждый кадр с заведомо полной альфой, иначе после
       сбоя шар/ракетка рисовались бы призрачными до ближайшего сброса. */
  ctx.globalAlpha = 1

  ctx.save()
  if (g.shake > 0) {
    ctx.translate(rand(-g.shake, g.shake), rand(-g.shake, g.shake))
  }

  drawBackground(ctx, w, h, g.combo, g.bubbles)
  drawShieldLine(ctx, w, h, g.time, g.shield, g.phase === "menu")
  drawBlocks(ctx, g.blocks, g.time)
  drawMinibosses(ctx, g.blocks, g.time)
  drawMouthBubbles(ctx, g.mouthBubbles)
  drawMinibossBar(ctx, g.minibosses, g.blocks)
  drawBoss(ctx, g.bossSys.boss, g.balls, g.blocks)
  drawRings(ctx, g.fx.rings)
  drawLightnings(ctx, g.fx.lightnings)
  drawPowers(ctx, g.powers)
  drawLaserBeams(ctx, {
    time: g.time,
    hidden: g.phase === "menu",
    laserUntil: g.laserUntil,
    paddle: g.paddle,
    blocks: g.blocks,
    boss: g.bossSys.boss,
    // Пилоны лазера стоят на поверхности формы ракетки (согласовано с weapons)
    shape: g.paddleShapeKind(),
  })
  drawProjectiles(ctx, g.projectiles, g.time)
  drawBalls(ctx, g.balls, {
    time: g.time,
    hidden: g.phase === "menu",
    fire: g.time < g.fireUntil,
    frost: g.time < g.frostUntil,
    spark: g.time < g.sparkUntil,
    slow: g.time < g.slowUntil,
    fast: g.time < g.fastUntil,
  })
  if (g.phase !== "menu" && g.phase !== "map") {
    drawPaddle(ctx, {
      p: g.paddle,
      time: g.time,
      wideUntil: g.wideUntil,
      shrinkUntil: g.shrinkUntil,
      laserUntil: g.laserUntil,
      laserArmed: g.laserArmed,
      rocketUntil: g.rocketUntil,
      magnetUntil: g.magnetUntil,
      shape: g.paddleShapeKind(),
    })
  }
  drawParticles(ctx, g.fx.particles)
  drawPopups(ctx, g.fx.popups)

  // неигровая HUD-зона существует только на вертикальном экране (blockTop = 0
  // в ландшафте): затемнение + пунктирная линия отскока — в бою и в портрете
  const inPlay = g.phase === "playing" || g.phase === "paused"
  drawTopZone(ctx, w, blockTop(g), !inPlay || g.h <= g.w)

  // DEV (F2): хитбоксы поверх сущностей, но под экранным текстом.
  if (g.showHitboxes) {
    drawHitboxes(ctx, {
      blocks: g.blocks,
      balls: g.balls,
      paddle: g.paddle,
      paddleRot: g.paddle.rot ?? 0,
      boss: g.bossSys.boss,
      powers: g.powers,
      projectiles: g.projectiles,
    })
  }

  ctx.restore()

  if (g.flash > 0) {
    ctx.fillStyle = `rgba(234,247,255,${g.flash * 0.3})`
    ctx.fillRect(0, 0, w, h)
  }

  if (g.countdown > 0 && g.phase === "playing") {
    ctx.fillStyle = "rgba(4,16,26,0.45)"
    ctx.fillRect(0, 0, w, h)
    const n = Math.ceil(g.countdown)
    const frac = g.countdown - Math.floor(g.countdown)
    ctx.save()
    ctx.translate(w / 2, h * 0.44)
    ctx.scale(0.8 + frac * 0.5, 0.8 + frac * 0.5)
    ctx.font = '120px "Russo One", sans-serif'
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = "#35e0ff"
    ctx.shadowBlur = 34
    ctx.fillStyle = "#eaf7ff"
    ctx.fillText(String(n), 0, 0)
    ctx.restore()
  }

  // виньетка: кэшированный градиент (зависит только от размеров экрана)
  ctx.fillStyle = gradient(ctx, `vignette:${w}x${h}`, (c) => {
    const vg = c.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.42,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.75
    )
    vg.addColorStop(0, "rgba(0,0,0,0)")
    vg.addColorStop(1, "rgba(2,10,16,0.55)")
    return vg
  })
  ctx.fillRect(0, 0, w, h)

  // Счётчик FPS: мелкий текст в левом нижнем углу, размер в экранных
  // пикселях не зависит от масштаба мира (~11 css px, минимум 9).
  // Отладка: FPS — F1, хитбоксы — F2, замедление — F3, бессмертие — F4.
  if (g.showFps) {
    drawFps(ctx, w, h, g.fps, Math.max(9, Math.round(11 / g.scale)))
  }
  if (DEBUG_TOOLS) {
    drawDebugFlags(ctx, w, h, g.slowMotion, g.invincible, Math.max(9, Math.round(11 / g.scale)))
  }
}
