import { describe, expect, it } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"

import { addMiniboss, resetMiniboss } from "./minibossRuntime"

/** Регресс «невидимой медузы»: дуэт рыба+медуза не должен уродовать существа. */
describe("addMiniboss: дуэт двух существ в уровне", () => {
  it("оба существа целы: у медузы купол, у рыбы тело; дуэт симметричен", () => {
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

      // первое и второе существа симметрично разведены относительно центра
      const dome = jelly.filter((b) => b.mbPart === "dome")
      const jellyCx = dome.reduce((s, b) => s + b.x, 0) / dome.length
      expect(jellyCx).toBeCloseTo(game.w / 2 + game.w * 0.11)
      const body = fish.filter((b) => b.mbPart === "body")
      const fishCx = body.reduce((s, b) => s + b.x, 0) / body.length
      expect(fishCx).toBeCloseTo(game.w / 2 - game.w * 0.11)

      // запись о существе в g.minibosses цела — HP-полоска соответствует живому
      expect(game.minibosses.map((c) => c.kind)).toEqual(["fish", "jelly"])
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("сохраняет все блоки уровня при появлении минибоссов", () => {
    const { game, restoreRandom } = makeEnv()
    try {
      resetMiniboss(game)
      game.phase = "playing"
      game.blocks = game.blocks.filter((b) => !b.isMiniboss)
      const levelBlocks = game.blocks.filter((b) => !b.isMiniboss)
      addMiniboss(game, "jelly") // первое — в центре
      const minibossCountAfterFirst = game.blocks.filter((b) => b.isMiniboss).length
      addMiniboss(game, "fish")
      const minibossCountAfterSecond = game.blocks.filter((b) => b.isMiniboss).length
      // Ни один блок уровня не удалён и не подменён.
      expect(game.blocks.filter((b) => !b.isMiniboss)).toEqual(levelBlocks)
      expect(minibossCountAfterFirst).toBe(29)
      expect(minibossCountAfterSecond - minibossCountAfterFirst).toBe(9)
      expect(minibossCountAfterSecond).toBe(38)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})
