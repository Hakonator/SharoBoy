import type { Game } from "../game"
import {
  buildArmoredCrab,
  buildEel,
  buildFish,
  buildJelly,
  isMinibossWeakPart,
  minibossName,
  CRAB_ARMOR,
  CRAB_SHARD_COUNT,
  CRAB_SHARD_SPEED,
  MINIBOSS_HP_FIRST,
  MINIBOSS_LIFE_CHANCE,
  saveDefeatedMinibosses,
} from "../minibosses"
import { rand } from "../utils"
import type { Block, MinibossCreature } from "../types"
import type { MinibossKind } from "../minibosses"
import { MINIBOSS_DUET_SHIFT } from "../minibosses"
import { recordChallengeArmor } from "../campaignChallenges"

import { pushHud } from "./hudSync"
import { blockTop } from "./paddleControl"
import { addRawScore } from "./runFlow"

/**
 * Кламп направления силуэта. Нужен только как страховка: направление берётся
 * из фазы покачивания, где скорость и так известна.
 */
const EEL_FACING_EPSILON = 0.08

/** Фабрика силуэта по виду существа. */
const BUILDERS: Record<
  MinibossKind,
  (w: number, h: number, top: number, group: number, cx: number) => Block[]
> = {
  fish: buildFish,
  jelly: buildJelly,
  armored_crab: buildArmoredCrab,
  slippery_eel: buildEel,
}
export function resetMiniboss(g: Game) {
  g.minibosses = []
  g.mbGroupSeq = 0
  g.mouthBubbles = []
  g.fishMouth = false
}

/** Добавляет существо-минибосса к текущему уровню (освободив ему место). */
export function addMiniboss(g: Game, kind: MinibossKind, hp = MINIBOSS_HP_FIRST) {
  const top = blockTop(g)
  const group = ++g.mbGroupSeq
  // Дуэт занимает поле симметрично: первое существо сдвигается влево, второе
  // рождается на таком же расстоянии вправо. Односторонний сдвиг оставлял
  // второе существо у правой стены, где его патруль сразу упирался в границу.
  const duetShift = g.minibosses.length > 0 ? g.w * MINIBOSS_DUET_SHIFT * 0.5 : 0
  if (duetShift > 0) {
    const first = g.minibosses[0]
    for (const b of g.blocks) {
      if (!b.isMiniboss || b.mbGroup !== first.group) continue
      b.x -= duetShift
      b.x0 -= duetShift
    }
    first.dropX -= duetShift
  }
  const creature = BUILDERS[kind](g.w, g.h, top, group, g.w / 2 + duetShift)
  // Минибосс появляется поверх раскладки, не удаляя блоки уровня.
  g.blocks = [...g.blocks, ...creature]
  g.blocksInitial = Math.max(1, g.blocks.length)
  const dropX = creature.reduce((s, b) => s + b.x, 0) / creature.length
  const dropY = creature.reduce((s, b) => s + b.y, 0) / creature.length
  g.minibosses.push({
    kind,
    group,
    hp,
    maxHp: hp,
    dropX,
    dropY,
    // «Панцирный краб» входит в бой с бронёй; у остальных видов брони нет.
    ...(kind === "armored_crab" ? { armor: CRAB_ARMOR } : {}),
    // «Скользкий угорь» плавает маятником от стены к стене: особого состояния
    // не нужно, силуэт разворачивается по фазе покачивания (`updateMinibosses`).
    ...(kind === "slippery_eel" ? { facing: 1 as const, lastX: dropX } : {}),
  })
  // У рыбы запоминаем точку рта (нос) — оттуда пойдут пузырьки воздуха.
  if (kind === "fish") {
    const bodyParts = creature.filter((b) => b.mbPart === "body")
    const maxX = Math.max(...bodyParts.map((b) => b.x + b.rx))
    const midY =
      (Math.min(...bodyParts.map((b) => b.y)) + Math.max(...bodyParts.map((b) => b.y))) / 2
    g.mouthX = maxX - 2
    g.mouthY = midY + 5
    g.fishMouth = true
    g.mouthBubbleTimer = rand(0.5, 1.2)
  }
  g.fx.popups.push({
    x: dropX,
    y: dropY - 70,
    text: `МИНИ-БОСС: ${minibossName(kind)}`,
    color: "#ffc94d",
    t: 0,
    size: 22,
  })
  g.sfx.power()
  pushHud(g)
}

/**
 * Урон в пул HP конкретного существа (блоки минибосса неразрушаемы —
 * вызывается из Physics.damageBlock с блоком, принявшим удар). Тело
 * вспыхивает, при обнулении пула существо взрывается цепочкой и
 * разыгрывается жизнь (MINIBOSS_LIFE_CHANCE).
 *
 * Особые виды (T-058):
 * — «Панцирный краб» гасит урон бронёй, пока она цела; уязвима только щель
 *   между клешнями. Пролом панциря выбрасывает `CRAB_SHARD_COUNT` осколков.
 */
export function damageMiniboss(g: Game, dmg: number, block: Block) {
  const creature = g.minibosses.find((c) => c.group === (block.mbGroup ?? 0))
  if (!creature || creature.hp <= 0) return

  let remaining = dmg
  // Броня краба: гасит урон по корпусу и клешням, щель бьётся всегда.
  if ((creature.armor ?? 0) > 0 && !isMinibossWeakPart(block.mbPart)) {
    const absorbed = Math.min(creature.armor ?? 0, remaining)
    creature.armor = (creature.armor ?? 0) - absorbed
    remaining -= absorbed
    // Тот же учёт, что и в хосте физики: прогресс испытания «Взломщик брони».
    if (absorbed > 0 && g.activeChallenge) {
      recordChallengeArmor(g.activeChallenge, absorbed, () => {
        g.fx.popups.push({
          x: g.w / 2,
          y: g.h * 0.44,
          text: "БРОНЯ ВЗЛОМАНА! 🛡",
          color: "#ffd700",
          t: 0,
          size: 22,
        })
      })
    }
    block.flash = 1
    if ((creature.armor ?? 0) === 0) {
      spawnCrabShards(g, creature)
      g.sfx.bossDie()
      g.shake = Math.min(g.shake + 6, 14)
    } else {
      g.sfx.brick(3, clampPan(g, block), g.combo)
      g.fx.burst(block.x, block.y, "#bfeaff", 8, 150)
    }
    if (remaining <= 0) {
      pushHud(g)
      return
    }
  }
  dmg = remaining

  creature.hp -= dmg
  addRawScore(g, 5)
  for (const b of g.blocks) {
    if (b.isMiniboss && (b.mbGroup ?? 0) === creature.group) b.flash = 1
  }
  if (creature.hp <= 0) killMiniboss(g, creature)
  pushHud(g)
}

function clampPan(g: Game, block: Block): number {
  return Math.max(-0.85, Math.min(0.85, (block.x / Math.max(1, g.w)) * 2 - 1))
}

/** Пузырьки изо рта рыбы: периодический выдох + подъём с покачиванием. */
export function killMiniboss(
  g: Game,
  creature: {
    kind: MinibossKind
    group: number
    hp: number
    maxHp: number
    dropX: number
    dropY: number
  }
) {
  const doomed = g.blocks.filter((b) => b.isMiniboss && (b.mbGroup ?? 0) === creature.group)
  let i = 0
  for (const b of doomed) {
    g.boomQueue.push({ x: b.x, y: b.y, at: g.time + 0.06 + i * 0.05 })
    b.dead = true
    i++
  }
  g.blocks = g.blocks.filter((b) => !b.dead)
  g.minibosses = g.minibosses.filter((c) => c.group !== creature.group)
  if (g.blocks.length === 0) {
    for (const ball of g.balls) {
      ball.vx = 0
      ball.vy = 0
      ball.squash = 0
      ball.lost = false
      ball.trail = []
    }
  }
  // рыба погибла — пузырьки изо рта и кильватер больше не нужны
  if (creature.kind === "fish") {
    g.mouthBubbles = []
    g.fishMouth = false
  }
  if (g.defeatedMinibossKinds && !g.defeatedMinibossKinds.includes(creature.kind)) {
    g.defeatedMinibossKinds = [...g.defeatedMinibossKinds, creature.kind]
    saveDefeatedMinibosses(g.defeatedMinibossKinds)
  }
  addRawScore(g, 800)
  g.fx.popups.push({
    x: creature.dropX,
    y: creature.dropY,
    text: "+800",
    color: "#ffc94d",
    t: 0,
    size: 26,
  })
  g.flash = 1
  g.hitStop = Math.max(g.hitStop, 0.3)
  g.shake = Math.min(g.shake + 10, 14)
  g.sfx.bossDie()
  if (Math.random() < MINIBOSS_LIFE_CHANCE) {
    g.powers.push({
      x: creature.dropX,
      y: creature.dropY,
      vy: 150,
      type: "life",
      t: 0,
    })
    g.fx.rings.push({
      x: creature.dropX,
      y: creature.dropY,
      r: 8,
      maxR: 120,
      color: "rgba(93,255,176,0.85)",
      t: 0,
    })
    g.fx.popups.push({
      x: creature.dropX,
      y: creature.dropY - 40,
      text: "ЖИЗНЬ!",
      color: "#5dffb0",
      t: 0,
      size: 22,
    })
    g.sfx.power()
  }
  pushHud(g)
}

/**
 * Босс-осьминог: тело + щупальца, которые нужно уничтожить первыми.
 * opts позволяет вариантам (осьминог/кракен) менять число щупалец,
 * частоту бомб и порог агрессии.
 */

/**
 * Осколки-снаряды из проломленного панциря краба: два бомбовых блока летят
 * вниз-в стороны, к краям ракетки. Поведение полностью переиспользует
 * бомбовую механику (`bomb`/`hitsPaddle`) — потеря жизни при попадании
 * и отскок от стен работают без правок физики.
 */
export function spawnCrabShards(g: Game, creature: MinibossCreature) {
  for (let i = 0; i < CRAB_SHARD_COUNT; i++) {
    const side = i === 0 ? -1 : 1
    const x = creature.dropX + side * 26
    const y = creature.dropY
    g.blocks.push({
      x,
      y,
      rx: 7,
      ry: 7,
      rot: 0,
      circle: true,
      hp: 1,
      maxHp: 1,
      tier: 3,
      flash: 0,
      seed: rand(0, Math.PI * 2),
      dead: false,
      x0: x,
      y0: y,
      swayAmp: 0,
      swayFreq: 0,
      swayPh: 0,
      bomb: true,
      splits: false,
      bombVx: side * CRAB_SHARD_SPEED * 0.45,
      bombVy: CRAB_SHARD_SPEED,
      hitsPaddle: true,
    })
  }
  g.fx.popups.push({
    x: creature.dropX,
    y: creature.dropY - 40,
    text: "ПАНЦИРЬ ПРОБИТ!",
    color: "#bfeaff",
    t: 0,
    size: 20,
  })
  g.fx.rings.push({
    x: creature.dropX,
    y: creature.dropY,
    r: 10,
    maxR: 130,
    color: "rgba(191, 234, 255, 0.9)",
    t: 0,
  })
}

/**
 * Покадровое обновление минибоссов: живой центр существа (для осколков краба
 * и дропа жизни) и направление силуэта угря по фазе его покачивания.
 * Вызывается из `game/updateStep.ts` после шага блоков.
 */
export function updateMinibosses(g: Game, dt: number) {
  if (!g.minibosses.length) return
  for (const creature of g.minibosses) {
    updateCreatureCenter(g, creature, dt)
  }
}

/**
 * Обновляет живой центр существа и направление его силуэта.
 *
 * Центр (`dropX/dropY`) нужен телеграфу рывка и эффектам: раньше он
 * вычислялся один раз при рождении, поэтому круг «предупреждения» появлялся
 * в стороне от угря, успевшего уплыть по полю.
 *
 * Направление (`facing`) считается по сдвигу центра за кадр — силуэт
 * разворачивается носом по ходу движения, в том числе у стен.
 */
/**
 * Обновляет живой центр существа и направление его силуэта.
 *
 * Центр (`dropX/dropY`) нужен эффектам и осколкам краба: раньше он
 * вычислялся один раз при рождении, поэтому снаряды и дроп появлялись в
 * стороне от успевшего уплыть существа.
 *
 * Направление (`facing`) считается **аналитически** — из производной синуса
 * покачивания, как у рыбы (`render/fish.ts`), а не по фактическому сдвигу
 * центра за кадр. Сдвиг давал два дефекта (жалоба 04.11.2026): силуэт мигал
 * на каждом развороте патруля (скорость проходит через ноль, и шум
 * переключал знак), а любое внешнее смещение воспринималось как собственное
 * движение. Производная не зависит ни от частоты кадров, ни от чужих сдвигов.
 */
function updateCreatureCenter(g: Game, creature: MinibossCreature, _dt: number) {
  const meanX = meanOfGroup(g, creature.group, "x")
  const meanY = meanOfGroup(g, creature.group, "y")
  if (meanX === null || meanY === null) return
  creature.lastX = meanX
  creature.dropX = meanX
  creature.dropY = meanY
  if (creature.kind !== "slippery_eel") return
  const facing = eelFacing(g, creature)
  if (facing !== undefined) creature.facing = facing
  const value = creature.facing ?? 1
  for (const b of g.blocks) {
    if (b.isMiniboss && (b.mbGroup ?? 0) === creature.group) b.mbFacing = value
  }
}

/**
 * Направление угря по производной его покачивания: скорость патруля
 * пропорциональна `cos(t·swayFreq + swayPh)`. В крайних точках производная
 * равна нулю, поэтому знак берётся только когда движение действительно есть —
 * иначе силуэт «дребезжал» бы на месте.
 */
function eelFacing(g: Game, creature: MinibossCreature): 1 | -1 | undefined {
  const head = g.blocks.find(
    (b) => b.isMiniboss && (b.mbGroup ?? 0) === creature.group && b.mbPart === "eel_head"
  )
  const freq = head?.swayFreq ?? 0
  if (!freq) return undefined
  const velocity = Math.cos(g.time * freq + (head?.swayPh ?? 0))
  // Мёртвая зона по производной, а не по смещению: у самого края патруля
  // существо почти стоит, и переключать нос рано.
  if (Math.abs(velocity) < EEL_FACING_EPSILON) return undefined
  return velocity > 0 ? 1 : -1
}

function meanOfGroup(g: Game, group: number, axis: "x" | "y"): number | null {
  let sum = 0
  let count = 0
  for (const b of g.blocks) {
    if (!b.isMiniboss || (b.mbGroup ?? 0) !== group) continue
    sum += b[axis]
    count++
  }
  return count > 0 ? sum / count : null
}
