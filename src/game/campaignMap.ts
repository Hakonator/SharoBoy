/**
 * Рогаликовая карта кампании (в духе Slay the Spire): направленный ациклический
 * граф слева-направо с туманом войны, ветвлением 1–3 и схождением всех ветвей
 * в единого финального босса.
 *
 * Генерация чистая и детерминированная: одна и та же цифра-сид всегда даёт
 * одинаковую карту (тот же ГПСЧ mulberry32, что у волн бесконечного режима).
 * Никаких обращений к DOM/движку — модуль тестируется автономно.
 */

import type { MinibossKind } from "./minibosses"

export {
  MAP_TIERS,
  MIN_BRANCHES,
  MAX_BRANCHES,
  MAX_TIER_WIDTH,
  EVENT_NODE_CHANCE,
  EVENT_MAX_BACK_TIERS,
  EVENT_TEXTS,
  generateCampaignMap,
} from "./campaignMapLayout"

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
