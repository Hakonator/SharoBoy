import { clamp, mulberry32 } from "./utils"
import type { CampaignEdge, CampaignMap, CampaignNode } from "./campaignMap"

/** Количество ярусов карты (последний ярус — босс). */
export const MAP_TIERS = 30
/** Нижняя и верхняя границы числа ветвей из одного узла (развилка 2–4). */
export const MIN_BRANCHES = 2
export const MAX_BRANCHES = 4
/** Предельная ширина яруса (число узлов в столбце). */
export const MAX_TIER_WIDTH = 4
/** Доля узлов-событий среди обычных узлов (бой не проводится, телепорт назад). */
export const EVENT_NODE_CHANCE = 0.12
/** Событие отбрасывает игрока не дальше чем на это число ярусов («зон») назад. */
export const EVENT_MAX_BACK_TIERS = 3

/** Имена боевых узлов. */
const NODE_NAMES = [
  "АВАНПОСТ",
  "ПАТРУЛЬ",
  "ЗАСАДА",
  "СТРАЖ",
  "РЕЙД",
  "ОСТРОВ",
  "КЛЮЧ",
  "ПЕРЕХОД",
  "ГНЕЗДО",
  "ФАРВАТЕР",
]

/** Имена узлов-событий: боя нет, событие переносит игрока на пройденный узел. */
const EVENT_NAMES = ["ВОДОВОРОТ", "ТЕЧЕНИЕ", "ГРОТ", "ГЕЙЗЕР"]

/**
 * Тексты событий-телепортов (подводная тематика); плейсхолдер {place}
 * заменяется на имя узла, куда отнесло игрока.
 */
export const EVENT_TEXTS = [
  "ВОДОВОРОТ ЗАСОСАЛ ТЕБЯ И ВЫБРОСИЛ В {place}!",
  "ПОДВОДНОЕ ТЕЧЕНИЕ УНЕСЛО ШАР ПРЯМО К {place}.",
  "СТАЯ ЛЕТУЧИХ РЫБ ПОДХВАТИЛА И ВЫНЕСЛА ТЕБЯ В {place}…",
  "ДРЕВНИЙ ГРОТ ОБВАЛИЛСЯ — ПОТОК ВЫНЕС ТЕБЯ В {place}.",
  "ГЕЙЗЕР ПОДБРОСИЛ ТЕБЯ К ПОВЕРХНОСТИ, И ВОЛНА ПРИБИЛА К {place}.",
]

export function generateCampaignMap(seedIn: number, tiers = MAP_TIERS): CampaignMap {
  const seed = seedIn | 0 || 1
  const rng = mulberry32(seed)

  /* Ширины ярусов: старт 1, далее дрейф в коридоре 2..4, последний ярус — босс. */
  const widths = [1]
  for (let t = 1; t < tiers - 1; t++) widths.push(pickWidth(rng, widths[t - 1]))
  widths.push(1)

  const nodes: CampaignNode[] = []
  const perTier: number[][] = []
  let id = 0
  for (let t = 0; t < tiers; t++) {
    const row: number[] = []
    for (let i = 0; i < widths[t]; i++) {
      const isBoss = t === tiers - 1
      const isEvent = !isBoss && t > 0 && rng() < EVENT_NODE_CHANCE
      nodes.push({
        id,
        tier: t,
        x: 0.04 + (t / Math.max(1, tiers - 1)) * 0.92,
        y: 0.5, // точная вертикаль считается после связывания ярусов
        isBoss,
        isEvent,
        name: isBoss
          ? "БОСС"
          : isEvent
            ? EVENT_NAMES[Math.floor(rng() * EVENT_NAMES.length)]
            : NODE_NAMES[Math.floor(rng() * NODE_NAMES.length)],
      })
      row.push(id)
      id++
    }
    perTier.push(row)
  }

  const edges = linkTiers(rng, perTier)
  assignYs(rng, perTier, edges, nodes)

  return {
    seed,
    tiers,
    nodes,
    edges,
    startId: perTier[0][0],
    bossId: nodes[nodes.length - 1].id,
  }
}

/** Ширина следующего яруса: дрейф ±1 в коридоре 2..MAX_TIER_WIDTH — развилка
 *  выбора узлов держится в границах MIN_BRANCHES..MAX_BRANCHES. */
function pickWidth(rng: () => number, prev: number): number {
  const roll = rng()
  const w = roll < 0.45 ? prev : roll < 0.75 ? prev + 1 : prev - 1
  return clamp(w, 2, MAX_TIER_WIDTH)
}

/** Минимальный вертикальный зазор между узлами одного яруса (доля высоты). */
const MIN_NODE_GAP = 0.13
/** Диагональный разброс детей относительно родителя (±половина). */
const CHILD_SPREAD = 0.18

/**
 * Вертикальная раскладка: узлы держатся рядом со своими родителями, а не
 * разбросаны по всей высоте колонки. Рёбра получаются короткими диагоналями
 * вверх и вниз («спираль» вдоль пути), а не горизонтальными линиями через всю
 * карту. После раскладки узлы яруса разводятся на MIN_NODE_GAP, чтобы не
 * слипались на экране.
 */
function assignYs(
  rng: () => number,
  perTier: number[][],
  edges: CampaignEdge[],
  nodes: CampaignNode[]
) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const parentsOf = new Map<number, number[]>()
  for (const e of edges) {
    const list = parentsOf.get(e.to) ?? []
    list.push(e.from)
    parentsOf.set(e.to, list)
  }
  for (let t = 0; t < perTier.length; t++) {
    if (t === 0) {
      byId.get(perTier[0][0])!.y = 0.5
      continue
    }
    // цель: середина родителей + лёгкий диагональный дрейф вверх/вниз
    const targets = new Map<number, number>()
    for (const id of perTier[t]) {
      const parents = parentsOf.get(id) ?? []
      const base = parents.length
        ? parents.reduce((s, p) => s + byId.get(p)!.y, 0) / parents.length
        : 0.5
      targets.set(id, base + (rng() - 0.5) * CHILD_SPREAD)
    }
    // разведение: узлы сортируются по цели, зажимаются в допустимое окно и
    // расталкиваются на MIN_NODE_GAP — по возможности оставаясь у своей цели
    const order = [...perTier[t]].sort((a, b) => targets.get(a)! - targets.get(b)!)
    const n = order.length
    const ys = order.map((id) => targets.get(id)!)
    for (let i = 0; i < n; i++) {
      ys[i] = clamp(ys[i], 0.06 + i * MIN_NODE_GAP, 0.94 - (n - 1 - i) * MIN_NODE_GAP)
    }
    // проекции на ограничения зазоров (вперёд-назад до сходимости):
    //forward: вниз, backward: вверх — узлы не уезжают далеко от целей
    for (let iter = 0; iter < 50; iter++) {
      let moved = false
      for (let i = 1; i < n; i++) {
        const v = Math.max(ys[i], ys[i - 1] + MIN_NODE_GAP)
        if (v !== ys[i]) {
          ys[i] = v
          moved = true
        }
      }
      for (let i = n - 2; i >= 0; i--) {
        const v = Math.min(ys[i], ys[i + 1] - MIN_NODE_GAP)
        if (v !== ys[i]) {
          ys[i] = v
          moved = true
        }
      }
      if (!moved) break
    }
    order.forEach((id, i) => {
      byId.get(id)!.y = clamp(ys[i], 0.04, 0.96)
    })
  }
}

/**
 * Связывает ярусы. Сначала гарантирует каждому узлу следующего яруса хотя бы
 * одного родителя, затем добирает каждый текущий узел до его целевой степени
 * ветвления (2..4, но не больше числа узлов следующего яруса — перед боссом
 * тот единственный). Порядок важен: без первого шага часть узлов оказалась бы
 * недостижимой от старта, без второго — часть узлов была бы тупиками.
 */
function linkTiers(rng: () => number, perTier: number[][]): CampaignEdge[] {
  const edges: CampaignEdge[] = []
  for (let t = 0; t < perTier.length - 1; t++) {
    const cur = perTier[t]
    const nxt = perTier[t + 1]
    const target = new Map<number, number>()
    for (const p of cur) {
      target.set(p, MIN_BRANCHES + Math.floor(rng() * (MAX_BRANCHES - MIN_BRANCHES + 1)))
    }
    const chosen = new Map<number, number[]>()

    /* 1) Гарантия входящих рёбер: каждый узел следующего яруса получает родителя
       среди тех, кто ещё не выбрал свою норму ветвления. */
    for (const c of shuffle(rng, nxt)) {
      const open = cur.filter((p) => (chosen.get(p)?.length ?? 0) < (target.get(p) ?? 1))
      const pool = open.length > 0 ? open : cur
      const p = pool[Math.floor(rng() * pool.length)]
      const list = chosen.get(p) ?? []
      list.push(c)
      chosen.set(p, list)
    }

    /* 2) Добираем каждый узел до целевого числа ветвей (1..3), но не больше,
       чем узлов в следующем ярусе: иначе цикл набора не смог бы завершиться
       (например, перед боссом ярус состоит из единственного узла). */
    for (const p of cur) {
      const want = Math.min(target.get(p) ?? 1, nxt.length)
      const list = chosen.get(p) ?? []
      while (list.length < want) {
        const candidates = nxt.filter((c) => !list.includes(c))
        if (candidates.length === 0) break
        list.push(candidates[Math.floor(rng() * candidates.length)])
      }
      chosen.set(p, list)
    }

    for (const [from, list] of chosen) {
      for (const to of list) edges.push({ from, to })
    }
  }
  return edges
}

/** Детерминированный Фишер-Йетс на переданном ГПСЧ. */
function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------- навигация по карте ---------- */
