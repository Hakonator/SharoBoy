import type { Particle, Popup, Ring } from "./types"
import { rand } from "./utils"

/** Ёмкость пула частиц — защита от лавины эффектов на слабых машинах. */
const MAX_PARTICLES = 420

/**
 * Контейнер визуальных эффектов: искры-частицы, расходящиеся кольца
 * и всплывающие надписи. Только данные и их физика — без Canvas
 * и без знания об остальной игре.
 */
export class Effects {
  particles: Particle[] = []
  rings: Ring[] = []
  popups: Popup[] = []

  /** Взрыв-фейерверк: count частиц из точки со скоростями 0.3–1 × speed. */
  burst(x: number, y: number, color: string, count: number, speed: number) {
    if (this.particles.length > MAX_PARTICLES) return
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

  /** Раскалывание льда: веер осколков-треугольников + мелкая ледяная пыль. */
  iceShatter(x: number, y: number) {
    if (this.particles.length > MAX_PARTICLES) return
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

  /** Шаг физики: полёт частиц с гравитацией, расширение колец, всплытие попапов. */
  step(dt: number) {
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.grav * dt
      if (p.vr) p.rot = (p.rot ?? 0) + p.vr * dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const r of this.rings) r.t += dt * 2.4
    this.rings = this.rings.filter((r) => r.t < 1)
    for (const p of this.popups) {
      p.t += dt
      p.y -= dt * 46
    }
    this.popups = this.popups.filter((p) => p.t < 1)
  }

  /** Полная очистка (между партиями/уровнями). */
  clear() {
    this.particles = []
    this.rings = []
    this.popups = []
  }
}
