/**
 * Босс-медуза «Грозовая медуза»: ведёт себя как настоящая медуза — купол
 * захватывает воду и сжимается, толкая тело вверх; расширение купола медленно
 * опускает тело вниз. Пять нижних отростков длиной с туловище привязаны к
 * куполу (расширяются и сжимаются вместе с ним), извиваются волной и раз в
 * JELLY_BOLT_EVERY секунд выстреливают молнией: сначала ~JELLY_BOLT_CHARGE
 * секунд кончик выбранного отростка искрится (телеграф), затем в ракетку летит
 * быстрая, но не мгновенная молния — на неё можно среагировать.
 *
 * Чистая логика без обращений к движку — взаимодействие через BossHost.
 */
import type { Block, BossState } from "./types"
import type { BossHost } from "./boss"
import { clamp } from "./utils"

/** Секунд на полный цикл пульса «сжатие + расширение». */
export const JELLY_PULSE_PERIOD = 3
/** То же в «злой» фазе — пульсирует чаще и плывёт резче. */
export const JELLY_PULSE_PERIOD_ANGRY = 2.2
/** Секунд между выстрелами молний. */
export const JELLY_BOLT_EVERY = 10
/** Тот же интервал в «злой» фазе. */
export const JELLY_BOLT_EVERY_ANGRY = 6
/** Секунд искрения кончика перед выстрелом (телеграф для уворота). */
export const JELLY_BOLT_CHARGE = 1.2
/** Скорость молнии, px/с: быстро, но с полсекунды на реакцию. */
export const JELLY_BOLT_SPEED = 950
/** Количество нижних отростков. */
export const JELLY_TENTACLES = 5
/** Сегментов в каждом отростке (как у щупалец осьминога). */
export const JELLY_SEG_COUNT = 4
/** Расстояние между центрами сегментов: 4×34 ≈ диаметр купола. */
export const JELLY_SEG_SPACING = 34
/** Радиусы сегментов от базы к кончику. */
export const JELLY_SEG_RADII = [15, 12, 9, 7]
/** Амплитуда и скорость волны изгиба отростков. */
export const JELLY_WAVE_AMP = 12
export const JELLY_WAVE_SPEED = 1.8
/** Глубина сжатия купола: 1 → MIN_PULSE_SCALE → 1 за цикл. */
export const JELLY_MIN_PULSE_SCALE = 0.72

const CONTRACT_PART = 0.28 // доля цикла, которую занимает сжатие

const smoothstep = (k: number) => k * k * (3 - 2 * k)

export interface JellyPulse {
  /** Масштаб купола в этот момент пульса (1 — расправлен). */
  scale: number
  /** Вертикальная скорость тела, px/с (отрицательная — вверх). */
  vy: number
}

/**
 * Пульс медузы: первые CONTRACT_PART цикла купол сжимается — вода
 * выбрасывается, тело получает рывок вверх; остальную часть цикла купол
 * плавно расширяется, и тело медленно погружается.
 */
export function jellyPulse(phase: number, angry = false): JellyPulse {
  const p = ((phase % 1) + 1) % 1
  const depth = 1 - JELLY_MIN_PULSE_SCALE
  if (p < CONTRACT_PART) {
    const k = p / CONTRACT_PART
    return {
      scale: 1 - depth * smoothstep(k),
      // толчок вверх: пик посреди сжатия, в «злой» фазе сильнее
      vy: -110 * Math.sin(k * Math.PI) * (angry ? 1.25 : 1),
    }
  }
  const k = (p - CONTRACT_PART) / (1 - CONTRACT_PART)
  return {
    scale: JELLY_MIN_PULSE_SCALE + depth * smoothstep(k),
    // медленное погружение при расширении
    vy: 34 * Math.sin(k * Math.PI),
  }
}

/** Угол отклонения отростка от вертикали (веер нижних отростков, ±~69°). */
function tentacleTheta(i: number, n: number): number {
  return (n <= 1 ? 0.5 : i / (n - 1) - 0.5) * 2.4
}

/**
 * Обновляет позиции сегментов отростков: база — на нижней кромке купола
 * (веером), свисают вниз с волной, длина и разлёт масштабируются пульсом —
 * при сжатии купола разлёт уже, отростки слегка вытянуты.
 */
export function updateJellyTentacles(g: Pick<BossHost, "w" | "h">, bo: BossState, blocks: Block[]) {
  const n = bo.totalTentacles ?? JELLY_TENTACLES
  const s = bo.pulseScale ?? 1
  const stretch = 1 + (1 - s) * 0.45 // при сжатии отростки вытягиваются
  const spread = 0.62 * s // горизонтальный разлёт базы следует за куполом
  for (const b of blocks) {
    if (!b.isTentacle || b.dead) continue
    const seg = b.tentacleSeg ?? 0
    const theta = tentacleTheta(b.tentacleId ?? 0, n)
    const dirX = Math.sin(theta) * 0.35
    const dirY = 1
    const dirLen = Math.hypot(dirX, dirY)
    const baseX = bo.x + Math.sin(theta) * bo.r * spread
    const baseY = bo.y + Math.cos(theta) * bo.r * 0.5
    const segT = (seg + 1) / JELLY_SEG_COUNT
    const along = ((seg + 1) * JELLY_SEG_SPACING * stretch) / dirLen
    // волна изгиба, бежит от базы к кончику
    const wave =
      Math.sin(bo.t * JELLY_WAVE_SPEED + theta * 2.4 + seg * 1.05) * JELLY_WAVE_AMP * segT
    const perpX = dirY / dirLen
    const perpY = -dirX / dirLen
    b.x = clamp(baseX + dirX * along + perpX * wave, b.rx + 4, g.w - b.rx - 4)
    b.y = clamp(baseY + dirY * along + perpY * wave, b.ry + 4, g.h * 0.8)
  }
}

function tipBlock(g: BossHost, tentacleId: number): Block | null {
  for (const b of g.blocks) {
    if (
      b.isTentacle &&
      !b.dead &&
      b.tentacleId === tentacleId &&
      b.tentacleSeg === JELLY_SEG_COUNT - 1
    )
      return b
  }
  return null
}

function aliveTentacleIds(g: BossHost): number[] {
  const ids = new Set<number>()
  for (const b of g.blocks) {
    if (b.isTentacle && !b.dead) ids.add(b.tentacleId ?? 0)
  }
  return [...ids]
}

/** Пускает молнию из кончика отростка в текущую позицию ракетки. */
function fireBolt(g: BossHost, tip: Block) {
  const paddle = g.paddle
  const dx = paddle.x - tip.x
  const dy = paddle.y - tip.y
  const dist = Math.hypot(dx, dy) || 1
  g.blocks.push({
    x: tip.x,
    y: tip.y,
    rx: 7,
    ry: 7,
    rot: 0,
    circle: true,
    hp: 1,
    maxHp: 1,
    tier: 1,
    flash: 0,
    seed: Math.random() * 1000,
    dead: false,
    x0: tip.x,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: true, // движение/потеря/попадание в ракетку — как у бомб осьминога
    bolt: true,
    splits: false,
    bombVx: (dx / dist) * JELLY_BOLT_SPEED,
    bombVy: (dy / dist) * JELLY_BOLT_SPEED,
    hitsPaddle: true,
  } as Block & { bolt: true })
  // вспышка выстрела на месте кончика + лёгкая отдача
  g.fx.lightnings.push({
    x1: tip.x,
    y1: tip.y,
    x2: tip.x + (dx / dist) * 60,
    y2: tip.y + (dy / dist) * 60,
    t: 0,
  })
  g.fx.burst(tip.x, tip.y, "#ffe95c", 8, 220)
  g.shake = Math.min(g.shake + 3, 14)
  g.sfx.zap()
}

/** Таймер молний: отсчёт → выбор отростка → искрение кончика → выстрел. */
function stepJellyBolts(g: BossHost, bo: BossState, angry: boolean, dt: number) {
  const every = angry ? JELLY_BOLT_EVERY_ANGRY : JELLY_BOLT_EVERY
  if (bo.boltTimer === undefined) bo.boltTimer = every
  // Выбор цели незадолго до выстрела: кончик начинает искрить (телеграф).
  if (
    (bo.chargeTent === null || bo.chargeTent === undefined) &&
    bo.boltTimer <= JELLY_BOLT_CHARGE
  ) {
    const alive = aliveTentacleIds(g)
    if (alive.length > 0) {
      // по кругу среди живых — молнии идут из разных отростков
      bo.chargeTent = alive[Math.floor(bo.t / JELLY_BOLT_EVERY) % alive.length]
      bo.chargeT = 0
    }
  }
  if (bo.chargeTent !== null && bo.chargeTent !== undefined) {
    // выбранный отросток могли уничтожить во время искрения — переключаемся
    let tip = tipBlock(g, bo.chargeTent)
    if (!tip) {
      const alive = aliveTentacleIds(g)
      bo.chargeTent = alive.length > 0 ? alive[0] : null
      tip = bo.chargeTent !== null ? tipBlock(g, bo.chargeTent) : null
    }
    if (tip) {
      bo.chargeT = (bo.chargeT ?? 0) + dt / JELLY_BOLT_CHARGE
      // искры у кончика — плотнее к выстрелу
      if (Math.random() < dt * (12 + 30 * (bo.chargeT ?? 0))) {
        g.fx.burst(tip.x, tip.y, "#ffe95c", 1, 70)
      }
      if ((bo.chargeT ?? 0) >= 1) {
        fireBolt(g, tip)
        bo.chargeTent = null
        bo.chargeT = 0
        bo.boltTimer = every
      }
    } else {
      bo.chargeTent = null
      bo.chargeT = 0
    }
  }
  bo.boltTimer -= dt
}

/** Шаг медузы: пульс купола, вертикальное движение, отростки, молнии. */
export function stepJellyfish(g: BossHost, bo: BossState, angry: boolean, dt: number) {
  const period = angry ? JELLY_PULSE_PERIOD_ANGRY : JELLY_PULSE_PERIOD
  bo.pulsePhase = ((((bo.pulsePhase ?? 0) + dt / period) % 1) + 1) % 1
  const pulse = jellyPulse(bo.pulsePhase, angry)
  bo.pulseScale = pulse.scale
  // сжатие толкает вверх, расширение опускает; не выходим из-за HUD и не ныряем
  bo.y = clamp(bo.y + pulse.vy * dt, g.h * 0.12, bo.baseY + g.h * 0.05)
  updateJellyTentacles(g, bo, g.blocks)
  stepJellyBolts(g, bo, angry, dt)
}
