import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ControlsPanel, IconTerminal } from "./icons"

/** Текст без тегов — чтобы проверять формулировки, а не разметку. */
const plain = (touch: boolean) =>
  renderToStaticMarkup(<ControlsPanel touch={touch} />)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")

describe("ControlsPanel: справка по управлению под способ ввода", () => {
  it("на смартфоне описывает только жесты пальцем", () => {
    const text = plain(true)

    expect(text).toContain("пальцем")
    expect(text).toContain("Отпусти палец")
    expect(text).toContain("наклон")
    expect(text).toContain("2 ПАЛЬЦА")

    // Клавиатурных и мышиных подсказок на тач-устройстве быть не должно.
    expect(text).not.toContain("ПРОБЕЛ")
    expect(text).not.toContain("A")
    expect(text).not.toContain("ESC")
    expect(text).not.toContain("ЛКМ")
    expect(text).not.toContain("КОЛЕСО")
  })

  it("на десктопе описывает только мышь и клавиатуру", () => {
    const text = plain(false)

    expect(text).toContain("ЛКМ")
    expect(text).toContain("ПРОБЕЛ")
    expect(text).toContain("A")
    expect(text).toContain("ESC")
    expect(text).toContain("КОЛЕСО")

    // Тач-жестов на десктопе нет.
    expect(text).not.toContain("пальцем")
    expect(text).not.toContain("2 ПАЛЬЦА")
  })

  it("рендерит IconTerminal с SVG и атрибутами доступности", () => {
    const html = renderToStaticMarkup(<IconTerminal className="h-5 w-5" />)
    expect(html).toContain("<svg")
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('class="h-5 w-5"')
  })
})
