/**
 * Босс «Меха-Краб»: кибернетический глубоководный краб.
 * Имеет бронированный панцирь и две тяжёлые защитные клешни.
 *
 * Уникальная механика:
 * 1. Клешни колеблются перед панцирем (сводятся и разводятся в ритме атаки),
 *    закрывая тело от прямых атак снизу.
 * 2. При ударе мяча в клешню она защелкивается и пружинит, отбивая мяч
 *    с ускорением (мощный импульс).
 * 3. Чтобы нанести урон телу, нужно либо разбить клешни (у каждого сегмента
 *    своя прочность), либо закрутить мяч рикошетом от стен в уязвимый центр сверху
 *    или между разведенными клешнями.
 * 4. Периодически бросает в ракетку самонаводящиеся бомбы-мины.
 */
import type { Block, BossState } from "./types"
import type { BossHost } from "./boss"

export const CRAB_CLAW_SEGS = 3
export const CRAB_CLAW_RADII = [18, 15, 22] // база, предплечье, крупная клешня-щипцы

/** Стартовая позиция панциря краба. */
export function buildCrabBoss(
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
    r: 58,
    hp,
    maxHp: hp,
    t: 0,
    flash: 0,
    dropTimer: 4.5,
    isCrab: true,
    clawAngle: 0,
    clawSnapTimer: 0,
    bombEvery: opts?.bombEvery ?? 4.0,
    angryAt: opts?.angryAt ?? 0.5,
  }

  const blocks: Block[] = []

  // Создаём левую и правую клешни
  for (const side of ["left", "right"] as const) {
    for (let seg = 0; seg < CRAB_CLAW_SEGS; seg++) {
      const isPincer = seg === CRAB_CLAW_SEGS - 1
      blocks.push({
        x: bodyX + (side === "left" ? -80 : 80),
        y: bodyY + 40 + seg * 24,
        rx: CRAB_CLAW_RADII[seg],
        ry: CRAB_CLAW_RADII[seg],
        rot: 0,
        circle: true,
        hp: isPincer ? 5 : 4,
        maxHp: isPincer ? 5 : 4,
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
        isClaw: true,
        clawSide: side,
        clawSeg: seg,
      })
    }
  }

  updateCrabClaws(bo, blocks)
  return { boss: bo, blocks }
}

/** Обновление физических позиций сегментов клешней вокруг панциря. */
export function updateCrabClaws(bo: BossState, blocks: Block[]) {
  const t = bo.t
  const snap = (bo.clawSnapTimer ?? 0) > 0 ? 0.35 : 0
  const baseAngle = Math.sin(t * 2.2) * 0.28 + snap

  for (const b of blocks) {
    if (!b.isClaw || b.dead) continue
    const sideSign = b.clawSide === "left" ? -1 : 1
    const seg = b.clawSeg ?? 0

    // Базовый сустав плеча у края панциря
    const shoulderX = bo.x + sideSign * (bo.r * 0.75)
    const shoulderY = bo.y + bo.r * 0.2

    // Изгиб клешни вперёд и к центру
    const armAngle = sideSign * (0.8 + baseAngle * 0.6)
    const armDist = 32 + seg * 28

    const cx = shoulderX + Math.sin(armAngle) * armDist
    const cy = shoulderY + Math.cos(armAngle) * armDist * 0.85

    b.x = cx
    b.y = cy
  }
}

/** Шаг поведения краба в игровом цикле. */
export function stepCrab(host: BossHost, bo: BossState, angry: boolean, dt: number) {
  if (bo.clawSnapTimer && bo.clawSnapTimer > 0) {
    bo.clawSnapTimer = Math.max(0, bo.clawSnapTimer - dt)
  }

  // Обновляем позиции клешней
  updateCrabClaws(bo, host.blocks)
}
