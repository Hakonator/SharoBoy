import { describe, expect, it } from "vitest"

import {
  buildFish,
  buildJelly,
  carveLevelBlocks,
  MINIBOSS_HP,
  MINIBOSS_LIFE_CHANCE,
  MINIBOSS_NODE_CHANCE,
  minibossName,
  rollMiniboss,
} from "./minibosses"
import type { Block } from "./types"

const W = 960
const H = 640
const TOP = 120

/** Универсальные проверки собранного существа. */
function expectValidCreature(blocks: Block[]) {
  expect(blocks.length).toBeGreaterThan(0)
  for (const b of blocks) {
    expect(b.isMiniboss).toBe(true)
    expect(b.dead).toBe(false)
    expect([1, 2, 3]).toContain(b.hp)
    expect(b.tier).toBe(b.hp)
    expect(b.maxHp).toBe(b.hp)
    // существо целиком в пределах поля: ниже HUD-зоны, выше зоны ракетки
    expect(b.x - b.rx).toBeGreaterThan(0)
    expect(b.x + b.rx).toBeLessThan(W)
    expect(b.y - b.ry).toBeGreaterThan(TOP - 1)
    expect(b.y + b.ry).toBeLessThan(H * 0.85)
    // существует «плавание» и одна фаза на всё существо (цельность)
    expect(b.swayAmp).toBeGreaterThan(0)
    expect(b.swayPh).toBe(0)
  }
}

describe("minibosses", () => {
  it("рыба и медуза собираются в корректные существа", () => {
    expectValidCreature(buildFish(W, H, TOP))
    expectValidCreature(buildJelly(W, H, TOP))
  })

  it("у рыбы есть все части силуэта: тело, хвост, плавники и глаз", () => {
    const fish = buildFish(W, H, TOP)
    const partOf = (s: string) => fish.filter((b) => b.mbPart === s).length
    expect(partOf("body")).toBe(3)
    expect(partOf("tail")).toBe(3)
    expect(partOf("dorsal")).toBe(1)
    expect(partOf("pectoral")).toBe(1)
    expect(partOf("eye")).toBe(1)
  })

  it("у медузы купол с бахромой и пятью щупальцами-цепочками", () => {
    const jelly = buildJelly(W, H, TOP)
    expect(jelly.filter((b) => b.mbPart === "dome").length).toBe(2) // купол без лишних шариков
    expect(jelly.filter((b) => b.mbPart === "fringe").length).toBe(7) // бахрома
    expect(jelly.filter((b) => b.mbPart === "tentacle").length).toBe(20) // 5 × 4
  })

  it("пул HP существа снижен и задан константой", () => {
    expect(MINIBOSS_HP.fish).toBe(60)
    expect(MINIBOSS_HP.jelly).toBe(50)
  })

  it("шанс жизни за минибосса — 80%", () => {
    expect(MINIBOSS_LIFE_CHANCE).toBe(0.8)
  })

  it("rollMiniboss детерминирован: тот же сид и узел — тот же результат", () => {
    for (let nodeId = 0; nodeId < 30; nodeId++) {
      expect(rollMiniboss(4242, nodeId)).toEqual(rollMiniboss(4242, nodeId))
    }
  })

  it("минибоссы выпадают примерно в MINIBOSS_NODE_CHANCE доле узлов, оба вида", () => {
    let hits = 0
    const kinds = new Set<string>()
    const N = 4000
    for (let seed = 1; seed <= N; seed++) {
      const kind = rollMiniboss(seed, seed % 17)
      if (kind) {
        hits++
        kinds.add(kind)
      }
    }
    expect(hits / N).toBeGreaterThan(MINIBOSS_NODE_CHANCE - 0.05)
    expect(hits / N).toBeLessThan(MINIBOSS_NODE_CHANCE + 0.05)
    expect(kinds).toEqual(new Set(["fish", "jelly"]))
  })

  it("carveLevelBlocks убирает только blocks, налегающие на существо", () => {
    const creature = buildFish(W, H, TOP)
    const inside: Block = {
      ...creature[0],
      x: creature[0].x,
      y: creature[0].y,
      rx: 40,
      ry: 40,
    }
    const far: Block = { ...creature[0], x: 60, y: H - 120, rx: 15, ry: 15 }
    const kept = carveLevelBlocks([inside, far], creature)
    expect(kept).toEqual([far])
  })

  it("имена существ заданы", () => {
    expect(minibossName("fish")).toBe("РЫБА-ШАР")
    expect(minibossName("jelly")).toBe("МЕДУЗА")
  })
})
