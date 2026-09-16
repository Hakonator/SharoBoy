import { describe, expect, it } from "vitest"

import {
  MAX_BRANCHES,
  MIN_BRANCHES,
  generateCampaignMap,
  incomingIds,
  isAdjacent,
  nodeById,
  outgoingIds,
  visibleFrom,
  type CampaignMap,
} from "./campaignMap"

/** Все узлы, достижимые из start по исходящим рёбрам (обход в ширину). */
function reachableFrom(map: CampaignMap, start: number): Set<number> {
  const seen = new Set<number>()
  const queue = [start]
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (seen.has(id)) continue
    seen.add(id)
    for (const to of outgoingIds(map, id)) {
      if (!seen.has(to)) queue.push(to)
    }
  }
  return seen
}

describe("generateCampaignMap", () => {
  it("держит структурные инварианты на множестве сидов", () => {
    for (let seed = 1; seed <= 150; seed++) {
      const map = generateCampaignMap(seed)

      // уникальные id и корректные координаты
      expect(new Set(map.nodes.map((n) => n.id)).size).toBe(map.nodes.length)
      for (const n of map.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0)
        expect(n.x).toBeLessThanOrEqual(1)
        expect(n.y).toBeGreaterThanOrEqual(0)
        expect(n.y).toBeLessThanOrEqual(1)
      }

      // ровно один старт (левый ярус) и ровно один босс (правый ярус)
      expect(map.nodes.filter((n) => n.tier === 0)).toHaveLength(1)
      expect(map.startId).toBe(map.nodes[0].id)
      const bosses = map.nodes.filter((n) => n.isBoss)
      expect(bosses).toHaveLength(1)
      expect(bosses[0].id).toBe(map.bossId)
      expect(map.bossId).toBe(map.nodes[map.nodes.length - 1].id)

      // ветвление: у обычного узла 1..3 исходящих, у босса — ни одного
      for (const n of map.nodes) {
        const out = outgoingIds(map, n.id)
        if (n.isBoss) {
          expect(out).toHaveLength(0)
        } else {
          expect(out.length).toBeGreaterThanOrEqual(MIN_BRANCHES)
          expect(out.length).toBeLessThanOrEqual(MAX_BRANCHES)
        }
      }

      // достижимость от старта: у всех, кроме старта, есть родитель
      expect(incomingIds(map, map.startId)).toHaveLength(0)
      for (const n of map.nodes) {
        if (n.id === map.startId) continue
        expect(incomingIds(map, n.id).length).toBeGreaterThanOrEqual(1)
      }

      // рёбра ведут строго вправо (граф ацикличен, порядок ярусов сохраняется)
      for (const e of map.edges) {
        const from = nodeById(map, e.from)
        const to = nodeById(map, e.to)
        expect(from).toBeDefined()
        expect(to).toBeDefined()
        expect(from!.tier).toBeLessThan(to!.tier)
      }

      // от старта достижимы все узлы, и из каждого узла достижим босс
      expect(reachableFrom(map, map.startId).size).toBe(map.nodes.length)
      for (const n of map.nodes) {
        expect(reachableFrom(map, n.id).has(map.bossId)).toBe(true)
      }

      // листья (без исходящих) — ровно один: финальный босс
      const leaves = map.nodes.filter((n) => outgoingIds(map, n.id).length === 0)
      expect(leaves.map((l) => l.id)).toEqual([map.bossId])
    }
  })

  it("туман войны открывает ровно следующий шаг", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const map = generateCampaignMap(seed)

      // из старта видны только узлы второго яруса
      const first = visibleFrom(map, map.startId)
      expect(first.length).toBeGreaterThanOrEqual(MIN_BRANCHES)
      expect(first.length).toBeLessThanOrEqual(MAX_BRANCHES)
      for (const id of first) {
        expect(nodeById(map, id)!.tier).toBe(1)
        expect(isAdjacent(map, map.startId, id)).toBe(true)
      }
      // стоять на месте нельзя, ходьба по своему же узлу недоступна
      expect(isAdjacent(map, map.startId, map.startId)).toBe(false)

      // идём к боссу: пока не дошли до предпоследнего яруса, босса не видно
      let cur = map.startId
      let node = nodeById(map, cur)!
      while (node.tier < map.tiers - 2) {
        const next = visibleFrom(map, cur)
        expect(next.length).toBeGreaterThanOrEqual(1)
        for (const id of next) expect(nodeById(map, id)!.isBoss).toBe(false)
        cur = next[0]
        node = nodeById(map, cur)!
      }
      // с последнего обычного яруса босс обязан открыться
      expect(visibleFrom(map, cur)).toContain(map.bossId)
    }
  })

  it("разные сиды дают разные раскладки", () => {
    const signatures = new Set<string>()
    for (let seed = 1; seed <= 8; seed++) {
      const map = generateCampaignMap(seed)
      const edges = map.edges.map((e) => `${e.from}>${e.to}`).join("|")
      const positions = map.nodes
        .map((n) => `${n.id}:${n.x.toFixed(3)}:${n.y.toFixed(3)}`)
        .join("|")
      signatures.add(`${edges}__${positions}`)
    }
    expect(signatures.size).toBeGreaterThanOrEqual(7)
  })

  it("один и тот же сид воспроизводит карту бит-в-бит", () => {
    const a = generateCampaignMap(12345)
    const b = generateCampaignMap(12345)
    expect(b).toEqual(a)
  })
})
