import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { InputController } from "./input"
import type { InputHost } from "./inputHost"

type Listener = (event: unknown) => void

interface MockTarget {
  addEventListener: (type: string, fn: Listener) => void
  removeEventListener: (type: string, fn: Listener) => void
  emit: (type: string, event: unknown) => void
}

function createMockTarget(): MockTarget {
  const listeners: Record<string, Listener[]> = {}
  return {
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(fn)
    },
    removeEventListener: (type: string, fn: Listener) => {
      if (!listeners[type]) return
      listeners[type] = listeners[type].filter((l) => l !== fn)
    },
    emit: (type: string, event: unknown) => {
      for (const fn of listeners[type] || []) {
        fn(event)
      }
    },
  }
}

function createMockHost(): InputHost {
  return {
    paddleX: () => 0,
    paddleY: () => 0,
    paddleWidth: () => 100,
    worldWidth: () => 800,
    worldHeight: () => 600,
    sfxEnsure: vi.fn(),
    isPlaying: () => true,
    primaryAction: vi.fn(),
    launchIfPlaying: vi.fn(),
    aimWheel: vi.fn(),
    aimFromPointer: vi.fn(),
    aimGuideActive: () => false,
    ballStuck: () => false,
    onTouchInput: vi.fn(),
    togglePause: vi.fn(),
    onLockLostUnexpectedly: vi.fn(),
    toggleMute: vi.fn(),
    toggleMusic: vi.fn(),
    toggleFpsOverlay: vi.fn(),
    toggleHitboxes: vi.fn(),
    toggleSlowMotion: vi.fn(),
    toggleInvincible: vi.fn(),
    debugDamageUp: vi.fn(),
    debugSkipLevel: vi.fn(),
    onBlur: vi.fn(),
  }
}

describe("InputController", () => {
  let win: MockTarget
  let doc: MockTarget
  let canvas: MockTarget

  beforeEach(() => {
    win = createMockTarget()
    doc = createMockTarget()
    canvas = createMockTarget()
    vi.stubGlobal("window", win)
    vi.stubGlobal("document", doc)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("toggles pause on Escape or KeyP if not prevented", () => {
    const host = createMockHost()
    const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
    controller.attach()

    win.emit("keydown", {
      code: "Escape",
      defaultPrevented: false,
      target: null,
      preventDefault: vi.fn(),
    })
    expect(host.togglePause).toHaveBeenCalledTimes(1)

    win.emit("keydown", {
      code: "KeyP",
      defaultPrevented: false,
      target: null,
      preventDefault: vi.fn(),
    })
    expect(host.togglePause).toHaveBeenCalledTimes(2)

    controller.destroy()
  })

  it("ignores keydown events with defaultPrevented (e.g. SettingsModal Esc)", () => {
    const host = createMockHost()
    const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
    controller.attach()

    win.emit("keydown", {
      code: "Escape",
      defaultPrevented: true,
      target: null,
      preventDefault: vi.fn(),
    })
    expect(host.togglePause).not.toHaveBeenCalled()

    controller.destroy()
  })

  it("ignores keys when typing in input or textarea elements", () => {
    const host = createMockHost()
    const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
    controller.attach()

    win.emit("keydown", {
      code: "KeyA",
      defaultPrevented: false,
      target: { tagName: "INPUT" },
      preventDefault: vi.fn(),
    })
    expect(controller.keys.left).toBe(false)

    win.emit("keydown", {
      code: "KeyA",
      defaultPrevented: false,
      target: { tagName: "DIV" },
      preventDefault: vi.fn(),
    })
    expect(controller.keys.left).toBe(true)

    controller.destroy()
  })
})
