import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { InputController } from "./input"
import type { InputHost } from "./inputHost"

type Listener = (event: unknown) => void

interface MockTarget {
  addEventListener: (type: string, fn: Listener) => void
  removeEventListener: (type: string, fn: Listener) => void
  emit: (type: string, event: unknown) => void
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number }
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
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
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

  it("не взводит tapFire при клике/тапе, если мяч прилип (первый клик только запускает шар)", () => {
    let stuck = true
    const host = createMockHost()
    host.ballStuck = () => stuck
    const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
    controller.attach()

    // 1) Первый клик мыши — мяч прилип, клик запускает шар
    canvas.emit("pointerdown", {
      pointerType: "mouse",
      clientX: 400,
      clientY: 300,
    })
    expect(host.launchIfPlaying).toHaveBeenCalledTimes(1)
    expect(controller.consumeTapFire()).toBe(false)

    // Мяч полетел
    stuck = false

    // 2) Последующий клик — мяч в воздухе, клик взводит выстрел
    canvas.emit("pointerdown", {
      pointerType: "mouse",
      clientX: 400,
      clientY: 300,
    })
    expect(controller.consumeTapFire()).toBe(true)

    controller.destroy()
  })

  it("не устанавливает keys.space при нажатии пробела, если мяч прилип (пробел только запускает шар)", () => {
    let stuck = true
    const host = createMockHost()
    host.ballStuck = () => stuck
    const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
    controller.attach()

    // 1) Первый пробел — мяч прилип
    win.emit("keydown", {
      code: "Space",
      defaultPrevented: false,
      target: null,
      preventDefault: vi.fn(),
    })
    expect(host.primaryAction).toHaveBeenCalledTimes(1)
    expect(controller.keys.space).toBe(false)

    // Мяч полетел
    stuck = false

    // 2) Последующий пробел — мяч в воздухе, пробел взводит стрельбу
    win.emit("keydown", {
      code: "Space",
      defaultPrevented: false,
      target: null,
      preventDefault: vi.fn(),
    })
    expect(controller.keys.space).toBe(true)

    controller.destroy()
  })

  describe("Заряженный отскок платформы (T-060)", () => {
    it("не начинает удержание заряда, если мяч прилип (ballStuck = true)", () => {
      const host = createMockHost()
      host.ballStuck = () => true
      const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
      controller.attach()

      canvas.emit("pointerdown", { pointerType: "mouse", clientX: 200, clientY: 200 })
      expect(controller.holding).toBe(false)
      expect(controller.charge).toBe(0)

      win.emit("keydown", {
        code: "Space",
        defaultPrevented: false,
        target: null,
        preventDefault: vi.fn(),
      })
      expect(controller.holding).toBe(false)
      expect(controller.charge).toBe(0)

      controller.destroy()
    })

    it("не начинает удержание заряда, если взведён лазер (isLaserArmed = true)", () => {
      const host = createMockHost()
      host.ballStuck = () => false
      host.isLaserArmed = () => true
      const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
      controller.attach()

      canvas.emit("pointerdown", { pointerType: "mouse", clientX: 200, clientY: 200 })
      expect(controller.holding).toBe(false)

      win.emit("keydown", {
        code: "Space",
        defaultPrevented: false,
        target: null,
        preventDefault: vi.fn(),
      })
      expect(controller.holding).toBe(false)

      controller.destroy()
    })

    it("накапливает заряд при удержании мыши и сбрасывает без импульса при раннем отпускании", () => {
      const host = createMockHost()
      host.ballStuck = () => false
      const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
      controller.attach()

      canvas.emit("pointerdown", { pointerType: "mouse", clientX: 200, clientY: 200 })
      expect(controller.holding).toBe(true)

      // Половина времени заряда (0.3 с из 0.6 с)
      controller.updateCharge(0.3, true, false)
      expect(controller.charge).toBeCloseTo(0.5, 2)

      // Раннее отпускание
      canvas.emit("pointerup", { pointerType: "mouse" })
      expect(controller.holding).toBe(false)
      expect(controller.charge).toBe(0)
      expect(controller.consumeChargeRelease()).toBe(false)

      controller.destroy()
    })

    it("взводит chargeReleased при отпускании после полного заряда (>= 0.6 с)", () => {
      const host = createMockHost()
      host.ballStuck = () => false
      const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
      controller.attach()

      canvas.emit("pointerdown", { pointerType: "mouse", clientX: 200, clientY: 200 })
      expect(controller.holding).toBe(true)

      controller.updateCharge(0.6, true, false)
      expect(controller.charge).toBe(1)

      canvas.emit("pointerup", { pointerType: "mouse" })
      expect(controller.consumeChargeRelease()).toBe(true)
      // Одноразовый consume
      expect(controller.consumeChargeRelease()).toBe(false)

      controller.destroy()
    })

    it("накапливает заряд по удержанию пробела и активирует импульс при отпускании", () => {
      const host = createMockHost()
      host.ballStuck = () => false
      const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
      controller.attach()

      win.emit("keydown", {
        code: "Space",
        defaultPrevented: false,
        target: null,
        preventDefault: vi.fn(),
      })
      expect(controller.holding).toBe(true)
      expect(controller.holdPointerType).toBe("keyboard")

      controller.updateCharge(0.6, true, false)
      expect(controller.charge).toBe(1)

      win.emit("keyup", { code: "Space" })
      expect(controller.consumeChargeRelease()).toBe(true)

      controller.destroy()
    })

    it("на таче короткий тап (< 0.2 с) не даёт заряда, а долгое удержание (> 0.2 с) заряжает до 1.0 к 0.6 с", () => {
      const host = createMockHost()
      host.ballStuck = () => false
      const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
      controller.attach()

      // Быстрый тап (0.1 с)
      canvas.emit("pointerdown", {
        pointerType: "touch",
        clientX: 200,
        clientY: 200,
        pointerId: 1,
      })
      controller.updateCharge(0.1, true, false)
      expect(controller.charge).toBe(0)
      canvas.emit("pointerup", { pointerType: "touch", pointerId: 1 })
      expect(controller.consumeChargeRelease()).toBe(false)

      // Долгое удержание
      canvas.emit("pointerdown", {
        pointerType: "touch",
        clientX: 200,
        clientY: 200,
        pointerId: 2,
      })
      controller.updateCharge(0.2, true, false)
      expect(controller.charge).toBe(0)

      controller.updateCharge(0.2, true, false) // суммарно 0.4 с
      expect(controller.charge).toBeCloseTo(0.5, 2)

      controller.updateCharge(0.2, true, false) // суммарно 0.6 с
      expect(controller.charge).toBe(1)

      canvas.emit("pointerup", { pointerType: "touch", pointerId: 2 })
      expect(controller.consumeChargeRelease()).toBe(true)

      controller.destroy()
    })

    it("clearCharge сбрасывает удержание и заряд", () => {
      const host = createMockHost()
      host.ballStuck = () => false
      const controller = new InputController(canvas as unknown as HTMLCanvasElement, host)
      controller.attach()

      canvas.emit("pointerdown", { pointerType: "mouse", clientX: 200, clientY: 200 })
      controller.updateCharge(0.4, true, false)
      expect(controller.holding).toBe(true)
      expect(controller.charge).toBeGreaterThan(0)

      controller.clearCharge()
      expect(controller.holding).toBe(false)
      expect(controller.charge).toBe(0)
      expect(controller.consumeChargeRelease()).toBe(false)

      controller.destroy()
    })
  })
})
