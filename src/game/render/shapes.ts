import { Block } from "../types"

/** Общие геометрические помощники рендера: тип контекста и примитивы фигур. */

export type Ctx = CanvasRenderingContext2D

/** Скруглённый прямоугольник (строит путь, без заливки/обводки). */
export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Габариты группы частей существа. */
export interface MbBox {
  x: number
  y: number
  w: number
  h: number
}

export function bboxOf(parts: Block[]): MbBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of parts) {
    minX = Math.min(minX, p.x - p.rx)
    maxX = Math.max(maxX, p.x + p.rx)
    minY = Math.min(minY, p.y - p.ry)
    maxY = Math.max(maxY, p.y + p.ry)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
