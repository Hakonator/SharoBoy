import type { Game } from "../game"

import { blockTop } from "./paddleControl"

/**
 * Пересчёт вертикальной расстановки при смене ориентации окна посреди уровня.
 *
 * resizeHandler пропорционально масштабирует позиции блоков под новые размеры
 * мира, но не знает про неигровую HUD-зону: после поворота в портрет блоки (и
 * босс) могут оказаться выше новой границы. Здесь они единым сдвигом dy
 * опускаются ниже зоны — расстановка не «слипается», взаимные расстояния
 * сохраняются. Орбитальные сущности (миньоны/щупальца босса) не сдвигаем — их
 * координаты каждый кадр пересчитываются от босса, достаточно сдвинуть его
 * baseY. В ландшафт зоны нет вовсе — двигать ничего не нужно.
 */
export function realignOnOrientationChange(g: Game, wasPortrait: boolean): void {
  const nowPortrait = g.h > g.w
  if (wasPortrait === nowPortrait || !g.blocks.length) return
  if (g.phase !== "playing" && g.phase !== "paused") return
  if (!nowPortrait) return
  const top = blockTop(g)
  let dy = 0
  for (const b of g.blocks) {
    if (b.minionOrbit || b.tentacleOrbit || b.bomb) continue
    dy = Math.max(dy, top + b.ry - b.y)
  }
  const boss = g.bossSys.boss
  if (boss) dy = Math.max(dy, top + boss.r - boss.baseY)
  if (dy <= 0) return
  for (const b of g.blocks) {
    if (b.minionOrbit || b.tentacleOrbit || b.bomb) continue // их ведёт босс/полёт
    b.y += dy
    if (typeof b.y0 === "number") b.y0 += dy
  }
  if (boss) boss.baseY += dy
}
