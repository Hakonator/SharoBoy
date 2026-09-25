import { expect, vi } from "vitest"

import { Game } from "./game"

/**
 * Инструментальный тест мигания: прогоняем НАСТОЯЩИЙ игровой цикл через
 * записывающий фейковый 2D-контекст и проверяем инвариант «любая заливка/
 * обводка, сделанная под сдвинутым трансформом (шар, ракетка, их гаджеты),
 * обязана идти при globalAlpha === 1».
 *
 * Так ловится ровно тот класс бага, что гасил шар/ракетку после событий:
 * «протёкшая» альфа от эффектов (колец/частиц/попапов), нарисованных раньше.
 */

export interface PaintEvent {
  op: string
  alpha: number
  /** матрица трансформа [a,b,c,d,e,f] на момент рисования */
  m: number[]
  /** дуги текущего пути (после beginPath) — для проверки тела шара */
  arcs: { x: number; y: number; r: number }[]
  /** стиль и толщина обводки на момент stroke (полоски HP и т.п.) */
  strokeStyle: string
  lineWidth: number
}

export function makeRecordingCtx(log: PaintEvent[]) {
  const grad = { addColorStop: () => {} }
  const stack: number[][] = [[1, 0, 0, 1, 0, 0]]
  let arcs: { x: number; y: number; r: number }[] = []
  /* Смещение «тряски» кадра: первый translate после начала кадра — это
     ctx.translate(rand(-shake, shake)) в Game.draw(). Отрисовки шара/ракетки
     опознаём по ЛОКАЛЬНОМУ сдвигу (минус тряска), иначе при тряске ложноматчится
     вся сцена. */
  let shake: [number, number] = [0, 0]
  let shakeCaptured = false
  let baseReturned = false
  const target: Record<string, unknown> = {
    canvas: null,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    lineDashOffset: 0,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "rgba(0,0,0,0)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    filter: "none",
    imageSmoothingEnabled: true,
    save: () => {
      stack.push([...stack[stack.length - 1]])
    },
    restore: () => {
      if (stack.length > 1) stack.pop()
      if (stack.length === 1) baseReturned = true
    },
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      stack[stack.length - 1] = [a, b, c, d, e, f]
    },
    translate: (x: number, y: number) => {
      const m = stack[stack.length - 1]
      m[4] += m[0] * x + m[2] * y
      m[5] += m[1] * x + m[3] * y
      // тряска — единственный translate на глубине 2 до возврата на базу
      if (!baseReturned && !shakeCaptured && stack.length === 2) {
        shake = [m[4], m[5]]
        shakeCaptured = true
      }
    },
    scale: (x: number, y: number) => {
      const m = stack[stack.length - 1]
      m[0] *= x
      m[1] *= x
      m[2] *= y
      m[3] *= y
    },
    rotate: (a: number) => {
      const m = stack[stack.length - 1]
      const c = Math.cos(a)
      const s = Math.sin(a)
      const m0 = m[0] * c + m[2] * s
      const m1 = m[1] * c + m[3] * s
      m[2] = -m[0] * s + m[2] * c
      m[3] = -m[1] * s + m[3] * c
      m[0] = m0
      m[1] = m1
    },
    beginPath: () => {
      arcs = []
    },
    arc: (x: number, y: number, r: number) => {
      arcs.push({ x, y, r })
    },
    ellipse: (x: number, y: number, rx: number, ry: number) => {
      arcs.push({ x, y, r: Math.max(rx, ry) })
    },
  }
  const paint = (op: string) => {
    log.push({
      op,
      alpha: target.globalAlpha as number,
      m: [...stack[stack.length - 1]],
      arcs: [...arcs],
      strokeStyle: target.strokeStyle as string,
      lineWidth: target.lineWidth as number,
    })
  }
  target.fill = () => paint("fill")
  target.stroke = () => paint("stroke")
  target.fillRect = (x: number, y: number) => {
    arcs = [{ x, y, r: 0 }]
    paint("fillRect")
  }
  target.fillText = (_text: string, x: number, y: number) => {
    arcs = [{ x, y, r: 0 }]
    paint("fillText")
  }
  target.strokeText = () => {}
  target.strokeRect = () => {}
  target.clearRect = () => {}
  target.clip = () => {}
  target.rect = () => {}
  target.moveTo = () => {}
  target.lineTo = () => {}
  target.arcTo = () => {}
  target.bezierCurveTo = () => {}
  target.quadraticCurveTo = () => {}
  target.closePath = () => {}
  target.setLineDash = () => {}
  target.drawImage = () => {}
  target.putImageData = () => {}
  target.createLinearGradient = () => grad
  target.createRadialGradient = () => grad
  target.createPattern = () => grad
  target.measureText = () => ({ width: 10 })
  target.isPointInPath = () => false
  const ctx = new Proxy(target, {
    set(obj, prop, value) {
      ;(obj as unknown as Record<string | symbol, unknown>)[prop] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return {
    ctx,
    /** Сброс в начале каждого кадра: тряска ищется заново. */
    resetFrame: () => {
      shake = [0, 0]
      shakeCaptured = false
      baseReturned = false
    },
    getShake: (): [number, number] => shake,
  }
}

/** Доступ к приватному состоянию Game из теста (только чтение/пускачи). */
export type GameInternals = {
  w: number
  h: number
  blocks: unknown[]
  balls: { x: number; y: number; r: number }[]
  paddle: { x: number; y: number }
  powers: { push: (pw: unknown) => unknown }
  physics: { damageBlock: (b: unknown, dmg: number) => void }
  startGame: () => void
  /** Прямой запуск боя уровня без карты (используется в тестах). */
  startLevelBattle: (n: number) => void
  launch: () => void
  destroy: () => void
}

/** Текущий «настоящий» Math.random — чтобы восстановить после каждого теста. */
export const realRandom = Math.random

/** Детерминированный ГПСЧ: делает сценарии тестов воспроизводимыми.
 *  Без этого физика/эффекты зависят от реального Math.random и тест
 *  «мигания» флейкает (шаг ловли бонуса fire). */
export function installSeededRandom(seed = 12345): () => void {
  let s = seed >>> 0
  Math.random = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  return () => {
    Math.random = realRandom
  }
}

export function makeEnv() {
  const restoreRandom = installSeededRandom()
  const paints: PaintEvent[] = []
  const rec = makeRecordingCtx(paints)
  const fakeWindow = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    AudioContext: undefined,
  }
  const fakeDocument = {
    addEventListener: () => {},
    removeEventListener: () => {},
    pointerLockElement: null,
  }
  vi.stubGlobal("window", fakeWindow)
  vi.stubGlobal("document", fakeDocument)
  let rafCb: FrameRequestCallback | null = null
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCb = cb
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})
  const canvas = {
    width: 1280,
    height: 720,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => rec.ctx,
  } as unknown as HTMLCanvasElement
  const game = new Game(canvas, () => {})
  ;(game as unknown as { attach: () => void }).attach()
  let t = 1000
  ;(game as unknown as { last: number }).last = t
  /** Прогнать n кадров по 16.7 мс игрового времени. */
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      t += 16.7
      const cb = rafCb
      rafCb = null
      expect(cb, "игровой цикл должен быть запланирован").toBeTruthy()
      paints.length = 0
      rec.resetFrame()
      cb!(t)
    }
  }
  const g = game as unknown as GameInternals
  return {
    game,
    g,
    step,
    paints,
    shake: rec.getShake,
    /** восстановить реальный Math.random (после destroy каждого сценария). */
    restoreRandom,
  }
}

/** Все отрисовки под ЛОКАЛЬНЫМ сдвигом (без тряски кадра) — шар, ракетка, гаджеты. */
export function translated(paints: PaintEvent[], shake: [number, number]) {
  return paints.filter((p) => Math.abs(p.m[4] - shake[0]) + Math.abs(p.m[5] - shake[1]) > 0.5)
}

/* Матрица кадра включает единый масштаб мира (viewport.ts): локальный сдвиг
   отрисовки в device-пикселях равен мировым координатам, умноженным на scale
   (m[0]/m[3] — этот самый масштаб), поэтому ожидание сравнивает через него. */
export function paintedBall(
  paints: PaintEvent[],
  ball: { x: number; y: number; r: number },
  shake: [number, number]
) {
  return translated(paints, shake).some(
    (p) =>
      Math.abs(p.m[4] - shake[0] - ball.x * p.m[0]) < 2 &&
      Math.abs(p.m[5] - shake[1] - ball.y * p.m[3]) < 2 &&
      p.arcs.some((a) => Math.abs(a.r - ball.r) < 0.6) &&
      p.alpha === 1
  )
}

export function paintedPaddle(
  paints: PaintEvent[],
  p: { x: number; y: number },
  shake: [number, number]
) {
  return translated(paints, shake).some(
    (ev) =>
      Math.abs(ev.m[4] - shake[0] - p.x * ev.m[0]) < 2 &&
      Math.abs(ev.m[5] - shake[1] - p.y * ev.m[3]) < 2 &&
      ev.alpha === 1
  )
}
