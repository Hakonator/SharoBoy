import { Ball, Block, BossState } from "../types"
import { clamp } from "../utils"
import { jellyTentacleBase } from "../bossJelly"

import { drawJellyDamageFill, drawJellyDomeHp, traceJellyDome } from "./bossJellyDome"
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
  if (angry) drawJellyDamageFill(ctx, bo)
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

/** Рендер босса «Меха-Краб»: ножки, клешни и массивный панцирь с перископами. */
function drawCrabBoss(ctx: Ctx, bo: BossState, balls: Ball[], blocks: Block[]) {
  const angry = bo.hp < bo.maxHp * 0.5

  // 1. Рисуем ножки краба позади панциря (по 3 с каждой стороны)
  ctx.save()
  ctx.strokeStyle = angry ? "#ff6a3d" : "#c4421a"
  ctx.lineWidth = 4
  ctx.lineCap = "round"
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const legPh = bo.t * 5 + i * 1.2 + (side > 0 ? Math.PI : 0)
      const legX = bo.x + side * (bo.r * 0.75 + i * 4)
      const legY = bo.y + (i - 1) * 14
      const kneeX = legX + side * (24 + Math.sin(legPh) * 6)
      const kneeY = legY - 14 + Math.cos(legPh) * 4
      const footX = kneeX + side * 16
      const footY = kneeY + 28
      ctx.beginPath()
      ctx.moveTo(legX, legY)
      ctx.lineTo(kneeX, kneeY)
      ctx.lineTo(footX, footY)
      ctx.stroke()
    }
  }
  ctx.restore()

  // 2. Рисуем сочленения и сегменты клешней (блоки isClaw)
  for (const side of ["left", "right"] as const) {
    const sideSign = side === "left" ? -1 : 1
    const sideClaws = blocks
      .filter((b) => b.isClaw && b.clawSide === side && !b.dead)
      .sort((a, b) => (a.clawSeg ?? 0) - (b.clawSeg ?? 0))

    if (sideClaws.length === 0) continue

    const shoulderX = bo.x + sideSign * (bo.r * 0.85)
    const shoulderY = bo.y + bo.r * 0.12

    // Массивные гидравлические сочленения между панцирем и суставами клешни
    ctx.save()
    ctx.strokeStyle = angry ? "#8a1f0a" : "#4a1808"
    ctx.lineWidth = 12
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(shoulderX, shoulderY)
    for (const c of sideClaws) ctx.lineTo(c.x, c.y)
    ctx.stroke()

    // Внутренний механический хромированный стержень
    ctx.strokeStyle = angry ? "#ff6347" : "#ff9e42"
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.restore()

    // Отрисовка каждого сустава клешни
    for (let i = 0; i < sideClaws.length; i++) {
      const c = sideClaws[i]
      const isPincer = c.clawSeg === 2
      ctx.save()
      ctx.shadowColor = angry ? "#ff5347" : "#ff9e42"
      ctx.shadowBlur = isPincer ? 20 : 10

      // Круглый бронированный сустав
      const grad = ctx.createRadialGradient(c.x - 4, c.y - 4, 2, c.x, c.y, c.rx)
      grad.addColorStop(0, isPincer ? "#ffe29a" : "#ff9e42")
      grad.addColorStop(0.5, angry ? "#ff3b14" : "#d94e24")
      grad.addColorStop(1, "#521404")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(c.x, c.y, c.rx, 0, Math.PI * 2)
      ctx.fill()

      // Для концевой клешни — мощные раскрывающиеся щипцы (две створки)
      if (isPincer) {
        ctx.strokeStyle = "#ffe29a"
        ctx.lineWidth = 2.5
        ctx.stroke()

        const prev = sideClaws[i - 1] ?? { x: shoulderX, y: shoulderY }
        const baseDir = Math.atan2(c.y - prev.y, c.x - prev.x)
        const snapAngle = (bo.clawSnapTimer ?? 0) > 0 ? 0.08 : 0.42
        const pincerLen = c.rx * 1.55

        for (const jaw of [-1, 1]) {
          const jawAngle = baseDir + jaw * snapAngle
          const tipX = c.x + Math.cos(jawAngle) * pincerLen
          const tipY = c.y + Math.sin(jawAngle) * pincerLen
          const sideX = c.x + Math.cos(jawAngle + jaw * 0.45) * (c.rx * 0.75)
          const sideY = c.y + Math.sin(jawAngle + jaw * 0.45) * (c.rx * 0.75)

          ctx.fillStyle = angry ? "#ff3b14" : "#d94e24"
          ctx.beginPath()
          ctx.moveTo(c.x, c.y)
          ctx.lineTo(sideX, sideY)
          ctx.lineTo(tipX, tipY)
          ctx.closePath()
          ctx.fill()

          ctx.strokeStyle = "#ffe29a"
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
      ctx.restore()
    }
  }

  // 3. Панцирь краба (тело)
  ctx.save()
  ctx.translate(bo.x, bo.y)
  const frac = clamp(bo.hp / bo.maxHp, 0, 1)

  const bodyRx = bo.r * 1.15
  const bodyRy = bo.r * 0.85

  // Тело-панцирь: массивный овальный щит
  ctx.shadowColor = angry ? "#ff2a14" : "#ff7700"
  ctx.shadowBlur = 24
  const g = ctx.createRadialGradient(-bo.r * 0.3, -bo.r * 0.3, 4, 0, 0, bo.r * 1.2)
  g.addColorStop(0, angry ? "#ffd9d4" : "#ffe29a")
  g.addColorStop(0.4, angry ? "#ff3b14" : "#d94e24")
  g.addColorStop(1, "#360a02")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, bodyRx, bodyRy, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  if (bo.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.7})`
    ctx.beginPath()
    ctx.ellipse(0, 0, bodyRx, bodyRy, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Кольцо HP — строго вписано внутрь периметра панциря (внутренняя окантовка тела без выступа)
  const ringRx = bodyRx - 3.5
  const ringRy = bodyRy - 3.5
  ctx.lineWidth = 4.5
  ctx.lineCap = "round"
  ctx.strokeStyle = "rgba(10,2,0,0.75)"
  ctx.beginPath()
  ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2)
  ctx.stroke()

  if (frac > 0) {
    ctx.strokeStyle = frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347"
    ctx.shadowColor =
      frac > 0.55
        ? "rgba(93,255,176,0.85)"
        : frac > 0.25
          ? "rgba(255,201,77,0.85)"
          : "rgba(255,83,71,0.85)"
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.ellipse(0, 0, ringRx, ringRy, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // 4. Осмысленная кибернетическая морда краба
  // А) Массивные скошенные надбровные пластины (грозный прищур)
  ctx.strokeStyle = angry ? "#ffe29a" : "rgba(255,220,170,0.85)"
  ctx.fillStyle = angry ? "rgba(180,30,10,0.55)" : "rgba(80,20,5,0.45)"
  ctx.lineWidth = 2.2
  ctx.lineJoin = "round"

  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sx * bo.r * 0.62, -bo.r * 0.38)
    ctx.lineTo(sx * bo.r * 0.14, -bo.r * 0.16)
    ctx.lineTo(sx * bo.r * 0.14, -bo.r * 0.05)
    ctx.lineTo(sx * bo.r * 0.58, -bo.r * 0.22)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Горизонтальные узкие оптические визоры-щели под бровями (кибер-глазки)
    ctx.fillStyle = angry ? "#ff1a1a" : "#00f0ff"
    ctx.shadowColor = angry ? "#ff0000" : "#00f0ff"
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.moveTo(sx * bo.r * 0.48, -bo.r * 0.2)
    ctx.lineTo(sx * bo.r * 0.18, -bo.r * 0.08)
    ctx.lineTo(sx * bo.r * 0.18, -bo.r * 0.04)
    ctx.lineTo(sx * bo.r * 0.48, -bo.r * 0.16)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Б) Центральный респиратор / пасть кибер-краба
  const mouthY = bo.r * 0.15
  ctx.fillStyle = "#140402"
  ctx.strokeStyle = angry ? "#ff5347" : "#ff9e42"
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.ellipse(0, mouthY, bo.r * 0.26, bo.r * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Вентиляционные прорези пасти
  ctx.strokeStyle = angry ? "rgba(255,80,40,0.7)" : "rgba(255,180,80,0.6)"
  ctx.lineWidth = 1.4
  for (let vx = -3; vx <= 3; vx++) {
    const x = vx * (bo.r * 0.06)
    const h = Math.sqrt(Math.max(0, 1 - (x / (bo.r * 0.26)) ** 2)) * (bo.r * 0.13)
    ctx.beginPath()
    ctx.moveTo(x, mouthY - h)
    ctx.lineTo(x, mouthY + h)
    ctx.stroke()
  }

  // В) Механические жвалы-челюсти краба (мандибулы) по бокам рта
  const mandibleTwitch = Math.sin(bo.t * 5.5) * 0.06
  for (const sx of [-1, 1]) {
    const mAngle = sx * (0.28 + mandibleTwitch + (angry ? 0.12 : 0))
    const mBaseX = sx * bo.r * 0.24
    const mBaseY = mouthY - bo.r * 0.08

    ctx.save()
    ctx.translate(mBaseX, mBaseY)
    ctx.rotate(mAngle)

    // Клиновидная зазубренная створка жвалы
    ctx.fillStyle = angry ? "#e63900" : "#c4421a"
    ctx.strokeStyle = "#ffe29a"
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(sx * bo.r * 0.18, bo.r * 0.18)
    ctx.lineTo(0, bo.r * 0.38)
    ctx.lineTo(-sx * bo.r * 0.06, bo.r * 0.22)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Металлические зубцы
    ctx.fillStyle = "#ffffff"
    for (let t = 1; t <= 3; t++) {
      const toothY = bo.r * (0.08 + t * 0.08)
      ctx.beginPath()
      ctx.arc(0, toothY, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Г) Боковые хитиновые пластины щёк с заклёпками
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = "rgba(255,200,150,0.35)"
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(sx * bo.r * 0.72, -bo.r * 0.1)
    ctx.lineTo(sx * bo.r * 0.45, bo.r * 0.35)
    ctx.lineTo(sx * bo.r * 0.68, bo.r * 0.55)
    ctx.stroke()

    ctx.fillStyle = "#ffe29a"
    for (const [rx, ry] of [
      [0.68, -0.05],
      [0.55, 0.2],
      [0.48, 0.38],
    ]) {
      ctx.beginPath()
      ctx.arc(sx * bo.r * rx, bo.r * ry, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Стебельчатые глаза-перископы — торчат высоко над панцирем
  const target = balls.find((b) => !b.stuck)
  let ex = 0
  let ey = 0
  if (target) {
    const dx = target.x - bo.x
    const dy = target.y - (bo.y - bo.r * 1.25)
    const dl = Math.hypot(dx, dy) || 1
    ex = (dx / dl) * 4.5
    ey = (dy / dl) * 4.5
  }
  for (const sx of [-1, 1]) {
    const eyeX = sx * bo.r * 0.45
    const eyeY = -bo.r * 1.28 // Выступают высоко над панцирем (панцирь ry = 0.85)
    const stalkBaseX = sx * bo.r * 0.32
    const stalkBaseY = -bo.r * 0.65

    // Бронированный гидравлический стебель глаза
    ctx.save()
    ctx.strokeStyle = angry ? "#8f1e0a" : "#4a1204"
    ctx.lineWidth = 6
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(stalkBaseX, stalkBaseY)
    const midX = sx * bo.r * 0.42
    const midY = -bo.r * 0.98
    ctx.quadraticCurveTo(midX, midY, eyeX, eyeY)
    ctx.stroke()

    // Внутренний хромированный стержень
    ctx.strokeStyle = angry ? "#ff6347" : "#ff9e42"
    ctx.lineWidth = 2.5
    ctx.stroke()
    ctx.restore()

    // Глазная капсула (глазное яблоко)
    ctx.save()
    ctx.shadowColor = angry ? "#ff2a14" : "#00f0ff"
    ctx.shadowBlur = 14
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(eyeX, eyeY, 9, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = angry ? "#ff4222" : "#d9531e"
    ctx.lineWidth = 2
    ctx.stroke()

    // Неоновый кибер-зрачок
    ctx.fillStyle = angry ? "#ff1414" : "#00e5ff"
    ctx.beginPath()
    ctx.arc(eyeX + ex, eyeY + ey, 4.5, 0, Math.PI * 2)
    ctx.fill()

    // Блик
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.beginPath()
    ctx.arc(eyeX - 2.5, eyeY - 2.5, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.restore()
}

/** Рендер босса «Повелитель Времени»: хроносфера, стрелки циферблата и воронки. */
function drawChronoBoss(ctx: Ctx, bo: BossState) {
  const angry = bo.hp < bo.maxHp * 0.5

  // 1. Рисуем временные воронки (Chrono Rifts) на поле
  if (bo.chronoRifts) {
    for (const rift of bo.chronoRifts) {
      const isSlow = rift.kind === "slow"
      const alpha = clamp(rift.life / 1.5, 0, 1) * clamp((rift.maxLife - rift.life) / 0.8, 0, 1)
      const pulse = 1 + Math.sin(bo.t * 4 + rift.x * 0.05) * 0.08
      const curR = rift.r * pulse

      ctx.save()
      ctx.translate(rift.x, rift.y)
      ctx.globalAlpha = alpha

      // Свечение и градиент воронки
      ctx.shadowColor = isSlow ? "#00f0ff" : "#ff00d4"
      ctx.shadowBlur = 24
      const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, curR)
      rg.addColorStop(0, isSlow ? "rgba(255,255,255,0.8)" : "rgba(255,230,255,0.8)")
      rg.addColorStop(0.35, isSlow ? "rgba(0,240,255,0.3)" : "rgba(255,0,212,0.3)")
      rg.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = rg
      ctx.beginPath()
      ctx.arc(0, 0, curR, 0, Math.PI * 2)
      ctx.fill()

      // Плавная вращающаяся спираль воронки (без пунктиров и штрихов)
      ctx.shadowBlur = isSlow ? 14 : 16
      ctx.shadowColor = isSlow ? "#00f0ff" : "#ff00d4"
      const spinDir = isSlow ? -1 : 1
      const baseRot = bo.t * 2.2 * spinDir
      const arms = 2
      const steps = 42

      for (let a = 0; a < arms; a++) {
        const armAngle = (a * Math.PI * 2) / arms + baseRot
        ctx.beginPath()
        for (let i = 0; i <= steps; i++) {
          const t = i / steps // 0 (центр) -> 1 (край)
          // Плавная спираль Архимеда, закручивающаяся к ядру
          const r = curR * (0.12 + 0.82 * Math.pow(t, 0.88))
          const theta = armAngle + t * Math.PI * 2.6 * spinDir
          const px = Math.cos(theta) * r
          const py = Math.sin(theta) * r
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = isSlow
          ? `rgba(0, 240, 255, ${0.72 - a * 0.15})`
          : `rgba(255, 0, 212, ${0.72 - a * 0.15})`
        ctx.lineWidth = 2.4
        ctx.lineCap = "round"
        ctx.stroke()
      }

      // Тонкие сплошные гладкие контуры ядра и внешней границы воронки (без пунктира)
      ctx.shadowBlur = 0
      ctx.strokeStyle = isSlow ? "rgba(0, 240, 255, 0.28)" : "rgba(255, 0, 212, 0.28)"
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(0, 0, curR * 0.92, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = isSlow ? "rgba(180, 245, 255, 0.45)" : "rgba(255, 180, 245, 0.45)"
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(0, 0, curR * 0.32, 0, Math.PI * 2)
      ctx.stroke()

      // Текстовая метка воронки
      ctx.font = '10px "Russo One", sans-serif'
      ctx.fillStyle = isSlow ? "#aef7ff" : "#ffd9f8"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(isSlow ? "SLOW" : "FAST", 0, 0)

      ctx.restore()
    }
  }

  // 2. Тело хроносферы
  ctx.save()
  ctx.translate(bo.x, bo.y)
  const frac = clamp(bo.hp / bo.maxHp, 0, 1)

  // Кольцо HP
  ctx.lineWidth = 6
  ctx.strokeStyle = "rgba(4,18,26,0.7)"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
  ctx.stroke()

  // Хроносфера: глубокий космический сапфир/аметист
  ctx.shadowColor = angry ? "#ff2a85" : "#7928ca"
  ctx.shadowBlur = 28
  const g = ctx.createRadialGradient(-bo.r * 0.35, -bo.r * 0.35, 4, 0, 0, bo.r * 1.2)
  g.addColorStop(0, angry ? "#ffd9f0" : "#e9d5ff")
  g.addColorStop(0.45, angry ? "#ff007f" : "#8a2be2")
  g.addColorStop(1, "#19062e")
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

  // Циферблат со стрелками времени
  ctx.strokeStyle = "rgba(255,255,255,0.4)"
  ctx.lineWidth = 1.5
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12
    const innerR = bo.r * (i % 3 === 0 ? 0.72 : 0.82)
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR)
    ctx.lineTo(Math.cos(a) * (bo.r * 0.92), Math.sin(a) * (bo.r * 0.92))
    ctx.stroke()
  }

  // Стрелки времени
  const spinMult = angry ? 2.2 : 1
  const hourA = bo.t * 0.5 * spinMult
  const minA = bo.t * 1.8 * spinMult
  const secA = bo.t * 5.2 * spinMult

  // Часовая
  ctx.strokeStyle = "#ffe9a8"
  ctx.lineWidth = 4
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(hourA) * (bo.r * 0.45), Math.sin(hourA) * (bo.r * 0.45))
  ctx.stroke()

  // Минутная
  ctx.strokeStyle = "#00f0ff"
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(minA) * (bo.r * 0.65), Math.sin(minA) * (bo.r * 0.65))
  ctx.stroke()

  // Секундная
  ctx.strokeStyle = "#ff007f"
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(Math.cos(secA) * (bo.r * 0.78), Math.sin(secA) * (bo.r * 0.78))
  ctx.stroke()

  // Центральный хроно-кристалл
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/**
 * «Крио-Дрон Утилизатор»: корпус холодильной камеры с кольцом HP, подвесы и
 * вращающиеся лопасти турбин, морозный выхлоп сопла и телеграф сброса капсулы.
 * Сегменты-блоки турбин рисует обычный drawBlocks.
 */
function drawCryoBoss(ctx: Ctx, bo: BossState, blocks: Block[]) {
  const frac = clamp(bo.hp / bo.maxHp, 0, 1)
  const angry = bo.hp < bo.maxHp * (bo.angryAt ?? 0.5)
  // подвесы тарелок — линиями от корпуса к каждому живому сегменту
  ctx.save()
  ctx.strokeStyle = "rgba(168,226,255,0.55)"
  ctx.lineWidth = 3
  for (const b of blocks) {
    if (!b.isCryoPart || b.dead) continue
    ctx.beginPath()
    ctx.moveTo(bo.x, bo.y + bo.r * 0.35)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.translate(bo.x, bo.y)
  // Кольцо HP
  ctx.lineWidth = 6
  ctx.strokeStyle = "rgba(4,18,26,0.7)"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = frac > 0.55 ? "#7cf5ff" : frac > 0.25 ? "#ffc94d" : "#ff5347"
  ctx.beginPath()
  ctx.arc(0, 0, bo.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac)
  ctx.stroke()

  // Корпус: холодный металл с ледяной кромкой
  ctx.shadowColor = angry ? "#ff5ca8" : "#35e0ff"
  ctx.shadowBlur = 26
  const g = ctx.createRadialGradient(-bo.r * 0.35, -bo.r * 0.4, 4, 0, 0, bo.r * 1.2)
  g.addColorStop(0, "#f2fcff")
  g.addColorStop(0.45, angry ? "#9fd6ff" : "#7cc4e8")
  g.addColorStop(1, "#123a52")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  if (bo.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.75})`
    ctx.beginPath()
    ctx.arc(0, 0, bo.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Решётка холодильной камеры
  ctx.strokeStyle = "rgba(10,40,58,0.6)"
  ctx.lineWidth = 2
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * bo.r * 0.26, -bo.r * 0.5)
    ctx.lineTo(i * bo.r * 0.26, bo.r * 0.5)
    ctx.stroke()
  }
  // Сенсор-«глаз» патруля
  ctx.fillStyle = angry ? "#ff2a6d" : "#0b2a3a"
  ctx.beginPath()
  ctx.arc(0, -bo.r * 0.28, bo.r * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  ctx.beginPath()
  ctx.arc(-bo.r * 0.05, -bo.r * 0.32, bo.r * 0.05, 0, Math.PI * 2)
  ctx.fill()

  // Сопло и морозный выхлоп под корпусом
  ctx.fillStyle = "rgba(35,90,120,0.9)"
  ctx.beginPath()
  ctx.moveTo(-bo.r * 0.28, bo.r * 0.86)
  ctx.lineTo(bo.r * 0.28, bo.r * 0.86)
  ctx.lineTo(bo.r * 0.16, bo.r * 1.12)
  ctx.lineTo(-bo.r * 0.16, bo.r * 1.12)
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 3; i++) {
    const ph = (bo.t * 0.9 + i / 3) % 1
    ctx.fillStyle = `rgba(124,245,255,${(1 - ph) * 0.4})`
    ctx.beginPath()
    ctx.arc(
      Math.sin(bo.t * 2 + i) * bo.r * 0.12,
      bo.r * 1.1 + ph * bo.r * 0.5,
      5 * (1 - ph) + 2,
      0,
      Math.PI * 2
    )
    ctx.fill()
  }
  ctx.restore()

  // Тарелки-турбины: лопасти вращаются, пока тарелка жива
  for (const b of blocks) {
    if (!b.isCryoPart || b.dead || b.cryoSeg !== 1) continue
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.fillStyle = "rgba(20,60,84,0.85)"
    ctx.beginPath()
    ctx.arc(0, 0, b.rx + 2, 0, Math.PI * 2)
    ctx.fill()
    const spin = bo.cryoScroll ?? bo.t
    ctx.strokeStyle = "rgba(168,226,255,0.9)"
    ctx.lineWidth = 3
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI * 2) / 3
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * b.rx * 0.92, Math.sin(a) * b.rx * 0.92)
      ctx.stroke()
    }
    ctx.fillStyle = "#f2fcff"
    ctx.beginPath()
    ctx.arc(0, 0, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Телеграф сброса капсулы: свечение под соплом за 1.4 с до сброса
  const iceTimer = bo.cryoIceTimer ?? 99
  if (iceTimer < 1.4) {
    const k = 1 - clamp(iceTimer / 1.4, 0, 1)
    ctx.save()
    ctx.shadowColor = "#7cf5ff"
    ctx.shadowBlur = 16 + k * 20
    ctx.fillStyle = `rgba(200,245,255,${0.25 + k * 0.5})`
    ctx.beginPath()
    ctx.arc(bo.x, bo.y + bo.r * 1.15, 10 + k * 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** Плазменный сгусток миноги: яркое ядро, ореол и электрический хвост. */
function drawLampreyBolt(ctx: Ctx, b: Block, time: number) {
  const vx = b.bombVx ?? 0
  const vy = b.bombVy ?? 0
  const len = Math.hypot(vx, vy) || 1
  const ux = vx / len
  const uy = vy / len
  const px = -uy
  const py = ux
  const head = "#c8ff7a"
  ctx.save()
  // хвост: два зигзага назад по направлению полёта
  for (const [spread, w, alpha] of [
    [7, 3, 0.85],
    [-6, 2, 0.6],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    for (let i = 1; i <= 4; i++) {
      const t = i / 4
      const off = (i % 2 ? 1 : -1) * spread * t + Math.sin(time * 50 + i * 2.7) * 2
      ctx.lineTo(b.x - ux * 28 * t + px * off, b.y - uy * 28 * t + py * off)
    }
    ctx.strokeStyle = `rgba(157,255,92,${alpha})`
    ctx.lineWidth = w
    ctx.lineCap = "round"
    ctx.stroke()
  }
  // ядро
  ctx.shadowColor = "#9dff5c"
  ctx.shadowBlur = 16
  const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.rx)
  g.addColorStop(0, "#ffffff")
  g.addColorStop(0.45, head)
  g.addColorStop(1, "rgba(46,140,60,0.15)")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(b.x, b.y, b.rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Объёмный контур тела миноги.
 *
 * Раньше тело рисовалось двумя линиями постоянной ширины — получалась «толстая
 * проволока». Теперь строится настоящий силуэт: вдоль оси (цепочка центров
 * сегментов) берётся нормаль в каждой точке, и контур описывается как
 * «ось + нормаль·полуширина» сверху и «ось − нормаль·полуширина» снизу.
 * Полуширина берётся из радиусов сегментов, поэтому тело сужается к хвосту и
 * расширяется у головы, а тонкие места между сегментами дают эффект
 * «сплюснутых» позвонков — силуэт живой, а не труба.
 *
 * `edge` масштабирует полуширину: 1 — внешняя кромка, 0.72 — тело, 0.4 —
 * спинная полоса (блик). Один и тот же путь используется для заливки, обводки
 * и внутренних слоёв, чтобы слои не «разъезжались».
 */
function lampreyBodyPath(ctx: Ctx, pts: { x: number; y: number }[], radii: number[], edge: number) {
  const n = pts.length
  if (n < 2) return
  // Нормаль в точке: перпендикуляр к усреднённому направлению соседей —
  // так излом на повороте тела не даёт «шва» в силуэте.
  const nx: number[] = []
  const ny: number[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    nx.push(-dy / len)
    ny.push(dx / len)
  }
  const half = (i: number) => Math.max(2, radii[i] * edge)

  ctx.beginPath()
  // верхняя кромка: голова → хвост (квадратичные сглаживания к серединам)
  const top: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const r = half(i)
    top.push({ x: pts[i].x + nx[i] * r, y: pts[i].y + ny[i] * r })
  }
  const bot: { x: number; y: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const r = half(i)
    bot.push({ x: pts[i].x - nx[i] * r, y: pts[i].y - ny[i] * r })
  }
  const trace = (list: { x: number; y: number }[]) => {
    ctx.moveTo(list[0].x, list[0].y)
    for (let i = 1; i < list.length; i++) {
      const p = list[i - 1]
      const c = list[i]
      ctx.quadraticCurveTo(p.x, p.y, (p.x + c.x) / 2, (p.y + c.y) / 2)
    }
    const last = list[list.length - 1]
    ctx.lineTo(last.x, last.y)
  }
  trace(top)
  trace(bot)
  ctx.closePath()
}

/**
 * Глаз миноги: моргает и следит за ближайшим шаром.
 *
 * Рисуется в локальных координатах (центр `0,0`) — вызывается внутри
 * `translate` к центру головы, поэтому глаз совпадает с существующим кругом
 * пасти. `dirX/dirY` — направление на цель: зрачок смещается туда, но не
 * дальше `r*0.32`, чтобы не вылезти на кольцо зубов.
 * Моргание — периодическое закрытие века; период сдвинут по seed, поэтому
 * минога моргает «живо», а не по метроному.
 */
function drawLampreyEye(
  ctx: Ctx,
  dirX: number,
  dirY: number,
  r: number,
  time: number,
  seed: number
) {
  const len = Math.hypot(dirX, dirY) || 1
  const reach = r * 0.32
  const px = (dirX / len) * reach
  const py = (dirY / len) * reach
  // Моргание: ~3.6 с цикл со сдвигом по seed; закрыто ~0.13 с.
  const cycle = 3.6 + (seed % 7) * 0.21
  const phase = ((time + seed * 0.37) % cycle) / cycle
  const blink = phase > 0.955 ? 1 - Math.abs((phase - 0.9775) / 0.0225) : 0

  ctx.save()
  // склера
  ctx.fillStyle = "#e8fff2"
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  // радужка с зелёным свечением — «электрический» взгляд
  const g = ctx.createRadialGradient(px, py, r * 0.1, px, py, r * 0.82)
  g.addColorStop(0, "#c8ff7a")
  g.addColorStop(0.55, "#4dff9e")
  g.addColorStop(1, "#0f6b4a")
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(px, py, r * 0.82, 0, Math.PI * 2)
  ctx.fill()
  // зрачок
  ctx.fillStyle = "#04140d"
  ctx.beginPath()
  ctx.arc(px, py, r * 0.42, 0, Math.PI * 2)
  ctx.fill()
  // блик
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.beginPath()
  ctx.arc(px - r * 0.22, py - r * 0.26, r * 0.2, 0, Math.PI * 2)
  ctx.fill()

  if (blink > 0) {
    // Веко опускается сверху: закрашиваем глаз фоном-«кожей» и рисуем ресницу.
    ctx.fillStyle = "#0a2b22"
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.05, r * 1.05 * blink, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "rgba(157,255,92,0.8)"
    ctx.lineWidth = Math.max(1.2, r * 0.16)
    ctx.beginPath()
    ctx.moveTo(-r, r * (1 - blink) * 0.5)
    ctx.lineTo(r, r * (1 - blink) * 0.5)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * «Глубинная Электрическая Минога»: цепочка сегментов по периметру арены.
 *
 * Тело — объёмный силуэт по центрам живых сегментов (та же геометрия, что в
 * bossLamprey): тёмный контур, градиентная заливка «от спины к брюху»,
 * сегментные перетяжки, спинная светящаяся полоса, плавники и хвост. Глаз
 * моргает и следит за шаром. Во время телеграфа вдоль тела бегут разряды.
 */
function drawLampreyBoss(ctx: Ctx, bo: BossState, blocks: Block[], balls: Ball[]) {
  const segs = blocks
    .filter((b) => b.isLampreySeg && !b.dead)
    .sort((a, b) => (a.lampreySeg ?? 0) - (b.lampreySeg ?? 0))
  if (segs.length === 0) return
  const angry = bo.hp < bo.maxHp * (bo.angryAt ?? 0.5)
  const bodyGlow = angry ? "#ff5ca8" : "#4dff9e"
  const headAlive = (segs[0].lampreySeg ?? 0) === 0
  // Снаряды миноги — свои: снаряд-«сгусток» не рисуется как молния медузы.
  for (const b of blocks) {
    if (b.lampreyBolt && !b.dead) drawLampreyBolt(ctx, b, bo.t)
  }
  /* Тело: объёмный силуэт вместо прежней «толстой линии». Слои снизу вверх —
     тень на дне, внешняя кромка, тело с градиентом «спина → брюхо», спинная
     полоса-блик. Полуширина берётся из радиусов сегментов, поэтому тело
     сужается к хвосту и слегка пережимается между позвонками. */
  if (segs.length > 1) {
    const pts = segs.map((b) => ({ x: b.x, y: b.y }))
    // Полуширина силуэта в каждой точке = радиус её сегмента: тело сужается
    // к хвосту ровно так же, как сужаются хитбоксы.
    const rads = segs.map((b) => Math.max(6, b.rx))

    ctx.save()
    // 1. Тень на «дне» — тело отрывается от арены, силуэт читается объёмным.
    ctx.save()
    ctx.translate(0, 5)
    lampreyBodyPath(ctx, pts, rads, 1.18)
    ctx.fillStyle = "rgba(2,18,14,0.45)"
    ctx.fill()
    ctx.restore()

    // 2. Внешняя тёмная кромка: контур «шкуры».
    lampreyBodyPath(ctx, pts, rads, 1.0)
    ctx.fillStyle = "#08251c"
    ctx.fill()
    ctx.strokeStyle = "rgba(157,255,92,0.5)"
    ctx.lineWidth = 2
    ctx.stroke()

    // 3. Тело с поперечным градиентом: спина светлее, брюхо в тени.
    lampreyBodyPath(ctx, pts, rads, 0.82)
    const top = Math.min(...pts.map((p) => p.y))
    const bot = Math.max(...pts.map((p) => p.y))
    const shade = ctx.createLinearGradient(0, top - 12, 0, bot + 12)
    shade.addColorStop(0, angry ? "#7a1030" : "#1c5c3c")
    shade.addColorStop(0.45, angry ? "#c81f52" : "#2f9a5e")
    shade.addColorStop(1, angry ? "#2a0a16" : "#0c3227")
    ctx.fillStyle = shade
    ctx.fill()

    // 4. Спинная светящаяся полоса: узкий блик вдоль верхней кромки.
    lampreyBodyPath(ctx, pts, rads, 0.34)
    ctx.save()
    ctx.shadowColor = bodyGlow
    ctx.shadowBlur = 18
    ctx.fillStyle = angry ? "rgba(255,92,168,0.55)" : "rgba(77,255,158,0.5)"
    ctx.fill()
    ctx.restore()

    // 5. Перетяжки между позвонками: короткие дуги поперёк тела.
    ctx.save()
    ctx.strokeStyle = "rgba(6,30,24,0.55)"
    ctx.lineWidth = 2
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const c = pts[i]
      const dx = c.x - a.x
      const dy = c.y - a.y
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      const rr = rads[i] * 0.8
      ctx.beginPath()
      ctx.moveTo(c.x + nx * rr, c.y + ny * rr)
      ctx.quadraticCurveTo(c.x, c.y, c.x - nx * rr, c.y - ny * rr)
      ctx.stroke()
    }
    ctx.restore()

    // 6. Хвостовой плавник за последним сегментом.
    const tl = pts[pts.length - 1]
    const tp = pts[pts.length - 2]
    const tdx = tl.x - tp.x
    const tdy = tl.y - tp.y
    const tlen = Math.hypot(tdx, tdy) || 1
    const ux = tdx / tlen
    const uy = tdy / tlen
    const span = Math.max(10, segs[segs.length - 1].rx * 1.6)
    ctx.save()
    ctx.translate(tl.x, tl.y)
    ctx.rotate(Math.atan2(uy, ux))
    ctx.fillStyle = angry ? "rgba(255,92,168,0.75)" : "rgba(77,255,158,0.7)"
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(span * 0.6, -span * 0.9, span * 1.5, 0)
    ctx.quadraticCurveTo(span * 0.6, span * 0.9, 0, 0)
    ctx.fill()
    ctx.restore()
    ctx.restore()
  }

  for (const b of segs) {
    const seg = b.lampreySeg ?? 0
    const frac = clamp(b.hp / Math.max(1, b.maxHp), 0, 1)
    ctx.save()
    ctx.fillStyle =
      frac > 0.6
        ? "rgba(157,255,92,0.85)"
        : frac > 0.3
          ? "rgba(255,201,77,0.85)"
          : "rgba(255,70,70,0.8)"
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.rx * 0.62, 0, Math.PI * 2)
    ctx.fill()
    // блик на чешуе
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    ctx.beginPath()
    ctx.arc(b.x - b.rx * 0.16, b.y - b.rx * 0.2, b.rx * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    if (seg !== 0) continue
    // Голова: кольцо HP вокруг переднего сегмента + зубастая пасть
    const headFrac = clamp(bo.hp / bo.maxHp, 0, 1)
    const r = b.rx + 10
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.strokeStyle = "rgba(4,18,26,0.7)"
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = headFrac > 0.5 ? "#9dff5c" : headFrac > 0.25 ? "#ffc94d" : "#ff5347"
    ctx.beginPath()
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * headFrac)
    ctx.stroke()
    ctx.strokeStyle = "rgba(255,255,255,0.8)"
    ctx.lineWidth = 2
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI * 2) / 10
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * b.rx * 0.45, Math.sin(a) * b.rx * 0.45)
      ctx.lineTo(Math.cos(a) * b.rx * 0.8, Math.sin(a) * b.rx * 0.8)
      ctx.stroke()
    }
    ctx.fillStyle = "#06131b"
    ctx.beginPath()
    ctx.arc(0, 0, b.rx * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    /* Глаз — это существующий тёмный круг в центре головы (раньше он был
       просто чёрным зрачком). Отдельный маленький глаз поверх головы убран:
       он дублировал этот круг и мешал читать пасть. Круг моргает и следит за
       ближайшим шаром. */
    let lookX = bo.x + Math.cos((bo.t ?? 0) * 0.9) * 40
    let lookY = bo.y + Math.sin((bo.t ?? 0) * 0.9) * 40
    if (balls.length) {
      let best = balls[0]
      let bestD = Infinity
      for (const ball of balls) {
        const d = Math.hypot(ball.x - b.x, ball.y - b.y)
        if (d < bestD) {
          bestD = d
          best = ball
        }
      }
      lookX = best.x
      lookY = best.y
    }
    const eyeR = b.rx * 0.32
    ctx.save()
    ctx.translate(b.x, b.y)
    drawLampreyEye(ctx, lookX - b.x, lookY - b.y, eyeR, bo.t ?? 0, seg)
    ctx.restore()

    ctx.save()
    ctx.translate(b.x, b.y)
    if (bo.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.7})`
      ctx.beginPath()
      ctx.arc(0, 0, b.rx, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  /* Телеграф разряда: свечение вдоль спины и дуги ТОЛЬКО между соседними
     позвонками. Раньше здесь были зигзаги через всё тело — они визуально
     «сшивали» хвост с головой отдельными линиями поверх силуэта, что выглядело
     как лишние провода. Теперь электричество читается по свечению тела. */
  const charge = clamp(bo.lampreyCharge ?? 0, 0, 1)
  if (charge > 0.05 && segs.length > 1) {
    const pts = segs.map((b) => ({ x: b.x, y: b.y }))
    const rads = segs.map((b) => Math.max(6, b.rx))
    ctx.save()
    ctx.shadowColor = "#c8ff7a"
    ctx.shadowBlur = 8 + charge * 22
    lampreyBodyPath(ctx, pts, rads, 0.5)
    ctx.fillStyle = `rgba(200,255,122,${0.08 + charge * 0.22})`
    ctx.fill()
    ctx.restore()
  }

  /* Голова сбита — минога уже мертва (`stepLamprey` вызывает killBoss в тот же
     кадр), поэтому кольцо реванша не рисуем: оно обещало «возвращение», которого
     больше нет. Осталось только короткое дрожание тела для читаемости смерти. */
  if (!headAlive) {
    const first = segs[0]
    ctx.save()
    ctx.translate(first.x, first.y)
    ctx.strokeStyle = "rgba(157,255,92,0.35)"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, first.rx + 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

export function drawBoss(ctx: Ctx, boss: BossState | null, balls: Ball[], blocks: Block[]) {
  const bo = boss
  if (!bo) return
  if (bo.isJellyfish) {
    drawJellyfishBoss(ctx, bo, balls, blocks)
    return
  }
  if (bo.isCrab) {
    drawCrabBoss(ctx, bo, balls, blocks)
    return
  }
  if (bo.isCryo) {
    drawCryoBoss(ctx, bo, blocks)
    return
  }
  if (bo.isLamprey) {
    drawLampreyBoss(ctx, bo, blocks, balls)
    return
  }
  if (bo.isChrono) {
    drawChronoBoss(ctx, bo)
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
