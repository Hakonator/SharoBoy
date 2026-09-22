import { useEffect, useState } from "react"

import type { HudData } from "../game/types"

import type { PlayerStats } from "./screens/types"

const DEFAULT_STATS: PlayerStats = { games: 0, wins: 0, bestScore: 0, bestWave: 0, topLevel: 0 }

function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem("sharoboy-stats")
    return raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : { ...DEFAULT_STATS }
  } catch {
    return { ...DEFAULT_STATS }
  }
}

/** Личная статистика игрока (localStorage) с пересчётом по итогам партии. */
export function usePlayerStats(hud: HudData) {
  const [stats, setStats] = useState<PlayerStats>(loadStats)

  /* пересчёт личной статистики по итогам партии */
  useEffect(() => {
    if (hud.phase !== "over" && hud.phase !== "won") return
    setStats((prev) => {
      const next: PlayerStats = {
        games: prev.games + 1,
        wins: prev.wins + (hud.phase === "won" ? 1 : 0),
        bestScore: Math.max(prev.bestScore, hud.score),
        bestWave: Math.max(prev.bestWave, hud.wave),
        topLevel: Math.max(prev.topLevel, hud.level),
      }
      try {
        localStorage.setItem("sharoboy-stats", JSON.stringify(next))
      } catch {
        /* приватный режим — статистика не сохранится */
      }
      return next
    })
  }, [hud.phase, hud.score, hud.wave, hud.level])

  return { stats }
}
