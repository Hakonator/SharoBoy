/**
 * Ежедневные задания (bounties), T-059.
 *
 * Каждые сутки UTC разыгрывается фиксированный набор из трёх заданий из пула.
 * Набор детерминирован сидом дня, поэтому одинаков у всех игроков и не меняется
 * до полуночи UTC. Прогресс копится во всех режимах и хранится локально
 * (ключ `sharoboy-daily-quests`), награда — мета-кристаллы, выдаётся один раз.
 *
 * Модуль чистый: не импортирует `game.ts` и не трогает HUD. Движок передаёт
 * прогресс через `recordQuestProgress`, UI читает снимок через `getDailyQuests`
 * и забирает награду через `claimDailyQuestReward`.
 */

import { daySeed, lsGet, lsSet, mulberry32 } from "./utils"

/** Что именно считаем. Порядок пула фиксирован — выбор идёт по индексу. */
export type DailyQuestKind =
  "break_blocks" | "crit_saves" | "chain_cascades" | "boss_kills" | "power_ups"

/**
 * Пул заданий. Порядок — контракт: вид выбирается индексом от ГПСЧ дня,
 * поэтому новые виды только дописываются в конец (как `MINIBOSS_KINDS`).
 */
export const DAILY_QUEST_KINDS: readonly DailyQuestKind[] = [
  "break_blocks",
  "crit_saves",
  "chain_cascades",
  "boss_kills",
  "power_ups",
]

/** Сколько заданий в дневном наборе. */
export const DAILY_QUEST_COUNT = 3

export interface DailyQuestDef {
  readonly kind: DailyQuestKind
  readonly icon: string
  readonly title: string
  /** Текст цели без числа — число подставляется из `target`. */
  readonly goal: string
  readonly target: number
  /** Награда в мета-кристаллах (1–3). */
  readonly rewardMeta: number
}

/** Состояние одного задания дня: цель + текущий прогресс + признак выдачи. */
export interface DailyQuestState {
  readonly def: DailyQuestDef
  progress: number
  claimed: boolean
}

/** Накопительная статистика событий; все ключи необязательны. */
export interface DailyQuestStats {
  blocksDestroyed?: number
  clutchSaves?: number
  chainDetonations?: number
  bossKills?: number
  powerUps?: number
}

const STORAGE_KEY = "sharoboy-daily-quests"

/**
 * Цели и награды по видам. Числа подобраны под «один активный вечер»:
 * блоки и бонусы набираются за пару партий, босс требует реального забега,
 * поэтому платит больше.
 */
function makeDef(kind: DailyQuestKind, rng: () => number): DailyQuestDef {
  switch (kind) {
    case "break_blocks": {
      const target = 60 + Math.floor(rng() * 5) * 20 // 60…140
      return {
        kind,
        icon: "🧱",
        title: "Зачистка поля",
        goal: "разбить блоков",
        target,
        rewardMeta: 1,
      }
    }
    case "crit_saves": {
      const target = 3 + Math.floor(rng() * 3) // 3…5
      return {
        kind,
        icon: "🧲",
        title: "На волоске",
        goal: "спасти мяч у самой границы",
        target,
        rewardMeta: 2,
      }
    }
    case "chain_cascades": {
      const target = 2 + Math.floor(rng() * 3) // 2…4
      return {
        kind,
        icon: "💥",
        title: "Цепная реакция",
        goal: "запустить цепных каскадов",
        target,
        rewardMeta: 2,
      }
    }
    case "boss_kills": {
      const target = 1 + Math.floor(rng() * 2) // 1…2
      return {
        kind,
        icon: "👑",
        title: "Казнь босса",
        goal: "одолеть босса",
        target,
        rewardMeta: 3,
      }
    }
    case "power_ups": {
      const target = 6 + Math.floor(rng() * 4) * 2 // 6…12
      return {
        kind,
        icon: "🎁",
        title: "Собиратель",
        goal: "подобрать бонусов",
        target,
        rewardMeta: 1,
      }
    }
  }
}

/**
 * Набор заданий на дату UTC. Детерминирован: одинаков у всех игроков и
 * неизменен до полуночи UTC.
 */
export function getDailyQuestDefs(date = new Date()): DailyQuestDef[] {
  // Оффсет отделяет поток ГПСЧ заданий от потока мутаторов дня (daily.ts).
  const rng = mulberry32(daySeed(date) * 6151 + 4242)
  const pool = [...DAILY_QUEST_KINDS]
  const out: DailyQuestDef[] = []
  for (let i = 0; i < DAILY_QUEST_COUNT && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length)
    const kind = pool.splice(idx, 1)[0]!
    out.push(makeDef(kind, rng))
  }
  return out
}

/** Идентификатор дня (UTC) — формат совпадает с `isoDay` из `daily.ts`. */
function questDay(date = new Date()): string {
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${date.getUTCFullYear()}-${month}-${day}`
}

interface StoredDay {
  progress: Record<string, number>
  claimed: string[]
}

function isFiniteInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

/**
 * Читает сохранение. Дни, кроме запрошенного, отбрасываются: прогресс живёт
 * ровно сутки, старые записи не должны копиться в localStorage.
 */
function loadDay(date = new Date()): StoredDay {
  const empty: StoredDay = { progress: {}, claimed: [] }
  try {
    const raw = lsGet(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return empty
    const rec = parsed as { date?: unknown; progress?: unknown; claimed?: unknown }
    if (rec.date !== questDay(date)) return empty
    const progress: Record<string, number> = {}
    if (rec.progress && typeof rec.progress === "object") {
      for (const [id, v] of Object.entries(rec.progress as Record<string, unknown>)) {
        if (isFiniteInt(v) && v > 0) progress[id] = Math.floor(v)
      }
    }
    const claimed = Array.isArray(rec.claimed)
      ? rec.claimed.filter((v): v is string => typeof v === "string")
      : []
    return { progress, claimed }
  } catch {
    // приватный режим / битые данные — играем без сохранения
    return empty
  }
}

function saveDay(day: StoredDay, date = new Date()) {
  lsSet(STORAGE_KEY, JSON.stringify({ date: questDay(date), ...day }))
}

/**
 * Накапливает прогресс по событиям боя. Значение только растёт и обрезается
 * по цели, поэтому повторные вызовы (двойной тик, дубликат события) не ломают
 * счётчик, а переполнение невозможно.
 */
export function recordQuestProgress(stats: DailyQuestStats, date = new Date()): void {
  const defs = getDailyQuestDefs(date)
  const inc: Partial<Record<DailyQuestKind, number>> = {
    break_blocks: stats.blocksDestroyed,
    crit_saves: stats.clutchSaves,
    chain_cascades: stats.chainDetonations,
    boss_kills: stats.bossKills,
    power_ups: stats.powerUps,
  }
  let changed = false
  const day = loadDay(date)
  for (const def of defs) {
    const add = inc[def.kind]
    if (!isFiniteInt(add) || add <= 0) continue
    const prev = day.progress[def.kind] ?? 0
    const next = Math.min(def.target, prev + Math.floor(add))
    if (next !== prev) {
      day.progress[def.kind] = next
      changed = true
    }
  }
  if (changed) saveDay(day, date)
}

/** Снимок заданий дня для UI: цель, прогресс и признак «уже забрал». */
export function getDailyQuests(date = new Date()): DailyQuestState[] {
  const day = loadDay(date)
  return getDailyQuestDefs(date).map((def) => ({
    def,
    progress: Math.min(def.target, day.progress[def.kind] ?? 0),
    claimed: day.claimed.includes(def.kind),
  }))
}

/** Сумма неполученных награда за выполненные задания — для бейджа в меню. */
export function pendingQuestReward(date = new Date()): number {
  return getDailyQuests(date)
    .filter((q) => !q.claimed && q.progress >= q.def.target)
    .reduce((acc, q) => acc + q.def.rewardMeta, 0)
}

/** Результат попытки получить награду. */
export interface QuestClaimResult {
  /** Сколько мета-кристаллов начислено (0 — если нечего забирать). */
  readonly reward: number
  /** Получилось ли зачислить. */
  readonly ok: boolean
}

/**
 * Забирает награду за выполненные задания дня. Выдача строго один раз:
 * повторный вызов возвращает `reward: 0`. Возвращает сумму к начислению —
 * начисление мета-кристаллов делает вызывающий код (в движке это
 * `addMetaCrystals`, чтобы прогресс сохранялся в одном месте).
 */
export function claimDailyQuestReward(date = new Date()): QuestClaimResult {
  const day = loadDay(date)
  let reward = 0
  const newlyClaimed: string[] = []
  for (const def of getDailyQuestDefs(date)) {
    if (day.claimed.includes(def.kind)) continue
    const progress = Math.min(def.target, day.progress[def.kind] ?? 0)
    if (progress < def.target) continue
    reward += def.rewardMeta
    newlyClaimed.push(def.kind)
  }
  if (reward <= 0) return { reward: 0, ok: false }
  day.claimed = [...day.claimed, ...newlyClaimed]
  saveDay(day, date)
  return { reward, ok: true }
}
