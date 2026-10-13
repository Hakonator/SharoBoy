import type { Lightning, Particle, Popup, Ring } from "./types"
import { compactInPlace, rand } from "./utils"

/** Базовая ёмкость пула частиц по умолчанию. */
const DEFAULT_MAX_PARTICLES = 400

/**
 * Контейнер визуальных эффектов: искры-частицы, расходящиеся кольца,
 * молнии цепей искр и всплывающие надписи. Только данные и их физика —
 * без Canvas и без знания об остальной игре.
 */
export class Effects {
  particles: Particle[] = []
  rings: Ring[] = []
  popups: Popup[] = []
  lightnings: Lightning[] = []
  /** Динамический лимит частиц (управляется графическими настройками). */
  maxParticles: number = DEFAULT_MAX_PARTICLES

  /** Взрыв-фейерверк: count частиц из точки со скоростями 0.3–1 × speed. */
  burst(x: number, y: number, color: string, count: number, speed: number) {
    if (this.particles.length > this.maxParticles) return
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2)
      const v = rand(speed * 0.3, speed)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        size: rand(2, 5),
        color,
        grav: 300,
      })
    }
  }

  /**
   * Разрушение блока: сочный микс треугольных крутящихся осколков (shard)
   * и круглых искр. Если передан impactAngle, осколки разлетаются направленным
   * веером в сторону удара, усиливая физическую отдачу.
   */
  shatter(x: number, y: number, color: string, count: number, speed: number, impactAngle?: number) {
    if (this.particles.length > this.maxParticles) return
    const shardCount = Math.max(3, Math.floor(count * 0.55))
    const sparkCount = count - shardCount

    for (let i = 0; i < shardCount; i++) {
      const a = impactAngle !== undefined ? impactAngle + rand(-1.1, 1.1) : rand(0, Math.PI * 2)
      const v = rand(speed * 0.45, speed * 1.15)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - rand(20, 70),
        life: rand(0.4, 0.8),
        maxLife: 0.8,
        size: rand(3, 6.5),
        color,
        grav: 380,
        shape: "shard",
        rot: rand(0, Math.PI * 2),
        vr: rand(-10, 10),
      })
    }

    for (let i = 0; i < sparkCount; i++) {
      const a = impactAngle !== undefined ? impactAngle + rand(-1.4, 1.4) : rand(0, Math.PI * 2)
      const v = rand(speed * 0.3, speed * 0.85)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.25, 0.55),
        maxLife: 0.55,
        size: rand(1.5, 3.5),
        color: i % 2 === 0 ? color : "#ffffff",
        grav: 280,
      })
    }
  }

  /** Раскалывание льда: веер осколков-треугольников + мелкая ледяная пыль. */
  iceShatter(x: number, y: number) {
    if (this.particles.length > this.maxParticles) return
    const colors = ["#eaf9ff", "#bfeaff", "#8fd4ff"]
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2)
      const v = rand(90, 300)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60,
        life: rand(0.5, 0.9),
        maxLife: 0.9,
        size: rand(3, 7),
        color: colors[i % colors.length],
        grav: 420,
        shape: "shard",
        rot: rand(0, Math.PI * 2),
        vr: rand(-9, 9),
      })
    }
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2)
      const v = rand(40, 160)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.3, 0.6),
        maxLife: 0.6,
        size: rand(1.5, 3),
        color: "#ffffff",
        grav: 260,
      })
    }
  }

  /** Шаг физики: полёт частиц с гравитацией, расширение колец, всплытие попапов.
   *  Мёртвые элементы убираются in-place — без аллокаций (GC-дружелюбно). */
  step(dt: number) {
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.grav * dt
      if (p.vr) p.rot = (p.rot ?? 0) + p.vr * dt
    }
    compactInPlace(this.particles, (p) => p.life > 0)
    for (const r of this.rings) r.t += dt * 2.4
    compactInPlace(this.rings, (r) => r.t < 1)
    for (const p of this.popups) {
      p.t += dt
      p.y -= dt * 46
    }
    compactInPlace(this.popups, (p) => p.t < 1)
    for (const l of this.lightnings) l.t += dt * 6
    compactInPlace(this.lightnings, (l) => l.t < 1)
  }

  /** Полная очистка (между партиями/уровнями). */
  clear() {
    this.particles = []
    this.rings = []
    this.popups = []
    this.lightnings = []
  }
}
