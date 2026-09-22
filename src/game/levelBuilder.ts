/**
 * Построение расстановки блоков и арены босса из спецификаций уровней.
 * Чистые функции: на вход — спецификация и размеры поля, на выход — новые сущности.
 */
import type { LayoutSpec } from "./levels"
import type { Block } from "./types"
import { clamp, rand } from "./utils"
import { REF_DIAG } from "./viewport"

/**
 * Множитель плотности расстановки блоков. Мир масштабируется единообразно
 * (см. viewport.ts), поэтому плотность зависит только от пропорций мирового
 * поля: на эталонном окне 1920×1080 и «пропорциональных» ему экранах — 1,
 * заметно вытянутые поля мягко корректируются (0.65 — реже, 1.35 — плотнее).
 */
export function densityFactor(w: number, h: number): number {
  return clamp(Math.hypot(w, h) / REF_DIAG, 0.65, 1.35)
}

/** Нормализованная проверка пересечения двух блоков (эллипсы/круги). */
function overlaps(a: Block, b: Block): boolean {
  const nx = a.rx + b.rx
  const ny = a.ry + b.ry
  if (nx <= 0 || ny <= 0) return true
  const dx = (a.x - b.x) / nx
  const dy = (a.y - b.y) / ny
  return dx * dx + dy * dy < 1
}

/** Итеративное расталкивание пересекающихся блоков внутри границ зоны. */
export function separateBlocks(
  blocks: Block[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): void {
  for (let pass = 0; pass < 16; pass++) {
    let moved = false
    for (let i = 0; i < blocks.length; i++) {
      const a = blocks[i]
      for (let j = i + 1; j < blocks.length; j++) {
        const b = blocks[j]
        const nx = a.rx + b.rx
        const ny = a.ry + b.ry
        const dx = b.x - a.x
        const dy = b.y - a.y
        const ex = dx / nx
        const ey = dy / ny
        if (ex * ex + ey * ey >= 1) continue
        const signX = dx >= 0 ? 1 : -1
        const signY = dy >= 0 ? 1 : -1
        const pushX = nx * (1 - Math.abs(ex)) * 0.5
        const pushY = ny * (1 - Math.abs(ey)) * 0.5
        a.x -= signX * pushX * 0.5
        b.x += signX * pushX * 0.5
        a.y -= signY * pushY * 0.5
        b.y += signY * pushY * 0.5
        moved = true
      }
    }
    for (const bl of blocks) {
      bl.x = clamp(bl.x, minX + bl.rx, maxX - bl.rx)
      bl.y = clamp(bl.y, minY + bl.ry, maxY - bl.ry)
      bl.x0 = bl.x
    }
    if (!moved) break
  }
}

/** Фабрика блока: заполняет служебные поля по умолчанию. */
export function makeBlock(opts: {
  x: number
  y: number
  rx: number
  ry: number
  rot?: number
  hp: 1 | 2 | 3
  circle?: boolean
  bomb?: boolean
  splits?: boolean
  minionOrbit?: Block["minionOrbit"]
  /** знак частоты покачивания — задаётся только для процедурной сетки */
  swaySign?: 1 | -1
}): Block {
  return {
    x: opts.x,
    y: opts.y,
    rx: opts.rx,
    ry: opts.ry,
    rot: opts.rot ?? 0,
    circle: opts.circle ?? (Math.abs(opts.rx - opts.ry) < 0.6 && !(opts.rot ?? 0)),
    hp: opts.hp,
    maxHp: opts.hp,
    tier: opts.hp,
    flash: 0,
    seed: rand(0, Math.PI * 2),
    dead: false,
    x0: opts.x,
    swayAmp: opts.swaySign ? rand(5, 13) : 0,
    swayFreq: opts.swaySign ? rand(0.5, 1.0) * opts.swaySign : 0,
    swayPh: opts.swaySign ? rand(0, Math.PI * 2) : 0,
    bomb: opts.bomb ?? false,
    splits: opts.splits ?? false,
    minionOrbit: opts.minionOrbit,
  }
}

/** Авторская раскладка в нормализованных координатах → блоки в пикселях поля. */
export function layoutBlocks(
  spec: LayoutSpec,
  w: number,
  h: number,
  density = 1,
  /** Верх зоны блоков в мировых единицах; по умолчанию — 14% высоты мира. */
  topOverride?: number
): Block[] {
  const margin = clamp(w * 0.055, 22, 72)
  const top = topOverride ?? clamp(h * 0.14, 86, 160)
  const zoneH = clamp(h * 0.42, 220, 420)
  let minX = Infinity
  let maxX = -Infinity
  let maxY = 0
  for (const it of spec.layout) {
    minX = Math.min(minX, it.x - it.rx)
    maxX = Math.max(maxX, it.x + it.rx)
    maxY = Math.max(maxY, it.y + (it.ry ?? it.rx))
  }
  const unit = Math.min(
    (w - margin * 2) / (maxX - minX || 1),
    zoneH / (maxY || 1),
    Math.min(w, h) * 0.075
  )
  const offsetX = -((minX + maxX) / 2) * unit
  const blocks = spec.layout.map((it) => {
    const rx = Math.max(it.rx * unit, 8)
    const ry = Math.max((it.ry ?? it.rx) * unit, 8)
    const cx = clamp(w / 2 + offsetX + it.x * unit, margin * 0.5 + rx, w - margin * 0.5 - rx)
    return makeBlock({
      x: cx,
      y: top + it.y * unit,
      rx,
      ry,
      rot: it.rot ?? 0,
      hp: it.hp,
      bomb: it.bomb,
      splits: it.splits,
    })
  })

  /* На плотных экранах (4K и выше) дополнительно рассыпаем мелкие блоки
     в свободные места авторской раскладки — без пересечений с ней. */
  if (density > 1.01) {
    const extra = Math.min(Math.round((density - 1) * spec.layout.length * 1.2), 60)
    for (let k = 0; k < extra; k++) {
      for (let attempt = 0; attempt < 14; attempt++) {
        const rr = Math.max(unit * 0.3, 10)
        const cx = rand(margin + rr, w - margin - rr)
        const cy = rand(top + rr, top + zoneH - rr)
        const cand = makeBlock({
          x: cx,
          y: cy,
          rx: rr,
          ry: rr,
          hp: 1,
        })
        if (blocks.some((b) => overlaps(b, cand))) continue
        blocks.push(cand)
        break
      }
    }
    separateBlocks(blocks, margin, w - margin, top, top + zoneH)
  }

  return blocks
}

/** Процедурная сетка по описанию узора. */
export { gridBlocks, buildBossArena } from "./levelPatterns"
