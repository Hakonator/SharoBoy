import { afterEach, describe, expect, it, vi } from "vitest"

import { SFX } from "./audio"
import { makeFakeAudio, type FakeAudioLog } from "./audioStory.helpers"

/** SFX с рабочим фейковым WebAudio — слышим реальный синтез, а не только «не упало». */
function makeSfx(): { sfx: SFX; log: FakeAudioLog } {
  const { ctx, log } = makeFakeAudio()
  // `SFX.ensure()` берёт конструктор из `window.AudioContext` — подменяем именно там.
  const fakeWindow = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: null,
    AudioContext: class {
      constructor() {
        return ctx as unknown as AudioContext
      }
    },
  }
  vi.stubGlobal("window", fakeWindow)
  const sfx = new SFX()
  sfx.ensure()
  // Контекст должен быть создан нашим фейком — иначе звук просто не проверить.
  const internals = sfx as unknown as { ctx: unknown }
  if (!internals.ctx) throw new Error("фейковый AudioContext не подхватился")
  // ensure() запускает музыку — её ноты не относятся к тесту.
  log.tones.length = 0
  log.noises.length = 0
  return { sfx, log }
}

const cleanup = () => {
  vi.unstubAllGlobals()
}

/** Самый поздний момент, когда ещё звучит хоть что-то. */
const endOfSound = (log: FakeAudioLog) =>
  Math.max(...log.tones.map((t) => t.dur + t.delay), ...log.noises.map((n) => n.dur + n.delay))

describe("1.1: сюжетные звуки станции «СФЕРА-1080»", () => {
  afterEach(cleanup)

  describe("входящая трансляция босса", () => {
    it("начинается со щелчка и радиопомех, тона — в эфирном диапазоне", () => {
      const { sfx, log } = makeSfx()
      sfx.transmission("kraken")

      // Статика обязательна: без неё трансляция звучит как обычный блип.
      expect(log.noises.length).toBeGreaterThanOrEqual(2)
      expect(log.noises[0].delay).toBeLessThan(0.05)
      expect(log.tones.length).toBeGreaterThanOrEqual(3)
      const freqs = log.tones.map((t) => t.freq)
      expect(Math.min(...freqs)).toBeGreaterThan(400)
      expect(Math.max(...freqs)).toBeLessThan(4000)
    })

    it("гетеродин воет вниз: у рабочих тонов задан слайд вниз", () => {
      const { sfx, log } = makeSfx()
      sfx.transmission("king")

      const withSlide = log.tones.filter((t) => t.slideTo !== null)
      expect(withSlide.length).toBeGreaterThanOrEqual(3)
      for (const tone of withSlide) expect(tone.slideTo!).toBeLessThan(tone.freq)
    })

    it("у каждого босса свой голос в эфире", () => {
      const pitches: number[] = []
      const kinds = ["king", "jellyfish", "octopus", "crab", "kraken", "chrono"] as const
      for (const kind of kinds) {
        const { sfx, log } = makeSfx()
        sfx.transmission(kind)
        pitches.push(Math.min(...log.tones.map((t) => t.freq)))
        cleanup()
      }
      // Разные высоты у всех шести боссов, Кракен глуше, медуза — выше.
      expect(new Set(pitches).size).toBe(6)
      expect(pitches[4]).toBeLessThan(pitches[0])
      expect(pitches[1]).toBeGreaterThan(pitches[0])
    })
  })

  describe("раскрытие бронестворок и стравливание геля", () => {
    it("створки: низкий гул сервоприводов, скрип металла и шум", () => {
      const { sfx, log } = makeSfx()
      sfx.stationHatch()

      expect(log.noises.length).toBeGreaterThanOrEqual(1)
      const lows = log.tones.filter((t) => t.freq < 120)
      expect(lows.length).toBeGreaterThanOrEqual(2)
      // Сервопривод разгоняется — слайд вверх.
      expect(lows[0].slideTo!).toBeGreaterThan(lows[0].freq)
      // Скрип створок — высокие короткие «зубья».
      expect(log.tones.filter((t) => t.freq > 800).length).toBeGreaterThanOrEqual(3)
    })

    it("гель: длинный выдох шума и свист сопла вниз", () => {
      const { sfx, log } = makeSfx()
      sfx.gelVent()

      const longestNoise = Math.max(...log.noises.map((n) => n.dur))
      expect(longestNoise).toBeGreaterThan(1)
      const whistle = log.tones[0]
      expect(whistle.freq).toBeGreaterThan(2000)
      expect(whistle.slideTo!).toBeLessThan(600)
    })

    it("эпилог звучит дольше обычного победного аккорда", () => {
      const { sfx, log } = makeSfx()
      sfx.stationHatch()
      sfx.gelVent()
      // Хвост сцены — больше полутора секунд: раскрытие и выход биогеля.
      expect(endOfSound(log)).toBeGreaterThan(1.5)
    })
  })

  describe("фазовые акценты финальных боссов", () => {
    it("Хронос: два тикающих удара и восходящий шлейф времени", () => {
      const { sfx, log } = makeSfx()
      sfx.bossPhase("chrono")

      expect(log.tones.length).toBe(3)
      // Второй удар запаздывает — это «тик… так».
      expect(log.tones[1].delay).toBeGreaterThan(0)
      expect(log.noises.length).toBe(0)
      // Шлейф едет вверх: петля времени трогается с места.
      const tail = log.tones[2]
      expect(tail.slideTo!).toBeGreaterThan(tail.freq)
    })

    it("Кракен: гул из бездны и обвал вниз", () => {
      const { sfx, log } = makeSfx()
      sfx.bossPhase("kraken")

      expect(log.noises.length).toBe(1)
      expect(log.tones.filter((t) => t.freq < 150).length).toBeGreaterThanOrEqual(1)
      const fall = log.tones.find((t) => t.slideTo !== null && t.slideTo < 100)
      expect(fall).toBeTruthy()
    })

    it("два финальных босса звучат по-разному", () => {
      const chrono = makeSfx()
      chrono.sfx.bossPhase("chrono")
      const kraken = makeSfx()
      kraken.sfx.bossPhase("kraken")

      expect(chrono.log.tones.length).not.toBe(kraken.log.tones.length)
      expect(chrono.log.noises.length).not.toBe(kraken.log.noises.length)
    })
  })

  describe("гиперпрыжок через аномалию", () => {
    it("разгон вверх, хлопок выхода и низкий удар прибытия", () => {
      const { sfx, log } = makeSfx()
      sfx.anomalyJump()

      expect(log.tones[0].slideTo!).toBeGreaterThan(log.tones[0].freq)
      expect(log.noises.length).toBeGreaterThanOrEqual(1)
      const arrival = log.tones[log.tones.length - 1]
      expect(arrival.delay).toBeGreaterThan(0.3)
      expect(arrival.freq).toBeLessThan(150)
    })
  })

  it("все сюжетные звуки молчат, когда эффекты выключены", () => {
    const { sfx, log } = makeSfx()
    sfx.muted = true
    sfx.transmission("kraken")
    sfx.stationHatch()
    sfx.gelVent()
    sfx.bossPhase("chrono")
    sfx.anomalyJump()

    expect(log.tones.length).toBe(0)
    expect(log.noises.length).toBe(0)
  })
})
