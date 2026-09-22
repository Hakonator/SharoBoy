import { Block, MouthBubble } from "../types"
import { clamp } from "../utils"

import { roundRect, type Ctx } from "./shapes"
import { drawFish } from "./fish"
import { drawJelly } from "./jelly"

/**
 * Отрисовка минибоссов: блоки существа не рисуются генериком, вместо этого
 * части собираются в реалистичный силуэт (рыба/медуза) по тегам mbPart.
 * Существ в уровне может быть несколько — группы разбираются по mbGroup.
 * time нужен для анимации плавников/хвоста рыбы и пульса медузы.
 */
export function drawMinibosses(ctx: Ctx, blocks: Block[], time: number) {
  const parts = blocks.filter((b) => b.isMiniboss && !b.dead && b.mbPart)
  if (!parts.length) return
  const groups = new Map<number, Block[]>()
  for (const b of parts) {
    const key = b.mbGroup ?? 0
    const list = groups.get(key)
    if (list) list.push(b)
    else groups.set(key, [b])
  }
  for (const group of groups.values()) {
    if (group.some((p) => p.mbPart === "dome")) drawJelly(ctx, group, time)
    else drawFish(ctx, group, time)
  }
}

/** Пузырьки воздуха изо рта рыбы: поднимаются, покачиваясь, и лопаются. */
export function drawMouthBubbles(ctx: Ctx, bubbles: MouthBubble[]) {
  for (const b of bubbles) {
    const a = Math.max(0, 1 - b.t / b.life)
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(234,247,255,0.14)"
    ctx.fill()
    ctx.strokeStyle = "rgba(234,247,255,0.75)"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.32, Math.max(b.r * 0.22, 0.7), 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * Полоски HP над мини-боссами: по одной на каждое живое существо — по текущим
 * границам его блоков (группа mbGroup). Ничего не рисует для убитых существ.
 */
export function drawMinibossBar(
  ctx: Ctx,
  creatures: ReadonlyArray<{ group: number; hp: number; maxHp: number }>,
  blocks: Block[]
) {
  for (const creature of creatures) {
    if (creature.hp <= 0 || creature.maxHp <= 0) continue
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    for (const b of blocks) {
      if (!b.isMiniboss || b.dead) continue
      if ((b.mbGroup ?? 0) !== creature.group) continue
      minX = Math.min(minX, b.x - b.rx)
      maxX = Math.max(maxX, b.x + b.rx)
      minY = Math.min(minY, b.y - b.ry)
    }
    if (minX > maxX) continue
    const w = maxX - minX
    const x = minX
    const y = minY - 18
    const pct = clamp(creature.hp / creature.maxHp, 0, 1)
    // подложка
    ctx.fillStyle = "rgba(4,16,26,0.78)"
    roundRect(ctx, x - 2, y - 2, w + 4, 12, 6)
    ctx.fill()
    // заполнение: зелёный → жёлтый → розовый по остатку HP
    ctx.fillStyle = pct > 0.5 ? "#5dffb0" : pct > 0.25 ? "#ffc94d" : "#ff5ca8"
    if (pct > 0.02) {
      roundRect(ctx, x, y, Math.max(w * pct, 4), 8, 4)
      ctx.fill()
    }
    // рамка
    ctx.strokeStyle = "rgba(234,247,255,0.55)"
    ctx.lineWidth = 1
    roundRect(ctx, x - 2, y - 2, w + 4, 12, 6)
    ctx.stroke()
  }
}
