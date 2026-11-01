import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { WaveDraftData } from "../../game/types"

import { WaveDraftModal } from "./WaveDraftModal"

const draftData: WaveDraftData = {
  wave: 5,
  options: ["no_powers", "boss_fury", "dense_armor"],
  taken: [],
  remainingPicks: 2,
}

describe("WaveDraftModal (T-056)", () => {
  it("рендерит заголовок волны, три карточки мутаторов и счётчик выборов", () => {
    const html = renderToStaticMarkup(<WaveDraftModal data={draftData} onPick={() => {}} />)

    expect(html).toContain("wave-draft-modal")
    expect(html).toContain("МУТАТОР ВОЛНЫ 5")
    expect(html).toContain("0/3")
    expect(html).toContain("wave-draft-option-no_powers")
    expect(html).toContain("wave-draft-option-boss_fury")
    expect(html).toContain("wave-draft-option-dense_armor")
    // Названия мутаторов из CAMPAIGN_MODIFIERS_MAP
    expect(html).toContain("Сухой закон")
    expect(html).toContain("Ярость бездны")
    expect(html).toContain("Титановые ряды")
    expect(html).toContain("Ещё выборов впереди: 2")
    expect(html).toContain("Пропустить")
  })

  it("показывает уже взятые мутаторы и последний выбор", () => {
    const html = renderToStaticMarkup(
      <WaveDraftModal
        data={{
          wave: 15,
          options: ["low_bounce", "heavy_gravity", "hyper_speed"],
          taken: ["no_powers", "boss_fury"],
          remainingPicks: 0,
        }}
        onPick={() => {}}
      />
    )

    expect(html).toContain("УЖЕ ВЗЯТО:")
    expect(html).toContain("Сухой закон")
    expect(html).toContain("Ярость бездны")
    expect(html).toContain("2/3")
    expect(html).toContain("Это последний выбор в забеге")
  })

  it("сообщает игроку, что очки и рекорды не меняются", () => {
    const html = renderToStaticMarkup(<WaveDraftModal data={draftData} onPick={() => {}} />)
    expect(html).toContain("Очки и рекорды бесконечного режима не меняются")
  })
})
