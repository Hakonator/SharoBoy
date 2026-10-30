import { useEffect, useState } from "react"

import { getDailyRunInfo, getDailyTimeUntilReset, type DailyRunInfo } from "../../game/daily"
import type { GlobalScore } from "../../game/leaderboard"

export interface DailyRunModalProps {
  dailyInfo?: DailyRunInfo
  topDaily?: GlobalScore[]
  onStart: () => void
  onClose: () => void
}

/**
 * Модальное окно суточного брифинга «Ежедневное испытание»:
 * отображает суточный сид, таймер до полуночи UTC, фиксированные мутаторы дня,
 * суммарный бонус к очкам и текущий топ игроков за день.
 */
export function DailyRunModal({
  dailyInfo: propDailyInfo,
  topDaily = [],
  onStart,
  onClose,
}: DailyRunModalProps) {
  const [dailyInfo] = useState<DailyRunInfo>(() => propDailyInfo ?? getDailyRunInfo())
  const [countdown, setCountdown] = useState(() => getDailyTimeUntilReset().formatted)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getDailyTimeUntilReset().formatted)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const totalScorePercent = Math.round(dailyInfo.totalScoreBonus * 100)

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-abyss/85 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-run-modal-title"
    >
      <div className="hud-chip flex w-full max-w-2xl flex-col border border-amber-500/50 bg-abyss/95 p-4 shadow-[0_0_40px_rgba(245,158,11,0.25)] sm:p-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-amber-500/30 pb-3">
          <div>
            <div className="hud-label text-amber-400">ЦУП «СФЕРА-1080» // ДИРЕКТИВА ДНЯ</div>
            <h2
              id="daily-run-modal-title"
              className="font-display text-xl tracking-wider text-foam sm:text-2xl"
            >
              📅 ЕЖЕДНЕВНОЕ ИСПЫТАНИЕ
            </h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-foam/60 hover:bg-amber-500/10 hover:text-amber-400"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Суточная плашка: дата + обратный отсчёт до полуночи UTC */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">🛰 Дата:</span>
            <span className="font-mono font-bold text-foam">{dailyInfo.dateFormatted} (UTC)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400">⏳ Сброс через:</span>
            <span className="font-mono font-bold text-amber-300 tabular-nums">{countdown}</span>
          </div>
        </div>

        <p className="mt-2.5 text-xs text-foam/70 sm:text-sm">
          Единый фиксированный сид для всех операторов сектора. Станция, узлы карты, магазины и
          боссы одинаковы для всего мира. Повторные попытки улучшают ваш рекорд суток.
        </p>

        {/* Суточные мутаторы */}
        <div className="my-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="hud-label text-amber-300">ФИКСИРОВАННЫЕ МУТАТОРЫ ДНЯ</span>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
              +{totalScorePercent}% к очкам 🏆
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {dailyInfo.modifierDefs.map((mod) => (
              <div
                key={mod.id}
                className="flex flex-col rounded-xl border border-amber-500/30 bg-deep/60 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{mod.icon}</span>
                    <span className="font-display text-sm tracking-wide text-foam sm:text-base">
                      {mod.title}
                    </span>
                  </div>
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-bold"
                    style={{
                      backgroundColor: `${mod.badgeColor}22`,
                      color: mod.badgeColor,
                      border: `1px solid ${mod.badgeColor}66`,
                    }}
                  >
                    +{Math.round(mod.scoreBonus * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-foam/75">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Топ дня */}
        <div className="mb-4">
          <div className="hud-label mb-1.5 text-amber-300">ЛИДЕРЫ СЕКТОРОВ СЕГОДНЯ</div>
          {topDaily.length > 0 ? (
            <ol className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-foam/10 bg-deep/40 p-2 pr-1 font-mono text-xs">
              {topDaily.slice(0, 5).map((row, idx) => (
                <li
                  key={`${row.nick}-${idx}`}
                  className="flex items-center justify-between text-foam/90"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-amber-400 font-bold">{idx + 1}.</span>
                    <span className="truncate max-w-[160px] sm:max-w-[220px]">{row.nick}</span>
                  </span>
                  <span className="text-gold tabular-nums">
                    {row.score.toLocaleString("ru-RU")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-lg border border-dashed border-foam/15 bg-deep/30 p-2.5 text-center text-xs text-foam/60">
              Пока никто не завершил испытание сегодня. Вы можете стать первым лидером дня!
            </div>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-amber-500/20 pt-3">
          <button type="button" className="btn-ghost px-5 py-2.5 text-sm" onClick={onClose}>
            В меню
          </button>
          <button
            type="button"
            className="btn-arcade border-amber-500/80 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 px-6 py-2.5 text-base sm:text-lg shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            onClick={onStart}
          >
            НАЧАТЬ ИСПЫТАНИЕ ➔
          </button>
        </div>
      </div>
    </div>
  )
}
