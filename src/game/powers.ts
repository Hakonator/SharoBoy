/**
 * Система бонусов и полевых событий: периодический спавн блоков сверху,
 * «дрейф» всего поля, выпадение/подбор бонусов. Все решения о последствиях
 * (звук, HUD, монеты) — через узкий PowersWorld.
 */
import type { Effects } from "./effects"
import type { SFX } from "./audio"
import { Physics } from "./physics"
import type {
  Ball,
  Block,
  BossState,
  PaddleState,
  PaddleShapeKind,
  PowerType,
  PowerUp,
} from "./types"
import { clamp, fitTilt, rand } from "./utils"
import { isBallSpedUp } from "./physics/speed"
import { buildPowerTable } from "./powers/table"
import { applyPower as applyPowerEffect } from "./powers/apply"

/** Хост-интерфейс: состояние движка, которым управляет система бонусов. */
export interface PowersWorld {
  readonly w: number
  readonly h: number
  readonly time: number
  readonly paddle: PaddleState
  readonly balls: Ball[]
  readonly blocks: Block[]
  readonly boss: BossState | null
  readonly blocksInitial: number
  /** Текущий режим партии: в кампании жизни выпадают только с минибоссов. */
  readonly mode: "campaign" | "endless"
  powers: PowerUp[]
  fieldShift: null | { t: number; dur: number; dx: number; dy: number }
  spawnTimer: number
  skyDropTimer: number
  shiftTimer: number
  wideUntil: number
  slowUntil: number
  fastUntil: number
  shrinkUntil: number
  rocketUntil: number
  fireUntil: number
  frostUntil: number
  sparkUntil: number
  magnetUntil: number
  laserArmed: boolean
  laserArmedUntil: number
  /** Форма верхней поверхности ракетки (купол/чаша/грань) для зоны ловли. */
  paddleShape(): PaddleShapeKind
  shield: number
  lives: number
  shake: number
  fx: Effects
  sfx: SFX
  addCoins(n: number): void
  pushHud(): void
}

export class PowersSystem {
  constructor(private readonly g: PowersWorld) {}

  /** Периодически в верхней зоне появляются новые блоки (в основном одноразовые). */
  periodicSpawn(dt: number) {
    const g = this.g
    if (g.boss) return
    g.spawnTimer -= dt
    if (g.spawnTimer > 0) return
    g.spawnTimer = rand(16, 22)
    const cap = Math.min(g.blocksInitial + 12, 150)
    if (g.blocks.length >= cap) return
    for (let attempt = 0; attempt < 7; attempt++) {
      const kind = Math.random() < 0.6 ? "circle" : Math.random() < 0.5 ? "eh" : "ev"
      let rx: number
      let ry: number
      if (kind === "circle") {
        rx = ry = rand(14, 24)
      } else if (kind === "eh") {
        rx = rand(24, 44)
        ry = rand(12, 18)
      } else {
        rx = rand(12, 18)
        ry = rand(20, 34)
      }
      const cx = rand(rx + 10, g.w - rx - 10)
      const cy = rand(ry + 70, g.h * 0.5)
      let overlaps = false
      for (const b of g.blocks) {
        if (Math.abs(b.x - cx) < b.rx + rx + 8 && Math.abs(b.y - cy) < b.ry + ry + 8) {
          overlaps = true
          break
        }
      }
      if (overlaps) continue
      const hroll = Math.random()
      const hp = (hroll < 0.78 ? 1 : hroll < 0.95 ? 2 : 3) as 1 | 2 | 3
      const rot = kind !== "circle" && Math.random() < 0.5 ? fitTilt(rx, ry, 60, 46) : 0
      g.blocks.push({
        x: cx,
        y: cy,
        rx,
        ry,
        rot,
        circle: kind === "circle",
        hp,
        maxHp: hp,
        tier: hp,
        flash: 1,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: cx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: Math.random() < 0.05,
      })
      g.fx.rings.push({ x: cx, y: cy, r: 4, maxR: 60, color: "rgba(124,245,255,0.7)", t: 0 })
      g.fx.popups.push({
        x: cx,
        y: cy - 20,
        text: "ПОПОЛНЕНИЕ!",
        color: "#7cf5ff",
        t: 0,
        size: 12,
      })
      break
    }
  }

  /** Редкое смещение всего поля (плавный дрейф). */
  tryFieldShift(dt: number) {
    const g = this.g
    g.shiftTimer -= dt
    if (g.shiftTimer > 0 || g.fieldShift) return
    g.shiftTimer = rand(12, 18)
    if (!g.blocks.length) return
    const ang = rand(0, Math.PI * 2)
    const mag = rand(22, 40)
    let dx = Math.cos(ang) * mag
    let dy = Math.sin(ang) * mag * 0.6
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const b of g.blocks) {
      if (b.minionOrbit) continue
      minX = Math.min(minX, b.x - b.rx)
      maxX = Math.max(maxX, b.x + b.rx)
      minY = Math.min(minY, b.y - b.ry)
      maxY = Math.max(maxY, b.y + b.ry)
    }
    if (minX + dx < 6) dx = 6 - minX
    if (maxX + dx > g.w - 6) dx = g.w - 6 - maxX
    if (minY + dy < 6) dy = 6 - minY
    if (maxY + dy > g.h * 0.8) dy = g.h * 0.8 - maxY
    g.fieldShift = { t: 0, dur: rand(0.6, 0.9), dx: dx * 2.2, dy: dy * 2.2 }
    g.fx.popups.push({
      x: g.w / 2,
      y: g.h * 0.25,
      text: "СДВИГ ПОЛЯ",
      color: "#9fd6ea",
      t: 0,
      size: 20,
    })
    g.shake = Math.min(g.shake + 1.5, 5)
  }

  private pickPowerType(): PowerType {
    const g = this.g
    const table = buildPowerTable({
      boss: g.boss !== null,
      campaign: g.mode === "campaign",
      fewBlocks: g.blocks.length <= Math.max(5, g.blocksInitial * 0.3),
      // «Замедление» выпадает только когда шар разогнан ≥1.5× номинала
      // (эффект ускорения + перманентный разгон зачистки).
      spedUp: isBallSpedUp({
        slow: g.time < g.slowUntil,
        fast: g.time < g.fastUntil,
        cleared: 1 - g.blocks.length / g.blocksInitial,
      }),
    })
    let sum = 0
    for (const [, w] of table) sum += w
    let roll = Math.random() * sum
    for (const [t, w] of table) {
      roll -= w
      if (roll <= 0) return t
    }
    return "wide"
  }

  dropPower(x: number, y: number) {
    const g = this.g
    if (Math.random() < 0.12) {
      const type = this.pickPowerType()
      const skip =
        (type === "multi" && g.balls.length >= 4) ||
        (type === "life" && g.lives >= 5) ||
        (type === "shield" && g.shield >= 5)
      if (!skip) g.powers.push({ x, y, vy: 150, type, t: 0 })
    }
  }

  /** Периодический «небесный» сброс бонусов с верхней границы поля. */
  periodicPowerDrop(dt: number) {
    const g = this.g
    if (g.boss) return
    g.skyDropTimer -= dt
    if (g.skyDropTimer > 0) return
    g.skyDropTimer = rand(18, 27)
    if (g.powers.length >= 6) return
    const type = this.pickPowerType()
    const x = rand(60, g.w - 60)
    g.powers.push({ x, y: -24, vy: 170, type, t: 0 })
    g.fx.rings.push({ x, y: 20, r: 6, maxR: 90, color: "rgba(234,247,255,0.7)", t: 0 })
    g.fx.popups.push({ x, y: 60, text: "С НЕБА!", color: "#eaf7ff", t: 0, size: 18 })
    g.sfx.power()
  }

  /** Зона ловли бонуса: поверхность ракетки в точке X бонуса ± допуск.
   *  Купол выше грани, чаша — ниже (вогнутая ловит бонус внутри себя). */
  private catchTopY(pw: PowerUp, p: PaddleState): number {
    const rel = clamp((pw.x - p.x) / (p.w / 2), -1, 1)
    return p.y - p.h / 2 - Physics.surfaceAt(p.w / 2, rel, this.g.paddleShape(), p.h)
  }

  updatePowers(dt: number) {
    const g = this.g
    const p = g.paddle
    for (const pw of g.powers) {
      pw.t += dt
      pw.y += pw.vy * dt
      pw.x += Math.sin(pw.t * 4) * 14 * dt
      // Ловля на верхней поверхности: купол поднимает зону над телом ракетки
      const topY = this.catchTopY(pw, p)
      if (
        pw.y > topY - 12 &&
        pw.y < p.y + p.h / 2 + 12 &&
        pw.x > p.x - p.w / 2 - 14 &&
        pw.x < p.x + p.w / 2 + 14
      ) {
        pw.taken = true
        this.applyPower(pw.type)
      }
    }
    g.powers = g.powers.filter((pw) => !pw.taken && pw.y < g.h + 40)
  }

  /** Применение эффекта бонуса — см. powers/apply.ts. */
  private applyPower(type: PowerType) {
    applyPowerEffect(this.g, type)
  }
}
