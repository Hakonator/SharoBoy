import { type ReactNode } from "react"

import { IconBall, IconPlay, Key } from "../icons"
import type { HudData, RunScoreBreakdown } from "../../game/types"
import { getFinalEpilogue } from "../../game/bossDialogs"

/** Прозрачная таблица детализации очков (Score Breakdown). */
export function ScoreBreakdownTable({ breakdown }: { breakdown: RunScoreBreakdown }) {
  if (!breakdown || (!breakdown.items.length && breakdown.endBonusTotal === 0)) {
    return null
  }

  return (
    <div
      data-testid="score-breakdown-table"
      className="mt-4 w-full rounded-xl border border-cyan-500/20 bg-deep/85 p-3.5 text-left font-mono shadow-xl backdrop-blur-md sm:p-4"
    >
      <div className="mb-2.5 flex items-center justify-between border-b border-foam/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <span className="font-display text-xs font-bold uppercase tracking-wider text-cyan-neon">
            Детализация очков
          </span>
        </div>
        {breakdown.mutatorBonusPercent > 0 && (
          <span className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
            +{breakdown.mutatorBonusPercent}% Мутаторы
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs">
        {breakdown.items.map((item) => (
          <div
            key={item.id}
            data-testid={`breakdown-row-${item.id}`}
            className="flex items-center justify-between gap-2 rounded px-2 py-1 transition-colors hover:bg-foam/5"
          >
            <div className="flex min-w-0 items-center gap-2">
              {item.icon && <span className="shrink-0 text-xs">{item.icon}</span>}
              <span className="truncate font-sans text-xs text-foam/90">{item.label}</span>
              <span className="shrink-0 text-[10px] text-dim">({item.detail})</span>
            </div>
            <div className="shrink-0 font-mono text-xs font-bold tabular-nums">
              {item.isMultiplier ? (
                <span className="text-purple-300">×{breakdown.mutatorsMultiplier.toFixed(2)}</span>
              ) : item.points > 0 ? (
                <span className="text-mint">+{item.points.toLocaleString("ru-RU")}</span>
              ) : (
                <span className="text-foam/50">0</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {breakdown.endBonusTotal > 0 && (
        <div className="mt-2.5 flex items-center justify-between border-t border-foam/10 pt-2 text-xs">
          <span className="font-sans text-[11px] uppercase tracking-wider text-foam/70">
            Бонус за завершение:
          </span>
          <span className="font-mono font-bold tabular-nums text-gold">
            +{breakdown.endBonusTotal.toLocaleString("ru-RU")}
          </span>
        </div>
      )}
    </div>
  )
}

/** Пауза: продолжение, рестарт, выход в меню. */
export function PauseScreen({
  onResume,
  onRestart,
  onMenu,
  onOpenSettings,
}: {
  onResume: () => void
  onRestart: () => void
  onMenu: () => void
  onOpenSettings?: () => void
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
            {onOpenSettings && (
              <button
                className="btn-ghost flex items-center justify-center gap-2 px-6 py-3 text-cyan-neon hover:text-foam"
                onClick={onOpenSettings}
              >
                ⚙ Настройки
              </button>
            )}
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
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-abyss/70 p-6">
      <div className="anim-pop my-auto w-full max-w-lg text-center">
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
        {hud.scoreBreakdown && <ScoreBreakdownTable breakdown={hud.scoreBreakdown} />}
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

function SpaceStationVista({ accentColor }: { accentColor: string }) {
  return (
    <div className="relative my-3 h-36 w-full overflow-hidden rounded-xl border border-cyan-500/30 bg-[#020712] shadow-[0_0_20px_rgba(3,14,28,0.8)] sm:h-44">
      <svg
        viewBox="0 0 600 200"
        className="h-full w-full object-cover"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="sunGlow" cx="75%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="25%" stopColor="#9df2ff" stopOpacity="0.8" />
            <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="earthBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0c4a6e" />
            <stop offset="40%" stopColor="#082f49" />
            <stop offset="100%" stopColor="#020d1a" />
          </linearGradient>
          <linearGradient id="gelVent" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#35e0ff" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#5dffb0" stopOpacity="0.3" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Звёздное поле */}
        {[
          [35, 25, 1],
          [80, 60, 1.5],
          [140, 30, 0.8],
          [190, 75, 1.2],
          [260, 20, 1],
          [310, 45, 1.5],
          [370, 15, 0.9],
          [420, 50, 1.2],
          [490, 25, 1.6],
          [540, 70, 1],
          [570, 35, 1.3],
          [110, 85, 0.7],
          [220, 95, 1.1],
          [460, 80, 0.9],
          [70, 120, 1.2],
          [520, 110, 1],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#e0f2fe" opacity={0.7} />
        ))}

        {/* Восход солнца над горизонтом Земли */}
        <circle cx="460" cy="120" r="140" fill="url(#sunGlow)" />
        <line x1="460" y1="120" x2="350" y2="40" stroke="#ffffff" strokeWidth="1.5" opacity="0.4" />
        <line x1="460" y1="120" x2="570" y2="190" stroke="#38bdf8" strokeWidth="1" opacity="0.3" />

        {/* Кривизна Земли */}
        <circle cx="300" cy="620" r="490" fill="url(#earthBody)" />
        {/* Атмосферный ореол */}
        <path
          d="M -50 140 Q 300 115 650 140"
          stroke="#38bdf8"
          strokeWidth="6"
          fill="none"
          opacity="0.8"
          filter="url(#glow)"
        />
        <path
          d="M -50 140 Q 300 115 650 140"
          stroke="#ffffff"
          strokeWidth="2"
          fill="none"
          opacity="0.9"
        />

        {/* Выброс отработанного крио-биогеля в вакуум */}
        <path
          d="M 180 85 C 140 70, 90 60, 20 65"
          stroke="url(#gelVent)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
          filter="url(#glow)"
        />
        <path
          d="M 180 95 C 130 100, 70 110, 10 115"
          stroke="url(#gelVent)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
          filter="url(#glow)"
        />

        {/* Станция «СФЕРА-1080» */}
        <g transform="translate(180, 70)">
          {/* Раскрытые радиаторы/панели станции */}
          <rect
            x="-35"
            y="8"
            width="28"
            height="6"
            rx="1"
            fill="#0369a1"
            stroke="#38bdf8"
            strokeWidth="1"
          />
          <rect
            x="27"
            y="8"
            width="28"
            height="6"
            rx="1"
            fill="#0369a1"
            stroke="#38bdf8"
            strokeWidth="1"
          />
          <line x1="-35" y1="11" x2="55" y2="11" stroke="#38bdf8" strokeWidth="0.8" opacity="0.7" />

          {/* Каркас и манипуляторы */}
          <line x1="-5" y1="2" x2="25" y2="2" stroke="#64748b" strokeWidth="2" />
          <line x1="-5" y1="20" x2="25" y2="20" stroke="#64748b" strokeWidth="2" />

          {/* Центральный модуль "СФЕРА" */}
          <circle
            cx="10"
            cy="11"
            r="14"
            fill="#0f172a"
            stroke={accentColor}
            strokeWidth="2"
            filter="url(#glow)"
          />
          {/* Обзорный купол */}
          <circle cx="10" cy="11" r="7" fill="#38bdf8" opacity="0.85" />
          <circle cx="8" cy="9" r="2.5" fill="#ffffff" opacity="0.9" />

          {/* Игровой зонд / манипулятор возвращается в док */}
          <circle cx="34" cy="-2" r="3.5" fill="#35e0ff" filter="url(#glow)" />
          <line
            x1="18"
            y1="6"
            x2="31"
            y2="0"
            stroke="#35e0ff"
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.8"
          />
        </g>

        {/* Кибер-сетка телеметрии */}
        <text x="18" y="24" fill="#38bdf8" fontSize="9" fontFamily="monospace" opacity="0.8">
          СФЕРА-1080 // ОРБИТА: 420 КМ // СБРОС ХЛАДАГЕНТА: ЗАВЕРШЁН
        </text>
        <text x="18" y="185" fill="#94a3b8" fontSize="8" fontFamily="monospace" opacity="0.6">
          ТЕЛЕМЕТРИЯ: ЗЕМЛЯ-1 // СИГНАЛ 100% // ШЛЮЗЫ: ОТКРЫТЫ
        </text>
      </svg>
    </div>
  )
}

/** Победа: космический твист станции «СФЕРА-1080» (кампания) или классический аркадный триумф. */
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
  const isCampaign = hud.mode === "campaign"
  const epilogue = isCampaign ? getFinalEpilogue(hud.finalBossDefeated) : null

  if (isCampaign && epilogue) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="anim-pop my-auto w-full max-w-xl text-center">
          {/* Статус телеметрии станции */}
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-300">
              {epilogue.stationStatus}
            </span>
          </div>

          <h2
            className="font-display text-2xl font-black tracking-wide sm:text-4xl"
            style={{
              color: epilogue.accentColor,
              textShadow: `0 0 24px ${epilogue.accentColor}90, 0 2px 0 rgba(0,0,0,0.9)`,
            }}
          >
            {epilogue.title}
          </h2>

          <div className="mt-1 font-mono text-xs tracking-wider text-foam/70">
            {epilogue.subtitle}
          </div>

          {/* Панорама космоса и орбитальной станции */}
          <SpaceStationVista accentColor={epilogue.accentColor} />

          {/* Расшифровка журнала лора */}
          <div className="rounded-xl border border-foam/15 bg-deep/85 p-3.5 text-left font-mono text-xs leading-relaxed text-foam/90 shadow-2xl backdrop-blur-md sm:p-4 sm:text-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-widest text-cyan-neon sm:text-[11px]">
              <span>🛰 ТЕЛЕМЕТРИЯ ЦУП // РАСШИФРОВКА БОРТОВОГО ЖУРНАЛА</span>
              <span className="h-0.5 flex-1 rounded bg-cyan-neon/30" />
            </div>
            <p className="text-foam/95">{epilogue.text}</p>
          </div>

          {/* Награда мета-кристаллами за завершение экспедиции */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-950/40 px-4 py-1.5 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
            <span className="font-display text-sm font-bold text-purple-200">
              ЭКСПЕДИЦИЯ ЗАВЕРШЕНА:
            </span>
            <span className="font-display text-base font-black text-purple-300">+150 💠</span>
            <span className="text-[11px] font-mono text-purple-300/80">МЕТА-КРИСТАЛЛОВ</span>
          </div>

          {hud.newRecord && (
            <div className="anim-banner mx-auto mt-3 inline-block border border-gold bg-gold/15 px-4 py-1.5 font-display text-sm tracking-widest text-gold">
              НОВЫЙ РЕКОРД!
            </div>
          )}

          {/* Статистика забега */}
          <div className="mt-3 flex justify-center gap-2 sm:gap-3">
            <div className="hud-chip px-4 py-2 sm:px-6 sm:py-2.5">
              <div className="hud-label">Счёт</div>
              <div className="font-display text-2xl text-foam tabular-nums sm:text-3xl">
                {hud.score.toLocaleString("ru-RU")}
              </div>
            </div>
            <div className="hud-chip px-4 py-2 sm:px-6 sm:py-2.5">
              <div className="hud-label">Рекорд</div>
              <div className="font-display text-2xl text-gold tabular-nums sm:text-3xl">
                {hud.best.toLocaleString("ru-RU")}
              </div>
            </div>
            {hud.coins > 0 && (
              <div className="hud-chip px-4 py-2 sm:px-6 sm:py-2.5">
                <div className="hud-label">Монеты</div>
                <div className="font-display text-2xl text-gold tabular-nums sm:text-3xl">
                  {hud.coins}
                </div>
              </div>
            )}
          </div>

          {hud.scoreBreakdown && <ScoreBreakdownTable breakdown={hud.scoreBreakdown} />}

          {topSubmit}

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button className="btn-arcade px-8 py-3 text-base sm:text-lg" onClick={onRestart}>
              Сыграть снова
            </button>
            <button className="btn-ghost px-6 py-3 text-base" onClick={onMenu}>
              В меню
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto p-6">
      <div className="anim-pop my-auto w-full max-w-lg text-center">
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
        {hud.scoreBreakdown && <ScoreBreakdownTable breakdown={hud.scoreBreakdown} />}
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
