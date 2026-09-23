import { TIER } from "../palette"
import type { Block } from "../types"
import { clamp, compactInPlace, rand } from "../utils"
import type { PhysicsWorld } from "../physics"

/** Урон огненного ядра: множитель от обычного урона шара. */
export const FIREBALL_DAMAGE_MULT = 3

/** Множитель очков серии: растёт с комбо до ×3. */
export function comboMult(g: PhysicsWorld): number {
  return 1 + Math.min(g.combo, 20) * 0.1
}

/** Урон блоку; при разрушении — очки, эффекты, дроп бонуса, «матрёшка». */
export function damageBlock(g: PhysicsWorld, b: Block, dmg = 1) {
  // Блоки минибосса неразрушаемы: урон идёт в пул HP его существа.
  if (b.isMiniboss) {
    b.flash = 1
    g.damageMiniboss(dmg, b)
    return
  }
  b.hp -= dmg
  b.flash = 1
  if (b.hp > 0) {
    g.sfx.brick(b.tier)
    g.fx.burst(b.x, b.y, TIER[b.tier].base, 5, 130)
    g.combo++
    g.addScore(10 * comboMult(g), b.x, b.y, "#9fd6ea", 12)
    if (b.tier === 3) g.hitStop = Math.max(g.hitStop, 0.03)
    g.pushHud()
    return
  }
  b.dead = true
  // Если уничтожен сегмент щупальца, то уничтожаем все сегменты,
  // которые дальше от туловища (с большим номером tentacleSeg).
  if (b.isTentacle) {
    const tentacleId = (b as any).tentacleId
    const seg = (b as any).tentacleSeg!
    for (const other of g.blocks) {
      if (
        other.isTentacle &&
        (other as any).tentacleId === tentacleId &&
        (other as any).tentacleSeg! > seg
      ) {
        other.dead = true
      }
    }
  }
  compactInPlace(g.blocks, (x) => !x.dead)
  if (b.bomb && !b.boomQueued) {
    b.boomQueued = true
    g.boomQueue.push({ x: b.x, y: b.y, at: g.time + 0.09 })
  }
  if (b.splits) spawnScatter(g, b)
  g.combo++
  const mult = comboMult(g)
  g.addScore((30 + b.tier * 20) * mult, b.x, b.y, TIER[b.tier].base, 14 + b.tier * 2)
  if (b.frozen) {
    // замороженный блок колется с одного удара: веер ледяных осколков
    g.sfx.iceShatter()
    g.fx.iceShatter(b.x, b.y)
  } else {
    g.sfx.destroy(b.tier)
    g.fx.burst(b.x, b.y, TIER[b.tier].base, 10 + b.tier * 4, 190 + b.tier * 40)
  }
  g.fx.rings.push({
    x: b.x,
    y: b.y,
    r: 6,
    maxR: 40 + b.tier * 18,
    color: "rgba(234,247,255,0.7)",
    t: 0,
  })
  g.shake = Math.min(g.shake + b.tier, 9)
  if (b.tier === 3) g.hitStop = Math.max(g.hitStop, 0.05)

  // вехи серии
  if (g.combo === 5 || g.combo === 10 || g.combo === 15) {
    const word = g.combo === 5 ? "ГОРЯЧО!" : g.combo === 10 ? "НЕУДЕРЖИМО!" : "БЕЗУМИЕ!"
    g.fx.popups.push({
      x: g.w / 2,
      y: g.h * 0.3,
      text: `${word} ×${g.combo}`,
      color: "#ffc94d",
      t: 0,
      size: 30,
    })
    g.fx.rings.push({
      x: g.w / 2,
      y: g.h * 0.3,
      r: 10,
      maxR: 150,
      color: "rgba(255,201,77,0.6)",
      t: 0,
    })
    g.sfx.levelClear()
  }

  // дроп из блока
  g.dropPower(b.x, b.y)

  // монеты
  if (Math.random() < 0.05) {
    g.powers.push({ x: b.x, y: b.y, vy: 150, type: "coin", t: 0 })
  }
  g.pushHud()
}

/** «Матрёшка»: вокруг разбитого блока рассыпаются 3–10 крупных шаров. */
export function spawnScatter(g: PhysicsWorld, b: Block) {
  if (g.blocks.length > 150) return
  const n = 3 + Math.floor(rand(0, 8))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.4, 0.4)
    const d = Math.max(b.rx, b.ry) * rand(1.7, 2.4)
    const r = rand(17, 23)
    const cx = clamp(b.x + Math.cos(a) * d, r + 6, g.w - r - 6)
    const cy = clamp(b.y + Math.sin(a) * d, r + 6, g.h * 0.72)
    g.blocks.push({
      x: cx,
      y: cy,
      rx: r,
      ry: r,
      rot: 0,
      circle: true,
      hp: 1,
      maxHp: 1,
      tier: 1,
      flash: 1,
      seed: rand(0, Math.PI * 2),
      dead: false,
      x0: cx,
      swayAmp: 0,
      swayFreq: 0,
      swayPh: 0,
      bomb: false,
      splits: false,
    })
  }
  g.fx.popups.push({ x: b.x, y: b.y, text: "РАССЫПЬ!", color: "#5dffb0", t: 0, size: 16 })
  g.fx.rings.push({ x: b.x, y: b.y, r: 8, maxR: 90, color: "rgba(93,255,176,0.7)", t: 0 })
  g.fx.burst(b.x, b.y, "#5dffb0", 10, 200)
}

/** Обновление бомб осьминога: движение и столкновение с ракеткой. */
export function updateBombs(g: PhysicsWorld, dt: number) {
  const p = g.paddle
  for (const b of g.blocks) {
    if (!b.bomb || b.hitsPaddle === undefined) continue
    // Движение бомбы
    b.x += (b.bombVx ?? 0) * dt
    b.y += (b.bombVy ?? 0) * dt
    // Отскок от боковых стен
    if (b.x - b.rx < 0) {
      b.x = b.rx
      b.bombVx = Math.abs(b.bombVx ?? 0)
    }
    if (b.x + b.rx > g.w) {
      b.x = g.w - b.rx
      b.bombVx = -Math.abs(b.bombVx ?? 0)
    }
    // Потеря за нижней границей
    if (b.y > g.h + b.ry * 2) {
      b.dead = true
      continue
    }
    // Столкновение с ракеткой
    const top = p.y - p.h / 2
    if (
      b.y + b.ry >= top &&
      b.y - b.ry <= p.y + p.h / 2 &&
      b.x >= p.x - p.w / 2 - b.rx &&
      b.x <= p.x + p.w / 2 + b.rx
    ) {
      b.dead = true
      // Бомба отнимает жизнь
      g.onBombHitPaddle()
      g.shake = Math.min(g.shake + 8, 14)
      g.flash = 0.6
      g.sfx.explosion()
      g.fx.burst(b.x, b.y, "#ff6a5c", 20, 300)
      g.fx.burst(b.x, b.y, "#ffc94d", 12, 200)
    }
  }
  compactInPlace(g.blocks, (x) => !x.dead)
}
