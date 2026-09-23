import type { Game } from "../game"
import { LEVELS } from "../levels"
import { rand, lsSet } from "../utils"

import { applyTrack } from "./audioControls"
import { enterMapView } from "./campaignFlow"
import { pushHud, saveTop, setBanner } from "./hudSync"
import { buildLevel, buildWave, serveBall } from "./levelBuild"

export function resetRun(g: Game) {
  g.bossSys.clear()
  g.boomQueue = []
  g.campaign = null
  g.campaignPlayerId = -1
  g.campaignVisited = []
  g.campaignVisible = []
  g.activeSpec = null
  g.onBossNode = false
  g.score = 0
  g.lives = 3 + (g.upgrades.life ?? 0)
  g.combo = 0
  g.level = 1
  g.newRecord = false
  g.runBossKills = 0
  g.runLivesLost = 0
  g.debugBallDamage = 1
  g.fx.clear()
  g.powers = []
  g.projectiles = []
  /* Ракетка начинает партию по центру: шар клеится на неё в serveBall,
       и они появляются вместе, а не в разных концах поля. */
  g.paddle.x = g.w / 2
  g.paddle.vx = 0
  g.paddle.rot = 0
  g.paddleImpulse = null
  g.prevLeftDown = false
  g.prevRightDown = false
  g.wideUntil = 0
  g.slowUntil = 0
  g.fastUntil = 0
  g.shrinkUntil = 0
  g.laserUntil = 0
  g.laserArmed = false
  g.rocketUntil = 0
  g.fireUntil = 0
  g.frostUntil = 0
  g.sparkUntil = 0
  g.sparkQueue = []
  g.magnetUntil = 0
  g.shield = 0
  g.weaponCd = 0
  g.effectsKey = ""
  g.transition = 0
}

export function launch(g: Game) {
  let launched = false
  for (const b of g.balls) {
    if (b.stuck) {
      b.stuck = false
      const ang = -Math.PI / 2 + rand(-0.3, 0.3)
      b.vx = Math.cos(ang) * b.speed
      b.vy = Math.sin(ang) * b.speed
      launched = true
    }
  }
  if (launched) {
    g.sfx.launch()
    pushHud(g)
  }
}

/* ---------- построение уровней ---------- */

export function addScore(g: Game, n: number, x: number, y: number, color: string, size: number) {
  g.score += Math.round(n)
  if (g.score > g.best) {
    g.best = g.score
    g.newRecord = true
    lsSet("sharoboy-best", String(g.best))
  }
  g.fx.popups.push({ x, y, text: `+${Math.round(n)}`, color, t: 0, size })
}

/* ---------- хост для BossSystem ---------- */

/** Начисление очков без попапа и проверки рекорда (как было в damageBoss/killBoss). */
export function addRawScore(g: Game, n: number) {
  g.score += n
}

/** Смерть босса засчитана в статистику партии (для достижений). */
export function onBossKilled(g: Game) {
  g.runBossKills++
}

/* ---------- переходы ---------- */

export function onLevelCleared(g: Game) {
  if (!g.levelLostBall) {
    g.score += 500
    if (g.score > g.best) {
      g.best = g.score
      g.newRecord = true
      lsSet("sharoboy-best", String(g.best))
    }
    g.fx.popups.push({
      x: g.w / 2,
      y: g.h * 0.42,
      text: "ЧИСТО! +500",
      color: "#5dffb0",
      t: 0,
      size: 26,
    })
    g.sfx.power()
  }
  g.flash = 1
  g.hitStop = Math.max(g.hitStop, 0.35)
  if (g.mode === "endless") {
    g.score += 200 + g.wave * 50
    g.lives = Math.min(g.lives + 1, 5)
    g.sfx.levelClear()
    g.wave++
    buildWave(g, g.wave)
    applyTrack(g) // новый случайный трек на новую волну
    clearAllEffects(g)
    g.balls = []
    serveBall(g)
    setBanner(g, g.wave % 5 === 0 ? `ВОЛНА ${g.wave} — БОСС!` : `ВОЛНА ${g.wave}`)
    pushHud(g)
    return
  }
  if (g.mode === "campaign") {
    if (g.onBossNode) {
      // Финальный босс карты повержен — забег пройден.
      g.onBossNode = false
      g.phase = "won"
      g.input.releaseLock()
      applyTrack(g)
      g.sfx.win()
      saveTop(g)
      pushHud(g)
      return
    }
    // Обычный узел зачищен — возвращаемся на карту за следующим шагом.
    g.sfx.levelClear()
    enterMapView(g)
    return
  }
  g.sfx.levelClear()
  g.level++
  buildLevel(g, g.level)
  applyTrack(g) // новый случайный трек на новый уровень
  clearAllEffects(g)
  g.balls = []
  serveBall(g)
  setBanner(g, `УРОВЕНЬ ${g.level} — ${LEVELS[g.level - 1].name}`)
  pushHud(g)
}

export function loseLife(g: Game) {
  // DEV-бессмертие (F4): жизнь не списывается — при потере шара просто
  // подаём новый, попадание бомбы игнорируется (шары остаются на месте).
  if (g.invincible) {
    if (g.balls.length === 0) serveBall(g)
    return
  }
  g.lives--
  g.runLivesLost++
  g.levelLostBall = true
  g.combo = 0
  g.shake = 10
  g.sfx.loseLife()
  g.wideUntil = 0
  g.slowUntil = 0
  g.fastUntil = 0
  g.shrinkUntil = 0
  g.laserUntil = 0
  g.laserArmed = false
  g.rocketUntil = 0
  g.fireUntil = 0
  g.frostUntil = 0
  g.sparkUntil = 0
  g.sparkQueue = []
  g.magnetUntil = 0
  g.weaponCd = 0
  g.powers = []
  g.projectiles = []
  g.paddle.rot = 0 // Сброс поворота при потере мяча
  g.paddleImpulse = null
  g.prevLeftDown = false
  g.prevRightDown = false
  if (g.lives <= 0) {
    g.phase = "over"
    g.input.releaseLock()
    applyTrack(g)
    g.sfx.gameOver()
    saveTop(g)
    pushHud(g)
    return
  }
  serveBall(g)
  pushHud(g)
}

/** Попадание бомбы осьминога по ракетке — отнимает жизнь. */
export function onBombHitPaddle(g: Game) {
  if (g.phase !== "playing") return
  loseLife(g)
}

/** Полный сброс временных эффектов между уровнями/волнами. */
export function clearAllEffects(g: Game) {
  g.slowUntil = 0
  g.fastUntil = 0
  g.shrinkUntil = 0
  g.laserUntil = 0
  g.laserArmed = false
  g.rocketUntil = 0
  g.fireUntil = 0
  g.frostUntil = 0
  g.sparkUntil = 0
  g.sparkQueue = []
  g.magnetUntil = 0
  g.weaponCd = 0
  g.shield = 0
  g.laserWasOn = false
  g.powers = []
  g.projectiles = []
  g.combo = 0
  g.paddle.rot = 0
  g.paddleImpulse = null
  g.prevLeftDown = false
  g.prevRightDown = false
  g.effectsKey = ""
  pushHud(g)
}
