/**
 * Построение расстановки блоков и арены босса из спецификаций уровней.
 * Чистые функции: на вход — спецификация и размеры поля, на выход — новые сущности.
 */
import type { LayoutSpec, PatternSpec } from "./levels"
import type { Block, BossState } from "./types"
import { clamp, fitTilt, rand } from "./utils"

/**
 * Множитель плотности начальной расстановки блоков в зависимости от
 * разрешения экрана (по диагонали в CSS-пикселях):
 * - мобильные телефоны — существенно реже (0.5);
 * - планшеты/маленькие окна — чуть реже (0.7);
 * - HD/FHD — эталон (1);
 * - большие мониторы/ultrawide — плотнее (1.25);
 * - 4K и выше — значительно плотнее (1.5).
 */
export function densityFactor(w: number, h: number): number {
  const diag = Math.hypot(w, h)
  if (diag <= 1200) return 0.5
  if (diag <= 1700) return 0.7
  if (diag <= 3000) return 1
  if (diag <= 3800) return 1.25
  return 1.5
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
function separateBlocks(
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
function makeBlock(opts: {
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
export function layoutBlocks(spec: LayoutSpec, w: number, h: number, density = 1): Block[] {
  const margin = clamp(w * 0.055, 22, 72)
  const top = clamp(h * 0.14, 86, 160)
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
export function gridBlocks(spec: PatternSpec, w: number, h: number, density = 1): Block[] {
  const margin = clamp(w * 0.055, 22, 72)
  const top = clamp(h * 0.14, 86, 160)
  const zoneH = clamp(h * 0.42, 220, 420)
  const rows = Math.max(2, Math.round(spec.rows * density))
  const gap = clamp(zoneH / rows, 46, 78)
  const blocks: Block[] = []
  for (let r = 0; r < rows; r++) {
    let count = Math.max(3, Math.round(spec.counts[r % spec.counts.length] * density))
    while ((w - margin * 2) / count < 60 && count > 3) count--
    const slot = (w - margin * 2) / count
    for (let i = 0; i < count; i++) {
      const kind = spec.shape(r, i)
      const isBomb = Math.random() < 0.07
      const isSplit = !isBomb && Math.random() < 0.09
      const hp = (isBomb ? 1 : spec.hp(r, i)) as 1 | 2 | 3
      const cx = clamp(
        margin + slot * (i + 0.5) + rand(-1, 1) * slot * 0.02,
        margin + slot * 0.3,
        w - margin - slot * 0.3
      )
      const cy = top + gap * (r + 0.5) + rand(-1, 1) * gap * 0.02
      let rx: number
      let ry: number
      if (kind === "circle" || isBomb) {
        const rr = clamp(Math.min(slot * 0.5, gap * 0.44) * rand(0.9, 1), 12, 42)
        rx = ry = rr
      } else if (kind === "eh") {
        rx = clamp(slot * 0.52 * rand(0.9, 1), 18, 60)
        ry = clamp(gap * 0.3 * rand(0.9, 1), 11, 27)
      } else {
        rx = clamp(slot * 0.27 * rand(0.9, 1), 10, 26)
        ry = clamp(gap * 0.47 * rand(0.9, 1), 15, 46)
      }
      const rot =
        kind !== "circle" && !isBomb && Math.random() < 0.65
          ? fitTilt(rx, ry, slot / 2 - 4, gap / 2 - 4)
          : 0
      blocks.push(
        makeBlock({
          x: cx,
          y: cy,
          rx,
          ry,
          rot,
          circle: kind === "circle" || isBomb,
          hp,
          bomb: isBomb,
          splits: isSplit,
          swaySign: r % 2 === 0 ? 1 : -1,
        })
      )
    }
  }
  // расталкиваем блоки, чтобы на плотных сетках они не наезжали друг на друга
  separateBlocks(blocks, margin, w - margin, top, top + Math.max(zoneH, gap * rows))
  return blocks
}

/** Арена босса: сам босс плюс свита на орбитах и расставленные бомбы. */
export function buildBossArena(
  hp: number,
  minions: number,
  bombs: number,
  w: number,
  h: number
): { boss: BossState; blocks: Block[] } {
  const top = clamp(h * 0.14, 86, 160)
  const r = clamp(Math.min(w, h) * 0.1, 52, 84)
  const baseY = top + r + 34
  const boss: BossState = {
    x: w / 2,
    y: baseY,
    baseY,
    r,
    hp,
    maxHp: hp,
    t: 0,
    flash: 0,
    dropTimer: 5,
  }
  const blocks: Block[] = []
  const orbit = clamp(r * 2.5, 110, Math.min(w * 0.3, 280))
  for (let i = 0; i < minions; i++) {
    blocks.push(
      makeBlock({
        x: w / 2,
        y: baseY,
        rx: 15,
        ry: 15,
        hp: 2,
        circle: true,
        minionOrbit: {
          ang: (i * Math.PI * 2) / minions,
          rad: orbit,
          dir: i % 2 ? 1 : -1,
          speed: 1.05,
        },
      })
    )
  }
  const spots = [
    [0.13, 0.16],
    [0.87, 0.16],
    [0.13, 0.55],
    [0.87, 0.55],
    [0.5, 0.7],
  ]
  for (let i = 0; i < bombs; i++) {
    const [fx, fy] = spots[i % spots.length]
    blocks.push(
      makeBlock({
        x: clamp(w * fx, 40, w - 40),
        y: top + fy * clamp(h * 0.42, 220, 420),
        rx: 20,
        ry: 20,
        hp: 1,
        circle: true,
        bomb: true,
      })
    )
  }
  return { boss, blocks }
}
