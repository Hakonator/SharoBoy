/**
 * Рогаликовая карта кампании (в духе Slay the Spire): направленный ациклический
 * граф слева-направо с туманом войны, ветвлением 1–3 и схождением всех ветвей
 * в единого финального босса.
 *
 * Генерация чистая и детерминированная: одна и та же цифра-сид всегда даёт
 * одинаковую карту (тот же ГПСЧ mulberry32, что у волн бесконечного режима).
 * Никаких обращений к DOM/движку — модуль тестируется автономно.
 */

import { clamp, mulberry32 } from "./utils"

/** Количество ярусов карты (последний ярус — босс). */
export const MAP_TIERS = 11
/** Нижняя и верхняя границы числа ветвей из одного узла. */
export const MIN_BRANCHES = 1
export const MAX_BRANCHES = 3
/** Предельная ширина яруса (число узлов в столбце). */
export const MAX_TIER_WIDTH = 4

/** Имена боевых узлов: пока все узлы, кроме босса, — обычный бой. */
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

export interface CampaignNode {
  /** Сквозной числовой идентификатор узла. */
  id: number
  /** Ярус слева-направо (0 — старт, tiers-1 — босс). */
  tier: number
  /** Нормализованные координаты (0..1) для отрисовки оверлеем карты. */
  x: number
  y: number
  /** Единственный финальный босс карты. */
  isBoss: boolean
  /** Отображаемое имя узла. */
  name: string
}

export interface CampaignEdge {
  from: number
  to: number
}

export interface CampaignMap {
  seed: number
  tiers: number
  nodes: CampaignNode[]
  edges: CampaignEdge[]
  startId: number
  bossId: number
}

/** Снимок карты для React-оверлея: что видно игроку и где он сейчас. */
export interface CampaignMapView {
  seed: number
  tiers: number
  nodes: CampaignNode[]
  edges: CampaignEdge[]
  startId: number
  bossId: number
  /** Текущая позиция игрока (узел, на котором он стоит). */
  playerId: number
  /** Узлы, пройденные игроком (путь остаётся видимым). */
  visited: number[]
  /** Туман войны: узлы, доступные для выбора — ровно один шаг от игрока. */
  visible: number[]
}

/**
 * Создаёт карту забега. Ширины ярусов блуждают от 1 (старт) с шагом ±1,
 * не превышая MAX_TIER_WIDTH, и принудительно сходятся к 1 на ярусе босса.
 * Каждый не-боссовый узел получает 1–3 ребра в следующий ярус, а каждый узел
 * следующего яруса — хотя бы одного родителя (достижимость от старта).
 */
export function generateCampaignMap(seedIn: number, tiers = MAP_TIERS): CampaignMap {
  const seed = seedIn | 0 || 1
  const rng = mulberry32(seed)

  /* Ширины ярусов: старт 1, дрейф ±1, последний ярус — единственный босс. */
  const widths = [1]
  for (let t = 1; t < tiers - 1; t++) widths.push(pickWidth(rng, widths[t - 1]))
  widths.push(1)

  const nodes: CampaignNode[] = []
  const perTier: number[][] = []
  let id = 0
  for (let t = 0; t < tiers; t++) {
    const row: number[] = []
    const ys = tierYs(rng, widths[t])
    for (let i = 0; i < widths[t]; i++) {
      const isBoss = t === tiers - 1
      nodes.push({
        id,
        tier: t,
        x: 0.04 + (t / Math.max(1, tiers - 1)) * 0.92,
        y: ys[i],
        isBoss,
        name: isBoss ? "БОСС" : NODE_NAMES[Math.floor(rng() * NODE_NAMES.length)],
      })
      row.push(id)
      id++
    }
    perTier.push(row)
  }

  const edges = linkTiers(rng, perTier)

  return {
    seed,
    tiers,
    nodes,
    edges,
    startId: perTier[0][0],
    bossId: nodes[nodes.length - 1].id,
  }
}

/** Ширина следующего яруса: дрейф ±1; рост ограничен числом ветвей родителя,
 *  иначе узкий ярус не смог бы «накормить» широкий без превышения 3 ветвей. */
function pickWidth(rng: () => number, prev: number): number {
  const roll = rng()
  if (roll < 0.5) return prev
  if (roll < 0.8) return Math.min(prev + 1, MAX_TIER_WIDTH, MAX_BRANCHES * prev)
  return Math.max(1, prev - 1)
}

/** Вертикальная раскладка узлов яруса: равномерно по слотам + лёгкий джиттер. */
function tierYs(rng: () => number, w: number): number[] {
  const ys: number[] = []
  for (let i = 0; i < w; i++) {
    const slot = w === 1 ? 0.5 : 0.08 + (i / (w - 1)) * 0.84
    const jitter = (rng() - 0.5) * Math.min(0.14, 0.4 / w)
    ys.push(clamp(slot + jitter, 0.06, 0.94))
  }
  return ys
}

/**
 * Связывает ярусы. Сначала гарантирует каждому узлу следующего яруса хотя бы
 * одного родителя, затем добирает каждый текущий узел до его целевой степени
 * ветвления (1..3). Порядок важен: без первого шага часть узлов оказалась бы
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

export function nodeById(map: CampaignMap, id: number): CampaignNode | undefined {
  return map.nodes.find((n) => n.id === id)
}

/** Узлы, достижимые из данного за один шаг (исходящие рёбра). */
export function outgoingIds(map: CampaignMap, id: number): number[] {
  return map.edges.filter((e) => e.from === id).map((e) => e.to)
}

/** Узлы, из которых можно попасть в данный (входящие рёбра). */
export function incomingIds(map: CampaignMap, id: number): number[] {
  return map.edges.filter((e) => e.to === id).map((e) => e.from)
}

/** Туман войны: узлы, видимые из позиции игрока (ровно один шаг вперёд). */
export function visibleFrom(map: CampaignMap, playerId: number): number[] {
  return outgoingIds(map, playerId)
}

/** Доступен ли узел для перехода из текущей позиции игрока. */
export function isAdjacent(map: CampaignMap, playerId: number, targetId: number): boolean {
  return outgoingIds(map, playerId).includes(targetId)
}
