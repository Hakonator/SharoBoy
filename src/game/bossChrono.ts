/**
 * Босс «Повелитель Времени»: космическая хроносфера, управляющая потоками времени.
 *
 * Уникальная механика:
 * 1. Центральное ядро со стрелками времени (орбитальные защитные хроно-кристаллы).
 * 2. Хроно-воронки (Chrono Rifts) на игровом поле:
 *    - «slow» (Лазурная воронка): шар замедляется внутри радиуса, давая игроку
 *      время точно рассчитать отскок и прицелиться.
 *    - «fast» (Пурпурная аномалия): шар ускоряется при пролёте через центр.
 * 3. Воронки медленно дрейфуют по полю и сменяются со временем.
 */
import type { Ball, Block, BossState, ChronoRift } from "./types"
import type { BossHost } from "./boss"
import { clamp } from "./utils"

export const CHRONO_RIFT_INTERVAL = 8
export const CHRONO_MAX_RIFTS = 3

export function buildChronoBoss(
  w: number,
  h: number,
  hp = 65,
  opts?: { minions?: number; angryAt?: number }
): { boss: BossState; blocks: Block[] } {
  const bodyX = w / 2
  const bodyY = h * 0.22
  const r = 56
  const bo: BossState = {
    x: bodyX,
    y: bodyY,
    baseY: bodyY,
    r,
    hp,
    maxHp: hp,
    t: 0,
    flash: 0,
    dropTimer: 4.5,
    isChrono: true,
    chronoRifts: [],
    chronoTimer: 2.0, // первая воронка появится быстро
    angryAt: opts?.angryAt ?? 0.5,
  }

  const blocks: Block[] = []
  const minions = opts?.minions ?? 4
  const orbitRad = r * 2.2

  // Орбитальные кристаллы-стрелки времени
  for (let i = 0; i < minions; i++) {
    blocks.push({
      x: bodyX,
      y: bodyY,
      rx: 14,
      ry: 14,
      rot: 0,
      circle: true,
      hp: 3,
      maxHp: 3,
      tier: 2,
      flash: 0,
      seed: Math.random() * 1000 + i * 100,
      dead: false,
      x0: bodyX,
      swayAmp: 0,
      swayFreq: 0,
      swayPh: 0,
      bomb: false,
      splits: false,
      minionOrbit: {
        ang: (i * Math.PI * 2) / minions,
        rad: orbitRad,
        dir: i % 2 ? 1 : -1,
        speed: 1.2,
      },
    })
  }

  return { boss: bo, blocks }
}

/** Шаг обновления состояния хроносферы и её воронок. */
export function stepChrono(host: BossHost, bo: BossState, angry: boolean, dt: number) {
  if (!bo.chronoRifts) bo.chronoRifts = []

  // Обновление существующих воронок
  for (let i = bo.chronoRifts.length - 1; i >= 0; i--) {
    const rift = bo.chronoRifts[i]
    rift.life -= dt
    rift.x += rift.vx * dt
    rift.y += rift.vy * dt

    // Отскок воронок от границ игрового поля
    if (rift.x < rift.r + 20 || rift.x > host.w - rift.r - 20) rift.vx *= -1
    if (rift.y < host.blockTop + rift.r + 20 || rift.y > host.h * 0.75) rift.vy *= -1

    if (rift.life <= 0) {
      bo.chronoRifts.splice(i, 1)
    }
  }

  // Спавн новых воронок по таймеру
  bo.chronoTimer = (bo.chronoTimer ?? CHRONO_RIFT_INTERVAL) - dt
  const maxRifts = angry ? 3 : 2
  if (bo.chronoTimer <= 0) {
    bo.chronoTimer = angry ? 5.5 : 7.5
    if (bo.chronoRifts.length < maxRifts) {
      const isSlow = bo.chronoRifts.every((r) => r.kind === "fast") || Math.random() < 0.6
      const kind = isSlow ? "slow" : "fast"
      const riftRadius = kind === "slow" ? 105 : 92
      const life = 12

      const spawnX = clamp(
        host.w * (0.2 + Math.random() * 0.6),
        riftRadius + 30,
        host.w - riftRadius - 30
      )
      const spawnY = clamp(
        host.h * (0.35 + Math.random() * 0.32),
        host.blockTop + riftRadius + 20,
        host.h * 0.72
      )

      bo.chronoRifts.push({
        x: spawnX,
        y: spawnY,
        vx: (Math.random() - 0.5) * 35,
        vy: (Math.random() - 0.5) * 25,
        r: riftRadius,
        kind,
        life,
        maxLife: life,
      })

      host.sfx.brick(3)
    }
  }
}

/**
 * Влияние временных воронок на пролетающие мячи:
 * Сильное отклонение траектории к центру (~30° вблизи ядра, убывает к краям)
 * и изменение скорости (замедление / ускорение).
 */
export function applyChronoRiftsToBalls(
  rifts: ChronoRift[] | undefined,
  balls: Ball[],
  dt: number
) {
  for (const b of balls) {
    if (b.stuck) continue
    let targetChrono = 1.0

    if (rifts && rifts.length > 0) {
      for (const rift of rifts) {
        const dx = b.x - rift.x
        const dy = b.y - rift.y
        const dist = Math.hypot(dx, dy)
        if (dist < rift.r) {
          const factor = 1 - dist / rift.r
          const safeDist = Math.max(1, dist)
          const dirX = dx / safeDist
          const dirY = dy / safeDist

          // 1. Мощное гравитационное притяжение к центру воронки
          const pullAccel = (rift.kind === "fast" ? 2200 : 1300) * factor
          b.vx -= dirX * pullAccel * dt
          b.vy -= dirY * pullAccel * dt

          // 2. Сильный вихревой поток (тангенциальная праща)
          const swirlDir = rift.kind === "fast" ? 1 : -1
          const swirlAccel = (rift.kind === "fast" ? 2800 : 1600) * factor * swirlDir
          b.vx += -dirY * swirlAccel * dt
          b.vy += dirX * swirlAccel * dt

          // 3. Множитель скорости (замедление в лазурной, ускорение в пурпурной)
          if (rift.kind === "slow") {
            targetChrono = Math.min(targetChrono, Math.max(0.38, 1 - 0.62 * factor))
          } else {
            targetChrono = Math.max(targetChrono, 1 + 0.45 * factor)
          }
        }
      }
    }

    // Плавный переход множителя скорости
    const cur = b.chronoMult ?? 1.0
    b.chronoMult = cur + (targetChrono - cur) * Math.min(1, dt * 12)
  }
}
