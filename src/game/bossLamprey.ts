/**
 * Босс «Глубинная Электрическая Минога» (Акт II, альтернатива Спруту и Крабу).
 *
 * Юркий сегментированный хищник квантового кластера:
 * 1. Тело — цепочка из LAMPREY_SEGMENTS сегментов-блоков, которая скользит по
 *    периметру арены (эллипс вокруг центра поля). Голова ведёт, хвост отстаёт
 *    по фазе, поэтому минога «плывёт» волной. Геометрию считает единственная
 *    функция `lampreySegments` — её же использует рендер, чтобы контур тела
 *    совпадал с хитбоксами блоков.
 * 2. Пока хвост не разбит, голова не получает урон: сначала игроку надо
 *    уничтожить LAMPREY_GUARD_SEGMENTS сегментов тела.
 * 3. Электрические разряды: голова периодически бьёт молнией в ракетку
 *    (снаряд с флагом `bolt`, как у медузы, но медленнее — с шансом увернуться).
 * 4. В «злой» фазе минога ускоряется (×1.8), разряды идут вдвое чаще.
 *
 * Чистая логика без обращений к движку — взаимодействие через BossHost.
 */
import type { Block, BossState } from "./types"
import type { BossHost } from "./boss"
import { clamp } from "./utils"

/** Сегментов в теле миноги (0 — голова). */
export const LAMPREY_SEGMENTS = 8
/** Радиусы сегментов от головы к хвосту. */
export const LAMPREY_SEG_RADII = [22, 21, 20, 18, 16, 14, 12, 10]
/** Прочность сегментов от головы к хвосту. */
export const LAMPREY_SEG_HP = [5, 4, 4, 3, 3, 2, 2, 2]
/** Угловой шаг тела вдоль эллипса периметра (радианы). */
export const LAMPREY_SPACING = 0.19
/** Угловая скорость скольжения по периметру, рад/с. */
export const LAMPREY_SPEED = 0.62
/** Сколько сегментов тела надо уничтожить, чтобы открыть голову для урона. */
export const LAMPREY_GUARD_SEGMENTS = 3
/** Интервал разрядов в ракетку, сек. */
export const LAMPREY_BOLT_EVERY = 9
export const LAMPREY_BOLT_EVERY_ANGRY = 4.5
/** Телеграф разряда, сек. */
export const LAMPREY_BOLT_CHARGE = 0.8
/** Скорость разряда, px/с. */
export const LAMPREY_BOLT_SPEED = 820
/**
 * Через сколько секунд после потери головы минога отращивает её заново.
 * Без этого бой мог «умереть»: голова держала тело закрытым от урона, а
 * бить её было уже нечем — уровень становился непроходимым.
 */
export const HEAD_REGEN_TIME = 6

/** Сегмент тела миноги как блок. */
export interface LampreySegmentBlock extends Block {
  isLampreySeg: true
  lampreySeg: number
}

const segRadius = (i: number) =>
  LAMPREY_SEG_RADII[i] ?? LAMPREY_SEG_RADII[LAMPREY_SEG_RADII.length - 1]

/** Точка периметра арены по параметрическому углу (эллипс вокруг центра поля). */
function perimeterPoint(w: number, h: number, top: number, ang: number) {
  const ay = Math.max(h * 0.12, top * 0.4 + h * 0.1)
  return {
    x: w / 2 + Math.cos(ang) * w * 0.42,
    y: h * 0.52 + Math.sin(ang) * ay,
  }
}

/**
 * Позиции всех сегментов миноги. Голова — в точке `ang`, каждый следующий
 * сегмент отстаёт по фазе на LAMPREY_SPACING (волна вдоль тела).
 */
export function lampreySegments(
  w: number,
  h: number,
  top: number,
  ang: number,
  count = LAMPREY_SEGMENTS
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const p = perimeterPoint(w, h, top, ang - i * LAMPREY_SPACING)
    const r = segRadius(i)
    out.push({
      x: clamp(p.x, r + 6, w - r - 6),
      y: clamp(p.y, r + 6, h * 0.8),
    })
  }
  return out
}

/** Стартовая арена: тело миноги линией по периметру + флаги поведения. */
export function buildLamprey(
  w: number,
  h: number,
  top: number,
  hp = 60
): { boss: BossState; blocks: Block[] } {
  const startAng = -Math.PI / 2
  const pts = lampreySegments(w, h, top, startAng)
  const head = pts[0]
  const bo: BossState = {
    x: head.x,
    y: head.y,
    baseY: head.y,
    r: LAMPREY_SEG_RADII[0],
    hp,
    maxHp: hp,
    t: 0,
    flash: 0,
    dropTimer: 4,
    isLamprey: true,
    lampreyAng: startAng,
    lampreyBoltTimer: LAMPREY_BOLT_EVERY,
    lampreyCharge: 0,
    // для «выражения» тела в рендере тела босса
    totalTentacles: LAMPREY_SEGMENTS,
    // вместо мин — электрические разряды (см. stepLamprey)
    bombEvery: 0,
  }

  const blocks: Block[] = pts.map((p, i) => makeSegment(p.x, p.y, i))
  return { boss: bo, blocks }
}

/** Сколько живых сегментов тела (без головы) ещё держат оборону. */
export function lampreyTailAlive(blocks: Block[]): number {
  return blocks.filter((b) => b.isLampreySeg && !b.dead && (b.lampreySeg ?? 0) > 0).length
}

/** Жива ли голова (сегмент 0). Без головы минога не двигается и не стреляет. */
export function lampreyHeadAlive(blocks: Block[]): boolean {
  return blocks.some((b) => b.isLampreySeg && !b.dead && b.lampreySeg === 0)
}

/** Один сегмент тела миноги как блок (общий конструктор спавна и реванша). */
function makeSegment(x: number, y: number, i: number): LampreySegmentBlock {
  const r = segRadius(i)
  const segHp = LAMPREY_SEG_HP[i] ?? 2
  return {
    x,
    y,
    rx: r,
    ry: r,
    rot: 0,
    circle: true,
    hp: segHp,
    maxHp: segHp,
    tier: 2,
    flash: 0,
    seed: Math.random() * 1000 + i * 100,
    dead: false,
    x0: x,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
    isLampreySeg: true,
    lampreySeg: i,
  }
}

/**
 * Реванш головы: голова разбита, но тело живо — минога отращивает голову
 * и продолжает бой (урон в этот момент не проходил, HP не изменилось).
 * Позиции берутся по текущему углу, чтобы сегменты не прыгали.
 */
function reviveLamprey(g: BossHost) {
  const bo = g.bossState
  const ang = bo?.lampreyAng ?? -Math.PI / 2
  const head = lampreySegments(g.w, g.h, g.blockTop, ang)[0]
  const seg = makeSegment(head.x, head.y, 0)
  g.blocks.push(seg)
  if (bo) {
    bo.x = head.x
    bo.y = head.y
    bo.baseY = head.y
    // после реванша разряд не мгновенный — даём игроку передышку
    bo.lampreyBoltTimer = LAMPREY_BOLT_EVERY
    bo.lampreyCharge = 0
  }
  g.fx.rings.push({ x: head.x, y: head.y, r: 12, maxR: 120, color: "rgba(157,255,92,0.8)", t: 0 })
  g.fx.burst(head.x, head.y, "#9dff5c", 16, 240)
  g.sfx.zap()
}

/** Открыта ли голова для урона (тело разбито минимум на LAMPREY_GUARD_SEGMENTS). */
export function lampreyHeadExposed(blocks: Block[]): boolean {
  const tail = LAMPREY_SEGMENTS - 1
  return tail - lampreyTailAlive(blocks) >= LAMPREY_GUARD_SEGMENTS
}

/** Разряд в ракетку из головы: плазменный сгусток-снаряд. */
function fireLampreyBolt(g: BossHost, bo: BossState) {
  const paddle = g.paddle
  const dx = paddle.x - bo.x
  const dy = paddle.y - bo.y
  const dist = Math.hypot(dx, dy) || 1
  g.blocks.push({
    x: bo.x,
    y: bo.y,
    rx: 8,
    ry: 8,
    rot: 0,
    circle: true,
    hp: 1,
    maxHp: 1,
    tier: 1,
    flash: 0,
    seed: Math.random() * 1000,
    dead: false,
    x0: bo.x,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: true,
    // Молния медузы идёт «хвостом» (drawBolt) — здесь нужен свой признак:
    // снаряд миноги рисуется собственной светящейся формой.
    lampreyBolt: true,
    splits: false,
    bombVx: (dx / dist) * LAMPREY_BOLT_SPEED,
    bombVy: (dy / dist) * LAMPREY_BOLT_SPEED,
    hitsPaddle: true,
  } as Block & { lampreyBolt: true })
  g.fx.burst(bo.x, bo.y, "#9dff5c", 8, 200)
  g.shake = Math.min(g.shake + 2.5, 14)
  g.sfx.zap()
}

/**
 * Шаг миноги: скольжение по периметру, расстановка сегментов, телеграф
 * и разряд в ракетку. Голова (`bo.x/bo.y`) всегда совпадает с сегментом 0.
 */
export function stepLamprey(g: BossHost, bo: BossState, angry: boolean, dt: number) {
  const speed = LAMPREY_SPEED * (angry ? 1.8 : 1)
  bo.lampreyAng = (bo.lampreyAng ?? 0) + speed * dt
  const pts = lampreySegments(g.w, g.h, g.blockTop, bo.lampreyAng)
  let headX = bo.x
  let headY = bo.y
  let headAlive = false
  let bodyAlive = false
  for (const b of g.blocks) {
    const seg = (b as LampreySegmentBlock).lampreySeg
    if (!b.isLampreySeg || b.dead || seg === undefined) continue
    if (seg > 0) bodyAlive = true
    const p = pts[seg] ?? pts[pts.length - 1]
    b.x = p.x
    b.y = p.y
    if (seg === 0) {
      headX = p.x
      headY = p.y
      headAlive = true
    }
  }
  bo.x = headX
  bo.y = headY
  bo.baseY = headY

  /* Голова разбита — минога теряет управление: тело встаёт, разряды
     прекращаются. Раньше здесь оставался только невидимый `bo`, и босс
     продолжал стрелять «из пустоты». Урон в этот момент не идёт (голова
     держит тело закрытым), поэтому перед реваншем хвост восстанавливается
     за HEAD_REGEN_TIME и бой продолжается. */
  if (!headAlive) {
    bo.lampreyCharge = 0
    bo.lampreyHeadDown = true
    if (!bodyAlive) return // последний сегмент: тело волной не двигаем
    bo.lampreyRevive = (bo.lampreyRevive ?? HEAD_REGEN_TIME) - dt
    if (bo.lampreyRevive <= 0) {
      bo.lampreyRevive = 0
      reviveLamprey(g)
      bo.lampreyHeadDown = false
    }
    return
  }
  bo.lampreyHeadDown = false

  // Разряд: телеграф — искры по телу, затем сгусток в ракетку.
  const every = angry ? LAMPREY_BOLT_EVERY_ANGRY : LAMPREY_BOLT_EVERY
  bo.lampreyBoltTimer = (bo.lampreyBoltTimer ?? every) - dt
  if (bo.lampreyBoltTimer <= LAMPREY_BOLT_CHARGE) {
    bo.lampreyCharge = clamp(1 - bo.lampreyBoltTimer / LAMPREY_BOLT_CHARGE, 0, 1)
    if (Math.random() < dt * (14 + 26 * bo.lampreyCharge)) {
      g.fx.burst(bo.x, bo.y, "#c8ff7a", 1, 80)
    }
  }
  if (bo.lampreyBoltTimer <= 0) {
    bo.lampreyBoltTimer = every
    bo.lampreyCharge = 0
    fireLampreyBolt(g, bo)
  }
}
