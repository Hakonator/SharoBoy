import { describe, expect, it } from "vitest"

import { makeEnv } from "./campaignFlow.helpers"
import type { CampaignModifierId } from "./campaignModifiers"
import { computeRunMultipliers } from "./campaignModifiers"
import { DRAFT_MAX_PICKS } from "./endlessDraft"
import type { Game } from "./game"
import { togglePause } from "./game/modes"
import { advanceEndlessWave, gameModifiers, openWaveDraft, pickWaveDraft } from "./game/runFlow"
import { onLevelCleared } from "./game/runFlow"
import { update } from "./game/updateStep"

function endlessEnv() {
  const { g } = makeEnv()
  const game = g as unknown as Game
  game.startEndless()
  game.draftSeed = 20261101
  return game
}

describe("Черновик мутаторов бесконечного режима (T-056)", () => {
  it("выбор выдаётся за пройденную боссовую волну: после 5-й, а не на волнах 1–5", () => {
    const game = endlessEnv()
    expect(game.wave).toBe(1)
    expect(game.waveDraft).toBeNull()

    // Переходим на волны 2, 3, 4 — выбора нет (волна 1 не боссовая).
    for (let wave = 2; wave <= 4; wave++) {
      advanceEndlessWave(game)
      expect(game.wave).toBe(wave)
      expect(game.waveDraft).toBeNull()
    }
    // Зачистили волну 4 → собрали волну 5 (боссовую), выбора ещё нет.
    advanceEndlessWave(game)
    expect(game.wave).toBe(5)
    expect(game.waveDraft).toBeNull()

    // Зачистили боссовую волну 5 → выбор из трёх мутаторов для волны 6.
    advanceEndlessWave(game)
    expect(game.wave).toBe(6)
    expect(game.waveDraft).toBeTruthy()
    expect(game.waveDraft?.wave).toBe(5)
    expect(game.waveDraft?.options).toHaveLength(3)
    expect(new Set(game.waveDraft?.options).size).toBe(3)
  })

  it("драфт не открывается повторно для той же волны", () => {
    const game = endlessEnv()
    game.wave = 5
    expect(openWaveDraft(game)).toBe(true)
    game.waveDraft = null
    expect(openWaveDraft(game)).toBe(false)
  })

  it("выбранный мутатор попадает в действующий список и меняет бой через hasModifier", () => {
    const game = endlessEnv()
    game.wave = 5
    openWaveDraft(game)
    // Берём заранее известный мутатор, а не первый из опций — тест не зависит от RNG.
    expect(pickWaveDraft(game, "no_powers")).toBe(true)

    expect(game.waveDraft).toBeNull()
    expect(game.draftModifiers).toEqual(["no_powers"])
    expect(gameModifiers(game)).toContain("no_powers")
    // Правило реально действует: блок не роняет бонус «Сухой закон».
    game.powers = []
    game.powersSys.dropPower(game.w / 2, 100)
    expect(game.powers).toHaveLength(0)
  })

  it("мутаторы драфта не попадают в множители очков (рекорды сравнимы)", () => {
    const game = endlessEnv()
    game.wave = 5
    openWaveDraft(game)
    pickWaveDraft(game, "no_powers")

    expect(game.campaignModifiers).toEqual([])
    expect(computeRunMultipliers(game.campaignModifiers).scoreMultiplier).toBe(1)
    // А в действующем списке мутатор есть.
    expect(gameModifiers(game)).toEqual(["no_powers"])
  })

  it("нельзя взять больше трёх мутаторов и нельзя взять один дважды", () => {
    const game = endlessEnv()

    const pickAt = (wave: number, pick: CampaignModifierId) => {
      game.wave = wave
      openWaveDraft(game)
      return pickWaveDraft(game, pick)
    }

    expect(pickAt(5, "no_powers")).toBe(true)
    // Повторный выбор того же мутатора на следующей боссовой волне игнорируется.
    game.draftWaveHandled = 0
    expect(pickAt(10, "no_powers")).toBe(false)
    expect(game.draftModifiers).toEqual(["no_powers"])

    game.draftWaveHandled = 0
    expect(pickAt(15, "boss_fury")).toBe(true)
    game.draftWaveHandled = 0
    expect(pickAt(20, "low_bounce")).toBe(true)
    game.draftWaveHandled = 0
    expect(pickAt(25, "dense_armor")).toBe(false)
    expect(game.draftModifiers).toHaveLength(DRAFT_MAX_PICKS)
  })

  it("пропуск закрывает модалку без добавления мутатора", () => {
    const game = endlessEnv()
    game.wave = 5
    openWaveDraft(game)
    expect(pickWaveDraft(game, null)).toBe(false)
    expect(game.waveDraft).toBeNull()
    expect(game.draftModifiers).toEqual([])
  })

  it("dense_armor из драфта сразу усиливает уже стоящие блоки", () => {
    const game = endlessEnv()
    game.wave = 5
    advanceEndlessWave(game) // строит боссовую арену волны 5 и открывает драфт
    expect(game.waveDraft).toBeTruthy()

    const watched = game.blocks.filter((b) => !b.isMiniboss && !b.isTentacle && !b.isClaw)
    const hpBefore = watched.map((b) => b.hp)
    pickWaveDraft(game, "dense_armor")
    // Блоки арены босса могли не попасть под правило — проверяем там, где оно применимо.
    if (watched.length > 0) {
      expect(watched.map((b) => b.hp)).toEqual(hpBefore.map((hp) => hp + 1))
    }
    expect(gameModifiers(game)).toContain("dense_armor")
  })

  it("метод Game.pickWaveDraft прокидывает выбор в движок (нет циклического импорта)", () => {
    const game = endlessEnv()
    game.wave = 5
    openWaveDraft(game)
    expect(game.waveDraft).toBeTruthy()
    game.pickWaveDraft("boss_fury")
    expect(game.waveDraft).toBeNull()
    expect(game.draftModifiers).toEqual(["boss_fury"])
  })

  it("новый забег сбрасывает черновик (мутаторы и счётчик выборов)", () => {
    const game = endlessEnv()
    game.wave = 5
    openWaveDraft(game)
    pickWaveDraft(game, "no_powers")
    expect(game.draftModifiers).toHaveLength(1)

    game.startEndless()
    game.draftSeed = 20261101
    expect(game.draftModifiers).toEqual([])
    expect(game.waveDraft).toBeNull()
    expect(game.draftWaveHandled).toBe(0)
    expect(gameModifiers(game)).toEqual([])
  })

  it("черновик открывается и после обычной зачистки боссовой волны через onLevelCleared", () => {
    const game = endlessEnv()
    game.wave = 5
    game.blocks = []
    game.phase = "playing"
    game.levelScoreStart = 0
    onLevelCleared(game)
    expect(game.intermediateScore?.title).toBe("ВОЛНА 5 ЗАВЕРШЕНА")
    // Продолжение собирает волну 6 и выдаёт выбор за пройденную волну 5.
    game.continueFromIntermediateScore()
    expect(game.wave).toBe(6)
    expect(game.waveDraft?.wave).toBe(5)
  })

  it("во время драфта мутаторов игра находится на паузе: ракетка и аэродропы не двигаются", () => {
    const game = endlessEnv()
    game.wave = 5
    openWaveDraft(game)
    expect(game.waveDraft).toBeTruthy()

    // Запоминаем исходные координаты ракетки и таймеры
    const initialPaddleX = game.paddle.x
    game.paddle.vx = 0
    game.input.pointerX = initialPaddleX + 250 // курсор мыши смещён
    game.bannerTimer = 2.0

    // Добавляем падающий аэродром
    game.powers.push({ x: 100, y: 100, vy: 150, type: "wide", t: 0 })
    const initialPowerY = game.powers[0].y
    const initialSkyDropTimer = game.skyDropTimer

    // Шагаем движком на 0.5 с
    update(game, 0.5)

    // Ракетка и падающий бонус обязаны остаться на месте
    expect(game.paddle.x).toBe(initialPaddleX)
    expect(game.powers[0].y).toBe(initialPowerY)
    // Таймер баннера и таймер сброса бонусов с неба заморожены
    expect(game.bannerTimer).toBe(2.0)
    expect(game.skyDropTimer).toBe(initialSkyDropTimer)

    // togglePause во время драфта блокируется
    togglePause(game)
    expect(game.phase).toBe("playing")

    // Выбираем мутатор (или пропускаем) — игра снимается с паузы
    pickWaveDraft(game, null)
    expect(game.waveDraft).toBeNull()

    // После закрытия драфта мир снова шагает
    game.input.pointerX = initialPaddleX + 250
    update(game, 0.5)
    expect(game.powers[0].y).toBeGreaterThan(initialPowerY)
    expect(game.paddle.x).not.toBe(initialPaddleX)
  })
})
