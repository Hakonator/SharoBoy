import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { PlayerMapSpec } from "../../game/mapSpec"

import { MapThumbnail } from "./MapThumbnail"

const sampleSpec: PlayerMapSpec = {
  version: 1,
  id: "thumb-test",
  metadata: { title: "Тестовая карта" },
  blocks: [
    {
      id: "b1",
      position: { x: 960, y: 540 },
      shape: "circle",
      size: { width: 60, height: 60 },
      hp: 1,
    },
    {
      id: "b2",
      position: { x: 480, y: 270 },
      shape: "ellipse",
      size: { width: 120, height: 50 },
      hp: 3,
    },
  ],
  winCondition: { kind: "all-destructible" },
}

describe("MapThumbnail", () => {
  it("renders with custom alt label and role img", () => {
    const html = renderToStaticMarkup(<MapThumbnail alt="Превью уровня" spec={sampleSpec} />)
    expect(html).toContain('aria-label="Превью уровня"')
    expect(html).toContain('role="img"')
  })

  it("renders empty state placeholder when no blocks are present", () => {
    const emptySpec: PlayerMapSpec = {
      ...sampleSpec,
      blocks: [],
    }
    const html = renderToStaticMarkup(<MapThumbnail spec={emptySpec} />)
    expect(html).toContain("Пусто")
  })
})
