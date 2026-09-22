import { MAX_NICK } from "../../game/profanity"

import type { SubmitState } from "./types"

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
          maxLength={MAX_NICK}
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
