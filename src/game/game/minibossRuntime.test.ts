import { describe, expect, it } from "vitest"

import { makeEnv } from "../frameInvariant.helpers"
import { CRAB_ARMOR, CRAB_SHARD_COUNT, MINIBOSS_KINDS } from "../minibosses"

import {
  addMiniboss,
  damageMiniboss,
  killMiniboss,
  resetMiniboss,
  updateMinibosses,
} from "./minibossRuntime"
import { stepBlock } from "./blockMotion"

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

/**
 * T-058: «Скользкий угорь» — равномерный маятник от стены к стене.
 *
 * История правок (жалоба игрока 04.11.2026): сначала рывок в сторону ракетки
 * накладывался на патруль, который из-за ошибки в `stepBlock` летал по всему
 * полю; затем патруль ужали до ±150, и угорь стал «плавать в пятачке в центре,
 * не доплывая до краёв». По решению игрока рывок удалён целиком: остаётся
 * одно понятное движение — через всё поле и обратно.
 */
describe("T-058: Скользкий угорь — равномерный проход от края к краю", () => {
  function eelEnv(w?: number) {
    const env = makeEnv()
    const { game } = env
    resetMiniboss(game)
    game.phase = "playing"
    game.mode = "campaign"
    game.blocks = game.blocks.filter((b) => !b.isMiniboss)
    if (w !== undefined) game.w = w
    addMiniboss(game, "slippery_eel", 40)
    return env
  }

  it("рождается без состояния рывка", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      expect(creature.kind).toBe("slippery_eel")
      expect(creature.facing).toBe(1)
      expect(creature.hp).toBe(40)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  /**
   * Главный контракт после удаления рывка: угорь доходит до ОБЕИХ стен и
   * разворачивается. Раньше он останавливался в центре поля — это и была
   * жалоба «не доплывает до краёв».
   */
  it("доплывает до обеих стен и разворачивается", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const eel = game.minibosses[0]!
      const parts = game.blocks.filter((b) => (b.mbGroup ?? 0) === eel.group)
      const head = parts.find((b) => b.mbPart === "eel_head")!
      const step = 1 / 60
      // Один период покачивания = полный проход туда-обратно.
      const frames = Math.ceil((Math.PI * 2) / head.swayFreq / step) + 30

      let minLeft = Infinity
      let maxRight = -Infinity
      for (let i = 0; i < frames; i++) {
        game.time += step
        for (const b of game.blocks) stepBlock(game, b, step)
        updateMinibosses(game, step)
        for (const part of parts) {
          minLeft = Math.min(minLeft, part.x - part.rx)
          maxRight = Math.max(maxRight, part.x + part.rx)
        }
      }

      // Упёрся в оба края: зазор до стены не больше нескольких пикселей.
      expect(minLeft, `левый зазор ${minLeft.toFixed(1)} px`).toBeLessThan(6)
      expect(maxRight, `правый зазор ${(game.w - maxRight).toFixed(1)} px`).toBeGreaterThan(
        game.w - 6
      )
      // И не вылез за поле.
      expect(minLeft).toBeGreaterThanOrEqual(-0.5)
      expect(maxRight).toBeLessThanOrEqual(game.w + 0.5)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("на узком поле ужимается и не вылезает за стены", () => {
    const { game, restoreRandom } = eelEnv(400)
    try {
      const eel = game.minibosses[0]!
      const parts = game.blocks.filter((b) => (b.mbGroup ?? 0) === eel.group)
      const step = 1 / 60

      for (let i = 0; i < 300; i++) {
        game.time += step
        for (const b of game.blocks) stepBlock(game, b, step)
        updateMinibosses(game, step)
        for (const p of parts) {
          expect(p.x - p.rx).toBeGreaterThanOrEqual(-0.5)
          expect(p.x + p.rx).toBeLessThanOrEqual(game.w + 0.5)
        }
      }
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  /**
   * Движение ровное: ни телепортов, ни остановок в середине поля. Скорость
   * синуса непостоянна по определению, поэтому проверяем две вещи:
   * 1) покадровый сдвиг не превышает физический максимум;
   * 2) в центральной части поля скорость близка к максимальной — существо
   *    идёт, а не топчется.
   */
  it("идёт ровно: без скачков и без зависаний в центре", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const eel = game.minibosses[0]!
      const head = game.blocks.find(
        (b) => (b.mbGroup ?? 0) === eel.group && b.mbPart === "eel_head"
      )!
      const step = 1 / 60
      // Первый кадр нужен, чтобы `stepBlock` выставил `mbSwayMin/Max` — без
      // них фактический размах неизвестен.
      game.time += step
      for (const b of game.blocks) stepBlock(game, b, step)
      updateMinibosses(game, step)

      // Фактический размах — из клампа `stepBlock`, а не из заявленного
      // `swayAmp` (у угря он равен ширине поля и ужимается до стен).
      const room = (head.mbSwayMax ?? 0) - (head.mbSwayMin ?? 0)
      const realAmp = Math.min(room / 2, head.swayAmp)
      const peakSpeed = realAmp * head.swayFreq // px/с в середине поля

      let prevX = head.x
      let maxJump = 0
      let centerSpeed = 0
      const frames = Math.ceil((Math.PI * 2) / head.swayFreq / step)
      for (let i = 0; i < frames; i++) {
        game.time += step
        for (const b of game.blocks) stepBlock(game, b, step)
        updateMinibosses(game, step)
        maxJump = Math.max(maxJump, Math.abs(head.x - prevX))
        // Близко к центру поля → скорость должна быть высокой. Окно широкое
        // (±25%), потому что внутри него синус уже спадает к краям.
        if (Math.abs(head.x - game.w / 2) < game.w * 0.25) {
          centerSpeed = Math.max(centerSpeed, Math.abs(head.x - prevX) / step)
        }
        prevX = head.x
      }

      // Скачок не больше максимальной скорости синуса за кадр (+запас).
      expect(maxJump, `макс. скачок ${maxJump.toFixed(2)} px/кадр`).toBeLessThanOrEqual(
        peakSpeed * step + 0.5
      )
      // В средней половине поля скорость ≥ 85% пиковой: это проход, а не
      // топтание. У прежнего компактного патруля (±150 у центра) здесь было
      // бы ~10% пиковой скорости.
      expect(centerSpeed, `скорость в центре ${centerSpeed.toFixed(0)} px/с`).toBeGreaterThan(
        peakSpeed * 0.85
      )
      // Пиковая скорость физически осмысленна.
      expect(peakSpeed).toBeGreaterThan(60)
      expect(peakSpeed).toBeLessThan(1100)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("урон проходит всегда — неуязвимых фаз больше нет", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      const head = game.blocks.find((b) => b.mbPart === "eel_head")!
      const hp0 = creature.hp
      damageMiniboss(game, 3, head)
      expect(creature.hp).toBe(hp0 - 3)
      // Шар не получает «скользкого» ускорения: отскок считает обычная физика.
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
      damageMiniboss(game, 3, head)
      expect(game.balls[0]!.speed).toBe(400)
      expect(creature.hp).toBe(hp0 - 6)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })
})

/**
 * T-063: направление силуэта угря.
 *
 * Регресс 04.11.2026: игрок видел, как при появлении круга телеграфа угорь
 * «смещается в сторону и возвращается». Смещения не было — разворачивался
 * силуэт: `facing` считался по сдвигу центра за кадр, и любой чужой сдвиг
 * читался как собственное движение. Теперь направление берётся из фазы
 * покачивания (производная синуса) и от внешних сдвигов не зависит.
 */
describe("T-063: направление силуэта угря следует за движением", () => {
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

  it("берётся из фазы патруля, а не из разности позиций", () => {
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

      // Ручной сдвиг блоков НЕ должен переворачивать силуэт.
      const before = creature.facing
      for (const b of group) b.x = b.x0 - 80
      updateMinibosses(game, 0.016)
      expect(creature.facing).toBe(before)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("разворачивается на краях поля, а не в центре", () => {
    const { game, restoreRandom } = eelEnv()
    try {
      const creature = game.minibosses[0]!
      const head = game.blocks.find(
        (b) => (b.mbGroup ?? 0) === creature.group && b.mbPart === "eel_head"
      )!
      const step = 1 / 60
      const frames = Math.ceil((Math.PI * 2) / head.swayFreq / step) + 10
      let flips = 0
      let prev = creature.facing

      for (let i = 0; i < frames; i++) {
        game.time += step
        for (const b of game.blocks) stepBlock(game, b, step)
        updateMinibosses(game, step)
        if (creature.facing !== prev) {
          flips++
          // Разворот происходит у края: существо далеко от центра поля.
          expect(Math.abs(creature.dropX - game.w / 2)).toBeGreaterThan(game.w * 0.2)
          prev = creature.facing
        }
      }
      expect(flips).toBeGreaterThanOrEqual(1)
      expect(flips).toBeLessThanOrEqual(2)
    } finally {
      restoreRandom()
      game.destroy()
    }
  })

  it("живой центр обновляется каждый кадр", () => {
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
})
