/**
 * Система оружия: ракеты по пробелу и лазерный луч, снаряды и взрывы.
 * Урон блокам делегируется физике, урон боссу — хозяину системы.
 */
import type { Effects } from "./effects"
import type { SFX } from "./audio"
import type { Block, BossState, PaddleState, Projectile } from "./types"
import { rand, rotatedExtents } from "./utils"

/** Хост-интерфейс: состояние движка, которым управляет система оружия. */
export interface WeaponsWorld {
  readonly time: number
  readonly paddle: PaddleState
  readonly blocks: Block[]
  readonly boss: BossState | null
  projectiles: Projectile[]
  rocketUntil: number
  weaponCd: number
  laserArmed: boolean
  laserArmedUntil: number
  laserUntil: number
  laserWasOn: boolean
  shake: number
  flash: number
  fx: Effects
  sfx: SFX
  damageBlock(b: Block, dmg: number): void
  damageBoss(dmg: number, fromWeapon: boolean): void
}

export class WeaponsSystem {
  constructor(private readonly g: WeaponsWorld) {}

  tryFire(dt: number, fire: boolean) {
    const g = this.g
    const rocketOn = g.time < g.rocketUntil
    if (!rocketOn || !fire) {
      g.weaponCd = 0
      return
    }
    g.weaponCd -= dt
    if (g.weaponCd > 0) return
    const p = g.paddle
    g.projectiles.push({ x: p.x, y: p.y - p.h - 6, vy: -560, kind: "rocket", r: 7, dead: false })
    g.sfx.rocket()
    g.weaponCd = 0.32
    g.fx.burst(p.x, p.y - p.h, "#ffc94d", 5, 120)
    if (g.projectiles.length > 48) g.projectiles.splice(0, g.projectiles.length - 48)
    p.squash = Math.max(p.squash, 0.35)
  }

  /** Лазер-луч: взводится бонусом, залп по пробелу/клику, импульсы ~2 с. */
  updateLaser(fire: boolean) {
    const g = this.g
    if (g.laserArmed && g.time > g.laserArmedUntil) g.laserArmed = false
    if (g.laserArmed && fire) {
      g.laserArmed = false
      g.laserUntil = g.time + 2
      g.laserWasOn = false
    }
    const active = g.time < g.laserUntil
    const cyc = g.time % 0.3
    const on = active && cyc < 0.17
    if (on && !g.laserWasOn) {
      g.sfx.laser()
      const p = g.paddle
      this.beamHit(p.x - p.w * 0.36)
      this.beamHit(p.x + p.w * 0.36)
      p.squash = Math.max(p.squash, 0.25)
    }
    g.laserWasOn = on
  }

  private beamHit(px: number) {
    const g = this.g
    const pylonY = g.paddle.y - g.paddle.h / 2 - 8
    let best: Block | null = null
    let bestHH = 0
    for (const b of g.blocks) {
      if (b.dead) continue
      const e = rotatedExtents(b.rx, b.ry, b.rot)
      if (Math.abs(b.x - px) > e.hw + 3) continue
      if (b.y + e.hh >= pylonY) continue
      if (!best || b.y > best.y) {
        best = b
        bestHH = e.hh
      }
    }
    if (best) {
      g.damageBlock(best, 3)
      g.fx.burst(px, best.y + bestHH, "#7cf5ff", 8, 180)
      g.fx.rings.push({
        x: px,
        y: best.y + bestHH,
        r: 4,
        maxR: 44,
        color: "rgba(124,245,255,0.85)",
        t: 0,
      })
      return
    }
    if (g.boss && Math.abs(g.boss.x - px) < g.boss.r && g.boss.y + g.boss.r < pylonY) {
      g.damageBoss(2, true)
      g.fx.burst(px, g.boss.y + g.boss.r, "#7cf5ff", 8, 180)
    }
  }

  updateProjectiles(dt: number) {
    const g = this.g
    for (const pr of g.projectiles) {
      pr.y += pr.vy * dt
      if (pr.y < -30) {
        pr.dead = true
        continue
      }
      if (Math.random() < 0.5) {
        g.fx.particles.push({
          x: pr.x + rand(-2, 2),
          y: pr.y + 10,
          vx: rand(-20, 20),
          vy: rand(40, 90),
          life: 0.25,
          maxLife: 0.25,
          size: rand(1.5, 3),
          color: "#ff8a3d",
          grav: 0,
        })
      }
      for (const b of g.blocks) {
        if (b.dead) continue
        const e = rotatedExtents(b.rx, b.ry, b.rot)
        if (Math.abs(pr.x - b.x) < e.hw + pr.r && Math.abs(pr.y - b.y) < e.hh + pr.r) {
          pr.dead = true
          if (pr.kind === "rocket") this.explode(pr.x, pr.y)
          break
        }
      }
      if (!pr.dead && g.boss) {
        if (Math.hypot(pr.x - g.boss.x, pr.y - g.boss.y) < g.boss.r + pr.r + 4) {
          pr.dead = true
          this.explode(pr.x, pr.y)
        }
      }
    }
    g.projectiles = g.projectiles.filter((pr) => !pr.dead)
  }

  explode(x: number, y: number) {
    const g = this.g
    g.sfx.explosion()
    g.shake = Math.min(g.shake + 5, 12)
    g.flash = Math.max(g.flash, 0.4)
    g.fx.rings.push({ x, y, r: 12, maxR: 150, color: "rgba(255,138,61,0.85)", t: 0 })
    g.fx.burst(x, y, "#ffc94d", 14, 270)
    g.fx.burst(x, y, "#ff8a3d", 10, 210)
    const R = 90
    for (const b of [...g.blocks]) {
      if (b.dead) continue
      if (Math.hypot(b.x - x, b.y - y) < R + Math.max(b.rx, b.ry)) g.damageBlock(b, 3)
    }
    if (g.boss && Math.hypot(g.boss.x - x, g.boss.y - y) < R + g.boss.r) g.damageBoss(3, true)
  }
}
