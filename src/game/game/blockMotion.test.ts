import { describe, expect, it } from "vitest"

import { PULSE_AMPLITUDE } from "../blockKinds"
import type { Game } from "../game"
import type { Block } from "../types"

import { stepBlock } from "./blockMotion"

/** Минимальный фейковый Game: stepBlock читает только time/w/h. */
function makeGame(time: number): Game {
  return { time, w: 800, h: 600 } as unknown as Game
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

  it("вертикальный дрейф медузы сохранён (база y0)", () => {
    const b = makeBlock({ y0: 150, bobAmp: 20, bobFreq: 1, bobPh: 0 })
    stepBlock(makeGame(Math.PI / 2), b, 0.016)
    expect(b.y).toBeCloseTo(170)
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
