import { useCallback, useState } from "react"
import type { RefObject } from "react"

import { FPS_LS_KEY, type Game } from "../game/game"

/** Отладочные контролы доступны только в DEV-сборке. */
const DEV = import.meta.env.DEV

/**
 * Отладочные контролы меню: режим отладки, выбор босса/минибосса,
 * активируемые эффекты и счётчик FPS (значение рисуется на канвасе).
 */
export function useDebugControls(gameRef: RefObject<Game | null>) {
  const [debug, setDebug] = useState<boolean>(false)
  const [debugBoss, setDebugBoss] = useState<string>("")
  /** Счётчик FPS: начальное значение — сохранённая настройка движка (только DEV). */
  const [showFps, setShowFps] = useState<boolean>(() => {
    if (!DEV) return false
    try {
      return localStorage.getItem(FPS_LS_KEY) === "1"
    } catch {
      return false
    }
  })

  const handleToggleDebug = useCallback(() => {
    setDebug((prev) => {
      const next = !prev
      gameRef.current?.toggleDebug()
      return next
    })
  }, [gameRef])

  const handleToggleFps = useCallback(() => {
    const g = gameRef.current
    if (!g || !DEV) return
    setShowFps(g.toggleFps())
  }, [gameRef])

  const handleSelectDebugBoss = useCallback((boss: string) => {
    setDebugBoss(boss)
  }, [])

  const handleToggleDebugEffect = useCallback(
    (id: string) => {
      gameRef.current?.toggleDebugEffect(id)
    },
    [gameRef]
  )

  const handleIsDebugEffectActive = useCallback(
    (id: string) => gameRef.current?.isDebugEffectActive(id) ?? false,
    [gameRef]
  )

  const handleDebugStartGame = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    game.debugBossType = debugBoss === "octopus" || debugBoss === "kraken" ? debugBoss : null
    if (debugBoss === "octopus" || debugBoss === "kraken") {
      game.spawnDebugBoss(debugBoss)
    } else if (debugBoss === "minibossFish") {
      game.spawnDebugMiniboss("fish")
    } else if (debugBoss === "minibossJelly") {
      game.spawnDebugMiniboss("jelly")
    } else {
      // Пустой уровень со случайными блоками (стандартный wave 1)
      game.startEndless()
    }
  }, [gameRef, debugBoss])

  return {
    debug,
    showFps,
    debugBoss,
    handleToggleDebug,
    handleToggleFps,
    handleSelectDebugBoss,
    handleToggleDebugEffect,
    handleIsDebugEffectActive,
    handleDebugStartGame,
  }
}
