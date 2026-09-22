import { Ball, Block, BossState } from "../types"
import { clamp } from "../utils"

import { type Ctx } from "./shapes"

export function drawBoss(ctx: Ctx, boss: BossState | null, balls: Ball[], blocks: Block[]) {
  const bo = boss
  if (!bo) return
  const angry = bo.hp < bo.maxHp * 0.4
  ctx.save()
  ctx.translate(bo.x, bo.y)
  const frac = clamp(bo.hp / bo.maxHp, 0, 1)
  ctx.lineWidth = 6
  ctx.strokeStyle = "rgba(4,18,26,0.7)"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
  ctx.stroke()
  ctx.shadowColor = angry ? "#ff5347" : "#ff5ca8"
  ctx.shadowBlur = 30
  const g = ctx.createRadialGradient(-bo.r * 0.35, -bo.r * 0.4, 4, 0, 0, bo.r * 1.2)
  if (angry) {
    g.addColorStop(0, "#ffd9d4")
    g.addColorStop(0.45, "#ff6a5c")
    g.addColorStop(1, "#5a0f08")
  } else {
    g.addColorStop(0, "#ffd0e8")
    g.addColorStop(0.45, "#ff5ca8")
    g.addColorStop(1, "#5a0f3c")
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  if (bo.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.7})`
    ctx.beginPath()
    ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
    ctx.fill()
  }
  // корона
  ctx.fillStyle = "#ffc94d"
  ctx.beginPath()
  const cy0 = -bo.r * 0.92
  ctx.moveTo(-bo.r * 0.42, cy0)
  ctx.lineTo(-bo.r * 0.42, cy0 - bo.r * 0.28)
  ctx.lineTo(-bo.r * 0.2, cy0 - bo.r * 0.1)
  ctx.lineTo(0, cy0 - bo.r * 0.34)
  ctx.lineTo(bo.r * 0.2, cy0 - bo.r * 0.1)
  ctx.lineTo(bo.r * 0.42, cy0 - bo.r * 0.28)
  ctx.lineTo(bo.r * 0.42, cy0)
  ctx.closePath()
  ctx.fill()
  // глаза следят за шаром
  const target = balls.find((b) => !b.stuck)
  let ex = 0
  let ey = 0
  if (target) {
    const dx = target.x - bo.x
    const dy = target.y - bo.y
    const dl = Math.hypot(dx, dy) || 1
    ex = (dx / dl) * bo.r * 0.08
    ey = (dy / dl) * bo.r * 0.08
  }
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.ellipse(sx * bo.r * 0.32, -bo.r * 0.15, bo.r * 0.2, bo.r * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#12222c"
    ctx.beginPath()
    ctx.arc(sx * bo.r * 0.32 + ex, -bo.r * 0.15 + ey, bo.r * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  // рот
  ctx.strokeStyle = "#3c0a26"
  ctx.lineWidth = bo.r * 0.07
  ctx.lineCap = "round"
  ctx.beginPath()
  if (bo.isOctopus) {
    // Выражение лица осьминога зависит от числа живых щупалец.
    // Мёртвые блоки удаляются из blocks, поэтому исходное количество
    // щупалец хранится в bo.totalTentacles.
    // больше половины — улыбка (дуга вверх), половина и меньше —
    // прямая горизонтальная линия, ни одного — грустная дуга (вниз).
    const alive = new Set<number>()
    for (const b of blocks) {
      if (!b.isTentacle || b.dead) continue
      alive.add((b as Block & { tentacleId: number }).tentacleId)
    }
    const total = bo.totalTentacles ?? 1
    if (alive.size === 0) {
      // грусть: дуга вниз
      ctx.arc(0, bo.r * 0.48, bo.r * 0.3, Math.PI + 0.15, Math.PI * 2 - 0.15)
    } else if (alive.size * 2 <= total) {
      // половина щупалец и меньше: прямая горизонтальная линия
      ctx.moveTo(-bo.r * 0.3, bo.r * 0.42)
      ctx.lineTo(bo.r * 0.3, bo.r * 0.42)
    } else {
      // больше половины: улыбка (дуга вверх)
      ctx.arc(0, bo.r * 0.28, bo.r * 0.3, 0.15, Math.PI - 0.15)
    }
  } else if (angry) {
    ctx.moveTo(-bo.r * 0.3, bo.r * 0.42)
    for (let i = 0; i <= 6; i++) {
      ctx.lineTo(-bo.r * 0.3 + (i * bo.r * 0.6) / 6, bo.r * 0.42 + (i % 2 ? bo.r * 0.09 : 0))
    }
  } else {
    ctx.arc(0, bo.r * 0.28, bo.r * 0.3, 0.15, Math.PI - 0.15)
  }
  ctx.stroke()
  ctx.restore()

  // Щупальца осьминога — сегменты-шарики вдоль луча от центра.
  if (bo.isOctopus) {
    const tentacles = blocks.filter((b) => b.isTentacle && !b.dead) as (Block & {
      tentacleId: number
      tentacleSeg: number
    })[]
    const byId = new Map<number, typeof tentacles>()
    for (const t of tentacles) {
      const arr = byId.get(t.tentacleId) ?? []
      arr.push(t)
      byId.set(t.tentacleId, arr)
    }
    const segColor = (t: (typeof tentacles)[0]) => {
      // Цвет сегмента по его собственному здоровью — темнее, когда сегмент повреждён.
      const frac = clamp((t.hp ?? 1) / (t.maxHp ?? 1), 0, 1)
      if (frac > 0.6) return `rgba(93,255,176,${0.85})`
      if (frac > 0.3) return `rgba(255,201,77,${0.8})`
      return `rgba(255,70,70,${0.75})`
    }
    for (const segs of byId.values()) {
      // Рисуем связи между сегментами (линии).
      if (segs.length > 1) {
        segs.sort((a, b) => a.tentacleSeg! - b.tentacleSeg!)
        ctx.strokeStyle = "rgba(40,40,60,0.55)"
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(segs[0].x, segs[0].y)
        for (let k = 1; k < segs.length; k++) {
          ctx.lineTo(segs[k].x, segs[k].y)
        }
        ctx.stroke()
      }
      // Рисуем сегменты-шарики.
      for (const seg of segs) {
        const r = seg.rx
        ctx.save()
        ctx.shadowColor = segColor(seg)
        ctx.shadowBlur = 14
        const g = ctx.createRadialGradient(
          seg.x - r * 0.3,
          seg.y - r * 0.3,
          1,
          seg.x,
          seg.y,
          r * 1.2
        )
        g.addColorStop(0, "#ffffff")
        g.addColorStop(0.45, segColor(seg))
        g.addColorStop(1, "rgba(30,20,40,0.55)")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        // У Yank-уцепление с колой — постепенно светится.
        if (seg.hp < seg.maxHp) {
          ctx.fillStyle = `rgba(255,255,255,${(1 - seg.hp / seg.maxHp) * 0.4})`
          ctx.beginPath()
          ctx.arc(seg.x, seg.y, r * 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }
  }
}
