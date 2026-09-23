import { type Ctx } from "./shapes"

/**
 * Кэш CanvasGradient между кадрами. Создание градиента — одна из самых
 * дорогих операций Canvas 2D; без кэша блоки/фон/виньетка порождали
 * десятки-сотни объектов градиентов на каждый кадр.
 *
 * Координаты градиента интерпретируются в пользовательской системе координат
 * в момент заливки, поэтому один градиент годится и для всех блоков сразу
 * (рисуются в единичной локальной системе), и для статичных слоёв — ключ
 * должен отражать всё, от чего зависят координаты/цвета (размер экрана и т.п.).
 *
 * Кэш автоматически сбрасывается при смене контекста (новая игра, тесты),
 * отдельной инвалидации по кадру не требует.
 */
let cacheCtx: Ctx | null = null
const cache = new Map<string, CanvasGradient>()

export function gradient(
  ctx: Ctx,
  key: string,
  make: (ctx: Ctx) => CanvasGradient
): CanvasGradient {
  if (ctx !== cacheCtx) {
    cacheCtx = ctx
    cache.clear()
  }
  let g = cache.get(key)
  if (!g) {
    g = make(ctx)
    cache.set(key, g)
  }
  return g
}
