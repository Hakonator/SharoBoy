import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../../game/upgrades"
import { IconMusic, IconSound, VolSlider } from "../icons"
import type { HudData } from "../../game/types"

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
