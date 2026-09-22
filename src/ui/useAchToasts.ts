import { useEffect, useState } from "react"

import { ACHIEVEMENTS, loadUnlocked, type AchievementDef } from "../game/achievements"
import type { HudData } from "../game/types"

/** Сколько времени тост достижения висит на экране (мс). */
const ACH_TOAST_MS = 4600

/** Очередь тостов достижений + реестр открытых достижений (id → время). */
export function useAchToasts(hud: HudData) {
  const [unlocked, setUnlocked] = useState<Record<string, number>>(() => loadUnlocked())
  const [achToasts, setAchToasts] = useState<{ key: number; def: AchievementDef; until: number }[]>(
    []
  )

  /* новые достижения из движка -> состояние + тосты */
  useEffect(() => {
    const ids = hud.newAchievements ?? []
    if (!ids.length) return
    setUnlocked((prev) => {
      const next = { ...prev }
      let changed = false
      for (const id of ids) {
        if (!next[id]) {
          next[id] = Date.now()
          changed = true
        }
      }
      return changed ? next : prev
    })
    const fresh = ACHIEVEMENTS.filter((d) => ids.includes(d.id))
    const born = Date.now()
    const items = fresh.map((def) => ({
      key: born + Math.random(),
      def,
      until: born + ACH_TOAST_MS,
    }))
    setAchToasts((prev) => [...prev, ...items].slice(-3))
  }, [hud.newAchievements])

  /* Удаление тостов по истечении ACH_TOAST_MS — отдельным эффектом по
     achToasts. Раньше таймер жил в эффекте выше: hud.newAchievements — новый
     массив при каждой отправке HUD (десятки раз в секунду), его cleanup
     отменял таймер почти сразу после установки, и тосты не исчезали. */
  useEffect(() => {
    if (!achToasts.length) return
    const delay = Math.max(0, Math.min(...achToasts.map((t) => t.until)) - Date.now())
    const timer = setTimeout(() => {
      const now = Date.now()
      setAchToasts((prev) => prev.filter((t) => t.until > now))
    }, delay)
    return () => clearTimeout(timer)
  }, [achToasts])

  return { unlocked, achToasts }
}
