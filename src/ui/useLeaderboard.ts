import { useCallback, useEffect, useRef, useState } from "react"

import { LEADERBOARD_ENABLED } from "../config"
import {
  fetchTop,
  screenClass,
  submitScore,
  type GlobalScore,
  type LeadPeriod,
  type ScreenFilter,
} from "../game/leaderboard"
import { validateNick } from "../game/profanity"
import type { HudData } from "../game/types"

/**
 * Мировой топ: загрузка с фильтрами, ручная и авто-отправка очков
 * (в т.ч. автосабмит при выходе из бесконечного режима в меню).
 */
export function useLeaderboard(hud: HudData, nick: string, onNickChange: (v: string) => void) {
  const [globalTop, setGlobalTop] = useState<GlobalScore[]>([])
  const [globalTopEndless, setGlobalTopEndless] = useState<GlobalScore[]>([])
  const [period, setPeriod] = useState<LeadPeriod>("all")
  /* По умолчанию «Все»: рекорды других категорий (например, мобильный рекорд,
     открытый с компьютера) видны сразу. Запись при отправке всё равно
     помечается реальной категорией устройства — сузить список можно фильтром. */
  const [screen, setScreen] = useState<ScreenFilter>("all")
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [submitError, setSubmitError] = useState<string | null>(null)
  /** защита от повторной автоотправки одного и того же забега при выходах в меню */
  const endlessSubmitRef = useRef<Record<string, true>>({})

  const refreshTop = useCallback(async (p: LeadPeriod, s: ScreenFilter) => {
    const filter = s === "all" ? undefined : s
    const [c, e] = await Promise.all([
      fetchTop("campaign", p, 10, filter),
      fetchTop("endless", p, 10, filter),
    ])
    setGlobalTop(c)
    setGlobalTopEndless(e)
  }, [])

  useEffect(() => {
    if (!LEADERBOARD_ENABLED) return
    void refreshTop(period, screen)
  }, [period, screen, refreshTop])

  /* новая игра — форма отправки очков сбрасывается и забывается ключ забега */
  useEffect(() => {
    if (hud.phase === "playing") {
      setSubmitState("idle")
      setSubmitError(null)
      endlessSubmitRef.current = {}
    }
  }, [hud.phase])

  /* Выход из бесконечного режима в меню: очки уже сохранены локально
     (saveTop в toMenu), теперь фиксируем их и в общей таблице рекордов —
     режим различается колонкой mode, отдельная таблица не нужна.
     При заданном нике отправляем автоматически; без ника — оставляем форму
     «В топ!» прямо в меню, чтобы игрок мог ввести ник и отправить. */
  useEffect(() => {
    if (!LEADERBOARD_ENABLED) return
    if (hud.phase !== "menu" || hud.mode !== "endless" || hud.score <= 0) return
    if (submitState === "done") return // уже отправлено через экран поражения
    const key = `${hud.score}:${hud.wave}`
    if (endlessSubmitRef.current[key]) return
    endlessSubmitRef.current[key] = true
    const check = validateNick(nick)
    if (!check.ok) return // ник не задан — форма на меню даст ввести его
    setSubmitState("sending")
    void (async () => {
      const err = await submitScore(
        check.nick,
        hud.score,
        "endless",
        hud.wave,
        screenClass(window.innerWidth || 960, window.innerHeight || 640)
      )
      if (!err) {
        setSubmitState("done")
        await refreshTop(period, screen)
      } else {
        setSubmitState("error")
        setSubmitError("Не удалось отправить: " + err)
      }
    })()
  }, [hud.phase, hud.mode, hud.score, hud.wave, nick, submitState, period, screen, refreshTop])

  const handleTopSubmit = useCallback(async () => {
    if (submitState === "sending" || submitState === "done") return
    const check = validateNick(nick)
    if (!check.ok) {
      setSubmitState("error")
      setSubmitError(check.error)
      return
    }
    onNickChange(check.nick)
    setSubmitState("sending")
    setSubmitError(null)
    const err = await submitScore(
      check.nick,
      hud.score,
      hud.mode,
      hud.mode === "endless" ? hud.wave : 0,
      screenClass(window.innerWidth || 960, window.innerHeight || 640)
    )
    if (!err) {
      setSubmitState("done")
      await refreshTop(period, screen)
    } else {
      setSubmitState("error")
      setSubmitError("Не удалось отправить: " + err)
    }
  }, [submitState, nick, onNickChange, hud.score, hud.mode, hud.wave, period, screen, refreshTop])

  /* форма «попасть в мировой топ» — на поражении/победе, а также в меню
     при выходе из бесконечного режима без заданного ника */
  const pendingMenuEndlessSubmit =
    LEADERBOARD_ENABLED &&
    hud.phase === "menu" &&
    hud.mode === "endless" &&
    hud.score > 0 &&
    submitState !== "done"

  return {
    period,
    setPeriod,
    screen,
    setScreen,
    globalTop,
    globalTopEndless,
    submitState,
    submitError,
    handleTopSubmit,
    pendingMenuEndlessSubmit,
  }
}
