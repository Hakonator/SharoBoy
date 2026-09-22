import { LEADERBOARD_ENABLED } from "../../config"
import type { GlobalScore, LeadPeriod, ScreenFilter } from "../../game/leaderboard"
import type { HudData } from "../../game/types"

import { MenuSection, screenTag } from "./shared"

/** Короткая метка категории экрана для списка мирового топа «Все». */

/** Локальные рекорды: кампания и бесконечный режим (из localStorage). */
export function MenuRecords({ hud }: { hud: HudData }) {
  if (hud.top.length === 0 && hud.topEndless.length === 0) return null
  return (
    <MenuSection
      title="📈 Рекорды"
      badge={hud.best > 0 ? hud.best.toLocaleString("ru-RU") : undefined}
    >
      {hud.top.length > 0 && (
        <div className="mb-3">
          <div className="hud-label mb-2">Кампания</div>
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
                <span className="text-foam tabular-nums">{s.score.toLocaleString("ru-RU")}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {hud.topEndless.length > 0 && (
        <div>
          <div className="hud-label mb-2">Бесконечный</div>
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
                <span className="text-foam tabular-nums">{s.score.toLocaleString("ru-RU")}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </MenuSection>
  )
}

/** Мировой топ: фильтры экрана и периода, два списка (кампания/бесконечный). */
export function MenuGlobalTop({
  period,
  screen,
  globalTop,
  globalTopEndless,
  onPeriod,
  onScreen,
}: {
  period: LeadPeriod
  screen: ScreenFilter
  globalTop: GlobalScore[]
  globalTopEndless: GlobalScore[]
  onPeriod: (p: LeadPeriod) => void
  onScreen: (s: ScreenFilter) => void
}) {
  if (!LEADERBOARD_ENABLED) return null
  return (
    <MenuSection title="🌍 Мировой топ">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="hud-label">Экран</span>
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
      {globalTop.length > 0 && (
        <div className="mb-3">
          <div className="hud-label mb-2">Кампания</div>
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
                {screen === "all" && screenTag(s.screen_class) && (
                  <span className="ml-1.5 shrink-0 text-[10px] text-dim">
                    {screenTag(s.screen_class)}
                  </span>
                )}
                <span className="mx-3 flex-1 border-b border-dotted border-line" />
                <span className="text-foam tabular-nums">{s.score.toLocaleString("ru-RU")}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {globalTopEndless.length > 0 && (
        <div>
          <div className="hud-label mb-2">Бесконечный</div>
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
                {s.wave > 0 && <span className="ml-1.5 text-[10px] text-dim">волна {s.wave}</span>}
                {screen === "all" && screenTag(s.screen_class) && (
                  <span className="ml-1.5 shrink-0 text-[10px] text-dim">
                    {screenTag(s.screen_class)}
                  </span>
                )}
                <span className="mx-3 flex-1 border-b border-dotted border-line" />
                <span className="text-foam tabular-nums">{s.score.toLocaleString("ru-RU")}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {globalTop.length === 0 && globalTopEndless.length === 0 && (
        <div className="text-xs text-dim">Записей пока нет — сыграйте партию и попадите в топ!</div>
      )}
    </MenuSection>
  )
}
