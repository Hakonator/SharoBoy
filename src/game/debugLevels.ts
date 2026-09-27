import { makeBlock } from "./levelBuilder"
import { mulberry32 } from "./utils"
import type { Block } from "./types"

/** Отдельная раскладка для визуальной проверки всех спецблоков. */
export function buildSpecialBlocks(w: number, h: number, top: number): Block[] {
  const random = mulberry32(0x5eec1)
  const columns = [w * 0.14, w * 0.38, w * 0.62, w * 0.86]
  const safeTop = top + Math.max(32, h * 0.06)
  const rows = [safeTop + h * 0.08, safeTop + h * 0.26]
  const blocks: Block[] = []
  const add = (x: number, y: number, label: string, sp: Block["sp"], over: Partial<Block> = {}) => {
    const block = makeBlock({ x, y, rx: 42, ry: 22, hp: 2, random })
    Object.assign(block, over)
    block.sp = sp
    block.debugLabel = label
    blocks.push(block)
  }

  add(columns[0], rows[0], "PULSE", { pulse: { freq: 1.4, ph: 0, rx0: 42, ry0: 22 } })
  add(columns[1], rows[0], "SPRING", { spring: true })
  add(columns[2], rows[0], "COTTON", { cotton: true })
  add(columns[3], rows[0], "SPIN", { rotVel: 0, rotDir: 1 }, { rx: 52, ry: 18, rot: -0.12 })
  add(columns[0], rows[1], "DRIFT H", { drift: { kind: "h", amp: 28, freq: 0.7, ph: 0 } })
  add(columns[1], rows[1], "DRIFT V", {
    drift: { kind: "v", amp: 22, freq: 0.7, ph: Math.PI / 2 },
  })
  add(columns[2], rows[1], "DRIFT CIRCLE", {
    drift: { kind: "circle", amp: 24, freq: 0.6, ph: 0 },
  })
  add(columns[3], rows[1], "PORTAL A", { portalId: 1 })
  add(columns[3] - w * 0.12, rows[1] + h * 0.13, "PORTAL B", { portalId: 1 })
  return blocks
}
