import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { getDailyRunInfo } from "../../game/daily"
import type { DailyQuestState } from "../../game/dailyQuests"

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

  describe("задания дня (T-059)", () => {
    const quests: DailyQuestState[] = [
      {
        def: {
          kind: "break_blocks",
          icon: "🧱",
          title: "Зачистка поля",
          goal: "разбить блоков",
          target: 80,
          rewardMeta: 1,
        },
        progress: 80,
        claimed: false,
      },
      {
        def: {
          kind: "boss_kills",
          icon: "👑",
          title: "Казнь босса",
          goal: "одолеть босса",
          target: 1,
          rewardMeta: 3,
        },
        progress: 0,
        claimed: false,
      },
    ]

    it("показывает список заданий и кнопку выдачи при готовом задании", () => {
      const html = renderToStaticMarkup(
        <DailyRunModal
          dailyInfo={dailyInfo}
          onStart={() => {}}
          onClose={() => {}}
          onClaimQuests={() => {}}
          quests={quests}
        />
      )
      expect(html).toContain("ЗАДАНИЯ ДНЯ")
      expect(html).toContain("Зачистка поля")
      expect(html).toContain("80/80")
      expect(html).toContain("0/1")
      // Сумма только за выполненное задание
      expect(html).toContain("Забрать 💎 1")
    })

    it("не показывает кнопку выдачи, если ничего не выполнено", () => {
      const html = renderToStaticMarkup(
        <DailyRunModal
          dailyInfo={dailyInfo}
          onStart={() => {}}
          onClose={() => {}}
          onClaimQuests={() => {}}
          quests={[{ ...quests[1]! }]}
        />
      )
      expect(html).not.toContain("Забрать")
    })
  })
})
