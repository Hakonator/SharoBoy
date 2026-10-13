import { describe, expect, it, vi } from "vitest"

import { calcChroma, PostFxPipeline } from "./postFx"

describe("PostFx — calcChroma", () => {
  it("возвращает 0 при спокойном состоянии", () => {
    expect(calcChroma({ flash: 0, combo: 0, shake: 0 })).toBe(0)
    expect(calcChroma({ flash: 0, combo: 2, shake: 0 })).toBe(0)
  })

  it("увеличивает аберрацию при комбо выше 3", () => {
    const c5 = calcChroma({ flash: 0, combo: 5, shake: 0 })
    const c10 = calcChroma({ flash: 0, combo: 10, shake: 0 })
    expect(c5).toBeGreaterThan(0)
    expect(c10).toBeGreaterThan(c5)
  })

  it("вспышка и сильная тряска дают мощный импульс хроматической аберрации", () => {
    const cFlash = calcChroma({ flash: 1, combo: 0, shake: 0 })
    expect(cFlash).toBeCloseTo(0.7, 2)

    const cBig = calcChroma({ flash: 1, combo: 20, shake: 10 })
    expect(cBig).toBe(1)
  })

  it("ограничивает результат диапазоном [0, 1]", () => {
    expect(calcChroma({ flash: -2, combo: -5, shake: -1 })).toBe(0)
    expect(calcChroma({ flash: 10, combo: 100, shake: 50 })).toBe(1)
  })
})

describe("PostFxPipeline — безопасность окружения", () => {
  it("безопасно работает при отсутствии WebGL контекста (fallback режим)", () => {
    const fakeCanvas = {
      getContext: () => null,
    } as unknown as HTMLCanvasElement

    const pipeline = new PostFxPipeline(fakeCanvas)
    expect(pipeline.isSupported).toBe(false)

    // Вызовы render и destroy не должны бросать исключений
    expect(() => {
      pipeline.render(fakeCanvas, { time: 1, chroma: 0.5, quality: "high" })
      pipeline.destroy()
    }).not.toThrow()
  })

  it("безопасно отрабатывает, если getContext выбросил исключение", () => {
    const fakeCanvas = {
      getContext: () => {
        throw new Error("WebGL disabled by policy")
      },
    } as unknown as HTMLCanvasElement

    const pipeline = new PostFxPipeline(fakeCanvas)
    expect(pipeline.isSupported).toBe(false)
  })

  it("инициализирует WebGL pipeline при наличии контекста", () => {
    const mockGl = {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      LINK_STATUS: 3,
      COMPILE_STATUS: 4,
      ARRAY_BUFFER: 5,
      STATIC_DRAW: 6,
      FLOAT: 7,
      TEXTURE_2D: 8,
      TEXTURE0: 9,
      RGBA: 10,
      UNSIGNED_BYTE: 11,
      TRIANGLES: 12,
      CLAMP_TO_EDGE: 13,
      LINEAR: 14,
      TEXTURE_WRAP_S: 15,
      TEXTURE_WRAP_T: 16,
      TEXTURE_MIN_FILTER: 17,
      TEXTURE_MAG_FILTER: 18,
      drawingBufferWidth: 800,
      drawingBufferHeight: 600,
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getAttribLocation: vi.fn(() => 0),
      getUniformLocation: vi.fn(() => ({})),
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      createTexture: vi.fn(() => ({})),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      viewport: vi.fn(),
      useProgram: vi.fn(),
      activeTexture: vi.fn(),
      texImage2D: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform2f: vi.fn(),
      drawArrays: vi.fn(),
      deleteBuffer: vi.fn(),
      deleteTexture: vi.fn(),
      deleteProgram: vi.fn(),
    }

    const fakeCanvas = {
      getContext: vi.fn((type: string) => (type === "webgl" ? mockGl : null)),
    } as unknown as HTMLCanvasElement

    const pipeline = new PostFxPipeline(fakeCanvas)
    expect(pipeline.isSupported).toBe(true)

    pipeline.render(fakeCanvas, { time: 2, chroma: 0.3, quality: "ultra" })
    expect(mockGl.useProgram).toHaveBeenCalled()
    expect(mockGl.drawArrays).toHaveBeenCalledWith(mockGl.TRIANGLES, 0, 6)

    pipeline.destroy()
    expect(mockGl.deleteProgram).toHaveBeenCalled()
  })
})
