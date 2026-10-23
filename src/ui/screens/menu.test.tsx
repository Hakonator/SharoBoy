import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { HudData } from "../../game/types"

import { MenuScreen } from "./menu"

const hud = {
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
  magnetOn: false,
  coins: 0,
  crystals: 0,
  metaCrystals: 0,
  upgrades: {},
} as unknown as HudData

const renderMenu = () =>
  renderToStaticMarkup(
    <MenuScreen
      hud={hud}
      stats={{ games: 0, wins: 0, bestScore: 0, bestWave: 0, topLevel: 0 }}
      nick=""
      period="all"
      screen="mobile"
      globalTop={[]}
      globalTopEndless={[]}
      unlocked={{}}
      topSubmit={null}
      onNickChange={() => {}}
      onPeriod={() => {}}
      onScreen={() => {}}
      onCampaign={() => {}}
      onEndless={() => {}}
      onCommunityMaps={() => {}}
      onAdmin={() => {}}
      onBuyUpgrade={() => {}}
      debug={false}
      onToggleDebug={() => {}}
      debugBoss=""
      onSelectDebugBoss={() => {}}
      isDebugEffectActive={() => false}
      onToggleDebugEffect={() => {}}
      onDebugStartGame={() => {}}
      onMute={() => {}}
      onMusic={() => {}}
      onMusicVolume={() => {}}
      onSfxVolume={() => {}}
    />
  )

describe("MenuScreen: прокрутка меню на смартфоне", () => {
  it("разрешает вертикальный свайп по странице меню", () => {
    const html = renderMenu()

    // `body { touch-action: none }` — без явного разрешения страница не скроллится пальцем.
    expect(html).toContain("page-scroll")
  })

  it("не запирает дашборд с табами во вложенный скролл на мобильном", () => {
    const html = renderMenu()

    // Внутренний скролл панели оставлен только от `md`, иначе свайп по дашборду
    // не доходит до страницы и меню «не скроллится».
    expect(html).toContain("md:overflow-y-auto")

    // Старые фиксированные высоты панели на мобильном давали мёртвую зону свайпа.
    expect(html).not.toContain("h-[360px]")
    expect(html).not.toContain("h-[400px]")
  })
})
