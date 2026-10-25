import type { Game } from "../game"
import { clamp, compactInPlace, drainQueue } from "../utils"
import type { SparkHit } from "../types"
import { applyChronoRiftsToBalls } from "../bossChrono"
import { stepGravitationalFocus } from "../situational"
import { updateActiveChallenge } from "../campaignChallenges"

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

  if (g.bossTransmissionTimer > 0 && g.phase === "playing") {
    g.bossTransmissionTimer -= dt
    if (g.bossTransmissionTimer <= 0) {
      g.bossTransmission = null
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
  // Деструкция крутящихся блоков завершается после ровно одной секунды анимации.
  g.physics.finishSpinDeaths()

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
  stepGravitationalFocus(g, dt)
  g.bossSys.step(dt)
  /* Очереди отложенных событий: zero-alloc drain in-place. Нулевые задачи
     обрабатываются по расписанию; новые звенья, добавленные во время
     обработки (цепные взрывы бомб/искр), уходят в конец и бьют на следующих
     кадрах — раньше filter() аллоцировал два массива на кадр. */
  drainQueue(g.boomQueue, g.time, (q) => g.weaponsSys.explode(q.x, q.y))
  drainQueue(g.sparkQueue, g.time, (q) => strikeSpark(g, q))
  /* Страховка от «невидимых блоков»: снаряды и орбитальные миньоны принадлежат
     боссу — двигает и рисует их только он. Если босса уже нет (победа, смена
     арены, отладочный спавн), такие блоки остаются обычными коллайдерами:
     шар бьётся о пустоту, а зачистка уровня не наступает. Убираем их сразу. */
  if (
    !g.bossSys.boss &&
    g.blocks.some((b) => b.bomb || b.minionOrbit || b.isCryoPart || b.isLampreySeg || b.isClaw)
  ) {
    /* Список частей тела обязан совпадать с цепочкой взрывов в
       `BossSystem.kill()`: то, что рисует только рендер босса, не должно
       переживать его смерть. */
    for (const b of g.blocks) {
      if (b.bomb || b.minionOrbit || b.isCryoPart || b.isLampreySeg || b.isClaw) b.dead = true
    }
    compactInPlace(g.blocks, (b) => !b.dead)
  }

  /* Условие победы. Босс — самодостаточная цель: его смерть уже означает победу,
     и добивать оставшиеся блоки (тарелки крио-дрона, сегменты миноги, лёд) не
     нужно — раньше это превращалось в «босс мёртв, а уровень не кончается».
     Остатки арены убирает `BossSystem.kill()`; страховка ниже снимет то, что
     босс рисует сам, но не пометил как своё. */
  const bossDefeated = g.bossDefeated
  const customTargetsCleared =
    g.customWinCondition?.kind === "targets"
      ? g.customTargetBlocks.every((block) => block.dead)
      : g.blocks.length === 0
  const isLevelCleared =
    !g.bossSys.boss &&
    (bossDefeated || (g.mode === "custom" ? customTargetsCleared : g.blocks.length === 0))

  if (isLevelCleared) {
    for (const ball of g.balls) {
      ball.vx = 0
      ball.vy = 0
      ball.squash = 0
      ball.lost = false
      ball.trail = []
    }
  }

  const frozen = g.transition > 0 || g.bannerTimer > 1.1 || g.countdown > 0
  if (!frozen && !isLevelCleared) {
    if (g.activeChallenge) {
      updateActiveChallenge(g.activeChallenge, dt, {
        onSurviveWin: () => {
          for (const b of g.blocks) b.dead = true
          g.blocks = []
          g.fx.burst(g.w / 2, g.h * 0.4, "#ffd700", 24, 280)
          g.fx.popups.push({
            x: g.w / 2,
            y: g.h * 0.42,
            text: "ВЫЖИВАНИЕ ПРОЙДЕНО! 🏆",
            color: "#ffd700",
            t: 0,
            size: 24,
          })
          g.sfx.win()
          pushHud(g)
        },
        onTimeExpired: () => {
          g.fx.popups.push({
            x: g.w / 2,
            y: g.h * 0.42,
            text: "ВРЕМЯ ИСТЕКЛО! ИСПЫТАНИЕ ПРОВАЛЕНО",
            color: "#f87171",
            t: 0,
            size: 18,
          })
          g.sfx.loseLife()
          pushHud(g)
        },
      })
    }
    const fire = g.input.keys.space || g.input.consumeTapFire()
    g.weaponsSys.updateLaser(fire)
    g.weaponsSys.tryFire(dt, fire)
    g.weaponsSys.updateProjectiles(dt)
    if (g.bossSys.boss?.isChrono) {
      applyChronoRiftsToBalls(g.bossSys.boss.chronoRifts, g.balls, dt)
    }
    for (const ball of g.balls) g.physics.updateBall(ball, dt)
    g.physics.updateBombs(dt)
    compactInPlace(g.balls, (b) => !b.lost)
    if (g.balls.length === 0) loseLife(g)
  }

  for (const b of g.blocks) b.flash = Math.max(0, b.flash - dt * 5)

  updateMouthBubbles(g, dt)
  applyFishWake(g, dt)

  if (
    isLevelCleared &&
    g.transition <= 0 &&
    g.phase === "playing" &&
    g.boomQueue.length === 0 &&
    // Зачистка ждёт упавшую за минибосса жизнь: её нужно успеть поймать.
    !g.powers.some((p) => p.type === "life")
  ) {
    onLevelCleared(g)
  }
}
