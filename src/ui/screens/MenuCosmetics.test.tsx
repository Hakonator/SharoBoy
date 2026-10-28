import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { HudData } from "../../game/types"

import { MenuCosmetics } from "./MenuCosmetics"

const makeMockHud = (metaCrystals = 100): HudData => ({
  phase: "menu",
  score: 0,
  best: 0,
  lives: 3,
  level: 1,
  levelCount: 4,
  levelName: "ТЕСТ",
  mode: "campaign",
  wave: 1,
  combo: 0,
  blocksLeft: 1,
  muted: false,
  musicMuted: false,
  musicVolume: 1,
  sfxVolume: 1,
  newAchievements: [],
  banner: null,
  stuck: false,
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
  explosiveOn: false,
  magnetOn: false,
  coins: 50,
  crystals: 10,
  metaCrystals,
  cosmetics: {
    unlocked: ["paddle:default", "ball:default", "theme:ocean"],
    equipped: { paddle: "default", ball: "default", theme: "ocean" },
  },
  upgrades: {},
  top: [],
  topEndless: [],
  map: null,
  campaignEvent: null,
})

describe("MenuCosmetics", () => {
  it("renders crystal balance and category tabs", () => {
    const hud = makeMockHud(150)
    const html = renderToStaticMarkup(<MenuCosmetics hud={hud} />)

    expect(html).toContain("150")
    expect(html).toContain("кристаллов")
    expect(html).toContain("Ракетки")
    expect(html).toContain("Шлейфы")
    expect(html).toContain("Темы")
  })

  it("renders paddle skins and shows equipped status for default", () => {
    const hud = makeMockHud(100)
    const html = renderToStaticMarkup(<MenuCosmetics hud={hud} />)

    expect(html).toContain("Классика Неона")
    expect(html).toContain("Киберпанк")
    expect(html).toContain("Золотая Аркада")
    expect(html).toContain("Надет")
    expect(html).toContain("50 💠")
    expect(html).toContain("75 💠")
  })

  it("renders correctly with 0 crystals", () => {
    const hud = makeMockHud(0)
    const html = renderToStaticMarkup(<MenuCosmetics hud={hud} />)

    expect(html).toContain("0")
    expect(html).toContain("disabled")
  })
})
