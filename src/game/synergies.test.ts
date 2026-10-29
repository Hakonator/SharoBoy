import { describe, expect, it } from "vitest"

import {
  SYNERGIES_META,
  getActiveSynergies,
  isChainResonanceActive,
  isGravitationalJuggernautActive,
  isKineticSniperActive,
  type SynergyDetectorState,
  type SynergyId,
} from "./synergies"

describe("Synergies Engine (T-040, §3.1 Roadmap)", () => {
  describe("Метаданные синергий", () => {
    it("содержит описания для всех 3 синергий дорожной карты", () => {
      const ids: SynergyId[] = ["kinetic_sniper", "chain_resonance", "gravitational_juggernaut"]
      for (const id of ids) {
        const meta = SYNERGIES_META[id]
        expect(meta).toBeDefined()
        expect(meta.name.length).toBeGreaterThan(0)
        expect(meta.shortName.length).toBeGreaterThan(0)
        expect(meta.desc.length).toBeGreaterThan(0)
        expect(meta.ingredients.length).toBeGreaterThanOrEqual(2)
        expect(meta.icon.length).toBeGreaterThan(0)
        expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })
  })

  describe("«Кинетический Снайпер» (Kinetic Sniper)", () => {
    it("не активен, если нет проникающего шара", () => {
      const state: SynergyDetectorState = {
        time: 5,
        pierceUntil: 0,
        magnetUntil: 15,
      }
      expect(isKineticSniperActive(state)).toBe(false)
    })

    it("не активен, если нет магнитной ракетки", () => {
      const state: SynergyDetectorState = {
        time: 5,
        pierceUntil: 15,
        magnetUntil: 0,
        magneticPaddleUntil: 0,
      }
      expect(isKineticSniperActive(state)).toBe(false)
    })

    it("активен при сочетании pierceUntil и magnetUntil", () => {
      const state: SynergyDetectorState = {
        time: 5,
        pierceUntil: 15,
        magnetUntil: 15,
      }
      expect(isKineticSniperActive(state)).toBe(true)
    })

    it("активен при сочетании pierceUntil и magneticPaddleUntil", () => {
      const state: SynergyDetectorState = {
        time: 5,
        pierceUntil: 15,
        magneticPaddleUntil: 15,
      }
      expect(isKineticSniperActive(state)).toBe(true)
    })

    it("поддерживает функциональные геттеры pierceActive и magnetActive", () => {
      const state: SynergyDetectorState = {
        pierceActive: () => true,
        magnetActive: () => true,
      }
      expect(isKineticSniperActive(state)).toBe(true)
    })
  })

  describe("«Цепной Резонанс» (Chain Resonance)", () => {
    it("не активен, если нет взрывного шара", () => {
      const state: SynergyDetectorState = {
        time: 5,
        explosiveUntil: 0,
        sparkUntil: 15,
      }
      expect(isChainResonanceActive(state)).toBe(false)
    })

    it("активен при сочетании explosiveUntil и sparkUntil", () => {
      const state: SynergyDetectorState = {
        time: 5,
        explosiveUntil: 15,
        sparkUntil: 15,
      }
      expect(isChainResonanceActive(state)).toBe(true)
    })

    it("активен при сочетании explosiveUntil и реликвии relicSpark", () => {
      const state: SynergyDetectorState = {
        time: 5,
        explosiveUntil: 15,
        campaignRelics: { relicSpark: true },
      }
      expect(isChainResonanceActive(state)).toBe(true)
    })

    it("активен при сочетании explosiveUntil и хрупких цепных блоков на поле", () => {
      const state: SynergyDetectorState = {
        time: 5,
        explosiveUntil: 15,
        blocks: [
          { dead: true, sp: { brittle: { radius: 60 } } },
          { dead: false, sp: { brittle: { radius: 60 } } },
        ],
      }
      expect(isChainResonanceActive(state)).toBe(true)
    })

    it("не активен, если все цепные блоки на поле уже разрушены (dead: true)", () => {
      const state: SynergyDetectorState = {
        time: 5,
        explosiveUntil: 15,
        blocks: [{ dead: true, sp: { brittle: { radius: 60 } } }],
      }
      expect(isChainResonanceActive(state)).toBe(false)
    })
  })

  describe("«Гравитационный Джаггернаут» (Gravitational Juggernaut)", () => {
    it("не активен, если нет увеличенного шара (big)", () => {
      const state: SynergyDetectorState = {
        time: 5,
        bigUntil: 0,
        campaignModifiers: ["heavy_gravity"],
      }
      expect(isGravitationalJuggernautActive(state)).toBe(false)
    })

    it("активен при сочетании bigUntil и мутатора heavy_gravity", () => {
      const state: SynergyDetectorState = {
        time: 5,
        bigUntil: 15,
        campaignModifiers: ["heavy_gravity"],
      }
      expect(isGravitationalJuggernautActive(state)).toBe(true)
    })

    it("активен при сочетании bigUntil и защитной реликвии relicBulwark", () => {
      const state: SynergyDetectorState = {
        time: 5,
        bigUntil: 15,
        campaignRelics: { relicBulwark: true },
      }
      expect(isGravitationalJuggernautActive(state)).toBe(true)
    })

    it("поддерживает функциональные геттеры bigActive и heavyGravityActive", () => {
      const state: SynergyDetectorState = {
        bigActive: () => true,
        heavyGravityActive: () => true,
      }
      expect(isGravitationalJuggernautActive(state)).toBe(true)
    })
  })

  describe("getActiveSynergies", () => {
    it("возвращает пустой массив при отсутствии активных компонентов", () => {
      expect(getActiveSynergies({ time: 10 })).toEqual([])
    })

    it("корректно возвращает несколько одновременно активных синергий", () => {
      const state: SynergyDetectorState = {
        time: 10,
        pierceUntil: 20,
        magnetUntil: 20,
        explosiveUntil: 20,
        sparkUntil: 20,
        bigUntil: 20,
        campaignRelics: { relicBulwark: true },
      }
      const active = getActiveSynergies(state)
      expect(active).toContain("kinetic_sniper")
      expect(active).toContain("chain_resonance")
      expect(active).toContain("gravitational_juggernaut")
      expect(active).toHaveLength(3)
    })
  })
})
