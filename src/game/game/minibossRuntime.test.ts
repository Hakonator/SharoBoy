import { describe, expect, it } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"

import { addMiniboss, killMiniboss, resetMiniboss } from "./minibossRuntime"

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

  it("после гибели последнего минибосса при отсутствии блоков шар замирает (vx=0, vy=0) и не теряет жизнь", () => {
    const { game, restoreRandom, step } = makeEnv()
    try {
      resetMiniboss(game)
      game.phase = "playing"
      game.mode = "campaign"
      game.blocks = []
      addMiniboss(game, "fish")
      // Оставляем только блоки рыбы
      game.blocks = game.blocks.filter((b) => b.isMiniboss)
      const creature = game.minibosses[0]
      expect(creature).toBeDefined()

      // Задаём шару скорость
      game.balls = [
        {
          x: 200,
          y: 300,
          vx: 300,
          vy: -300,
          r: 8,
          speed: 400,
          stuck: false,
          stuckOffset: 0,
          trail: [{ x: 190, y: 310 }],
          squash: 1,
          sinceHit: 0,
        },
      ]

      // Уничтожаем минибосса
      killMiniboss(game, creature)
      expect(game.blocks.length).toBe(0)

      // Шар должен мгновенно замереть
      expect(game.balls[0].vx).toBe(0)
      expect(game.balls[0].vy).toBe(0)
      const posX = game.balls[0].x
      const posY = game.balls[0].y

      // Искусственно добавляем жизнь, чтобы уровень ожидал её подбора
      game.powers.push({
        x: game.w / 2,
        y: 100,
        vy: 150,
        type: "life",
        t: 0,
      })

      // Прогоняем несколько кадров
      step(5)

      // Шар не должен двигаться
      expect(game.balls[0].x).toBe(posX)
      expect(game.balls[0].y).toBe(posY)
      expect(game.balls[0].vx).toBe(0)
      expect(game.balls[0].vy).toBe(0)
      expect(game.phase).toBe("playing") // ждёт жизнь
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})
