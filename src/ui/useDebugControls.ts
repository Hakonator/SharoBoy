import { useCallback, useState } from "react"
import type { RefObject } from "react"

import type { Game } from "../game/game"

/**
 * Отладочные контролы меню: режим отладки, выбор босса/минибосса
 * и активируемые эффекты. FPS/хитбоксы/замедление/бессмертие —
 * горячими клавишами F1–F4, только в DEV-сборке (см. src/game/input.ts).
 */
export function useDebugControls(gameRef: RefObject<Game | null>) {
  const [debug, setDebug] = useState<boolean>(false)
  const [debugBoss, setDebugBoss] = useState<string>("")

  const handleToggleDebug = useCallback(() => {
    setDebug((prev) => {
      const next = !prev
      gameRef.current?.toggleDebug()
      return next
    })
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
    debugBoss,
    handleToggleDebug,
    handleSelectDebugBoss,
    handleToggleDebugEffect,
    handleIsDebugEffectActive,
    handleDebugStartGame,
  }
}
