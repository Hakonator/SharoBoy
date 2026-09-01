import { describe, expect, it } from "vitest"

import { Effects } from "./effects"
import type { Particle } from "./types"

const dummyParticle = (): Particle => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 1,
  maxLife: 1,
  size: 2,
  color: "#fff",
  grav: 0,
})

describe("Effects", () => {
  it("burst создаёт заданное число частиц в заданном диапазоне скоростей", () => {
    const fx = new Effects()
    fx.burst(100, 50, "#ff0000", 24, 200)
    expect(fx.particles).toHaveLength(24)
    for (const p of fx.particles) {
      expect(p.x).toBe(100)
      expect(p.y).toBe(50)
      expect(p.color).toBe("#ff0000")
      expect(p.maxLife).toBe(0.7)
      expect(p.grav).toBe(300)
      expect(p.life).toBeGreaterThanOrEqual(0.3)
      expect(p.life).toBeLessThanOrEqual(0.7)
      const v = Math.hypot(p.vx, p.vy)
      expect(v).toBeGreaterThanOrEqual(200 * 0.3 - 1e-9)
      expect(v).toBeLessThanOrEqual(200 + 1e-9)
    }
  })

  it("burst не добавляет частицы при переполнении пула", () => {
    const fx = new Effects()
    for (let i = 0; i < 421; i++) fx.particles.push(dummyParticle())
    fx.burst(0, 0, "#fff", 10, 100)
    expect(fx.particles).toHaveLength(421)
  })

  it("step двигает частицы, применяет гравитацию и удаляет мёртвые", () => {
    const fx = new Effects()
    fx.particles.push({ ...dummyParticle(), vx: 100, life: 0.2, maxLife: 0.2, grav: 300 })
    fx.step(0.1)
    expect(fx.particles).toHaveLength(1)
    expect(fx.particles[0].x).toBeCloseTo(10)
    expect(fx.particles[0].vy).toBeCloseTo(30)
    fx.step(0.1)
    expect(fx.particles).toHaveLength(0)
  })

  it("step расширяет кольца и убирает завершённые", () => {
    const fx = new Effects()
    fx.rings.push({ x: 0, y: 0, r: 5, maxR: 100, color: "#fff", t: 0.8 })
    fx.step(0.05)
    expect(fx.rings).toHaveLength(1)
    expect(fx.rings[0].t).toBeCloseTo(0.92)
    fx.step(0.05)
    expect(fx.rings).toHaveLength(0)
  })

  it("step всплывает попапы вверх и убирает завершённые", () => {
    const fx = new Effects()
    fx.popups.push({ x: 10, y: 100, text: "+10", color: "#fff", t: 0.9, size: 12 })
    fx.step(0.05)
    expect(fx.popups).toHaveLength(1)
    expect(fx.popups[0].y).toBeCloseTo(97.7)
    fx.step(0.06)
    expect(fx.popups).toHaveLength(0)
  })

  it("clear очищает все контейнеры", () => {
    const fx = new Effects()
    fx.burst(0, 0, "#fff", 5, 100)
    fx.rings.push({ x: 0, y: 0, r: 5, maxR: 100, color: "#fff", t: 0 })
    fx.popups.push({ x: 0, y: 0, text: "+10", color: "#fff", t: 0, size: 12 })
    fx.clear()
    expect(fx.particles).toHaveLength(0)
    expect(fx.rings).toHaveLength(0)
    expect(fx.popups).toHaveLength(0)
  })
})
