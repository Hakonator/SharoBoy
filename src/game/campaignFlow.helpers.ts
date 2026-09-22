import { vi } from "vitest"

import { Game } from "./game"
import type { CampaignMapView } from "./campaignMap"

export interface GameInternals {
  phase: string
  level: number
  lives: number
  blocks: unknown[]
  balls: unknown[]
  campaign: unknown
  campaignPlayerId: number
  campaignVisited: number[]
  campaignVisible: number[]
  activeSpec: { name: string } | null
  onBossNode: boolean
  startGame: () => void
  startLevelBattle: (n: number) => void
  enterMapNode: (id: number) => void
  dismissCampaignEvent: () => void
  enterNextNodeOnAction: () => void
  toMenu: () => void
  destroy: () => void
}

export function makeEnv() {
  const grad = { addColorStop: () => {} }
  const ctxTarget: Record<string, unknown> = {
    canvas: null,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    miterLimit: 10,
    lineDashOffset: 0,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    shadowColor: "rgba(0,0,0,0)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    filter: "none",
    imageSmoothingEnabled: true,
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    ellipse: () => {},
    rect: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    clip: () => {},
    setLineDash: () => {},
    drawImage: () => {},
    putImageData: () => {},
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => grad,
    measureText: () => ({ width: 10 }),
    isPointInPath: () => false,
  }
  const ctx = new Proxy(ctxTarget, {
    set(obj, prop, value) {
      ;(obj as Record<string | symbol, unknown>)[prop] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D

  vi.stubGlobal("window", {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    AudioContext: undefined,
  })
  vi.stubGlobal("document", {
    addEventListener: () => {},
    removeEventListener: () => {},
    pointerLockElement: null,
  })
  let rafCb: FrameRequestCallback | null = null
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCb = cb
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", () => {})

  const canvas = {
    width: 1280,
    height: 720,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement

  const hudLog: {
    phase: string
    map: CampaignMapView | null
    campaignEvent: string | null
  }[] = []
  const game = new Game(canvas, (h) =>
    hudLog.push({ phase: h.phase, map: h.map, campaignEvent: h.campaignEvent })
  )
  ;(game as unknown as { attach: () => void }).attach()
  let t = 1000
  ;(game as unknown as { last: number }).last = t
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      t += 16.7
      const cb = rafCb
      rafCb = null
      cb?.(t)
    }
  }
  return { game, g: game as unknown as GameInternals, step, hudLog }
}
