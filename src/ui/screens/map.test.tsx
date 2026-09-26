import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { generateCampaignMap } from "../../game/campaignMap"
import type { HudData } from "../../game/types"

import { MapScreen } from "./map"

describe("MapScreen: маршрут события кампании", () => {
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
      phase: "map",
    } as HudData

    const html = renderToStaticMarkup(
      <MapScreen hud={hud} onMapNode={() => {}} onEventDismiss={() => {}} onMenu={() => {}} />
    )

    expect(html).toContain("stroke-dasharray=\"2 1.4\"")
    expect(html).toContain("stroke-width=\"0.35\"")
    expect(html).toContain("markerWidth=\"3\"")
    expect(html).toContain("marker-end=\"url(#campaign-event-arrow)\"")
    expect(html).toContain("rgba(255,201,77,0.85)")
    expect(html).toContain(target.name)
  })
})