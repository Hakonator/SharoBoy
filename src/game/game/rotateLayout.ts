import type { Game } from "../game"

import { blockTop } from "./paddleControl"

/**
 * Пересчёт вертикальной расстановки при смене ориентации окна посреди уровня.
 *
 * resizeHandler пропорционально масштабирует позиции блоков под новые размеры
 * мира, но не знает про неигровую HUD-зону: после поворота блоки (и босс)
 * могут оказаться выше новой границы. Здесь они единым сдвигом dy
 * опускаются ниже зоны — расстановка не «слипается», взаимные расстояния
 * сохраняются. Орбитальные сущности (миньоны/щупальца босса) не сдвигаем — их
 * координаты каждый кадр пересчитываются от босса; учитываем полный радиус
 * орбиты и достаточно сдвинуть его baseY.
 */
export function realignOnOrientationChange(g: Game, wasPortrait: boolean): void {
  const nowPortrait = g.h > g.w
  if (wasPortrait === nowPortrait || !g.blocks.length) return
  if (g.phase !== "playing" && g.phase !== "paused") return
  const top = blockTop(g)
  let dy = 0
  for (const b of g.blocks) {
    if (b.tentacleOrbit) continue
    if (b.minionOrbit) {
      dy = Math.max(dy, top + b.ry + b.minionOrbit.rad - (g.bossSys.boss?.baseY ?? b.y))
      continue
    }
    dy = Math.max(dy, top + b.ry - b.y)
  }
  const boss = g.bossSys.boss
  if (boss) {
    const bossTop = boss.isJellyfish ? boss.r * (boss.pulseScale ?? 1) : boss.r
    dy = Math.max(dy, top + bossTop - boss.baseY)
  }
  if (dy <= 0) return
  for (const b of g.blocks) {
    if (b.minionOrbit || b.tentacleOrbit) continue // их ведёт босс/анимация
    b.y += dy
    if (typeof b.y0 === "number") b.y0 += dy
  }
  if (boss) boss.baseY += dy
}
