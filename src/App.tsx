import { useCallback, useEffect, useRef, useState } from "react"

import { Game, type HudData } from "./game/game"
import { LEADERBOARD_ENABLED } from "./config"
import { ACHIEVEMENTS, loadUnlocked, type AchievementDef } from "./game/achievements"
import {
  fetchTop,
  screenClass,
  submitScore,
  type GlobalScore,
  type LeadPeriod,
  type ScreenFilter,
} from "./game/leaderboard"
import { validateNick } from "./game/profanity"
import {
  BootErrorScreen,
  AchToasts,
  HudOverlay,
  MenuScreen,
  PauseScreen,
  GameOverScreen,
  WinScreen,
  TopSubmit,
  type PlayerStats,
} from "./ui/screens"

const INITIAL_HUD: HudData = {
  phase: "menu",
  score: 0,
  best: 0,
  lives: 3,
  level: 1,
  levelCount: 3,
  levelName: "СТРЕЛА",
  mode: "campaign",
  wave: 0,
  combo: 0,
  blocksLeft: 0,
  muted: false,
  newAchievements: [],
  banner: null,
  stuck: true,
  newRecord: false,
  shield: 0,
  wideOn: false,
  slowOn: false,
  fastOn: false,
  shrinkOn: false,
  laserOn: false,
  laserArmed: false,
  rocketOn: false,
  fireOn: false,
  magnetOn: false,
  coins: 0,
  upgrades: {},
  top: [],
  topEndless: [],
}

/** Сколько времени тост достижения висит на экране (мс). */
const ACH_TOAST_MS = 4600

/* ---------- app ---------- */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState<HudData>(INITIAL_HUD)
  const [bootError, setBootError] = useState<string | null>(null)

  const [globalTop, setGlobalTop] = useState<GlobalScore[]>([])
  const [globalTopEndless, setGlobalTopEndless] = useState<GlobalScore[]>([])
  const [period, setPeriod] = useState<LeadPeriod>("all")
  const [screen, setScreen] = useState<ScreenFilter>(() =>
    screenClass(window.innerWidth || 960, window.innerHeight || 640)
  )

  const [stats, setStats] = useState<PlayerStats>(() => {
    try {
      const raw = localStorage.getItem("sharoboy-stats")
      return raw
        ? { games: 0, wins: 0, bestScore: 0, bestWave: 0, topLevel: 0, ...JSON.parse(raw) }
        : { games: 0, wins: 0, bestScore: 0, bestWave: 0, topLevel: 0 }
    } catch {
      return { games: 0, wins: 0, bestScore: 0, bestWave: 0, topLevel: 0 }
    }
  })
  const [nick, setNick] = useState<string>(() => {
    try {
      return localStorage.getItem("sharoboy-nick") ?? ""
    } catch {
      return ""
    }
  })
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [submitError, setSubmitError] = useState<string | null>(null)
  /** защита от повторной автоотправки одного и того же забега при выходах в меню */
  const endlessSubmitRef = useRef<Record<string, true>>({})

  /* достижения: открытые (id -> время) + очередь тостов */
  const [unlocked, setUnlocked] = useState<Record<string, number>>(() => loadUnlocked())
  const [achToasts, setAchToasts] = useState<{ key: number; def: AchievementDef; until: number }[]>(
    []
  )

  const onHud = useCallback((h: HudData) => setHud(h), [])

  /* Инициализация движка: без этого gameRef.current остаётся null,
     и кнопки меню (Кампания / Бесконечный) не запускают игру. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const game = new Game(canvas, onHud, nick)
      gameRef.current = game
      game.attach()
      return () => game.destroy()
    } catch (e) {
      setBootError(e instanceof Error ? e.message : String(e))
    }
  }, [onHud, nick])

  /* Синхронизация ника с движком при изменении. */
  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.setNick(nick)
    }
  }, [nick])

  useEffect(() => {
    if (!LEADERBOARD_ENABLED) return
    const s = screen === "all" ? undefined : screen
    void (async () => {
      const [c, e] = await Promise.all([
        fetchTop("campaign", period, 10, s),
        fetchTop("endless", period, 10, s),
      ])
      setGlobalTop(c)
      setGlobalTopEndless(e)
    })()
  }, [period, screen])

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
        const s = screen === "all" ? undefined : screen
        const [c, e] = await Promise.all([
          fetchTop("campaign", period, 10, s),
          fetchTop("endless", period, 10, s),
        ])
        setGlobalTop(c)
        setGlobalTopEndless(e)
      } else {
        setSubmitState("error")
        setSubmitError("Не удалось отправить: " + err)
      }
    })()
  }, [hud.phase, hud.mode, hud.score, hud.wave, nick, submitState, period, screen])

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

  const handleTopSubmit = async () => {
    if (submitState === "sending" || submitState === "done") return
    const check = validateNick(nick)
    if (!check.ok) {
      setSubmitState("error")
      setSubmitError(check.error)
      return
    }
    setNick(check.nick)
    try {
      localStorage.setItem("sharoboy-nick", check.nick)
    } catch {
      /* приватный режим — ник просто не сохранится */
    }
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
      const s = screen === "all" ? undefined : screen
      const [c, e] = await Promise.all([
        fetchTop("campaign", period, 10, s),
        fetchTop("endless", period, 10, s),
      ])
      setGlobalTop(c)
      setGlobalTopEndless(e)
    } else {
      setSubmitState("error")
      setSubmitError("Не удалось отправить: " + err)
    }
  }

  /* форма «попасть в мировой топ» — на поражении/победе, а также в меню
   при выходе из бесконечного режима без заданного ника */
  const pendingMenuEndlessSubmit =
    LEADERBOARD_ENABLED &&
    hud.phase === "menu" &&
    hud.mode === "endless" &&
    hud.score > 0 &&
    submitState !== "done"

  const topSubmit = (
    <TopSubmit
      show={
        LEADERBOARD_ENABLED &&
        hud.score > 0 &&
        (hud.phase === "over" || hud.phase === "won" || pendingMenuEndlessSubmit)
      }
      state={submitState}
      error={submitError}
      nick={nick}
      onNickChange={setNick}
      onSubmit={() => void handleTopSubmit()}
    />
  )

  const g = () => gameRef.current
  const inGame = hud.phase === "playing" || hud.phase === "paused"

  return (
    <div className="relative h-full w-full overflow-hidden font-body">
      {bootError && <BootErrorScreen error={bootError} onReload={() => window.location.reload()} />}

      {/* h-full/w-full обязательны: canvas — replaced-элемент, absolute inset-0 его
          не растягивает, и при devicePixelRatio > 1 он вылезал за пределы экрана */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <AchToasts toasts={achToasts} />

      <HudOverlay
        hud={hud}
        inGame={inGame}
        onPause={() => g()?.togglePause()}
        onMute={() => g()?.toggleMute()}
      />

      {hud.phase === "menu" && (
        <MenuScreen
          hud={hud}
          stats={stats}
          nick={nick}
          period={period}
          screen={screen}
          globalTop={globalTop}
          globalTopEndless={globalTopEndless}
          unlocked={unlocked}
          topSubmit={topSubmit}
          onPeriod={setPeriod}
          onScreen={setScreen}
          onCampaign={() => g()?.startGame()}
          onEndless={() => g()?.startEndless()}
          onBuyUpgrade={(id) => g()?.buyUpgrade(id)}
        />
      )}

      {hud.phase === "paused" && (
        <PauseScreen
          onResume={() => g()?.togglePause()}
          onRestart={() => (hud.mode === "endless" ? g()?.startEndless() : g()?.startGame())}
          onMenu={() => g()?.toMenu()}
        />
      )}

      {hud.phase === "over" && (
        <GameOverScreen
          hud={hud}
          topSubmit={topSubmit}
          onRestart={() => (hud.mode === "endless" ? g()?.startEndless() : g()?.startGame())}
          onMenu={() => g()?.toMenu()}
        />
      )}

      {hud.phase === "won" && (
        <WinScreen
          hud={hud}
          topSubmit={topSubmit}
          onRestart={() => g()?.startGame()}
          onMenu={() => g()?.toMenu()}
        />
      )}
    </div>
  )
}
