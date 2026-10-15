import { describe, expect, it } from "vitest"

import { stepGravitationalFocus } from "./situational"
import { applyClutchRebound } from "./physics/collide"
import { damageBlock } from "./physics/destruction"
import { loseLife } from "./game/runFlow"
import type { Ball, Block, BossState } from "./types"
import type { Game } from "./game"
import type { PhysicsWorld } from "./physics"

function makeBlock(x: number, y: number, hp = 1): Block {
  return {
    x,
    y,
    x0: x,
    rx: 28,
    ry: 14,
    rot: 0,
    circle: false,
    hp,
    maxHp: hp,
    tier: 1,
    flash: 0,
    seed: 1,
    dead: false,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
  }
}

function makeBall(over: Partial<Ball> = {}): Ball {
  return {
    x: 400,
    y: 500,
    vx: 100,
    vy: -300,
    r: 9,
    speed: 400,
    stuck: false,
    stuckOffset: 0,
    trail: [],
    squash: 0,
    sinceHit: 0,
    ...over,
  }
}

describe("Ситуативные механики", () => {
  describe("1. Гравитационный фокус (Gravitational Focus)", () => {
    function makeFocusGame(over: Partial<Game> = {}): Game {
      const g = {
        w: 800,
        h: 900,
        cssW: 800,
        cssH: 900,
        scale: 1,
        touchMode: false,
        phase: "playing",
        bossSys: { boss: null as BossState | null },
        blocks: [makeBlock(100, 200), makeBlock(700, 200)],
        balls: [makeBall({ x: 120, y: 220 })],
        focusAlertShown: false,
        focusPulseTimer: 0,
        fx: { popups: [], rings: [], burst: () => {} },
        sfx: { levelClear: () => {} },
        ...over,
      } as unknown as Game
      return g
    }

    it("активируется при <= 3 блоках: показывает оповещение и дрейфует к центру", () => {
      const g = makeFocusGame()
      const b0 = g.blocks[0]
      const oldX0 = b0.x0

      stepGravitationalFocus(g, 0.1)

      expect(g.focusAlertShown).toBe(true)
      expect(g.fx.popups.length).toBeGreaterThan(0)
      expect(g.fx.popups[0].text).toBe("ФОКУС ЦЕЛИ!")
      // b0 был на x=100, должен сместиться вправо в сторону центра поля w/2=400
      expect(b0.x0).toBeGreaterThan(oldX0)
    })

    it("притягивает траекторию пролетающего вблизи шара к блоку", () => {
      const g = makeFocusGame({
        blocks: [makeBlock(400, 300)],
        balls: [makeBall({ x: 350, y: 300, vx: 0, vy: -300 })],
      })
      const ball = g.balls[0]
      expect(ball.vx).toBe(0)

      stepGravitationalFocus(g, 0.05)

      // Шар слева от блока (x=350, блок x=400), притяжение должно добавить vx > 0
      expect(ball.vx).toBeGreaterThan(0)
    })

    it("не срабатывает во время боя с боссом", () => {
      const g = makeFocusGame({
        bossSys: { boss: { x: 400, y: 200 } as BossState } as unknown as Game["bossSys"],
      })
      stepGravitationalFocus(g, 0.1)
      expect(g.focusAlertShown).toBe(false)
    })
  })

  describe("2. Критический сэйв (Clutch Rebound)", () => {
    function makePhysicsWorld(over: Partial<PhysicsWorld> = {}): PhysicsWorld {
      return {
        w: 800,
        h: 900,
        time: 10,
        lives: 3,
        lastClutchTime: -999,
        shake: 0,
        hitStop: 0,
        sfx: { paddle: () => {}, power: () => {} },
        fx: { burst: () => {}, rings: [], popups: [] },
        ...over,
      } as unknown as PhysicsWorld
    }

    it("срабатывает при отскоке шара от самого края ракетки (|rel| >= 0.78)", () => {
      const g = makePhysicsWorld()
      const ball = makeBall()

      applyClutchRebound(g, ball, 0.85, 0.5)

      expect(ball.clutchHits).toBe(2)
      expect(g.lastClutchTime).toBe(10)
      expect(g.hitStop).toBeGreaterThanOrEqual(0.08)
      expect(g.fx.popups.some((p) => p.text.includes("КРИТИЧЕСКИЙ СЭЙВ"))).toBe(true)
    })

    it("не срабатывает повторно во время кулдауна (2.5 сек)", () => {
      const g = makePhysicsWorld({ time: 11, lastClutchTime: 10 })
      const ball = makeBall()

      applyClutchRebound(g, ball, 0.9, 0.5)

      expect(ball.clutchHits).toBeUndefined()
      expect(g.lastClutchTime).toBe(10)
    })
  })

  describe("3. Перегрузка комбо / Резонанс (Combo Overdrive)", () => {
    it("при серии >= 6 бьёт молнией по ближайшему живому блоку", () => {
      const b1 = makeBlock(300, 300, 1)
      const b2 = makeBlock(360, 300, 2)
      const lightnings: unknown[] = []
      const popups: unknown[] = []

      const g = {
        w: 800,
        h: 900,
        time: 5,
        combo: 5,
        blocks: [b1, b2],
        shake: 0,
        hitStop: 0,
        dropPower: () => {},
        pushHud: () => {},
        powers: [],
        addScore: () => {},
        sfx: { brick: () => {}, destroy: () => {}, zap: () => {}, levelClear: () => {} },
        fx: {
          lightnings,
          popups,
          rings: [],
          burst: () => {},
        },
      } as unknown as PhysicsWorld

      damageBlock(g, b1, 1)

      // b1 уничтожен (+1 к комбо) + молния перегрузки ударила по b2 (+1 к комбо) = 7
      expect(g.combo).toBe(7)
      // Молния должна связать b1 и b2
      expect(lightnings.length).toBe(1)
      // b2 должен получить урон
      expect(b2.hp).toBe(1)
      // Попап «РЕЗОНАНС!»
      expect(popups.some((p) => (p as { text: string }).text === "РЕЗОНАНС!")).toBe(true)
    })
  })

  describe("4. Тактическое снабжение (Tactical Aid)", () => {
    it("при потере жизни до 1 даёт спасительный бонус", () => {
      const powers: unknown[] = []
      const popups: unknown[] = []

      const g = {
        w: 800,
        h: 900,
        cssW: 800,
        cssH: 900,
        scale: 1,
        touchMode: false,
        level: 1,
        lives: 2, // при вызове loseLife станет 1
        shield: 0,
        combo: 5,
        shake: 0,
        upgrades: {},
        runLivesLost: 0,
        levelLostBall: false,
        paddle: { rot: 0, x: 400, y: 850, w: 90, h: 14 },
        paddleShapeKind: () => "flat",
        balls: [],
        blocks: [],
        achQueue: [],
        onHud: () => {},
        powers,
        projectiles: [],
        fx: { popups },
        sfx: { loseLife: () => {}, muted: false, musicMuted: false },
      } as unknown as Game

      loseLife(g)

      expect(g.lives).toBe(1)
      expect(g.powers.length).toBe(1)
      expect((g.powers[0] as { type: string }).type).toBe("shield")
      expect(popups.some((p) => (p as { text: string }).text.includes("ПОДДЕРЖКА"))).toBe(true)
    })
  })
})
