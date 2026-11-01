import { useEffect } from "react"

import { CAMPAIGN_MODIFIERS_MAP } from "../../game/campaignModifiers"
import { DRAFT_MAX_PICKS } from "../../game/endlessDraft"
import type { WaveDraftData } from "../../game/types"

export interface WaveDraftModalProps {
  data: WaveDraftData
  /** Мутатор выбран; `null` — пропустить выбор. */
  onPick: (id: WaveDraftData["options"][number] | null) => void
}

/**
 * Черновик мутаторов бесконечного режима (T-056): после каждой боссовой волны
 * игрок берёт один из трёх мутаторов. Карточки повторяют стиль
 * `CampaignModifiersModal`, но награда бонусов не показывается — в бесконечном
 * режиме мутаторы меняют только правила боя, множители очков не растут.
 */
export function WaveDraftModal({ data, onPick }: WaveDraftModalProps) {
  // Пропуск по Escape: выбор не обязателен, иначе забег встанет навсегда.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onPick(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onPick])

  const takenTitles = data.taken.map((id) => CAMPAIGN_MODIFIERS_MAP[id]?.title ?? id)

  return (
    <div
      data-testid="wave-draft-modal"
      className="absolute inset-0 z-50 flex items-center justify-center bg-abyss/85 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wave-draft-title"
    >
      <div className="hud-chip flex w-full max-w-2xl flex-col border border-purple-500/50 bg-abyss/95 p-4 shadow-[0_0_40px_rgba(168,85,247,0.25)] sm:p-6">
        <div className="flex items-center justify-between border-b border-purple-500/30 pb-3">
          <div>
            <div className="hud-label text-purple-300">СФЕРА-1080 // АДАПТАЦИЯ АРЕНЫ</div>
            <h2
              id="wave-draft-title"
              className="font-display text-xl tracking-wider text-foam sm:text-2xl"
            >
              🧬 МУТАТОР ВОЛНЫ {data.wave}
            </h2>
          </div>
          <span className="rounded border border-purple-500/40 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-200">
            {data.taken.length}/{DRAFT_MAX_PICKS}
          </span>
        </div>

        <p className="mt-2.5 text-xs text-foam/70 sm:text-sm">
          Арена подстроилась под вас. Возьмите одно изменение правил — оно останется до конца
          забега. Очки и рекорды бесконечного режима не меняются.
        </p>

        {takenTitles.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-foam/60">
            <span className="hud-label text-purple-300">УЖЕ ВЗЯТО:</span>
            {takenTitles.map((title) => (
              <span
                key={title}
                className="rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-purple-200"
              >
                {title}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {data.options.map((id) => {
            const mod = CAMPAIGN_MODIFIERS_MAP[id]
            if (!mod) return null
            return (
              <button
                key={id}
                type="button"
                data-testid={`wave-draft-option-${id}`}
                onClick={() => onPick(id)}
                className="flex flex-col rounded-xl border border-purple-500/30 bg-deep/60 p-3 text-left shadow-sm transition-all hover:border-purple-400/70 hover:bg-purple-950/30 active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{mod.icon}</span>
                  <span className="font-display text-sm tracking-wide text-foam">{mod.title}</span>
                </div>
                <p className="mt-1 text-xs text-foam/75">{mod.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-purple-500/20 pt-3">
          <span className="text-[11px] text-foam/50">
            {data.remainingPicks > 0
              ? `Ещё выборов впереди: ${data.remainingPicks}`
              : "Это последний выбор в забеге"}
          </span>
          <button
            type="button"
            className="btn-ghost px-4 py-2 text-xs sm:text-sm"
            onClick={() => onPick(null)}
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  )
}
