import { describe, expect, it } from "vitest"

import { pickBossVariant } from "./bossVariants"

describe("pickBossVariant", () => {
  it("детерминирован: тот же сид — тот же босс", () => {
    const a = pickBossVariant(12345, 3)
    const b = pickBossVariant(12345, 3)
    expect(a).toEqual(b)
  })

  it("на низких ярусах не бывает кракена и медузы", () => {
    for (let seed = 0; seed < 200; seed++) {
      const kind = pickBossVariant(seed, 0).kind
      expect(kind).not.toBe("kraken")
      expect(kind).not.toBe("jellyfish")
    }
  })

  it("медуза открывается только с 3-го яруса боссов", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(pickBossVariant(seed, 1).kind).not.toBe("jellyfish")
    }
    const kinds = new Set<string>()
    for (let seed = 0; seed < 200; seed++) kinds.add(pickBossVariant(seed, 2).kind)
    expect(kinds.has("jellyfish")).toBe(true)
  })

  it("на высоких ярусах встречаются все виды", () => {
    const kinds = new Set<string>()
    for (let seed = 0; seed < 200; seed++) kinds.add(pickBossVariant(seed, 3).kind)
    expect(kinds).toEqual(new Set(["king", "octopus", "kraken", "jellyfish"]))
  })

  it("король получает миньонов, щупальцевые — щупальца; бомбы не у медузы", () => {
    for (let seed = 0; seed < 200; seed++) {
      const v = pickBossVariant(seed, 2)
      if (v.kind === "king") {
        expect(v.minions).toBeGreaterThan(0)
        expect(v.tentacles).toBe(0)
        expect(v.bombEvery).toBe(0)
      } else if (v.kind === "jellyfish") {
        // медуза вместо бомб бьёт молниями из отростков
        expect(v.tentacles).toBeGreaterThan(0)
        expect(v.bombEvery).toBe(0)
        expect(v.minions).toBe(0)
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
