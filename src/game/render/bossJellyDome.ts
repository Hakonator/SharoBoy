import { BossState } from "../types"
import { clamp } from "../utils"

import { type Ctx } from "./shapes"

/**
 * Купол босса-медузы: общая геометрия контура и тонкая HP-полоска ровно по нему.
 *
 * Контур — верхняя полуарка плюс волнистая бахрома через всю ширину низа.
 * Canvas не умеет измерять длину пути, поэтому купол и полоска собираются из
 * одних формул (lobeOf): заливка идёт настоящими кривыми (traceJellyDome),
 * полоска — их полилинией (jellyDomeContour), а заполнение — обрезком этой
 * ломанной длиной frac·L, симметричным от макушки (jellyHpContourSlice).
 * Полоску вызывать нужно внутри трансформа купола (сдвиг + масштаб пульса) —
 * тогда она изгибается вместе с телом и повторяет волну бахромы.
 */

/** Линия кромки: y = r·RIM_Y; ниже неё — провалы бахромы. */
export const JELLY_DOME_RIM_Y = 0.28
/** Лопастей бахромы через всю ширину: 2r / 8 = r/4 на каждую. */
const LOBES = 8
/** Насколько лопасть проваливается под кромку (доли r) и амплитуда её волны. */
const LOBE_DIP = 0.34
const LOBE_WOBBLE = 0.05
/** Шаги аппроксимации контура: четверть дуги и одна лопасть. */
const ARC_STEPS = 24
const LOBE_STEPS = 10

interface Lobe {
  /** Начало лопасти на кромке (равно концу предыдущей). */
  x0: number
  /** Конец лопасти на кромке. */
  x1: number
  /** Контрольная точка квадратичной кривой. */
  cx: number
  cy: number
}

/** Геометрия лопасти k бахромы: из (x0, кромка) в (x1, кромка) с провалом ниже. */
function lobeOf(bo: BossState, k: number): Lobe {
  const w = (bo.r * 2) / LOBES
  const x0 = bo.r - w * k
  return {
    x0,
    x1: x0 - w,
    cx: x0 - w / 2,
    cy: bo.r * (JELLY_DOME_RIM_Y + LOBE_DIP + Math.sin(bo.t * 5 + k) * LOBE_WOBBLE),
  }
}

/**
 * Контур купола в текущем пути: верхняя полуарка и бахрома через всю ширину.
 * Единственный источник формы купола — полоска HP повторяет её через
 * jellyDomeContour.
 */
export function traceJellyDome(ctx: Ctx, bo: BossState) {
  const rimY = bo.r * JELLY_DOME_RIM_Y
  ctx.moveTo(-bo.r, rimY)
  ctx.arc(0, rimY, bo.r, Math.PI, Math.PI * 2)
  // текущая точка после дуги — (r, rimY), она же x0 нулевой лопасти; дальше
  // точка перетекает из лопасти в лопасть, последняя заканчивается в (-r, rimY)
  for (let k = 0; k < LOBES; k++) {
    const l = lobeOf(bo, k)
    ctx.quadraticCurveTo(l.cx, l.cy, l.x1, rimY)
  }
  ctx.closePath()
}

/**
 * Полигональная аппроксимация того же контура (плоский массив [x,y,…],
 * локальные координаты купола). Обход от макушки (индекс 0): вправо по дуге,
 * бахрома справа налево, возврат по левой дуге к макушке — замыкается ребром
 * последняя вершина → первая.
 */
export function jellyDomeContour(bo: BossState): number[] {
  const pts: number[] = []
  const r = bo.r
  const rimY = r * JELLY_DOME_RIM_Y
  // макушка → правый край
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = -Math.PI / 2 + (i / ARC_STEPS) * (Math.PI / 2)
    pts.push(Math.cos(a) * r, rimY + Math.sin(a) * r)
  }
  // бахрома справа налево (нулевая точка каждой лопасти уже стоит в массиве)
  for (let k = 0; k < LOBES; k++) {
    const l = lobeOf(bo, k)
    for (let i = 1; i <= LOBE_STEPS; i++) {
      const u = i / LOBE_STEPS
      const m = 1 - u
      pts.push(
        m * m * l.x0 + 2 * m * u * l.cx + u * u * l.x1,
        m * m * rimY + 2 * m * u * l.cy + u * u * rimY
      )
    }
  }
  // левый край → макушка: не дублирует ни (-r, rimY) с последней лопасти,
  // ни макушку с первого шага дуги
  for (let i = 1; i < ARC_STEPS; i++) {
    const a = Math.PI + (i / ARC_STEPS) * (Math.PI / 2)
    pts.push(Math.cos(a) * r, rimY + Math.sin(a) * r)
  }
  return pts
}

/** Длина ломанной [x,y,…] по замкнутому контуру. */
export function contourLength(contour: number[]): number {
  const n = contour.length / 2
  let total = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    total += Math.hypot(contour[j * 2] - contour[i * 2], contour[j * 2 + 1] - contour[i * 2 + 1])
  }
  return total
}

/**
 * Обрезок замкнутого контура длиной frac·L, симметричный от точки 0 (макушка):
 * назад и вперёд по обходу поровну — полоска сокращается к макушке с обоих
 * концов. Точки идут вдоль того же обхода; frac ≤ 0 — пусто, ≥ 1 — весь
 * контур с явно добавленным замыкающим ребром (вставка в конец массива).
 */
export function jellyHpContourSlice(contour: number[], frac: number): number[] {
  const n = contour.length / 2
  if (n < 3 || frac <= 0) return []
  const lens: number[] = new Array(n)
  let total = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const d = Math.hypot(contour[j * 2] - contour[i * 2], contour[j * 2 + 1] - contour[i * 2 + 1])
    lens[i] = d
    total += d
  }
  if (frac >= 1) return [...contour, contour[0], contour[1]]
  if (total <= 0) return contour.slice()
  const half = (total * frac) / 2
  // точка на ребре i: от вершины i к вершине i+1
  const at = (i: number, t: number): [number, number] => {
    const j = (i + 1) % n
    return [
      contour[i * 2] + (contour[j * 2] - contour[i * 2]) * t,
      contour[i * 2 + 1] + (contour[j * 2 + 1] - contour[i * 2 + 1]) * t,
    ]
  }
  // вперёд от макушки: целые рёбра 0..fwd-1 и остаток на ребре fwd
  let fwd = 0
  let acc = 0
  while (fwd < n - 1 && acc + lens[fwd] <= half) {
    acc += lens[fwd]
    fwd++
  }
  const fwdT = lens[fwd] > 0 ? (half - acc) / lens[fwd] : 0
  // назад от макушки: целые рёбра n-1..n-back и остаток на ребре backEdge,
  // отсчитанный от его конца (вершины backEdge+1) в сторону backEdge
  let back = 0
  acc = 0
  while (back < n - 1 && acc + lens[n - 1 - back] <= half) {
    acc += lens[n - 1 - back]
    back++
  }
  const backEdge = n - 1 - back
  const backT = lens[backEdge] > 0 ? 1 - (half - acc) / lens[backEdge] : 1
  const out: number[] = []
  const s = at(backEdge, backT)
  out.push(s[0], s[1])
  // вершины от (backEdge+1) до fwd включительно — путь идёт через макушку
  let vi = (backEdge + 1) % n
  for (;;) {
    out.push(contour[vi * 2], contour[vi * 2 + 1])
    if (vi === fwd) break
    vi = (vi + 1) % n
  }
  const e = at(fwd, fwdT)
  out.push(e[0], e[1])
  return out
}

/** Цвет заполнения полоски HP — как у кольца остальных боссов. */
export function jellyHpColor(frac: number): string {
  return frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347"
}

/**
 * Тонкая полоска HP ровно по контуру купола: тёмная подложка по всему
 * периметру и цветное заполнение по остатку HP. Вызывать внутри трансформа
 * купола — полоска изгибается вместе с телом (пульс) и плывёт с волной бахромы.
 */
export function drawJellyDomeHp(ctx: Ctx, bo: BossState) {
  const contour = jellyDomeContour(bo)
  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  // подложка по всему контуру
  ctx.beginPath()
  ctx.moveTo(contour[0], contour[1])
  for (let i = 2; i < contour.length; i += 2) ctx.lineTo(contour[i], contour[i + 1])
  ctx.closePath()
  ctx.strokeStyle = "rgba(4,18,26,0.72)"
  ctx.lineWidth = 4
  ctx.stroke()
  // заполнение — симметричный от макушки обрезок контура по остатку HP
  const frac = clamp(bo.maxHp > 0 ? bo.hp / bo.maxHp : 0, 0, 1)
  const slice = jellyHpContourSlice(contour, frac)
  if (slice.length >= 4) {
    ctx.beginPath()
    ctx.moveTo(slice[0], slice[1])
    for (let i = 2; i < slice.length; i += 2) ctx.lineTo(slice[i], slice[i + 1])
    ctx.strokeStyle = jellyHpColor(frac)
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
  ctx.restore()
}
