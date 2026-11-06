import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HAPTIC_PATTERNS, triggerHaptic } from "./haptics"

describe("haptics (T-066)", () => {
  let vibrateMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vibrateMock = vi.fn().mockReturnValue(true)
    vi.stubGlobal("navigator", {
      vibrate: vibrateMock,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("возвращает false, если вибрация отключена в настройках", () => {
    const res = triggerHaptic("medium", false)
    expect(res).toBe(false)
    expect(vibrateMock).not.toHaveBeenCalled()
  })

  it("вызывает navigator.vibrate с известными паттернами", () => {
    expect(triggerHaptic("light", true)).toBe(true)
    expect(vibrateMock).toHaveBeenLastCalledWith(HAPTIC_PATTERNS.light)

    expect(triggerHaptic("medium", true)).toBe(true)
    expect(vibrateMock).toHaveBeenLastCalledWith(HAPTIC_PATTERNS.medium)

    expect(triggerHaptic("heavy", true)).toBe(true)
    expect(vibrateMock).toHaveBeenLastCalledWith(HAPTIC_PATTERNS.heavy)

    expect(triggerHaptic("save", true)).toBe(true)
    expect(vibrateMock).toHaveBeenLastCalledWith(HAPTIC_PATTERNS.save)

    expect(triggerHaptic("damage", true)).toBe(true)
    expect(vibrateMock).toHaveBeenLastCalledWith(HAPTIC_PATTERNS.damage)
  })

  it("поддерживает произвольное число или массив миллисекунд", () => {
    expect(triggerHaptic(120)).toBe(true)
    expect(vibrateMock).toHaveBeenLastCalledWith(120)

    expect(triggerHaptic([40, 20, 40])).toBe(true)
    expect(vibrateMock).toHaveBeenLastCalledWith([40, 20, 40])
  })

  it("безопасно возвращает false при выбросе исключения из navigator.vibrate", () => {
    vibrateMock.mockImplementation(() => {
      throw new Error("SecurityError: vibrate not allowed in this document")
    })
    const res = triggerHaptic("heavy", true)
    expect(res).toBe(false)
  })

  it("возвращает false, если navigator.vibrate отсутствует", () => {
    vi.stubGlobal("navigator", {})
    const res = triggerHaptic("light", true)
    expect(res).toBe(false)
  })
})
