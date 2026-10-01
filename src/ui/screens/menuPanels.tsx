import type { ReactNode } from "react"

import { ACHIEVEMENTS } from "../../game/achievements"
import type { HudData } from "../../game/types"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../../game/upgrades"
import { IconJelly, IconMusic, IconSound, VolSlider } from "../icons"

import { MenuSection } from "./shared"

/** Угловые контролы меню: музыка и звук с ползунками. */
export function MenuCornerControls({
  hud,
  onMute,
  onMusic,
  onMusicVolume,
  onSfxVolume,
}: {
  hud: HudData
  onMute: () => void
  onMusic: () => void
  onMusicVolume: (v: number) => void
  onSfxVolume: (v: number) => void
}) {
  return (
    <>
      {/* Кнопки музыки и звука с ползунками громкости — в углу меню */}
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
      </div>
    </>
  )
}

/** Секция прокачки за монеты. */
export function MenuUpgrades({
  hud,
  onBuyUpgrade,
}: {
  hud: HudData
  onBuyUpgrade: (id: string) => void
}) {
  /** Есть улучшение, которое игрок уже может купить, — индикатор на секции. */
  const canBuyAny = UPGRADE_DEFS.some((u) => {
    const lvl = hud.upgrades[u.id] ?? 0
    return lvl < u.max && hud.coins >= u.cost(lvl)
  })
  if (!UPGRADES_ENABLED) return null
  return (
    <MenuSection title="🛠 Прокачка" badge={`🪙 ${hud.coins}`} dot={canBuyAny}>
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
                {!maxed && !afford && <div className="text-[10px] text-coral">не хватает</div>}
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
    </MenuSection>
  )
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
}: {
  debug: boolean
  onToggleDebug: () => void
  debugBoss: string
  onSelectDebugBoss: (boss: string) => void
  isDebugEffectActive: (id: string) => boolean
  onToggleDebugEffect: (id: string) => void
  onDebugStartGame: () => void
}) {
  return (
    <MenuSection title="🐛 Отладка" dot={debug}>
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
                    { id: "octopus", label: "🐙 Осьминог" },
                    { id: "kraken", label: "🦑 Кракен" },
                    // эмодзи 🪼 есть не во всех шрифтах — используем SVG-иконку
                    {
                      id: "jellyfish",
                      label: "Медуза (босс)",
                      icon: <IconJelly className="h-3.5 w-3.5" />,
                    },
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
    </MenuSection>
  )
}

/** Сетка достижений с состоянием разблокировки. */
export function MenuAchievements({ unlocked }: { unlocked: Record<string, number> }) {
  return (
    <MenuSection
      title="🏅 Достижения"
      badge={`${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}`}
    >
      <div className="grid grid-cols-2 gap-2">
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
                <span className="text-lg leading-none">{got ? d.icon : "🔒"}</span>
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
    </MenuSection>
  )
}
