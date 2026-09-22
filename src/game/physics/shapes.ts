import type { PaddleShapeKind } from "../types"

/** Высота купола выпуклой ракетки — единая для физики и рендера.
 *  Чаша использует ту же глубину (инверсия купола). */
export function convexBump(halfW: number): number {
  return Math.min(halfW * 0.4, 42)
}

/** Поверхность ракетки в точке relX ∈ [-1,1] относительно плоской грани.
 *  Результат — ВЫСОТА НАД ГРАНЬЮ (≥0): потребители делают y = yTop − surfaceAt.
 *  Формы — инверсии друг друга, обе ленты постоянной толщины с общей глубиной
 *  convexBump: «convex» — купол (+bump·(1−rel²), центр выше), «concave» — чаша
 *  (+bump·rel², края выше, центр на грани), «flat» — 0. ЕДИНАЯ формула
 *  для физики, ловли бонусов, оружия и рендера — форма и коллизии не могут
 *  разойтись. Новые формы (скины) добавляются здесь, потребители
 *  подхватывают их автоматически. */
export function surfaceAt(halfW: number, relX: number, kind: PaddleShapeKind, _hh = 0): number {
  if (kind === "flat") return 0
  if (kind === "concave") return convexBump(halfW) * relX * relX
  // convex: центр выше краёв на bump, края на грани (высота над гранью ≥ 0).
  return convexBump(halfW) * (1 - relX * relX)
}
