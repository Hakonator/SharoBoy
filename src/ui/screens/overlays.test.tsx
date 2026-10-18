import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { HudData } from "../../game/types"

import { WinScreen } from "./overlays"

const makeWinHud = (
  mode: HudData["mode"],
  finalBossDefeated?: HudData["finalBossDefeated"]
): HudData =>
  ({
    phase: "won",
    mode,
    finalBossDefeated,
    score: 12500,
    best: 15000,
    coins: 45,
    newRecord: false,
  }) as unknown as HudData

describe("WinScreen", () => {
  it("рендерит космический эпилог станции «СФЕРА-1080» для режима кампании", () => {
    const hud = makeWinHud("campaign", "chrono")
    const html = renderToStaticMarkup(
      <WinScreen
        hud={hud}
        topSubmit={<div>[TOP_SUBMIT]</div>}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(html).toContain("КОНЦОВКА Б: РАЗРЫВ ВРЕМЕННОЙ ПЕТЛИ")
    expect(html).toContain("СФЕРА-1080")
    expect(html).toContain("ВРЕМЯ ВОССТАНОВЛЕНО")
    expect(html).toContain("+150 💠")
    expect(html).toContain("МЕТА-КРИСТАЛЛОВ")
    expect(html).toContain(hud.score.toLocaleString("ru-RU"))
  })

  it("рендерит классический экран победы для остальных режимов", () => {
    const hud = makeWinHud("endless")
    const html = renderToStaticMarkup(
      <WinScreen
        hud={hud}
        topSubmit={<div>[TOP_SUBMIT]</div>}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(html).toContain("ПОБЕДА!")
    expect(html).toContain("Все шары лопнули")
    expect(html).not.toContain("СФЕРА-1080")
  })
})
