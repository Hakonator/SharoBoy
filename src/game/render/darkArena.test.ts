import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"

import {
  DARK_ARENA_BALL_INNER_RADIUS,
  DARK_ARENA_COLOR,
  DARK_ARENA_PADDLE_INNER_RADIUS,
  DARK_ARENA_RADIUS,
  drawDarkArena,
  getMaskCanvas,
  setMaskCanvasForTest,
  type DarkArenaBall,
  type DarkArenaPaddle,
} from "./darkArena"
import * as darkArenaModule from "./darkArena"

describe("darkArena — константы и параметры маски (T-061)", () => {
  it("радиус затемнения строго равен 260 px", () => {
    expect(DARK_ARENA_RADIUS).toBe(260)
  })

  it("цвет маски — глубокая тьма 94% непрозрачности", () => {
    expect(DARK_ARENA_COLOR).toBe("rgba(2, 6, 12, 0.94)")
  })

  it("внутренние радиусы обеспечивают ясную зону вблизи шара и ракетки", () => {
    expect(DARK_ARENA_BALL_INNER_RADIUS).toBe(80)
    expect(DARK_ARENA_PADDLE_INNER_RADIUS).toBe(100)
    expect(DARK_ARENA_BALL_INNER_RADIUS).toBeLessThan(DARK_ARENA_RADIUS)
    expect(DARK_ARENA_PADDLE_INNER_RADIUS).toBeLessThan(DARK_ARENA_RADIUS)
  })
})

describe("getMaskCanvas — переиспользование холста без аллокаций (T-061)", () => {
  let mockCanvas: HTMLCanvasElement
  let mockCtx: CanvasRenderingContext2D

  beforeEach(() => {
    mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    } as unknown as CanvasRenderingContext2D

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
    } as unknown as HTMLCanvasElement

    setMaskCanvasForTest(mockCanvas, mockCtx)
  })

  afterEach(() => {
    setMaskCanvasForTest(null, null)
  })

  it("возвращает один и тот же холст при повторных вызовах с теми же размерами", () => {
    const first = getMaskCanvas(800, 600)
    expect(first).not.toBeNull()
    expect(first?.canvas).toBe(mockCanvas)
    expect(mockCanvas.width).toBe(800)
    expect(mockCanvas.height).toBe(600)

    const second = getMaskCanvas(800, 600)
    expect(second?.canvas).toBe(mockCanvas)
  })

  it("обновляет размеры холста при изменении габаритов без пересоздания объекта", () => {
    getMaskCanvas(800, 600)
    expect(mockCanvas.width).toBe(800)
    expect(mockCanvas.height).toBe(600)

    getMaskCanvas(1024, 768)
    expect(mockCanvas.width).toBe(1024)
    expect(mockCanvas.height).toBe(768)
    expect(getMaskCanvas(1024, 768)?.canvas).toBe(mockCanvas)
  })
})

describe("drawDarkArena — вырезание кругов видимости через destination-out (T-061)", () => {
  interface RecordedOp {
    op: string
    compOp: string
    x?: number
    y?: number
    r?: number
    color?: unknown
    innerR?: number
    outerR?: number
  }

  let ops: RecordedOp[]
  let mockMaskCtx: CanvasRenderingContext2D
  let mockMaskCanvas: HTMLCanvasElement
  let mockMainCtx: CanvasRenderingContext2D
  let mainDrawCalls: { image: unknown; dx: number; dy: number }[]

  beforeEach(() => {
    ops = []
    mainDrawCalls = []

    mockMaskCtx = {
      globalCompositeOperation: "source-over",
      fillStyle: "",
      clearRect: vi.fn((_x, _y, _w, _h) => {
        ops.push({ op: "clearRect", compOp: mockMaskCtx.globalCompositeOperation })
      }),
      fillRect: vi.fn((_x, _y, _w, _h) => {
        ops.push({
          op: "fillRect",
          compOp: mockMaskCtx.globalCompositeOperation,
          color: mockMaskCtx.fillStyle,
        })
      }),
      beginPath: vi.fn(() => {
        ops.push({ op: "beginPath", compOp: mockMaskCtx.globalCompositeOperation })
      }),
      arc: vi.fn((x: number, y: number, r: number) => {
        ops.push({ op: "arc", compOp: mockMaskCtx.globalCompositeOperation, x, y, r })
      }),
      fill: vi.fn(() => {
        ops.push({ op: "fill", compOp: mockMaskCtx.globalCompositeOperation })
      }),
      createRadialGradient: vi.fn(
        (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => {
          ops.push({
            op: "createRadialGradient",
            compOp: mockMaskCtx.globalCompositeOperation,
            x: x0,
            y: y0,
            innerR: r0,
            outerR: r1,
          })
          return { addColorStop: vi.fn() }
        }
      ),
    } as unknown as CanvasRenderingContext2D

    mockMaskCanvas = {
      width: 800,
      height: 600,
      getContext: vi.fn(() => mockMaskCtx),
    } as unknown as HTMLCanvasElement

    mockMainCtx = {
      drawImage: vi.fn((image: unknown, dx: number, dy: number) => {
        mainDrawCalls.push({ image, dx, dy })
      }),
    } as unknown as CanvasRenderingContext2D

    setMaskCanvasForTest(mockMaskCanvas, mockMaskCtx)
  })

  afterEach(() => {
    setMaskCanvasForTest(null, null)
  })

  it("заливает маску тёмным цветом, затем вырезает круги в режиме destination-out", () => {
    const balls: DarkArenaBall[] = [{ x: 250, y: 350 }]
    const paddle: DarkArenaPaddle = { x: 400, y: 550 }

    drawDarkArena(mockMainCtx, 800, 600, balls, paddle)

    // 1. Первая операция — заливка темноты под source-over
    const fillRectOp = ops.find((o) => o.op === "fillRect")
    expect(fillRectOp).toBeDefined()
    expect(fillRectOp?.compOp).toBe("source-over")
    expect(fillRectOp?.color).toBe(DARK_ARENA_COLOR)

    // 2. Радиальные градиенты строятся в режиме destination-out
    const gradients = ops.filter((o) => o.op === "createRadialGradient")
    expect(gradients).toHaveLength(2)
    for (const g of gradients) {
      expect(g.compOp).toBe("destination-out")
      expect(g.outerR).toBe(DARK_ARENA_RADIUS)
    }

    // Вырез шара
    expect(gradients[0].x).toBe(250)
    expect(gradients[0].y).toBe(350)
    expect(gradients[0].innerR).toBe(DARK_ARENA_BALL_INNER_RADIUS)

    // Вырез ракетки
    expect(gradients[1].x).toBe(400)
    expect(gradients[1].y).toBe(550)
    expect(gradients[1].innerR).toBe(DARK_ARENA_PADDLE_INNER_RADIUS)

    // 3. Дуги окружностей радиусом DARK_ARENA_RADIUS
    const arcs = ops.filter((o) => o.op === "arc")
    expect(arcs).toHaveLength(2)
    expect(arcs[0]).toMatchObject({ x: 250, y: 350, r: DARK_ARENA_RADIUS })
    expect(arcs[1]).toMatchObject({ x: 400, y: 550, r: DARK_ARENA_RADIUS })

    // 4. По завершении режим сбрасывается в source-over
    expect(mockMaskCtx.globalCompositeOperation).toBe("source-over")

    // 5. Маска переносится на основной холст в координаты (0, 0)
    expect(mainDrawCalls).toHaveLength(1)
    expect(mainDrawCalls[0]).toEqual({ image: mockMaskCanvas, dx: 0, dy: 0 })
  })

  it("игнорирует потерянные шары (lost: true)", () => {
    const balls: DarkArenaBall[] = [
      { x: 100, y: 100, lost: true },
      { x: 300, y: 200, lost: false },
    ]
    const paddle: DarkArenaPaddle = { x: 400, y: 500 }

    drawDarkArena(mockMainCtx, 800, 600, balls, paddle)

    // Градиенты: 1 для активного шара + 1 для ракетки
    const gradients = ops.filter((o) => o.op === "createRadialGradient")
    expect(gradients).toHaveLength(2)
    expect(gradients[0].x).toBe(300)
    expect(gradients[0].y).toBe(200)
    expect(gradients[1].x).toBe(400)
    expect(gradients[1].y).toBe(500)
  })

  it("вырезает круг вокруг ракетки даже если на поле нет активных шаров", () => {
    drawDarkArena(mockMainCtx, 800, 600, [], { x: 380, y: 520 })

    const gradients = ops.filter((o) => o.op === "createRadialGradient")
    expect(gradients).toHaveLength(1)
    expect(gradients[0].x).toBe(380)
    expect(gradients[0].y).toBe(520)
    expect(gradients[0].innerR).toBe(DARK_ARENA_PADDLE_INNER_RADIUS)
  })

  it("пропускает некорректные/нечисловые координаты без падений", () => {
    const balls: DarkArenaBall[] = [{ x: NaN, y: 100 }]
    const paddle: DarkArenaPaddle = { x: 400, y: Infinity }

    expect(() => {
      drawDarkArena(mockMainCtx, 800, 600, balls, paddle)
    }).not.toThrow()

    const gradients = ops.filter((o) => o.op === "createRadialGradient")
    expect(gradients).toHaveLength(0)
  })

  it("корректно завершается без ошибок при отсутствии холста маски", () => {
    setMaskCanvasForTest(null, null)
    expect(() => {
      drawDarkArena(mockMainCtx, 800, 600, [{ x: 100, y: 100 }], { x: 200, y: 200 })
    }).not.toThrow()
    expect(mainDrawCalls).toHaveLength(0)
  })
})

describe("Интеграция в drawScene — порядок слоёв и вызов по флагу мутатора", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("вызывает drawDarkArena только когда мутатор dark_arena активен", () => {
    const spy = vi.spyOn(darkArenaModule, "drawDarkArena").mockImplementation(() => {})
    const { game, g, step } = makeEnv()
    g.startLevelBattle(1)

    // Без мутатора
    game.campaignModifiers = []
    step(1)
    expect(spy).not.toHaveBeenCalled()

    // С активным мутатором dark_arena
    game.campaignModifiers = ["dark_arena"]
    step(1)
    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      g.w,
      g.h,
      expect.anything(),
      expect.anything()
    )
  })

  it("не вызывает drawDarkArena в фазах меню и карты", () => {
    const spy = vi.spyOn(darkArenaModule, "drawDarkArena").mockImplementation(() => {})
    const { game, step } = makeEnv()

    game.campaignModifiers = ["dark_arena"]
    game.phase = "menu"
    step(1)
    expect(spy).not.toHaveBeenCalled()

    game.phase = "map"
    step(1)
    expect(spy).not.toHaveBeenCalled()
  })
})
