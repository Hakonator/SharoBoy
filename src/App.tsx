import { useCallback, useEffect, useRef, useState } from "react"

import { Game, type HudData } from "./game/game"
import {
  BootErrorScreen,
  AchToasts,
  HudOverlay,
  MapScreen,
  MenuScreen,
  PauseScreen,
  GameOverScreen,
  WinScreen,
  TopSubmit,
} from "./ui/screens"
import { useAchToasts } from "./ui/useAchToasts"
import { useDebugControls } from "./ui/useDebugControls"
import { useLeaderboard } from "./ui/useLeaderboard"
import { usePlayerStats } from "./ui/usePlayerStats"
import { usePortrait } from "./ui/usePortrait"

const INITIAL_HUD: HudData = {
  phase: "menu",
  score: 0,
  best: 0,
  lives: 3,
  level: 1,
  levelCount: 4,
  levelName: "СТРЕЛА",
  mode: "campaign",
  wave: 0,
  combo: 0,
  blocksLeft: 0,
  muted: false,
  musicMuted: false,
  musicVolume: 1,
  sfxVolume: 1,
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
  frostOn: false,
  sparkOn: false,
  magnetOn: false,
  coins: 0,
  upgrades: {},
  top: [],
  topEndless: [],
  map: null,
  campaignEvent: null,
}

/* ---------- app ---------- */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState<HudData>(INITIAL_HUD)
  const [bootError, setBootError] = useState<string | null>(null)

  const onHud = useCallback((h: HudData) => setHud(h), [])

  /* Ник редактируется в меню и в форме топа: сразу пишем в localStorage,
     движок синхронизируется эффектом по [nick] ниже (game.setNick). */
  const [nick, setNick] = useState<string>(() => {
    try {
      return localStorage.getItem("sharoboy-nick") ?? ""
    } catch {
      return ""
    }
  })
  const handleNickChange = useCallback((v: string) => {
    setNick(v)
    try {
      localStorage.setItem("sharoboy-nick", v)
    } catch {
      /* приватный режим — ник просто не сохранится */
    }
  }, [])

  const { unlocked, achToasts } = useAchToasts(hud)
  const { stats } = usePlayerStats(hud)
  const debug = useDebugControls(gameRef)
  const leaderboard = useLeaderboard(hud, nick, handleNickChange)
  /** Вертикальный экран: HUD живёт в зарезервированной неигровой зоне сверху. */
  const portrait = usePortrait()

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

  const g = () => gameRef.current
  const inGame = hud.phase === "playing" || hud.phase === "paused"

  const topSubmit = (
    <TopSubmit
      show={
        leaderboard.submitState !== "done" &&
        hud.score > 0 &&
        (hud.phase === "over" || hud.phase === "won" || leaderboard.pendingMenuEndlessSubmit)
      }
      state={leaderboard.submitState}
      error={leaderboard.submitError}
      nick={nick}
      onNickChange={handleNickChange}
      onSubmit={() => void leaderboard.handleTopSubmit()}
    />
  )

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
        portrait={portrait}
        onPause={() => g()?.togglePause()}
        onMute={() => g()?.toggleMute()}
        onMusic={() => g()?.toggleMusic()}
        onMusicVolume={(v) => g()?.setMusicVolume(v)}
        onSfxVolume={(v) => g()?.setSfxVolume(v)}
      />

      {hud.phase === "map" && (
        <MapScreen
          hud={hud}
          onMapNode={(id) => g()?.enterMapNode(id)}
          onEventDismiss={() => g()?.dismissCampaignEvent()}
          onMenu={() => g()?.toMenu()}
        />
      )}

      {hud.phase === "menu" && (
        <MenuScreen
          hud={hud}
          stats={stats}
          nick={nick}
          period={leaderboard.period}
          screen={leaderboard.screen}
          globalTop={leaderboard.globalTop}
          globalTopEndless={leaderboard.globalTopEndless}
          unlocked={unlocked}
          topSubmit={topSubmit}
          onNickChange={handleNickChange}
          onPeriod={leaderboard.setPeriod}
          onScreen={leaderboard.setScreen}
          onCampaign={() => g()?.startGame()}
          onEndless={() => g()?.startEndless()}
          onBuyUpgrade={(id) => g()?.buyUpgrade(id)}
          debug={debug.debug}
          onToggleDebug={debug.handleToggleDebug}
          debugBoss={debug.debugBoss}
          onSelectDebugBoss={debug.handleSelectDebugBoss}
          isDebugEffectActive={debug.handleIsDebugEffectActive}
          onToggleDebugEffect={debug.handleToggleDebugEffect}
          onDebugStartGame={debug.handleDebugStartGame}
          onMute={() => g()?.toggleMute()}
          onMusic={() => g()?.toggleMusic()}
          onMusicVolume={(v) => g()?.setMusicVolume(v)}
          onSfxVolume={(v) => g()?.setSfxVolume(v)}
          showFps={debug.showFps}
          onToggleFps={debug.handleToggleFps}
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
