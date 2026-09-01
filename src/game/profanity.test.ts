import { describe, expect, it } from "vitest"

import { containsProfanity, normalizeForCheck, validateNick } from "./profanity"

describe("normalizeForCheck — «скелет» ника", () => {
  it("убирает регистр, разделители и удвоение букв", () => {
    expect(normalizeForCheck("Х-у-Й")).toBe("хуй")
    expect(normalizeForCheck("б л я")).toBe("бля")
    expect(normalizeForCheck("пППииЗдА")).toBe("пизда")
    expect(normalizeForCheck("Привет  Мир")).toBe("приветмир")
  })

  it("переводит leet-подмены и латинских двойников в кириллицу", () => {
    expect(normalizeForCheck("xyй")).toBe("хуй") // x → х
    expect(normalizeForCheck("е6ать")).toBe("ебать") // 6 → б
    expect(normalizeForCheck("П1здЕц")).toBe("пиздец") // 1 → и
    expect(normalizeForCheck("ё")).toBe("е") // ё → е
  })
})

describe("containsProfanity — русский мат", () => {
  it("ловит прямые написания", () => {
    expect(containsProfanity("хуй")).toBe(true)
    expect(containsProfanity("ХУЙ")).toBe(true)
    expect(containsProfanity("Хуёк")).toBe(true) // хуе
    expect(containsProfanity("бля")).toBe(true)
    expect(containsProfanity("ебать")).toBe(true)
    expect(containsProfanity("долбоёб")).toBe(true) // «оеб»
    expect(containsProfanity("мудак")).toBe(true)
    expect(containsProfanity("пидор")).toBe(true)
  })

  it("ловит обходы: разделители, регистр, leet, дубли, латиница-двойники", () => {
    for (const bad of [
      "Б-л-я",
      "х у й",
      "xyй", // латинский x
      "хyй", // латинский y
      "XYЙ",
      "хуя",
      "6лядь", // 6 → б
      "ппиздец",
      "ъеба",
    ]) {
      expect(containsProfanity(bad), `не поймали: ${bad}`).toBe(true)
    }
  })

  it("ловит русский мат латиницей", () => {
    for (const bad of ["xyu", "xyi", "huy", "naxy", "nahuy", "naxuy"]) {
      expect(containsProfanity(bad), `не поймали: ${bad}`).toBe(true)
    }
  })
})

describe("containsProfanity — английский мат", () => {
  it("ловит прямые написания", () => {
    for (const bad of [
      "fuck",
      "Fuck",
      "shit",
      "bitch",
      "asshole",
      "cunt",
      "nigg",
      "dick",
      "pussy",
    ]) {
      expect(containsProfanity(bad), `не поймали: ${bad}`).toBe(true)
    }
  })

  it("ловит обходы: разделители, дубли, leet, кириллические двойники", () => {
    for (const bad of [
      "f.u.c.k",
      "fuuuck",
      "sh1t", // 1 → и → i (латинская форма)
      "5h1t", // 5 → s
      "sh!t", // ! → и → i
      "fuск", // «ск» — кириллические двойники
      "5H1T",
    ]) {
      expect(containsProfanity(bad), `не поймали: ${bad}`).toBe(true)
    }
  })
})

describe("containsProfanity — ложные срабатывания", () => {
  it("не блокирует обычные ники", () => {
    for (const good of [
      "ПростоИгрок",
      "шарик_77",
      "Pro-Gamer",
      "Ник0ла",
      "Ассоль",
      "Классика",
      "Никитос",
      "Gagarin",
      "Сундук",
      "ХомяК",
      "Шито-крыто",
      "user123",
      "Мастер.Овала",
    ]) {
      expect(containsProfanity(good), `ложное срабатывание: ${good}`).toBe(false)
    }
  })
})

describe("validateNick", () => {
  it("принимает корректный ник и нормализует пробелы", () => {
    const res = validateNick("  Просто   Игрок  ")
    expect(res.ok).toBe(true)
    expect(res.nick).toBe("Просто Игрок")
    expect(res.error).toBeNull()
  })

  it("отклоняет короткие и длинные", () => {
    expect(validateNick("я").ok).toBe(false)
    expect(validateNick("этотникслишкомдлинныйдляигры").ok).toBe(false)
  })

  it("отклоняет недопустимые символы", () => {
    for (const bad of ["<script>", "ник😁", "a/b", "ник;drop"]) {
      expect(validateNick(bad).ok, `пропустили: ${bad}`).toBe(false)
    }
  })

  it("отклоняет мат", () => {
    expect(validateNick("xyй").ok).toBe(false)
    expect(validateNick("fuck").ok).toBe(false)
    expect(validateNick("Б-л-я").ok).toBe(false)
  })
})
