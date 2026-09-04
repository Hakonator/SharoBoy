/**
 * Оверлейные экраны игры: заставки и HUD как чистые компоненты на пропсах.
 * Логика состояния и побочных эффектов остаётся в App (оркестратор).
 */
import { type ReactNode } from "react"

import { LEADERBOARD_ENABLED } from "../config"
import type { AchievementDef } from "../game/achievements"
import { ACHIEVEMENTS } from "../game/achievements"
import type { GlobalScore, LeadPeriod, ScreenFilter } from "../game/leaderboard"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../game/upgrades"
import type { HudData } from "../game/types"

import {
  IconBall,
  IconPlay,
  IconPause,
  IconSound,
  Key,
  EffectChip,
  ControlsPanel,
  FloatingBalls,
} from "./icons"

/** Личная статистика игрока (из localStorage). */
export interface PlayerStats {
  games: number
  wins: number
  bestScore: number
  bestWave: number
  topLevel: number
}

export interface AchToast {
  key: number
  def: AchievementDef
}

export type SubmitState = "idle" | "sending" | "done" | "error"

export function BootErrorScreen({ error, onReload }: { error: string; onReload: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-abyss p-6">
      <div className="hud-chip max-w-xl p-6">
        <div className="hud-label mb-2">Сбой инициализации движка</div>
        <pre className="whitespace-pre-wrap break-words font-mono text-sm text-coral">{error}</pre>
        <button className="btn-ghost mt-5 px-6 py-2.5" onClick={onReload}>
          Перезагрузить
        </button>
      </div>
    </div>
  )
}

export function AchToasts({ toasts }: { toasts: AchToast[] }) {
  if (!toasts.length) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-14 z-50 flex w-full max-w-xs -translate-x-1/2 flex-col gap-2 px-4 sm:max-w-sm sm:top-16">
      {toasts.map((t) => (
        <div
          key={t.key}
          className="anim-pop rounded-xl border-2 border-gold/70 bg-deep/95 px-4 py-2.5 text-center shadow-[0_0_32px_rgba(255,201,77,0.28)]"
        >
          <div className="hud-label text-gold">🏅 Достижение открыто</div>
          <div className="font-display text-lg leading-tight text-foam">
            {t.def.icon} {t.def.name}
          </div>
          <div className="text-xs text-dim">{t.def.desc}</div>
        </div>
      ))}
    </div>
  )
}

/** Форма «попасть в мировой топ» — на экранах поражения и победы. */
export function TopSubmitForm({
  state,
  error,
  nick,
  onNickChange,
  onSubmit,
}: {
  state: SubmitState
  error: string | null
  nick: string
  onNickChange: (v: string) => void
  onSubmit: () => void
}) {
  if (state === "done") {
    return (
      <div className="hud-chip px-4 py-2.5 text-center font-display text-sm text-mint">
        Записано в мировой топ! ✓
      </div>
    )
  }
  return (
    <div className="hud-chip p-4 text-left">
      <div className="hud-label mb-2">🌍 Попасть в мировой топ</div>
      <div className="flex gap-2">
        <input
          value={nick}
          maxLength={16}
          placeholder="Ваш ник"
          onChange={(e) => onNickChange(e.target.value)}
          onKeyDown={(e) => {
            /* не даём движку ловить пробел/латиницу как управление */
            e.stopPropagation()
            if (e.key === "Enter") {
              e.preventDefault()
              onSubmit()
            }
          }}
          className="h-10 min-w-0 flex-1 border border-line bg-deep px-3 font-display text-sm text-foam outline-none placeholder:text-dim/60 focus:border-cyan-neon"
        />
        <button
          className="btn-arcade px-4 py-2 text-sm"
          onClick={onSubmit}
          disabled={state === "sending" || nick.trim().length === 0}
        >
          {state === "sending" ? "…" : "В топ!"}
        </button>
      </div>
      {state === "error" && error && <div className="mt-2 text-xs text-coral">{error}</div>}
    </div>
  )
}

/** Оборачивает форму топа в контейнер экрана (если она вообще разрешена). */
export function TopSubmit({
  show,
  ...formProps
}: {
  show: boolean
  state: SubmitState
  error: string | null
  nick: string
  onNickChange: (v: string) => void
  onSubmit: () => void
}) {
  if (!show) return null
  return (
    <div className="mx-auto mt-4 w-full max-w-md">
      <TopSubmitForm {...formProps} />
    </div>
  )
}

/** Наложение во время игры: верхний HUD-бар, цели на мобильных, эффекты, подсказки, баннер. */
export function HudOverlay({
  hud,
  inGame,
  onPause,
  onMute,
}: {
  hud: HudData
  inGame: boolean
  onPause: () => void
  onMute: () => void
}) {
  return (
    <>
      {inGame && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 sm:p-4">
          <div className="flex flex-wrap items-start gap-2">
            <div className="hud-chip px-3.5 py-2">
              <div className="hud-label">Счёт</div>
              <div className="font-display text-xl leading-none text-foam tabular-nums sm:text-2xl">
                {hud.score.toLocaleString("ru-RU")}
              </div>
            </div>
            <div className="hud-chip hidden px-3.5 py-2 sm:block">
              <div className="hud-label">Рекорд</div>
              <div className="font-display text-xl leading-none text-gold tabular-nums sm:text-2xl">
                {hud.best.toLocaleString("ru-RU")}
              </div>
            </div>
            {hud.combo >= 2 && (
              <div key={`combo-${hud.combo}`} className="hud-chip anim-combo px-3.5 py-2">
                <div className="hud-label">Серия</div>
                <div className="font-display text-xl leading-none text-punch sm:text-2xl">
                  ×{hud.combo}
                </div>
              </div>
            )}
            {hud.coins > 0 && (
              <div className="hud-chip px-3.5 py-2">
                <div className="hud-label">Монеты</div>
                <div className="font-display text-xl leading-none text-gold tabular-nums sm:text-2xl">
                  {hud.coins}
                </div>
              </div>
            )}
            {hud.shield > 0 && (
              <div key={`shield-${hud.shield}`} className="hud-chip anim-combo px-3.5 py-2">
                <div className="hud-label">Щит</div>
                <div className="mt-1 flex gap-1">
                  {Array.from({ length: hud.shield }).map((_, i) => (
                    <span
                      key={i}
                      className="h-3.5 w-3.5 rounded-full bg-[#4dff9e] shadow-[0_0_8px_rgba(77,255,158,0.8)]"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hud-chip stripe-hazard hidden px-5 py-2 text-center md:block">
            <div className="hud-label">
              {hud.mode === "endless"
                ? `Волна ${hud.wave} · ∞`
                : `Уровень ${hud.level}/${hud.levelCount} · ${hud.levelName}`}
            </div>
            <div className="font-display text-lg leading-tight text-cyan-neon">
              ЦЕЛИ: <span className="text-foam tabular-nums">{hud.blocksLeft}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="hud-chip px-3.5 py-2">
              <div className="hud-label">Жизни</div>
              <div className="mt-1 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconBall
                    key={i}
                    color="#35e0ff"
                    className={`h-4 w-4 ${i < hud.lives ? "opacity-100" : "opacity-20 grayscale"}`}
                  />
                ))}
              </div>
            </div>
            <button
              className="icon-btn pointer-events-auto flex h-10 w-10 items-center justify-center"
              onClick={onPause}
              aria-label="Пауза"
            >
              {hud.phase === "paused" ? <IconPlay /> : <IconPause />}
            </button>
            <button
              className="icon-btn pointer-events-auto flex h-10 w-10 items-center justify-center"
              onClick={onMute}
              aria-label="Звук"
            >
              <IconSound off={hud.muted} />
            </button>
          </div>
        </div>
      )}
      {inGame && (
        <div className="pointer-events-none absolute left-1/2 top-[68px] z-20 -translate-x-1/2 md:hidden">
          <div className="hud-chip px-3 py-1 font-display text-xs text-cyan-neon">
            {hud.mode === "endless" ? `ВОЛНА ${hud.wave}` : `УР. ${hud.level}/${hud.levelCount}`} ·
            ЦЕЛИ {hud.blocksLeft}
          </div>
        </div>
      )}

      {inGame &&
        (hud.wideOn || hud.slowOn || hud.fastOn || hud.shrinkOn || hud.magnetOn || hud.fireOn) && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[46vw] flex-wrap gap-1.5 sm:bottom-4 sm:left-4">
            {hud.wideOn && <EffectChip label="ШИРЕ" good />}
            {hud.fireOn && <EffectChip label="ОГНЬ" good />}
            {hud.magnetOn && <EffectChip label="МАГНИТ" good />}
            {hud.slowOn && <EffectChip label="МЕДЛЕННЕЕ" good />}
            {hud.fastOn && <EffectChip label="БЫСТРЕЕ" good={false} />}
            {hud.shrinkOn && <EffectChip label="УЗКАЯ" good={false} />}
          </div>
        )}

      {hud.phase === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[96px] z-20 flex flex-col items-center gap-2 sm:bottom-[102px]">
          {hud.laserArmed && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-[#9df2ff]">
              ЛАЗЕР ГОТОВ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.rocketOn && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-mint">
              РАКЕТЫ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.stuck && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-cyan-neon">
              ТАП / КЛИК / ПРОБЕЛ — ЗАПУСК
            </div>
          )}
        </div>
      )}

      {hud.banner && inGame && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="anim-banner px-6 text-center">
            <div
              className="font-display text-3xl tracking-wide text-foam sm:text-5xl"
              style={{ textShadow: "0 0 24px rgba(53,224,255,0.8), 0 4px 0 rgba(4,18,26,0.9)" }}
            >
              {hud.banner}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
/** Главное меню: заголовок, кнопки запуска, панель рекордов, достижения, прокачка. */
export function MenuScreen({
  hud,
  stats,
  nick,
  period,
  screen,
  globalTop,
  globalTopEndless,
  unlocked,
  topSubmit,
  onNickChange,
  onPeriod,
  onScreen,
  onCampaign,
  onEndless,
  onBuyUpgrade,
}: {
  hud: HudData
  stats: PlayerStats
  nick: string
  period: LeadPeriod
  screen: ScreenFilter
  globalTop: GlobalScore[]
  globalTopEndless: GlobalScore[]
  unlocked: Record<string, number>
  topSubmit: ReactNode
  onNickChange: (v: string) => void
  onPeriod: (p: LeadPeriod) => void
  onScreen: (s: ScreenFilter) => void
  onCampaign: () => void
  onEndless: () => void
  onBuyUpgrade: (id: string) => void
}) {
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto">
      <FloatingBalls />
      <div className="relative flex min-h-full flex-col items-start justify-center gap-8 p-6 md:flex-row md:items-center md:gap-16 md:p-16 lg:p-24">
        <div className="anim-rise max-w-xl">
          <h1 className="font-display leading-[0.95]">
            <span className="title-glow block text-6xl text-foam sm:text-7xl lg:text-8xl">
              ШАРО
            </span>
            <span className="title-glow block text-6xl text-cyan-neon sm:text-7xl lg:text-8xl">
              БОЙ<span className="text-punch">!</span>
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-foam/80 sm:text-lg">
            Вместо кирпичей — <b className="text-mint">шары</b> и <b className="text-gold">овалы</b>{" "}
            разной величины. Отбивай ракеткой, собирай серии, лови бонусы, одолей{" "}
            <b className="text-cyan-neon">4 уровня с боссом</b> — или выживай в{" "}
            <b className="text-punch">бесконечных волнах</b>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button className="btn-arcade px-8 py-4 text-lg sm:text-xl" onClick={onCampaign}>
              Кампания
            </button>
            <button
              className="btn-ghost px-6 py-4 font-display text-base sm:text-lg"
              onClick={onEndless}
            >
              Бесконечный
            </button>
            {hud.best > 0 && (
              <div className="hud-chip px-4 py-3">
                <div className="hud-label">Рекорд</div>
                <div className="font-display text-xl text-gold tabular-nums">
                  {hud.best.toLocaleString("ru-RU")}
                </div>
              </div>
            )}
          </div>

          {/* Ник доступен всегда — он подписывает и локальные рекорды,
              и отправку в мировой топ (не зависит от подключения Supabase). */}
          <div className="hud-chip mt-4 w-full max-w-64 p-3">
            <div className="hud-label mb-2">Ник для рекордов</div>
            <input
              value={nick}
              maxLength={16}
              placeholder="Без ника"
              onChange={(e) => onNickChange(e.target.value)}
              onKeyDown={(e) => {
                /* не даём движку ловить пробел/латиницу как управление */
                e.stopPropagation()
              }}
              className="h-10 w-full border border-line bg-deep px-3 font-display text-sm text-foam outline-none placeholder:text-dim/60 focus:border-cyan-neon"
            />
          </div>

          <div className="mt-7 flex flex-wrap gap-2 text-xs text-dim">
            <span className="hud-chip px-3 py-1.5">
              <b className="text-mint">зелёные</b> — 1 удар
            </span>
            <span className="hud-chip px-3 py-1.5">
              <b className="text-gold">жёлтые</b> — 2 удара
            </span>
            <span className="hud-chip px-3 py-1.5">
              <b className="text-coral">красные</b> — 3 удара
            </span>
            <span className="hud-chip px-3 py-1.5">
              <b className="text-mint">с шариками внутри</b> — рассыпаются
            </span>
          </div>
        </div>

        <div className="anim-rise w-full max-w-sm" style={{ animationDelay: "0.12s" }}>
          {topSubmit}
          {hud.top.length > 0 && (
            <div className="hud-chip mb-3 p-4 sm:p-5">
              <div className="hud-label mb-3">Рекорды кампании</div>
              <ol className="space-y-1.5">
                {hud.top.map((s, i) => (
                  <li key={`${s.score}-${i}`} className="flex items-center font-display text-sm">
                    <span
                      className={
                        i === 0
                          ? "text-gold"
                          : i === 1
                            ? "text-foam"
                            : i === 2
                              ? "text-coral"
                              : "text-dim"
                      }
                    >
                      {i + 1}.
                    </span>
                    <span className="ml-2 min-w-0 truncate text-foam">{s.nick || "—"}</span>
                    <span className="mx-3 flex-1 border-b border-dotted border-line" />
                    <span className="text-foam tabular-nums">
                      {s.score.toLocaleString("ru-RU")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {hud.topEndless.length > 0 && (
            <div className="hud-chip mb-3 p-4 sm:p-5">
              <div className="hud-label mb-3">Рекорды — бесконечный</div>
              <ol className="space-y-1.5">
                {hud.topEndless.map((s, i) => (
                  <li key={`e-${s.score}-${i}`} className="flex items-center font-display text-sm">
                    <span
                      className={
                        i === 0
                          ? "text-gold"
                          : i === 1
                            ? "text-foam"
                            : i === 2
                              ? "text-coral"
                              : "text-dim"
                      }
                    >
                      {i + 1}.
                    </span>
                    <span className="ml-2 min-w-0 truncate text-foam">{s.nick || "—"}</span>
                    <span className="mx-3 flex-1 border-b border-dotted border-line" />
                    <span className="text-foam tabular-nums">
                      {s.score.toLocaleString("ru-RU")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {stats.games > 0 && (
            <div className="hud-chip mb-3 p-4 sm:p-5">
              <div className="hud-label mb-3">👤 Моя статистика</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                <div>
                  <div className="hud-label">Игр</div>
                  <div className="font-display text-xl text-foam tabular-nums">{stats.games}</div>
                </div>
                <div>
                  <div className="hud-label">Побед</div>
                  <div className="font-display text-xl text-mint tabular-nums">{stats.wins}</div>
                </div>
                <div>
                  <div className="hud-label">Лучший счёт</div>
                  <div className="font-display text-xl text-gold tabular-nums">
                    {stats.bestScore.toLocaleString("ru-RU")}
                  </div>
                </div>
                <div>
                  <div className="hud-label">{stats.bestWave > 0 ? "Лучшая волна" : "Уровень"}</div>
                  <div className="font-display text-xl text-cyan-neon tabular-nums">
                    {stats.bestWave > 0 ? stats.bestWave : stats.topLevel}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="hud-chip mb-3 p-4 sm:p-5">
            <div className="hud-label mb-3">
              🏅 Достижения — {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ACHIEVEMENTS.map((d) => {
                const got = !!unlocked[d.id]
                return (
                  <div
                    key={d.id}
                    className={`rounded-lg border p-2.5 ${
                      got ? "border-gold/50 bg-gold/10" : "border-line/50 bg-deep/40 opacity-70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{got ? d.icon : "🔒"}</span>
                      <div className="min-w-0">
                        <div className={`font-display text-sm ${got ? "text-gold" : "text-dim"}`}>
                          {d.name}
                        </div>
                        <div className="truncate text-xs text-dim">{d.desc}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {LEADERBOARD_ENABLED && (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="hud-label">🌍 Мировой топ</span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["all", "Все"],
                      ["mobile", "📱 Моб"],
                      ["fhd", "🖥 FHD"],
                      ["4k", "4K"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => onScreen(value)}
                      className={`rounded border px-2 py-0.5 font-display text-[11px] transition ${
                        screen === value
                          ? "border-cyan-neon/60 bg-cyan-neon/15 text-cyan-neon"
                          : "border-line/60 bg-deep/50 text-dim hover:text-foam"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="hud-label">Период</span>
                <div className="flex gap-1">
                  {(["day", "month", "all"] as LeadPeriod[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => onPeriod(p)}
                      className={`rounded border px-2 py-0.5 font-display text-[11px] transition ${
                        period === p
                          ? "border-cyan-neon/60 bg-cyan-neon/15 text-cyan-neon"
                          : "border-line/60 bg-deep/50 text-dim hover:text-foam"
                      }`}
                    >
                      {p === "day" ? "День" : p === "month" ? "Месяц" : "Всё время"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {LEADERBOARD_ENABLED && globalTop.length > 0 && (
            <div className="hud-chip mb-3 p-4 sm:p-5">
              <div className="hud-label mb-3">🌍 Мировой топ — кампания</div>
              <ol className="space-y-1.5">
                {globalTop.map((s, i) => (
                  <li key={`g-${i}`} className="flex items-center font-display text-sm">
                    <span
                      className={
                        i === 0
                          ? "text-gold"
                          : i === 1
                            ? "text-foam"
                            : i === 2
                              ? "text-coral"
                              : "text-dim"
                      }
                    >
                      {i + 1}.
                    </span>
                    <span className="ml-2 min-w-0 truncate text-foam">{s.nick}</span>
                    <span className="mx-3 flex-1 border-b border-dotted border-line" />
                    <span className="text-foam tabular-nums">
                      {s.score.toLocaleString("ru-RU")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {LEADERBOARD_ENABLED && globalTopEndless.length > 0 && (
            <div className="hud-chip mb-3 p-4 sm:p-5">
              <div className="hud-label mb-3">🌍 Мировой топ — бесконечный</div>
              <ol className="space-y-1.5">
                {globalTopEndless.map((s, i) => (
                  <li key={`ge-${i}`} className="flex items-center font-display text-sm">
                    <span
                      className={
                        i === 0
                          ? "text-gold"
                          : i === 1
                            ? "text-foam"
                            : i === 2
                              ? "text-coral"
                              : "text-dim"
                      }
                    >
                      {i + 1}.
                    </span>
                    <span className="ml-2 min-w-0 truncate text-foam">{s.nick}</span>
                    {s.wave > 0 && (
                      <span className="ml-1.5 text-[10px] text-dim">волна {s.wave}</span>
                    )}
                    <span className="mx-3 flex-1 border-b border-dotted border-line" />
                    <span className="text-foam tabular-nums">
                      {s.score.toLocaleString("ru-RU")}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {UPGRADES_ENABLED && (
            <div className="hud-chip mb-3 p-4 sm:p-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="hud-label">🛠 Прокачка</span>
                <span className="font-display text-lg text-gold tabular-nums">🪙 {hud.coins}</span>
              </div>
              <div className="space-y-2">
                {UPGRADE_DEFS.map((u) => {
                  const lvl = hud.upgrades[u.id] ?? 0
                  const maxed = lvl >= u.max
                  const price = maxed ? null : u.cost(lvl)
                  const afford = price !== null && hud.coins >= price
                  return (
                    <div
                      key={u.id}
                      className="flex items-center gap-2.5 rounded border border-line/60 bg-deep/70 px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm text-foam">{u.name}</div>
                        <div className="text-[11px] leading-tight text-dim">{u.desc}</div>
                        <div className="mt-1 flex items-center gap-1">
                          {Array.from({ length: u.max }, (_, i) => (
                            <span
                              key={i}
                              className={`h-2 w-5 rounded-sm ${i < lvl ? "bg-gold" : "bg-line/60"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-sm text-gold tabular-nums">
                          {maxed ? "МАКС" : price}
                        </div>
                        {!maxed && !afford && (
                          <div className="text-[10px] text-coral">не хватает</div>
                        )}
                        {!maxed && afford && (
                          <button
                            className="mt-1 rounded bg-gold/90 px-2 py-0.5 font-display text-xs text-deep transition hover:bg-gold active:scale-95"
                            onClick={() => onBuyUpgrade(u.id)}
                          >
                            🪙 Купить
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <ControlsPanel />
          <div className="hud-chip mt-3 p-4">
            <div className="hud-label mb-2">Бонусы</div>
            <div className="flex flex-col gap-1.5 text-xs text-dim">
              <span>
                <b className="text-[#4dff9e]">«ШИР»</b> — широкая ракетка
              </span>
              <span>
                <b className="text-[#4dff9e]">«×3»</b> — тройной шар
              </span>
              <span>
                <b className="text-[#4dff9e]">«+1»</b> — жизнь
              </span>
              <span>
                <b className="text-[#4dff9e]">«МАГ»</b> — магнит шара
              </span>
              <span>
                <b className="text-[#4dff9e]">«ОГНЬ»</b> — прожигает блоки
              </span>
              <span>
                <b className="text-[#4dff9e]">«ЩИТ/ЛАЗ/РКТ»</b> — экран и оружие
              </span>
              <span>
                <b className="text-[#4dff9e]">«ЛАЗ»</b> — луч на 2 с, выстрел — пробел
              </span>
              <span>
                <b className="text-coral">«СК↑/УЗК»</b> — анти-бонусы
              </span>
            </div>
            <div className="mt-3 border-t border-line pt-2.5 text-xs text-dim">
              Тёмные <b className="text-coral">бомбы с фитилём</b> детонируют по площади — собирай
              цепочки!
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
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
