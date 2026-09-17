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

  it("у рыбы есть плавники (1 HP), тело (2 HP) и глаз (3 HP)", () => {
    const fish = buildFish(W, H, TOP)
    expect(fish.filter((b) => b.hp === 2).length).toBeGreaterThanOrEqual(3) // тело
    expect(fish.filter((b) => b.hp === 1).length).toBeGreaterThanOrEqual(4) // хвост+плавники
    expect(fish.filter((b) => b.hp === 3).length).toBe(1) // глаз
  })

  it("у медузы розовый купол и зелёные щупальца-цепочки", () => {
    const jelly = buildJelly(W, H, TOP)
    expect(jelly.filter((b) => b.hp === 3).length).toBeGreaterThanOrEqual(11) // купол+бахрома
    expect(jelly.filter((b) => b.hp === 1).length).toBeGreaterThanOrEqual(20) // 5 щупалец × 4
  })

  it("пул HP существа задан константой и заметно выше «суммарного» HP блоков", () => {
    expect(MINIBOSS_HP.fish).toBeGreaterThan(100)
    expect(MINIBOSS_HP.jelly).toBeGreaterThan(100)
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
