import { POWER_META } from "../palette"
import type { PowerType } from "../types"
import { rand } from "../utils"
import type { PowersWorld } from "../powers"

/** Применение эффекта подобранного бонуса к состоянию движка. */
export function applyPower(g: PowersWorld, type: PowerType) {
  const meta = POWER_META[type]
  g.sfx.power()
  const popup = (text: string) =>
    g.fx.popups.push({
      x: g.paddle.x,
      y: g.paddle.y - 40,
      text,
      color: meta.color,
      t: 0,
      size: 18,
    })
  switch (type) {
    case "wide":
      g.wideUntil = g.time + 12
      g.shrinkUntil = 0
      popup("ШИРОКАЯ РАКЕТКА")
      break
    case "slow":
      g.slowUntil = g.time + 8
      g.fastUntil = 0
      popup("ЗАМЕДЛЕНИЕ")
      break
    case "shield":
      g.shield = Math.min(5, g.shield + 3)
      popup("ЗАЩИТНЫЙ ЭКРАН")
      break
    case "laser":
      // луч не стреляет сам: бонус взводит лазер, залп — по пробелу/клику
      g.laserArmed = true
      g.laserArmedUntil = g.time + 4
      popup("ЛАЗЕР ГОТОВ — ПРОБЕЛ")
      break
    case "rocket":
      g.rocketUntil = g.time + 12
      popup("РАКЕТЫ — ПРОБЕЛ")
      break
    case "fire":
      g.fireUntil = g.time + 8
      popup("ОГНЕННОЕ ЯДРО!")
      break
    case "magnet":
      g.magnetUntil = g.time + 7
      popup("МАГНИТ!")
      break
    case "multi": {
      // ×3: добавляем ровно ДВА дополнительных шара (раньше клонировался
      // каждый свободный шар, и при одном шаре в игре появлялся лишь один).
      const donors = g.balls.filter((b) => !b.stuck)
      const base = donors[0] ?? g.balls[0]
      if (base) {
        for (let i = 0; i < 2; i++) {
          if (g.balls.length >= 6) break
          const d = donors[i] ?? base
          const ang = rand(-Math.PI * 0.85, -Math.PI * 0.15)
          g.balls.push({
            x: d.x,
            y: d.y,
            vx: Math.cos(ang) * d.speed,
            vy: Math.sin(ang) * d.speed,
            r: d.r,
            speed: d.speed,
            stuck: false,
            stuckOffset: 0,
            trail: [],
            squash: 0,
            sinceHit: 0,
          })
        }
      }
      popup("×3 ШАРА!")
      break
    }
    case "life":
      g.lives = Math.min(5, g.lives + 1)
      popup("+1 ЖИЗНЬ")
      break
    case "coin":
      g.addCoins(1)
      popup("+1 МОНЕТА")
      g.sfx.coin()
      g.fx.burst(g.paddle.x, g.paddle.y - 12, "#ffd66b", 10, 170)
      break
    case "fast":
      g.fastUntil = g.time + 7
      g.slowUntil = 0
      g.sfx.powerBad()
      popup("УСКОРЕНИЕ!")
      break
    case "shrink":
      g.shrinkUntil = g.time + 9
      g.wideUntil = 0
      g.sfx.powerBad()
      popup("УЗКАЯ РАКЕТКА!")
      break
  }
  g.fx.burst(g.paddle.x, g.paddle.y - 10, meta.color, 12, 190)
  g.pushHud()
}
