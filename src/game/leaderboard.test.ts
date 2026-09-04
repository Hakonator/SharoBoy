import { describe, expect, it } from "vitest"

import { dedupeTop, isSigValid, screenClass, signScore, type GlobalScore } from "./leaderboard"

describe("screenClass — категория экрана", () => {
  it("мобильные экраны относятся к mobile", () => {
    expect(screenClass(390, 844)).toBe("mobile")
    expect(screenClass(768, 1024)).toBe("mobile")
  })

  it("HD/FHD/2K относятся к fhd", () => {
    expect(screenClass(1920, 1080)).toBe("fhd")
    expect(screenClass(2560, 1440)).toBe("fhd")
  })

  it("4K и выше относятся к 4k", () => {
    expect(screenClass(3840, 2160)).toBe("4k")
    expect(screenClass(5120, 2880)).toBe("4k")
  })
})

describe("signScore — подпись очков", () => {
  it("возвращает 8-символьную hex-строку", () => {
    const sig = signScore("Игрок", 12345, "campaign", 3)
    expect(sig).toMatch(/^[0-9a-f]{8}$/)
  })

  it("детерминирована: одинаковый ввод — одинаковая подпись", () => {
    const a = signScore("Шарик", 777, "endless", 2)
    const b = signScore("Шарик", 777, "endless", 2)
    expect(a).toBe(b)
  })

  it("меняется при изменении любого поля записи", () => {
    const base = signScore("Шарик", 777, "endless", 2)
    expect(signScore("Другой", 777, "endless", 2)).not.toBe(base)
    expect(signScore("Шарик", 778, "endless", 2)).not.toBe(base)
    expect(signScore("Шарик", 777, "campaign", 2)).not.toBe(base)
    expect(signScore("Шарик", 777, "endless", 3)).not.toBe(base)
  })

  it("не склеивает поля: разные комбинации дают разные строки хеширования", () => {
    // nick="a", score=12 → "a:12:endless:3:S"  vs  nick="a:12", score=0 → "a:12:0:endless:3:S"
    expect(signScore("a", 12, "endless", 3)).not.toBe(signScore("a:12", 0, "endless", 3))
  })

  it("разные категории экрана дают разные подписи", () => {
    const base = signScore("Шарик", 777, "endless", 2)
    const mobile = signScore("Шарик", 777, "endless", 2, "mobile")
    const fhd = signScore("Шарик", 777, "endless", 2, "fhd")
    expect(mobile).not.toBe(base)
    expect(fhd).not.toBe(base)
    expect(mobile).not.toBe(fhd)
  })
})

describe("isSigValid — проверка подписи строки результата", () => {
  const row = (over: Partial<GlobalScore>): GlobalScore => ({
    nick: "Игрок",
    score: 1234,
    wave: 5,
    client_sig: signScore("Игрок", 1234, "campaign", 5),
    ...over,
  })

  it("принимает строку с корректной подписью", () => {
    expect(isSigValid(row({}), "campaign")).toBe(true)
  })

  it("принимает строку без wave как wave=0", () => {
    // строки из БД кастятся as GlobalScore[] — wave может отсутствовать
    const noWave = {
      nick: "Игрок",
      score: 100,
      client_sig: signScore("Игрок", 100, "endless", 0),
    } as unknown as GlobalScore
    expect(isSigValid(noWave, "endless")).toBe(true)
  })

  it("отклоняет отсутствующую подпись", () => {
    expect(isSigValid(row({ client_sig: undefined }), "campaign")).toBe(false)
    expect(isSigValid(row({ client_sig: null }), "campaign")).toBe(false)
    expect(isSigValid(row({ client_sig: "" }), "campaign")).toBe(false)
  })

  it("отклоняет подпись неверной длины", () => {
    expect(isSigValid(row({ client_sig: "abc123" }), "campaign")).toBe(false)
    expect(isSigValid(row({ client_sig: "a".repeat(9) }), "campaign")).toBe(false)
  })

  it("отклоняет подделанные данные (score/wave/nick изменены)", () => {
    expect(isSigValid(row({ score: 99999 }), "campaign")).toBe(false)
    expect(isSigValid(row({ wave: 1 }), "campaign")).toBe(false)
    expect(isSigValid(row({ nick: "Злодей" }), "campaign")).toBe(false)
  })

  it("отклоняет подпись из другого режима", () => {
    expect(isSigValid(row({}), "endless")).toBe(false)
  })

  it("принимает подпись с категорией экрана", () => {
    const withScreen: GlobalScore = {
      nick: "Игрок",
      score: 1234,
      wave: 5,
      screen_class: "fhd",
      client_sig: signScore("Игрок", 1234, "campaign", 5, "fhd"),
    }
    expect(isSigValid(withScreen, "campaign", "fhd")).toBe(true)
  })

  it("отклоняет подпись с чужой категорией экрана", () => {
    const withMobile: GlobalScore = {
      nick: "Игрок",
      score: 1234,
      wave: 5,
      screen_class: "mobile",
      client_sig: signScore("Игрок", 1234, "campaign", 5, "mobile"),
    }
    expect(isSigValid(withMobile, "campaign", "fhd")).toBe(false)
  })

  it("принимает старую подпись без категории даже при фильтре", () => {
    // старые записи (без screen_class) не должны пропадать из топа
    expect(isSigValid(row({}), "campaign", "fhd")).toBe(true)
  })
})

describe("dedupeTop — одна позиция топа на игрока", () => {
  const row = (nick: string, score: number): GlobalScore => ({ nick, score, wave: 0 })

  it("оставляет лучший результат игрока при сортировке по score по убыванию", () => {
    const rows = [row("Игрок", 300), row("Соперник", 200), row("Игрок", 100)]
    expect(dedupeTop(rows)).toEqual([row("Игрок", 300), row("Соперник", 200)])
  })

  it("считает одним игроком ник в разном регистре", () => {
    const rows = [row("AAA", 500), row("bbb", 450), row("aaa", 400)]
    expect(dedupeTop(rows)).toEqual([row("AAA", 500), row("bbb", 450)])
  })

  it("не меняет список без повторов", () => {
    const rows = [row("Аня", 300), row("Боря", 200), row("Вера", 100)]
    expect(dedupeTop(rows)).toEqual(rows)
  })
})
