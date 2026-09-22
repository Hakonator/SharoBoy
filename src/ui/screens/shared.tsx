import { useState, type ReactNode } from "react"

import { IconChevron } from "../icons"

/** Короткая метка категории экрана для списка мирового топа «Все». */
export function screenTag(screenClass: string | null | undefined): string | null {
  if (!screenClass) return null
  return screenClass === "mobile"
    ? "моб"
    : screenClass === "fhd"
      ? "FHD"
      : screenClass === "4k"
        ? "4K"
        : null
}

/**
 * Раскрываемая секция меню: свёрнута по умолчанию, чтобы всё важное помещалось
 * в первый экран без прокрутки — и на вертикальном мобильном, и на FHD/4K.
 */
export function MenuSection({
  title,
  badge,
  dot,
  children,
}: {
  title: ReactNode
  badge?: ReactNode
  dot?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="hud-chip">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-white/[0.03] sm:py-3"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="hud-label truncate">{title}</span>
          {dot && (
            <span className="anim-blink h-2 w-2 shrink-0 rounded-full bg-mint shadow-[0_0_8px_rgba(93,255,176,0.9)]" />
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge != null && (
            <span className="font-display text-sm text-gold tabular-nums">{badge}</span>
          )}
          <span
            aria-hidden
            className={`text-dim transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <IconChevron />
          </span>
        </span>
      </button>
      {open && <div className="anim-rise px-4 pb-4">{children}</div>}
    </div>
  )
}
