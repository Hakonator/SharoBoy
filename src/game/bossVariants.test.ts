import { describe, expect, it } from "vitest"

import { fixedVariant, pickBossVariant } from "./bossVariants"

describe("pickBossVariant", () => {
  it("детерминирован: тот же сид — тот же босс", () => {
    const a = pickBossVariant(12345, 2)
    const b = pickBossVariant(12345, 2)
    expect(a).toEqual(b)
  })

  it("в Акте 1 встречаются только Царь-шар и Грозовая Медуза", () => {
    for (let seed = 0; seed < 200; seed++) {
      const kind = pickBossVariant(seed, 0).kind
      expect(["king", "jellyfish"]).toContain(kind)
    }
    const kinds = new Set<string>()
    for (let seed = 0; seed < 50; seed++) kinds.add(pickBossVariant(seed, 0).kind)
    expect(kinds).toEqual(new Set(["king", "jellyfish"]))
  })

  it("в Акте 2 встречаются только Осьминог и Меха-Краб", () => {
    for (let seed = 0; seed < 200; seed++) {
      const kind = pickBossVariant(seed, 1).kind
      expect(["octopus", "crab"]).toContain(kind)
    }
    const kinds = new Set<string>()
    for (let seed = 0; seed < 50; seed++) kinds.add(pickBossVariant(seed, 1).kind)
    expect(kinds).toEqual(new Set(["octopus", "crab"]))
  })

  it("в Акте 3 (Финале) встречаются только Кракен и Повелитель Времени", () => {
    for (let seed = 0; seed < 200; seed++) {
      const kind = pickBossVariant(seed, 2).kind
      expect(["kraken", "chrono"]).toContain(kind)
    }
    const kinds = new Set<string>()
    for (let seed = 0; seed < 50; seed++) kinds.add(pickBossVariant(seed, 2).kind)
    expect(kinds).toEqual(new Set(["kraken", "chrono"]))
  })

  it("миньоны, щупальца и бомбы соответствуют типам боссов", () => {
    for (let seed = 0; seed < 200; seed++) {
      for (let tier = 0; tier <= 2; tier++) {
        const v = pickBossVariant(seed, tier)
        if (v.kind === "king" || v.kind === "chrono") {
          expect(v.minions).toBeGreaterThan(0)
          expect(v.tentacles).toBe(0)
        } else if (v.kind === "crab") {
          expect(v.minions).toBe(0)
          expect(v.tentacles).toBe(0)
          expect(v.bombEvery).toBeGreaterThan(0)
        } else if (v.kind === "jellyfish") {
          // медуза вместо бомб бьёт молниями из отростков
          expect(v.tentacles).toBeGreaterThan(0)
          expect(v.bombEvery).toBe(0)
          expect(v.minions).toBe(0)
        } else {
          // осьминог и кракен
          expect(v.tentacles).toBeGreaterThan(0)
          expect(v.bombEvery).toBeGreaterThan(0)
          expect(v.minions).toBe(0)
        }
      }
    }
  })

  it("HP растёт с ярусом Акта", () => {
    expect(pickBossVariant(7, 2).hp).toBeGreaterThan(pickBossVariant(7, 0).hp)
  })
})

describe("fixedVariant", () => {
  it("возвращает корректные характеристики для всех 6 боссов", () => {
    const kinds = ["king", "jellyfish", "octopus", "crab", "kraken", "chrono"] as const
    for (const kind of kinds) {
      const v = fixedVariant(kind, 2)
      expect(v.kind).toBe(kind)
      expect(v.hp).toBeGreaterThan(30)
      if (kind === "crab") {
        expect(v.bombEvery).toBeGreaterThan(0)
        expect(v.minions).toBe(0)
        expect(v.tentacles).toBe(0)
      } else if (kind === "chrono") {
        expect(v.minions).toBeGreaterThan(0)
        expect(v.bombEvery).toBe(0)
        expect(v.tentacles).toBe(0)
      }
    }
  })
})
