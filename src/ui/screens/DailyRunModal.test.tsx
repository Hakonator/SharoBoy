import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { getDailyRunInfo } from "../../game/daily"

import { DailyRunModal } from "./DailyRunModal"

describe("DailyRunModal Component (T-041)", () => {
  const dummyDate = new Date(Date.UTC(2026, 9, 30, 12, 0, 0))
  const dailyInfo = getDailyRunInfo(dummyDate)

  it("рендерит заголовок, дату, мутаторы и кнопку старта", () => {
    const html = renderToStaticMarkup(
      <DailyRunModal
        dailyInfo={dailyInfo}
        topDaily={[
          { nick: "Командир", score: 15000, wave: 0 },
          { nick: "Пилот", score: 12000, wave: 0 },
        ]}
        onStart={() => {}}
        onClose={() => {}}
      />
    )

    expect(html).toContain("ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ")
    expect(html).toContain("30.10.2026")
    expect(html).toContain("ФИКСИРОВАННЫЕ МУТАТОРЫ ДНЯ")
    expect(html).toContain("НАЧАТЬ ИСПЫТАНИЕ")
    expect(html).toContain("Командир")
    expect(html).toContain("15 000")
  })

  it("корректно отображает сообщение при пустом топе дня", () => {
    const html = renderToStaticMarkup(
      <DailyRunModal dailyInfo={dailyInfo} topDaily={[]} onStart={() => {}} onClose={() => {}} />
    )

    expect(html).toContain("Пока никто не завершил испытание сегодня")
  })
})
