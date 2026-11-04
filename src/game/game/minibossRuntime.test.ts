import { describe, expect, it } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"
import {
  CRAB_ARMOR,
  CRAB_SHARD_COUNT,
  EEL_DASH_DURATION,
  EEL_DASH_INTERVAL,
  EEL_DASH_REACH,
  EEL_DASH_TELEGRAPH,
  MINIBOSS_KINDS,
} from "../minibosses"

import {
  addMiniboss,
  damageMiniboss,
  killMiniboss,
  resetMiniboss,
  updateMinibosses,
} from "./minibossRuntime"

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

/** T-058: «Панцирный краб». */
describe("T-058: Панцирный краб — броня и осколки", () => {
  function crabEnv() {
    const env = makeEnv()
    const { game } = env
    resetMiniboss(game)
    game.phase = "playing"
    game.mode = "campaign"
    game.blocks = game.blocks.filter((b) => !b.isMiniboss)
    addMiniboss(game, "armored_crab", 40)
    return env
  }

  it("приходит в бой с CRAB_ARMOR и уязвим только в щель", () => {
    const { game, restoreRandom } = crabEnv()
    try {
      const creature = game.minibosses[0]!
      expect(creature.kind).toBe("armored_crab")
      expect(creature.armor).toBe(CRAB_ARMOR)

      const shell = game.blocks.find((b) => b.mbGroup === creature.group && b.mbPart === "shell")!
      const gap = game.blocks.find((b) => b.mbGroup === creature.group && b.mbPart === "gap")!

      // Удар в панцирь гасит броню, но не HP.
      const hpBefore = creature.hp
      damageMiniboss(game, 1, shell)
      expect(creature.armor).toBe(CRAB_ARMOR - 1)
      expect(creature.hp).toBe(hpBefore)

      // Удар в щель проходит мимо брони прямо в HP.
      const armorBefore = creature.armor
      damageMiniboss(game, 2, gap)
      expect(creature.armor).toBe(armorBefore)
      expect(creature.hp).toBe(hpBefore - 2)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("пролом панциря выбрасывает ровно CRAB_SHARD_COUNT осколков к ракетке", () => {
    const { game, restoreRandom } = crabEnv()
    try {
      const creature = game.minibosses[0]!
      const shell = game.blocks.find((b) => b.mbGroup === creature.group && b.mbPart === "shell")!
      const blocksBefore = game.blocks.length

      damageMiniboss(game, CRAB_ARMOR, shell)
      expect(creature.armor).toBe(0)

      const shards = game.blocks.filter((b) => b.bomb && b.hitsPaddle)
      expect(shards).toHaveLength(CRAB_SHARD_COUNT)
      expect(game.blocks.length).toBe(blocksBefore + CRAB_SHARD_COUNT)
      // Осколки летят вниз и расходятся в стороны.
      expect(shards.every((s) => (s.bombVy ?? 0) > 0)).toBe(true)
      expect(new Set(shards.map((s) => Math.sign(s.bombVx ?? 0)))).toEqual(new Set([-1, 1]))
      // Броня не задела HP самого краба.
      expect(creature.hp).toBe(40)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("лишний урон после снятия брони переходит в HP существа", () => {
    const { game, restoreRandom } = crabEnv()
    try {
      const creature = game.minibosses[0]!
      const shell = game.blocks.find((b) => b.mbGroup === creature.group && b.mbPart === "shell")!
      damageMiniboss(game, CRAB_ARMOR + 4, shell)
      expect(creature.armor).toBe(0)
      expect(creature.hp).toBe(36)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})

/** T-058: «Скользкий угорь». */
describe("T-058: Скользкий угорь — телеграф, рывок и неуязвимость", () => {
  function eelEnv() {
    const env = makeEnv()
    const { game } = env
    resetMiniboss(game)
    game.phase = "playing"
    game.mode = "campaign"
    game.blocks = game.blocks.filter((b) => !b.isMiniboss)
    addMiniboss(game, "slippery_eel", 40)
    return env
  }

  it("стартует в idle с отсчётом до первого рывка", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      expect(creature.kind).toBe("slippery_eel")
      expect(creature.dashState).toBe("idle")
      expect(creature.dashCooldown).toBe(EEL_DASH_INTERVAL)
      expect(creature.invulnerable).toBeFalsy()
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("через EEL_DASH_INTERVAL уходит в телеграф, затем в рывок и становится неуязвим", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      updateMinibosses(game, EEL_DASH_INTERVAL + 0.01)
      expect(creature.dashState).toBe("telegraph")
      expect(creature.invulnerable).toBeFalsy()
      // урон в телеграфе ещё проходит
      const head = game.blocks.find((b) => b.mbPart === "eel_head")!
      damageMiniboss(game, 1, head)
      expect(creature.hp).toBe(39)

      updateMinibosses(game, EEL_DASH_TELEGRAPH + 0.01)
      expect(creature.dashState).toBe("dash")
      expect(creature.invulnerable).toBe(true)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  /** Продвигает угря до фазы рывка: idle → telegraph → dash. */
  function advanceToDash(game: Parameters<typeof updateMinibosses>[0]) {
    updateMinibosses(game, EEL_DASH_INTERVAL + 0.01)
    updateMinibosses(game, EEL_DASH_TELEGRAPH + 0.01)
  }

  it("на рывке урон не проходит, а шар ускоряется", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      advanceToDash(game)
      expect(creature.dashState).toBe("dash")

      const head = game.blocks.find((b) => b.mbPart === "eel_head")!
      game.balls = [
        {
          x: head.x,
          y: head.y,
          vx: 200,
          vy: -200,
          r: 8,
          speed: 400,
          stuck: false,
          stuckOffset: 0,
          trail: [],
          squash: 1,
          sinceHit: 0,
        },
      ]
      const hpBefore = creature.hp
      damageMiniboss(game, 5, head)
      expect(creature.hp).toBe(hpBefore)
      expect(game.balls[0]!.speed).toBeCloseTo(400 * 1.35)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("после рывка возвращается в idle и снова уязвим", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      advanceToDash(game)
      expect(creature.invulnerable).toBe(true)
      updateMinibosses(game, EEL_DASH_DURATION + 0.02)
      expect(creature.dashState).toBe("idle")
      expect(creature.invulnerable).toBe(false)
      expect(creature.dashCooldown).toBe(EEL_DASH_INTERVAL)

      const head = game.blocks.find((b) => b.mbPart === "eel_head")!
      const hpBefore = creature.hp
      damageMiniboss(game, 1, head)
      expect(creature.hp).toBe(hpBefore - 1)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("рывок сдвигает существо к ракетке и возвращает на место", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      const head = game.blocks.find((b) => b.mbPart === "eel_head")!
      const startX = head.x
      // Ракетка правее существа — рывок должен увести угря вправо.
      game.paddle.x = game.w - 60
      advanceToDash(game)
      updateMinibosses(game, EEL_DASH_DURATION * 0.5)
      expect(head.x).not.toBeCloseTo(startX)
      // назад — ровно на исходную позицию
      updateMinibosses(game, EEL_DASH_DURATION)
      expect(head.x).toBeCloseTo(startX)
      expect(creature.dashDir).toBe(0)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  /**
   * Регресс 04.11.2026: игрок видел, как при появлении круга телеграфа угорь
   * «смещается вправо и возвращается». Смещения не было — разворачивался
   * силуэт: `facing` считался по сдвигу центра за кадр, а рывок двигает группу
   * программно, поэтому первый кадр броска выглядел как собственное движение.
   */
  it("телеграф и рывок не разворачивают силуэт — направление берётся от патруля", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      // Направление, накопленное патрулём до броска.
      const facingBefore = creature.facing
      expect(facingBefore).toBeDefined()

      updateMinibosses(game, EEL_DASH_INTERVAL + 0.01)
      expect(creature.dashState).toBe("telegraph")
      expect(creature.facing).toBe(facingBefore)

      updateMinibosses(game, EEL_DASH_TELEGRAPH + 0.01)
      expect(creature.dashState).toBe("dash")
      // Первый кадр броска — самый опасный: рывок уже сдвинул группу.
      updateMinibosses(game, 0.016)
      expect(creature.facing).toBe(facingBefore)
      // ...и до конца броска силуэт не переворачивается.
      updateMinibosses(game, EEL_DASH_DURATION * 0.5)
      expect(creature.facing).toBe(facingBefore)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})

/** T-058: общий цикл для всех четырёх видов. */
describe("T-058: все виды проходят общий цикл минибоссов", () => {
  for (const kind of MINIBOSS_KINDS) {
    it(`«${kind}»: появляется, получает урон и умирает целиком`, () => {
      const { game, restoreRandom } = makeEnv()
      try {
        resetMiniboss(game)
        game.phase = "playing"
        game.mode = "campaign"
        game.blocks = game.blocks.filter((b) => !b.isMiniboss)
        addMiniboss(game, kind, 10)
        const creature = game.minibosses[0]!
        expect(creature.maxHp).toBe(10)
        const own = game.blocks.filter((b) => (b.mbGroup ?? 0) === creature.group)
        expect(own.length).toBeGreaterThan(3)
        expect(own.every((b) => b.isMiniboss === true)).toBe(true)

        damageMiniboss(game, 100, own[0]!)
        expect(game.minibosses).toHaveLength(0)
        expect(game.blocks.filter((b) => (b.mbGroup ?? 0) === creature.group)).toHaveLength(0)
      } finally {
        restoreRandom()
        game.destroy()
      }
    })
  }
})

/** T-063: доработка угря — разворот силуэта и рывок без телепорта. */
describe("T-063: угорь разворачивается и не телепортируется на рывке", () => {
  function eelEnv() {
    const env = makeEnv()
    const { game } = env
    resetMiniboss(game)
    game.phase = "playing"
    game.mode = "campaign"
    game.blocks = game.blocks.filter((b) => !b.isMiniboss)
    addMiniboss(game, "slippery_eel", 40)
    return env
  }

  /**
   * Контракт после 04.11.2026: направление берётся из **фазы патруля**
   * (производная синуса), а не из разности позиций. Поэтому тест крутит время
   * и проверяет, что нос смотрит туда, куда существо реально едет, — и что
   * ручное смещение блоков направление не меняет (это была причина мигания).
   */
  it("направление силуэта следует за фазой патруля, а не за разностью позиций", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      const group = game.blocks.filter((b) => (b.mbGroup ?? 0) === creature.group)
      const head = group.find((b) => b.mbPart === "eel_head")!
      const freq = head.swayFreq
      expect(freq).toBeGreaterThan(0)

      // cos(t·freq) = 1 → максимальная скорость вправо.
      game.time = 0
      updateMinibosses(game, 0.016)
      expect(creature.facing).toBe(1)
      expect(group.every((b) => b.mbFacing === 1)).toBe(true)

      // cos(t·freq) = −1 → максимальная скорость влево.
      game.time = Math.PI / freq
      updateMinibosses(game, 0.016)
      expect(creature.facing).toBe(-1)
      expect(group.every((b) => b.mbFacing === -1)).toBe(true)

      // Ручной сдвиг блоков НЕ должен переворачивать силуэт: раньше именно это
      // дёргало угря (и на рывке, и на случайных смещениях).
      const before = creature.facing
      for (const b of group) b.x = b.x0 - 80
      updateMinibosses(game, 0.016)
      expect(creature.facing).toBe(before)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("живой центр обновляется каждый кадр — телеграф не появляется в стороне", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      const group = game.blocks.filter((b) => (b.mbGroup ?? 0) === creature.group)
      for (const b of group) b.x = b.x0 + 120
      updateMinibosses(game, 0.016)
      const mean = group.reduce((s, b) => s + b.x, 0) / group.length
      expect(creature.dropX).toBeCloseTo(mean, 5)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("старт рывка не двигает существо: смещение складывается с покачиванием", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      const group = game.blocks.filter((b) => (b.mbGroup ?? 0) === creature.group)
      const head = group.find((b) => b.mbPart === "eel_head")!
      // Имитируем покачивание: существо патрулирует левее своей базы.
      for (const b of group) {
        b.mbSwayOffset = -120
        b.mbSwayMin = -400
        b.mbSwayMax = 400
        b.x = b.x0 - 120
      }
      game.paddle.x = game.w - 60
      updateMinibosses(game, EEL_DASH_INTERVAL + 0.01) // idle → telegraph
      const xAtTelegraph = head.x
      updateMinibosses(game, EEL_DASH_TELEGRAPH + 0.01) // telegraph → dash
      expect(creature.dashState).toBe("dash")
      // Главный регресс: переход в рывок не должен прыгать к базовой позиции.
      expect(head.x).toBeCloseTo(xAtTelegraph)

      // на пике вылет добавляется к текущему покачиванию, а не заменяет его
      updateMinibosses(game, EEL_DASH_DURATION * 0.5)
      expect(head.x).toBeCloseTo(head.x0 - 120 + EEL_DASH_REACH, 0)

      // после рывка — ровно на точку патруля
      updateMinibosses(game, EEL_DASH_DURATION)
      expect(head.x).toBeCloseTo(head.x0 - 120, 0)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})
