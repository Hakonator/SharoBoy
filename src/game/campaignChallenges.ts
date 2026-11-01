/**
 * Квестовые задания и узлы-челленджи кампании:
 * Особые боевые испытания с дополнительными условиями победы
 * и повышенной наградой (пакет кристаллов забега + несгораемые мета-кристаллы).
 */

import { mulberry32 } from "./utils"

export type ChallengeKind =
  | "speed_clear"
  | "flawless"
  | "survive_time"
  | "crit_hunter"
  | "power_hunter"
  | "chain_master"
  | "armor_breaker"

/**
 * Полный набор видов испытаний. Порядок фиксирован: выбор идёт по индексу
 * `floor(rng() * POOL.length)`, поэтому перестановка сломала бы детерминизм
 * уже сгенерированных карт (узел генерируется из сида и яруса, см. `campaignMapLayout`).
 */
export const CHALLENGE_KINDS: readonly ChallengeKind[] = [
  "speed_clear",
  "flawless",
  "survive_time",
  "crit_hunter",
  "power_hunter",
  "chain_master",
  "armor_breaker",
]

/**
 * Доля видов для яруса: ярусы 3–4 разыгрывают только классическую четвёрку,
 * чтобы ранние узлы не требовали бонусов, до которых игрок ещё не добрался.
 * С яруса 5 (`CHALLENGE_FULL_POOL_TIER`) пул полный.
 */
export const CHALLENGE_FULL_POOL_TIER = 5

export interface CampaignChallenge {
  readonly kind: ChallengeKind
  readonly title: string
  readonly description: string
  readonly targetValue: number
  readonly rewardCrystals: number
  readonly rewardMeta: number
}

export interface ActiveChallengeState {
  readonly def: CampaignChallenge
  progress: number
  failed: boolean
  completed: boolean
  notifiedFail?: boolean
}

export interface ActiveChallengeHud {
  readonly kind: ChallengeKind
  readonly title: string
  readonly description: string
  readonly statusText: string
  readonly progressRatio: number
  readonly failed: boolean
  readonly completed: boolean
  readonly rewardCrystals: number
  readonly rewardMeta: number
}

/**
 * Детерминированная генерация челленджа для боевого узла карты по сиду и ярусу.
 */
export function createCampaignChallenge(seed: number, tier: number): CampaignChallenge {
  const rng = mulberry32(seed)
  // Классическая четвёрка — на ранних ярусах, полный пул — с CHALLENGE_FULL_POOL_TIER.
  const kinds = tier >= CHALLENGE_FULL_POOL_TIER ? CHALLENGE_KINDS : CHALLENGE_KINDS.slice(0, 4)
  const kind = kinds[Math.floor(rng() * kinds.length)]

  // Мета-кристаллы: 1 на Актах 1-2, 2 на поздних ярусах (tier >= 18)
  const rewardMeta = tier >= 18 ? 2 : 1
  const rewardCrystals = Math.round(45 + tier * 1.5 + rng() * 15)

  switch (kind) {
    case "speed_clear": {
      // Базовый таймер: комфортные 65 сек + масштабирование по ярусу
      const timeLimit = Math.round(65 + tier * 0.8)
      return {
        kind,
        title: "СПРИНТ-ЗАЧИСТКА",
        description: `Зачистите уровень быстрее чем за ${timeLimit} сек`,
        targetValue: timeLimit,
        rewardCrystals,
        rewardMeta,
      }
    }
    case "flawless": {
      return {
        kind,
        title: "БЕЗ ПОТЕРЬ ШАРА",
        description: "Одержите победу, не уронив ни одного мяча",
        targetValue: 1,
        rewardCrystals: rewardCrystals + 5,
        rewardMeta,
      }
    }
    case "survive_time": {
      const surviveSec = Math.round(22 + Math.min(10, tier * 0.4))
      return {
        kind,
        title: "ВЫЖИВАНИЕ В ШТОРМЕ",
        description: `Продержитесь ${surviveSec} сек под шквалом атак`,
        targetValue: surviveSec,
        rewardCrystals: rewardCrystals + 10,
        rewardMeta,
      }
    }
    case "crit_hunter": {
      const critTarget = tier < 10 ? 3 : 4
      return {
        kind,
        title: "МАСТЕР КРИТОВ",
        description: `Нанесите ${critTarget} критических сэйва или отскока`,
        targetValue: critTarget,
        rewardCrystals,
        rewardMeta,
      }
    }
    case "power_hunter": {
      // Бонусов за бой падает заметно меньше, чем блоков, поэтому цель скромная,
      // но растёт с ярусом и мотивирует ловить дропы, а не зачищать вслепую.
      const powerTarget = 3 + Math.min(3, Math.floor(tier / 8))
      return {
        kind,
        title: "ОХОТНИК ЗА БОНУСАМИ",
        description: `Соберите ${powerTarget} бонуса за бой`,
        targetValue: powerTarget,
        rewardCrystals: rewardCrystals + 5,
        rewardMeta,
      }
    }
    case "chain_master": {
      // Одна цепная детонация — это каскад от хрупкого/огненного/взрывного удара.
      const chainTarget = tier < 10 ? 3 : 5
      return {
        kind,
        title: "ЦЕПНОЙ МАСТЕР",
        description: `Вызовите ${chainTarget} цепных детонаций`,
        targetValue: chainTarget,
        rewardCrystals: rewardCrystals + 10,
        rewardMeta,
      }
    }
    case "armor_breaker": {
      // Броня (щиты блоков) появляется с 3-го уровня и утолщается на поздних ярусах.
      const armorTarget = 3 + Math.min(5, Math.floor(tier / 4))
      return {
        kind,
        title: "ВЗЛОМЩИК БРОНИ",
        description: `Снимите ${armorTarget} единиц брони с блоков`,
        targetValue: armorTarget,
        rewardCrystals: rewardCrystals + 5,
        rewardMeta,
      }
    }
  }
}

/**
 * Инициализация активного состояния челленджа при старте боя.
 * Для челленджей на время ("speed_clear") каждый присутствующий на уровне минибосс
 * автоматически добавляет +35 секунд к общему таймеру.
 */
export function initActiveChallenge(
  def: CampaignChallenge,
  minibossCount = 0
): ActiveChallengeState {
  if (def.kind === "speed_clear" && minibossCount > 0) {
    const bonusTime = minibossCount * 35
    const adjustedTarget = def.targetValue + bonusTime
    return {
      def: {
        ...def,
        targetValue: adjustedTarget,
        description: `Зачистите уровень быстрее чем за ${adjustedTarget} сек (+${bonusTime} с за минибосса)`,
      },
      progress: 0,
      failed: false,
      completed: false,
      notifiedFail: false,
    }
  }
  return {
    def,
    progress: 0,
    failed: false,
    completed: false,
    notifiedFail: false,
  }
}

/** Обновление таймеров испытания на каждом тике игрового цикла. */
export function updateActiveChallenge(
  active: ActiveChallengeState,
  dt: number,
  callbacks: {
    onSurviveWin: () => void
    onTimeExpired: () => void
  }
): void {
  if (active.failed || active.completed) return

  if (active.def.kind === "speed_clear") {
    active.progress += dt
    if (active.progress >= active.def.targetValue) {
      active.failed = true
      callbacks.onTimeExpired()
    }
  } else if (active.def.kind === "survive_time") {
    active.progress += dt
    if (active.progress >= active.def.targetValue) {
      active.completed = true
      callbacks.onSurviveWin()
    }
  }
}

/**
 * Виды испытаний, у которых прогресс копится по событиям (подбор бонуса, цепная
 * детонация, снятая броня), а не по таймеру. Для них `completed` — единственный
 * признак успеха: потеря шара испытание не проваливает.
 */
export function isCollectiveChallenge(kind: ChallengeKind): boolean {
  return (
    kind === "crit_hunter" ||
    kind === "power_hunter" ||
    kind === "chain_master" ||
    kind === "armor_breaker"
  )
}

/** Общий инкремент счётчика и завершение при достижении цели. */
function advanceChallenge(
  active: ActiveChallengeState,
  kind: ChallengeKind,
  amount: number,
  onTargetReached?: () => void
): void {
  if (active.failed || active.def.kind !== kind) return
  active.progress += amount
  if (active.progress >= active.def.targetValue && !active.completed) {
    active.completed = true
    onTargetReached?.()
  }
}

/** Регистрация критического сэйва / удара для челленджа "crit_hunter". */
export function recordChallengeCrit(
  active: ActiveChallengeState,
  onTargetReached?: () => void
): void {
  advanceChallenge(active, "crit_hunter", 1, onTargetReached)
}

/** Регистрация подобранного бонуса для челленджа "power_hunter". */
export function recordChallengePower(
  active: ActiveChallengeState,
  onTargetReached?: () => void
): void {
  advanceChallenge(active, "power_hunter", 1, onTargetReached)
}

/** Регистрация цепной детонации для челленджа "chain_master". */
export function recordChallengeChain(
  active: ActiveChallengeState,
  onTargetReached?: () => void
): void {
  advanceChallenge(active, "chain_master", 1, onTargetReached)
}

/** Регистрация снятой брони (в единицах щитов) для челленджа "armor_breaker". */
export function recordChallengeArmor(
  active: ActiveChallengeState,
  amount: number,
  onTargetReached?: () => void
): void {
  const units = Number.isFinite(amount) ? Math.floor(Math.max(0, amount)) : 0
  if (units <= 0) return
  advanceChallenge(active, "armor_breaker", units, onTargetReached)
}

/**
 * Регистрация падения мяча: проваливает flawless и survive_time.
 * Счётные виды (криты, бонусы, цепи, броня) шар не теряют — у них цель набирается
 * событиями, иначе испытание было бы непроходимым при обычной игре.
 */
export function recordChallengeBallLost(active: ActiveChallengeState, onFail?: () => void): void {
  if (active.failed) return
  if (active.def.kind === "flawless" || active.def.kind === "survive_time") {
    active.failed = true
    onFail?.()
  }
}

/** Преобразует состояние челленджа в удобный снимок для отображения в HUD. */
export function formatChallengeHud(active: ActiveChallengeState): ActiveChallengeHud {
  const { def, progress, failed, completed } = active
  let statusText = ""
  let progressRatio = 0

  if (failed) {
    statusText = "ПРОВАЛЕНО"
    progressRatio = 0
  } else if (completed) {
    statusText = "ВЫПОЛНЕНО!"
    progressRatio = 1
  } else {
    switch (def.kind) {
      case "speed_clear": {
        const remaining = Math.max(0, def.targetValue - progress)
        statusText = `⏱ ${remaining.toFixed(1)} с`
        progressRatio = Math.max(0, 1 - progress / def.targetValue)
        break
      }
      case "flawless": {
        statusText = "🛡 МЯЧ В ИГРЕ"
        progressRatio = 1
        break
      }
      case "survive_time": {
        const remaining = Math.max(0, def.targetValue - progress)
        statusText = `⏳ ${remaining.toFixed(1)} с`
        progressRatio = Math.min(1, progress / def.targetValue)
        break
      }
      case "crit_hunter": {
        statusText = `🎯 ${progress} / ${def.targetValue}`
        progressRatio = Math.min(1, progress / def.targetValue)
        break
      }
      case "power_hunter": {
        statusText = `🎁 ${progress} / ${def.targetValue}`
        progressRatio = Math.min(1, progress / def.targetValue)
        break
      }
      case "chain_master": {
        statusText = `💥 ${progress} / ${def.targetValue}`
        progressRatio = Math.min(1, progress / def.targetValue)
        break
      }
      case "armor_breaker": {
        statusText = `🛡 ${progress} / ${def.targetValue}`
        progressRatio = Math.min(1, progress / def.targetValue)
        break
      }
    }
  }

  return {
    kind: def.kind,
    title: def.title,
    description: def.description,
    statusText,
    progressRatio,
    failed,
    completed,
    rewardCrystals: def.rewardCrystals,
    rewardMeta: def.rewardMeta,
  }
}
