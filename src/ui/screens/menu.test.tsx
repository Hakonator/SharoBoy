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

describe("MenuScreen: компактный мобильный колонтитул", () => {
  it("оставляет место сверху под угловые контролы звука и настроек", () => {
    const html = renderMenu()

    // Без верхнего отступа кнопки музыки/звука наезжали на название ШАРОБОЙ.
    expect(html).toContain("pt-16")
  })

  it("растягивает левую колонку на всю ширину и ужимает кнопки режимов", () => {
    const html = renderMenu()

    // Колонка больше не «shrink-0» на мобильном — иначе поле ника упиралось
    // в край, а кнопки могли переноситься некрасиво.
    expect(html).toContain("w-full max-w-xl shrink-0 md:w-auto")

    // Компактные кнопки: обычные размеры возвращаются от `sm`.
    expect(html).toContain("px-4 py-2.5 text-sm sm:px-7 sm:py-3.5 sm:text-lg")
    expect(html).toContain("px-3 py-2.5 font-display text-xs sm:px-5 sm:py-3.5 sm:text-base")

    // Заголовок меньше прежних 60 px, чтобы шапка не тянулась в высоту.
    expect(html).toContain("title-glow block text-5xl text-foam sm:text-7xl lg:text-8xl")
  })

  it("прячет ползунки громкости на смартфоне и оставляет кнопки 32 px", () => {
    const html = renderMenu()

    expect(html).toContain("vol-slider pointer-events-auto hidden sm:block")
    expect(html).toContain("h-8 w-8 items-center justify-center sm:h-10 sm:w-10")
  })
})
