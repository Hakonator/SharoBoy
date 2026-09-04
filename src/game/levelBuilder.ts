/**
 * Построение расстановки блоков и арены босса из спецификаций уровней.
 * Чистые функции: на вход — спецификация и размеры поля, на выход — новые сущности.
 */
import type { LayoutSpec, PatternSpec } from "./levels"
import type { Block, BossState } from "./types"
import { clamp, fitTilt, rand } from "./utils"

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
export function layoutBlocks(spec: LayoutSpec, w: number, h: number): Block[] {
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
  return spec.layout.map((it) => {
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
}

/** Процедурная сетка по описанию узора. */
export function gridBlocks(spec: PatternSpec, w: number, h: number): Block[] {
  const margin = clamp(w * 0.055, 22, 72)
  const top = clamp(h * 0.14, 86, 160)
  const zoneH = clamp(h * 0.42, 220, 420)
  const gap = clamp(zoneH / spec.rows, 46, 78)
  const blocks: Block[] = []
  for (let r = 0; r < spec.rows; r++) {
    let count = spec.counts[r % spec.counts.length]
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
