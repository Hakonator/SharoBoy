import { describe, expect, it } from "vitest"

import type { CampaignModifierId } from "./campaignModifiers"
import {
  DRAFT_EXCLUDED_IDS,
  DRAFT_MAX_PICKS,
  DRAFT_MODIFIER_IDS,
  DRAFT_WAVE_INTERVAL,
  applyDraftPick,
  draftPicksLeft,
  isDraftWave,
  rollDraftOptions,
} from "./endlessDraft"

describe("endlessDraft: пул и волна", () => {
  it("черновик открывается только после боссовых волн 5, 10, 15…", () => {
    expect(isDraftWave(0)).toBe(false)
    expect(isDraftWave(1)).toBe(false)
    expect(isDraftWave(4)).toBe(false)
    expect(isDraftWave(5)).toBe(true)
    expect(isDraftWave(10)).toBe(true)
    expect(isDraftWave(15)).toBe(true)
    expect(isDraftWave(DRAFT_WAVE_INTERVAL)).toBe(true)
    expect(isDraftWave(6)).toBe(false)
    expect(isDraftWave(Number.NaN)).toBe(false)
  })

  it("пул драфта исключает ironman и inverted_controls", () => {
    for (const id of DRAFT_EXCLUDED_IDS) expect(DRAFT_MODIFIER_IDS).not.toContain(id)
    expect(DRAFT_MODIFIER_IDS).toContain("no_powers")
    expect(DRAFT_MODIFIER_IDS).toContain("boss_fury")
    // Пул должен покрывать все три слота драфта с запасом.
    expect(DRAFT_MODIFIER_IDS.length).toBeGreaterThan(DRAFT_MAX_PICKS)
  })
})

describe("endlessDraft: rollDraftOptions", () => {
  it("возвращает ровно 3 разных мутатора из пула", () => {
    const options = rollDraftOptions(20261101, 5)
    expect(options).toHaveLength(DRAFT_MAX_PICKS)
    expect(new Set(options).size).toBe(DRAFT_MAX_PICKS)
    for (const id of options) expect(DRAFT_MODIFIER_IDS).toContain(id)
  })

  it("детерминирован: тот же сид и волна дают тот же набор", () => {
    const a = rollDraftOptions(20261101, 5)
    const b = rollDraftOptions(20261101, 5)
    expect(b).toEqual(a)
  })

  it("смена волны или сида меняет набор хотя бы иногда", () => {
    const base = rollDraftOptions(20261101, 5)
    const otherWave = rollDraftOptions(20261101, 10)
    expect(otherWave).not.toEqual(base)
    const variants = new Set(
      [20261101, 20261102, 20261103, 20261104, 20261105].map((seed) =>
        rollDraftOptions(seed, 5).join(",")
      )
    )
    expect(variants.size).toBeGreaterThan(1)
  })

  it("уже взятые мутаторы не предлагаются", () => {
    const first = rollDraftOptions(20261101, 5)
    const taken = [first[0]!]
    const second = rollDraftOptions(20261101, 10, taken)
    expect(second).not.toContain(taken[0])
    expect(second.length).toBeGreaterThan(0)
  })

  it("при исчерпанном пуле возвращает остаток, не повторяя взятое", () => {
    const almostAll = DRAFT_MODIFIER_IDS.slice(0, DRAFT_MODIFIER_IDS.length - 1)
    const options = rollDraftOptions(777, 5, almostAll)
    expect(options).toEqual([DRAFT_MODIFIER_IDS[DRAFT_MODIFIER_IDS.length - 1]!])

    const full = rollDraftOptions(777, 5, DRAFT_MODIFIER_IDS)
    expect(full).toEqual([])
  })
})

describe("endlessDraft: applyDraftPick", () => {
  const pickA: CampaignModifierId = "no_powers"
  const pickB: CampaignModifierId = "boss_fury"
  const pickC: CampaignModifierId = "dense_armor"
  const pickD: CampaignModifierId = "low_bounce"

  it("добавляет мутатор и не мутирует исходный массив", () => {
    const taken: CampaignModifierId[] = []
    const after = applyDraftPick(taken, pickA)
    expect(after).toEqual([pickA])
    expect(taken).toEqual([])
  })

  it("не предлагает взять один и тот же мутатор дважды", () => {
    const after = applyDraftPick([pickA], pickA)
    expect(after).toEqual([pickA])
  })

  it("не даёт взять больше DRAFT_MAX_PICKS за забег", () => {
    let taken: CampaignModifierId[] = []
    taken = applyDraftPick(taken, pickA)
    taken = applyDraftPick(taken, pickB)
    taken = applyDraftPick(taken, pickC)
    expect(taken).toHaveLength(DRAFT_MAX_PICKS)
    expect(draftPicksLeft(taken)).toBe(0)
    expect(applyDraftPick(taken, pickD)).toEqual(taken)
  })

  it("пропуск (null / undefined) оставляет список без изменений", () => {
    expect(applyDraftPick([pickA], null)).toEqual([pickA])
    expect(applyDraftPick([pickA], undefined)).toEqual([pickA])
  })

  it("исключённый из драфта мутатор не принимается", () => {
    expect(applyDraftPick([], "ironman")).toEqual([])
    expect(applyDraftPick([], "inverted_controls")).toEqual([])
  })

  it("draftPicksLeft считает остаток и не уходит в минус", () => {
    expect(draftPicksLeft([])).toBe(DRAFT_MAX_PICKS)
    expect(draftPicksLeft([pickA])).toBe(DRAFT_MAX_PICKS - 1)
    expect(draftPicksLeft([pickA, pickB, pickC, pickD])).toBe(0)
  })
})
