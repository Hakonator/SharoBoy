import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { generateCampaignMap, TIER_STEP_NODE_WIDTHS } from "../../game/campaignMap"
import { EVENT_TEXTS } from "../../game/campaignMapLayout"
import type { HudData } from "../../game/types"

import { MapScreen } from "./map"

/** Ширина пиктограммы узла на мобильных (`w-11`) и шаг яруса в px. */
const NODE_PX = 44
const STEP_PX = NODE_PX * TIER_STEP_NODE_WIDTHS

/**
 * Ширина полотна карты в ширинах узла: `(tiers − 1)` шагов по
 * `TIER_STEP_NODE_WIDTHS` плюс по половине узла с каждого края.
 */
const canvasWidths = (tiers: number) => (tiers - 1) * TIER_STEP_NODE_WIDTHS + 1

/** Ожидаемая x-координата узла в px — нормированная координата × ширина полотна. */
const canvasX = (x: number, tiers: number) => x * canvasWidths(tiers) * NODE_PX

describe("MapScreen: маршрут события кампании", () => {
  it("показывает название цели как название локации, не пытаясь склонять его", () => {
    expect(EVENT_TEXTS[1].replace("{place}", "АВАНПОСТ")).toBe(
      "ПОДВОДНОЕ ТЕЧЕНИЕ УНЕСЛО ШАР ПРЯМО В ЛОКАЦИЮ «АВАНПОСТ»."
    )
  })

  it("раскрывает цель, подсвечивает её и указывает пунктирной стрелкой", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const target = map.nodes.find((node) => node.tier === 2)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: [player.id],
        visible: map.edges.filter((edge) => edge.from === player.id).map((edge) => edge.to),
        minibosses: {},
        eventTargetId: target.id,
      },
      campaignEvent: `ПЕРЕНОС В ${target.name}`,
      score: 0,
      lives: 3,
      best: 0,
      coins: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    expect(html).toContain('stroke-dasharray="2 1.4"')
    expect(html).toContain('stroke-width="0.35"')
    expect(html).toContain('markerWidth="1"')
    expect(html).toContain('marker-end="url(#campaign-event-arrow)"')
    expect(html).toContain("rgba(255,201,77,0.85)")
    expect(html).toContain(target.name)
    expect(html).toContain("bg-abyss/25")
    expect(html).toContain("backdrop-blur-sm")
  })

  it("рендерит модальное окно магазина с товарами и балансом", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: [player.id],
        visible: map.edges.filter((edge) => edge.from === player.id).map((edge) => edge.to),
        minibosses: {},
      },
      campaignShop: {
        nodeId: player.id,
        name: "ЛАВКА ГЛУБИН",
        items: [
          {
            id: "life",
            name: "Ремонт обшивки",
            desc: "+1 жизнь",
            price: 24,
            category: "life",
            icon: "life",
            sold: false,
          },
        ],
      },
      score: 0,
      lives: 3,
      coins: 50,
      crystals: 50,
      best: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    expect(html).toContain("ПОДВОДНЫЙ ТОРГОВЕЦ")
    expect(html).toContain("ЛАВКА ГЛУБИН")
    expect(html).toContain("Ремонт обшивки")
    expect(html).toContain("24 💎")
    expect(html).toContain("50")
  })

  it("рендерит реликвии с бейджем РЕЛИКВИЯ", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: [player.id],
        visible: [],
        minibosses: {},
      },
      campaignShop: {
        nodeId: player.id,
        name: "ЛАВКА ГЛУБИН",
        items: [
          {
            id: "relic_shield",
            name: "Жемчужина глубин",
            desc: "Реликвия: +1 щит",
            price: 35,
            category: "relic",
            icon: "shield",
            relic: true,
            sold: false,
          },
        ],
      },
      score: 0,
      lives: 3,
      coins: 100,
      crystals: 40,
      best: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    expect(html).toContain("Жемчужина глубин")
    expect(html).toContain("РЕЛИКВИЯ")
    expect(html).toContain("35 💎")
  })

  it("рендерит динамическую рамку текущего положения вокруг границ узла игрока", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: [player.id],
        visible: map.edges.filter((edge) => edge.from === player.id).map((edge) => edge.to),
        minibosses: {},
      },
      score: 0,
      lives: 3,
      best: 0,
      coins: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    // Динамическая рамка с тактическим видоискателем и статусом
    expect(html).toContain('data-testid="current-node-reticle"')
    expect(html).toContain("ТЕКУЩИЙ СЕКТОР")
    expect(html).toContain("anim-radar")
    expect(html).toContain("anim-spin-slow")
    expect(html).toContain("anim-spin-reverse")
    // Проверка центрирования статусной плашки рамки
    expect(html).toContain("left-1/2 -translate-x-1/2")
    // Проверка позиционирования рамки на координатах текущего узла: x — в px
    // (постоянный шаг ярусов), y — в процентах высоты полотна
    expect(html).toContain(`left:${canvasX(player.x, map.tiers)}px`)
    expect(html).toContain(`top:${player.y * 100}%`)
    // Проверка того, что подпись узла вынесена в абсолютную плашку снизу, не смещая центр кнопки
    expect(html).toContain("pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2")
  })

  it("отображает узлы в виде увеличенных пиктограмм (бой, магазин, испытание, событие, босс)", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    // Раскрываем все узлы карты для проверки типов пиктограмм
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: map.nodes.map((n) => n.id),
        visible: [],
        minibosses: {},
      },
      score: 0,
      lives: 3,
      best: 0,
      coins: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    // Увеличенные размеры узлов (h-11 w-11 / h-14 w-14)
    expect(html).toContain("h-11 w-11 sm:h-12 sm:w-12")
    expect(html).toContain("h-14 w-14 sm:h-16 sm:w-16")
    // Форма со скругленными гранями технологичной пиктограммы
    expect(html).toContain("rounded-2xl")
    // Пиктограмма обычного боевого узла в легенде и узлах
    expect(html).toContain("БОЙ")
  })

  it("рендерит разрешённое интерактивное событие с кнопкой «ПРОДОЛЖИТЬ ПУТЬ»", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: [player.id],
        visible: [],
        minibosses: {},
      },
      campaignEventData: {
        title: "ВОДОВОРОТ ВРЕМЕНИ",
        text: "Глубинный хроно-водоворот раскручивает субмарину.",
        choices: [],
        resolved: true,
        outcomeText: "Вас отбросило назад во времени!",
      },
      score: 0,
      lives: 3,
      best: 0,
      coins: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    expect(html).toContain("ВОДОВОРОТ ВРЕМЕНИ")
    expect(html).toContain("Вас отбросило назад во времени!")
    expect(html).toContain("ПРОДОЛЖИТЬ ПУТЬ")
  })

  it("рендерит фоллбэк случайного текстового события с кнопкой «ПЛЫТЬ ДАЛЬШЕ»", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: [player.id],
        visible: [],
        minibosses: {},
      },
      campaignEvent: "Подводный гейзер ускорил движение вперед!",
      score: 0,
      lives: 3,
      best: 0,
      coins: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    expect(html).toContain("СЛУЧАЙНОЕ СОБЫТИЕ")
    expect(html).toContain("Подводный гейзер ускорил движение вперед!")
    expect(html).toContain("ПЛЫТЬ ДАЛЬШЕ")
  })

  it("держит постоянный шаг между ярусами в 2 ширины узла при любом экране", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: map.nodes.map((n) => n.id),
        visible: [],
        minibosses: {},
      },
      score: 0,
      lives: 3,
      best: 0,
      coins: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    // Полотно карты растёт вместе с числом ярусов, а не с шириной экрана
    const canvasPx = canvasWidths(map.tiers) * NODE_PX
    expect(html).toContain('data-testid="campaign-map-canvas"')
    expect(html).toContain(`width:${canvasPx}px`)

    // Первый и последний ярус отступают от краёв полотна на половину ширины узла
    const first = map.nodes.find((n) => n.tier === 0)!
    const last = map.nodes.find((n) => n.tier === map.tiers - 1)!
    expect(canvasX(first.x, map.tiers)).toBeCloseTo(NODE_PX / 2, 6)
    expect(canvasX(last.x, map.tiers)).toBeCloseTo(canvasPx - NODE_PX / 2, 6)

    // Узлы одного яруса стоят в одной колонке, соседние ярусы — ровно на 2 ширины узла
    const tierOne = map.nodes.filter((n) => n.tier === 1)
    const tierTwo = map.nodes.filter((n) => n.tier === 2)
    expect(new Set(tierOne.map((n) => n.x)).size).toBe(1)
    expect(canvasX(tierTwo[0].x, map.tiers) - canvasX(tierOne[0].x, map.tiers)).toBeCloseTo(
      STEP_PX,
      6
    )
    expect(html).toContain(`left:${canvasX(tierOne[0].x, map.tiers)}px`)
  })

  it("рендерит оверлей сюжетного терминала «СФЕРА-1080» с кодом журнала и автором", () => {
    const map = generateCampaignMap(541)
    const player = map.nodes.find((node) => node.id === map.startId)!
    const hud = {
      map: {
        ...map,
        playerId: player.id,
        visited: [player.id],
        visible: [],
        minibosses: {},
      },
      campaignEventData: {
        id: "event-terminal-1",
        title: "АРХИВ КРИО-КОНТУРА",
        text: "Квантовый вычислитель вошёл в термодинамический резонанс. Биогель затопил отсеки.",
        terminalLog: {
          code: "LOG #108-A // КРИО-КОНТУР",
          author: "Д-р Воронов // Главный крио-инженер",
          date: "2084.11.04 // ОРБИТА 420 КМ",
          act: 1,
        },
        choices: [
          {
            id: "choice-1",
            label: "Сброс давления хладагента",
            desc: "Восстановить энергощит (+1 ЩИТ).",
          },
        ],
        resolved: false,
      },
      score: 0,
      lives: 3,
      best: 0,
      coins: 0,
      phase: "map",
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    expect(html).toContain("«СФЕРА-1080» // LOG #108-A // КРИО-КОНТУР")
    expect(html).toContain("Д-р Воронов // Главный крио-инженер")
    expect(html).toContain("2084.11.04 // ОРБИТА 420 КМ")
    expect(html).toContain("Сброс давления хладагента")
  })
})
