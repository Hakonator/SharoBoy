import type { Game } from "../game"
import {
  buildFish,
  buildJelly,
  carveLevelBlocks,
  minibossName,
  MINIBOSS_HP,
  MINIBOSS_LIFE_CHANCE,
} from "../minibosses"
import { rand } from "../utils"
import type { Block } from "../types"
import type { MinibossKind } from "../minibosses"

import { pushHud } from "./hudSync"
import { blockTop } from "./paddleControl"
import { addRawScore } from "./runFlow"
export function resetMiniboss(g: Game) {
  g.minibosses = []
  g.mbGroupSeq = 0
  g.mouthBubbles = []
  g.fishMouth = false
}

/** Добавляет существо-минибосса к текущему уровню (освободив ему место). */
export function addMiniboss(g: Game, kind: MinibossKind, hp = MINIBOSS_HP[kind]) {
  const top = blockTop(g)
  const group = ++g.mbGroupSeq
  const creature =
    kind === "fish" ? buildFish(g.w, g.h, top, group) : buildJelly(g.w, g.h, top, group)
  // Существу нужен целостный силуэт: убираем обычные блоки, с которыми оно налегает.
  g.blocks = [...carveLevelBlocks(g.blocks, creature), ...creature]
  g.blocksInitial = Math.max(1, g.blocks.length)
  const dropX = creature.reduce((s, b) => s + b.x, 0) / creature.length
  const dropY = creature.reduce((s, b) => s + b.y, 0) / creature.length
  g.minibosses.push({ kind, group, hp, maxHp: hp, dropX, dropY })
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
 */
export function damageMiniboss(g: Game, dmg: number, block: Block) {
  const creature = g.minibosses.find((c) => c.group === (block.mbGroup ?? 0))
  if (!creature || creature.hp <= 0) return
  creature.hp -= dmg
  addRawScore(g, 5)
  for (const b of g.blocks) {
    if (b.isMiniboss && (b.mbGroup ?? 0) === creature.group) b.flash = 1
  }
  if (creature.hp <= 0) killMiniboss(g, creature)
  pushHud(g)
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
  // рыба погибла — пузырьки изо рта и кильватер больше не нужны
  if (creature.kind === "fish") {
    g.mouthBubbles = []
    g.fishMouth = false
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
