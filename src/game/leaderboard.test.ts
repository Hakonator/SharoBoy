import { describe, expect, it } from "vitest"

import { fnv1a, sigFor, sigMatches, type SigRow } from "../../supabase/functions/scores/sig"

import { dedupeTop, screenClass, type GlobalScore } from "./leaderboard"

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

/** Тестовое значение секрета; реальный секрет живёт в секретах Edge Function. */
const SECRET = "test-secret"

describe("fnv1a — 32-битный FNV-1a хеш", () => {
  it("совпадает с эталонными векторами FNV-1a", () => {
    expect(fnv1a("")).toBe("811c9dc5")
    expect(fnv1a("a")).toBe("e40c292c")
    expect(fnv1a("foobar")).toBe("bf9cf968")
  })
})

describe("sigFor — серверная подпись очков", () => {
  it("возвращает 8-символьную hex-строку", () => {
    expect(sigFor("Игрок", 12345, "campaign", 3, undefined, SECRET)).toMatch(/^[0-9a-f]{8}$/)
  })

  it("детерминирована: одинаковый ввод — одинаковая подпись", () => {
    const a = sigFor("Шарик", 777, "endless", 2, undefined, SECRET)
    expect(sigFor("Шарик", 777, "endless", 2, undefined, SECRET)).toBe(a)
  })

  it("меняется при изменении любого поля записи или секрета", () => {
    const base = sigFor("Шарик", 777, "endless", 2, undefined, SECRET)
    expect(sigFor("Другой", 777, "endless", 2, undefined, SECRET)).not.toBe(base)
    expect(sigFor("Шарик", 778, "endless", 2, undefined, SECRET)).not.toBe(base)
    expect(sigFor("Шарик", 777, "campaign", 2, undefined, SECRET)).not.toBe(base)
    expect(sigFor("Шарик", 777, "endless", 3, undefined, SECRET)).not.toBe(base)
    expect(sigFor("Шарик", 777, "endless", 2, undefined, "другой-секрет")).not.toBe(base)
  })

  it("не склеивает поля: разные комбинации дают разные строки хеширования", () => {
    // nick="a", score=12 → "a:12:endless:3:S"  vs  nick="a:12", score=0 → "a:12:0:endless:3:S"
    expect(sigFor("a", 12, "endless", 3, undefined, SECRET)).not.toBe(
      sigFor("a:12", 0, "endless", 3, undefined, SECRET)
    )
  })

  it("разные категории экрана дают разные подписи", () => {
    const base = sigFor("Шарик", 777, "endless", 2, undefined, SECRET)
    const mobile = sigFor("Шарик", 777, "endless", 2, "mobile", SECRET)
    const fhd = sigFor("Шарик", 777, "endless", 2, "fhd", SECRET)
    expect(mobile).not.toBe(base)
    expect(fhd).not.toBe(base)
    expect(mobile).not.toBe(fhd)
  })
})

describe("sigMatches — серверная проверка подписи строки", () => {
  const row = (over: Partial<SigRow>): SigRow => ({
    nick: "Игрок",
    score: 1234,
    wave: 5,
    client_sig: sigFor("Игрок", 1234, "campaign", 5, undefined, SECRET),
    ...over,
  })

  it("принимает строку с корректной подписью", () => {
    expect(sigMatches(row({}), "campaign", undefined, SECRET)).toBe(true)
  })

  it("принимает строку без wave как wave=0", () => {
    // строки из БД приходят как есть — wave может отсутствовать
    const noWave: SigRow = {
      nick: "Игрок",
      score: 100,
      client_sig: sigFor("Игрок", 100, "endless", 0, undefined, SECRET),
    }
    expect(sigMatches(noWave, "endless", undefined, SECRET)).toBe(true)
  })

  it("отклоняет отсутствующую подпись", () => {
    expect(sigMatches(row({ client_sig: undefined }), "campaign", undefined, SECRET)).toBe(false)
    expect(sigMatches(row({ client_sig: null }), "campaign", undefined, SECRET)).toBe(false)
    expect(sigMatches(row({ client_sig: "" }), "campaign", undefined, SECRET)).toBe(false)
  })

  it("отклоняет подпись неверной длины", () => {
    expect(sigMatches(row({ client_sig: "abc123" }), "campaign", undefined, SECRET)).toBe(false)
    expect(sigMatches(row({ client_sig: "a".repeat(9) }), "campaign", undefined, SECRET)).toBe(
      false
    )
  })

  it("отклоняет подделанные данные (score/wave/nick изменены)", () => {
    expect(sigMatches(row({ score: 99999 }), "campaign", undefined, SECRET)).toBe(false)
    expect(sigMatches(row({ wave: 1 }), "campaign", undefined, SECRET)).toBe(false)
    expect(sigMatches(row({ nick: "Злодей" }), "campaign", undefined, SECRET)).toBe(false)
  })

  it("отклоняет подпись из другого режима", () => {
    expect(sigMatches(row({}), "endless", undefined, SECRET)).toBe(false)
  })

  it("принимает подпись с категорией экрана", () => {
    const withScreen: SigRow = {
      nick: "Игрок",
      score: 1234,
      wave: 5,
      screen_class: "fhd",
      client_sig: sigFor("Игрок", 1234, "campaign", 5, "fhd", SECRET),
    }
    expect(sigMatches(withScreen, "campaign", "fhd", SECRET)).toBe(true)
  })

  it("отклоняет подпись с чужой категорией экрана", () => {
    const withMobile: SigRow = {
      nick: "Игрок",
      score: 1234,
      wave: 5,
      screen_class: "mobile",
      client_sig: sigFor("Игрок", 1234, "campaign", 5, "mobile", SECRET),
    }
    expect(sigMatches(withMobile, "campaign", "fhd", SECRET)).toBe(false)
  })

  it("принимает старую подпись без категории даже при фильтре", () => {
    // старые записи (без screen_class) не должны пропадать из топа
    expect(sigMatches(row({}), "campaign", "fhd", SECRET)).toBe(true)
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
