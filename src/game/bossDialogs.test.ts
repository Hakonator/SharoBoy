import { describe, expect, it } from "vitest"

import { BOSS_DIALOGS, getBossDialog, getFinalEpilogue } from "./bossDialogs"
import type { BossVariantKind } from "./bossVariants"

describe("bossDialogs", () => {
  const allBossKinds: BossVariantKind[] = [
    "king",
    "jellyfish",
    "octopus",
    "crab",
    "kraken",
    "chrono",
  ]

  it("содержит диалоги и протоколы для всех 6 типов боссов", () => {
    for (const kind of allBossKinds) {
      const dialog = BOSS_DIALOGS[kind]
      expect(dialog).toBeDefined()
      expect(dialog.kind).toBe(kind)
      expect(dialog.name.trim().length).toBeGreaterThan(0)
      expect(dialog.protocol.trim().length).toBeGreaterThan(0)
      expect(dialog.introLine.trim().length).toBeGreaterThan(0)
      expect(dialog.defeatLine.trim().length).toBeGreaterThan(0)
      expect(dialog.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(dialog.callsign.trim().length).toBeGreaterThan(0)
    }
  })

  it("getBossDialog возвращает правильный диалог или fallback", () => {
    expect(getBossDialog("chrono").name).toBe("ПОВЕЛИТЕЛЬ ВРЕМЕНИ")
    expect(getBossDialog("kraken").name).toBe("КРАКЕН БЕЗДНЫ")
    // @ts-expect-error Проверка fallback на неизвестный тип
    expect(getBossDialog("unknown_boss").kind).toBe("king")
  })

  describe("getFinalEpilogue", () => {
    it("возвращает Концовку Б при победе над Хроносом", () => {
      const epilogue = getFinalEpilogue("chrono")
      expect(epilogue.title).toContain("КОНЦОВКА Б")
      expect(epilogue.subtitle).toContain("СФЕРА-1080")
      expect(epilogue.text).toContain("Стрелки")
      expect(epilogue.stationStatus).toContain("ВРЕМЯ ВОССТАНОВЛЕНО")
    })

    it("возвращает Концовку А при победе над Кракеном или по умолчанию", () => {
      const epilogueKraken = getFinalEpilogue("kraken")
      expect(epilogueKraken.title).toContain("КОНЦОВКА А")
      expect(epilogueKraken.subtitle).toContain("СФЕРА-1080")
      expect(epilogueKraken.text).toContain("Пространственный разлом")
      expect(epilogueKraken.stationStatus).toContain("СТАЗИС СНЯТ")

      const epilogueDefault = getFinalEpilogue(null)
      expect(epilogueDefault.title).toContain("КОНЦОВКА А")
    })
  })
})
