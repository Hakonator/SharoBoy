import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { _clearSettingsCache, resetSettings } from "../../game/settings"
import type { HudData } from "../../game/types"

import { SettingsModal } from "./SettingsModal"

function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
    clear: () => {
      map.clear()
    },
  }
}

const dummyHud: HudData = {
  phase: "menu",
  score: 0,
  best: 0,
  lives: 3,
  level: 1,
  levelCount: 4,
  levelName: "СТРЕЛА",
  mode: "campaign",
  wave: 0,
  combo: 0,
  blocksLeft: 0,
  muted: false,
  musicMuted: false,
  musicVolume: 0.8,
  sfxVolume: 0.7,
  newAchievements: [],
  banner: null,
  stuck: true,
  newRecord: false,
  shield: 0,
  wideOn: false,
  slowOn: false,
  fastOn: false,
  shrinkOn: false,
  laserOn: false,
  laserArmed: false,
  rocketOn: false,
  fireOn: false,
  frostOn: false,
  sparkOn: false,
  pierceOn: false,
  magnetOn: false,
  coins: 0,
  crystals: 0,
  upgrades: {},
  top: [],
  topEndless: [],
  map: null,
  campaignEvent: null,
}

describe("SettingsModal", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeStorage())
    _clearSettingsCache()
    resetSettings()
  })

  it("рендерит заголовок и основные настройки графики и звука", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        hud={dummyHud}
        onClose={vi.fn()}
        onMusicVolume={vi.fn()}
        onSfxVolume={vi.fn()}
        onToggleMusic={vi.fn()}
        onToggleMute={vi.fn()}
      />
    )

    expect(html).toContain("НАСТРОЙКИ")
    expect(html).toContain("Качество графики")
    expect(html).toContain("Тряска экрана")
    expect(html).toContain("Вспышки экрана")
    expect(html).toContain("Пространственное стерео")
    expect(html).toContain("Восходящий тон комбо")
    expect(html).toContain("Подводный фильтр в паузе")
    expect(html).toContain("Сбросить по умолчанию")
    expect(html).toContain("Готово")
  })

  it("содержит кнопки выбора пресетов качества и тряски", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        hud={dummyHud}
        onClose={vi.fn()}
        onMusicVolume={vi.fn()}
        onSfxVolume={vi.fn()}
        onToggleMusic={vi.fn()}
        onToggleMute={vi.fn()}
      />
    )

    expect(html).toContain("⚡ Эко")
    expect(html).toContain("✨ Высокое")
    expect(html).toContain("🔥 Ультра")
    expect(html).toContain("50%")
    expect(html).toContain("100%")
  })

  it("содержит секцию обнуления данных аккаунта", () => {
    const html = renderToStaticMarkup(
      <SettingsModal
        hud={dummyHud}
        onClose={vi.fn()}
        onMusicVolume={vi.fn()}
        onSfxVolume={vi.fn()}
        onToggleMusic={vi.fn()}
        onToggleMute={vi.fn()}
        onResetAccount={vi.fn()}
      />
    )

    expect(html).toContain("ПРОГРЕСС И ДАННЫЕ АККАУНТА")
    expect(html).toContain("Обнуление данных аккаунта")
    expect(html).toContain("Обнулить данные")
  })
})
