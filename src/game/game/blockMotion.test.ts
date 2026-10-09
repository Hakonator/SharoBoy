import { describe, expect, it } from "vitest"

import { DRIFT_MAX_RADIUS_MULT, PULSE_AMPLITUDE } from "../blockKinds"
import type { Game } from "../game"
import type { Block } from "../types"

import { stepBlock } from "./blockMotion"

/** Минимальный фейковый Game: stepBlock читает time/w/h и blockTop. */
function makeGame(time: number, over: Partial<Game> = {}): Game {
  return { time, w: 800, h: 600, cssW: 1920, cssH: 1080, scale: 1, ...over } as unknown as Game
}

function makeBlock(over: Partial<Block> = {}): Block {
  return {
    x: 200,
    y: 150,
    rx: 30,
    ry: 16,
    rot: 0,
    circle: false,
    hp: 2,
    maxHp: 2,
    tier: 1,
    flash: 0,
    seed: 0.5,
    dead: false,
    x0: 200,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
    ...over,
  }
}

describe("stepBlock — базовые дрейфы", () => {
  it("сеточное покачивание сохранено: x = x0 + sin(t·freq+ph)·amp", () => {
    const b = makeBlock({ swayAmp: 10, swayFreq: 1, swayPh: 0 })
    stepBlock(makeGame(Math.PI / 2), b, 0.016)
    expect(b.x).toBeCloseTo(210)
  })

  it("минибосс движется целиком и не выходит за боковую границу", () => {
    const parts = [
      makeBlock({ x: 80, x0: 80, rx: 40, isMiniboss: true, mbGroup: 7, swayAmp: 500, swayFreq: 1 }),
      makeBlock({
        x: 720,
        x0: 720,
        rx: 40,
        isMiniboss: true,
        mbGroup: 7,
        swayAmp: 500,
        swayFreq: 1,
      }),
    ]
    const game = makeGame(Math.PI / 2, { blocks: parts })
    for (const part of parts) stepBlock(game, part, 0.016)
    expect(parts[0].x).toBe(116)
    expect(parts[1].x).toBe(756)
    expect(parts[1].x - parts[0].x).toBe(640)
  })

  it("минибосс проходит весь доступный горизонтальный диапазон", () => {
    const part = makeBlock({
      x: 200,
      x0: 200,
      rx: 30,
      ry: 10,
      rot: Math.PI / 4,
      isMiniboss: true,
      mbGroup: 3,
      swayAmp: 500,
      swayFreq: 1,
      swayPh: -Math.PI / 2,
    })
    const game = makeGame(0, { blocks: [part] })
    const rotatedRadius = Math.hypot(part.rx * Math.cos(part.rot), part.ry * Math.sin(part.rot))
    const minCenter = 4 + rotatedRadius
    const maxCenter = game.w - 4 - rotatedRadius

    stepBlock(game, part, 0.016)
    expect(part.x).toBeCloseTo(minCenter)
    game.time = Math.PI
    stepBlock(game, part, 0.016)
    expect(part.x).toBeCloseTo(maxCenter)
  })

  it("вертикальный дрейф медузы сохранён (база y0)", () => {
    const b = makeBlock({ y0: 150, bobAmp: 20, bobFreq: 1, bobPh: 0 })
    stepBlock(makeGame(Math.PI / 2), b, 0.016)
    expect(b.y).toBeCloseTo(170)
  })
})

describe("stepBlock — неигровая HUD-зона сверху во всех ориентациях", () => {
  // портретный Game: 390×844, scale 1 → hudTopCss = 140 → blockTop = 140,
  // клампы h*0.14..h*0.35 (140..350) не бьют; лимит блока = blockTop + ry
  function portraitGame(time: number, over: Partial<Game> = {}): Game {
    return makeGame(time, { cssW: 390, cssH: 844, scale: 1, w: 800, h: 1000, ...over })
  }

  it("в ландшафте блоки не заходят в HUD-зону", () => {
    const b = makeBlock({ y: 40, y0: 40, bobAmp: 40, bobFreq: 1, bobPh: 0 })
    stepBlock(makeGame(Math.PI / 2), b, 0.016) // верхняя граница = 96
    expect(b.y).toBe(96 + 16)
  })

  it("вертикальный дрейф медузы не поднимает блок в HUD-зону", () => {
    const b = makeBlock({ y: 40, y0: 40, bobAmp: 40, bobFreq: 1, bobPh: 0 })
    stepBlock(portraitGame(Math.PI / 2), b, 0.016) // сырой y = 80 < yMin
    expect(b.y).toBe(140 + 16)
  })

  it("дрейф §6 по вертикали клампится границей HUD-зоны", () => {
    const b = makeBlock({ y: 40, y0: 40, sp: { drift: { kind: "v", amp: 60, freq: 1, ph: 0 } } })
    stepBlock(portraitGame(Math.PI / 2), b, 0.016)
    expect(b.y - b.ry).toBeGreaterThanOrEqual(140)
  })

  it("вертикальный дрейф остаётся ниже HUD на всём диапазоне и не меняет X", () => {
    const b = makeBlock({
      x: 200,
      x0: 200,
      y: 150,
      y0: 150,
      ry: 16,
      sp: { drift: { kind: "v", amp: 500, freq: 1, ph: 0 } },
    })
    const game = portraitGame(0)
    for (let i = 0; i <= 12; i++) {
      game.time = (Math.PI * i) / 6
      stepBlock(game, b, 0.016)
      expect(b.y - b.ry).toBeGreaterThanOrEqual(140)
      expect(b.x).toBe(200)
    }
  })

  it("дрейф §6 по окружности тоже уважает границу", () => {
    const b = makeBlock({
      y: 40,
      y0: 40,
      x0: 200,
      sp: { drift: { kind: "circle", amp: 60, freq: 1, ph: 0 } },
    })
    stepBlock(portraitGame(Math.PI / 2), b, 0.016)
    expect(b.y - b.ry).toBeGreaterThanOrEqual(140)
  })

  it("масштаб окна учитывается: 140 css px / scale", () => {
    // scale 0.5 → 280 мировых (кламп h*0.35 = 350 не бьёт при h = 1000)
    const b = makeBlock({ y: 40, y0: 40, bobAmp: 40, bobFreq: 1, bobPh: 0 })
    stepBlock(portraitGame(Math.PI / 2, { scale: 0.5 }), b, 0.016)
    expect(b.y).toBe(140 / 0.5 + 16)
  })
})

describe("stepBlock — спецблоки §6", () => {
  it("дрейф по горизонтали: x уходит от x0 на sin·amp", () => {
    const b = makeBlock({ sp: { drift: { kind: "h", amp: 14, freq: 1, ph: 0 } } })
    stepBlock(makeGame(0), b, 0.016)
    expect(b.x).toBeCloseTo(200) // sin(0) = 0
    stepBlock(makeGame(Math.PI / 2), b, 0.016)
    expect(b.x).toBeCloseTo(214)
    expect(b.y).toBe(150) // по вертикали не двигается
  })

  it("ограничивает амплитуду дрейфа тремя размерами блока", () => {
    const horizontal = makeBlock({
      rx: 10,
      sp: { drift: { kind: "h", amp: 100, freq: 1, ph: 0 } },
    })
    const vertical = makeBlock({
      ry: 8,
      sp: { drift: { kind: "v", amp: 100, freq: 1, ph: 0 } },
    })
    stepBlock(makeGame(Math.PI / 2), horizontal, 0.016)
    stepBlock(makeGame(Math.PI / 2), vertical, 0.016)
    expect(horizontal.x - horizontal.x0).toBeCloseTo(10 * DRIFT_MAX_RADIUS_MULT)
    expect(vertical.y - (vertical.y0 ?? 150)).toBeCloseTo(8 * DRIFT_MAX_RADIUS_MULT)
  })

  it("дрейф по окружности двигает и x, и y (эллипс 0.6 по вертикали)", () => {
    const b = makeBlock({ y0: 150, sp: { drift: { kind: "circle", amp: 20, freq: 1, ph: 0 } } })
    stepBlock(makeGame(Math.PI / 2), b, 0.016)
    expect(b.x).toBeCloseTo(200, 5) // cos(π/2) = 0
    expect(b.y).toBeCloseTo(162) // sin(π/2)·20·0.6 = 12
  })

  it("дрейф по вертикали использует y0 как базу", () => {
    const b = makeBlock({ y0: 150, sp: { drift: { kind: "v", amp: 10, freq: 1, ph: 0 } } })
    stepBlock(makeGame(-Math.PI / 2), b, 0.016)
    expect(b.y).toBeCloseTo(140)
  })

  it("пульсация: rx/ry колеблются вокруг базовых, хитбокс следует за визуалом", () => {
    const b = makeBlock({ sp: { pulse: { freq: 1, ph: 0, rx0: 30, ry0: 16 } } })
    stepBlock(makeGame(Math.PI / 2), b, 0.016)
    const k = 1 + PULSE_AMPLITUDE
    expect(b.rx).toBeCloseTo(30 * k)
    expect(b.ry).toBeCloseTo(16 * k)
  })

  it("вращение: угол интегрируется, rotVel затухает и обнуляется", () => {
    const b = makeBlock({ sp: { rotVel: 2 } })
    stepBlock(makeGame(0), b, 0.1)
    expect(b.rot).toBeCloseTo(0.2)
    const decayed = 2 * Math.exp(-0.1 * 1.1)
    expect(b.sp!.rotVel).toBeCloseTo(decayed)
    // long stall: за ~10 с трение погасит вращение
    for (let i = 0; i < 600; i++) stepBlock(makeGame(i * 0.016), b, 0.016)
    expect(b.sp!.rotVel).toBe(0)
  })

  it("предсмертное вращение длится ровно одну секунду", () => {
    const b = makeBlock({ spinDeathT: 1, sp: { rotVel: 6, rotDir: 1 } })
    stepBlock(makeGame(0), b, 0.4)
    expect(b.spinDeathT).toBeCloseTo(0.6)
    expect(b.hp).toBe(2)
    stepBlock(makeGame(0.4), b, 0.6)
    expect(b.spinDeathT).toBe(0)
    expect(b.hp).toBe(2)
  })

  it("кулдаун портала тикает вниз до нуля", () => {
    const b = makeBlock({ sp: { portalId: 1, portalCd: 1.0 } })
    stepBlock(makeGame(0), b, 0.5)
    expect(b.sp!.portalCd).toBeCloseTo(0.5)
    stepBlock(makeGame(0.5), b, 0.6)
    expect(b.sp!.portalCd).toBe(0)
  })

  it("блок без спецтипа просто не меняется сверх сеточных дрейфов", () => {
    const b = makeBlock()
    stepBlock(makeGame(3), b, 0.016)
    expect(b.sp).toBeUndefined()
    expect(b.rx).toBe(30)
    expect(b.rot).toBe(0)
  })
})
