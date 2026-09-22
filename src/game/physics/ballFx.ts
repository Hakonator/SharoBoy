/**
 * Искры элементальных шаров в полёте: огненное ядро и электрошар.
 * Только данные частиц — отрисовка остаётся в render/.
 */
import { rand } from "../utils"
import type { Ball } from "../types"
import type { PhysicsWorld } from "../physics"

export function spawnBallTrailFx(g: PhysicsWorld, ball: Ball) {
  // искры огненного ядра
  if (g.fireActive() && Math.random() < 0.75) {
    g.fx.particles.push({
      x: ball.x + rand(-5, 5),
      y: ball.y + rand(-5, 5),
      vx: rand(-30, 30),
      vy: rand(-120, -40),
      life: rand(0.2, 0.45),
      maxLife: 0.45,
      size: rand(2, 4),
      color: Math.random() < 0.5 ? "#ff8a3d" : "#ffc94d",
      grav: -120,
    })
  }
  // искры электрошара: короткие жёлтые разряды в следе
  if (g.sparkActive() && Math.random() < 0.65) {
    g.fx.particles.push({
      x: ball.x + rand(-4, 4),
      y: ball.y + rand(-4, 4),
      vx: rand(-90, 90),
      vy: rand(-90, 90),
      life: rand(0.12, 0.3),
      maxLife: 0.3,
      size: rand(1.5, 3),
      color: Math.random() < 0.5 ? "#ffe95c" : "#fff9c4",
      grav: 0,
    })
  }
}
