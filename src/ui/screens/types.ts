import type { AchievementDef } from "../../game/achievements"

/** Личная статистика игрока (из localStorage). */
export interface PlayerStats {
  games: number
  wins: number
  bestScore: number
  bestWave: number
  topLevel: number
}

export interface AchToast {
  key: number
  def: AchievementDef
}

export type SubmitState = "idle" | "sending" | "done" | "error"
