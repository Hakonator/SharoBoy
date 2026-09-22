import type { Game } from "../game"
import { fishFacing } from "../render"
import { rand } from "../utils"

export function updateMouthBubbles(g: Game, dt: number) {
  const fish = g.minibosses.find((c) => c.kind === "fish")
  if (g.fishMouth && fish && fish.hp > 0 && g.phase === "playing") {
    // рот следует за силуэтом: пузырьки выходят с носа той стороны, куда
    // рыба сейчас повёрнута (плавный разворот — fishFacing из render.ts)
    const bodyParts = g.blocks.filter(
      (b) => b.isMiniboss && b.mbPart === "body" && (b.mbGroup ?? 0) === fish.group
    )
    let facing = 1
    if (bodyParts.length) {
      facing = fishFacing(bodyParts, g.time)
      const minX = Math.min(...bodyParts.map((b) => b.x - b.rx))
      const maxX = Math.max(...bodyParts.map((b) => b.x + b.rx))
      const midY =
        (Math.min(...bodyParts.map((b) => b.y)) + Math.max(...bodyParts.map((b) => b.y))) / 2
      g.mouthX = facing >= 0 ? maxX - 12 : minX + 12
      g.mouthY = midY + 9
    }
    // выдох только когда рот открыт — та же фаза sin(t·0.85), что в отрисовке
    const open = Math.max(0, Math.sin(g.time * 0.85))
    if (open > 0.35) {
      g.mouthBubbleTimer -= dt
      if (g.mouthBubbleTimer <= 0) {
        g.mouthBubbleTimer = rand(1.1, 2.4)
        const n = 1 + Math.floor(rand(0, 3))
        for (let i = 0; i < n; i++) {
          g.mouthBubbles.push({
            x: g.mouthX + rand(-2, 2),
            y: g.mouthY + rand(-2, 2),
            vx: rand(6, 18) * (facing >= 0 ? 1 : -1),
            vy: -rand(34, 62),
            r: rand(2, 4.5),
            t: 0,
            life: rand(1.3, 2.4),
            ph: rand(0, Math.PI * 2),
          })
        }
      }
    } else {
      // пока рот закрыт, таймер держим почти заряженным — выдох начинается
      // сразу после открытия рта
      g.mouthBubbleTimer = Math.min(g.mouthBubbleTimer, 0.15)
    }
  }
  for (const b of g.mouthBubbles) {
    b.t += dt
    b.x += (b.vx + Math.sin(b.t * 4 + b.ph) * 14) * dt
    b.y += b.vy * dt
    b.vy -= 8 * dt // подъём ускоряется, как у настоящего пузырька
    b.r += 1.6 * dt
  }
  g.mouthBubbles = g.mouthBubbles.filter((b) => b.t < b.life)
}

/** Кильватер рыбы: шары рядом с проплывающей рыбой слегка сносит по её ходу. */
export function applyFishWake(g: Game, dt: number) {
  const fish = g.minibosses.find((c) => c.kind === "fish")
  if (!g.fishMouth || !fish || fish.hp <= 0 || g.phase !== "playing") return
  const bodyParts = g.blocks.filter(
    (b) => b.isMiniboss && b.mbPart === "body" && (b.mbGroup ?? 0) === fish.group
  )
  if (!bodyParts.length) return
  const minX = Math.min(...bodyParts.map((b) => b.x - b.rx))
  const maxX = Math.max(...bodyParts.map((b) => b.x + b.rx))
  const minY = Math.min(...bodyParts.map((b) => b.y - b.ry))
  const maxY = Math.max(...bodyParts.map((b) => b.y + b.ry))
  const fx = (minX + maxX) / 2
  const fy = (minY + maxY) / 2
  const f = bodyParts[0].swayFreq
  const amp = bodyParts[0].swayAmp
  const fishVx = Math.cos(g.time * f) * amp * f // скорость рыбы, px/с
  const R = 180
  for (const ball of g.balls) {
    if (ball.stuck) continue
    const dx = ball.x - fx
    const dy = ball.y - fy
    // эллипс влияния: тянется шире по горизонтали — за хвостом и перед носом
    const d = Math.hypot(dx, dy * 1.4)
    if (d < R) {
      const k = (1 - d / R) * 0.55
      ball.x += fishVx * dt * k
    }
  }
}

/** Смерть минибосса: цепочка взрывов по его силуэту и шанс дропа жизни. */
