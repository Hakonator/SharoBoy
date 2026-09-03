import { useCallback, useEffect, useRef, useState } from "react"

import { Game, type HudData } from "./game/game"
import { LEADERBOARD_ENABLED } from "./config"
import { ACHIEVEMENTS, loadUnlocked, type AchievementDef } from "./game/achievements"
import { fetchTop, submitScore, type GlobalScore, type LeadPeriod } from "./game/leaderboard"
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

/* ---------- app ---------- */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState<HudData>(INITIAL_HUD)
  const [bootError, setBootError] = useState<string | null>(null)

  const [globalTop, setGlobalTop] = useState<GlobalScore[]>([])
  const [globalTopEndless, setGlobalTopEndless] = useState<GlobalScore[]>([])
  const [period, setPeriod] = useState<LeadPeriod>("all")

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

  /* достижения: открытые (id -> время) + очередь тостов */
  const [unlocked, setUnlocked] = useState<Record<string, number>>(() => loadUnlocked())
  const [achToasts, setAchToasts] = useState<{ key: number; def: AchievementDef }[]>([])

  const onHud = useCallback((h: HudData) => setHud(h), [])

  /* Инициализация движка: без этого gameRef.current остаётся null,
     и кнопки меню (Кампания / Бесконечный) не запускают игру. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const game = new Game(canvas, onHud)
      gameRef.current = game
      game.attach()
      return () => game.destroy()
    } catch (e) {
      setBootError(e instanceof Error ? e.message : String(e))
    }
  }, [onHud])

  useEffect(() => {
    if (!LEADERBOARD_ENABLED) return
    void (async () => {
      const [c, e] = await Promise.all([fetchTop("campaign", period), fetchTop("endless", period)])
      setGlobalTop(c)
      setGlobalTopEndless(e)
    })()
  }, [period])

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

  /* новая игра — форма отправки очков сбрасывается */
  useEffect(() => {
    if (hud.phase === "playing" || hud.phase === "menu") {
      setSubmitState("idle")
      setSubmitError(null)
    }
  }, [hud.phase])

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
    const items = fresh.map((def) => ({ key: Date.now() + Math.random(), def }))
    setAchToasts((prev) => [...prev, ...items].slice(-3))
    const keys = items.map((t) => t.key)
    const timer = setTimeout(() => {
      setAchToasts((prev) => prev.filter((t) => !keys.includes(t.key)))
    }, 4600)
    return () => clearTimeout(timer)
  }, [hud.newAchievements])

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
      hud.mode === "endless" ? hud.wave : 0
    )
    if (!err) {
      setSubmitState("done")
      const [c, e] = await Promise.all([fetchTop("campaign", period), fetchTop("endless", period)])
      setGlobalTop(c)
      setGlobalTopEndless(e)
    } else {
      setSubmitState("error")
      setSubmitError("Не удалось отправить: " + err)
    }
  }

  /* форма «попасть в мировой топ» — показывается на экранах поражения и победы */
  const topSubmit = (
    <TopSubmit
      show={LEADERBOARD_ENABLED && (hud.phase === "over" || hud.phase === "won") && hud.score > 0}
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
          globalTop={globalTop}
          globalTopEndless={globalTopEndless}
          unlocked={unlocked}
          onPeriod={setPeriod}
          onCampaign={() => g()?.startGame()}
          onEndless={() => g()?.startEndless()}
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
