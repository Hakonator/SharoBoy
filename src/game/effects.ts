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

  /** Шаг физики: полёт частиц с гравитацией, расширение колец, всплытие попапов. */
  step(dt: number) {
    for (const p of this.particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.grav * dt
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
