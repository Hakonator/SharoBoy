import { describe, expect, it } from "vitest"

import {
  buildFish,
  buildJelly,
  carveLevelBlocks,
  minibossChance,
  minibossHpFor,
  MINIBOSS_DUET_SHIFT,
  MINIBOSS_HP,
  MINIBOSS_HP_GROWTH,
  MINIBOSS_LIFE_CHANCE,
  MINIBOSS_NODE_CHANCE,
  MINIBOSS_PITY_STEP,
  minibossName,
  rollMinibossLive,
} from "./minibosses"
import { mulberry32 } from "./utils"
import { MAP_TIERS } from "./campaignMap"
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

  it("шанс появления растёт без минибосса и ограничен единицей", () => {
    expect(minibossChance(0)).toBe(MINIBOSS_NODE_CHANCE)
    expect(minibossChance(3)).toBeCloseTo(MINIBOSS_NODE_CHANCE + 3 * MINIBOSS_PITY_STEP)
    expect(minibossChance(10)).toBe(MINIBOSS_NODE_CHANCE + 10 * MINIBOSS_PITY_STEP)
    expect(minibossChance(100)).toBe(1)
    expect(minibossChance(-5)).toBe(MINIBOSS_NODE_CHANCE) // мусор на входе не ломает
  })

  it("rollMinibossLive: без появления жалость растёт, с появлением — сброс", () => {
    // rand() = 0.999 — всегда выше шанса: существо не появляется
    const miss = rollMinibossLive(2, () => 0.999)
    expect(miss.kinds).toEqual([])
    expect(miss.pity).toBe(3)
    // rand() = 0 — появление гарантировано, жалость обнуляется
    const hit = rollMinibossLive(5, () => 0)
    expect(hit.kinds.length).toBeGreaterThanOrEqual(1)
    expect(hit.pity).toBe(0)
  })

  it("rollMinibossLive: базовый шанс появления ≈ MINIBOSS_NODE_CHANCE", () => {
    const rng = mulberry32(4242)
    let hits = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      if (rollMinibossLive(0, rng).kinds.length) hits++
    }
    expect(hits / N).toBeGreaterThan(MINIBOSS_NODE_CHANCE - 0.05)
    expect(hits / N).toBeLessThan(MINIBOSS_NODE_CHANCE + 0.05)
  })

  it("rollMinibossLive: оба вида существ, дуэты бывают и реже одиночных", () => {
    const rng = mulberry32(777)
    const kinds = new Set<string>()
    let duets = 0
    let hits = 0
    for (let i = 0; i < 4000; i++) {
      const roll = rollMinibossLive(0, rng)
      if (!roll.kinds.length) continue
      hits++
      kinds.add(roll.kinds[0])
      if (roll.kinds.length === 2) duets++
    }
    expect(kinds).toEqual(new Set(["fish", "jelly"]))
    expect(duets).toBeGreaterThan(0)
    expect(duets / hits).toBeLessThan(0.5)
  })

  it("в дуэте всегда рыба и медуза вместе", () => {
    // последовательность: появление → рыба → дуэт сработал
    const seq = [0, 0, 0]
    let i = 0
    const duet = rollMinibossLive(0, () => seq[i++])
    expect(new Set(duet.kinds)).toEqual(new Set(["fish", "jelly"]))
    // появление → медуза → дуэта нет
    const seq2 = [0, 0.9, 0.9]
    i = 0
    const single = rollMinibossLive(0, () => seq2[i++])
    expect(single.kinds).toEqual(["jelly"])
  })

  it("HP минибосса растёт по мере приближения к финальному боссу", () => {
    for (const kind of ["fish", "jelly"] as const) {
      // первый боевой ярус — базовый пул, последний боевой — максимум роста
      expect(minibossHpFor(kind, 1, MAP_TIERS)).toBe(MINIBOSS_HP[kind])
      expect(minibossHpFor(kind, MAP_TIERS - 2, MAP_TIERS)).toBe(
        Math.round(MINIBOSS_HP[kind] * (1 + MINIBOSS_HP_GROWTH))
      )
      // монотонный неубывающий рост между ярусами
      for (let t = 2; t < MAP_TIERS; t++) {
        expect(minibossHpFor(kind, t, MAP_TIERS)).toBeGreaterThanOrEqual(
          minibossHpFor(kind, t - 1, MAP_TIERS)
        )
      }
    }
  })

  it("carveLevelBlocks убирает только blocks, налегающие на существо", () => {
    const creature = buildFish(W, H, TOP)
    const inside: Block = {
      ...creature[0],
      x: creature[0].x,
      y: creature[0].y,
      rx: 40,
      ry: 40,
      isMiniboss: false,
      mbGroup: undefined,
      mbPart: undefined,
    }
    const far: Block = {
      ...creature[0],
      x: 60,
      y: H - 120,
      rx: 15,
      ry: 15,
      isMiniboss: false,
      mbGroup: undefined,
      mbPart: undefined,
    }
    const kept = carveLevelBlocks([inside, far], creature)
    expect(kept).toEqual([far])
  })

  it("carveLevelBlocks не трогает блоки другого существа (дуэт)", () => {
    // Регресс «невидимой медузы»: даже если второе существо налегает на первое,
    // вырезаются только ОБЫЧНЫЕ блоки уровня, чужой силуэт остаётся целым.
    const fish = buildFish(W, H, TOP) // центр по умолчанию — та же точка, где родится медуза
    const jelly = buildJelly(W, H, TOP)
    expect(carveLevelBlocks(fish, jelly)).toEqual(fish)
    expect(carveLevelBlocks(jelly, fish)).toEqual(jelly)
  })

  it("дуэт со сдвигом MINIBOSS_DUET_SHIFT не налегает на первое существо", () => {
    const fish = buildFish(W, H, TOP)
    const jelly = buildJelly(W, H, TOP, 0, W / 2 + W * MINIBOSS_DUET_SHIFT)
    // ни один блок медузы не пересекается с блоками рыбы (с запасом carve-а)
    const pad = 6
    for (const c of jelly) {
      for (const f of fish) {
        const dx = c.x - f.x
        const dy = c.y - f.y
        const rr = Math.max(f.rx, f.ry) + c.rx + pad
        expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(rr * rr)
      }
    }
  })

  it("buildFish/buildJelly принимают кастомный центр (дуэт)", () => {
    const fish = buildFish(W, H, TOP, 0, W / 2 + W * MINIBOSS_DUET_SHIFT)
    const body = fish.filter((b) => b.mbPart === "body")
    const cx = body.reduce((s, b) => s + b.x, 0) / body.length
    expect(cx).toBeCloseTo(W / 2 + W * MINIBOSS_DUET_SHIFT)
    const jelly = buildJelly(W, H, TOP, 0, W * 0.3)
    const dome = jelly.filter((b) => b.mbPart === "dome")
    expect(dome[0].x).toBeCloseTo(W * 0.3)
  })

  it("имена существ заданы", () => {
    expect(minibossName("fish")).toBe("РЫБА-ШАР")
    expect(minibossName("jelly")).toBe("МЕДУЗА")
  })
})
