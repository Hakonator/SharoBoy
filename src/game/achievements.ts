/**
 * Достижения игрока.
 *
 * Правила вычисляются в движке (game.ts передаёт контекст в evaluateAch),
 * разблокировки сохраняются в localStorage (sharoboy-achievements).
 * Модуль не импортирует game.ts, чтобы не было циклической зависимости.
 */

export interface AchievementDef {
  id: string
  icon: string
  name: string
  desc: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-win", icon: "🏆", name: "Покоритель", desc: "Победа в кампании" },
  { id: "flawless", icon: "💎", name: "Безупречно", desc: "Кампания без потери жизней" },
  { id: "boss-slayer", icon: "👑", name: "Цареборец", desc: "Одолеть босса «Царь-шар»" },
  { id: "score-1k", icon: "⭐", name: "Разогрев", desc: "1 000 очков за партию" },
  { id: "score-5k", icon: "🌠", name: "Мастер аркады", desc: "5 000 очков за партию" },
  { id: "combo-10", icon: "🔥", name: "Неудержимый", desc: "Серия ×10" },
  { id: "combo-15", icon: "🤯", name: "Безумие", desc: "Серия ×15" },
  { id: "wave-5", icon: "🌊", name: "Держу волну", desc: "Волна 5 в бесконечном" },
  { id: "wave-10", icon: "🌀", name: "Гроссмейстер волн", desc: "Волна 10 в бесконечном" },
  { id: "coins-100", icon: "🪙", name: "Коллекционер", desc: "Собрать 100 монет суммарно" },
  { id: "upgrade-1", icon: "🛠", name: "Инженер", desc: "Купить первое улучшение" },
  { id: "upgrade-all", icon: "🧰", name: "Конструктор", desc: "Все улучшения на максимум" },
]

/** Контекст текущей партии/прогресса — заполняется движком. */
export interface AchContext {
  score: number
  combo: number
  wave: number
  won: boolean
  bossKills: number
  livesLost: number
  coins: number
  upgradeLevels: number
  upgradesMaxed: boolean
}

const LS_KEY = "sharoboy-achievements"

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

/** Разблокированные достижения: id → время открытия. */
export function loadUnlocked(): Record<string, number> {
  try {
    const parsed = JSON.parse(lsGet(LS_KEY) || "{}") as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, number> = {}
    for (const [id, ts] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof ts === "number") out[id] = ts
    }
    return out
  } catch {
    return {}
  }
}

function persist(map: Record<string, number>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch {
    /* приватный режим — достижения не сохранятся */
  }
}

/**
 * Проверить условия; новые достижения записывает в localStorage
 * и возвращает их определения (пусто — если ничего нового).
 */
export function evaluateAch(ctx: AchContext): AchievementDef[] {
  const unlocked = loadUnlocked()
  const now = Date.now()
  const fresh: AchievementDef[] = []

  const tryUnlock = (id: string, ok: boolean) => {
    if (!ok || unlocked[id]) return
    unlocked[id] = now
    const def = ACHIEVEMENTS.find((d) => d.id === id)
    if (def) fresh.push(def)
  }

  tryUnlock("first-win", ctx.won)
  tryUnlock("flawless", ctx.won && ctx.livesLost === 0)
  tryUnlock("boss-slayer", ctx.bossKills > 0)
  tryUnlock("score-1k", ctx.score >= 1000)
  tryUnlock("score-5k", ctx.score >= 5000)
  tryUnlock("combo-10", ctx.combo >= 10)
  tryUnlock("combo-15", ctx.combo >= 15)
  tryUnlock("wave-5", ctx.wave >= 5)
  tryUnlock("wave-10", ctx.wave >= 10)
  tryUnlock("coins-100", ctx.coins >= 100)
  tryUnlock("upgrade-1", ctx.upgradeLevels >= 1)
  tryUnlock("upgrade-all", ctx.upgradesMaxed)

  if (fresh.length) persist(unlocked)
  return fresh
}
