import type { Ball, Block, PaddleShapeKind } from "../types"
import { clamp } from "../utils"
import { BLOCK_MAGNET_STEER_RATE } from "../blockKinds"
import type { PhysicsWorld } from "../physics"

import { convexBump, surfaceAt } from "./shapes"
import { FIREBALL_DAMAGE_MULT, damageBlock } from "./destruction"
import { freezeCluster } from "./frost"
import { queueSparkChain, sparkChainTargets } from "./spark"
import { onBallHitSpecial } from "./special"

/** Ситуативная механика: «Критический сэйв» (Clutch Rebound).
 *  Активируется при отскоке шара от самого края платформы (|rel| >= 0.78),
 *  либо в опасной ситуации при 1 жизни (|rel| >= 0.70).
 *  Даёт короткий стоп-кадр, мощный золотой взрыв и заряжает шар удвоенным уроном на 2 попадания.
 */
export function applyClutchRebound(g: PhysicsWorld, ball: Ball, rel: number, paddlePan: number) {
  const isEdge = Math.abs(rel) >= 0.78
  const isLowLives = (g.lives ?? 3) <= 1
  const isHighDanger = isLowLives ? Math.abs(rel) >= 0.7 : isEdge
  const now = g.time
  const lastClutch = g.lastClutchTime ?? -999
  if (isHighDanger && now - lastClutch >= 2.5) {
    if (g.lastClutchTime !== undefined) g.lastClutchTime = now
    ball.clutchHits = 2
    g.hitStop = Math.max(g.hitStop, 0.08)
    g.shake = Math.min(g.shake + 3.5, 7)
    g.sfx.paddle(1, paddlePan)
    g.sfx.power()
    g.fx.burst(ball.x, ball.y, "#ffd700", 14, 220)
    g.fx.rings.push({
      x: ball.x,
      y: ball.y,
      r: 8,
      maxR: 85,
      color: "rgba(255, 215, 0, 0.85)",
      t: 0,
    })
    g.fx.popups.push({
      x: ball.x,
      y: ball.y - 28,
      text: "КРИТИЧЕСКИЙ СЭЙВ! ×2",
      color: "#ffd700",
      t: 0,
      size: 18,
    })
    g.onClutchSave?.()
  }
}

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
  const paddlePan = clamp((ball.x / g.w) * 2 - 1, -0.85, 0.85)
  // магнит: шар прилипает вместо отскока
  if ((g.magnetActive() || g.magneticPaddleActive()) && !ball.stuck) {
    ball.stuck = true
    ball.stuckOffset = clamp(lx, -p.w / 2 + ball.r, p.w / 2 - ball.r)
    ball.vx = 0
    ball.vy = 0
    ball.squash = 1
    ball.sinceHit = 0
    g.sfx.paddle(Math.abs(rel), paddlePan)
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
  g.resetBossCleanHits?.()
  const keepMult = g.comboMasterLevel ? (g.comboMasterLevel >= 2 ? 0.7 : 0.35) : 0
  g.combo = Math.floor(g.combo * keepMult)
  if (Math.abs(rel) > 0.65) g.hitStop = Math.max(g.hitStop, 0.015)
  applyClutchRebound(g, ball, rel, paddlePan)
  g.sfx.paddle(Math.abs(rel), paddlePan)
  g.fx.burst(ball.x, ball.y - ball.r, "#7cf5ff", 6, 130)
  g.onPaddleBounce?.()
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
  g.resetBossCleanHits?.()
  const keepMult = g.comboMasterLevel ? (g.comboMasterLevel >= 2 ? 0.7 : 0.35) : 0
  g.combo = Math.floor(g.combo * keepMult)
  if (Math.abs(rel) > 0.65) g.hitStop = Math.max(g.hitStop, 0.015)
  const paddlePan = clamp((ball.x / g.w) * 2 - 1, -0.85, 0.85)
  applyClutchRebound(g, ball, rel, paddlePan)
  g.sfx.paddle(Math.abs(rel), paddlePan)
  g.onPaddleBounce?.()
  g.pushHud()
}
export function collideBlocks(g: PhysicsWorld, ball: Ball) {
  const fire = g.fireActive()
  for (const b of g.blocks) {
    if (b.dead) continue
    if (b.sp?.phase && !isBlockPhaseActive(b, g.time)) continue
    // Порталы на кулдауне после телепорта полностью прозрачны для шара:
    // не отражают его и не получают урон обычным/огненным попаданием.
    if (b.sp?.portalId !== undefined && (b.sp.portalCd ?? 0) > 0) continue
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
    // специальный блок (§6): пружина/вата/вращение/телепорт. Телепорт
    // поглощает контакт целиком (без отражения и урона от шара).
    if (onBallHitSpecial(g, b, ball, lx, ly, ex)) return
    const blockPan = clamp((b.x / g.w) * 2 - 1, -0.85, 0.85)
    if (fire && !b.isMiniboss && !(g.frostActive() && !b.frozen)) {
      // обычные блоки огонь прожигает насквозь (без отскока)
      g.sfx.burn(blockPan)
      damageBlock(
        g,
        b,
        g.debugBallDamage * FIREBALL_DAMAGE_MULT,
        true,
        Math.atan2(ball.vy, ball.vx)
      )
      continue
    }
    // морозный мяч: живой блок и соседи замораживаются вместо урона,
    // мяч просто отскакивает — раскол произойдёт от следующего удара
    if (g.frostActive() && !b.frozen && !b.isMiniboss && !b.bomb) {
      const frozen = freezeCluster(g.blocks, b)
      if (frozen.length > 0) {
        g.sfx.freeze(blockPan)
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
    const impactAngle = Math.atan2(wny, wnx)
    let dmg = g.debugBallDamage * (fire ? FIREBALL_DAMAGE_MULT : 1)
    if (ball.clutchHits && ball.clutchHits > 0) {
      ball.clutchHits--
      dmg *= 2
      g.fx.burst(b.x, b.y, "#ffd700", 12, 200)
      g.fx.rings.push({
        x: b.x,
        y: b.y,
        r: 6,
        maxR: 44,
        color: "rgba(255, 215, 0, 0.85)",
        t: 0,
      })
    }
    damageBlock(g, b, dmg, true, impactAngle)
    if (b.isClaw) {
      const spd = Math.hypot(ball.vx, ball.vy)
      const targetSpd = clamp(spd * 1.15, 600, 1150)
      const scale = targetSpd / (spd || 1)
      ball.vx *= scale
      ball.vy *= scale
      g.fx.burst(b.x, b.y, "#ff9900", 8, 160)
    }
    // электрошар: обычный урон уже нанесён, искры цепочкой перескакивают
    // по соседним блокам (звенья бьют по расписанию из очереди); сам блок
    // удара исключён — свой урон он уже получил
    if (g.sparkActive()) {
      queueSparkChain(g.sparkQueue, sparkChainTargets(g.blocks, b, { exclude: b }), b, g.time)
    }
    return
  }
}

/** Фаза определяется абсолютным временем, без накопления таймерной ошибки. */
export function isBlockPhaseActive(b: Block, time: number): boolean {
  const phase = b.sp?.phase
  if (!phase) return true
  if (!Number.isFinite(phase.period) || phase.period <= 0) return true
  if (!Number.isFinite(phase.active) || !Number.isFinite(phase.offset)) return true
  const active = clamp(phase.active, 0, 1)
  const position = (((time + phase.offset) % phase.period) + phase.period) % phase.period
  return position < phase.period * active
}

/** Поле магнита прикладывается после нормализации скорости игровым циклом. */
export function applyBlockMagnets(g: PhysicsWorld, ball: Ball, dt: number) {
  let magnetVx = 0
  let magnetVy = 0
  let strongestFalloff = 0
  for (const block of g.blocks) {
    const magnet = block.sp?.magnet
    if (block.dead || !magnet || (block.sp?.phase && !isBlockPhaseActive(block, g.time))) continue
    if (!Number.isFinite(magnet.radius) || !Number.isFinite(magnet.force)) continue
    const dx = block.x - ball.x
    const dy = block.y - ball.y
    const distance = Math.hypot(dx, dy)
    const range = Math.max(0, magnet.radius)
    if (distance <= 1 || distance >= range) continue
    const falloff = 1 - distance / range
    strongestFalloff = Math.max(strongestFalloff, falloff)
    const repels = magnet.mode === "repel" || magnet.force < 0
    const polarity = repels ? -1 : 1
    const acceleration = Math.abs(magnet.force) * falloff * polarity
    magnetVx += (dx / distance) * acceleration
    magnetVy += (dy / distance) * acceleration
  }
  const magnetDelta = Math.hypot(magnetVx, magnetVy)
  const currentSpeed = Math.hypot(ball.vx, ball.vy)
  if (magnetDelta > 0 && currentSpeed > 0) {
    const from = Math.atan2(ball.vy, ball.vx)
    const to = Math.atan2(magnetVy, magnetVx)
    const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from))
    const maxTurn = BLOCK_MAGNET_STEER_RATE * strongestFalloff * dt
    const turn = clamp(delta, -maxTurn, maxTurn)
    const angle = from + turn
    ball.vx = Math.cos(angle) * currentSpeed
    ball.vy = Math.sin(angle) * currentSpeed
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
  // Механика критического урона ×3: 3 последовательных чистых попадания без касания ракетки
  const cleanHits = (g.bossCleanHits ?? 0) + 1
  const isCrit = cleanHits >= 3
  if (g.bossCleanHits !== undefined) {
    g.bossCleanHits = isCrit ? 0 : cleanHits
  }
  let dmg = g.debugBallDamage * (g.fireActive() ? FIREBALL_DAMAGE_MULT : 1)
  if (ball.clutchHits && ball.clutchHits > 0) {
    ball.clutchHits--
    dmg *= 2
    g.fx.burst(bo.x, bo.y, "#ffd700", 16, 240)
  }
  g.damageBoss(dmg, false, isCrit)
}
