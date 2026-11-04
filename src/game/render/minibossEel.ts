import { TIER } from "../palette"
import type { Block } from "../types"

import type { Ctx } from "./shapes"

/** Волна тела: амплитуда у хвоста, px. */
const WAVE_AMP = 4.5
/** Частота волны (рад/с) — гребень бежит от носа к хвосту, как у живой рыбы. */
const WAVE_FREQ = 2.3
/** Сдвиг фазы между соседними частями тела: чем больше, тем «змеинее» волна. */
const WAVE_PHASE_STEP = 0.85
/**
 * Дополнительное боковое смещение головы при «змейном» движении, px.
 * У угря голова водит из стороны в сторону заметнее тела — без этого силуэт
 * остаётся ровной «трубой» с местной рябью (замечание 04.11.2026).
 */
const HEAD_SWAY = 2.6
/**
 * Визуальное сужение хвоста: насколько ДОПОЛНИТЕЛЬНО утончаются узлы к концу.
 * Хитбоксы не трогаем (симметрия по `mbFacing` обязана сохраниться, AD-037),
 * но рисованное тело сужается сильнее — иначе угорь выглядит трубой.
 */
const TAIL_TAPER = 0.34

interface Point {
  x: number
  y: number
}

interface Node extends Point {
  ry: number
}

/**
 * «Скользкий угорь» (T-058, переделка T-063): узкая лента тела с **сильным**
 * сужением к хвосту, крупная голова-клин с утолщением за глазами, выраженный
 * спинной плавник-складка и широкий хвостовой плавник.
 *
 * Силуэт рисуется в отражённой системе координат по `mbFacing`: нос всегда
 * смотрит по ходу движения. Тело симметрично относительно своего центра
 * (см. `buildEel`), поэтому отражение попадает на те же эллипсы, что физика.
 *
 * Масштабирование деталей идёт от **максимального** полурадиуса тела, а не от
 * блока головы: иначе на мелких частях глаз и пасть вырождались в точку.
 */
export function drawEel(ctx: Ctx, parts: Block[], time: number) {
  const head = parts.find((p) => p.mbPart === "eel_head")
  const fin = parts.find((p) => p.mbPart === "eel_fin")
  const segs = parts.filter((p) => p.mbPart === "eel_seg")
  if (!head || !segs.length) return

  // От носа к хвосту; хвост последний, поэтому волна бежит назад.
  const spine = (fin ? [head, ...segs, fin] : [head, ...segs]).sort((a, b) => b.x - a.x)
  const left = Math.min(...spine.map((p) => p.x - p.rx))
  const right = Math.max(...spine.map((p) => p.x + p.rx))
  const cx = (left + right) / 2
  const flash = Math.max(...parts.map((p) => p.flash))
  // Единый масштаб деталей: самое толстое место тела.
  const thick = Math.max(...spine.map((p) => p.ry))

  const nodes: Node[] = spine.map((p, i) => {
    const k = i / Math.max(1, spine.length - 1)
    const wave = Math.sin(time * WAVE_FREQ - i * WAVE_PHASE_STEP) * WAVE_AMP * (0.25 + 0.75 * k)
    // Голова водит сильнее тела: у угря это главный признак «живой змеи».
    const headLead = i === 0 ? Math.sin(time * WAVE_FREQ * 0.7) * HEAD_SWAY : 0
    // Тело чуть тоньше хитбокса: между блоками не должно быть «пузырей».
    // К хвосту утончаем дополнительно — силуэт перестаёт быть «трубой».
    const taper = 1 - TAIL_TAPER * k * k
    return { x: p.x - cx, y: p.y + wave + headLead, ry: p.ry * 0.88 * taper }
  })
  const midY = nodes.reduce((s, n) => s + n.y, 0) / nodes.length

  ctx.save()
  ctx.translate(cx, 0)
  ctx.scale(head.mbFacing ?? 1, 1)

  drawBody(ctx, nodes, midY, thick)
  drawRidge(ctx, nodes, thick)
  drawTailFin(ctx, nodes[nodes.length - 1]!, thick, time)
  drawHead(ctx, nodes[0]!, thick, time)

  if (flash > 0.05) {
    ctx.globalAlpha = Math.min(flash, 1) * 0.45
    ctx.fillStyle = "#ffffff"
    for (const n of nodes) {
      ctx.beginPath()
      ctx.ellipse(n.x, n.y, n.ry * 1.35, n.ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

/**
 * Тело: одна замкнутая лента от носа к хвосту. Толщина задаётся узлами и
 * сужается к хвосту; градиент поперёк тела даёт объём.
 */
function drawBody(ctx: Ctx, nodes: Node[], midY: number, thick: number) {
  const top = nodes.map((n) => ({ x: n.x, y: n.y - n.ry }))
  const bottom = nodes.map((n) => ({ x: n.x, y: n.y + n.ry })).reverse()
  ctx.beginPath()
  traceSmooth(ctx, top, true)
  traceSmooth(ctx, bottom, false)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, midY - thick, 0, midY + thick)
  g.addColorStop(0, TIER[1].dark)
  g.addColorStop(0.45, TIER[1].base)
  g.addColorStop(1, "#0b6b45")
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.4
  ctx.stroke()

  // спинной блик вдоль верхней кромки
  ctx.beginPath()
  traceSmooth(
    ctx,
    nodes.map((n) => ({ x: n.x, y: n.y - n.ry * 0.45 })),
    true
  )
  ctx.strokeStyle = "rgba(234, 255, 244, 0.4)"
  ctx.lineWidth = Math.max(1.2, thick * 0.14)
  ctx.lineCap = "round"
  ctx.stroke()
}

/** Спинной плавник-складка по задней половине спины, с «лучом» внутри. */
function drawRidge(ctx: Ctx, nodes: Node[], thick: number) {
  // Гребень начинается ПОСЛЕ головы: с `nodes.length * 0.3` он стартовал ещё
  // на голове, и у стыка торчал вертикальный треугольник (крупный план
  // 04.11.2026). Первые два узла — голова и её стык с телом.
  const from = Math.max(2, Math.floor(nodes.length * 0.42))
  const pts = nodes.slice(from)
  if (pts.length < 2) return
  const base = pts.map((n) => ({ x: n.x, y: n.y - n.ry * 0.85 }))
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, base[0]!.y)
  // Гребень поднимается ОТ НУЛЯ к середине и сходит на нет к хвосту: резкий
  // старт давал «плавник-обрубок» на стыке с головой.
  for (let i = 0; i < pts.length - 1; i++) {
    const k = i / (pts.length - 1)
    const h = thick * 0.5 * Math.sin(Math.PI * (0.1 + 0.8 * k)) * Math.min(1, k * 2.2)
    const nx = pts[i]!.x
    ctx.quadraticCurveTo(nx, pts[i]!.y - pts[i]!.ry - h, pts[i + 1]!.x, base[i + 1]!.y)
  }
  ctx.lineTo(pts[pts.length - 1]!.x, base[pts.length - 1]!.y)
  traceSmooth(ctx, base.slice().reverse(), false)
  ctx.closePath()
  ctx.fillStyle = "rgba(93, 255, 176, 0.42)"
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1
  ctx.stroke()
}

/**
 * Хвостовой плавник: широкая веерная лопасть, расходящаяся от конца тела.
 * Одна замкнутая форма с прожилками — раньше две вращающиеся «лопасти»
 * читались как ножницы.
 */
function drawTailFin(ctx: Ctx, tail: Node, thick: number, time: number) {
  const ry = Math.max(tail.ry, thick * 0.3)
  const len = thick * 1.15
  ctx.save()
  ctx.translate(tail.x - ry * 0.2, tail.y)
  ctx.rotate(Math.sin(time * 3.1) * 0.14)
  ctx.beginPath()
  ctx.moveTo(0, -ry * 0.9)
  ctx.quadraticCurveTo(-len * 0.55, -ry * 1.5, -len, -ry * 1.85)
  ctx.quadraticCurveTo(-len * 0.72, -ry * 0.55, -len * 0.8, 0)
  ctx.quadraticCurveTo(-len * 0.72, ry * 0.55, -len, ry * 1.85)
  ctx.quadraticCurveTo(-len * 0.55, ry * 1.5, 0, ry * 0.9)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -ry * 1.6, 0, ry * 1.6)
  g.addColorStop(0, TIER[1].light)
  g.addColorStop(0.5, TIER[1].base)
  g.addColorStop(1, TIER[1].dark)
  ctx.fillStyle = g
  ctx.fill()
  // Обводка только по видимой части: у затылка линия не рисуется,
  // иначе поверх тела появлялся шов «приставленной головы».
  ctx.clip()
  ctx.lineWidth = 1.1
  ctx.strokeStyle = TIER[1].dark
  ctx.stroke()
  // прожилки плавника
  ctx.strokeStyle = "rgba(4, 18, 26, 0.28)"
  ctx.lineWidth = 1
  for (const k of [-0.7, -0.3, 0.3, 0.7]) {
    ctx.beginPath()
    ctx.moveTo(-len * 0.08, 0)
    ctx.lineTo(-len * 0.92, ry * 1.7 * k)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Голова угря: узкая, низкая и **змеиная**, а не рыбий клин.
 *
 * Признаки, которые делают силуэт угревым (правка 04.11.2026 по крупному
 * плану — прежняя голова читалась как щучья/барракуда):
 *  - морда УЖЕ тела и почти плоская — угорь не «высоколобый»;
 *  - кончик тупой и скруглённый, без клюва;
 *  - рот — длинная щель вдоль брюха, доходящая почти до жабер;
 *  - глаз МАЛЕНЬКИЙ (у угря он крошечный относительно головы) и высоко;
 *  - жаберное отверстие — короткая щель у самого тела.
 */
function drawHead(ctx: Ctx, node: Node, thick: number, time: number) {
  const ry = node.ry
  // Морда вытянутая, но НЕ выше тела: полувысота — четверть толщины.
  const len = ry * 3.2
  const nose = ry * 0.46
  const eyeR = Math.max(1.3, thick * 0.13)
  // Затылок уходит глубоко в первый сегмент: голова и тело — один силуэт.
  const nape = ry * 3.6
  ctx.save()
  ctx.translate(node.x, node.y)

  // --- контур: узкая плоская морда, тупой кончик, тяжёлая нижняя челюсть ---
  ctx.beginPath()
  ctx.moveTo(-nape, -ry * 0.42)
  // верхняя кромка почти прямая — «змейная», без выраженного лба
  ctx.bezierCurveTo(-ry * 1.2, -ry * 0.62, ry * 0.4, -nose * 1.02, len * 0.76, -nose * 0.78)
  // тупой кончик: короткая дуга, скруглённая сверху вниз
  ctx.quadraticCurveTo(len * 1.0, -nose * 0.5, len * 0.99, nose * 0.1)
  // нижняя челюсть: чуть тяжелее и выдаётся вперёд
  ctx.quadraticCurveTo(len * 0.96, nose * 0.62, len * 0.6, nose * 0.76)
  ctx.bezierCurveTo(-ry * 0.2, ry * 0.86, -ry * 1.4, ry * 0.78, -nape, ry * 0.46)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -nose, 0, ry * 0.8)
  g.addColorStop(0, TIER[1].light)
  g.addColorStop(0.5, TIER[1].base)
  g.addColorStop(1, "#0a6440")
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = 1.1
  ctx.stroke()

  // --- рот: одна длинная щель вдоль брюха, до жабер ---
  ctx.beginPath()
  ctx.moveTo(len * 0.94, nose * 0.2)
  ctx.quadraticCurveTo(len * 0.6, nose * 0.62, -ry * 0.35, ry * 0.44)
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = Math.max(1.1, thick * 0.085)
  ctx.lineCap = "round"
  ctx.stroke()

  // --- блик по верху морды (влажная кожа) ---
  ctx.globalAlpha = 0.26 + 0.08 * Math.sin(time * 2.6)
  ctx.beginPath()
  ctx.ellipse(len * 0.34, -nose * 0.5, len * 0.26, nose * 0.22, -0.05, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1

  // --- жаберное отверстие: короткая щель у тела ---
  ctx.beginPath()
  ctx.moveTo(-ry * 0.86, -ry * 0.16)
  ctx.quadraticCurveTo(-ry * 0.92, 0, -ry * 0.85, ry * 0.26)
  ctx.strokeStyle = "rgba(3, 20, 14, 0.4)"
  ctx.lineWidth = 1.05
  ctx.stroke()

  // --- глаз: МАЛЕНЬКИЙ, высоко и у затылка ---
  const eyeX = len * 0.18
  const eyeY = -nose * 0.42
  ctx.beginPath()
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2)
  ctx.fillStyle = "#e8f7ff"
  ctx.fill()
  ctx.strokeStyle = "rgba(3, 20, 14, 0.85)"
  ctx.lineWidth = 0.9
  ctx.stroke()
  // зрачок — вертикальный овал: у угря глаз «рыбий», не человеческий
  ctx.beginPath()
  ctx.ellipse(eyeX + eyeR * 0.2, eyeY, eyeR * 0.44, eyeR * 0.72, 0, 0, Math.PI * 2)
  ctx.fillStyle = "#04140f"
  ctx.fill()
  ctx.beginPath()
  ctx.arc(eyeX + eyeR * 0.02, eyeY - eyeR * 0.34, eyeR * 0.26, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.fill()

  ctx.restore()
}

/** Плавная ломаная по серединам отрезков; `begin` — начинать ли новый путь. */
function traceSmooth(ctx: Ctx, pts: Point[], begin: boolean) {
  if (!pts.length) return
  if (begin) ctx.moveTo(pts[0]!.x, pts[0]!.y)
  else ctx.lineTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const cur = pts[i]!
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2)
  }
  const last = pts[pts.length - 1]!
  ctx.lineTo(last.x, last.y)
}
