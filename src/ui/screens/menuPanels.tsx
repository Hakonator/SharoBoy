import type { ReactNode } from "react"

import { ACHIEVEMENTS } from "../../game/achievements"
import type { HudData } from "../../game/types"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../../game/upgrades"
import { IconCoin, IconJelly, IconMusic, IconSettings, IconSound, VolSlider } from "../icons"

import { MenuSection } from "./shared"

/** Угловые контролы меню: музыка и звук с ползунками. */
export function MenuCornerControls({
  hud,
  onMute,
  onMusic,
  onMusicVolume,
  onSfxVolume,
  onSettings,
}: {
  hud: HudData
  onMute: () => void
  onMusic: () => void
  onMusicVolume: (v: number) => void
  onSfxVolume: (v: number) => void
  onSettings?: () => void
}) {
  return (
    <>
      {/* Кнопки музыки, звука и настроек с ползунками громкости — в углу меню */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-5 sm:top-5 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <button
            className="icon-btn pointer-events-auto flex h-10 w-10 items-center justify-center"
            onClick={onMusic}
            aria-label="Музыка"
          >
            <IconMusic off={hud.musicMuted} />
          </button>
          <VolSlider value={hud.musicVolume} onChange={onMusicVolume} label="Громкость музыки" />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="icon-btn pointer-events-auto flex h-10 w-10 items-center justify-center"
            onClick={onMute}
            aria-label="Звук"
          >
            <IconSound off={hud.muted} />
          </button>
          <VolSlider value={hud.sfxVolume} onChange={onSfxVolume} label="Громкость звука" />
        </div>
        {onSettings && (
          <button
            className="icon-btn pointer-events-auto flex h-10 w-10 items-center justify-center text-foam hover:text-cyan-neon"
            onClick={onSettings}
            aria-label="Настройки"
            title="Настройки графики и звука"
          >
            <IconSettings className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  )
}

/** Секция прокачки за монеты. */
export function MenuUpgrades({
  hud,
  onBuyUpgrade,
  asSection = false,
}: {
  hud: HudData
  onBuyUpgrade: (id: string) => void
  asSection?: boolean
}) {
  /** Есть улучшение, которое игрок уже может купить, — индикатор на секции. */
  const canBuyAny = UPGRADE_DEFS.some((u) => {
    const lvl = hud.upgrades[u.id] ?? 0
    return lvl < u.max && hud.coins >= u.cost(lvl)
  })
  if (!UPGRADES_ENABLED) return null

  const content = (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 pb-1 text-xs">
        <span className="text-dim">Постоянные улучшения</span>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1 font-display font-bold text-sky-400"
            title="Несгораемые мета-кристаллы за победу над боссами"
          >
            💠 {(hud.metaCrystals ?? 0).toLocaleString("ru-RU")}
          </span>
          <span className="flex items-center gap-1.5 font-display font-bold text-gold">
            <IconCoin className="h-4 w-4" />
            <span>{hud.coins.toLocaleString("ru-RU")}</span>
          </span>
        </div>
      </div>
      <div className="space-y-1.5">
        {UPGRADE_DEFS.map((u) => {
          const lvl = hud.upgrades[u.id] ?? 0
          const maxed = lvl >= u.max
          const price = maxed ? null : u.cost(lvl)
          const afford = price !== null && hud.coins >= price
          return (
            <div
              key={u.id}
              className={`flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 transition ${
                maxed
                  ? "border-mint/20 bg-mint/[0.03]"
                  : afford
                    ? "border-gold/40 bg-deep/80 hover:border-gold/70 shadow-[0_0_10px_rgba(255,201,77,0.08)]"
                    : "border-line/40 bg-deep/50 opacity-80"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-bold text-foam sm:text-sm">
                    {u.name}
                  </span>
                  <span className="flex items-center gap-1">
                    {Array.from({ length: u.max }, (_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-3.5 rounded-sm transition-all ${
                          i < lvl ? "bg-gold shadow-[0_0_6px_rgba(255,201,77,0.8)]" : "bg-line/60"
                        }`}
                      />
                    ))}
                  </span>
                </div>
                <div
                  className="mt-0.5 truncate text-[11px] leading-tight text-dim/90"
                  title={u.desc}
                >
                  {u.desc}
                </div>
              </div>

              <div className="shrink-0 flex items-center">
                {maxed ? (
                  <span className="rounded border border-mint/30 bg-mint/10 px-2 py-0.5 font-display text-[10px] font-bold text-mint sm:text-xs">
                    МАКС
                  </span>
                ) : (
                  <button
                    disabled={!afford}
                    onClick={() => onBuyUpgrade(u.id)}
                    className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-display text-xs font-bold transition-all ${
                      afford
                        ? "cursor-pointer bg-gold text-abyss shadow-[0_0_10px_rgba(255,201,77,0.4)] hover:scale-105 active:scale-95"
                        : "cursor-not-allowed bg-line/20 text-dim/50 border border-line/30"
                    }`}
                  >
                    <IconCoin className="h-3.5 w-3.5" />
                    <span>{price}</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  if (asSection) {
    return (
      <MenuSection
        title="🛠 Прокачка"
        badge={
          <span className="inline-flex items-center gap-1">
            <IconCoin className="h-3.5 w-3.5" />
            <span>{hud.coins}</span>
          </span>
        }
        dot={canBuyAny}
      >
        {content}
      </MenuSection>
    )
  }

  return content
}

/** Пункт выбора босса в отладке (icon — SVG вместо эмодзи, когда его нет в шрифте). */
interface BossOption {
  id: string
  label: string
  icon?: ReactNode
}

/** Секция отладки: выбор босса и активируемые эффекты. */
export function MenuDebug({
  debug,
  onToggleDebug,
  debugBoss,
  onSelectDebugBoss,
  isDebugEffectActive,
  onToggleDebugEffect,
  onDebugStartGame,
  asSection = false,
}: {
  debug: boolean
  onToggleDebug: () => void
  debugBoss: string
  onSelectDebugBoss: (boss: string) => void
  isDebugEffectActive: (id: string) => boolean
  onToggleDebugEffect: (id: string) => void
  onDebugStartGame: () => void
  asSection?: boolean
}) {
  const content = (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-foam">
        <input
          type="checkbox"
          checked={debug}
          onChange={onToggleDebug}
          className="h-4 w-4 accent-cyan-400"
        />
        Режим отладки
      </label>
      {debug && (
        <>
          {/* Блок 1: выбор босса для тестирования */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-dim">Босс</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "", label: "Нет" },
                  { id: "king", label: "👑 Царь-шар (Акт 1)" },
                  // эмодзи 🪼 есть не во всех шрифтах — используем SVG-иконку
                  {
                    id: "jellyfish",
                    label: "Медуза (Акт 1)",
                    icon: <IconJelly className="h-3.5 w-3.5" />,
                  },
                  { id: "octopus", label: "🐙 Осьминог (Акт 2)" },
                  { id: "crab", label: "🦀 Меха-Краб (Акт 2)" },
                  { id: "kraken", label: "🦑 Кракен (Акт 3)" },
                  { id: "chrono", label: "⏳ Хронос (Акт 3)" },
                  { id: "minibossFish", label: "🐟 Рыба (мини)" },
                  {
                    id: "minibossJelly",
                    label: "Медуза (мини)",
                    icon: <IconJelly className="h-3.5 w-3.5" />,
                  },
                  { id: "specialBlocks", label: "Спецблоки (стенд)" },
                ] as BossOption[]
              ).map((b) => (
                <label
                  key={b.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition ${
                    debugBoss === b.id
                      ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/50"
                      : "bg-white/5 text-foam hover:bg-white/10"
                  }`}
                >
                  <input
                    type="radio"
                    name="debugBoss"
                    value={b.id}
                    checked={debugBoss === b.id}
                    onChange={() => onSelectDebugBoss(b.id)}
                    className="sr-only"
                  />
                  {b.icon}
                  {b.label}
                </label>
              ))}
            </div>
          </div>
          {/* Блок 2: активируемые эффекты (галочки) */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-dim">Эффекты</p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: "paddleRotation",
                  label: "↻ Поворот ракетки",
                  hint: "ЛКМ/ПКМ удержание = ±30°, ускорение мяча (взаимоисключает другие режимы формы)",
                },
                {
                  id: "paddleImpulse",
                  label: "⚡ Импульсный удар",
                  hint: "ЛКМ/ПКМ клик = резкий доворот и возврат (взаимоисключает другие режимы формы)",
                },
                {
                  id: "paddleConvex",
                  label: "∩ Выпуклая ракетка",
                  hint: "Купол: мяч отскакивает веером от центра к краям (взаимоисключает другие режимы формы)",
                },
                {
                  id: "paddleConcave",
                  label: "∪ Вогнутая ракетка",
                  hint: "Чаша: мяч отскакивает от краёв к центру (взаимоисключает другие режимы формы)",
                },
                {
                  id: "aimGuide",
                  label: "┄ Прицел запуска",
                  hint: "Колёсико меняет угол; на таче удерживайте первый палец и ведите вторым",
                },
                {
                  id: "bounceGuide",
                  label: "↗ Отскок прицела",
                  hint: "Показывает участок после первого отражения; работает только с прицелом",
                },
              ].map((e) => (
                <label
                  key={e.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition ${
                    isDebugEffectActive(e.id)
                      ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50"
                      : "bg-white/5 text-foam hover:bg-white/10"
                  }`}
                  title={e.hint}
                >
                  <input
                    type="checkbox"
                    checked={isDebugEffectActive(e.id)}
                    onChange={() => onToggleDebugEffect(e.id)}
                    className="sr-only"
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </div>
          {/* Кнопка запуска уровня */}
          <button className="btn-ghost w-full px-4 py-2 text-sm" onClick={onDebugStartGame}>
            ▶ Запустить уровень
          </button>
        </>
      )}
    </div>
  )

  if (asSection) {
    return (
      <MenuSection title="🐛 Отладка" dot={debug}>
        {content}
      </MenuSection>
    )
  }

  return content
}

/** Сетка достижений с состоянием разблокировки. */
export function MenuAchievements({
  unlocked,
  asSection = false,
}: {
  unlocked: Record<string, number>
  asSection?: boolean
}) {
  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ACHIEVEMENTS.map((d) => {
        const got = !!unlocked[d.id]
        return (
          <div
            key={d.id}
            className={`rounded-lg border p-2 ${
              got ? "border-gold/50 bg-gold/10" : "border-line/50 bg-deep/40 opacity-70"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center text-lg leading-none">
                {got ? d.icon === "🪙" ? <IconCoin className="h-4 w-4" /> : d.icon : "🔒"}
              </span>
              <div className="min-w-0">
                <div className={`font-display text-sm ${got ? "text-gold" : "text-dim"}`}>
                  {d.name}
                </div>
                <div className="truncate text-[11px] text-dim">{d.desc}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (asSection) {
    return (
      <MenuSection
        title="🏅 Достижения"
        badge={`${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}`}
      >
        {content}
      </MenuSection>
    )
  }

  return content
}
