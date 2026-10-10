import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { HudData } from "../../game/types"

import { HudOverlay } from "./hud"

const makeHud = (phase: HudData["phase"]): HudData =>
  ({
    phase,
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
    magnetOn: false,
    coins: 0,
    upgrades: {},
    top: [],
    topEndless: [],
    map: null,
    campaignEvent: null,
  }) as HudData

function renderHud(phase: HudData["phase"], debug: boolean) {
  return renderToStaticMarkup(
    <HudOverlay
      hud={makeHud(phase)}
      inGame={phase === "playing" || phase === "paused"}
      portrait
      onPause={() => {}}
      onMute={() => {}}
      onMusic={() => {}}
      onMusicVolume={() => {}}
      onSfxVolume={() => {}}
      debug={debug}
      onDebugSkipLevel={() => {}}
      onExitCustomMap={() => {}}
    />
  )
}

describe("HudOverlay: кнопка пропуска уровня", () => {
  it("показывает удерживаемую кнопку только в активном режиме отладки", () => {
    expect(renderHud("playing", true)).toContain("Удерживайте, чтобы завершить уровень")
    expect(renderHud("playing", false)).not.toContain("Удерживайте, чтобы завершить уровень")
  })

  it("не показывает кнопку на паузе или вне игры", () => {
    expect(renderHud("paused", true)).not.toContain("Удерживайте, чтобы завершить уровень")
    expect(renderHud("menu", true)).not.toContain("Удерживайте, чтобы завершить уровень")
  })

  it("помечает кнопку как сенсорный контрол", () => {
    const html = renderHud("playing", true)
    expect(html).toContain("pointer-coarse:flex")
    expect(html).toContain("hidden")
  })
})
