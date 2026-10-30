import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { HudData, IntermediateScoreData, RunScoreBreakdown } from "../../game/types"

import {
  GameOverScreen,
  IntermediateScoreModal,
  PauseScreen,
  ScoreBreakdownTable,
  WinScreen,
} from "./overlays"

const mockBreakdown: RunScoreBreakdown = {
  baseScore: 10000,
  blocksDestroyed: 35,
  blocksScore: 4500,
  bossesDefeated: 1,
  bossesScore: 3000,
  livesRemaining: 3,
  livesBonus: 1500,
  shieldsRemaining: 1,
  shieldsBonus: 250,
  maxCombo: 8,
  comboBonus: 800,
  critHits: 2,
  critBonus: 600,
  clutchSaves: 1,
  clutchBonus: 400,
  sectorsCleared: 4,
  fastClears: 2,
  speedBonus: 1200,
  mutatorBonusPercent: 20,
  mutatorsMultiplier: 1.2,
  activeMutators: ["fog"],
  endBonusTotal: 5700,
  finalScore: 15700,
  items: [
    { id: "blocks", label: "Разрушенные блоки", detail: "35 шт.", points: 4500, icon: "🧱" },
    { id: "bosses", label: "Поверженные боссы", detail: "1 босс(ов)", points: 3000, icon: "👑" },
    { id: "lives", label: "Сэкономленные жизни", detail: "3 × 500", points: 1800, icon: "💖" },
    { id: "shields", label: "Защитные энергощиты", detail: "1 × 250", points: 300, icon: "🛡" },
    { id: "combo", label: "Максимальная серия комбо", detail: "Серия ×8", points: 960, icon: "🔥" },
    { id: "crits", label: "Критические рикошеты ×3", detail: "2 × 300", points: 720, icon: "🎯" },
    { id: "clutch", label: "Сэйвы на грани ракетки", detail: "1 × 400", points: 480, icon: "⚡" },
    {
      id: "speed",
      label: "Скоростная зачистка",
      detail: "2 секторов (< 45 с)",
      points: 1440,
      icon: "⏱",
    },
    {
      id: "mutators",
      label: "Множитель мутаторов",
      detail: "🌫 +20% к очкам",
      points: 0,
      icon: "🧬",
      isMultiplier: true,
    },
  ],
}

const makeWinHud = (
  mode: HudData["mode"],
  finalBossDefeated?: HudData["finalBossDefeated"],
  scoreBreakdown?: RunScoreBreakdown | null
): HudData =>
  ({
    phase: "won",
    mode,
    finalBossDefeated,
    score: 15700,
    best: 20000,
    coins: 45,
    newRecord: false,
    scoreBreakdown: scoreBreakdown ?? null,
  }) as unknown as HudData

describe("ScoreBreakdownTable", () => {
  it("рендерит строки детализации с иконками, очками и множителем мутаторов", () => {
    const html = renderToStaticMarkup(<ScoreBreakdownTable breakdown={mockBreakdown} />)

    expect(html).toContain("Детализация очков")
    expect(html).toContain("+20% Мутаторы")
    expect(html).toContain("Разрушенные блоки")
    expect(html).toContain("35 шт.")
    expect(html).toContain("Поверженные боссы")
    expect(html).toContain("Сэкономленные жизни")
    expect(html).toContain("Защитные энергощиты")
    expect(html).toContain("Максимальная серия комбо")
    expect(html).toContain("Критические рикошеты ×3")
    expect(html).toContain("Сэйвы на грани ракетки")
    expect(html).toContain("Скоростная зачистка")
    expect(html).toContain("×1.20")
    expect(html).toContain((5700).toLocaleString("ru-RU"))
    expect(html).toContain("Бонус за завершение:")
  })

  it("возвращает null для пустого breakdown", () => {
    const emptyBreakdown: RunScoreBreakdown = {
      ...mockBreakdown,
      items: [],
      endBonusTotal: 0,
    }
    const html = renderToStaticMarkup(<ScoreBreakdownTable breakdown={emptyBreakdown} />)
    expect(html).toBe("")
  })
})

describe("GameOverScreen", () => {
  it("отображает экран поражения и таблицу детализации очков при наличии breakdown", () => {
    const hud: HudData = {
      phase: "over",
      mode: "campaign",
      score: 15700,
      best: 20000,
      newRecord: true,
      scoreBreakdown: mockBreakdown,
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <GameOverScreen
        hud={hud}
        topSubmit={<div>[TOP_SUBMIT]</div>}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )

    expect(html).toContain("ИГРА ОКОНЧЕНА")
    expect(html).toContain("НОВЫЙ РЕКОРД!")
    expect(html).toContain("Детализация очков")
    expect(html).toContain("Разрушенные блоки")
    expect(html).toContain("Сэкономленные жизни")
  })

  it("отображает бейдж ежедневного испытания при mode === daily", () => {
    const hud: HudData = {
      phase: "over",
      mode: "daily",
      level: 3,
      levelCount: 4,
      score: 5000,
      best: 10000,
      newRecord: false,
    } as unknown as HudData

    const html = renderToStaticMarkup(
      <GameOverScreen hud={hud} topSubmit={null} onRestart={() => {}} onMenu={() => {}} />
    )
    expect(html).toContain("ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ")
    expect(html).toContain("УРОВЕНЬ 3/4")
  })
})

describe("WinScreen", () => {
  it("рендерит космический эпилог станции «СФЕРА-1080» и Score Breakdown для режима кампании", () => {
    const hud = makeWinHud("campaign", "chrono", mockBreakdown)
    const html = renderToStaticMarkup(
      <WinScreen
        hud={hud}
        topSubmit={<div>[TOP_SUBMIT]</div>}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(html).toContain("КОНЦОВКА Б: РАЗРЫВ ВРЕМЕННОЙ ПЕТЛИ")
    expect(html).toContain("СФЕРА-1080")
    expect(html).toContain("ВРЕМЯ ВОССТАНОВЛЕНО")
    expect(html).toContain("+150 💠")
    expect(html).toContain("МЕТА-КРИСТАЛЛОВ")
    expect(html).toContain(hud.score.toLocaleString("ru-RU"))
    expect(html).toContain("Детализация очков")
    expect(html).toContain("Поверженные боссы")
  })

  it("рендерит классический экран победы и Score Breakdown для остальных режимов", () => {
    const hud = makeWinHud("endless", undefined, mockBreakdown)
    const html = renderToStaticMarkup(
      <WinScreen
        hud={hud}
        topSubmit={<div>[TOP_SUBMIT]</div>}
        onRestart={() => {}}
        onMenu={() => {}}
      />
    )
    expect(html).toContain("ПОБЕДА!")
    expect(html).toContain("Все шары лопнули")
    expect(html).not.toContain("СФЕРА-1080")
    expect(html).toContain("Детализация очков")
    expect(html).toContain("Скоростная зачистка")
  })

  it("отображает бейдж ежедневного испытания при mode === daily", () => {
    const hud = makeWinHud("daily", "chrono", mockBreakdown)
    const html = renderToStaticMarkup(
      <WinScreen hud={hud} topSubmit={null} onRestart={() => {}} onMenu={() => {}} />
    )
    expect(html).toContain("ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ")
  })
})

describe("IntermediateScoreModal", () => {
  const mockScoreData: IntermediateScoreData = {
    title: "СЕКТОР ЗАЧИЩЕН",
    subtitle: "Боевой сектор",
    levelScore: 2400,
    previousScore: 5000,
    totalScore: 7400,
    levelBlocks: 18,
    totalBlocks: 42,
    maxCombo: 6,
    lives: 3,
    shields: 2,
    isCleanClear: true,
    isFastClear: true,
    timeSeconds: 32,
    mutatorBonusPercent: 25,
    crystalsEarned: 15,
    metaCrystalsEarned: 5,
    items: [
      { id: "blocks", label: "Разрушенные блоки", detail: "18 шт.", points: 1800, icon: "🧱" },
      { id: "speed", label: "Скоростная зачистка", detail: "1 сектор", points: 600, icon: "⏱" },
    ],
  }

  it("рендерит полупрозрачное окно с промежуточным подсчётом очков", () => {
    const html = renderToStaticMarkup(
      <IntermediateScoreModal data={mockScoreData} onContinue={() => {}} />
    )
    expect(html).toContain("intermediate-score-modal")
    expect(html).toContain("СЕКТОР ЗАЧИЩЕН")
    expect(html).toContain("Боевой сектор")
    expect(html).toContain("За уровень")
    expect(html).toContain("Накоплено всего")
    expect(html).toContain("Подсчёт промежуточных очков")
    expect(html).toContain("Чистая игра")
    expect(html).toContain("Скорость")
    expect(html).toContain("+15")
    expect(html).toContain("+5")
    expect(html).toContain("+25% Мутаторы")
  })
})

describe("PauseScreen & TacticalModulesPanel", () => {
  const baseHud: HudData = {
    phase: "paused",
    score: 100,
    best: 500,
    lives: 3,
    level: 1,
    levelCount: 10,
    levelName: "Уровень 1",
    mode: "campaign",
    wave: 1,
    combo: 0,
    blocksLeft: 10,
    muted: false,
    musicMuted: false,
    musicVolume: 0.7,
    sfxVolume: 0.7,
    newAchievements: [],
    banner: null,
    stuck: false,
    newRecord: false,
    shield: 1,
    wideOn: false,
    slowOn: false,
    fastOn: false,
    shrinkOn: false,
    laserOn: false,
    laserArmed: false,
    rocketOn: false,
    fireOn: false,
    frostOn: false,
    sparkOn: false,
    pierceOn: false,
    explosiveOn: false,
    bigOn: false,
    magnetOn: false,
    coins: 50,
    crystals: 10,
    upgrades: {},
    tacticalModules: {
      paddleRotation: true,
      paddleImpulse: false,
      aimGuide: true,
      magnetStart: true,
    },
    top: [],
    topEndless: [],
    map: null,
    campaignEvent: null,
  }

  it("не отображает блок тактических модулей, если ни один апгрейд не куплен", () => {
    const html = renderToStaticMarkup(
      <PauseScreen onResume={() => {}} onRestart={() => {}} onMenu={() => {}} hud={baseHud} />
    )
    expect(html).toContain("СТОП-КАДР")
    expect(html).not.toContain("tactical-modules-panel")
  })

  it("отображает штурвал глубин и импульсный чекбокс, если куплен paddleRotation", () => {
    const hud: HudData = {
      ...baseHud,
      upgrades: { paddleRotation: 1 },
    }
    const html = renderToStaticMarkup(
      <PauseScreen onResume={() => {}} onRestart={() => {}} onMenu={() => {}} hud={hud} />
    )
    expect(html).toContain("tactical-modules-panel")
    expect(html).toContain("Штурвал глубин")
    expect(html).toContain("Импульсный щелчок")
    expect(html).not.toContain("Траекторный прицел")
    expect(html).not.toContain("Магнитный старт")
  })

  it("скрывает импульсный чекбокс, если paddleRotation выключен", () => {
    const hud: HudData = {
      ...baseHud,
      upgrades: { paddleRotation: 1 },
      tacticalModules: {
        ...baseHud.tacticalModules,
        paddleRotation: false,
      },
    }
    const html = renderToStaticMarkup(
      <PauseScreen onResume={() => {}} onRestart={() => {}} onMenu={() => {}} hud={hud} />
    )
    expect(html).toContain("Штурвал глубин")
    expect(html).toContain("ВЫКЛ")
    expect(html).not.toContain("Импульсный щелчок")
  })

  it("отображает только купленные модули при разных комбинациях апгрейдов", () => {
    const hud: HudData = {
      ...baseHud,
      upgrades: { aimGuide: 1, magnet: 1 },
    }
    const html = renderToStaticMarkup(
      <PauseScreen onResume={() => {}} onRestart={() => {}} onMenu={() => {}} hud={hud} />
    )
    expect(html).toContain("Траекторный прицел")
    expect(html).toContain("Магнитный старт")
    expect(html).not.toContain("Штурвал глубин")
  })
})
