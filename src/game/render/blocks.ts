import { TIER } from "../palette"
import { Block } from "../types"
import { mulberry32 } from "../utils"

import { gradient } from "./gradCache"
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

/**
 * Замороженный блок: полупрозрачный водяной лёд с бликами. Трещины —
 * процедурные, у каждого блока свои (детерминированно из seed), поэтому
 * силуэт повреждений не повторяется.
 */
function drawFrozenBlock(ctx: Ctx, b: Block, x: number, y: number, time: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(b.rot)
  ctx.scale(b.rx, b.ry)
  // ледяное тело: холодный градиент от светлой корки к глубине
  // (единый кэшированный градиент — координаты в локальной системе блока)
  const g = gradient(ctx, "frozen", (c) => {
    const rg = c.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15)
    rg.addColorStop(0, "#f2fcff")
    rg.addColorStop(0.55, "#a8e2ff")
    rg.addColorStop(1, "#3f88b5")
    return rg
  })
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2.5 / Math.max(b.rx, b.ry)
  ctx.strokeStyle = "rgba(9,42,64,0.55)"
  ctx.stroke()
  // трещины: 2–3 ломаные, форма зависит только от seed (не мерцают)
  const rng = mulberry32((b.seed * 7919) | 0)
  const n = 2 + Math.floor(rng() * 2)
  ctx.lineWidth = 1.4 / Math.max(b.rx, b.ry)
  ctx.strokeStyle = "rgba(9,42,64,0.45)"
  for (let i = 0; i < n; i++) {
    let a = rng() * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 0.12, Math.sin(a) * 0.12)
    const segs = 2 + Math.floor(rng() * 2)
    for (let s = 0; s < segs; s++) {
      a += (rng() - 0.5) * 1.5
      const r = 0.3 + rng() * 0.55
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.stroke()
  }
  // блики «водяного льда»: мягкая широкая полоса, яркий штрих и искра;
  // слегка дышат по времени
  const shim = 0.85 + Math.sin(time * 2.2 + b.seed) * 0.15
  ctx.rotate(-0.7)
  ctx.fillStyle = `rgba(255,255,255,${0.24 * shim})`
  ctx.beginPath()
  ctx.ellipse(-0.22, -0.34, 0.52, 0.14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${0.5 * shim})`
  ctx.beginPath()
  ctx.ellipse(-0.28, -0.42, 0.3, 0.055, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${0.75 * shim})`
  ctx.beginPath()
  ctx.arc(0.34, -0.4, 0.07, 0, Math.PI * 2)
  ctx.fill()
  if (b.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
  }
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
    if (b.frozen) {
      drawFrozenBlock(ctx, b, x, y, time)
      continue
    }
    const tier = TIER[b.tier]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.rot)
    ctx.scale(b.rx, b.ry)
    /* Градиент один на tier и общий для всех блоков: рисуем в единичной
       локальной системе, координаты градиента резолвятся при заливке. */
    const g = gradient(ctx, `tier${b.tier}`, (c) => {
      const rg = c.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15)
      rg.addColorStop(0, tier.light)
      rg.addColorStop(0.5, tier.base)
      rg.addColorStop(1, tier.dark)
      return rg
    })
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
