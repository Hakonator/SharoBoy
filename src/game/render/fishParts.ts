import { TIER } from "../palette"
import { Block } from "../types"

import { type Ctx, type MbBox } from "./shapes"

/** Хвост рыбы: массивная раздвоенная лопасть на шарнире, качается в противофазе корпусу. */
export function drawFishTail(
  ctx: Ctx,
  jointX: number,
  midY: number,
  swing: number,
  L: number,
  H: number,
  flash: number
) {
  ctx.save()
  ctx.translate(jointX, midY)
  ctx.rotate(swing)
  // массивный раздвоенный хвост: две лопасти с выемкой, плавные кривые
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(-L * 0.42, -H * 0.34, -L, -H * 0.74)
  ctx.quadraticCurveTo(-L * 0.5, -H * 0.16, -L * 0.46, 0)
  ctx.quadraticCurveTo(-L * 0.5, H * 0.16, -L, H * 0.74)
  ctx.quadraticCurveTo(-L * 0.42, H * 0.34, 0, 0)
  ctx.closePath()
  const tg = ctx.createLinearGradient(-L, -H * 0.7, 0, H * 0.7)
  tg.addColorStop(0, TIER[1].light)
  tg.addColorStop(1, TIER[1].dark)
  ctx.fillStyle = tg
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.45
    ctx.fillStyle = "#ffffff"
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

/** Спинной и нижний (анальный) плавники рыбы. */
export function drawFishFins(
  ctx: Ctx,
  time: number,
  dorsal: Block | undefined,
  b: MbBox,
  midY: number
) {
  // спинной плавник: широкий, низкий; кончик уходит назад к хвосту, передняя
  // кромка — крутой скат, задняя почти отвесна; верх колышется рябью
  if (dorsal) {
    const ripple = Math.sin(time * 2.3) * 3
    const baseY = midY - b.h * 0.28
    const dx = dorsal.x + b.w * 0.12 // плавник смещён к середине спины
    ctx.beginPath()
    ctx.moveTo(dx + dorsal.rx * 1.7, baseY) // переднее основание (к голове)
    ctx.lineTo(dx - dorsal.rx * 1.8, baseY) // заднее основание (к хвосту)
    ctx.lineTo(dx - dorsal.rx * 1.75 + ripple * 0.5, dorsal.y + dorsal.ry * 0.1)
    ctx.lineTo(dx - dorsal.rx * 1.35 + ripple, dorsal.y - dorsal.ry * 0.2)
    ctx.closePath()
    const dg = ctx.createLinearGradient(0, baseY, 0, dorsal.y - dorsal.ry * 0.2)
    dg.addColorStop(0, TIER[1].base)
    dg.addColorStop(1, TIER[1].light)
    ctx.fillStyle = dg
    ctx.fill()
    ctx.strokeStyle = TIER[1].dark
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // нижний (анальный) плавник: широкий и низкий, кончик назад, передняя
  // кромка сильно наклонена, задняя почти отвесна
  const rippleA = Math.sin(time * 2.5 + 1.2) * 2.5
  ctx.beginPath()
  ctx.moveTo(b.x + b.w * 0.42, midY + b.h * 0.46) // переднее основание
  ctx.lineTo(b.x + b.w * 0.15, midY + b.h * 0.22) // заднее основание
  ctx.lineTo(b.x + b.w * 0.165 + rippleA * 0.5, midY + b.h * 0.42)
  ctx.lineTo(b.x + b.w * 0.21 + rippleA, midY + b.h * 0.5)
  ctx.closePath()
  ctx.fillStyle = TIER[1].base
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1
  ctx.stroke()
}
