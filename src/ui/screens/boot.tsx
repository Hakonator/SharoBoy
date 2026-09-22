import type { AchToast } from "./types"

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
