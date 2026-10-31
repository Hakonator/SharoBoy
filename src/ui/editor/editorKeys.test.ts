import { describe, expect, it } from "vitest"

import type { PlayerMapSpec } from "../../game/mapSpec"

import { resolveEditorKey, type EditorKeyInput } from "./editorKeys"

const targets: PlayerMapSpec["winCondition"] = { kind: "targets", targetIds: ["b-1"] }
const allDestructible: PlayerMapSpec["winCondition"] = { kind: "all-destructible" }

function input(overrides: Partial<EditorKeyInput> = {}): EditorKeyInput {
  return {
    key: "space",
    winCondition: allDestructible,
    selectedBlockIds: [],
    interactiveTarget: false,
    repeat: false,
    ...overrides,
  }
}

describe("resolveEditorKey (клавиши редактора карт)", () => {
  it("перехватывает пробел вне режима целей — регресс: Space запускал кампанию", () => {
    const decision = resolveEditorKey(input({ selectedBlockIds: ["b-1", "b-2"] }))
    expect(decision.preventDefault).toBe(true)
    expect(decision.toggleTargetIds).toBeNull()
  })

  it("перехватывает пробел в режиме целей без выделения", () => {
    const decision = resolveEditorKey(input({ winCondition: targets }))
    expect(decision.preventDefault).toBe(true)
    expect(decision.toggleTargetIds).toBeNull()
  })

  it("переключает цели выделенной группы в режиме «Целевые блоки»", () => {
    const decision = resolveEditorKey(
      input({ winCondition: targets, selectedBlockIds: ["b-1", "b-3"] })
    )
    expect(decision.preventDefault).toBe(true)
    expect(decision.toggleTargetIds).toEqual(["b-1", "b-3"])
  })

  it("не отменяет активацию кнопки, но всё равно глушит всплытие", () => {
    const decision = resolveEditorKey(
      input({ winCondition: targets, selectedBlockIds: ["b-1"], interactiveTarget: true })
    )
    expect(decision.preventDefault).toBe(false)
    expect(decision.toggleTargetIds).toBeNull()
  })

  it("игнорирует автоповтор удержанного пробела", () => {
    const decision = resolveEditorKey(
      input({ winCondition: targets, selectedBlockIds: ["b-1"], repeat: true })
    )
    expect(decision.preventDefault).toBe(true)
    expect(decision.toggleTargetIds).toBeNull()
  })

  it("перехватывает Enter, не отменяя активацию кнопок", () => {
    expect(resolveEditorKey(input({ key: "enter" }))).toEqual({
      preventDefault: true,
      toggleTargetIds: null,
    })
    expect(resolveEditorKey(input({ key: "enter", interactiveTarget: true }))).toEqual({
      preventDefault: false,
      toggleTargetIds: null,
    })
  })

  it("глушит клавиши музыки и паузы, не мешая браузеру", () => {
    for (const key of ["mute", "music", "pause"] as const) {
      expect(resolveEditorKey(input({ key }))).toEqual({
        preventDefault: false,
        toggleTargetIds: null,
      })
    }
  })
})
