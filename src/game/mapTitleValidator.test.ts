import { describe, expect, it } from "vitest"

import { canonicalMapTitle, isTitleCollision, validateMapTitle } from "./mapTitleValidator"

describe("mapTitleValidator", () => {
  describe("validateMapTitle", () => {
    it("accepts valid Russian titles", () => {
      const res = validateMapTitle("Лабиринт теней 2")
      expect(res.ok).toBe(true)
      expect(res.title).toBe("Лабиринт теней 2")
    })

    it("accepts valid English titles", () => {
      const res = validateMapTitle("Neon Fortress v2")
      expect(res.ok).toBe(true)
      expect(res.title).toBe("Neon Fortress v2")
    })

    it("rejects short or empty titles", () => {
      expect(validateMapTitle("").ok).toBe(false)
      expect(validateMapTitle(" ").ok).toBe(false)
      expect(validateMapTitle("A").ok).toBe(false)
    })

    it("rejects titles longer than 60 characters", () => {
      const longTitle = "А".repeat(61)
      const res = validateMapTitle(longTitle)
      expect(res.ok).toBe(false)
      expect(res.error).toContain("не может быть длиннее 60")
    })

    it("rejects mixed Russian and Latin scripts (spoofing protection)", () => {
      // Русское 'Карта' с латинской 'K' и 'a'
      const mixed1 = "Kартa"
      const res1 = validateMapTitle(mixed1)
      expect(res1.ok).toBe(false)
      expect(res1.error).toContain("нельзя смешивать русские и латинские буквы")

      // Английское 'Level' с русской 'е'
      const mixed2 = "Lеvеl"
      const res2 = validateMapTitle(mixed2)
      expect(res2.ok).toBe(false)
      expect(res2.error).toContain("нельзя смешивать русские и латинские буквы")
    })

    it("rejects profanity", () => {
      const res = validateMapTitle("хуйло карта")
      expect(res.ok).toBe(false)
      expect(res.error).toContain("недопустимые выражения")
    })

    it("rejects titles with only punctuation or symbols", () => {
      expect(validateMapTitle("---").ok).toBe(false)
      expect(validateMapTitle("!??").ok).toBe(false)
    })
  })

  describe("canonicalMapTitle & isTitleCollision", () => {
    it("normalizes case, whitespace and punctuation", () => {
      expect(canonicalMapTitle("Супер Карта!")).toBe("суперкарта")
      expect(canonicalMapTitle("  супер-карта  ")).toBe("суперкарта")
    })

    it("maps homoglyphs between Latin and Cyrillic", () => {
      // Латинская 'C', 'y', 'p', 'e', 'p' против кириллической 'Супер'
      // с гомоглифами: c->с, y->у, p->р, e->е
      const cyrillic = "Арена"
      const latinHomoglyphs = "ApeHa"
      expect(canonicalMapTitle(cyrillic)).toBe(canonicalMapTitle(latinHomoglyphs))
      expect(isTitleCollision(cyrillic, latinHomoglyphs)).toBe(true)
    })

    it("detects collisions between visually identical titles", () => {
      expect(isTitleCollision("Арена Битвы", "арена битвы")).toBe(true)
      expect(isTitleCollision("Арена Битвы", "Арена-Битвы!")).toBe(true)
      expect(isTitleCollision("Арена", "Стадион")).toBe(false)
    })
  })
})
