import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { PlayerMapSpec } from "../../game/mapSpec"

import { EditorInspector } from "./EditorInspector"
import { createEditorState, editorReducer } from "./editorState"

function makeTestMap(): PlayerMapSpec {
  return {
    version: 1,
    id: "test-map",
    metadata: { title: "Тестовая карта", description: "Описание", author: "Тестер" },
    blocks: [
      {
        id: "b1",
        position: { x: 300, y: 300 },
        shape: "rect",
        size: { width: 64, height: 40 },
        hp: 3,
        effects: [{ kind: "armor", amount: 2 }],
      },
      {
        id: "b2",
        position: { x: 400, y: 300 },
        shape: "circle",
        size: { width: 40, height: 40 },
        hp: 3,
        effects: [{ kind: "spring", speedMultiplier: 1.5, duration: 2 }],
      },
      {
        id: "b3",
        position: { x: 500, y: 300 },
        shape: "round_rect",
        size: { width: 80, height: 50 },
        hp: 1,
      },
    ],
    winCondition: { kind: "all-destructible" },
  }
}

describe("EditorInspector", () => {
  it("renders map properties when no block is selected", () => {
    const state = createEditorState(makeTestMap())
    const html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).toContain("Свойства карты")
    expect(html).toContain("Тестовая карта")
    expect(html).toContain("Все разрушаемые блоки")
  })

  it("renders single block properties when one block is selected", () => {
    let state = createEditorState(makeTestMap())
    state = editorReducer(state, { type: "SELECT_BLOCK", blockId: "b1" })
    const html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).toContain("Свойства блока")
    expect(html).toContain("HP 3")
    expect(html).toContain("Прямоугольник")
    expect(html).toContain("Зазор протяжки блока")
    expect(html).toContain("Броня")
    expect(html).toContain("Очки брони")
  })

  it("renders mass editing interface when multiple blocks are selected", () => {
    let state = createEditorState(makeTestMap())
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["b1", "b2", "b3"] })
    const html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).toContain("Множественный выбор")
    expect(html).toContain("3 бл.")
    expect(html).toContain("Копирование протяжкой")
    expect(html).toContain("маркер <strong>«+»</strong> в правом нижнем углу")
    expect(html).toContain("Зазор протяжки группы")
    expect(html).toContain("Здоровье (HP)")
    expect(html).toContain("Форма (для всех)")
    expect(html).toContain("Массовые эффекты")
    expect(html).toContain("Ширина")
    expect(html).toContain("Высота")
    expect(html).toContain("Поворот (°)")
    expect(html).toContain("+90°")
    expect(html).toContain("-90°")
    expect(html).toContain("180°")
    expect(html).toContain("Симметрия и отражение")
    expect(html).toContain("Выравнивание и шаг")
    expect(html).toContain("Генератор и градиенты")
    expect(html).toContain("Умное выделение")
    expect(html).toContain("Зеркальный клон")
  })

  it("indicates effect coverage across selected blocks and displays mutual exclusions", () => {
    let state = createEditorState(makeTestMap())
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["b1", "b2", "b3"] })
    const html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    // Armor is present on b1 (1 of 3)
    expect(html).toContain("~ 1/3")
    // Spring is present on b2, shows mutual notice
    expect(html).toContain("Взаимоисключение: автоматически снимает «Вату»")
  })

  it("handles portal validation: prompts when not 2 blocks, allows linking when exactly 2", () => {
    let state = createEditorState(makeTestMap())
    // 3 blocks selected -> portal pairing blocked with explanation
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["b1", "b2", "b3"] })
    let html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).toContain("Требуется 2 блока (сейчас: 3)")
    expect(html).toContain("Порталы на карте обязаны быть строго парными")

    // Exactly 2 blocks selected -> allows linking
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["b1", "b2"] })
    html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).toContain("Выбрано ровно 2 блока")
    expect(html).toContain("Связать в пару порталов")
  })

  it("renders the targets picker with unchecked checkboxes in targets mode", () => {
    const map = makeTestMap()
    map.winCondition = { kind: "targets", targetIds: [] }
    const state = createEditorState(map)
    const html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).toContain("🎯 Цели")
    expect(html).toContain("0 / 3")
    expect(html).toContain("Все блоки")
    expect(html).toContain("Снять все")
    expect(html).toContain('type="checkbox"')
    expect((html.match(/checked=""/g) ?? []).length).toBe(0)
    expect(html).toContain("Ни одна цель не выбрана")
  })

  it("reflects the selected targets and group toggle in the picker", () => {
    const map = makeTestMap()
    map.winCondition = { kind: "targets", targetIds: ["b1"] }
    let state = createEditorState(map)
    state = editorReducer(state, { type: "SELECT_BLOCKS", blockIds: ["b1", "b2"] })
    const html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).toContain("1 / 3")
    expect(html).toContain("Отметить выделение (2)")
    expect((html.match(/checked=""/g) ?? []).length).toBe(1)
    expect(html).not.toContain("Ни одна цель не выбрана")
  })

  it("hides the targets picker when all destructible blocks are the goal", () => {
    const state = createEditorState(makeTestMap())
    const html = renderToStaticMarkup(
      <EditorInspector author="Игрок" dispatch={() => {}} state={state} />
    )
    expect(html).not.toContain("🎯 Цели")
  })
})
