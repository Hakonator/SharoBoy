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
 * Визуальное сужение хвоста: насколько ДОПОЛНИТЕЛЬНО утончаются узлы к концу.
 * Хитбоксы не трогаем (симметрия по `mbFacing` обязана сохраниться, AD-037),
 * но рисованное тело сужается сильнее — иначе угорь выглядит трубой.
 */
const TAIL_TAPER = 0.34
/**
 * Число узлов сужения носа. Нос — продолжение той же цепочки узлов, а не
 * отдельная фигура: больше узлов = плавнее переход в тело.
 */
const NOSE_NODES = 5

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
    // Волна бежит по телу и РАСТЁТ от головы к хвосту: у головы амплитуда
    // минимальна, поэтому движение там плавное по определению.
    // Отдельное «болтание» головы (HEAD_SWAY) убрано: его частота 1.61 рад/с
    // не кратна волне 2.3 рад/с, из-за чего возникали биения и движение
    // выглядело дёрганым (жалоба игрока 04.11.2026).
    const wave = Math.sin(time * WAVE_FREQ - i * WAVE_PHASE_STEP) * WAVE_AMP * (0.1 + 0.9 * k * k)
    // К хвосту утончаем дополнительно — силуэт перестаёт быть «трубой».
    const taper = 1 - TAIL_TAPER * k * k
    return { x: p.x - cx, y: p.y + wave, ry: p.ry * 0.88 * taper }
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
/**
 * Геометрия носа — ОДИН источник для контура (`drawBody`) и деталей
 * (`drawHead`). Расхождение этих чисел сразу даёт торчащие за контур линии
 * (скриншот 04.11.2026): рот рисовался на 3.6 px от оси там, где контур носа
 * уже сузился до 1 px, и вылезал наружу острым шипом.
 */
const noseLen = (headRy: number) => headRy * 3.2
/** Полурадиус кончика носа: не ноль, иначе контур сходится в иглу. */
const noseTipRy = (headRy: number) => headRy * 0.12
/**
 * Полурадиус носа на доле `t` его длины (0 — затылок, 1 — кончик).
 * Косинусное сужение: ровный темп, без «площадки» и без перегиба.
 */
function noseRy(headRy: number, t: number): number {
  const k = (1 - Math.cos(Math.PI * t)) / 2
  return headRy + (noseTipRy(headRy) - headRy) * k
}

/**
 * Тело: одна замкнутая лента от носа к хвосту.
 *
 * Нос — ПРОДОЛЖЕНИЕ той же ленты: перед первым узлом добавляются узлы с
 * плавно убывающим радиусом. Отдельная фигура головы давала видимый шов и
 * торчащие кромки (история правок 04.11.2026), поэтому силуэт строится здесь
 * и только здесь.
 */
function drawBody(ctx: Ctx, nodes: Node[], midY: number, thick: number) {
  const head = nodes[0]!
  const len = noseLen(head.ry)
  // Узлы носа строим ОТ КОНЧИКА К ЗАТЫЛКУ (t убывает 1 → 0), потому что
  // `ribbon` должен идти непрерывно: кончик → затылок → хвост.
  //
  // Здесь была ошибка: цикл уже шёл от кончика, а затем `nose.reverse()`
  // разворачивал его обратно, и лента получалась «затылок → кончик → голова →
  // хвост» — зигзаг. На экране это читалось раскрытым «клювом» из кончика
  // (искали 20+ итераций, скриншот 04.11.2026).
  const nose: Node[] = []
  for (let i = NOSE_NODES; i >= 1; i--) {
    const t = i / NOSE_NODES
    nose.push({ x: head.x + len * t, y: head.y, ry: noseRy(head.ry, t) })
  }
  const ribbon: Node[] = [...nose, ...nodes]

  // На самом кончике радиус мал (0.12 ry), поэтому дуга замыкания выходит
  // угловатой «пробкой». Убираем последний узел носа из кромок: кончик
  // рисуется отдельной дугой радиусом предыдущего узла.
  const top = ribbon.slice(1).map((n) => ({ x: n.x, y: n.y - n.ry }))
  const bottom = ribbon
    .slice(1)
    .map((n) => ({ x: n.x, y: n.y + n.ry }))
    .reverse()
  const tip = ribbon[1]!
  ctx.beginPath()
  traceSmooth(ctx, top, true)
  traceSmooth(ctx, bottom, false)
  // Кончик — полукруг радиусом tip.ry: получается тупое скруглённое рыло.
  ctx.quadraticCurveTo(tip.x + tip.ry * 1.25, tip.y, tip.x, tip.y - tip.ry)
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

  // спинной блик вдоль верхней кромки ТЕЛА (нос не задеваем: на голове он
  // читался серой «каплей-нашлёпкой»)
  ctx.beginPath()
  traceSmooth(
    ctx,
    nodes.slice(1).map((n) => ({ x: n.x, y: n.y - n.ry * 0.45 })),
    true
  )
  ctx.strokeStyle = "rgba(234, 255, 244, 0.4)"
  ctx.lineWidth = Math.max(1.2, thick * 0.14)
  ctx.lineCap = "round"
  ctx.stroke()
}

/** Спинной плавник-складка по задней половине спины, с «лучом» внутри. */
/**
 * Спинной плавник-складка по средней части спины.
 *
 * Контур строится как ЗАМКНУТЫЙ: внешняя кромка (с подъёмом) и внутренняя
 * (по базе). Раньше внутренняя кромка шла по `traceSmooth` БЕЗ выхода в
 * первую точку, и `closePath` тянул прямую через весь гребень — отсюда
 * длинные острые «лезвия» над головой (крупный план и мелкий масштаб,
 * скриншоты 04.11.2026).
 *
 * Гребень лежит только на теле: первые два узла пропускаются, чтобы не
 * цеплять голову.
 */
function drawRidge(ctx: Ctx, nodes: Node[], thick: number) {
  const from = Math.max(2, Math.floor(nodes.length * 0.35))
  const pts = nodes.slice(from)
  if (pts.length < 2) return

  const base = pts.map((n) => ({ x: n.x, y: n.y - n.ry * 0.9 }))
  // Внешняя кромка: подъём от нуля к середине и сход на нет к хвосту.
  const crest = pts.map((n, i) => {
    const k = i / Math.max(1, pts.length - 1)
    const h = thick * 0.42 * Math.sin(Math.PI * (0.12 + 0.76 * k)) * Math.min(1, k * 2.5)
    return { x: n.x, y: n.y - n.ry - h }
  })

  ctx.beginPath()
  // 1) внешняя кромка: от начала к концу
  ctx.moveTo(crest[0]!.x, crest[0]!.y)
  for (let i = 1; i < crest.length; i++) {
    const mx = (crest[i - 1]!.x + crest[i]!.x) / 2
    const my = (crest[i - 1]!.y + crest[i]!.y) / 2
    ctx.quadraticCurveTo(crest[i - 1]!.x, crest[i - 1]!.y, mx, my)
  }
  ctx.lineTo(crest[crest.length - 1]!.x, crest[crest.length - 1]!.y)
  // 2) замыкание по базе: от конца обратно к началу
  ctx.lineTo(base[base.length - 1]!.x, base[base.length - 1]!.y)
  for (let i = base.length - 1; i > 0; i--) {
    const mx = (base[i]!.x + base[i - 1]!.x) / 2
    const my = (base[i]!.y + base[i - 1]!.y) / 2
    ctx.quadraticCurveTo(base[i]!.x, base[i]!.y, mx, my)
  }
  ctx.lineTo(base[0]!.x, base[0]!.y)
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
 * Детали головы угря: рот, глаз, жабра, блик.
 *
 * Собственного КОНТУРА у головы нет — силуэт рисует `drawBody`, и голова
 * является продолжением тела. Раньше здесь рисовалась отдельная фигура
 * шириной ry*3.6, и её кромки торчали «плавниками» над и под телом
 * (скриншот 04.11.2026): голова рисовалась буквально дважды.
 *
 * Признаки угря (силуэт баракуды/щуки — их быть не должно):
 *  - морда УЖЕ тела и почти плоская — угорь не «высоколобый»;
 *  - кончик тупой и скруглённый, без клюва;
 *  - рот — длинная щель вдоль брюха, доходящая почти до жабер;
 *  - глаз МАЛЕНЬКИЙ (у угря он крошечный относительно головы) и высоко;
 *  - жаберное отверстие — короткая щель у самого тела.
 *
 * Все координаты берутся через `noseRy`/`noseLen`, чтобы линии не вылезали
 * за контур: расхождение давало торчащие шипы.
 */
function drawHead(ctx: Ctx, node: Node, thick: number, time: number) {
  const ry = node.ry
  // Нос сужается до 0.12 радиуса, поэтому детали привязываем к САМОЙ ТОЛСТОЙ
  // части головы, а не к длине: линии длиной в `len` (25 px) выходили далеко
  // за силуэт и читались «раскрытой пастью» (скриншот 04.11.2026).
  const len = ry * 1.1
  const eyeR = Math.max(1.3, thick * 0.13)
  ctx.save()
  ctx.translate(node.x, node.y)

  // --- рот: короткая дуга у брюха, от середины головы назад ---
  ctx.beginPath()
  ctx.moveTo(len * 0.75, ry * 0.42)
  ctx.quadraticCurveTo(len * 0.3, ry * 0.62, -ry * 0.35, ry * 0.48)
  ctx.strokeStyle = TIER[1].dark
  ctx.lineWidth = Math.max(1.1, thick * 0.075)
  ctx.lineCap = "round"
  ctx.stroke()

  // --- блик по верху головы (влажная кожа) ---
  ctx.globalAlpha = 0.2 + 0.06 * Math.sin(time * 2.6)
  ctx.beginPath()
  ctx.ellipse(len * 0.1, -ry * 0.5, len * 0.55, ry * 0.16, -0.04, 0, Math.PI * 2)
  ctx.fillStyle = "#ffffff"
  ctx.fill()
  ctx.globalAlpha = 1

  // --- жаберное отверстие: короткая почти вертикальная щель у тела ---
  // Высота 0.22 радиуса и полное попадание внутрь силуэта: длинная дуга
  // выходила за контур и читалась острым шипом (скриншот 04.11.2026).
  const gillX = -ry * 0.5
  ctx.beginPath()
  ctx.moveTo(gillX, -ry * 0.2)
  ctx.lineTo(gillX, ry * 0.22)
  ctx.strokeStyle = "rgba(3, 20, 14, 0.22)"
  ctx.lineWidth = 1
  ctx.stroke()

  // --- глаз: МАЛЕНЬКИЙ, высоко и у затылка ---
  // Позиция привязана к радиусу головы: прежний расчёт через `noseRy` в
  // дальней части носа давал точку почти на оси, и глаз «сползал» на кончик.
  const eyeX = -len * 0.15
  const eyeY = -ry * 0.46
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

/**
 * Плавная ломаная по серединам отрезков; `begin` — начинать ли новый путь.
 *
 * Кривая проводится ЧЕРЕЗ каждую точку как опорную (`quadraticCurveTo(point,
 * midpoint)`), поэтому последняя точка попадает на контур через отдельную
 * дугу, а не через прямой отрезок. Прежний `lineTo(last)` после цикла
 * дорисовывал прямую от середины последнего отрезка к концу: у носа это
 * давало два прямых «лезвия», расходящихся из кончика (скриншоты 04.11.2026).
 */
function traceSmooth(ctx: Ctx, pts: Point[], begin: boolean) {
  if (!pts.length) return
  if (begin) ctx.moveTo(pts[0]!.x, pts[0]!.y)
  else ctx.lineTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const cur = pts[i]!
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2)
  }
  // Последняя точка достигается дугой с опорой в предпоследней, а не отрезком.
  const n = pts.length
  if (n >= 2) {
    const mid = { x: (pts[n - 2]!.x + pts[n - 1]!.x) / 2, y: (pts[n - 2]!.y + pts[n - 1]!.y) / 2 }
    ctx.quadraticCurveTo(mid.x, mid.y, pts[n - 1]!.x, pts[n - 1]!.y)
  }
}
