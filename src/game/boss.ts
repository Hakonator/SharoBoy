/**
 * Логика босса: патрулирование, орбита миньонов, дроп бонусов,
 * получение урона и смерть с цепочкой взрывов.
 * Система не знает о фазах игры — всё взаимодействие через BossHost.
 */
import type { Effects } from "./effects"
import type { SFX } from "./audio"
import type { Block, BossState, PaddleState, PowerType, PowerUp } from "./types"
import { clamp, rand } from "./utils"

/** Хост-интерфейс: то, что системе босса нужно от движка. */
export interface BossHost {
  readonly w: number
  readonly h: number
  readonly time: number
  shake: number
  hitStop: number
  flash: number
  blocks: Block[]
  readonly powers: PowerUp[]
  readonly boomQueue: { x: number; y: number; at: number }[]
  readonly paddle: PaddleState
  fx: Effects
  sfx: SFX
  /** Начисление очков без попапа и проверки рекорда (как в damageBoss/killBoss). */
  addRawScore(n: number): void
  /** Убийство босса засчитано (статистика партии для достижений). */
  onBossKilled(): void
  pushHud(): void
}

export class BossSystem {
  boss: BossState | null = null
  /** Кулдаун урона от оружия (лазер/ракеты), чтобы не сносить босса мгновенно. */
  private weaponHitCd = 0

  constructor(private readonly g: BossHost) {}

  spawn(boss: BossState) {
    this.boss = boss
  }

  clear() {
    this.boss = null
  }

  /** Патрулирование, разгон миньонов по орбите, периодический дроп бонусов. */
  step(dt: number) {
    const bo = this.boss
    if (!bo) return
    bo.t += dt
    bo.flash = Math.max(0, bo.flash - dt * 4)
    const angry = bo.hp < bo.maxHp * 0.4
    const amp = clamp(this.g.w * 0.26, 120, 420)
    bo.x = this.g.w / 2 + Math.sin(bo.t * (angry ? 1.1 : 0.6)) * amp
    bo.y = bo.baseY + Math.sin(bo.t * 1.7) * 22
    for (const b of this.g.blocks) {
      const m = b.minionOrbit
      if (!m) continue
      m.ang += m.dir * m.speed * dt * (angry ? 1.6 : 1)
      b.x = clamp(bo.x + Math.cos(m.ang) * m.rad, b.rx + 4, this.g.w - b.rx - 4)
      b.y = clamp(bo.y + Math.sin(m.ang) * m.rad * 0.55, b.ry + 4, this.g.h * 0.8)
    }
    // Щупальца осьминога: сегменты начинаются от кольца здоровья босса и
    // извиваются по длине, как змея. Каждый сегмент запаздывает по фазе,
    // создавая волновое движение от базы к кончику.
    const SEG_SPACING = 28
    const SEG_COUNT = 4
    const HEALTH_RING_R = 18 // радиус кольца здоровья (r+18 от центра босса)
    const TENTACLE_LENGTH = SEG_COUNT * SEG_SPACING
    const WAVE_AMP = 16 // амплитуда изгиба (растёт к кончику)
    const WAVE_SPEED = 1.3 // скорость распространения волны
    for (const b of this.g.blocks) {
      const orb = b.tentacleOrbit
      if (!orb) continue
      orb.ang += orb.dir * orb.speed * dt * (angry ? 1.6 : 1)
      const segT = (orb.seg + 1) / SEG_COUNT // прогресс от 0.25 до 1
      const along = segT * TENTACLE_LENGTH
      // Волновое отклонение: каждый сегмент сдвинут по фазе, создавая эффект
      // «волны», идущей от базы к кончику. Чем дальше сегмент, тем сильнее
      // отклонение (извилистый хвост).
      const phase = orb.seg * 0.9 // фазовый сдвиг по сегментам
      const wave = Math.sin(bo.t * WAVE_SPEED + phase) * WAVE_AMP * segT
      const dirX = Math.cos(orb.ang)
      const dirY = Math.sin(orb.ang)
      // Базовая точка — на кольце здоровья босса (внешняя окружность)
      const baseR = bo.r + HEALTH_RING_R
      const baseX = bo.x + dirX * baseR
      const baseY = bo.y + dirY * baseR
      // Положение сегмента: вдоль луча от базы + волновое отклонение
      // (перпендикулярное направлению луча)
      const perpX = -dirY
      const perpY = dirX
      b.x = clamp(baseX + dirX * along + perpX * wave, b.rx + 4, this.g.w - b.rx - 4)
      b.y = clamp(baseY + dirY * along + perpY * wave, b.ry + 4, this.g.h * 0.8)
    }
    bo.dropTimer -= dt
    if (bo.dropTimer <= 0) {
      bo.dropTimer = angry ? 3.6 : 5
      const types: PowerType[] = ["fast", "shrink", "fast", "shrink", "fast"]
      this.g.powers.push({
        x: bo.x,
        y: bo.y + bo.r + 10,
        vy: 150,
        type: types[Math.floor(Math.random() * types.length)],
        t: 0,
      })
    }

    // Босс-осьминог: периодически бросает бомбы в ракетку
    if (bo.isOctopus) {
      bo.bombTimer = (bo.bombTimer ?? 4) - dt
      if (bo.bombTimer <= 0) {
        bo.bombTimer = angry ? 3 : 4.5
        // Создаём бомбу, летящую в направлении ракетки
        const paddle = this.g.paddle
        const dx = paddle.x - bo.x
        const dy = paddle.y - bo.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const speed = 200
        this.g.blocks.push({
          x: bo.x,
          y: bo.y + bo.r + 5,
          rx: 18,
          ry: 18,
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
          splits: false,
          bombVx: (dx / dist) * speed,
          bombVy: (dy / dist) * speed,
          hitsPaddle: true,
        } as Block & { bombVx: number; bombVy: number; hitsPaddle: true })
      }
    }
  }

  /** Урон боссу; fromWeapon — от лазера/ракет (с кулдауном), иначе от шара. */
  damage(dmg: number, fromWeapon: boolean) {
    const bo = this.boss
    if (!bo) return
    if (fromWeapon && this.g.time < this.weaponHitCd) return
    this.weaponHitCd = this.g.time + 0.08

    // Босс-осьминог: тело неуязвимо, пока живы хотя бы некоторые щупальца
    // (в каждом щупальце несколько сегментов; если все сегменты щупальца
    // уничтожены — щупальце считается мёртвым).
    if (bo.isOctopus) {
      const tentacles = this.g.blocks.filter((b) => b.isTentacle && !b.dead) as (Block & {
        tentacleId: number
      })[]
      // Считаем, сколько щупалец ещё имеют живые сегменты.
      const aliveIds = new Set<number>()
      for (const t of tentacles) aliveIds.add(t.tentacleId)
      if (aliveIds.size > 0) {
        // Есть живые щупальца — урон по телу заблокирован.
        this.g.sfx.brick(1)
        this.g.fx.burst(bo.x, bo.y, "#ff5ca8", 4, 100)
        return
      }
    }

    bo.hp -= dmg
    bo.flash = 1
    this.g.sfx.brick(3)
    this.g.fx.burst(
      bo.x + rand(-bo.r * 0.5, bo.r * 0.5),
      bo.y + rand(-bo.r * 0.3, bo.r * 0.3),
      "#ff5ca8",
      8,
      200
    )
    this.g.addRawScore(5)
    if (bo.hp <= 0) {
      this.kill()
    } else {
      this.g.pushHud()
    }
  }

  /** Смерть босса: взрыв, цепочка детонации миньонов/бомб, дроп бонусов. */
  kill() {
    const bo = this.boss
    if (!bo) return
    this.boss = null
    this.g.onBossKilled()
    this.g.addRawScore(1500)
    this.g.hitStop = Math.max(this.g.hitStop, 0.5)
    this.g.flash = 1
    this.g.shake = Math.min(this.g.shake + 14, 18)
    this.g.sfx.bossDie()
    this.g.fx.burst(bo.x, bo.y, "#ff5ca8", 40, 420)
    this.g.fx.burst(bo.x, bo.y, "#ffc94d", 24, 330)
    this.g.fx.rings.push({
      x: bo.x,
      y: bo.y,
      r: 20,
      maxR: 300,
      color: "rgba(255,92,168,0.85)",
      t: 0,
    })
    this.g.fx.popups.push({ x: bo.x, y: bo.y, text: "+1500", color: "#ffc94d", t: 0, size: 30 })
    // миньоны и бомбы разлетаются цепочкой взрывов
    let i = 0
    for (const b of [...this.g.blocks]) {
      if (b.minionOrbit || b.bomb) {
        this.g.boomQueue.push({ x: b.x, y: b.y, at: this.g.time + 0.12 + i * 0.1 })
        b.hp = 0
        b.dead = true
        i++
      }
    }
    this.g.blocks = this.g.blocks.filter((b) => !b.dead)
    this.g.pushHud()
  }
}
