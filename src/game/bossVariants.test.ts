import { describe, expect, it } from "vitest"

import { pickBossVariant } from "./bossVariants"

describe("pickBossVariant", () => {
  it("детерминирован: тот же сид — тот же босс", () => {
    const a = pickBossVariant(12345, 3)
    const b = pickBossVariant(12345, 3)
    expect(a).toEqual(b)
  })

  it("на низких ярусах не бывает кракена", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(pickBossVariant(seed, 0).kind).not.toBe("kraken")
    }
  })

  it("на высоких ярусах встречаются все виды", () => {
    const kinds = new Set<string>()
    for (let seed = 0; seed < 200; seed++) kinds.add(pickBossVariant(seed, 3).kind)
    expect(kinds).toEqual(new Set(["king", "octopus", "kraken"]))
  })

  it("король получает миньонов, щупальцевые — щупальца и бомбы", () => {
    for (let seed = 0; seed < 200; seed++) {
      const v = pickBossVariant(seed, 2)
      if (v.kind === "king") {
        expect(v.minions).toBeGreaterThan(0)
        expect(v.tentacles).toBe(0)
        expect(v.bombEvery).toBe(0)
      } else {
        expect(v.tentacles).toBeGreaterThan(0)
        expect(v.bombEvery).toBeGreaterThan(0)
        expect(v.minions).toBe(0)
      }
    }
  })

  it("HP растёт с ярусом", () => {
    expect(pickBossVariant(7, 3).hp).toBeGreaterThan(pickBossVariant(7, 0).hp)
  })
})
