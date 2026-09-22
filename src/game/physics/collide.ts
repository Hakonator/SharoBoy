import type { Ball, PaddleShapeKind } from "../types"
import { clamp } from "../utils"
import type { PhysicsWorld } from "../physics"

import { convexBump, surfaceAt } from "./shapes"
import { FIREBALL_DAMAGE_MULT, damageBlock } from "./destruction"
import { freezeCluster } from "./frost"
import { queueSparkChain, sparkChainTargets } from "./spark"

/** Отскок от ракетки: угол зависит от точки попадания и её скорости; магнит — прилипание. */
export function collidePaddle(g: PhysicsWorld, ball: Ball) {
  const p = g.paddle
  const rot = p.rot ?? 0
  // Трансформируем координаты шара в локальную систему ракетки (с учётом поворота)
  const dx = ball.x - p.x
  const dy = ball.y - p.y
  const cs = Math.cos(-rot)
  const sn = Math.sin(-rot)
  const lx = dx * cs - dy * sn
  const ly = dx * sn + dy * cs
  // Форма (купол/чаша) выходит за плоскую грань — расширяем зону проверки
  const shape = g.paddleShape()
  const bump = shape === "flat" ? 0 : convexBump(p.w / 2)
  const halfW = p.w / 2 + ball.r
  const halfH = p.h / 2 + ball.r + bump
  // Проверяем коллизию в локальных координатах
  if (Math.abs(lx) > halfW || Math.abs(ly) > halfH) return
  // Cooldown после предыдущего отскока: шар не должен повторно задевать
  // ракетку на следующих субшагах (особенно при её вращении по удержанию).
  if (ball.sinceHit < 0.05) return
  // Шар должен двигаться вниз (в локальных координатах)
  const lvy = ball.vx * sn + ball.vy * cs
  if (lvy <= 0) return
  const rel = clamp(lx / (p.w / 2), -1, 1)
  // магнит: шар прилипает вместо отскока
  if (g.magnetActive() && !ball.stuck) {
    ball.stuck = true
    ball.stuckOffset = clamp(lx, -p.w / 2 + ball.r, p.w / 2 - ball.r)
    ball.vx = 0
    ball.vy = 0
    ball.squash = 1
    ball.sinceHit = 0
    g.sfx.paddle(Math.abs(rel))
    g.fx.burst(ball.x, p.y + ly - ball.r, "#4dff9e", 8, 140)
    return
  }
  // Купол (∪/∩): мяч отражается по нормали поверхности формы в точке
  // попадания. Купол «convex» разводит мяч к краям, чаша «concave»
  // сводит к центру — всё через единую формулу surfaceAt.
  if (shape !== "flat") {
    // Точная проверка: если шар ещё над поверхностью в этой точке —
    // контакта нет (грубая AABB-зона шире фактической поверхности).
    const ySurf = p.y - p.h / 2 - surfaceAt(p.w / 2, rel, shape, p.h)
    if (ball.y + ball.r < ySurf) return
    collidePaddleShape(g, ball, rel, shape)
    return
  }
  // Поворотный эффект (ЛКМ/ПКМ) меняет наклон ракетки — отскок зеркальный
  // по нормали ракетки, без арканоидного «искажения» (угол и так задаётся
  // наклоном). Арканоидная механика — только на не-повёрнутой ракетке.
  const nx = Math.sin(rot)
  const ny = -Math.cos(rot)
  if (g.paddleRotatable()) {
    const dot = ball.vx * nx + ball.vy * ny
    const rvx = ball.vx - 2 * dot * nx
    let rvy = ball.vy - 2 * dot * ny
    // Страховка: отскок не должен отправлять мяч вниз
    if (rvy > 0) rvy = -rvy
    ball.vx = rvx
    ball.vy = rvy
  } else {
    // Классический арканоидный отскок (как в изначальной версии): угол зависит
    // от точки попадания (rel·1.05 рад ≈ ±60°) и от скорости движения ракетки —
    // «искажение» траектории в зависимости от места отскока.
    const ang = -Math.PI / 2 + rot + rel * 1.05 + clamp(p.vx * 0.0004, -0.3, 0.3)
    const sp = Math.hypot(ball.vx, ball.vy) || ball.speed
    ball.vx = Math.cos(ang) * sp
    ball.vy = Math.sin(ang) * sp
    // Страховка: отскок не должен отправлять мяч вниз (при сильном наклоне)
    if (ball.vy > 0) {
      const s2 = Math.hypot(ball.vx, ball.vy) || 1
      ball.vy = -ball.vy
      const vxs = Math.sqrt(Math.max(s2 * s2 - ball.vy * ball.vy, 0))
      ball.vx = Math.sign(ball.vx || 1) * vxs
    }
  }
  // Корректируем позицию шара: выталкиваем вдоль нормали ракетки
  const pen = halfH + ball.r - Math.abs(ly) // глубина проникновения
  if (pen > 0) {
    ball.x = ball.x + nx * pen
    ball.y = ball.y + ny * pen
  }
  ball.squash = 1
  ball.sinceHit = 0
  p.squash = 1
  g.combo = 0
  g.sfx.paddle(Math.abs(rel))
  g.fx.burst(ball.x, ball.y - ball.r, "#7cf5ff", 6, 130)
  g.pushHud()
}
/** Отскок от изогнутой поверхности ракетки (купол или чаша). Поверхность —
 *  парабола y(rel) = yTop - sign·bump·(1-rel²), sign = +1 купол / -1 чаша.
 *  Нормаль из наклона: dy/dx = -sign·2·bump·rel / halfW. Купол разводит мяч
 *  от центра к краям, чаша сводит к центру — единая формула surfaceAt. */
export function collidePaddleShape(
  g: PhysicsWorld,
  ball: Ball,
  rel: number,
  kind: PaddleShapeKind
) {
  const p = g.paddle
  const halfW = p.w / 2
  // Обе формы — ленты постоянной толщины с одинаковой глубиной (convexBump).
  const bump = convexBump(halfW)
  const sign = kind === "concave" ? -1 : 1
  // Наклон поверхности: f'(x) = sign·2·bump·rel / halfW (нормаль вверх).
  // Для convex (sign=+1) rel>0 → наклон вниз к краю, нормаль наружу вправо-
  // вверх; для concave — зеркально (к центру).
  const slope = (sign * 2 * bump * rel) / halfW
  const len = Math.hypot(slope, 1)
  const nx = slope / len
  const ny = -1 / len
  // Отражение: v' = v - 2(v·n)n
  const dot = ball.vx * nx + ball.vy * ny
  const rvx = ball.vx - 2 * dot * nx
  let rvy = ball.vy - 2 * dot * ny
  // Страховка: поверхность всегда отбрасывает мяч вверх
  if (rvy > 0) rvy = -rvy
  ball.vx = rvx
  ball.vy = rvy
  // Скорость не должна упасть ниже нормы (плоский удар в вершину формы)
  const sp = Math.hypot(ball.vx, ball.vy)
  const minSpeed = ball.speed * 0.8
  if (sp < minSpeed) {
    const scale = minSpeed / (sp || 1)
    ball.vx *= scale
    ball.vy *= scale
  }
  // Выталкивание на поверхность формы в точке попадания
  const ySurf = p.y - p.h / 2 - surfaceAt(halfW, rel, kind, p.h)
  if (ball.y > ySurf - ball.r) ball.y = ySurf - ball.r
  ball.squash = 1
  ball.sinceHit = 0
  p.squash = 1
  g.combo = 0
  g.sfx.paddle(Math.abs(rel))
  g.fx.burst(ball.x, ball.y - ball.r, "#7cf5ff", 6, 130)
  g.pushHud()
}
/** Столкновения с блоками: локальные координаты повёрнутого эллипса, отражение по нормали. */
export function collideBlocks(g: PhysicsWorld, ball: Ball) {
  const fire = g.fireActive()
  for (const b of g.blocks) {
    if (b.dead) continue
    const ex = b.rx + ball.r
    const ey = b.ry + ball.r
    const dx = ball.x - b.x
    const dy = ball.y - b.y
    const cs = Math.cos(b.rot)
    const sn = Math.sin(b.rot)
    const lx = dx * cs + dy * sn
    const ly = -dx * sn + dy * cs
    const q = (lx * lx) / (ex * ex) + (ly * ly) / (ey * ey)
    if (q > 1) continue

    let nx = lx / (ex * ex)
    let ny = ly / (ey * ey)
    const nl = Math.hypot(nx, ny) || 1
    nx /= nl
    ny /= nl
    const wnx = nx * cs - ny * sn
    const wny = nx * sn + ny * cs
    const sc = 1 / Math.sqrt(Math.max(q, 1e-6))
    const plx = lx * sc
    const ply = ly * sc
    ball.x = b.x + plx * cs - ply * sn + wnx * 0.8
    ball.y = b.y + plx * sn + ply * cs + wny * 0.8
    ball.sinceHit = 0
    if (fire && !b.isMiniboss && !(g.frostActive() && !b.frozen)) {
      // обычные блоки огонь прожигает насквозь (без отскока)
      g.sfx.burn()
      damageBlock(g, b, g.debugBallDamage * FIREBALL_DAMAGE_MULT)
      continue
    }
    // морозный мяч: живой блок и соседи замораживаются вместо урона,
    // мяч просто отскакивает — раскол произойдёт от следующего удара
    if (g.frostActive() && !b.frozen && !b.isMiniboss && !b.bomb) {
      const frozen = freezeCluster(g.blocks, b)
      if (frozen.length > 0) {
        g.sfx.freeze()
        g.fx.burst(b.x, b.y, "#bfeaff", 10, 140)
        g.fx.rings.push({
          x: b.x,
          y: b.y,
          r: 8,
          maxR: 86,
          color: "rgba(124,214,255,0.8)",
          t: 0,
        })
      }
      const fdot = ball.vx * wnx + ball.vy * wny
      if (fdot < 0) {
        ball.vx -= 2 * fdot * wnx
        ball.vy -= 2 * fdot * wny
      }
      ball.squash = 1
      return
    }
    // блоки минибоссов (и любые — у обычного шара) отскакивают: «прожигание»
    // насквозь превращало минибосса в машинку урона; огонь бьёт ×3 от обычного
    const dot = ball.vx * wnx + ball.vy * wny
    if (dot < 0) {
      ball.vx -= 2 * dot * wnx
      ball.vy -= 2 * dot * wny
    }
    damageBlock(g, b, g.debugBallDamage * (fire ? FIREBALL_DAMAGE_MULT : 1))
    // электрошар: обычный урон уже нанесён, искры цепочкой перескакивают
    // по соседним блокам (звенья бьют по расписанию из очереди); сам блок
    // удара исключён — свой урон он уже получил
    if (g.sparkActive()) {
      queueSparkChain(g.sparkQueue, sparkChainTargets(g.blocks, b, { exclude: b }), b, g.time)
    }
    return
  }
}
/** Столкновение с боссом: круговое отражение + урон (огненное ядро бьёт сильнее). */
export function collideBoss(g: PhysicsWorld, ball: Ball) {
  const bo = g.boss
  if (!bo || ball.stuck) return
  const dx = ball.x - bo.x
  const dy = ball.y - bo.y
  const dist = Math.hypot(dx, dy)
  const min = bo.r + ball.r
  if (dist >= min) return
  const nx = dx / (dist || 1)
  const ny = dy / (dist || 1)
  ball.x = bo.x + nx * (min + 1)
  ball.y = bo.y + ny * (min + 1)
  const dot = ball.vx * nx + ball.vy * ny
  if (dot < 0) {
    ball.vx -= 2 * dot * nx
    ball.vy -= 2 * dot * ny
  }
  ball.squash = 1
  ball.sinceHit = 0
  g.damageBoss(g.debugBallDamage * (g.fireActive() ? FIREBALL_DAMAGE_MULT : 1), false)
}
