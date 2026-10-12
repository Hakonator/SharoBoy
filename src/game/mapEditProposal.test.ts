import { describe, expect, it } from "vitest"

import type { PlayerMapSpec } from "./mapSpec"
import { formatEditProposal, parseEditProposal } from "./mapEditProposal"

const sampleSpec: PlayerMapSpec = {
  version: 1,
  id: "proposal-test",
  metadata: { title: "Изменённая карта" },
  blocks: [
    {
      id: "b1",
      position: { x: 500, y: 500 },
      shape: "circle",
      size: { width: 50, height: 50 },
      hp: 2,
    },
  ],
  winCondition: { kind: "all-destructible" },
}

describe("mapEditProposal", () => {
  it("formats and parses structured edit proposals", () => {
    const formatted = formatEditProposal({
      comment: "Исправил баг с физикой",
      spec: sampleSpec,
      title: "Новое название",
      description: "Новое описание",
    })
    const parsed = parseEditProposal(formatted)
    expect(parsed.isStructured).toBe(true)
    expect(parsed.comment).toBe("Исправил баг с физикой")
    expect(parsed.spec?.id).toBe("proposal-test")
    expect(parsed.title).toBe("Новое название")
    expect(parsed.description).toBe("Новое описание")
  })

  it("handles legacy plain text reasons gracefully", () => {
    const parsed = parseEditProposal("Простой текстовый комментарий", sampleSpec)
    expect(parsed.isStructured).toBe(false)
    expect(parsed.comment).toBe("Простой текстовый комментарий")
    expect(parsed.spec).toBe(sampleSpec)
    expect(parsed.title).toBeNull()
  })

  it("handles null or undefined reason", () => {
    const parsed = parseEditProposal(null)
    expect(parsed.isStructured).toBe(false)
    expect(parsed.comment).toBe("")
    expect(parsed.spec).toBeNull()
  })
})
