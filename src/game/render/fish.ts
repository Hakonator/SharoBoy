import { TIER } from "../palette"
import { Block } from "../types"

import { bboxOf, type Ctx } from "./shapes"
import { drawFishFins, drawFishTail } from "./fishParts"

/** Частота sway рыбы — синхронизирована с buildFish (minibosses.ts). */
const FISH_SWAY_FREQ = 0.45

/**
 * Направление взгляда рыбы [-1..1]: скорость патруля ∝ cos(time·freq).
 * Разворот быстрый и гладкий: рыба почти всё время смотрит по ходу движения
 * и за ~0.35 с переходит через середину — без долгого «схлопывания».
 */
export function fishFacing(parts: Block[], time: number): number {
  const f = parts.find((p) => p.mbPart === "body")?.swayFreq ?? 0
  if (!f) return 1
  // tanh резко спрямляет cos у нуля: ширина зоны перехода подобрана так,
  // чтобы флип занимал ~0.35 с при частоте патруля рыбы
  return Math.tanh(Math.cos(time * f) * 48)
}

/** Рыба: анимированные хвост и плавники, рот; части собираются по тегам. */
export function drawFish(ctx: Ctx, parts: Block[], time: number) {
  const body = parts.filter((p) => p.mbPart === "body")
  const tail = parts.filter((p) => p.mbPart === "tail")
  const dorsal = parts.find((p) => p.mbPart === "dorsal")
  const pectoral = parts.find((p) => p.mbPart === "pectoral")
  const eye = parts.find((p) => p.mbPart === "eye")
  if (!body.length || !tail.length) return
  const b = bboxOf(body)
  const t = bboxOf(tail)
  const midY = b.y + b.h / 2
  const flash = Math.max(...parts.map((p) => p.flash))
  // разворот: быстрый гладкий флип по X вокруг центра тела + лёгкое
  // округление по Y в момент поворота — контур меняется непрерывно
  const facing = fishFacing(parts, time)
  const fx = b.x + b.w / 2
  const sx = (Math.sign(facing) || 1) * Math.max(Math.abs(facing), 0.25)
  const sy = 1 + 0.2 * (1 - Math.abs(facing))
  ctx.save()
  ctx.translate(fx, midY)
  ctx.scale(sx, sy)
  ctx.translate(-fx, -midY)
  // хвост отстаёт от корпуса: рыба плывёт по синусоиде, хвост качается в противофазе
  const swing = -Math.cos(time * FISH_SWAY_FREQ) * 0.17 + Math.sin(time * 2.1) * 0.035
  const jointX = b.x + b.w * 0.05
  const L = (jointX - (t.x - t.w * 0.15)) * 1.25 + 20
  const H = t.h * 1.6 + 22

  drawFishTail(ctx, jointX, midY, swing, L, H, flash)

  drawFishFins(ctx, time, dorsal, b, midY)

  // тело: цельный вытянутый овал — одна замкнутая кривая без стыков:
  // максимальная высота ближе к голове, плавное сужение к хвосту
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h)
  bg.addColorStop(0, TIER[2].light)
  bg.addColorStop(0.55, TIER[2].base)
  bg.addColorStop(1, TIER[2].dark)
  ctx.fillStyle = bg
  const noseX = b.x + b.w
  const tailX = b.x + b.w * 0.03
  const topH = b.h * 0.5
  const peakX = b.x + b.w * 0.62 // самое высокое сечение
  // геометрия рта — общая для контура тела, полости и челюсти
  // угол рта лежит на линии брюха: челюсть продолжается прямо в нижний контур
  const p0x = b.x + b.w * 0.8 // угол рта (шарнир челюсти)
  const p0y = midY + b.h * 0.28
  const lx = b.x + b.w * 0.99 // кончик верхней губы у носа
  const ly = midY + b.h * 0.02
  const midX = (p0x + lx) / 2
  const midM = (p0y + ly) / 2
  ctx.beginPath()
  // верхняя кромка: кончик губы → нос → спина → сужение к хвосту
  ctx.moveTo(lx, ly)
  ctx.bezierCurveTo(
    noseX - b.w * 0.01,
    midY - topH * 0.45,
    b.x + b.w * 0.95,
    midY - topH * 0.8,
    b.x + b.w * 0.85,
    midY - topH * 0.93
  )
  ctx.bezierCurveTo(
    b.x + b.w * 0.75,
    midY - topH,
    peakX + b.w * 0.1,
    midY - topH,
    peakX,
    midY - topH
  )
  ctx.bezierCurveTo(
    peakX - b.w * 0.28,
    midY - topH,
    tailX + b.w * 0.08,
    midY - topH * 0.55,
    tailX,
    midY - topH * 0.2
  )
  // переход в хвост: скруглённый торец вместо острого среза — стебель
  // плавно перетекает в лопасти хвостового плавника
  ctx.bezierCurveTo(
    tailX - b.w * 0.018,
    midY - topH * 0.08,
    tailX - b.w * 0.018,
    midY + topH * 0.08,
    tailX,
    midY + topH * 0.2
  )
  // нижняя кромка: брюхо → касательный выход к углу рта (без излома)
  ctx.bezierCurveTo(
    tailX + b.w * 0.08,
    midY + topH * 0.55,
    peakX - b.w * 0.28,
    midY + topH,
    peakX,
    midY + topH
  )
  ctx.bezierCurveTo(peakX + b.w * 0.12, midY + topH, p0x + b.w * 0.06, p0y + b.h * 0.1, p0x, p0y)
  // вырез рта: верхняя губа от угла рта к кончику — замыкает контур носа
  ctx.quadraticCurveTo(midX, midM - b.h * 0.05, lx, ly)
  ctx.closePath()
  ctx.fill()
  // брюшная тень для объёма
  ctx.globalAlpha = 0.16
  ctx.fillStyle = TIER[2].dark
  ctx.beginPath()
  ctx.ellipse(b.x + b.w * 0.45, midY + b.h * 0.28, b.w * 0.38, b.h * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // жабры: три дуги на боку ближе к хвосту (чтобы не задевать глаз);
  // при открытии рта дуги приоткрываются — раствор и высота растут с ртом
  const open = Math.max(0, Math.sin(time * 0.85))
  const gillOpen = open * 0.5
  for (let g = 0; g < 3; g++) {
    ctx.beginPath()
    ctx.ellipse(
      b.x + b.w * (0.44 + g * 0.07),
      midY,
      b.w * 0.055,
      b.h * (0.26 + g * 0.02) * (1 + gillOpen * 0.2),
      0,
      -(1.05 + gillOpen),
      1.05 + gillOpen
    )
    ctx.strokeStyle = `rgba(176,114,10,${0.7 - g * 0.18})`
    ctx.lineWidth = 1.5 - g * 0.2
    ctx.stroke()
  }

  // грудной плавник: гребёт с небольшой амплитудой
  if (pectoral) {
    const row = Math.sin(time * 2.7 + 0.8) * 0.3
    ctx.save()
    ctx.translate(pectoral.x - 3, pectoral.y - 2)
    ctx.rotate(pectoral.rot + row)
    ctx.beginPath()
    ctx.ellipse(pectoral.rx, 0, pectoral.rx * 1.3, pectoral.ry * 0.8, 0, 0, Math.PI * 2)
    ctx.fillStyle = TIER[1].base
    ctx.fill()
    ctx.strokeStyle = TIER[1].dark
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  // рот: шарнирная нижняя челюсть у самого носа. Тёмная полость — это вырез
  // в передней части головы: верхняя дуга неподвижна, нижняя кромка полости —
  // повернутая линия смыкания, и лоскут челюсти рисуется ровно по ней,
  // поэтому челюсть, губа и полость всегда сомкнуты без щелей
  const phi = open * 0.3 // угол открытия челюсти, рад (~17°)
  const rot = (x: number, y: number) => {
    const dx = x - p0x
    const dy = y - p0y
    const c = Math.cos(phi)
    const s = Math.sin(phi)
    return { x: p0x + dx * c - dy * s, y: p0y + dx * s + dy * c }
  }
  const li = rot(lx, ly)
  const ci = rot(midX, midM + b.h * 0.03)
  // полость: заметно тёмный клин между верхней дугой и челюстью
  ctx.beginPath()
  ctx.moveTo(p0x, p0y)
  ctx.quadraticCurveTo(midX, midM - b.h * 0.05, lx, ly)
  ctx.quadraticCurveTo(ci.x, ci.y, li.x, li.y)
  ctx.closePath()
  const cg = ctx.createLinearGradient(0, p0y - 4, 0, p0y + 14)
  cg.addColorStop(0, "#8a1a24")
  cg.addColorStop(1, "#1a0305")
  ctx.fillStyle = cg
  ctx.fill()
  // нижняя челюсть-лоскут: тот же шарнир, тот же угол, что у кромки полости
  ctx.save()
  ctx.translate(p0x, p0y)
  ctx.rotate(phi)
  ctx.translate(-p0x, -p0y)
  ctx.beginPath()
  ctx.moveTo(p0x, p0y)
  ctx.quadraticCurveTo(midX, midM + b.h * 0.03, lx, ly) // линия смыкания рта
  // подбородок: кривая от кончика губы к шарниру; касательная у шарнира
  // совпадает с касательной брюха (p0x + 0.06w, p0y + 0.1h) — челюсть
  // seamlessly продолжается нижней линией тела, без треугольного зазора
  ctx.bezierCurveTo(
    midX + b.w * 0.01,
    p0y - b.h * 0.12,
    p0x + b.w * 0.06,
    p0y + b.h * 0.1,
    p0x,
    p0y
  )
  ctx.closePath()
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = "rgba(0,0,0,0.25)" // тень под челюстью — отделяет её от головы
  ctx.lineWidth = 1.2
  ctx.stroke()
  // губы по линии смыкания: складка и влажный блик — едут вместе с челюстью
  for (const pass of [
    { w: 3.2, c: "rgba(122,74,8,0.85)" },
    { w: 1.2, c: "rgba(255,214,140,0.6)" },
  ]) {
    ctx.beginPath()
    ctx.moveTo(p0x, p0y)
    ctx.quadraticCurveTo(midX, midM + b.h * 0.03, lx, ly)
    ctx.strokeStyle = pass.c
    ctx.lineWidth = pass.w
    ctx.stroke()
  }
  ctx.restore()
  // верхняя губа: неподвижные складка и блик по верхней дуге
  for (const pass of [
    { w: 3.2, c: "rgba(122,74,8,0.85)" },
    { w: 1.2, c: "rgba(255,214,140,0.6)" },
  ]) {
    ctx.beginPath()
    ctx.moveTo(p0x, p0y)
    ctx.quadraticCurveTo(midX, midM - b.h * 0.05, lx, ly)
    ctx.strokeStyle = pass.c
    ctx.lineWidth = pass.w
    ctx.stroke()
  }

  // глаз: белок, зрачок (смещён к носу), блик
  if (eye) {
    const r = eye.rx * 1.7
    ctx.beginPath()
    ctx.arc(eye.x, eye.y, r, 0, Math.PI * 2)
    ctx.fillStyle = "#f4feff"
    ctx.fill()
    ctx.strokeStyle = "rgba(4,18,28,0.6)"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(eye.x + r * 0.28, eye.y, r * 0.52, 0, Math.PI * 2)
    ctx.fillStyle = "#04121c"
    ctx.fill()
    ctx.beginPath()
    ctx.arc(eye.x + r * 0.1, eye.y - r * 0.24, r * 0.16, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
  }

  // вспышка урона на теле (хвост вспыхивает в своём блоке выше)
  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.5
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.ellipse(b.x + b.w / 2, midY, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}
