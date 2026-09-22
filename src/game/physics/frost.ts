/**
 * Морозный мяч: волна заморозки при ударе. Замораживает блок удара и живых
 * соседей в радиусе. Замороженный блок колется с одного удара (см.
 * destruction.damageBlock) — чистая логика без Canvas и звука.
 */
import type { Block } from "../types"

/** Радиус волны заморозки вокруг точки удара (в мировых единицах). */
export const FROST_FREEZE_RADIUS = 72

/** Кому заморозка запрещена: существа минибоссов (неразрушаемы) и бомбы. */
function freezable(b: Block): boolean {
  return !b.dead && !b.frozen && !b.bomb && !b.isMiniboss
}

/**
 * Заморозить блок удара и соседей в радиусе. Замороженному блоку выставляется
 * hp = 1 — следующий любой урон раскалывает его. Возвращает список
 * замороженных (для эффектов и звука).
 */
export function freezeCluster(
  blocks: Block[],
  hit: Block,
  radius: number = FROST_FREEZE_RADIUS
): Block[] {
  const frozen: Block[] = []
  for (const b of blocks) {
    if (!freezable(b)) continue
    if (b !== hit && Math.hypot(b.x - hit.x, b.y - hit.y) > radius) continue
    b.frozen = true
    b.hp = 1
    frozen.push(b)
  }
  return frozen
}
