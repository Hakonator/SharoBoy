/**
 * Босс «Кракен Бездны»: финальный колосс Акта 3 станции «СФЕРА-1080».
 *
 * Уникальная двухфазная механика с истинным возрождением:
 *
 * 1. Ипостась I: «Биомеханический Кракен-Титан»
 *    - 8 многозвенных биомеханических щупалец, защищающих корпус.
 *    - Пока щупальца живы, корпус окружён щитом Бездны (урон отражается).
 *    - Сброс кассетных бомб бездны в сторону платформы игрока.
 *    - При уничтожении звена щупальца периферийные звенья отсекаются волной детонаций.
 *
 * 2. Перерождение («Схлопывание биогеля»):
 *    - При обнулении HP Фазы I Кракен детонирует все оставшиеся щупальца,
 *      раскалывает материальную оболочку и высвобождает ядро пространственного разлома.
 *    - Звучит сигнал тревоги, экран содрогается, HP восстанавливается до полного пула Фазы II.
 *
 * 3. Ипостась II: «Ядро Разлома / Сингулярность Бездны»
 *    - Квантовая сингулярность с вращающимся аккреционным диском.
 *    - Механика «Гравитационный прилив»: периодически ядро создаёт мощную гравитационную
 *      воронку, искривляя траекторию шара в пращевой космический манёвр.
 *    - «Импульс Энтропии»: периодические ударные волны и выбросы сгустков тёмной материи.
 *    - 3 вращающихся орбитальных квантовых осколка реальности (защитные блоки).
 */

import type { Ball, Block, BossState } from "./types"
import type { BossHost } from "./boss"
import { clamp } from "./utils"

export const KRAKEN_TENTACLES = 8
export const KRAKEN_SEG_COUNT = 4
export const KRAKEN_SEG_RADII = [24, 19, 14, 10]
export const KRAKEN_SEG_SPACING = 24
export const KRAKEN_TENTACLE_LENGTH = KRAKEN_SEG_COUNT * KRAKEN_SEG_SPACING
export const KRAKEN_HEALTH_RING_R = 14
export const KRAKEN_WAVE_AMP = 22
export const KRAKEN_WAVE_SPEED = 1.3

export const KRAKEN_SHARD_COUNT = 3
export const KRAKEN_SHARD_ORBIT_RAD = 85
export const KRAKEN_VORTEX_RANGE = 380
export const KRAKEN_VORTEX_FORCE = 3400

export function buildKrakenBoss(
  w: number,
  h: number,
  hp = 70,
  opts?: { bombEvery?: number; angryAt?: number; lastStandAt?: number }
): { boss: BossState; blocks: Block[] } {
  // Распределение здоровья между двумя ипостасями:
  const phase1Hp = Math.max(30, Math.round(hp * 0.58))
  const phase2Hp = Math.max(25, Math.round(hp * 0.52))

  const bodyX = w / 2
  const bodyY = h * 0.26
  const r = 54

  const bo: BossState = {
    x: bodyX,
    y: bodyY,
    baseY: bodyY,
    r,
    hp: phase1Hp,
    maxHp: phase1Hp,
    t: 0,
    flash: 0,
    dropTimer: 4.0,
    isKraken: true,
    krakenPhase: 1,
    krakenPhase2Hp: phase2Hp,
    totalTentacles: KRAKEN_TENTACLES,
    bombEvery: opts?.bombEvery ?? 3.2,
    angryAt: opts?.angryAt ?? 0.55,
    lastStandAt: opts?.lastStandAt,
    krakenVortexTimer: 3.5,
    krakenVortexActive: false,
    krakenVortexDuration: 0,
    krakenPulseTimer: 3.5,
    krakenRiftAngle: 0,
  }

  const blocks: Block[] = []

  // Спавн 8 щупалец Кракена-Титана
  for (let i = 0; i < KRAKEN_TENTACLES; i++) {
    const ang = (i / KRAKEN_TENTACLES) * Math.PI * 2
    const dirX = Math.cos(ang)
    const dirY = Math.sin(ang) * 0.5
    const baseR = r + KRAKEN_HEALTH_RING_R
    const baseX = bodyX + dirX * baseR
    const baseY = bodyY + dirY * baseR

    for (let seg = 0; seg < KRAKEN_SEG_COUNT; seg++) {
      const segT = (seg + 1) / KRAKEN_SEG_COUNT
      const along = segT * KRAKEN_TENTACLE_LENGTH
      const phase = seg * 0.9
      const wave = Math.sin(0 * KRAKEN_WAVE_SPEED + phase) * KRAKEN_WAVE_AMP * segT
      const perpX = -dirY
      const perpY = dirX
      const bx = baseX + dirX * along + perpX * wave
      const by = baseY + dirY * along + perpY * wave

      blocks.push({
        x: bx,
        y: by,
        rx: KRAKEN_SEG_RADII[seg],
        ry: KRAKEN_SEG_RADII[seg],
        rot: 0,
        circle: true,
        hp: seg === KRAKEN_SEG_COUNT - 1 ? 2 : 4,
        maxHp: seg === KRAKEN_SEG_COUNT - 1 ? 2 : 4,
        tier: 2,
        flash: 0,
        seed: Math.random() * 1000 + seg * 100,
        dead: false,
        x0: bx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: false,
        isTentacle: true,
        tentacleId: i,
        tentacleSeg: seg,
        tentacleOrbit: {
          ang,
          rad: 90,
          dir: 1,
          speed: 0.85,
          seg,
        },
      } as Block & { isTentacle: true; tentacleId: number; tentacleSeg: number })
    }
  }

  return { boss: bo, blocks }
}

/** Обновление состояния Кракена по текущей ипостаси. */
export function stepKraken(host: BossHost, bo: BossState, angry: boolean, dt: number) {
  if (bo.krakenPhase === 2) {
    stepKrakenPhase2(host, bo, angry, dt)
  } else {
    stepKrakenPhase1(host, bo, angry, dt)
  }
}

/** Фаза 1: движение щупалец и бомбометание Титана. */
function stepKrakenPhase1(host: BossHost, bo: BossState, angry: boolean, dt: number) {
  const rage = angry ? 1 : 0

  // 1. Волновое движение щупалец
  for (const b of host.blocks) {
    const orb = b.tentacleOrbit
    if (!orb) continue
    orb.ang += orb.dir * orb.speed * dt * (1 + 0.65 * rage)
    const segT = (orb.seg + 1) / KRAKEN_SEG_COUNT
    const along = segT * KRAKEN_TENTACLE_LENGTH
    const phase = orb.seg * 0.9
    const wave = Math.sin(bo.t * KRAKEN_WAVE_SPEED + phase) * KRAKEN_WAVE_AMP * segT
    const dirX = Math.cos(orb.ang)
    const dirY = Math.sin(orb.ang)
    const baseR = bo.r + KRAKEN_HEALTH_RING_R
    const baseX = bo.x + dirX * baseR
    const baseY = bo.y + dirY * baseR
    const perpX = -dirY
    const perpY = dirX

    b.x = clamp(baseX + dirX * along + perpX * wave, b.rx + 4, host.w - b.rx - 4)
    b.y = clamp(baseY + dirY * along + perpY * wave, b.ry + 4, host.h * 0.8)
  }

  // 2. Сброс фиолетовых бомб Бездны
  const bombEvery = bo.bombEvery ?? 3.2
  const furyMult = host.bossFuryActive?.() ? 0.7 : 1
  const lastStandMult = bo.lastStand ? 0.6 : 1

  if (bo.bombTimer === undefined) {
    bo.bombTimer = bombEvery * furyMult * lastStandMult - dt
  } else {
    bo.bombTimer -= dt
  }

  if (bo.bombTimer <= 0) {
    const stage = angry ? bombEvery * 0.5 : bombEvery
    bo.bombTimer = stage * furyMult * lastStandMult

    const paddle = host.paddle
    const dx = paddle.x - bo.x
    const dy = paddle.y - bo.y
    const dist = Math.hypot(dx, dy) || 1
    const speed = 210

    host.blocks.push({
      x: bo.x,
      y: bo.y + bo.r + 6,
      rx: 18,
      ry: 18,
      rot: 0,
      circle: true,
      hp: 1,
      maxHp: 1,
      tier: 1,
      flash: 1,
      seed: Math.random() * 1000,
      dead: false,
      x0: bo.x,
      swayAmp: 0,
      swayFreq: 0,
      swayPh: 0,
      bomb: true,
      splits: false,
      bombVx: (dx / dist) * speed,
      bombVy: (dy / dist) * speed,
      hitsPaddle: true,
    })
    host.sfx.brick(2)
  }
}

/** Фаза 2: аккреционный диск сингулярности, гравитационный прилив и импульсы энтропии. */
function stepKrakenPhase2(host: BossHost, bo: BossState, angry: boolean, dt: number) {
  // Вращение аккреционного диска
  bo.krakenRiftAngle = (bo.krakenRiftAngle ?? 0) + dt * (angry ? 3.4 : 2.5)

  // Гравитационный прилив (воронка стягивания шара)
  if (bo.krakenVortexActive) {
    bo.krakenVortexDuration = (bo.krakenVortexDuration ?? 0) - dt
    if (bo.krakenVortexDuration <= 0) {
      bo.krakenVortexActive = false
      bo.krakenVortexTimer = angry ? 3.8 : 4.8
    }
  } else {
    bo.krakenVortexTimer = (bo.krakenVortexTimer ?? 4.0) - dt
    if (bo.krakenVortexTimer <= 0) {
      bo.krakenVortexActive = true
      bo.krakenVortexDuration = 2.4
      host.sfx.brick(3)
      host.fx.rings.push({
        x: bo.x,
        y: bo.y,
        r: 15,
        maxR: 280,
        color: "rgba(192, 132, 252, 0.85)",
        t: 0,
      })
      host.fx.popups.push({
        x: bo.x,
        y: bo.y - 32,
        text: "ГРАВИТАЦИОННЫЙ ПРИЛИВ!",
        color: "#c084fc",
        size: 20,
        t: 0,
      })
    }
  }

  // Импульс энтропии: периодические расходящиеся волны и веер плазменных сгустков
  bo.krakenPulseTimer = (bo.krakenPulseTimer ?? 3.5) - dt
  if (bo.krakenPulseTimer <= 0) {
    bo.krakenPulseTimer = angry ? 2.6 : 3.6
    host.fx.rings.push({
      x: bo.x,
      y: bo.y,
      r: 10,
      maxR: 240,
      color: "rgba(56, 189, 248, 0.8)",
      t: 0,
    })

    // Выстрел двумя сгустками тёмной материи веером вниз
    const angles = [-0.3, 0.3]
    for (const off of angles) {
      const ang = Math.PI / 2 + off
      const spd = 220
      host.blocks.push({
        x: bo.x + Math.cos(ang) * (bo.r + 10),
        y: bo.y + Math.sin(ang) * (bo.r + 10),
        rx: 15,
        ry: 15,
        rot: 0,
        circle: true,
        hp: 1,
        maxHp: 1,
        tier: 1,
        flash: 1,
        seed: Math.random() * 1000,
        dead: false,
        x0: bo.x,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: true,
        splits: false,
        bombVx: Math.cos(ang) * spd,
        bombVy: Math.sin(ang) * spd,
        hitsPaddle: true,
      })
    }
    host.sfx.brick(1)
  }
}

/** Физика гравитационной сингулярности: притягивает и закручивает шар в пращевой манёвр. */
export function applyKrakenVortexPhysics(bo: BossState, ball: Ball, dt: number) {
  const dx = bo.x - ball.x
  const dy = bo.y - ball.y
  const distance = Math.hypot(dx, dy)
  if (distance <= 4 || distance >= KRAKEN_VORTEX_RANGE) return

  const falloff = 1 - distance / KRAKEN_VORTEX_RANGE
  const nx = dx / distance
  const ny = dy / distance
  // Тангенциальный вихрь закручивает шар по орбите
  const tx = -ny * 0.4
  const ty = nx * 0.4
  const force = KRAKEN_VORTEX_FORCE * falloff

  ball.vx += (nx + tx) * force * dt
  ball.vy += (ny + ty) * force * dt

  const speed = Math.hypot(ball.vx, ball.vy)
  const maxSpeed = 1100
  const minSpeed = 220
  if (speed > maxSpeed) {
    ball.vx = (ball.vx / speed) * maxSpeed
    ball.vy = (ball.vy / speed) * maxSpeed
  } else if (speed < minSpeed && speed > 0) {
    ball.vx = (ball.vx / speed) * minSpeed
    ball.vy = (ball.vy / speed) * minSpeed
  }
}

/** Событие перерождения Кракена во вторую ипостась «Ядро Разлома». */
export function rebirthKraken(host: BossHost, bo: BossState) {
  // 1. Детонация всех оставшихся щупалец Фазы I
  let boomIdx = 0
  for (const b of host.blocks) {
    if (b.isTentacle && !b.dead) {
      host.boomQueue.push({ x: b.x, y: b.y, at: host.time + 0.08 + boomIdx * 0.05 })
      b.hp = 0
      b.dead = true
      boomIdx++
    }
  }
  host.blocks = host.blocks.filter((b) => !b.dead)

  // 2. Инициализация Фазы II
  bo.krakenPhase = 2
  const p2Hp = bo.krakenPhase2Hp ?? 50
  bo.hp = p2Hp
  bo.maxHp = p2Hp
  bo.flash = 1
  bo.angryPhase = false
  bo.lastStand = false
  bo.krakenVortexActive = false
  bo.krakenVortexTimer = 2.5
  bo.krakenVortexDuration = 0
  bo.krakenPulseTimer = 3.5
  bo.krakenRiftAngle = 0

  // 3. Спавн 3 вращающихся квантовых осколков разлома
  for (let s = 0; s < KRAKEN_SHARD_COUNT; s++) {
    const ang = (s * Math.PI * 2) / KRAKEN_SHARD_COUNT
    host.blocks.push({
      x: bo.x + Math.cos(ang) * KRAKEN_SHARD_ORBIT_RAD,
      y: bo.y + Math.sin(ang) * KRAKEN_SHARD_ORBIT_RAD,
      rx: 16,
      ry: 16,
      rot: 0,
      circle: true,
      hp: 4,
      maxHp: 4,
      tier: 3,
      flash: 1,
      seed: Math.random() * 1000 + s * 100,
      dead: false,
      x0: bo.x,
      swayAmp: 0,
      swayFreq: 0,
      swayPh: 0,
      bomb: false,
      splits: false,
      isKrakenShard: true,
      minionOrbit: {
        ang,
        rad: KRAKEN_SHARD_ORBIT_RAD,
        dir: 1,
        speed: 1.4,
      },
    })
  }

  // 4. Эпичные аудиовизуальные эффекты
  host.flash = 0.9
  host.shake = 18
  host.hitStop = 0.45

  host.fx.rings.push({
    x: bo.x,
    y: bo.y,
    r: 15,
    maxR: 360,
    color: "rgba(192, 132, 252, 0.9)",
    t: 0,
  })
  host.fx.rings.push({
    x: bo.x,
    y: bo.y,
    r: 10,
    maxR: 260,
    color: "rgba(56, 189, 248, 0.85)",
    t: 0,
  })

  host.fx.burst(bo.x, bo.y, "#c084fc", 36, 400)
  host.fx.burst(bo.x, bo.y, "#38bdf8", 24, 300)

  host.fx.popups.push({
    x: bo.x,
    y: bo.y - 44,
    text: "СХЛОПЫВАНИЕ БИОГЕЛЯ!",
    color: "#c084fc",
    size: 28,
    t: 0,
  })
  host.fx.popups.push({
    x: bo.x,
    y: bo.y - 12,
    text: "ФАЗА II: ЯДРО РАЗЛОМА",
    color: "#38bdf8",
    size: 24,
    t: 0,
  })

  host.sfx.bossDie()
  host.sfx.bossPhase("kraken")
  host.sfx.setBattleIntensity?.("last_stand")
  host.pushHud()
}

/** Очистка всех блоков, принадлежащих Кракену. */
export function clearKraken(blocks: Block[]) {
  for (const b of blocks) {
    if (b.isTentacle || b.isKrakenShard) {
      b.hp = 0
      b.dead = true
    }
  }
}
