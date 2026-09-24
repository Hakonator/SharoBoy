import type { Game } from "../game"
import type { BossHost } from "../boss"
import type { PowersWorld } from "../powers"

import { addCoins } from "./progress"
import { pushHud } from "./hudSync"
import { blockTop } from "./paddleControl"
import { addRawScore, onBossKilled } from "./runFlow"

export function makeBossHost(g: Game): BossHost {
  return {
    get w() {
      return g.w
    },
    get h() {
      return g.h
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
  }
}

/** Хост для Physics: кинематика ракетки/шара, предикаты эффектов, колбэки. */
