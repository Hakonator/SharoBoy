import { describe, expect, it } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"

import { addMiniboss, resetMiniboss } from "./minibossRuntime"

/** Регресс «невидимой медузы»: дуэт рыба+медуза не должен уродовать существа. */
describe("addMiniboss: дуэт двух существ в уровне", () => {
  it("оба существа целы: у медузы купол, у рыбы тело; второе смещено вправо", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      resetMiniboss(game)
      game.phase = "playing"
      addMiniboss(game, "fish")
      addMiniboss(game, "jelly")

      const fish = game.blocks.filter((b) => (b.mbGroup ?? 0) === 1)
      const jelly = game.blocks.filter((b) => (b.mbGroup ?? 0) === 2)
      // рыба: 3 body + 3 tail + dorsal + pectoral + eye; медуза: 2+7+20
      expect(fish.length).toBe(9)
      expect(jelly.length).toBe(29)
      expect(fish.filter((b) => b.mbPart === "body").length).toBe(3)
      expect(jelly.filter((b) => b.mbPart === "dome").length).toBe(2)

      // центр второго существа смещён на MINIBOSS_DUET_SHIFT ширины поля
      const dome = jelly.filter((b) => b.mbPart === "dome")
      const jellyCx = dome.reduce((s, b) => s + b.x, 0) / dome.length
      expect(jellyCx).toBeCloseTo(game.w / 2 + game.w * 0.22)

      // запись о существе в g.minibosses цела — HP-полоска соответствует живому
      expect(game.minibosses.map((c) => c.kind)).toEqual(["fish", "jelly"])
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("обычные блоки уровня под существами вырезаются, чужие существа — нет", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      resetMiniboss(game)
      game.phase = "playing"
      game.blocks = game.blocks.filter((b) => !b.isMiniboss)
      const levelBefore = game.blocks.length
      addMiniboss(game, "jelly") // первое — в центре
      const jellyBlocks = game.blocks.length - levelBefore
      const levelAfterFirst = game.blocks.length
      addMiniboss(game, "fish") // второе — налегает на первое при старом баге
      const fishBlocks = game.blocks.length - levelAfterFirst
      // вырезались только обычные блоки уровня; оба силуэта целиком в g.blocks
      expect(game.blocks.filter((b) => (b.mbGroup ?? 0) === 1).length).toBe(jellyBlocks)
      expect(game.blocks.filter((b) => (b.mbGroup ?? 0) === 2).length).toBe(fishBlocks)
      expect(jellyBlocks).toBe(29)
      expect(fishBlocks).toBe(9)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})
