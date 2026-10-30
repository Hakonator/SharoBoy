import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { PlayerMapSpec } from "../../game/mapSpec"

import { EditorPrefabsModal } from "./EditorPrefabsModal"
import { createEditorState } from "./editorState"

function makeTestMap(): PlayerMapSpec {
  return {
    version: 1,
    id: "test",
    metadata: { title: "Test" },
    blocks: [
      {
        id: "b1",
        position: { x: 200, y: 200 },
        shape: "circle",
        size: { width: 40, height: 40 },
        hp: 1,
      },
    ],
    winCondition: { kind: "all-destructible" },
  }
}

describe("EditorPrefabsModal", () => {
  it("renders catalog modal with built-in prefabs", () => {
    const state = createEditorState(makeTestMap())
    const html = renderToStaticMarkup(
      <EditorPrefabsModal dispatch={() => {}} onClose={() => {}} state={state} />
    )
    expect(html).toContain("Библиотека шаблонов (Префабы)")
    expect(html).toContain("Щит Стража")
    expect(html).toContain("Звезда / Шестерёнка")
    expect(html).toContain("Квантовая Портал-Арка")
    expect(html).toContain("Вставить на карту")
  })

  it("shows save selection prompt when blocks are selected", () => {
    const state = createEditorState(makeTestMap())
    state.selectedBlockIds = ["b1"]
    const html = renderToStaticMarkup(
      <EditorPrefabsModal dispatch={() => {}} onClose={() => {}} state={state} />
    )
    expect(html).toContain("Сохранить выделение (1 бл.) как новый шаблон")
  })
})
