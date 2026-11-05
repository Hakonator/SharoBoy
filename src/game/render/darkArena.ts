import { type Ctx } from "./shapes"

export const DARK_ARENA_RADIUS = 260
export const DARK_ARENA_COLOR = "rgba(2, 6, 12, 0.94)"
export const DARK_ARENA_BALL_INNER_RADIUS = 80
export const DARK_ARENA_PADDLE_INNER_RADIUS = 100

export interface DarkArenaBall {
  readonly x: number
  readonly y: number
  readonly lost?: boolean
}

export interface DarkArenaPaddle {
  readonly x: number
  readonly y: number
}

let cachedCanvas: HTMLCanvasElement | OffscreenCanvas | null = null
let cachedCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

/**
 * Получить или создать переиспользуемый холст маски заданного размера.
 * Гарантирует нулевые аллокации холста между кадрами (T-061, п. 4).
 */
export function getMaskCanvas(
  w: number,
  h: number
): {
  canvas: CanvasImageSource
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
} | null {
  if (!cachedCanvas) {
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      cachedCanvas = document.createElement("canvas")
      cachedCtx = cachedCanvas.getContext("2d")
    } else if (typeof OffscreenCanvas !== "undefined") {
      cachedCanvas = new OffscreenCanvas(w, h)
      cachedCtx = cachedCanvas.getContext("2d")
    }
  }
  if (!cachedCanvas || !cachedCtx) return null

  if (cachedCanvas.width !== w) cachedCanvas.width = w
  if (cachedCanvas.height !== h) cachedCanvas.height = h
  return { canvas: cachedCanvas as unknown as CanvasImageSource, ctx: cachedCtx }
}

/**
 * Установка холста/контекста маски для тестов (в т.ч. в headless-окружении).
 */
export function setMaskCanvasForTest(
  canvas: HTMLCanvasElement | OffscreenCanvas | null,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
): void {
  cachedCanvas = canvas
  cachedCtx = ctx ?? (canvas ? (canvas.getContext("2d") as CanvasRenderingContext2D) : null)
}

/**
 * Отрисовка маски мутатора «Слепой сектор» (T-061).
 *
 * Накладывает полупрозрачную глубокую тьму на всю арену, вырезая круги видимости
 * радиусом DARK_ARENA_RADIUS (260 px) с плавным радиальным спадом вокруг каждого
 * активного шара и платформы.
 */
export function drawDarkArena(
  ctx: Ctx,
  w: number,
  h: number,
  balls: readonly DarkArenaBall[],
  paddle: DarkArenaPaddle
): void {
  const mask = getMaskCanvas(w, h)
  if (!mask) return

  const { canvas: maskCanvas, ctx: mCtx } = mask

  // 1. Очищаем маску и заливаем глубокой тьмой
  mCtx.globalCompositeOperation = "source-over"
  mCtx.clearRect(0, 0, w, h)
  mCtx.fillStyle = DARK_ARENA_COLOR
  mCtx.fillRect(0, 0, w, h)

  // 2. Вырезаем круги видимости через destination-out
  mCtx.globalCompositeOperation = "destination-out"

  // Вырез вокруг активных шаров
  for (const b of balls) {
    if (b.lost) continue
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue

    const grad = mCtx.createRadialGradient(
      b.x,
      b.y,
      DARK_ARENA_BALL_INNER_RADIUS,
      b.x,
      b.y,
      DARK_ARENA_RADIUS
    )
    grad.addColorStop(0, "rgba(0, 0, 0, 1)")
    grad.addColorStop(1, "rgba(0, 0, 0, 0)")
    mCtx.fillStyle = grad
    mCtx.beginPath()
    mCtx.arc(b.x, b.y, DARK_ARENA_RADIUS, 0, Math.PI * 2)
    mCtx.fill()
  }

  // Вырез вокруг платформы
  if (Number.isFinite(paddle.x) && Number.isFinite(paddle.y)) {
    const pGrad = mCtx.createRadialGradient(
      paddle.x,
      paddle.y,
      DARK_ARENA_PADDLE_INNER_RADIUS,
      paddle.x,
      paddle.y,
      DARK_ARENA_RADIUS
    )
    pGrad.addColorStop(0, "rgba(0, 0, 0, 1)")
    pGrad.addColorStop(1, "rgba(0, 0, 0, 0)")
    mCtx.fillStyle = pGrad
    mCtx.beginPath()
    mCtx.arc(paddle.x, paddle.y, DARK_ARENA_RADIUS, 0, Math.PI * 2)
    mCtx.fill()
  }

  // 3. Восстанавливаем дефолтный режим для повторного использования холста
  mCtx.globalCompositeOperation = "source-over"

  // 4. Накладываем маску на целевую сцену
  ctx.drawImage(maskCanvas, 0, 0)
}
