import { useState, useMemo } from "react"

import {
  CAMPAIGN_MODIFIERS,
  computeRunMultipliers,
  loadSelectedModifiers,
  saveSelectedModifiers,
  type CampaignModifierId,
} from "../../game/campaignModifiers"

interface CampaignModifiersModalProps {
  onStart: (modifiers: CampaignModifierId[]) => void
  onClose: () => void
}

/**
 * Модальное окно выбора модификаторов (мутаторов) перед запуском кампании.
 */
export function CampaignModifiersModal({ onStart, onClose }: CampaignModifiersModalProps) {
  const [selected, setSelected] = useState<CampaignModifierId[]>(() => loadSelectedModifiers())

  const { scoreMultiplier, crystalMultiplier } = useMemo(
    () => computeRunMultipliers(selected),
    [selected]
  )

  const toggleModifier = (id: CampaignModifierId) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
      saveSelectedModifiers(next)
      return next
    })
  }

  const handleStartWithModifiers = () => {
    saveSelectedModifiers(selected)
    onStart(selected)
  }

  const handleStartVanilla = () => {
    onStart([])
  }

  const crystalBonusPercent = Math.round((crystalMultiplier - 1) * 100)
  const scoreBonusPercent = Math.round((scoreMultiplier - 1) * 100)

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-abyss/85 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="hud-chip flex w-full max-w-2xl flex-col border border-cyan-neon/40 bg-abyss/95 p-4 shadow-[0_0_40px_rgba(53,224,255,0.25)] sm:p-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-cyan-neon/20 pb-3">
          <div>
            <div className="hud-label text-cyan-neon">НАСТРОЙКА ЗАБЕГА</div>
            <h2 className="font-display text-xl tracking-wider text-foam sm:text-2xl">
              МОДИФИКАТОРЫ КАМПАНИИ
            </h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-foam/60 hover:bg-cyan-neon/10 hover:text-cyan-neon"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-xs text-foam/70 sm:text-sm">
          Включите дополнительные испытания, чтобы проверить свои навыки и приумножить добычу
          кристаллов и очков.
        </p>

        {/* Сетка модификаторов */}
        <div className="my-4 grid max-h-[50vh] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {CAMPAIGN_MODIFIERS.map((mod) => {
            const isChecked = selected.includes(mod.id)
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => toggleModifier(mod.id)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  isChecked
                    ? "border-cyan-neon/80 bg-cyan-neon/15 shadow-[0_0_16px_rgba(53,224,255,0.2)]"
                    : "border-foam/10 bg-deep/40 hover:border-foam/25 hover:bg-deep/70"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">{mod.icon}</span>
                    <span className="font-display text-sm tracking-wide text-foam sm:text-base">
                      {mod.title}
                    </span>
                  </div>
                  <span
                    className={`h-5 w-5 rounded border flex items-center justify-center text-xs font-bold transition-colors ${
                      isChecked
                        ? "border-cyan-neon bg-cyan-neon text-abyss"
                        : "border-foam/30 bg-abyss/60 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-foam/80">{mod.desc}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: `${mod.badgeColor}22`,
                      color: mod.badgeColor,
                      border: `1px solid ${mod.badgeColor}55`,
                    }}
                  >
                    +{(mod.scoreBonus * 100).toFixed(0)}% очков
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold text-purple-300"
                    style={{
                      backgroundColor: "rgba(192, 132, 252, 0.15)",
                      border: "1px solid rgba(192, 132, 252, 0.4)",
                    }}
                  >
                    +{(mod.crystalBonus * 100).toFixed(0)}% 💎
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Итоговая панель множителей */}
        <div className="flex flex-col gap-2 rounded-xl border border-foam/15 bg-abyss/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="hud-label text-mint">ИТОГОВЫЙ МНОЖИТЕЛЬ ЗАБЕГА</div>
            <div className="flex items-center gap-3 font-display text-xs sm:text-sm">
              <span className="text-foam">
                Очки:{" "}
                <b className="text-cyan-neon">
                  ×{scoreMultiplier.toFixed(2)}{" "}
                  {scoreBonusPercent > 0 && `(+${scoreBonusPercent}%)`}
                </b>
              </span>
              <span className="text-foam">
                Кристаллы:{" "}
                <b className="text-purple-300">
                  ×{crystalMultiplier.toFixed(2)}{" "}
                  {crystalBonusPercent > 0 && `(+${crystalBonusPercent}%)`}
                </b>
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost px-3 py-2 text-xs text-foam/70 hover:text-foam"
              onClick={handleStartVanilla}
            >
              БЕЗ МУТАТОРОВ
            </button>
            <button
              type="button"
              className="btn-arcade px-5 py-2 text-sm"
              onClick={handleStartWithModifiers}
            >
              В БОЙ!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
