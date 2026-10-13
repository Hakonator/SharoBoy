import { clamp } from "../utils"

export type GraphicsQuality = "eco" | "high" | "ultra"

export interface PostFxParams {
  time: number
  chroma: number
  quality: GraphicsQuality
}

export function calcChroma(g: { flash: number; combo: number; shake: number }): number {
  const flashPart = Math.min(Math.max(0, g.flash), 1) * 0.7
  const comboPart = Math.min(Math.max(0, g.combo - 3), 15) * 0.04
  const shakePart = Math.min(Math.max(0, g.shake), 8) * 0.05
  return clamp(flashPart + comboPart + shakePart, 0, 1)
}

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = (a_position + 1.0) * 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER_SRC = `
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_chroma;
uniform int u_quality;

varying vec2 v_uv;

void main() {
  vec2 uv = v_uv;
  vec2 dir = uv - 0.5;
  float dist = length(dir);

  // Хроматическая аберрация: радиальное расхождение цветовых каналов
  float shift = u_chroma * 0.009 * (0.35 + 0.65 * dist);
  vec2 offset = normalize(dir + vec2(0.0001, 0.0001)) * shift;

  vec4 colR = texture2D(u_texture, uv - offset);
  vec4 colG = texture2D(u_texture, uv);
  vec4 colB = texture2D(u_texture, uv + offset);

  vec3 color = vec3(colR.r, colG.g, colB.b);

  // На Ultra: мягкий bloom и ультратонкие аркадные scanlines
  if (u_quality >= 2) {
    float scanline = sin(uv.y * u_resolution.y * 1.5) * 0.032;
    color -= scanline;

    if (u_chroma > 0.04) {
      vec4 blur = (
        texture2D(u_texture, uv + vec2(shift, 0.0)) +
        texture2D(u_texture, uv - vec2(shift, 0.0)) +
        texture2D(u_texture, uv + vec2(0.0, shift)) +
        texture2D(u_texture, uv - vec2(0.0, shift))
      ) * 0.25;
      color += blur.rgb * 0.14 * u_chroma;
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
`

export class PostFxPipeline {
  readonly isSupported: boolean = false
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private buffer: WebGLBuffer | null = null
  private uTextureLoc: WebGLUniformLocation | null = null
  private uResolutionLoc: WebGLUniformLocation | null = null
  private uTimeLoc: WebGLUniformLocation | null = null
  private uChromaLoc: WebGLUniformLocation | null = null
  private uQualityLoc: WebGLUniformLocation | null = null

  constructor(canvas: HTMLCanvasElement) {
    try {
      const gl =
        canvas.getContext("webgl", {
          alpha: false,
          depth: false,
          stencil: false,
          antialias: false,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
        }) || (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null)

      if (!gl) return

      const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC)
      const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC)
      if (!vs || !fs) return

      const prog = gl.createProgram()
      if (!prog) return

      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.deleteProgram(prog)
        return
      }

      this.gl = gl
      this.program = prog

      const posAttr = gl.getAttribLocation(prog, "a_position")
      this.uTextureLoc = gl.getUniformLocation(prog, "u_texture")
      this.uResolutionLoc = gl.getUniformLocation(prog, "u_resolution")
      this.uTimeLoc = gl.getUniformLocation(prog, "u_time")
      this.uChromaLoc = gl.getUniformLocation(prog, "u_chroma")
      this.uQualityLoc = gl.getUniformLocation(prog, "u_quality")

      // Квадрат из 2 треугольников
      const quad = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
      const buf = gl.createBuffer()
      if (!buf) return
      this.buffer = buf
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(posAttr)
      gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0)

      // Текстура для кадра Canvas 2D
      const tex = gl.createTexture()
      if (!tex) return
      this.texture = tex
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      this.isSupported = true
    } catch {
      this.isSupported = false
    }
  }

  private compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const s = gl.createShader(type)
    if (!s) return null
    gl.shaderSource(s, source)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s)
      return null
    }
    return s
  }

  render(sourceCanvas: HTMLCanvasElement, params: PostFxParams) {
    const gl = this.gl
    if (!this.isSupported || !gl || !this.program || !this.texture) return

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.useProgram(this.program)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas)
    gl.uniform1i(this.uTextureLoc, 0)

    if (this.uResolutionLoc) {
      gl.uniform2f(this.uResolutionLoc, gl.drawingBufferWidth, gl.drawingBufferHeight)
    }
    if (this.uTimeLoc) gl.uniform1f(this.uTimeLoc, params.time)
    if (this.uChromaLoc) gl.uniform1f(this.uChromaLoc, params.chroma)
    if (this.uQualityLoc) {
      gl.uniform1i(this.uQualityLoc, params.quality === "ultra" ? 2 : 1)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  destroy() {
    const gl = this.gl
    if (!gl) return
    if (this.buffer) gl.deleteBuffer(this.buffer)
    if (this.texture) gl.deleteTexture(this.texture)
    if (this.program) gl.deleteProgram(this.program)
    this.gl = null
    this.program = null
    this.texture = null
    this.buffer = null
  }
}
