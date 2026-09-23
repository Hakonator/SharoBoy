import { describe, expect, it } from "vitest"

import { mulberry32 } from "../utils"
import type { Block } from "../types"

import { decorateBlocks, specialIntensity } from "./blockSpawn"

function makeBlock(over: Partial<Block> = {}): Block {
  return {
    x: 200,
    y: 100,
    rx: 30,
    ry: 16,
    rot: 0,
    circle: false,
    hp: 2,
    maxHp: 2,
    tier: 1,
    flash: 0,
    seed: 1,
    dead: false,
    x0: 200,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
    ...over,
  }
}

/** Счётчик присвоенных типов по «��иду» спецблока. */
function kindOf(b: Block): string | null {
  const sp = b.sp
  if (!sp) return null
  if (sp.portalId !== undefined) return "portal"
  if (sp.spring) return "spring"
  if (sp.cotton) return "cotton"
  if (sp.pulse) return "pulse"
  if (sp.drift) return "drift"
  if (sp.rotVel !== undefined) return "spin"
  return "unknown"
}

describe("specialIntensity", () => {
  it("первые два уровня — без спецблоков, далее растёт и ограничен", () => {
    expect(specialIntensity(1)).toBe(0)
    expect(specialIntensity(2)).toBe(0)
    expect(specialIntensity(3)).toBeCloseTo(0.05)
    expect(specialIntensity(30)).toBeLessThanOrEqual(0.55)
  })
})

describe("decorateBlocks", () => {
  it("уровни 1–2 не получают спецблоков", () => {
    const blocks = Array.from({ length: 20 }, () => makeBlock())
    decorateBlocks(blocks, 2, mulberry32(42))
    expect(blocks.every((b) => !b.sp)).toBe(true)
  })

  it("каждому блоку — не больше одного спецтипа, типы корректны", () => {
    const blocks = Array.from({ length: 60 }, (_, i) => makeBlock({ seed: i }))
    decorateBlocks(blocks, 15, mulberry32(7))
    const known = new Set(["spring", "cotton", "pulse", "drift", "spin", "portal"])
    for (const b of blocks) {
      const kind = kindOf(b)
      if (kind === null) continue
      expect(known.has(kind), `неизвестный тип ${kind}`).toBe(true)
    }
  })

  it("порталы образуют пары с общим id и hp=2", () => {
    const blocks = Array.from({ length: 60 }, (_, i) => makeBlock({ seed: i }))
    decorateBlocks(blocks, 12, mulberry32(3))
    const portals = blocks.filter((b) => b.sp?.portalId !== undefined)
    if (portals.length > 0) {
      // пары: чётное число, у каждой пары общий id
      expect(portals.length % 2).toBe(0)
      const byId = new Map<number, Block[]>()
      for (const p of portals) {
        const list = byId.get(p.sp!.portalId!) ?? []
        list.push(p)
        byId.set(p.sp!.portalId!, list)
      }
      for (const list of byId.values()) {
        expect(list).toHaveLength(2)
        for (const p of list) {
          expect(p.hp).toBe(2)
          expect(p.maxHp).toBe(2)
        }
      }
    }
  })

  it("боссы, минибоссы и бомбы не получают спецтипов", () => {
    const special = makeBlock({ isMiniboss: true })
    const tentacle = makeBlock({ isTentacle: true })
    const orbit = makeBlock({ minionOrbit: { ang: 0, rad: 90, dir: 1, speed: 1 } })
    const bomb = makeBlock({ bomb: true })
    const blocks = [
      special,
      tentacle,
      orbit,
      bomb,
      ...Array.from({ length: 40 }, (_, i) => makeBlock({ seed: i })),
    ]
    decorateBlocks(blocks, 15, mulberry32(11))
    expect(special.sp).toBeUndefined()
    expect(tentacle.sp).toBeUndefined()
    expect(orbit.sp).toBeUndefined()
    expect(bomb.sp).toBeUndefined()
  })

  it("дрейф отключает сеточное покачивание и ставит y0 для вертикали/окружности", () => {
    // ищем seed, дающий дрейф: перебираем несколько прогонов
    let checked = false
    for (let seed = 0; seed < 50 && !checked; seed++) {
      const blocks = Array.from({ length: 80 }, (_, i) =>
        makeBlock({ seed: i, swayAmp: 8, swayFreq: 1, swayPh: i })
      )
      decorateBlocks(blocks, 20, mulberry32(seed))
      const drift = blocks.find((b) => b.sp?.drift)
      if (drift) {
        expect(drift.swayAmp).toBe(0)
        if (drift.sp!.drift!.kind !== "h") expect(drift.y0).toBeDefined()
        checked = true
      }
    }
    expect(checked).toBe(true)
  })

  it("крутящийся тип назначается т��лько вытянутым некруглым блокам", () => {
    const blocks = [
      ...Array.from({ length: 40 }, (_, i) => makeBlock({ seed: i })),
      ...Array.from({ length: 10 }, (_, i) =>
        makeBlock({ seed: 100 + i, circle: true, rx: 20, ry: 20 })
      ),
    ]
    decorateBlocks(blocks, 20, mulberry32(5))
    for (const b of blocks) {
      if (b.sp?.rotVel !== undefined) {
        expect(b.circle).toBe(false)
        expect(b.rx).toBeGreaterThanOrEqual(b.ry)
      }
    }
  })

  it("детерминирован: одинаковый seed даёт одинаковую расстановку", () => {
    const a = Array.from({ length: 40 }, (_, i) => makeBlock({ seed: i }))
    const b = Array.from({ length: 40 }, (_, i) => makeBlock({ seed: i }))
    decorateBlocks(a, 10, mulberry32(99))
    decorateBlocks(b, 10, mulberry32(99))
    expect(a.map((x) => kindOf(x))).toEqual(b.map((x) => kindOf(x)))
  })
})
