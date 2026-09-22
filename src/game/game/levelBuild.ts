import type { Game } from "../game"
import { Physics } from "../physics"
import { layoutBlocks, densityFactor } from "../levelBuilder"
import { gridBlocks, buildBossArena } from "../levelPatterns"
import { LEVELS } from "../levels"
import { clamp, rand, mulberry32, daySeed } from "../utils"
import type { Ball, Block, BossState } from "../types"
import type { BossVariant } from "../bossVariants"
import type { LevelSpec, PatternSpec } from "../levels"

import { pushHud } from "./hudSync"
import { resetMiniboss } from "./minibossRuntime"
import { blockTop } from "./paddleControl"
export function buildLevel(g: Game, n: number) {
  buildFromSpec(g, LEVELS[n - 1])
}

export function buildFromSpec(g: Game, spec: LevelSpec) {
  g.levelLostBall = false
  g.bossSys.clear()
  g.boomQueue = []
  g.fieldShift = null
  resetMiniboss(g)
  const top = blockTop(g)
  if ("boss" in spec) {
    const { boss, blocks } = buildBossArena(
      spec.boss.hp,
      spec.boss.minions,
      spec.boss.bombs,
      g.w,
      g.h,
      top
    )
    g.bossSys.spawn(boss)
    g.blocks = blocks
  } else if ("layout" in spec) {
    g.blocks = layoutBlocks(spec, g.w, g.h, densityFactor(g.w, g.h), top)
  } else {
    g.blocks = gridBlocks(spec, g.w, g.h, densityFactor(g.w, g.h), top)
  }
  g.blocksInitial = Math.max(1, g.blocks.length)
}

export function buildWave(g: Game, n: number) {
  g.waveSpec = { name: `ВОЛНА ${n}`, speed: clamp(380 + n * 22, 380, 650) }
  if (n % 5 === 0) {
    buildBossLevel(g, 38 + n * 4, Math.min(5, 3 + Math.floor(n / 10)), 4)
    return
  }
  const rng = mulberry32(daySeed() * 31 + n * 7919)
  const rows = clamp(5 + Math.floor(n / 3), 5, 8)
  const spec: PatternSpec = {
    name: g.waveSpec.name,
    speed: g.waveSpec.speed,
    rows,
    counts: Array.from({ length: rows }, (_, r) =>
      clamp(6 + ((r + n) % 3) + Math.floor(n / 4), 6, 10)
    ),
    shape: () => {
      const t = rng()
      return (t < 0.5 ? "circle" : t < 0.78 ? "eh" : "ev") as "circle" | "eh" | "ev"
    },
    hp: (r) =>
      (r < rows * 0.4 ? (rng() < 0.4 ? 3 : 2) : r < rows * 0.75 ? (rng() < 0.45 ? 2 : 1) : 1) as
        1 | 2 | 3,
  }
  buildFromSpec(g, spec)
}

export function buildBossLevel(g: Game, hp: number, minions: number, bombs: number) {
  resetMiniboss(g)
  const { boss, blocks } = buildBossArena(hp, minions, bombs, g.w, g.h, blockTop(g))
  g.bossSys.spawn(boss)
  g.blocks = blocks
  g.blocksInitial = Math.max(1, blocks.length)
}

/** Финальный босс кампании — осьминог/кракен: тело + щупальца, параметры из варианта. */
export function buildOctopusBossLevel(g: Game, variant: BossVariant) {
  g.bossSys.clear()
  g.boomQueue = []
  g.fieldShift = null
  resetMiniboss(g)
  g.blocks = []
  const boss = buildOctopusBoss(g, variant.hp, variant)
  g.bossSys.spawn(boss)
  g.blocksInitial = Math.max(1, g.blocks.length)
}

/** Скорость шара: в узле карты — по раскладке, иначе безопасный фолбэк. */
export function levelSpeed(g: Game) {
  if (g.mode === "endless") return g.waveSpec?.speed ?? 400
  if (g.activeSpec) return g.activeSpec.speed
  return LEVELS[clamp(g.level - 1, 0, LEVELS.length - 1)].speed
}

export function levelDisplayName(g: Game) {
  if (g.mode === "endless") return g.waveSpec?.name ?? "ВОЛНА"
  if (g.onBossNode) return "БОСС"
  if (g.activeSpec) return g.activeSpec.name
  return LEVELS[clamp(g.level - 1, 0, LEVELS.length - 1)].name
}

export function serveBall(g: Game) {
  // базовая скорость повышена на 50%
  const base = clamp(
    Math.min(
      g.h * 0.62,
      (levelSpeed(g) + (g.mode === "endless" ? g.wave * 18 : g.level * 45)) * 1.5
    ),
    540,
    1140
  )
  /* Единый масштаб мира (viewport.ts): скорость одна на всех экранах —
       поле в мировых единицах имеет сопоставимые пропорции. */
  const speed = base
  /* Старт: шар на поверхности ракетки (купол выше грани, чаша — ниже). */
  const bump = Physics.surfaceAt(g.paddle.w / 2, 0, g.paddleShapeKind(), g.paddle.h)
  const ball: Ball = {
    x: g.paddle.x,
    y: g.paddle.y - g.paddle.h / 2 - bump - 9 - 2,
    vx: 0,
    vy: 0,
    r: 9,
    speed: speed,
    stuck: true,
    stuckOffset: 0,
    trail: [],
    squash: 0,
    sinceHit: 0,
  }
  g.balls = [ball]
  g.spawnTimer = rand(16, 22)
  g.skyDropTimer = rand(18, 27)
  g.shiftTimer = rand(12, 18)
  g.fieldShift = null
  pushHud(g)
}

/* ---------- обновление ---------- */

export function buildOctopusBoss(
  g: Game,
  hp = 50,
  opts?: { tentacles?: number; bombEvery?: number; angryAt?: number }
): BossState {
  const octoHp = hp
  // Создаём щупальца вокруг тела босса — каждый из нескольких сегментов-шариков,
  // уменьшающихся к концу, как провода. Сегменты начинаются от кольца здоровья
  // босса и извиваются по длине, как змея.
  const tentacleCount = opts?.tentacles ?? 6
  const SEG_COUNT = 4
  const SEG_RADII = [25, 20, 15, 10] // от базы к кончику (+5px)
  const SEG_SPACING = 24 // расстояние между центрами сегментов
  const TENTACLE_LENGTH = SEG_COUNT * SEG_SPACING // ~96px
  const HEALTH_RING_R = 14 // радиус кольца здоровья (r + 14)
  const WAVE_AMP = 22 // синхронизировано с boss.ts (анимация волн)
  const WAVE_SPEED = 1.3
  for (let i = 0; i < tentacleCount; i++) {
    // Направление от центра босса к точке прикрепления щупальца.
    const ang = (i / tentacleCount) * Math.PI * 2
    // Точка на кольце здоровья босса (внешняя окружность r+14)
    const bodyX = g.w / 2
    const bodyY = g.h * 0.28
    const dirX = Math.cos(ang)
    const dirY = Math.sin(ang) * 0.5
    const baseR = 40 + HEALTH_RING_R // r босса + радиус кольца здоровья
    const baseX = bodyX + dirX * baseR
    const baseY = bodyY + dirY * baseR
    for (let seg = 0; seg < SEG_COUNT; seg++) {
      // Прогресс по длине щупальца (0.25 = первый сегмент, 1 = кончик).
      const segT = (seg + 1) / SEG_COUNT
      const along = segT * TENTACLE_LENGTH
      // Волновое отклонение при спавне (используем t=0 для начальной фазы).
      const phase = seg * 0.9
      const wave = Math.sin(0 * WAVE_SPEED + phase) * WAVE_AMP * segT
      const perpX = -dirY
      const perpY = dirX
      const bx = baseX + dirX * along + perpX * wave
      const by = baseY + dirY * along + perpY * wave
      g.blocks.push({
        x: bx,
        y: by,
        rx: SEG_RADII[seg],
        ry: SEG_RADII[seg],
        rot: 0,
        circle: true,
        hp: seg === SEG_COUNT - 1 ? 2 : 4,
        maxHp: seg === SEG_COUNT - 1 ? 2 : 4,
        tier: 2,
        flash: 0,
        seed: Math.random() * 1000 + seg * 100,
        dead: false,
        x0: bx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: false,
        minionOrbit: {
          ang,
          rad: 90,
          dir: 1,
          speed: 0.8,
        },
        isTentacle: true,
        tentacleId: i,
        tentacleSeg: seg,
        tentacleOrbit: {
          ang,
          rad: 90,
          dir: 1,
          speed: 0.8,
          seg: seg,
        },
      } as Block & { isTentacle: true; tentacleId: number; tentacleSeg: number })
    }
  }
  return {
    x: g.w / 2,
    y: g.h * 0.28,
    baseY: g.h * 0.28,
    r: 52,
    hp: octoHp,
    maxHp: octoHp,
    t: 0,
    flash: 0,
    dropTimer: 4,
    isOctopus: true,
    totalTentacles: tentacleCount,
    bombEvery: opts?.bombEvery,
    angryAt: opts?.angryAt,
  } as BossState & { isOctopus: true }
}

/* ---------- жизненный цикл ---------- */
