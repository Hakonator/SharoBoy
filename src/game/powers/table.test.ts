import { describe, expect, it } from "vitest"

import type { PowerType } from "../types"

import { buildPowerTable } from "./table"

const base = { boss: false, campaign: false, fewBlocks: false, spedUp: false }

function types(o: Partial<typeof base>): PowerType[] {
  return buildPowerTable({ ...base, ...o }).map(([t]) => t)
}

function weight(o: Partial<typeof base>, t: PowerType): number {
  return buildPowerTable({ ...base, ...o }).find(([k]) => k === t)?.[1] ?? 0
}

describe("buildPowerTable", () => {
  it("без разгона шара «замедление» в таблице отсутствует", () => {
    expect(types({})).not.toContain("slow")
  })

  it("при разгоне шара появляется «замедление»", () => {
    expect(types({ spedUp: true })).toContain("slow")
  })

  it("в кампании «жизнь» не выпадает из общих дропов", () => {
    expect(types({ campaign: true })).not.toContain("life")
    expect(types({})).toContain("life")
  })

  it("в бою с боссом лазер и ракеты исключены", () => {
    const t = types({ boss: true })
    expect(t).not.toContain("laser")
    expect(t).not.toContain("rocket")
    expect(t).toContain("shield")
  })

  it("при малом числе блоков «чистящие» бонусы усилены", () => {
    expect(weight({ fewBlocks: true }, "laser")).toBeGreaterThan(weight({}, "laser"))
    expect(weight({ fewBlocks: true }, "rocket")).toBeGreaterThan(weight({}, "rocket"))
  })

  it("«замедление» сочетается с остальными фильтрами", () => {
    const t = types({ spedUp: true, boss: true, campaign: true })
    expect(t).toContain("slow")
    expect(t).not.toContain("life")
    expect(t).not.toContain("laser")
  })
})
