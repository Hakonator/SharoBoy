import type { Game } from "../game"
import type { PhysicsWorld } from "../physics"
import type { WeaponsWorld } from "../weapons"

import { isDebugEffectActive } from "./debug"
import { blockTop } from "./paddleControl"
import { damageMiniboss } from "./minibossRuntime"
import { pushHud } from "./hudSync"
import { addScore, onBombHitPaddle } from "./runFlow"

export function makePhysicsHost(g: Game): PhysicsWorld {
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
    get blockTop() {
      return blockTop(g)
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
    fireActive: () => g.time < g.fireUntil,
    frostActive: () => g.time < g.frostUntil,
    sparkActive: () => g.time < g.sparkUntil,
    get sparkQueue() {
      return g.sparkQueue
    },
    slowActive: () => g.time < g.slowUntil,
    fastActive: () => g.time < g.fastUntil,
    magnetActive: () => g.time < g.magnetUntil,
    paddleRotatable: () => isDebugEffectActive(g, "paddleRotation"),
    wideActive: () => g.time < g.wideUntil,
    shrinkActive: () => g.time < g.shrinkUntil,
    paddleShape: () => g.paddleShapeKind(),
    addScore: (n, x, y, color, size) => addScore(g, n, x, y, color, size),
    dropPower: (x, y) => g.powersSys.dropPower(x, y),
    damageBoss: (dmg, fromWeapon) => g.bossSys.damage(dmg, fromWeapon),
    damageMiniboss: (dmg, block) => damageMiniboss(g, dmg, block),
    onBombHitPaddle: () => onBombHitPaddle(g),
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
