import type { Game } from "../game"
import { LEVELS } from "../levels"
import { rand, lsSet } from "../utils"
import { nodeById } from "../campaignMap"
import { computeRunMultipliers, hasModifier } from "../campaignModifiers"
import { recordChallengeBallLost } from "../campaignChallenges"

import { applyTrack } from "./audioControls"
import { enterMapView } from "./campaignFlow"
import { pushHud, saveTop, setBanner } from "./hudSync"
import { buildLevel, buildWave, serveBall } from "./levelBuild"
import { blockTop } from "./paddleControl"
import { addCoins, addMetaCrystals } from "./progress"

export function resetRun(g: Game) {
  g.customWinCondition = null
  g.customTargetBlocks = []
  g.onCustomComplete = null
  g.bossSys.clear()
  g.boomQueue = []
  g.campaign = null
  g.campaignPlayerId = -1
  g.campaignVisited = []
  g.campaignVisible = []
  g.campaignShop = null
  g.campaignShops = {}
  g.campaignEventData = null
  g.campaignPerks = {}
  g.campaignRelics = {}
  g.campaignSparkBounceCount = 0
  g.activeSpec = null
  g.onBossNode = false
  g.activeChallenge = null
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
  g.magneticPaddleUntil = 0
  g.aimAngle = -Math.PI / 2
  g.shield = (g.upgrades.shieldStart ?? 0) > 0 ? 1 : 0
  g.bossCleanHits = 0
  g.weaponCd = 0
  g.effectsKey = ""
  g.transition = 0
  g.sfx.setUnderwater(false)
}

export function launch(g: Game) {
  let launched = false
  for (const b of g.balls) {
    if (b.stuck) {
      b.stuck = false
      const ang = g.isAimGuideActive() ? g.aimAngle : -Math.PI / 2 + rand(-0.3, 0.3)
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
  const { scoreMultiplier } = computeRunMultipliers(g.campaignModifiers)
  const finalN = Math.round(n * scoreMultiplier)
  g.score += finalN
  if (g.score > g.best) {
    g.best = g.score
    g.newRecord = true
    lsSet("sharoboy-best", String(g.best))
  }
  g.fx.popups.push({ x, y, text: `+${finalN}`, color, t: 0, size })
}

/* ---------- хост для BossSystem ---------- */

/** Начисление очков без попапа и проверки рекорда (как было в damageBoss/killBoss). */
export function addRawScore(g: Game, n: number) {
  g.score += n
}

/** Смерть босса засчитана в статистику партии (для достижений). */
export function onBossKilled(g: Game) {
  g.runBossKills++
  /* Победа над боссом сама по себе закрывает уровень: `updateStep` считает
     `bossDefeated` достаточным условием и не ждёт зачистки остатков арены. */
  g.bossDefeated = true
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
  if (g.mode === "custom") {
    finishCustomRun(g, "won")
    return
  }
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
      g.onBossNode = false
      const isFinalBoss = !g.campaign || g.campaignPlayerId === g.campaign.bossId
      if (isFinalBoss) {
        if (!g.finalBossDefeated && g.activeBossKind) {
          g.finalBossDefeated = g.activeBossKind
        }
        // Финальный босс карты повержен — забег пройден.
        g.phase = "won"
        const mult = g.campaignRelics.relicConverter ? 1.5 : 1.0
        const earnedCoins = Math.round(g.crystalsRunTotal * mult)
        if (earnedCoins > 0) {
          addCoins(g, earnedCoins)
        }
        g.crystalsRunTotal = 0
        addMetaCrystals(g, 150)
        g.input.releaseLock()
        applyTrack(g)
        g.sfx.win()
        // Эпилог: бронестворки станции раскрываются, крио-биогель стравливается
        // в вакуум — сцена финального экрана звучит синхронно с анимацией.
        g.sfx.stationHatch()
        g.sfx.gelVent()
        saveTop(g)
        pushHud(g)
        return
      }

      // Промежуточный босс Акта повержен: награда несгораемыми мета-кристаллами
      const currentNode = g.campaign ? nodeById(g.campaign, g.campaignPlayerId) : undefined
      const actNumber = currentNode && currentNode.tier < 15 ? 1 : 2
      const actReward = actNumber === 1 ? 25 : 50
      addMetaCrystals(g, actReward)
      if (g.shield < 3) {
        g.shield++
      }
      g.fx.popups.push({
        x: g.w / 2,
        y: g.h * 0.45,
        text: `АКТ ${actNumber === 1 ? "I" : "II"} ПРОЙДЕН! +${actReward} 💠`,
        color: "#38bdf8",
        t: 0,
        size: 24,
      })
      g.sfx.levelClear()
      enterMapView(g)
      return
    }
    // Обычный или элитный узел зачищен: награда кристаллами и щитом
    const currentNode = g.campaign ? nodeById(g.campaign, g.campaignPlayerId) : undefined
    const challenge = g.activeChallenge
    const veinMult = 1 + 0.25 * (g.upgrades.crystalVein ?? 0)

    if (challenge) {
      if (!challenge.failed) {
        // Успешное прохождение квеста-испытания!
        const meta = challenge.def.rewardMeta
        const crystals = Math.round(challenge.def.rewardCrystals * veinMult)
        addMetaCrystals(g, meta)
        g.addCrystals(crystals)
        if (g.shield < 3) g.shield++
        g.fx.popups.push({
          x: g.w / 2,
          y: g.h * 0.46,
          text: `ИСПЫТАНИЕ ПРОЙДЕНО! +${meta} 💠 +${crystals} 💎`,
          color: "#38bdf8",
          t: 0,
          size: 24,
        })
        g.sfx.win()
      } else {
        // Испытание провалено
        const crystals = Math.round(15 * veinMult)
        g.addCrystals(crystals)
        g.fx.popups.push({
          x: g.w / 2,
          y: g.h * 0.48,
          text: `ИСПЫТАНИЕ ПРОВАЛЕНО! +${crystals} 💎`,
          color: "#f87171",
          t: 0,
          size: 20,
        })
        g.sfx.levelClear()
      }
      g.activeChallenge = null
      enterMapView(g)
      return
    }

    const isChallenge = currentNode?.isChallenge ?? false
    const baseWinCrystals = Math.round((isChallenge ? 40 : 10) * veinMult)
    g.addCrystals(baseWinCrystals)
    if (isChallenge && g.shield < 3) {
      g.shield++
    }
    g.fx.popups.push({
      x: g.w / 2,
      y: g.h * 0.48,
      text: isChallenge ? `ИСПЫТАНИЕ! +${baseWinCrystals} 💎` : `ПОБЕДА! +${baseWinCrystals} 💎`,
      color: isChallenge ? "#e879f9" : "#c084fc",
      t: 0,
      size: 22,
    })
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
  if (g.activeChallenge) {
    recordChallengeBallLost(g.activeChallenge, () => {
      g.fx.popups.push({
        x: g.w / 2,
        y: g.h * 0.42,
        text: "ИСПЫТАНИЕ ПРОВАЛЕНО!",
        color: "#f87171",
        t: 0,
        size: 20,
      })
      pushHud(g)
    })
  }
  if (hasModifier(g.campaignModifiers, "ironman")) {
    g.lives = 0
  } else {
    g.lives--
  }
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
  g.magneticPaddleUntil = 0
  g.weaponCd = 0
  g.powers = []
  g.projectiles = []
  g.paddle.rot = 0 // Сброс поворота при потере мяча
  g.paddleImpulse = null
  g.prevLeftDown = false
  g.prevRightDown = false
  if (g.lives <= 0) {
    if (g.mode === "custom") {
      finishCustomRun(g, "over")
      return
    }
    if (g.mode === "campaign") {
      const mult = g.campaignRelics.relicConverter ? 1.5 : 1.0
      const earnedCoins = Math.round(g.crystalsRunTotal * mult)
      if (earnedCoins > 0) {
        addCoins(g, earnedCoins)
      }
      g.crystalsRunTotal = 0
    }
    g.phase = "over"
    g.input.releaseLock()
    applyTrack(g)
    g.sfx.gameOver()
    saveTop(g)
    pushHud(g)
    return
  }
  // Ситуативная механика: «Тактическое снабжение» (Tactical Aid)
  // При критическом положении (осталась 1 жизнь) игроку сбрасывается спасительный бонус
  if (g.lives === 1) {
    const aidType = g.shield === 0 ? "shield" : "wide"
    g.powers.push({
      x: g.w / 2 + rand(-60, 60),
      y: blockTop(g) + 15,
      vy: 110,
      type: aidType,
      t: 0,
    })
    g.fx.popups.push({
      x: g.w / 2,
      y: g.h * 0.42,
      text: aidType === "shield" ? "ПОДДЕРЖКА: ЩИТ!" : "ПОДДЕРЖКА: ШИРОКАЯ РАКЕТКА!",
      color: "#5dffb0",
      t: 0,
      size: 18,
    })
  } else if (g.lives === 2 && Math.random() < 0.6) {
    const aidType = Math.random() < 0.5 ? "wide" : "slow"
    g.powers.push({
      x: g.w / 2 + rand(-80, 80),
      y: blockTop(g) + 15,
      vy: 110,
      type: aidType,
      t: 0,
    })
    g.fx.popups.push({
      x: g.w / 2,
      y: g.h * 0.42,
      text: "ПОДДЕРЖКА СНАБЖЕНИЕМ!",
      color: "#5dffb0",
      t: 0,
      size: 16,
    })
  }
  serveBall(g)
  pushHud(g)
}

function finishCustomRun(g: Game, result: "won" | "over") {
  const onComplete = g.onCustomComplete
  g.onCustomComplete = null
  g.toMenu()
  onComplete?.(result)
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
  g.magneticPaddleUntil = 0
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
