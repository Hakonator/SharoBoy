import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { HudData } from "../../game/types"
import { ControlsPanel } from "../icons"
import type { DailyQuestDef, DailyQuestState } from "../../game/dailyQuests"

import { MenuScreen } from "./menu"
import { MenuDailyQuests, MenuDebug } from "./menuPanels"

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

/** Пропсы меню: общий набор для всех проверок разметки. */
const menuProps = {
  hud,
  stats: { games: 0, wins: 0, bestScore: 0, bestWave: 0, topLevel: 0 },
  nick: "",
  period: "all" as const,
  screen: "mobile" as const,
  globalTop: [],
  globalTopEndless: [],
  globalTopDaily: [],
  unlocked: {},
  topSubmit: null,
  onNickChange: () => {},
  onPeriod: () => {},
  onScreen: () => {},
  onCampaign: () => {},
  onDaily: () => {},
  onEndless: () => {},
  onCommunityMaps: () => {},
  onAdmin: () => {},
  onBuyUpgrade: () => {},
  onClaimDailyQuests: () => {},
  debug: false,
  onToggleDebug: () => {},
  debugBoss: "",
  onSelectDebugBoss: () => {},
  isDebugEffectActive: () => false,
  onToggleDebugEffect: () => {},
  onDebugStartGame: () => {},
  onMute: () => {},
  onMusic: () => {},
  onMusicVolume: () => {},
  onSfxVolume: () => {},
}

const renderMenu = () => renderToStaticMarkup(<MenuScreen {...menuProps} />)

/** Текст без тегов — чтобы проверять формулировки, а не разметку. */
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .trim()

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

describe("MenuScreen: справка по управлению под способ ввода", () => {
  /**
   * Заглушка `(pointer: coarse)` — сенсорный экран. `IS_REACT_ACT_ENVIRONMENT`
   * гасит предупреждение React о `useEffect` при статичной отрисовке.
   */
  const stubPointer = (coarse: boolean) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", false)
    vi.stubGlobal(
      "window",
      Object.assign({}, globalThis.window, {
        matchMedia: (query: string) => ({
          matches: query.includes("pointer: coarse") ? coarse : false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      })
    )
  }

  it("на сенсорном экране описывает только жесты пальцем", () => {
    const text = plain(renderToStaticMarkup(<ControlsPanel touch />))

    expect(text).toContain("пальцем")
    expect(text).toContain("Отпусти палец")
    expect(text).toContain("2 ПАЛЬЦА")

    // Клавиатурных и мышиных подсказок быть не должно.
    expect(text).not.toContain("ПРОБЕЛ")
    expect(text).not.toContain("ЛКМ")
    expect(text).not.toContain("ESC")
    expect(text).not.toContain("КОЛЕСО")
  })

  it("с мышью и клавиатурой описывает только клавиши и мышь", () => {
    const text = plain(renderToStaticMarkup(<ControlsPanel touch={false} />))

    expect(text).toContain("ЛКМ")
    expect(text).toContain("ПРОБЕЛ")
    expect(text).toContain("ESC")
    expect(text).toContain("КОЛЕСО")

    expect(text).not.toContain("пальцем")
    expect(text).not.toContain("2 ПАЛЬЦА")
  })

  it("в меню доступна вкладка справки при любом способе ввода", () => {
    stubPointer(true)
    const touchHtml = renderMenu()
    stubPointer(false)
    const desktopHtml = renderMenu()
    vi.unstubAllGlobals()

    expect(touchHtml).toContain("🎮 Справка")
    expect(desktopHtml).toContain("🎮 Справка")
  })

  it("отображает кнопку запуска ежедневного испытания", () => {
    const html = renderMenu()
    expect(html).toContain("📅 Ежедневное")
  })
})

describe("MenuDebug: выбор минибосса в отладке", () => {
  const renderDebug = () =>
    renderToStaticMarkup(
      <MenuDebug
        debug
        onToggleDebug={() => {}}
        debugBoss=""
        onSelectDebugBoss={() => {}}
        isDebugEffectActive={() => false}
        onToggleDebugEffect={() => {}}
        onDebugStartGame={() => {}}
      />
    )

  it("предлагает запустить каждый из четырёх видов минибоссов", () => {
    const html = renderDebug()
    // T-058: новые виды обязаны быть в панели, иначе их не проверить вживую.
    expect(html).toContain('value="minibossFish"')
    expect(html).toContain('value="minibossJelly"')
    expect(html).toContain('value="minibossCrab"')
    expect(html).toContain('value="minibossEel"')
  })

  it("подписывает новых минибоссов так, чтобы их не путать с боссами Актов", () => {
    const html = plain(renderDebug())
    // 🦀 уже занят «Меха-Крабом» (босс Акта 2) — «мини» в подписи обязательно.
    expect(html).toContain("🦀 Краб (мини)")
    expect(html).toContain("🐍 Угорь (мини)")
    expect(html).toContain("🦀 Меха-Краб (Акт 2)")
  })

  describe("MenuDailyQuests (T-059): блок «Задания дня»", () => {
    const quest = (
      kind: DailyQuestDef["kind"],
      progress: number,
      claimed = false
    ): DailyQuestState => ({
      def: {
        kind,
        icon: "🧱",
        title: kind === "boss_kills" ? "Казнь босса" : "Зачистка поля",
        goal: " разбить блоков",
        target: 10,
        rewardMeta: kind === "boss_kills" ? 3 : 1,
      },
      progress,
      claimed,
    })

    const renderPanel = (quests: DailyQuestState[]) =>
      plain(renderToStaticMarkup(<MenuDailyQuests onClaim={() => {}} quests={quests} />))

    it("показывает все задания с прогрессом и наградой", () => {
      const html = renderPanel([quest("break_blocks", 4), quest("boss_kills", 0)])
      expect(html).toContain("🧱")
      expect(html).toContain("Зачистка поля")
      expect(html).toContain("4 / 10")
      expect(html).toContain("0 / 10")
      expect(html).toContain("💎 3")
    })

    it("не даёт забрать награду, пока задания не выполнены", () => {
      const html = renderToStaticMarkup(
        <MenuDailyQuests onClaim={() => {}} quests={[quest("break_blocks", 9)]} />
      )
      expect(html).toContain("Выполните задание дня")
      // Кнопка заблокирована — иначе повторные клики висели бы без награды
      expect(html).toContain("disabled")
    })

    it("предлагает забрать сумму только за выполненные задания", () => {
      const html = renderToStaticMarkup(
        <MenuDailyQuests
          onClaim={() => {}}
          quests={[quest("break_blocks", 10), quest("boss_kills", 10)]}
        />
      )
      expect(html).toContain("Забрать 💎 4")
    })

    it("после выдачи показывает, что награды получены", () => {
      const html = renderPanel([quest("break_blocks", 10, true)])
      expect(html).toContain("Награды получены")
    })

    it("прогресс сверх цели не показывается больше цели", () => {
      const html = renderPanel([quest("break_blocks", 25)])
      expect(html).toContain("10 / 10")
      expect(html).not.toContain("25 / 10")
    })
  })
})
