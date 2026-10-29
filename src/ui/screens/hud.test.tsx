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
    crystals: 0,
    upgrades: {},
    top: [],
    topEndless: [],
    map: null,
    campaignEvent: null,
  }) as unknown as HudData

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

describe("HudOverlay: кнопка быстрого пропуска уровня в режиме отладки", () => {
  it("показывает кнопку быстрого завершения только в активном режиме отладки", () => {
    expect(renderHud("playing", true)).toContain("Быстро завершить уровень (Отладка)")
    expect(renderHud("playing", false)).not.toContain("Быстро завершить уровень (Отладка)")
  })

  it("не показывает кнопку на паузе или вне игры", () => {
    expect(renderHud("paused", true)).not.toContain("Быстро завершить уровень (Отладка)")
    expect(renderHud("menu", true)).not.toContain("Быстро завершить уровень (Отладка)")
  })

  it("кнопка видима и доступна для комфортного нажатия на сенсорных устройствах", () => {
    const html = renderHud("playing", true)
    expect(html).toContain("pointer-events-auto")
    expect(html).toContain("⏭")
    expect(html).not.toContain("Удерживайте, чтобы завершить уровень")
  })

  it("рендерит входящую трансляцию босса при наличии bossTransmission во время боя", () => {
    const hud = makeHud("playing")
    hud.bossTransmission = {
      kind: "chrono",
      name: "ПОВЕЛИТЕЛЬ ВРЕМЕНИ",
      protocol: "СИНГУЛЯРНОСТЬ: ХРАНИТЕЛЬ ЦИКЛА",
      introLine: "ТИК-ТАК. ТЫ ОПОЗДАЛ.",
      defeatLine: "РАССИНХРОН...",
      accentColor: "#38bdf8",
      callsign: "ХРОНОС",
    }
    const html = renderToStaticMarkup(
      <HudOverlay
        hud={hud}
        inGame
        portrait
        onPause={() => {}}
        onMute={() => {}}
        onMusic={() => {}}
        onMusicVolume={() => {}}
        onSfxVolume={() => {}}
        debug={false}
        onDebugSkipLevel={() => {}}
        onExitCustomMap={() => {}}
      />
    )
    expect(html).toContain("ПОВЕЛИТЕЛЬ ВРЕМЕНИ")
    expect(html).toContain("СИНГУЛЯРНОСТЬ: ХРАНИТЕЛЬ ЦИКЛА")
    expect(html).toContain("ТИК-ТАК. ТЫ ОПОЗДАЛ.")
    expect(html).toContain("ХРОНОС")
    expect(html).toContain("В ЭФИРЕ")
    expect(html).toContain("АВТО-ЗАКРЫТИЕ")
    expect(html).not.toContain("Закрыть диалог")
    // Проверка позиционирования над ракеткой и компактности на мобильных экранах
    expect(html).toContain("bottom-20")
    expect(html).toContain("pointer-coarse:bottom-[136px]")
    expect(html).not.toContain("top-14")
    expect(html).not.toContain("sm:top-20")
    expect(html).toContain("max-w-sm")
    expect(html).toContain("sm:max-w-xl")
    expect(html).toContain("sm:bottom-3")
  })

  it("отображает бейджи активных реликвий с иконками и подсказками в HUD кампании", () => {
    const hud = makeHud("playing")
    hud.mode = "campaign"
    hud.activeRelics = ["relic_frost", "relic_bulwark"]

    const html = renderToStaticMarkup(
      <HudOverlay
        hud={hud}
        inGame
        portrait={false}
        onPause={() => {}}
        onMute={() => {}}
        onMusic={() => {}}
        onMusicVolume={() => {}}
        onSfxVolume={() => {}}
        debug={false}
        onDebugSkipLevel={() => {}}
        onExitCustomMap={() => {}}
      />
    )

    expect(html).toContain("Реликвии")
    expect(html).toContain("❄️")
    expect(html).toContain("🏰")
    expect(html).toContain("Крио-резонатор:")
    expect(html).toContain("Броневой бастион:")
  })

  it("отображает бейджи активных синергий с иконками, названиями и подсказками", () => {
    const hud = makeHud("playing")
    hud.activeSynergies = ["kinetic_sniper", "chain_resonance", "gravitational_juggernaut"]

    const html = renderToStaticMarkup(
      <HudOverlay
        hud={hud}
        inGame
        portrait={false}
        onPause={() => {}}
        onMute={() => {}}
        onMusic={() => {}}
        onMusicVolume={() => {}}
        onSfxVolume={() => {}}
        debug={false}
        onDebugSkipLevel={() => {}}
        onExitCustomMap={() => {}}
      />
    )

    expect(html).toContain("Синергии")
    expect(html).toContain("🎯")
    expect(html).toContain("⚡")
    expect(html).toContain("💥")
    expect(html).toContain("СНАЙПЕР")
    expect(html).toContain("РЕЗОНАНС")
    expect(html).toContain("ДЖАГГЕРНАУТ")
    expect(html).toContain("Кинетический Снайпер")
    expect(html).toContain("Цепной Резонанс")
    expect(html).toContain("Гравитационный Джаггернаут")
  })
})
