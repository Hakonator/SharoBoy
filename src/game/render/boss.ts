import { Ball, Block, BossState } from "../types"
import { clamp } from "../utils"
import { jellyTentacleBase } from "../bossJelly"

import { drawJellyDomeHp, traceJellyDome } from "./bossJellyDome"
import { type Ctx } from "./shapes"

/** Рендер летящей молнии медузы: зигзаг в направлении полёта + светящаяся голова. */
function drawBolt(ctx: Ctx, b: Block, time: number) {
  const vx = b.bombVx ?? 0
  const vy = b.bombVy ?? 0
  const len = Math.hypot(vx, vy) || 1
  const ux = vx / len
  const uy = vy / len
  const px = -uy
  const py = ux
  const L = 46
  const SEG = 6
  ctx.save()
  ctx.shadowColor = "#7cf5ff"
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(b.x, b.y)
  for (let i = 1; i <= SEG; i++) {
    const t = i / SEG
    const off = (i % 2 ? 1 : -1) * 5 * (1 - t * 0.5) + Math.sin(time * 60 + i * 3.1) * 2.2
    ctx.lineTo(b.x + ux * L * t + px * off, b.y + uy * L * t + py * off)
  }
  ctx.lineCap = "round"
  ctx.strokeStyle = "rgba(124,245,255,0.85)"
  ctx.lineWidth = 3.5
  ctx.stroke()
  ctx.strokeStyle = "#fffbe6"
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.restore()
  // светящаяся голова снаряда
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
  ctx.fill()
}

/** Телеграф выстрела: кончик отростка разгорается и искрит перед молнией. */
function drawChargeTip(ctx: Ctx, bo: BossState, blocks: Block[]) {
  if (bo.chargeTent === null || bo.chargeTent === undefined) return
  const charge = clamp(bo.chargeT ?? 0, 0, 1)
  // кончик — старший живой сегмент (после смерти прежнего кончика искрит следующий)
  let tip: Block | undefined
  for (const b of blocks) {
    if (!b.isTentacle || b.dead || b.tentacleId !== bo.chargeTent) continue
    if (!tip || (b.tentacleSeg ?? 0) > (tip.tentacleSeg ?? 0)) tip = b
  }
  if (!tip) return
  const r = tip.rx * (1.1 + charge * 1.6)
  ctx.save()
  ctx.shadowColor = "#ffe95c"
  ctx.shadowBlur = 10 + charge * 22
  ctx.fillStyle = `rgba(255,233,92,${0.25 + charge * 0.55})`
  ctx.beginPath()
  ctx.arc(tip.x, tip.y, r, 0, Math.PI * 2)
  ctx.fill()
  // мелкие дуги-разряды вокруг кончика
  const arcs = 2 + Math.round(charge * 2)
  for (let i = 0; i < arcs; i++) {
    const a0 = Math.random() * Math.PI * 2
    const l = r * (0.9 + Math.random() * 1.2)
    ctx.beginPath()
    ctx.moveTo(tip.x + Math.cos(a0) * r * 0.6, tip.y + Math.sin(a0) * r * 0.6)
    ctx.lineTo(
      tip.x + Math.cos(a0 + 0.4) * (r + l * 0.5) + (Math.random() - 0.5) * 6,
      tip.y + Math.sin(a0 + 0.4) * (r + l * 0.5) + (Math.random() - 0.5) * 6
    )
    ctx.lineTo(tip.x + Math.cos(a0 + 0.8) * (r + l), tip.y + Math.sin(a0 + 0.8) * (r + l))
    ctx.strokeStyle = i % 2 ? "rgba(255,249,196,0.9)" : "rgba(124,245,255,0.7)"
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
  ctx.restore()
}

/** Рендер отростков медузы: плавная линия через сегменты + полупрозрачные шары. */
function drawJellyTentacles(ctx: Ctx, bo: BossState, blocks: Block[]) {
  const groups = new Map<number, Block[]>()
  for (const b of blocks) {
    if (!b.isTentacle || b.dead) continue
    const arr = groups.get(b.tentacleId ?? 0) ?? []
    arr.push(b)
    groups.set(b.tentacleId ?? 0, arr)
  }
  for (const segs of groups.values()) {
    if (segs.length > 1) {
      segs.sort((a, b) => (a.tentacleSeg ?? 0) - (b.tentacleSeg ?? 0))
      ctx.strokeStyle = "rgba(126,78,220,0.6)"
      ctx.lineWidth = 9
      ctx.lineCap = "round"
      ctx.beginPath()
      // линия начинается прямо на кромке купола — плавное сопряжение
      const base = jellyTentacleBase(bo, segs[0].tentacleId ?? 0)
      ctx.moveTo(base.x, base.y)
      for (let k = 0; k < segs.length - 1; k++) {
        const mx = (segs[k].x + segs[k + 1].x) / 2
        const my = (segs[k].y + segs[k + 1].y) / 2
        ctx.quadraticCurveTo(segs[k].x, segs[k].y, mx, my)
      }
      ctx.lineTo(segs[segs.length - 1].x, segs[segs.length - 1].y)
      ctx.stroke()
    }
    for (const seg of segs) {
      const r = seg.rx
      ctx.save()
      ctx.shadowColor = "rgba(176,108,255,0.8)"
      ctx.shadowBlur = 10
      const g = ctx.createRadialGradient(seg.x - r * 0.3, seg.y - r * 0.3, 1, seg.x, seg.y, r * 1.2)
      g.addColorStop(0, "rgba(242,217,255,0.95)")
      g.addColorStop(0.5, "rgba(176,108,255,0.8)")
      g.addColorStop(1, "rgba(74,30,122,0.4)")
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      // повреждённый сегмент светится белым
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

/** Рендер босса-медузы: пульсирующий купол, глаза, отростки, молнии. */
function drawJellyfishBoss(ctx: Ctx, bo: BossState, balls: Ball[], blocks: Block[]) {
  const angry = bo.hp < bo.maxHp * 0.5
  const s = clamp(bo.pulseScale ?? 1, 0.6, 1.1)
  // отростки — позади купола
  drawJellyTentacles(ctx, bo, blocks)
  // летящие молнии
  for (const b of blocks) {
    if (b.bolt && !b.dead) drawBolt(ctx, b, bo.t)
  }
  drawChargeTip(ctx, bo, blocks)
  // купол: сжатие делает его уже и выше, расширение — шире и ниже
  ctx.save()
  ctx.translate(bo.x, bo.y)
  ctx.scale(s, 1 + (1 - s) * 0.55)
  ctx.shadowColor = angry ? "#ff5347" : "#b06cff"
  ctx.shadowBlur = 26
  const g = ctx.createRadialGradient(-bo.r * 0.3, -bo.r * 0.45, 4, 0, 0, bo.r * 1.25)
  if (angry) {
    g.addColorStop(0, "#ffd9d4")
    g.addColorStop(0.45, "#ff6a8c")
    g.addColorStop(1, "#4a0f3c")
  } else {
    g.addColorStop(0, "#f2d9ff")
    g.addColorStop(0.45, "#b06cff")
    g.addColorStop(1, "#3c1e5a")
  }
  ctx.fillStyle = g
  ctx.beginPath()
  // купол: верхняя полуарка + волнистая бахрома через всю ширину — общая
  // геометрия с полоской HP (см. bossJellyDome)
  traceJellyDome(ctx, bo)
  ctx.fill()
  ctx.shadowBlur = 0
  if (bo.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.7})`
    ctx.beginPath()
    ctx.arc(0, bo.r * 0.2, bo.r, Math.PI, Math.PI * 2)
    ctx.fill()
  }
  // тонкая полоска HP ровно по контуру купола: внутри трансформа пульса —
  // поэтому изгибается вместе с телом и повторяет волну бахромы
  drawJellyDomeHp(ctx, bo)
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
    ctx.ellipse(sx * bo.r * 0.32, -bo.r * 0.18, bo.r * 0.19, bo.r * 0.23, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#221238"
    ctx.beginPath()
    ctx.arc(sx * bo.r * 0.32 + ex, -bo.r * 0.18 + ey, bo.r * 0.09, 0, Math.PI * 2)
    ctx.fill()
  }
  // рот: волнистая линия, дрожит сильнее в «злой» фазе
  ctx.strokeStyle = "#2c0a3c"
  ctx.lineWidth = bo.r * 0.06
  ctx.lineCap = "round"
  ctx.beginPath()
  const wob = angry ? 0.09 : 0.045
  ctx.moveTo(-bo.r * 0.28, bo.r * 0.34)
  for (let i = 1; i <= 6; i++) {
    ctx.lineTo(
      -bo.r * 0.28 + (i * bo.r * 0.56) / 6,
      bo.r * 0.34 + (i % 2 ? bo.r * wob : 0) + Math.sin(bo.t * 7 + i) * bo.r * 0.02
    )
  }
  ctx.stroke()
  ctx.restore()
}

export function drawBoss(ctx: Ctx, boss: BossState | null, balls: Ball[], blocks: Block[]) {
  const bo = boss
  if (!bo) return
  if (bo.isJellyfish) {
    drawJellyfishBoss(ctx, bo, balls, blocks)
    return
  }
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
