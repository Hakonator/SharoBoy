import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { CampaignModifiersModal } from "./CampaignModifiersModal"

describe("CampaignModifiersModal Component", () => {
  it("рендерит список модификаторов и кнопки запуска", () => {
    const onStart = vi.fn()
    const onClose = vi.fn()

    const html = renderToStaticMarkup(
      <CampaignModifiersModal onStart={onStart} onClose={onClose} />
    )

    expect(html).toContain("МОДИФИКАТОРЫ КАМПАНИИ")
    expect(html).toContain("Железная воля")
    expect(html).toContain("Гравитационный шторм")
    expect(html).toContain("Гипер-разгон")
    expect(html).toContain("Титановые ряды")
    expect(html).toContain("Хрупкая платформа")
    expect(html).toContain("Инверсия руля")
    expect(html).toContain("В БОЙ!")
    expect(html).toContain("БЕЗ МУТАТОРОВ")
  })
})
