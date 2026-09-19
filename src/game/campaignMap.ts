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
import type { MinibossKind } from "./minibosses"

/** Количество ярусов карты (последний ярус — босс). */
export const MAP_TIERS = 30
/** Нижняя и верхняя границы числа ветвей из одного узла (развилка 2–4). */
export const MIN_BRANCHES = 2
export const MAX_BRANCHES = 4
/** Предельная ширина яруса (число узлов в столбце). */
export const MAX_TIER_WIDTH = 4
/** Доля узлов-событий среди обычных узлов (бой не проводится, телепорт назад). */
export const EVENT_NODE_CHANCE = 0.12

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
  "ВОДОВОРОТ ЗАСАСАЛ ТЕБЯ И ВЫБРОСИЛ В {place}!",
  "ПОДВОДНОЕ ТЕЧЕНИЕ УНЕСЛО ШАР ПРЯМО К {place}.",
  "СТАЯ ЛЕТУЧИХ РЫБ ПОДХВАТИЛА И ВЫНЕСЛА ТЕБЯ В {place}…",
  "ДРЕВНИЙ ГРОТ ОБВАЛИЛСЯ — ПОТОК ВЫНЕС ТЕБЯ В {place}.",
  "ГЕЙЗЕР ПОДБРОСИЛ ТЕБЯ К ПОВЕРХНОСТИ, И ВОЛНА ПРИБИЛА К {place}.",
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
  /** Узел-событие: без боя, переносит игрока на один из пройденных узлов. */
  isEvent: boolean
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
  /** Расклад минибоссов по узлам (детерминирован сидом карты); в узле может
   *  быть и пара существ. */
  minibosses: Record<number, MinibossKind[]>
  /** Текущая позиция игрока (узел, на котором он стоит). */
  playerId: number
  /** Узлы, пройденные игроком (путь остаётся видимым). */
  visited: number[]
  /** Туман войны: узлы, доступные для выбора — ровно один шаг от игрока. */
  visible: number[]
}

/**
 * Создаёт карту забега. Ширины ярусов блуждают с шагом ±1 в пределах 2..4
 * (развилка выбора 2–4 ветви) и принудительно сходятся к 1 на ярусе босса.
 * Каждый не-боссовый узел получает 2–4 ребра в следующий ярус (у предбоссового
 * яруса — ровно одно, к единственному боссу), а каждый узел следующего яруса —
 * хотя бы одного родителя (достижимость от старта). Часть обычных узлов
 * становится узлами-событиями (без боя, детерминированно по сиду).
 */
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
    const ys = tierYs(rng, widths[t])
    for (let i = 0; i < widths[t]; i++) {
      const isBoss = t === tiers - 1
      const isEvent = !isBoss && t > 0 && rng() < EVENT_NODE_CHANCE
      nodes.push({
        id,
        tier: t,
        x: 0.04 + (t / Math.max(1, tiers - 1)) * 0.92,
        y: ys[i],
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
