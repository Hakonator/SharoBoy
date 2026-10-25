/**
 * Логика босса: патрулирование, орбита миньонов, дроп бонусов,
 * получение урона и смерть с цепочкой взрывов.
 * Система не знает о фазах игры — всё взаимодействие через BossHost.
 */
import type { Effects } from "./effects"
import type { SFX } from "./audio"
import type { Block, BossState, PaddleState, PowerType, PowerUp } from "./types"
import { clamp, rand } from "./utils"
import { stepJellyfish } from "./bossJelly"
import { stepCrab } from "./bossCrab"
import { stepChrono } from "./bossChrono"
import { clearCryo, cryoTurbinesAlive, stepCryoDrone } from "./bossCryo"
import { clearLamprey, lampreyDamageMult, lampreyHeadExposed, stepLamprey } from "./bossLamprey"
import { bossPhases, type BossPhases } from "./bossVariants"

/** Хост-интерфейс: то, что системе босса нужно от движка. */
export interface BossHost {
  readonly w: number
  readonly h: number
  /** Верхняя граница доступной шару игровой зоны. */
  readonly blockTop: number
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
  /** Состояние босса, которому принадлежит арена (нужно реваншу головы миноги). */
  readonly bossState?: BossState | null
  /** Начисление очков без попапа и проверки рекорда (как в damageBoss/killBoss). */
  addRawScore(n: number): void
  /** Убийство босса засчитано (статистика партии для достижений). */
  onBossKilled(): void
  pushHud(): void
  /**
   * Досрочная смерть босса по правилу его собственной механики (сбитая голова
   * миноги). Обрабатывается штатным `BossSystem.kill()`, чтобы цепочка взрывов,
   * уборка арены и дроп бонусов остались едиными.
   */
  killBoss(): void
}

export class BossSystem {
  boss: BossState | null = null
  /** Фазы текущего боя (углубляются на высоком ярусе/мутаторах, см. bossVariants). */
  phases: BossPhases = bossPhases(null)
  /** Кулдаун урона от оружия (лазер/ракеты), чтобы не сносить босса мгновенно. */
  private weaponHitCd = 0

  constructor(private readonly g: BossHost) {}

  /** Фазы боя по варианту босса: вызывается при спавне арены. */
  setPhases(variant: Parameters<typeof bossPhases>[0]) {
    this.phases = bossPhases(variant)
  }

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
    // Порог агрессии: настраивается вариантом босса (angryAt), по умолчанию —
    // осьминог и медуза «злятся» при половине здоровья, остальные — при 40%.
    const angryAt = bo.angryAt ?? (bo.isOctopus || bo.isJellyfish ? 0.5 : 0.4)
    const frac = bo.hp / Math.max(1, bo.maxHp)
    const angry = frac < angryAt
    /* Углублённые фазы (высокий ярус Акта, мутаторы): до «злой» фазы бой идёт
       через промежуточную — поведение уже наполовину агрессивное, атаки чаще. */
    const mid = this.phases.count > 1 && frac < this.phases.midAt && !angry
    // rage 0 — спокойная фаза, 0.5 — промежуточная, 1 — «злая»
    const rage = angry ? 1 : mid ? this.phases.midMix : 0
    // Смена фазы — событие боя: у финальных боссов она звучит своим акцентом
    // (Кракен — гул бездны, Хронос — тик-так), у остальных — общим «колоколом».
    if (angry && !bo.angryPhase) {
      bo.angryPhase = true
      this.g.sfx.bossPhase(
        bo.isChrono ? "chrono" : bo.isOctopus || bo.isJellyfish ? "kraken" : "king"
      )
    }
    const amp = clamp(this.g.w * 0.26, 120, 420)
    /* Патруль по горизонтали: фаза накапливается интегрированием частоты, а сама
       частота плавно стремится к целевой. Раньше позиция считалась как
       sin(bo.t * freq) с частотой, зависящей от «злой» фазы, — при её смене
       синус пересчитывался с новой частотой от того же времени, и босс
       телепортировался. Теперь x непрерывен всегда. */
    const calmFreq = bo.isJellyfish ? 0.45 : 0.6
    const angryFreq = bo.isOctopus ? 1.5 : bo.isJellyfish ? 1 : 1.1
    const targetFreq = calmFreq + (angryFreq - calmFreq) * rage
    if (bo.swayFreq === undefined || bo.swayPhase === undefined) {
      // первый шаг: согласуем фазу со старой формулой sin(bo.t * 0.6)
      bo.swayFreq = 0.6
      bo.swayPhase = 0.6 * bo.t
    }
    bo.swayFreq += (targetFreq - bo.swayFreq) * Math.min(1, dt * 2.5)
    bo.swayPhase += bo.swayFreq * dt
    bo.x = this.g.w / 2 + Math.sin(bo.swayPhase) * amp
    if (bo.isJellyfish) {
      // Медуза ведёт себя как настоящая: пульс купола (сжатие — рывок вверх,
      // расширение — погружение), отростки следуют за куполом, молнии.
      stepJellyfish(this.g, bo, angry, dt)
    } else if (bo.isCrab) {
      bo.y = bo.baseY + Math.sin(bo.t * 1.5) * 16
      stepCrab(this.g, bo, angry, dt)
    } else if (bo.isChrono) {
      bo.y = bo.baseY + Math.sin(bo.t * 1.4) * 18
      stepChrono(this.g, bo, angry, dt)
    } else if (bo.isCryo) {
      // Крио-дрон висит ровно, но в промежуточной фазе уже начинает «дышать»
      bo.y = bo.baseY + Math.sin(bo.t * 1.5) * 18 * rage
      stepCryoDrone(this.g, bo, angry, dt)
    } else if (bo.isLamprey) {
      // Минога скользит по периметру сама — общий патруль ей не нужен.
      stepLamprey(this.g, bo, angry, dt)
    } else {
      bo.y = bo.baseY + Math.sin(bo.t * 1.7) * 22
    }
    for (const b of this.g.blocks) {
      const m = b.minionOrbit
      if (!m) continue
      m.ang += m.dir * m.speed * dt * (1 + 0.6 * rage)
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
    const WAVE_AMP = 22 // амплитуда изгиба (растёт к кончику)
    const WAVE_SPEED = 1.3 // скорость распространения волны
    for (const b of this.g.blocks) {
      const orb = b.tentacleOrbit
      if (!orb) continue
      orb.ang += orb.dir * orb.speed * dt * (1 + 0.6 * rage)
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
      // В бою с углублёнными фазами бонусы падают чаще (общий интервал ниже).
      bo.dropTimer = (angry ? 3.6 : 5) * (this.phases.count > 1 ? 0.8 : 1)
      const types: PowerType[] = ["fast", "shrink", "fast", "shrink", "fast"]
      this.g.powers.push({
        x: bo.x,
        y: bo.y + bo.r + 10,
        vy: 150,
        type: types[Math.floor(Math.random() * types.length)],
        t: 0,
      })
    }

    // Боссы со щупальцами/бомбами: периодически бросают бомбы в ракетку.
    const bombEvery = bo.bombEvery ?? (bo.isOctopus ? 5.2 : 0)
    if (bombEvery > 0) {
      bo.bombTimer = (bo.bombTimer ?? bombEvery) - dt
      if (bo.bombTimer <= 0) {
        // В агрессии бомбы летят вдвое чаще, в промежуточной — на 30% чаще.
        bo.bombTimer = angry ? bombEvery / 2 : mid ? bombEvery * 0.7 : bombEvery
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

  /** Урон боссу; fromWeapon — от лазера/ракет (с кулдауном), иначе от шара; isCrit — критический урон ×3. */
  damage(dmg: number, fromWeapon: boolean, isCrit = false) {
    const bo = this.boss
    if (!bo) return
    if (fromWeapon && this.g.time < this.weaponHitCd) return
    this.weaponHitCd = this.g.time + 0.08

    // Боссы со щупальцами: тело неуязвимо, пока живы хотя бы некоторые
    // щупальца/отростки (в каждом несколько сегментов; если все сегменты
    // щупальца уничтожены — щупальце считается мёртвым).
    if (bo.isOctopus || bo.isJellyfish) {
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
    } else if (bo.isCrab) {
      const liveClaws = this.g.blocks.filter((b) => b.isClaw && !b.dead)
      // Если обе клешни ещё имеют целые сегменты — прямой урон отражается
      if (liveClaws.length >= 4) {
        this.g.sfx.brick(1)
        this.g.fx.burst(bo.x, bo.y, "#ffaa00", 6, 140)
        return
      }
    } else if (bo.isCryo) {
      // Турбины-тарелки отклоняют удар: пока целы обе, корпус неуязвим.
      if (cryoTurbinesAlive(this.g.blocks) >= 2) {
        this.g.sfx.brick(1)
        this.g.fx.burst(bo.x, bo.y, "#a8e2ff", 6, 140)
        return
      }
    } else if (bo.isLamprey) {
      /* Минога: голова — смертельная точка (её снос убивает босса в
         `stepLamprey`), а хвост НЕ блокирует урон, а ослабляет его
         (`lampreyDamageMult`). Раньше здесь стоял полный блок урона, из-за чего
         бой с целым хвостом выглядел как «босс неубиваем». */
      dmg *= lampreyDamageMult(this.g.blocks)
      if (!lampreyHeadExposed(this.g.blocks)) {
        // бьём по защищённому телу — видно, что удар ослаблен
        this.g.sfx.brick(1)
        this.g.fx.burst(bo.x, bo.y, "#9dff5c", 6, 140)
      }
    }

    const actualDmg = isCrit ? dmg * 3 : dmg
    bo.hp -= actualDmg
    bo.flash = 1
    if (isCrit) {
      this.g.sfx.brick(4)
      this.g.fx.burst(bo.x, bo.y, "#ff2a6d", 24, 320)
      this.g.fx.popups.push({
        x: bo.x,
        y: bo.y - bo.r - 20,
        text: `КРИТ ×3! -${Math.round(actualDmg)} 💥`,
        color: "#ff2a6d",
        t: 0,
        size: 24,
      })
      this.g.shake = Math.min(this.g.shake + 6, 12)
      this.g.hitStop = Math.max(this.g.hitStop, 0.06)
    } else {
      this.g.sfx.brick(3)
      this.g.fx.burst(
        bo.x + rand(-bo.r * 0.5, bo.r * 0.5),
        bo.y + rand(-bo.r * 0.3, bo.r * 0.3),
        "#ff5ca8",
        8,
        200
      )
    }
    this.g.addRawScore(isCrit ? 25 : 5)
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
    /* Тело миноги — сегменты-блоки: после смерти босса они остаются на арене и
       держат уровень «незачищенным» (шар бьётся о невидимую преграду). Снимаем
       их сразу: рендер тела выключится вместе с `boss`, а взрывы ниже нарисуют
       цепочку по последним позициям. */
    if (bo.isLamprey) clearLamprey(this.g.blocks)
    // Лёд крио-дрона переживал победу и оставлял невидимые преграды на арене.
    if (bo.isCryo) clearCryo(this.g.blocks)
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
    /* Миньоны, бомбы и всё телесное — разлетается цепочкой взрывов. Правило:
       блок, который рисует только рендер босса, обязан исчезнуть вместе с ним,
       иначе остаётся невидимый коллайдер и зачистка уровня не наступает.
       Турбины крио-дрона (`isCryoPart`) раньше сюда не входили — тарелки
       переживали победу и держали уровень. Тело миноги (`clearLamprey`) уже
       помечено мёртвыми — взрываем по точкам. */
    let i = 0
    for (const b of [...this.g.blocks]) {
      if (b.minionOrbit || b.bomb || b.isTentacle || b.isLampreySeg || b.isCryoPart || b.isClaw) {
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
