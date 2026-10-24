import { describe, expect, it } from "vitest"

import {
  BOSS_REWARD_MULT_MAX,
  bossPhases,
  bossPhasesFor,
  fixedVariant,
  pickBossVariant,
} from "./bossVariants"

describe("pickBossVariant", () => {
  it("детерминирован: тот же сид — тот же босс", () => {
    const a = pickBossVariant(12345, 2)
    const b = pickBossVariant(12345, 2)
    expect(a).toEqual(b)
  })

  it("в Акте 1 встречаются Царь-шар, Грозовая Медуза и Крио-Дрон", () => {
    for (let seed = 0; seed < 200; seed++) {
      const kind = pickBossVariant(seed, 0).kind
      expect(["king", "jellyfish", "cryo"]).toContain(kind)
    }
    const kinds = new Set<string>()
    for (let seed = 0; seed < 60; seed++) kinds.add(pickBossVariant(seed, 0).kind)
    expect(kinds).toEqual(new Set(["king", "jellyfish", "cryo"]))
  })

  it("в Акте 2 встречаются Осьминог, Меха-Краб и Электрическая Минога", () => {
    for (let seed = 0; seed < 200; seed++) {
      const kind = pickBossVariant(seed, 1).kind
      expect(["octopus", "crab", "lamprey"]).toContain(kind)
    }
    const kinds = new Set<string>()
    for (let seed = 0; seed < 60; seed++) kinds.add(pickBossVariant(seed, 1).kind)
    expect(kinds).toEqual(new Set(["octopus", "crab", "lamprey"]))
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
        } else if (v.kind === "cryo" || v.kind === "lamprey") {
          // новые боссы не бросают бомб и не имеют щупалец: у крио-дрона лёд,
          // у миноги — разряды из головы
          expect(v.minions).toBe(0)
          expect(v.tentacles).toBe(0)
          expect(v.bombEvery).toBe(0)
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

describe("углублённые фазы боссов", () => {
  it("фазы включаются на финальном Акте, при мутаторах и высоком ранге", () => {
    expect(bossPhasesFor(0)).toBe(1)
    expect(bossPhasesFor(2)).toBe(2)
    expect(bossPhasesFor(0, { modifiers: ["ironman"] })).toBe(1)
    expect(bossPhasesFor(0, { modifiers: ["ironman", "hyper_speed"] })).toBe(2)
    expect(bossPhasesFor(0, { difficultyRank: 2 })).toBe(2)
  })

  it("вторая фаза делает босса крепче, порог агрессии раньше, награду выше", () => {
    const single = fixedVariant("crab", 0)
    const deep = fixedVariant("crab", 0, { phases: 2 })
    expect(single.phases).toBe(1)
    expect(deep.phases).toBe(2)
    expect(deep.hp).toBeGreaterThan(single.hp)
    expect(deep.angryAt).toBeGreaterThan(single.angryAt)
    expect(deep.rewardMult).toBeGreaterThan(single.rewardMult)
    expect(deep.rewardMult).toBeLessThanOrEqual(BOSS_REWARD_MULT_MAX)
  })

  it("bossPhases отдаёт промежуточную фазу и её параметры", () => {
    const single = bossPhases(fixedVariant("king", 0))
    expect(single.count).toBe(1)
    expect(single.midMix).toBe(0)

    const deep = bossPhases(fixedVariant("king", 0, { phases: 2 }))
    expect(deep.count).toBe(2)
    expect(deep.midAt).toBeGreaterThan(deep.angryAt)
    expect(deep.midMix).toBeGreaterThan(0)
  })

  it("pickBossVariant прокидывает число фаз", () => {
    const v = pickBossVariant(4242, 1, 2)
    expect(v.phases).toBe(2)
    expect(["octopus", "crab", "lamprey"]).toContain(v.kind)
  })
})

describe("fixedVariant", () => {
  it("возвращает корректные характеристики для всех 8 боссов", () => {
    const kinds = [
      "king",
      "jellyfish",
      "cryo",
      "octopus",
      "crab",
      "lamprey",
      "kraken",
      "chrono",
    ] as const
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
