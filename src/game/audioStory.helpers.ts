/**
 * Стенд для проверки сюжетных звуков (roadmap 1.1): минимальный фейковый
 * WebAudio, который записывает параметры каждого осциллятора и шумового
 * источника. Позволяет утверждать, что звук действительно синтезируется
 * (тип волны, частота, слайд, задержка, громкость), а не просто «не падает».
 */

export interface ToneEvent {
  /** Тип волны осциллятора. */
  type: OscillatorType
  /** Начальная частота, Гц. */
  freq: number
  /** Конец экспоненциального слайда, если задан. */
  slideTo: number | null
  /** Длительность от старта до остановки, сек. */
  dur: number
  /** Задержка старта относительно currentTime на момент старта, сек. */
  delay: number
  /** Пиковая громкость огибающей (из GainNode, к которому подключён осциллятор). */
  peak: number
}

export interface NoiseEvent {
  dur: number
  delay: number
  peak: number
}

export interface FakeAudioLog {
  tones: ToneEvent[]
  noises: NoiseEvent[]
  /** Текущее время контекста; тест может его двигать. */
  now: number
}

type Param = {
  value: number
  setValueAtTime: (v: number, t: number) => Param
  exponentialRampToValueAtTime: (v: number, t: number) => Param
  linearRampToValueAtTime: (v: number, t: number) => Param
  setTargetAtTime: (v: number, t: number, c: number) => Param
  cancelScheduledValues: (t: number) => Param
}

function param(value = 0): Param {
  const p: Param = {
    value,
    setValueAtTime: (v) => {
      p.value = v
      return p
    },
    exponentialRampToValueAtTime: (v) => {
      p.value = v
      return p
    },
    linearRampToValueAtTime: (v) => {
      p.value = v
      return p
    },
    setTargetAtTime: (v) => {
      p.value = v
      return p
    },
    cancelScheduledValues: () => p,
  }
  return p
}

/** Тракт громкости: запоминаем пик огибающей, чтобы связать его с источником. */
type GainStub = {
  gain: Param
  peak: () => number
  connect: () => void
  disconnect: () => void
}

const peaks = new WeakMap<GainStub, number>()

function makeGain(): GainStub {
  let peak = 0
  const gain = param(0)
  const set = gain.setValueAtTime
  gain.setValueAtTime = (v, t) => {
    peak = Math.max(peak, v)
    return set(v, t)
  }
  const ramp = gain.exponentialRampToValueAtTime
  gain.exponentialRampToValueAtTime = (v, t) => {
    peak = Math.max(peak, v)
    return ramp(v, t)
  }
  const node: GainStub = {
    gain,
    peak: () => peak,
    connect: () => {},
    disconnect: () => {},
  }
  peaks.set(node, peak)
  return node
}

function peakOf(target: unknown): number {
  if (!target || typeof (target as GainStub).peak !== "function") return 0
  return (target as GainStub).peak()
}

/** Фейковый AudioContext: копит события в `log`, остальное — заглушки. */
export function makeFakeAudio(): { ctx: AudioContext; log: FakeAudioLog } {
  const log: FakeAudioLog = { tones: [], noises: [], now: 1 }

  const ctx = {
    get currentTime() {
      return log.now
    },
    state: "running",
    sampleRate: 8000,
    destination: {},
    resume: () => Promise.resolve(),
    createGain: makeGain,
    createStereoPanner: () => ({ pan: param(0), connect: () => {}, disconnect: () => {} }),
    createBiquadFilter: () => ({
      type: "lowpass",
      frequency: param(22000),
      Q: param(1),
      connect: () => {},
      disconnect: () => {},
    }),
    createBuffer: (_channels: number, len: number) => ({
      getChannelData: () => new Float32Array(len),
    }),
    createBufferSource: () => {
      const event: NoiseEvent = { dur: 0, delay: 0, peak: 0 }
      log.noises.push(event)
      const node = {
        buffer: null as AudioBuffer | null,
        start: (t: number) => {
          event.delay = t - log.now
        },
        stop: (t: number) => {
          event.dur = t - log.now - event.delay
        },
        connect: (target: unknown) => {
          event.peak = Math.max(event.peak, peakOf(target))
        },
        disconnect: () => {},
      }
      return node as unknown as AudioBufferSourceNode
    },
    createOscillator: () => {
      const event: ToneEvent = { type: "sine", freq: 0, slideTo: null, dur: 0, delay: 0, peak: 0 }
      log.tones.push(event)
      let startedAt = 0
      const frequency = {
        setValueAtTime: (v: number, t: number) => {
          event.freq = v
          startedAt = t
          return frequency
        },
        exponentialRampToValueAtTime: (v: number) => {
          event.slideTo = v
          return frequency
        },
      }
      const node = {
        get type() {
          return event.type
        },
        set type(v: OscillatorType) {
          event.type = v
        },
        frequency,
        start: (t: number) => {
          event.delay = t - log.now
          startedAt = t
        },
        stop: (t: number) => {
          event.dur = t - startedAt
        },
        connect: (target: unknown) => {
          event.peak = Math.max(event.peak, peakOf(target))
        },
        disconnect: () => {},
      }
      return node as unknown as OscillatorNode
    },
  } as unknown as AudioContext

  return { ctx, log }
}
