/**
 * Квестовые задания и узлы-челленджи кампании:
 * Особые боевые испытания с дополнительными условиями победы
 * и повышенной наградой (пакет кристаллов забега + несгораемые мета-кристаллы).
 */

import { mulberry32 } from "./utils"

export type ChallengeKind = "speed_clear" | "flawless" | "survive_time" | "crit_hunter"

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
  const kinds: ChallengeKind[] = ["speed_clear", "flawless", "survive_time", "crit_hunter"]
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

/** Регистрация критического сэйва / удара для челленджа "crit_hunter". */
export function recordChallengeCrit(
  active: ActiveChallengeState,
  onTargetReached?: () => void
): void {
  if (active.failed || active.def.kind !== "crit_hunter") return
  active.progress++
  if (active.progress >= active.def.targetValue && !active.completed) {
    active.completed = true
    onTargetReached?.()
  }
}

/** Регистрация падения мяча: проваливает flawless и survive_time. */
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
