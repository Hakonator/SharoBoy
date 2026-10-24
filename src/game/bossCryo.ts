/**
 * Босс «Крио-Дрон Утилизатор» (Акт I, альтернатива Царь-шару и Медузе).
 *
 * Защитный патрульный дрон системы переработки крио-биогеля:
 * 1. Висит под «потолком» арены и патрулирует с двумя тарелками-турбинами
 *    (по два сегмента-блока на борт, как клешни краба).
 * 2. Пока обе турбины живы, урон по корпусу не проходит — сначала надо
 *    разбить тарелки.
 * 3. Преграды из льда: пока HP выше ICE_STOP_FRAC, дрон раз в ICE_BARRIER_EVERY
 *    секунд сбрасывает морозную капсулу. Капсула не взрывается сразу, а через
 *    ICE_BLOOM_TIME разворачивается в ледяной столб из трёх единиц, который
 *    перекрывает путь шару (колется с одного удара, лёд — не цель уровня и не
 *    считается в blocksInitial).
 * 4. В «злой» фазе капсул две и летят они вдвое чаще.
 *
 * Чистая логика без обращений к движку — взаимодействие через BossHost.
 */
import type { Block, BossState } from "./types"
import type { BossHost } from "./boss"
import { clamp } from "./utils"

/** Сегментов в каждой тарелке-турбине (0 — крепление, 1 — тарелка). */
export const CRYO_TURBINE_SEGS = 2

/** Доля HP, ниже которой дрон перестаёт ставить лёд. */
export const ICE_STOP_FRAC = 0.3
/** Секунд между сбросами ледяной капсулы (в «злой» фазе — вдвое чаще). */
export const ICE_BARRIER_EVERY = 7
/** Секунд на полёт и раскрытие капсулы (телеграф для игрока). */
export const ICE_BLOOM_TIME = 0.8
/** Единиц льда в столбе и их прочность. */
export const ICE_STACK = 3
export const ICE_UNIT_HP = 1
/** Расстояние между единицами льда в столбе, px. */
export const ICE_UNIT_STEP = 34

let iceUid = 1
/** Следующий идентификатор группы льда (уникален в рамках процесса). */
export function nextIceId(): number {
  iceUid += 1
  return iceUid
}

/** Морозная капсула: сброшена дроном, летит к точке разворачивания. */
export interface IceCapsuleBlock extends Block {
  isIceCapsule: true
  iceId: number
  /** Точка, где капсула раскрывается в столб. */
  iceTargetX: number
  iceTargetY: number
  /** Прогресс полёта 0..1 (позицию каждый кадр считает stepIceCapsules). */
  iceT: number
}

/** Единица ледяного столба: ломается с одного удара, урон уровня не считается. */
export interface IceUnitBlock extends Block {
  isIceColumn: true
  iceId: number
  /** Порядок сверху вниз — по нему определяем верхний сегмент столба. */
  iceSeg: number
}

/** Стартовая позиция корпуса крио-дрона с двумя тарелками-турбинами. */
export function buildCryoDrone(
  w: number,
  h: number,
  hp = 60,
  opts?: { bombEvery?: number; angryAt?: number }
): { boss: BossState; blocks: Block[] } {
  const bodyX = w / 2
  const bodyY = h * 0.24
  const bo: BossState = {
    x: bodyX,
    y: bodyY,
    baseY: bodyY,
    r: 54,
    hp,
    maxHp: hp,
    t: 0,
    flash: 0,
    dropTimer: 4.5,
    isCryo: true,
    cryoTurbineTimer: 0,
    cryoIceTimer: ICE_BARRIER_EVERY,
    cryoScroll: 0,
    // вместо мин — ледяные преграды (см. stepCryoDrone)
    bombEvery: opts?.bombEvery ?? 0,
    angryAt: opts?.angryAt ?? 0.5,
  }

  const blocks: Block[] = []
  for (const side of ["left", "right"] as const) {
    for (let seg = 0; seg < CRYO_TURBINE_SEGS; seg++) {
      const isDisk = seg === CRYO_TURBINE_SEGS - 1
      blocks.push({
        x: bodyX + (side === "left" ? -70 : 70),
        y: bodyY + 30 + seg * 26,
        rx: isDisk ? 20 : 13,
        ry: isDisk ? 20 : 13,
        rot: 0,
        circle: true,
        hp: isDisk ? 4 : 3,
        maxHp: isDisk ? 4 : 3,
        tier: 2,
        flash: 0,
        seed: Math.random() * 1000 + seg * 100,
        dead: false,
        x0: bodyX,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: false,
        isCryoPart: true,
        cryoSide: side,
        cryoSeg: seg,
      })
    }
  }

  updateCryoTurbines(bo, blocks)
  return { boss: bo, blocks }
}

/** Позиции тарелок-турбин: висят по бокам корпуса и покачиваются на креплениях. */
export function updateCryoTurbines(bo: BossState, blocks: Block[]) {
  const angry = bo.hp < bo.maxHp * (bo.angryAt ?? 0.5)
  // Раскрутка пропеллеров: медленная в покое, быстрая в «злой» фазе.
  bo.cryoScroll = (bo.cryoScroll ?? 0) + (angry ? 0.22 : 0.1)
  const swing = Math.sin(bo.t * 1.9) * 0.16
  for (const b of blocks) {
    if (!b.isCryoPart || b.dead) continue
    const sign = b.cryoSide === "left" ? -1 : 1
    const seg = b.cryoSeg ?? 0
    const armX = bo.x + sign * (bo.r * 0.8 + seg * 46)
    const armY = bo.y + 14 + seg * 26 + Math.sin(bo.t * 2.2 + seg) * 3
    b.x = armX + sign * swing * 10
    b.y = armY
  }
}

/** Живые тарелки: пока их две, тело дрона неуязвимо. */
export function cryoTurbinesAlive(blocks: Block[]): number {
  return blocks.filter((b) => b.isCryoPart && !b.dead && b.cryoSeg === CRYO_TURBINE_SEGS - 1).length
}

/** Сколько единиц льда ещё стоит на арене (для HUD/диагностики). */
export function iceUnitsLeft(blocks: Block[]): number {
  return blocks.filter((b) => b.isIceColumn && !b.dead).length
}

/** Новая единица льда столба. `frozen` — рисуется ледяным телом и колется с 1 удара. */
function makeIceUnit(x: number, y: number, iceId: number, seg: number): IceUnitBlock {
  return {
    x,
    y,
    rx: 24,
    ry: 16,
    rot: 0,
    circle: true,
    hp: ICE_UNIT_HP,
    maxHp: ICE_UNIT_HP,
    tier: 1,
    flash: 0,
    seed: Math.random() * 1000 + seg * 37,
    dead: false,
    x0: x,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
    frozen: true,
    isIceColumn: true,
    iceId,
    iceSeg: seg,
  } as IceUnitBlock
}

/** Раскрывает капсулу в ледяной столб: три единицы сверху вниз от точки. */
function bloomIce(g: BossHost, cap: IceCapsuleBlock) {
  const x = clamp(cap.iceTargetX, 40, g.w - 40)
  const top = clamp(cap.iceTargetY, g.blockTop + 24, g.h * 0.7)
  for (let seg = 0; seg < ICE_STACK; seg++) {
    g.blocks.push(makeIceUnit(x, top + seg * ICE_UNIT_STEP, cap.iceId, seg))
  }
  g.fx.burst(x, top, "#a8e2ff", 12, 200)
  g.fx.rings.push({ x, y: top, r: 6, maxR: 90, color: "rgba(124,245,255,0.7)", t: 0 })
  g.sfx.freeze()
}

/** Ставит морозную капсулу: она долетит до точки и раскроется в лёд. */
function dropIceCapsule(g: BossHost, bo: BossState, x: number) {
  const fromX = bo.x
  const fromY = bo.y + bo.r * 0.5
  const targetX = clamp(x, g.w * 0.16, g.w * 0.84)
  const targetY = clamp(bo.y + g.h * 0.18, g.blockTop + 40, g.h * 0.58)
  g.blocks.push({
    x: fromX,
    y: fromY,
    rx: 12,
    ry: 12,
    rot: 0,
    circle: true,
    hp: 1,
    maxHp: 1,
    tier: 1,
    flash: 0,
    seed: Math.random() * 1000,
    dead: false,
    x0: fromX,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
    frozen: true,
    isIceCapsule: true,
    iceId: nextIceId(),
    iceTargetX: targetX,
    iceTargetY: targetY,
    iceT: 0,
  } as IceCapsuleBlock)
  g.sfx.thud()
  g.fx.burst(fromX, fromY, "#7cf5ff", 6, 120)
}

/** Шаг капсул: плавный полёт к точке раскрытия, затем столб льда. */
function stepIceCapsules(g: BossHost, dt: number) {
  const caps = g.blocks.filter((b) => b.isIceCapsule && !b.dead) as IceCapsuleBlock[]
  let bloomed = false
  for (const cap of caps) {
    cap.iceT = Math.min(1, cap.iceT + dt / ICE_BLOOM_TIME)
    // затухающий бросок: за 0.8 с капсула проходит путь целиком
    const k = 1 - (1 - cap.iceT) * (1 - cap.iceT)
    cap.x = cap.x0 + (cap.iceTargetX - cap.x0) * k
    cap.y = cap.y + (cap.iceTargetY - cap.y) * Math.min(1, dt * 6 + 0.08)
    cap.rot += dt * 4
    if (cap.iceT >= 1) {
      cap.dead = true
      bloomIce(g, cap)
      bloomed = true
    }
  }
  if (bloomed) g.blocks = g.blocks.filter((b) => !b.dead)
}

/**
 * Шаг крио-дрона: турбины, сброс ледяных капсул и раскрытие уже сброшенных.
 * Барьеры ставятся только пока корпус защищён (HP выше ICE_STOP_FRAC).
 */
export function stepCryoDrone(g: BossHost, bo: BossState, angry: boolean, dt: number) {
  updateCryoTurbines(bo, g.blocks)
  if (bo.cryoTurbineTimer && bo.cryoTurbineTimer > 0) {
    bo.cryoTurbineTimer = Math.max(0, bo.cryoTurbineTimer - dt)
  }
  stepIceCapsules(g, dt)

  const frac = bo.hp / Math.max(1, bo.maxHp)
  if (frac <= ICE_STOP_FRAC) return
  const every = angry ? ICE_BARRIER_EVERY / 2 : ICE_BARRIER_EVERY
  bo.cryoIceTimer = (bo.cryoIceTimer ?? every) - dt
  if (bo.cryoIceTimer > 0) return
  bo.cryoIceTimer = every
  // Столб ставится под текущей позицией ракетки — перекрывает рабочий путь шара.
  const baseX = clamp(g.paddle.x, g.w * 0.16, g.w * 0.84)
  dropIceCapsule(g, bo, baseX)
  // В «злой» фазе вторая колонна встаёт зеркально и закрывает обе половины.
  if (angry) dropIceCapsule(g, bo, g.w - baseX)
}
