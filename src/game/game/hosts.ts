import type { Game } from "../game"
import type { BossHost } from "../boss"
import type { PowersWorld } from "../powers"
import type { PhysicsWorld } from "../physics"
import type { WeaponsWorld } from "../weapons"
import { queueSparkChain, sparkChainTargets } from "../physics/spark"

import { addCoins } from "./progress"
import { pushHud } from "./hudSync"
import { blockSpawnTop, blockTop } from "./paddleControl"
import { isDebugEffectActive } from "./debug"
import { damageMiniboss } from "./minibossRuntime"
import { addRawScore, addScore, onBombHitPaddle, onBossKilled } from "./runFlow"

export function makeBossHost(g: Game): BossHost {
  return {
    get w() {
      return g.w
    },
    get h() {
      return g.h
    },
    get blockTop() {
      return blockTop(g)
    },
    get time() {
      return g.time
    },
    get shake() {
      return g.shake
    },
    set shake(v) {
      g.shake = v
    },
    get hitStop() {
      return g.hitStop
    },
    set hitStop(v) {
      g.hitStop = v
    },
    get flash() {
      return g.flash
    },
    set flash(v) {
      g.flash = v
    },
    get blocks() {
      return g.blocks
    },
    set blocks(v) {
      g.blocks = v
    },
    get powers() {
      return g.powers
    },
    get boomQueue() {
      return g.boomQueue
    },
    paddle: g.paddle,
    fx: g.fx,
    sfx: g.sfx,
    addRawScore: (n) => addRawScore(g, n),
    onBossKilled: () => onBossKilled(g),
    pushHud: () => pushHud(g),
  }
}
/** Хост для PowersSystem: таймеры спавна, поля эффектов и последствия. */
export function makePowersHost(g: Game): PowersWorld {
  return {
    get mode() {
      return g.mode
    },
    get w() {
      return g.w
    },
    get h() {
      return g.h
    },
    get time() {
      return g.time
    },
    get blockTop() {
      return blockTop(g)
    },
    get blockSpawnTop() {
      return blockSpawnTop(g)
    },
    paddle: g.paddle,
    get balls() {
      return g.balls
    },
    get blocks() {
      return g.blocks
    },
    get boss() {
      return g.bossSys.boss
    },
    get blocksInitial() {
      return g.blocksInitial
    },
    get powers() {
      return g.powers
    },
    set powers(v) {
      g.powers = v
    },
    get fieldShift() {
      return g.fieldShift
    },
    set fieldShift(v) {
      g.fieldShift = v
    },
    get spawnTimer() {
      return g.spawnTimer
    },
    set spawnTimer(v) {
      g.spawnTimer = v
    },
    get skyDropTimer() {
      return g.skyDropTimer
    },
    set skyDropTimer(v) {
      g.skyDropTimer = v
    },
    get shiftTimer() {
      return g.shiftTimer
    },
    set shiftTimer(v) {
      g.shiftTimer = v
    },
    get wideUntil() {
      return g.wideUntil
    },
    set wideUntil(v) {
      g.wideUntil = v
    },
    get slowUntil() {
      return g.slowUntil
    },
    set slowUntil(v) {
      g.slowUntil = v
    },
    get fastUntil() {
      return g.fastUntil
    },
    set fastUntil(v) {
      g.fastUntil = v
    },
    get shrinkUntil() {
      return g.shrinkUntil
    },
    set shrinkUntil(v) {
      g.shrinkUntil = v
    },
    get rocketUntil() {
      return g.rocketUntil
    },
    set rocketUntil(v) {
      g.rocketUntil = v
    },
    get fireUntil() {
      return g.fireUntil
    },
    set fireUntil(v) {
      g.fireUntil = v
    },
    get frostUntil() {
      return g.frostUntil
    },
    set frostUntil(v) {
      g.frostUntil = v
    },
    get sparkUntil() {
      return g.sparkUntil
    },
    set sparkUntil(v) {
      g.sparkUntil = v
    },
    get magnetUntil() {
      return g.magnetUntil
    },
    set magnetUntil(v) {
      g.magnetUntil = v
    },
    get magneticPaddleUntil() {
      return g.magneticPaddleUntil
    },
    set magneticPaddleUntil(v) {
      g.magneticPaddleUntil = v
    },
    get laserArmed() {
      return g.laserArmed
    },
    set laserArmed(v) {
      g.laserArmed = v
    },
    get laserArmedUntil() {
      return g.laserArmedUntil
    },
    set laserArmedUntil(v) {
      g.laserArmedUntil = v
    },
    paddleShape: () => g.paddleShapeKind(),
    get shield() {
      return g.shield
    },
    set shield(v) {
      g.shield = v
    },
    get lives() {
      return g.lives
    },
    set lives(v) {
      g.lives = v
    },
    get shake() {
      return g.shake
    },
    set shake(v) {
      g.shake = v
    },
    fx: g.fx,
    sfx: g.sfx,
    addCoins: (n) => addCoins(g, n),
    pushHud: () => pushHud(g),
    get buffDurationMult() {
      return 1 + 0.25 * (g.upgrades.buffDuration ?? 0)
    },
    get coinMagnetLevel() {
      return g.upgrades.coinMagnet ?? 0
    },
  }
}

/** Хост для Physics: кинематика ракетки/шара, предикаты эффектов, колбэки. */
export function makePhysicsHost(g: Game): PhysicsWorld {
  return {
    get aimAngle() {
      return g.aimAngle
    },
    get w() {
      return g.w
    },
    get h() {
      return g.h
    },
    get time() {
      return g.time
    },
    get blockTop() {
      return blockTop(g)
    },
    get blockSpawnTop() {
      return blockSpawnTop(g)
    },
    get debugBallDamage() {
      return g.debugBallDamage
    },
    paddle: g.paddle,
    get blocksInitial() {
      return g.blocksInitial
    },
    get boss() {
      return g.bossSys.boss
    },
    input: g.input,
    get balls() {
      return g.balls
    },
    get blocks() {
      return g.blocks
    },
    set blocks(v) {
      g.blocks = v
    },
    get powers() {
      return g.powers
    },
    get boomQueue() {
      return g.boomQueue
    },
    get shield() {
      return g.shield
    },
    set shield(v) {
      g.shield = v
    },
    get combo() {
      return g.combo
    },
    set combo(v) {
      g.combo = v
    },
    get shake() {
      return g.shake
    },
    set shake(v) {
      g.shake = v
    },
    get hitStop() {
      return g.hitStop
    },
    set hitStop(v) {
      g.hitStop = v
    },
    get flash() {
      return g.flash
    },
    set flash(v) {
      g.flash = v
    },
    fx: g.fx,
    sfx: g.sfx,
    fireActive: () =>
      g.time < g.fireUntil || (Boolean(g.campaignRelics?.relicFire) && g.combo >= 3),
    frostActive: () => g.time < g.frostUntil,
    sparkActive: () => g.time < g.sparkUntil,
    get sparkQueue() {
      return g.sparkQueue
    },
    slowActive: () => g.time < g.slowUntil,
    fastActive: () => g.time < g.fastUntil,
    magnetActive: () => g.time < g.magnetUntil,
    magneticPaddleActive: () => g.time < g.magneticPaddleUntil,
    paddleRotatable: () =>
      (g.upgrades.paddleRotation ?? 0) > 0 || isDebugEffectActive(g, "paddleRotation"),
    aimGuideActive: () => g.isAimGuideActive(),
    bounceGuideActive: () => g.isBounceGuideActive(),
    wideActive: () => g.time < g.wideUntil,
    shrinkActive: () => g.time < g.shrinkUntil,
    paddleShape: () => g.paddleShapeKind(),
    get bossCleanHits() {
      return g.bossCleanHits
    },
    set bossCleanHits(v) {
      g.bossCleanHits = v
    },
    resetBossCleanHits: () => {
      g.bossCleanHits = 0
    },
    get comboMasterLevel() {
      return g.upgrades.comboMaster ?? 0
    },
    addScore: (n, x, y, color, size) => addScore(g, n, x, y, color, size),
    dropPower: (x, y) => g.powersSys.dropPower(x, y),
    damageBoss: (dmg, fromWeapon, isCrit) => g.bossSys.damage(dmg, fromWeapon, isCrit),
    damageMiniboss: (dmg, block) => damageMiniboss(g, dmg, block),
    onBombHitPaddle: () => onBombHitPaddle(g),
    onPaddleBounce: () => {
      g.bossCleanHits = 0
      if (g.campaignRelics?.relicSpark) {
        g.campaignSparkBounceCount = (g.campaignSparkBounceCount ?? 0) + 1
        if (g.campaignSparkBounceCount >= 15) {
          g.campaignSparkBounceCount = 0
          const alive = g.blocks.filter((b) => !b.dead)
          if (alive.length > 0) {
            const sorted = [...alive].sort(
              (a, b) =>
                Math.hypot(a.x - g.paddle.x, a.y - g.paddle.y) -
                Math.hypot(b.x - g.paddle.x, b.y - g.paddle.y)
            )
            const target = sorted[0]
            queueSparkChain(
              g.sparkQueue,
              sparkChainTargets(g.blocks, target, { max: 4, radius: 120 }),
              { x: g.paddle.x, y: g.paddle.y - 10 },
              g.time
            )
            g.sfx.zap()
            g.fx.burst(g.paddle.x, g.paddle.y - 10, "#7cf5ff", 14, 190)
          }
        }
      }
    },
    pushHud: () => pushHud(g),
  }
}
/** Хост для WeaponsSystem: снаряды, поля лазера и урон делегируется системам. */
export function makeWeaponsHost(g: Game): WeaponsWorld {
  return {
    get time() {
      return g.time
    },
    paddle: g.paddle,
    get blocks() {
      return g.blocks
    },
    get boss() {
      return g.bossSys.boss
    },
    get projectiles() {
      return g.projectiles
    },
    set projectiles(v) {
      g.projectiles = v
    },
    get rocketUntil() {
      return g.rocketUntil
    },
    set rocketUntil(v) {
      g.rocketUntil = v
    },
    get weaponCd() {
      return g.weaponCd
    },
    set weaponCd(v) {
      g.weaponCd = v
    },
    get laserArmed() {
      return g.laserArmed
    },
    set laserArmed(v) {
      g.laserArmed = v
    },
    get laserArmedUntil() {
      return g.laserArmedUntil
    },
    set laserArmedUntil(v) {
      g.laserArmedUntil = v
    },
    get laserUntil() {
      return g.laserUntil
    },
    set laserUntil(v) {
      g.laserUntil = v
    },
    get laserWasOn() {
      return g.laserWasOn
    },
    set laserWasOn(v) {
      g.laserWasOn = v
    },
    // Пилоны оружия (лазер, ракеты) стоят на поверхности формы ракетки
    paddleShape: () => g.paddleShapeKind(),
    get shake() {
      return g.shake
    },
    set shake(v) {
      g.shake = v
    },
    get flash() {
      return g.flash
    },
    set flash(v) {
      g.flash = v
    },
    fx: g.fx,
    sfx: g.sfx,
    damageBlock: (b, dmg) => g.physics.damageBlock(b, dmg),
    damageBoss: (dmg, fromWeapon) => g.bossSys.damage(dmg, fromWeapon),
  }
}
