/**
 * Поведение специальных блоков при ударе шара (§6): пружина/вата — временные
 * множители скорости, крутящийся — угловой импульс, телепорт — переброс в пару.
 * Хук вызывается из collideBlocks до расчёта отражения; возвращает true,
 * если контакт поглощён полностью (телепорт) — отражение не нужно.
 */
import type { PhysicsWorld } from "../physics"
import type { Ball, Block } from "../types"
import {
  COTTON_SPEED_MULT,
  COTTON_TIME,
  PORTAL_CD,
  SPIN_KICK,
  SPIN_MAX,
  SPRING_SPEED_MULT,
  SPRING_TIME,
} from "../blockKinds"
import { clamp } from "../utils"

/** Временные таймеры шара (пружина/вата) тикают вниз. */
export function applyBallTimers(ball: Ball, dt: number) {
  if (ball.springT) ball.springT = Math.max(0, ball.springT - dt)
  if (ball.cottonT) ball.cottonT = Math.max(0, ball.cottonT - dt)
}

/** Итоговый множитель целевой скорости шара от пружины/ваты. */
export function specialSpeedMult(ball: Ball): number {
  const spring = (ball.springT ?? 0) > 0 ? SPRING_SPEED_MULT : 1
  const cotton = (ball.cottonT ?? 0) > 0 ? COTTON_SPEED_MULT : 1
  return spring * cotton
}

/**
 * Реакция специального блока на контакт с шаром. lx/ex — локальные координаты
 * удара (как в collideBlocks). true — контакт поглощён (телепорт).
 */
export function onBallHitSpecial(
  g: PhysicsWorld,
  b: Block,
  ball: Ball,
  lx: number,
  ex: number
): boolean {
  const sp = b.sp
  if (!sp) return false
  // пружина/вата: таймеры на шаре; блок отражает и получает урон как обычно
  if (sp.spring && (ball.springT ?? 0) <= 0) {
    ball.springT = SPRING_TIME
    g.sfx.spring()
    g.fx.burst(b.x, b.y, "#ffc94d", 6, 120)
  }
  if (sp.cotton && (ball.cottonT ?? 0) <= 0) {
    ball.cottonT = COTTON_TIME
    g.sfx.thud()
    g.fx.burst(b.x, b.y, "#e8e2f6", 6, 90)
  }
  // крутящийся: импульс от удара в одну из половин, сильнее к краю
  if (sp.rotVel !== undefined) {
    const side = lx >= 0 ? 1 : -1
    const edge = Math.min(1, Math.abs(lx) / (ex || 1))
    sp.rotVel = clamp(sp.rotVel + side * SPIN_KICK * (0.4 + 0.6 * edge), -SPIN_MAX, SPIN_MAX)
  }
  // телепорт: переброс в парный блок, контакт поглощён целиком
  if (sp.portalId !== undefined) return portalTransit(g, b, ball)
  return false
}

/** Прыжок в парный портал: выход по вектору скорости, кулдаун на всю пару. */
function portalTransit(g: PhysicsWorld, b: Block, ball: Ball): boolean {
  const sp = b.sp!
  if ((sp.portalCd ?? 0) > 0) return false
  let partner: Block | null = null
  for (const o of g.blocks) {
    if (o !== b && !o.dead && o.sp?.portalId === sp.portalId) {
      partner = o
      break
    }
  }
  if (!partner) return false
  const speed = Math.hypot(ball.vx, ball.vy) || 1
  ball.x = partner.x + (ball.vx / speed) * (partner.rx + ball.r + 2)
  ball.y = partner.y + (ball.vy / speed) * (partner.ry + ball.r + 2)
  sp.portalCd = PORTAL_CD
  partner.sp!.portalCd = PORTAL_CD
  ball.sinceHit = 0
  ball.trail.length = 0 // хвост не должен тянуться через весь экран
  g.sfx.warp()
  g.fx.rings.push({ x: b.x, y: b.y, r: 6, maxR: 60, color: "rgba(176,108,255,0.8)", t: 0 })
  g.fx.rings.push({
    x: partner.x,
    y: partner.y,
    r: 6,
    maxR: 60,
    color: "rgba(176,108,255,0.8)",
    t: 0,
  })
  return true
}
