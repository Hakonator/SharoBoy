import { type ReactNode } from "react"

import { IconBall, IconPlay, Key } from "../icons"
import type { HudData } from "../../game/types"

/** Пауза: продолжение, рестарт, выход в меню. */
export function PauseScreen({
  onResume,
  onRestart,
  onMenu,
}: {
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-abyss/70 p-6">
      <div className="anim-pop w-full max-w-sm">
        <div className="hud-chip p-6 sm:p-8">
          <div className="hud-label mb-1">Пауза</div>
          <h2 className="font-display title-glow text-4xl text-foam">СТОП-КАДР</h2>
          <div className="mt-6 flex flex-col gap-3">
            <button
              className="btn-arcade flex items-center justify-center gap-2 px-6 py-3.5"
              onClick={onResume}
            >
              <IconPlay /> Продолжить
            </button>
            <button className="btn-ghost px-6 py-3" onClick={onRestart}>
              Заново
            </button>
            <button className="btn-ghost px-6 py-3" onClick={onMenu}>
              В меню
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Поражение: счёт, рекорд, форма топа, рестарт. */
export function GameOverScreen({
  hud,
  topSubmit,
  onRestart,
  onMenu,
}: {
  hud: HudData
  topSubmit: ReactNode
  onRestart: () => void
  onMenu: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-abyss/70 p-6">
      <div className="anim-pop w-full max-w-md text-center">
        <div className="hud-label mb-2 tracking-[0.35em]">Шары уронили тебя</div>
        <h2
          className="font-display text-5xl text-coral sm:text-6xl"
          style={{ textShadow: "0 0 26px rgba(255,106,92,0.65), 0 4px 0 rgba(4,18,26,0.9)" }}
        >
          ИГРА ОКОНЧЕНА
        </h2>
        {hud.newRecord && (
          <div className="anim-banner mx-auto mt-4 inline-block border border-gold bg-gold/15 px-4 py-1.5 font-display text-sm tracking-widest text-gold">
            НОВЫЙ РЕКОРД!
          </div>
        )}
        {hud.mode === "endless" && (
          <div className="mt-4 font-display text-sm tracking-wider text-cyan-neon">
            ДОСТИГНУТА ВОЛНА {hud.wave}
          </div>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <div className="hud-chip px-6 py-3">
            <div className="hud-label">Счёт</div>
            <div className="font-display text-3xl text-foam tabular-nums">
              {hud.score.toLocaleString("ru-RU")}
            </div>
          </div>
          <div className="hud-chip px-6 py-3">
            <div className="hud-label">Рекорд</div>
            <div className="font-display text-3xl text-gold tabular-nums">
              {hud.best.toLocaleString("ru-RU")}
            </div>
          </div>
        </div>
        {topSubmit}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button className="btn-arcade px-8 py-3.5 text-lg" onClick={onRestart}>
            Ещё раз
          </button>
          <button className="btn-ghost px-6 py-3.5" onClick={onMenu}>
            В меню
          </button>
        </div>
        <div className="mt-4 text-xs text-dim">
          или жми <Key wide>ПРОБЕЛ</Key>
        </div>
      </div>
    </div>
  )
}

/** Победа: счёт, рекорд, форма топа, рестарт кампании. */
export function WinScreen({
  hud,
  topSubmit,
  onRestart,
  onMenu,
}: {
  hud: HudData
  topSubmit: ReactNode
  onRestart: () => void
  onMenu: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-6">
      <div className="anim-pop w-full max-w-md text-center">
        <div className="hud-label mb-2 tracking-[0.35em]">Все шары лопнули</div>
        <h2
          className="font-display text-6xl text-mint sm:text-7xl"
          style={{ textShadow: "0 0 30px rgba(93,255,176,0.7), 0 4px 0 rgba(4,18,26,0.9)" }}
        >
          ПОБЕДА!
        </h2>
        <div className="mx-auto mt-5 flex justify-center gap-2">
          {["#35e0ff", "#5dffb0", "#ffc94d", "#ff6a5c", "#ff5ca8"].map((c) => (
            <IconBall key={c} color={c} className="anim-bob h-8 w-8" />
          ))}
        </div>
        {hud.newRecord && (
          <div className="anim-banner mx-auto mt-4 inline-block border border-gold bg-gold/15 px-4 py-1.5 font-display text-sm tracking-widest text-gold">
            НОВЫЙ РЕКОРД!
          </div>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <div className="hud-chip px-6 py-3">
            <div className="hud-label">Счёт</div>
            <div className="font-display text-3xl text-foam tabular-nums">
              {hud.score.toLocaleString("ru-RU")}
            </div>
          </div>
          <div className="hud-chip px-6 py-3">
            <div className="hud-label">Рекорд</div>
            <div className="font-display text-3xl text-gold tabular-nums">
              {hud.best.toLocaleString("ru-RU")}
            </div>
          </div>
        </div>
        {topSubmit}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button className="btn-arcade px-8 py-3.5 text-lg" onClick={onRestart}>
            Сыграть снова
          </button>
          <button className="btn-ghost px-6 py-3.5" onClick={onMenu}>
            В меню
          </button>
        </div>
      </div>
    </div>
  )
}
