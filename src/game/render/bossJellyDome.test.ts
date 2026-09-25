import { describe, expect, it } from "vitest"

import { makeRecordingCtx, type PaintEvent } from "../frameInvariant.helpers"
import type { BossState } from "../types"

import { drawBoss } from "./boss"
import {
  contourLength,
  drawJellyDomeHp,
  JELLY_DOME_RIM_Y,
  jellyDomeContour,
  jellyHpColor,
  jellyHpContourSlice,
  traceJellyDome,
} from "./bossJellyDome"
import type { Ctx } from "./shapes"

const boss = (over: Partial<BossState> = {}): BossState => ({
  x: 400,
  y: 180,
  baseY: 180,
  r: 68,
  hp: 100,
  maxHp: 100,
  t: 1.25,
  flash: 0,
  dropTimer: 4,
  isJellyfish: true,
  pulseScale: 0.85,
  totalTentacles: 5,
  chargeTent: null,
  ...over,
})

/** Записанный путь купола: дуга + квадратичные кривые бахромы. */
interface TraceOps {
  arc: { x: number; y: number; r: number; sa: number; ea: number }[]
  quads: { cx: number; cy: number; x: number; y: number }[]
}

function traceOf(bo: BossState): TraceOps {
  const ops: TraceOps = { arc: [], quads: [] }
  const ctx = {
    moveTo: () => {},
    closePath: () => {},
    arc: (x: number, y: number, r: number, sa: number, ea: number) => {
      ops.arc.push({ x, y, r, sa, ea })
    },
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => {
      ops.quads.push({ cx, cy, x, y })
    },
  } as unknown as Ctx
  traceJellyDome(ctx, bo)
  return ops
}

/** Начало кривой i: конец предыдущей или точка выхода дуги. */
function quadStart(ops: TraceOps, i: number): [number, number] {
  if (i > 0) return [ops.quads[i - 1].x, ops.quads[i - 1].y]
  const a = ops.arc[0]
  return [a.x + Math.cos(a.ea) * a.r, a.y + Math.sin(a.ea) * a.r]
}

/** Расстояние от точки до пути купола: дуга окружности + квадратичные кривые. */
function distToDomePath(px: number, py: number, ops: TraceOps): number {
  let best = Infinity
  for (const a of ops.arc) {
    best = Math.min(best, Math.abs(Math.hypot(px - a.x, py - a.y) - a.r))
  }
  for (let q = 0; q < ops.quads.length; q++) {
    const [sx, sy] = quadStart(ops, q)
    const { cx, cy, x: ex, y: ey } = ops.quads[q]
    for (let i = 0; i <= 64; i++) {
      const u = i / 64
      const m = 1 - u
      const bx = m * m * sx + 2 * m * u * cx + u * u * ex
      const by = m * m * sy + 2 * m * u * cy + u * u * ey
      best = Math.min(best, Math.hypot(bx - px, by - py))
    }
  }
  return best
}

/** Длина открытой ломанной [x,y,…]. */
function openLen(pts: number[]): number {
  let total = 0
  for (let i = 2; i < pts.length; i += 2) {
    total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1])
  }
  return total
}

/** Параметр точки на ребре i (0..1) или null, если точка на другом ребре. */
function paramOnEdge(c: number[], i: number, px: number, py: number): number | null {
  const n = c.length / 2
  const j = (i + 1) % n
  const ax = c[i * 2]
  const ay = c[i * 2 + 1]
  const dx = c[j * 2] - ax
  const dy = c[j * 2 + 1] - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return null
  const t = ((px - ax) * dx + (py - ay) * dy) / len2
  if (t < -1e-9 || t > 1 + 1e-9) return null
  if (Math.hypot(ax + dx * t - px, ay + dy * t - py) > 1e-6) return null
  return Math.max(0, Math.min(1, t))
}

/** Расстояние вдоль замкнутого контура от макушки (вершина 0) до точки. */
function distAlong(c: number[], px: number, py: number, dir: "fwd" | "back"): number {
  const n = c.length / 2
  let sum = 0
  if (dir === "fwd") {
    for (let i = 0; i < n; i++) {
      const t = paramOnEdge(c, i, px, py)
      const j = (i + 1) % n
      const len = Math.hypot(c[j * 2] - c[i * 2], c[j * 2 + 1] - c[i * 2 + 1])
      if (t !== null) return sum + t * len
      sum += len
    }
  } else {
    for (let i = n - 1; i >= 0; i--) {
      const t = paramOnEdge(c, i, px, py)
      const j = (i + 1) % n
      const len = Math.hypot(c[j * 2] - c[i * 2], c[j * 2 + 1] - c[i * 2 + 1])
      if (t !== null) return sum + (1 - t) * len
      sum += len
    }
  }
  throw new Error("точка не лежит на контуре")
}

describe("контур купола медузы", () => {
  const bo = boss()
  const ops = traceOf(bo)

  it("полилиния идёт ровно по путю купола (погрешность < 0.5 px)", () => {
    const c = jellyDomeContour(bo)
    const n = c.length / 2
    let worst = 0
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      // середина каждого ребра — худшая точка ломанной относительно кривой
      const mx = (c[i * 2] + c[j * 2]) / 2
      const my = (c[i * 2 + 1] + c[j * 2 + 1]) / 2
      worst = Math.max(worst, distToDomePath(mx, my, ops))
    }
    expect(worst).toBeLessThan(0.5)
  })

  it("бахрома идёт через всю ширину — левая половина не сплющена", () => {
    expect(ops.quads).toHaveLength(8)
    // последняя лопасть заканчивается у левого края купола
    expect(ops.quads[7].x).toBeCloseTo(-bo.r, 6)
    const c = jellyDomeContour(bo)
    const rimY = bo.r * JELLY_DOME_RIM_Y
    let minX = Infinity
    let maxX = -Infinity
    let leftDips = 0
    for (let i = 0; i < c.length; i += 2) {
      minX = Math.min(minX, c[i])
      maxX = Math.max(maxX, c[i])
      if (c[i] < 0 && c[i + 1] > rimY + 1) leftDips++
    }
    expect(minX).toBeCloseTo(-bo.r, 5)
    expect(maxX).toBeCloseTo(bo.r, 5)
    // слева есть провалы бахромы — старого прямого «среза» больше нет
    expect(leftDips).toBeGreaterThan(10)
  })

  it("начинается с макушки и замыкается без вырожденного ребра", () => {
    const c = jellyDomeContour(bo)
    const n = c.length / 2
    expect(c[0]).toBeCloseTo(0, 6)
    expect(c[1]).toBeCloseTo(bo.r * JELLY_DOME_RIM_Y - bo.r, 6)
    const closing = Math.hypot(c[0] - c[(n - 1) * 2], c[1] - c[(n - 1) * 2 + 1])
    expect(closing).toBeGreaterThan(1)
    expect(closing).toBeLessThan(bo.r)
  })
})

describe("полоска HP по контуру купола", () => {
  const bo = boss({ hp: 55 })
  const c = jellyDomeContour(bo)
  const total = contourLength(c)

  it("длина заполнения пропорциональна остатку HP", () => {
    expect(jellyHpContourSlice(c, 0)).toEqual([])
    expect(openLen(jellyHpContourSlice(c, 1))).toBeCloseTo(total, 6)
    let prev = 0
    for (const frac of [0.1, 0.25, 0.5, 0.75, 0.99]) {
      const len = openLen(jellyHpContourSlice(c, frac))
      expect(len / total).toBeCloseTo(frac, 6)
      expect(len).toBeGreaterThan(prev) // рост с HP — без провалов
      prev = len
    }
  })

  it("срез симметричен: от макушки вперёд и назад поровну", () => {
    for (const frac of [0.2, 0.5, 0.9]) {
      const slice = jellyHpContourSlice(c, frac)
      const fwd = distAlong(c, slice[slice.length - 2], slice[slice.length - 1], "fwd")
      const back = distAlong(c, slice[0], slice[1], "back")
      expect(back).toBeCloseTo(fwd, 6)
      expect(fwd).toBeCloseTo((total * frac) / 2, 6)
    }
  })

  it("каждая точка среза лежит на ребре контура — полоска не отходит от купола", () => {
    for (const frac of [0.1, 0.4, 0.8, 1]) {
      const slice = jellyHpContourSlice(c, frac)
      for (let i = 0; i < slice.length; i += 2) {
        let onContour = false
        for (let e = 0; e < c.length / 2 && !onContour; e++) {
          onContour = paramOnEdge(c, e, slice[i], slice[i + 1]) !== null
        }
        expect(onContour).toBe(true)
      }
    }
  })

  it("цвет меняется с остатком HP (зелёный → жёлтый → красный)", () => {
    expect(jellyHpColor(1)).toBe("#5dffb0")
    expect(jellyHpColor(0.4)).toBe("#ffc94d")
    expect(jellyHpColor(0.1)).toBe("#ff5347")
  })
})

describe("полоска HP в рендере босса", () => {
  it("рисуется под масштабом пульса — изгибается вместе с телом", () => {
    const paints: PaintEvent[] = []
    const rec = makeRecordingCtx(paints)
    const bo = boss({ hp: 40, maxHp: 100, pulseScale: 0.8 })
    drawBoss(rec.ctx, bo, [], [])
    const fill = paints.filter((p) => p.op === "stroke" && p.strokeStyle === jellyHpColor(0.4))
    const track = paints.filter(
      (p) => p.op === "stroke" && p.strokeStyle.startsWith("rgba(4,18,26")
    )
    expect(fill).toHaveLength(1)
    expect(track).toHaveLength(1)
    for (const p of [...fill, ...track]) {
      expect(p.m[0]).toBeCloseTo(0.8, 6) // масштаб пульса купола
      expect(p.alpha).toBe(1)
    }
    expect(fill[0].lineWidth).toBeLessThanOrEqual(3) // тонкая
    expect(track[0].lineWidth).toBeLessThanOrEqual(5)
  })

  it("без HP остаётся только подложка контура", () => {
    const paints: PaintEvent[] = []
    const rec = makeRecordingCtx(paints)
    drawJellyDomeHp(rec.ctx, boss({ hp: 0 }))
    const strokes = paints.filter((p) => p.op === "stroke")
    expect(strokes).toHaveLength(1)
    expect(strokes[0].strokeStyle).toBe("rgba(4,18,26,0.72)")
  })
})
