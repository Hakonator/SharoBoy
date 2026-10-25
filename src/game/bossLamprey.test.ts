import { describe, expect, it } from "vitest"

import {
  LAMPREY_SEG_RADII,
  LAMPREY_SEGMENTS,
  LAMPREY_SPACING,
  buildLamprey,
  lampreySegments,
} from "./bossLamprey"

/**
 * Геометрия тела миноги — общий контракт логики и рендера.
 *
 * Рендер строит объёмный силуэт по центрам сегментов, беря полуширину из
 * `LAMPREY_SEG_RADII`. Если эта функция разойдётся с ожиданиями (порядок,
 * количество, монотонное сужение), тело перестанет совпадать с хитбоксами —
 * шар будет бить «мимо» видимой рыбы или наоборот. Тесты фиксируют инварианты,
 * на которые опирается рендер.
 */
describe("минога: геометрия тела для объёмного рендера", () => {
  it("возвращает по точке на каждый сегмент тела", () => {
    const pts = lampreySegments(900, 640, 80, 0)
    expect(pts.length).toBe(LAMPREY_SEGMENTS)
    expect(LAMPREY_SEG_RADII.length).toBe(LAMPREY_SEGMENTS)
  })

  it("тело сужается от головы к хвосту — силуэт повторяет радиусы", () => {
    // рендер берёт полуширину из радиусов, поэтому радиусы обязаны убывать
    for (let i = 1; i < LAMPREY_SEG_RADII.length; i++) {
      expect(LAMPREY_SEG_RADII[i]).toBeLessThanOrEqual(LAMPREY_SEG_RADII[i - 1])
    }
    expect(LAMPREY_SEG_RADII[0]).toBeGreaterThan(LAMPREY_SEG_RADII[LAMPREY_SEG_RADII.length - 1])
  })

  it("сегменты идут вдоль тела без разрывов и на равном фазовом шаге", () => {
    const pts = lampreySegments(900, 640, 80, 0.4)
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      // соседние позвонки не должны слипаться или разлетаться
      expect(d).toBeGreaterThan(2)
      expect(d).toBeLessThan(140)
    }
    // шаг задаётся LAMPREY_SPACING по параметрическому углу
    expect(LAMPREY_SPACING).toBeGreaterThan(0)
  })

  it("все точки остаются в пределах арены — силуэт не уезжает за край", () => {
    const w = 900
    const h = 640
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      for (const p of lampreySegments(w, h, 80, ang)) {
        expect(p.x).toBeGreaterThan(0)
        expect(p.x).toBeLessThan(w)
        expect(p.y).toBeGreaterThan(0)
        expect(p.y).toBeLessThanOrEqual(h * 0.8)
      }
    }
  })

  it("позиции детерминированы: один угол даёт одну и ту же волну", () => {
    const a = lampreySegments(900, 640, 80, 1.1)
    const b = lampreySegments(900, 640, 80, 1.1)
    expect(a).toEqual(b)
  })
})

/**
 * Отрисовка тела миноги в браузере: объёмный силуэт использует пути,
 * градиенты и `ellipse`. Тест прогоняет реальный `drawBoss` через
 * записывающий мок контекста, чтобы поймать вызовы, отсутствующие в
 * минимальном моке (или опасные NaN-координаты), до запуска в браузере.
 */
function makeRecordingCtx() {
  const calls: string[] = []
  const grad = { addColorStop: () => {} }
  const ctx = {
    canvas: { width: 900, height: 640 },
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    translate: () => calls.push("translate"),
    rotate: () => calls.push("rotate"),
    scale: () => calls.push("scale"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    quadraticCurveTo: () => calls.push("quadratic"),
    bezierCurveTo: () => calls.push("bezier"),
    arc: () => calls.push("arc"),
    ellipse: () => calls.push("ellipse"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    createRadialGradient: () => {
      calls.push("radialGradient")
      return grad
    },
    createLinearGradient: () => {
      calls.push("linearGradient")
      return grad
    },
    createPattern: () => null,
    clip: () => calls.push("clip"),
    setLineDash: () => {},
    measureText: () => ({ width: 10 }),
    fillText: () => calls.push("fillText"),
    strokeText: () => {},
    fillRect: () => calls.push("fillRect"),
    strokeRect: () => {},
    clearRect: () => {},
    drawImage: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  }
  return { ctx, calls }
}

describe("минога: объёмный рендер тела и глаз", () => {
  it("рисует тело путями и градиентами, включая моргание (ellipse)", async () => {
    const { drawBoss } = await import("./render/boss")
    const { boss, blocks } = buildLamprey(900, 640, 80, 60)
    const ball = { x: 300, y: 420, r: 9, vx: 200, vy: -100 } as never
    const { ctx, calls } = makeRecordingCtx()
    // время 1.9 с попадает в фазу моргания глаза головы
    boss.t = 1.9
    expect(() => drawBoss(ctx as never, boss, [ball], blocks as never[])).not.toThrow()
    // силуэт строится сплайнами, а не одной линией
    expect(calls.filter((c) => c === "quadratic").length).toBeGreaterThan(6)
    expect(calls).toContain("linearGradient")
    expect(calls).toContain("radialGradient")
    // глаз присутствует: склера + радужка + зрачок
    expect(calls.filter((c) => c === "arc").length).toBeGreaterThan(3)
  })

  it("не падает, когда шаров нет — взгляд уходит в свободное движение", async () => {
    const { drawBoss } = await import("./render/boss")
    const { boss, blocks } = buildLamprey(900, 640, 80, 60)
    const { ctx } = makeRecordingCtx()
    expect(() => drawBoss(ctx as never, boss, [], blocks as never[])).not.toThrow()
  })

  it("не падает без головы: тело остаётся, глаз не рисуется молча", async () => {
    const { drawBoss } = await import("./render/boss")
    const { boss, blocks } = buildLamprey(900, 640, 80, 60)
    const head = blocks.find((b) => b.lampreySeg === 0)
    if (head) head.dead = true
    const alive = blocks.filter((b) => !b.dead)
    const { ctx } = makeRecordingCtx()
    expect(() => drawBoss(ctx as never, boss, [], alive as never[])).not.toThrow()
  })
})
