import { PaddleShapeKind, PaddleState, RenderView } from "../types"
import { Physics } from "../physics"
import { clamp } from "../utils"

import { roundRect, type Ctx } from "./shapes"

export interface PaddleView extends RenderView {
  p: PaddleState
  wideUntil: number
  shrinkUntil: number
  laserUntil: number
  laserArmed: boolean
  rocketUntil: number
  magnetUntil: number
  /** Форма верхней поверхности: «convex» — купол, «concave» — чаша. */
  shape?: PaddleShapeKind
}

export function drawPaddle(ctx: Ctx, v: PaddleView) {
  const p = v.p
  const time = v.time
  const ww = p.w * (1 + p.squash * 0.12)
  const hh = p.h * (1 - p.squash * 0.3)
  ctx.save()
  ctx.translate(p.x, p.y)
  // В режиме отладки ракетка поворачивается по ЛКМ/ПКМ, иначе — лёгкий наклон от скорости
  ctx.rotate(p.rot ?? clamp(p.vx * 0.00011, -0.1, 0.1))
  const wide = time < v.wideUntil
  const shrink = !wide && time < v.shrinkUntil
  ctx.shadowColor = wide ? "#ffc94d" : shrink ? "#ff5347" : "#35e0ff"
  ctx.shadowBlur = 22
  const g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2)
  if (wide) {
    g.addColorStop(0, "#ffe9a8")
    g.addColorStop(0.5, "#ffc94d")
    g.addColorStop(1, "#c07f0e")
  } else if (shrink) {
    g.addColorStop(0, "#ffb8b0")
    g.addColorStop(0.5, "#ff5347")
    g.addColorStop(1, "#8f1d12")
  } else {
    g.addColorStop(0, "#aef7ff")
    g.addColorStop(0.5, "#35e0ff")
    g.addColorStop(1, "#0e86a3")
  }
  ctx.fillStyle = g
  const shape = v.shape ?? "flat"
  if (shape === "convex") {
    // Купол — лента постоянной толщины hh (парабола ∩): верх приподнят,
    // нижняя поверхность — та же дуга, сдвинутая на hh вниз. Торцы скруглены.
    const bump = Physics.convexBump(ww / 2)
    const rr = Math.min(hh * 0.5, 9)
    const cap = bump * 0.16
    const topE = -hh / 2 - cap
    const topC = -hh / 2 - bump
    const botC = topC + hh
    ctx.beginPath()
    ctx.moveTo(-ww / 2 + rr, hh / 2)
    ctx.quadraticCurveTo(-ww / 2, hh / 2, -ww / 2, hh / 2 - rr)
    ctx.lineTo(-ww / 2, -hh / 2 + rr)
    ctx.quadraticCurveTo(-ww / 2, -hh / 2, -ww / 2 + rr * 1.4, topE)
    ctx.quadraticCurveTo(-ww / 4, topC, 0, topC)
    ctx.quadraticCurveTo(ww / 4, topC, ww / 2 - rr * 1.4, topE)
    ctx.quadraticCurveTo(ww / 2, -hh / 2, ww / 2, -hh / 2 + rr)
    ctx.lineTo(ww / 2, hh / 2 - rr)
    ctx.quadraticCurveTo(ww / 2, hh / 2, ww / 2 - rr, hh / 2)
    ctx.quadraticCurveTo(ww / 4, botC, 0, botC)
    ctx.quadraticCurveTo(-ww / 4, botC, -ww / 2 + rr, hh / 2)
    ctx.closePath()
    ctx.fill()
  } else if (shape === "concave") {
    // Чаша — лента постоянной толщины hh, инверсия купола. Верх и низ — дуги ∪
    // (края подняты на bump, центр на грани; низ — та же дуга ниже на hh),
    // торцы — полукруги радиуса hh/2 (как у купола): гладкая капсула-конец.
    const depth = Physics.convexBump(ww / 2)
    const topE = -hh / 2 - depth // край верха (поднят)
    const topC = -hh / 2 // центр верха на грани
    const botE = topE + hh // край низа
    const botC = topC + hh // центр низа
    const hr = hh / 2 // радиус торцового полукруга
    const cy = topE + hr // центр торцов (середина толщины)
    const cxL = -ww / 2 + hr
    const cxR = ww / 2 - hr
    ctx.beginPath()
    // левый торец → верхняя дуга → правый торец
    ctx.moveTo(cxL, topE)
    ctx.quadraticCurveTo(-ww / 4, topC, 0, topC)
    ctx.quadraticCurveTo(ww / 4, topC, cxR, topE)
    ctx.arc(cxR, cy, hr, -Math.PI / 2, Math.PI / 2, false)
    // нижняя дуга (та же ∪-дуга на hh ниже)
    ctx.quadraticCurveTo(ww / 4, botC, 0, botC)
    ctx.quadraticCurveTo(-ww / 4, botC, cxL, botE)
    ctx.arc(cxL, cy, hr, -Math.PI / 2, Math.PI / 2, true)
    ctx.closePath()
    ctx.fill()
  } else {
    roundRect(ctx, -ww / 2, -hh / 2, ww, hh, hh / 2)
    ctx.fill()
  }
  ctx.shadowBlur = 0
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  if (shape === "convex") {
    const bump = Physics.convexBump(ww / 2)
    const topC = -hh / 2 - bump
    ctx.strokeStyle = "rgba(255,255,255,0.45)"
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-ww / 2 + 8, -hh / 2 + 2)
    ctx.quadraticCurveTo(-ww / 4, topC + 5, 0, topC + 3)
    ctx.quadraticCurveTo(ww / 4, topC + 5, ww / 2 - 8, -hh / 2 + 2)
    ctx.stroke()
  } else if (shape === "concave") {
    // Блик вдоль верхней ∪-дуги чаши (зеркало купольного).
    const depth = Physics.convexBump(ww / 2)
    const topE = -hh / 2 - depth
    const topC = -hh / 2
    ctx.strokeStyle = "rgba(255,255,255,0.4)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-ww / 2 + 8, topE + 3)
    ctx.quadraticCurveTo(-ww / 4, topC + 5, 0, topC + 3)
    ctx.quadraticCurveTo(ww / 4, topC + 5, ww / 2 - 8, topE + 3)
    ctx.stroke()
  } else {
    roundRect(ctx, -ww / 2 + 6, -hh / 2 + 2.5, ww - 12, 4, 2)
    ctx.fill()
  }
  // Оси по бокам — у чаши они в центре торцового полукруга (подняты на depth)
  const hubY = shape === "concave" ? -Physics.convexBump(ww / 2) : 0
  ctx.fillStyle = "rgba(4,18,26,0.35)"
  ctx.beginPath()
  ctx.arc(-ww / 2 + hh / 2, hubY, hh * 0.22, 0, Math.PI * 2)
  ctx.arc(ww / 2 - hh / 2, hubY, hh * 0.22, 0, Math.PI * 2)
  ctx.fill()
  const laserOn = time < v.laserUntil
  const rocketOn = time < v.rocketUntil
  // Пилоны оружия (лазер, ракета) стоят на поверхности формы ракетки под
  // своей точкой: Physics.surfaceAt (купол выше грани, чаша — ниже).
  const domeBump = (s: number) => Physics.surfaceAt(ww / 2, s, shape, hh)
  const topAt = (s: number) => -hh / 2 - domeBump(s)
  if (laserOn || v.laserArmed) {
    const charge = !laserOn && v.laserArmed ? 8 + Math.sin(time * 16) * 6 : 10
    ctx.shadowColor = "#7cf5ff"
    ctx.shadowBlur = charge
    ctx.fillStyle = !laserOn && v.laserArmed ? "#5fd8ef" : "#9df2ff"
    for (const s of [-0.36, 0.36]) {
      roundRect(ctx, ww * s - 3, topAt(s) - 9, 6, 10, 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }
  if (rocketOn) {
    const top0 = topAt(0)
    ctx.shadowColor = "#ffc94d"
    ctx.shadowBlur = 10
    ctx.fillStyle = "#ffe9a8"
    roundRect(ctx, -4.5, top0 - 13, 9, 14, 3)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = "#ff6a5c"
    ctx.beginPath()
    ctx.arc(0, top0 - 13, 3, Math.PI, 0)
    ctx.fill()
  }
  if (time < v.magnetUntil) {
    const pulse = 0.5 + Math.sin(time * 8) * 0.25
    ctx.strokeStyle = `rgba(77,255,158,${pulse})`
    ctx.lineWidth = 2.5
    ctx.setLineDash([6, 7])
    ctx.lineDashOffset = -time * 30
    ctx.beginPath()
    ctx.arc(0, -hh / 2 - 4, ww * 0.44, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineDashOffset = 0
  }
  ctx.restore()
}
