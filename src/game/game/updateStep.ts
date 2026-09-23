import type { Game } from "../game"
import { clamp, compactInPlace, drainQueue } from "../utils"
import type { SparkHit } from "../types"

import { pushHud, syncEffectsHud } from "./hudSync"
import { applyFishWake, updateMouthBubbles } from "./minibossFx"
import { stepBlock } from "./blockMotion"
import { updatePaddleRotation } from "./paddleControl"
import { draw } from "./drawScene"
import { loseLife, onLevelCleared } from "./runFlow"

/** Очередное звено цепи искр: молния-визуал, электрический треск и обычный урон. */
function strikeSpark(g: Game, q: SparkHit) {
  g.fx.lightnings.push({ x1: q.from.x, y1: q.from.y, x2: q.block.x, y2: q.block.y, t: 0 })
  if (q.block.dead) return
  g.sfx.zap()
  g.fx.burst(q.block.x, q.block.y, "#ffe95c", 6, 160)
  g.physics.damageBlock(q.block, g.debugBallDamage)
}

/** Игровой цикл: дельта времени, hit-stop, счётчик FPS, шаг update/draw. */
export function gameLoop(g: Game, t: number) {
  if (g.destroyed) return
  // Нескомпенсированная дельта нужна счётчику FPS: dtRaw зажат в 0.033 с,
  // и при реальном fps < 30 он бы занижал интервалы (fps казался выше).
  const rawDt = Math.max(0, (t - g.last) / 1000)
  const dtRaw = clamp(rawDt, 0, 0.033)
  g.fpsFrames++
  g.fpsElapsed += rawDt
  if (g.fpsElapsed >= 0.5) {
    g.fps = Math.round(g.fpsFrames / g.fpsElapsed)
    g.fpsFrames = 0
    g.fpsElapsed = 0
  }
  g.last = t
  if (g.hitStop > 0) g.hitStop = Math.max(0, g.hitStop - dtRaw)
  /* DEV (F3): slowMotion замедляет весь мир, но не счётчик FPS (он считает
     по rawDt) и не hit-stop, который умножается первым. */
  const dt = (g.hitStop > 0 ? dtRaw * 0.18 : dtRaw) * (g.slowMotion ? 0.25 : 1)
  g.time += dt
  g.flash = Math.max(0, g.flash - dtRaw * 2.6)
  try {
    update(g, dt)
    draw(g)
  } catch (err) {
    console.error("[ШАРОБОЙ] ошибка в игровом цикле:", err)
  }
  g.raf = requestAnimationFrame((next) => gameLoop(g, next))
}

export function update(g: Game, dt: number) {
  g.shake = Math.max(0, g.shake - dt * 26)

  g.fx.step(dt)

  for (const b of g.bubbles) {
    b.y -= b.vy * dt
    b.x += Math.sin(g.time * 0.8 + b.ph) * 12 * dt
    if (b.y < -20) {
      b.y = g.h + 20
      b.x = Math.random() * g.w
    }
  }

  if (g.countdown > 0 && g.phase === "playing") {
    const prev = Math.ceil(g.countdown)
    g.countdown = Math.max(0, g.countdown - dt)
    if (g.countdown > 0 && Math.ceil(g.countdown) !== prev) g.sfx.ui()
  }

  if (g.bannerTimer > 0 && g.phase === "playing") {
    g.bannerTimer -= dt
    if (g.bannerTimer <= 0) {
      g.banner = null
      pushHud(g)
    }
  }

  if (g.transition > 0 && g.phase === "playing") {
    g.transition -= dt
    if (g.transition <= 0) pushHud(g)
  }

  // живые ряды: маршрутизатор траекторий (покачивание, дрейф §6, пульсация,
  // вращение, кулдаун порталов)
  for (const b of g.blocks) stepBlock(g, b, dt)

  // плавный дрейф поля
  if (g.fieldShift) {
    const fs = g.fieldShift
    fs.t += dt
    const k = clamp(fs.t / fs.dur, 0, 1)
    const e = k * k * (3 - 2 * k)
    for (const b of g.blocks) {
      if (b.minionOrbit) continue
      b.x0 = clamp(b.x0 + fs.dx * e * dt, b.rx + 4, g.w - b.rx - 4)
      b.y = clamp(b.y + fs.dy * e * dt, b.ry + 4, g.h * 0.8)
    }
    if (k >= 1) g.fieldShift = null
  }

  if (g.phase !== "playing") return

  syncEffectsHud(g)
  g.physics.updatePaddle(dt)
  updatePaddleRotation(g, dt)
  /* Прилипший шар следует за ракеткой даже пока мир заморожен баннером/отсчётом:
       иначе на старте партии шар оставался на точке спавна, а ракетка уезжала к курсору. */
  for (const ball of g.balls) g.physics.stickToPaddle(ball)
  g.powersSys.updatePowers(dt)
  g.powersSys.periodicSpawn(dt)
  g.powersSys.periodicPowerDrop(dt)
  g.powersSys.tryFieldShift(dt)
  g.bossSys.step(dt)
  /* Очереди отложенных событий: zero-alloc drain in-place. Нулевые задачи
     обрабатываются по расписанию; новые звенья, добавленные во время
     обработки (цепные взрывы бомб/искр), уходят в конец и бьют на следующих
     кадрах — раньше filter() аллоцировал два массива на кадр. */
  drainQueue(g.boomQueue, g.time, (q) => g.weaponsSys.explode(q.x, q.y))
  drainQueue(g.sparkQueue, g.time, (q) => strikeSpark(g, q))

  const frozen = g.transition > 0 || g.bannerTimer > 1.1 || g.countdown > 0
  if (!frozen) {
    const fire = g.input.keys.space || g.input.consumeTapFire()
    g.weaponsSys.updateLaser(fire)
    g.weaponsSys.tryFire(dt, fire)
    g.weaponsSys.updateProjectiles(dt)
    for (const ball of g.balls) g.physics.updateBall(ball, dt)
    g.physics.updateBombs(dt)
    compactInPlace(g.balls, (b) => !b.lost)
    if (g.balls.length === 0) loseLife(g)
  }

  for (const b of g.blocks) b.flash = Math.max(0, b.flash - dt * 5)

  updateMouthBubbles(g, dt)
  applyFishWake(g, dt)

  if (
    g.blocks.length === 0 &&
    !g.bossSys.boss &&
    g.transition <= 0 &&
    g.phase === "playing" &&
    // Зачистка ждёт упавшую за минибосса жизнь: её нужно успеть поймать.
    !g.powers.some((p) => p.type === "life")
  ) {
    onLevelCleared(g)
  }
}
