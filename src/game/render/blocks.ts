import { TIER } from "../palette"
import { Block } from "../types"

import { type Ctx } from "./shapes"

function drawBomb(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  const pulse = 0.6 + Math.sin(time * 9 + b.seed) * 0.4
  ctx.save()
  const g = ctx.createRadialGradient(x - b.rx * 0.3, y - b.ry * 0.35, 2, x, y, b.rx * 1.2)
  g.addColorStop(0, "#5a6b78")
  g.addColorStop(0.55, "#2b3a45")
  g.addColorStop(1, "#101b22")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, b.rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = "#ff8a3d"
  ctx.shadowBlur = 14 * pulse
  ctx.strokeStyle = `rgba(255,138,61,${0.45 + pulse * 0.4})`
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.shadowBlur = 0
  // фитиль
  ctx.strokeStyle = "#8a6b4a"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x, y - b.ry)
  ctx.quadraticCurveTo(x + 7, y - b.ry - 8, x + 12, y - b.ry - 4)
  ctx.stroke()
  ctx.fillStyle = `rgba(255,220,120,${pulse})`
  ctx.beginPath()
  ctx.arc(x + 12, y - b.ry - 4, 3 + pulse * 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawBlocks(ctx: Ctx, blocks: Block[], time: number) {
  for (const b of blocks) {
    if (b.dead) continue
    // Минибоссы рисуются специализированным рендером (drawMinibosses).
    if (b.isMiniboss) continue
    if (b.bomb) {
      drawBomb(ctx, b, b.x, b.y, time)
      continue
    }
    const x = b.x + Math.sin(time * 0.9 + b.seed) * 1.4
    const y = b.y + Math.cos(time * 0.8 + b.seed) * 1.4
    const tier = TIER[b.tier]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.rot)
    ctx.scale(b.rx, b.ry)
    const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15)
    g.addColorStop(0, tier.light)
    g.addColorStop(0.5, tier.base)
    g.addColorStop(1, tier.dark)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2.5 / Math.max(b.rx, b.ry)
    ctx.strokeStyle = "rgba(4,18,26,0.55)"
    ctx.stroke()
    if (b.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // трещины
    const dmg = b.maxHp - b.hp
    if (dmg > 0) {
      ctx.strokeStyle = "rgba(4,18,26,0.5)"
      ctx.lineWidth = 1.6
      for (let i = 0; i < dmg; i++) {
        const a0 = b.seed + i * 2.1
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(a0) * b.rx * 0.2, y + Math.sin(a0) * b.ry * 0.2)
        ctx.lineTo(x + Math.cos(a0 + 0.5) * b.rx * 0.75, y + Math.sin(a0 + 0.5) * b.ry * 0.75)
        ctx.lineTo(x + Math.cos(a0 + 0.9) * b.rx * 0.55, y + Math.sin(a0 + 0.9) * b.ry * 0.55)
        ctx.stroke()
      }
    }

    // пипсы HP
    if (b.maxHp > 1 && b.hp > 1) {
      ctx.fillStyle = "rgba(4,18,26,0.75)"
      for (let i = 0; i < b.hp; i++) {
        ctx.beginPath()
        ctx.arc(x + (i - (b.hp - 1) / 2) * 8, y + b.ry * 0.55, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // «матрёшка»: мини-шарики внутри
    if (b.splits) {
      ctx.fillStyle = "rgba(255,255,255,0.85)"
      for (let i = 0; i < 3; i++) {
        const aa = b.seed + (i * Math.PI * 2) / 3 + time * 0.9
        ctx.beginPath()
        ctx.ellipse(
          x + Math.cos(aa) * b.rx * 0.36,
          y + Math.sin(aa) * b.ry * 0.36,
          Math.max(3, b.rx * 0.17),
          Math.max(3, b.ry * 0.17),
          0,
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
    }
  }
}
