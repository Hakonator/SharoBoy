/**
 * Иконки и мелкие самодостаточные UI-элементы (без состояния и зависимостей).
 */
import type { ReactNode } from "react"

import type { BossVariantKind } from "../game/bossVariants"

export function IconPause() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.4" />
      <rect x="14" y="5" width="4" height="14" rx="1.4" />
    </svg>
  )
}

export function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.52.86l10.4-6.5a1 1 0 0 0 0-1.72L9.52 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  )
}

export function IconSound({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {off ? (
        <path
          d="m16.5 9.5 5 5m0-5-5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  )
}

/** Нота — кнопка фоновой музыки; перечёркнута, когда музыка выключена. */
export function IconMusic({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M9 19a3 3 0 1 1-2-2.83V6.5a1 1 0 0 1 .76-.97l9-2.25A1 1 0 0 1 18 4.25v11a3 3 0 1 1-2-2.83V7.53l-7 1.75V19Z" />
      {off && <path d="m4 4 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  )
}

/** Иконка шестерёнки для настроек. */
export function IconSettings({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

/** Маленький ползунок уровня громкости — стоит рядом с иконкой музыки/звука.
 *  Значение 0..1 приходит из HUD, onChange вызывается при перетаскивании. */
export function VolSlider({
  value,
  onChange,
  label,
  className = "",
}: {
  value: number
  onChange: (v: number) => void
  label: string
  className?: string
}) {
  const pct = Math.round(value * 100)
  return (
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={pct}
      onChange={(e) => onChange(Number(e.target.value) / 100)}
      aria-label={label}
      title={`${label}: ${pct}%`}
      className={`vol-slider pointer-events-auto ${className}`}
    />
  )
}

export function IconMouse() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="7" y="3" width="10" height="18" rx="5" />
      <path d="M12 7v3" strokeLinecap="round" />
    </svg>
  )
}

export function IconBall({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className}>
      <defs>
        <radialGradient id={`g-${color.replace("#", "")}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <circle cx="10" cy="10" r="8.5" fill={`url(#g-${color.replace("#", "")})`} />
    </svg>
  )
}

/**
 * Иконки существ карты кампании — единый неоновый силуэтный стиль: цветное
 * тело, блик, тёмный глаз с искрой (вместо эмодзи, которые на части систем
 * отображаются квадратами). Цвета — палитра игры.
 */

/** Рыба-минибосс (источник жизни) — cyan. */
export function IconFish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M13.4 10 18 6.7c-.25 2.2-.25 4.4 0 6.6L13.4 10Z" fill="#1fb9d6" />
      <ellipse cx="8.1" cy="10" rx="5.7" ry="3.8" fill="#35e0ff" />
      <path d="M8.4 6.3c1.1-.1 2.2.2 3.1.9-1 .6-2.1.9-3.2.8-.3-.5-.3-1.2.1-1.7Z" fill="#1fb9d6" />
      <ellipse cx="8.6" cy="11.5" rx="4.2" ry="1.5" fill="#9deeff" opacity="0.45" />
      <circle cx="5.4" cy="9" r="0.95" fill="rgba(4,18,26,0.92)" />
      <circle cx="5.7" cy="8.7" r="0.3" fill="#eafcff" />
    </svg>
  )
}

/** Медуза-минибосс (источник жизни) — pink, купол и волнистые щупальца. */
export function IconJelly({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M3.6 11.2C3.6 7 6.4 4.2 10 4.2s6.4 2.8 6.4 7c-2.1.9-4.2 1.3-6.4 1.3s-4.3-.4-6.4-1.3Z"
        fill="#ff5ca8"
      />
      <ellipse cx="10" cy="9.2" rx="3.6" ry="1.7" fill="#ffa9cd" opacity="0.5" />
      <g fill="none" stroke="#ff8ac2" strokeWidth="1.3" strokeLinecap="round">
        <path d="M5.6 12.4c-.5 1.4-1.4 1.9-1.2 3.4" />
        <path d="M8.6 12.8c-.3 1.4.6 2 .4 3.5" />
        <path d="M11.4 12.8c.3 1.4-.6 2-.4 3.5" />
        <path d="M14.4 12.4c.5 1.4 1.4 1.9 1.2 3.4" />
      </g>
    </svg>
  )
}

/** Осьминог — финальный босс глубин: купол-голова с глазами и кудрявые щупальца. */
export function IconOctopus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M10 2.8c3.7 0 6.3 2.7 6.3 6 0 1.5-.5 2.8-1.2 3.7H4.9c-.7-.9-1.2-2.2-1.2-3.7 0-3.3 2.6-6 6.3-6Z"
        fill="#ff6a5c"
      />
      <ellipse cx="7.9" cy="5.6" rx="2.4" ry="1.1" fill="#ffb0a6" opacity="0.5" />
      <g fill="none" stroke="#ff6a5c" strokeWidth="1.5" strokeLinecap="round">
        <path d="M4.9 12.6c-.6 1.6-2.2 1.9-1.9 3.6" />
        <path d="M8.3 12.8c-.3 1.6.8 2.1.5 3.8" />
        <path d="M11.7 12.8c.3 1.6-.8 2.1-.5 3.8" />
        <path d="M15.1 12.6c.6 1.6 2.2 1.9 1.9 3.6" />
      </g>
      <circle cx="7.6" cy="8.7" r="0.95" fill="rgba(4,18,26,0.92)" />
      <circle cx="12.4" cy="8.7" r="0.95" fill="rgba(4,18,26,0.92)" />
      <circle cx="7.9" cy="8.4" r="0.3" fill="#ffe9e6" />
      <circle cx="12.7" cy="8.4" r="0.3" fill="#ffe9e6" />
    </svg>
  )
}

/** Царь-шар / Механический Страж — золото, корона и орбитальное ядро. */
export function IconKing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      {/* Корона */}
      <path d="M5.5 8.5 6.8 4.2 10 6.6l3.2-2.4 1.3 4.3Z" fill="#fbbf24" />
      <circle cx="6.8" cy="4.2" r="0.8" fill="#fef08a" />
      <circle cx="10" cy="6.6" r="0.8" fill="#fef08a" />
      <circle cx="13.2" cy="4.2" r="0.8" fill="#fef08a" />
      {/* Золотой шар-ядро */}
      <circle cx="10" cy="12" r="5.5" fill="#f59e0b" />
      <ellipse cx="8.6" cy="10" rx="2.5" ry="1.2" fill="#fef08a" opacity="0.6" />
      {/* Центральное синее механическое око */}
      <circle cx="10" cy="12" r="1.8" fill="rgba(4,18,26,0.92)" />
      <circle cx="10" cy="12" r="0.9" fill="#38bdf8" />
      <circle cx="10.4" cy="11.6" r="0.3" fill="#ffffff" />
    </svg>
  )
}

/** Меха-Краб — оранжевый панцирь, глаза-стебельки и пружинящие клешни. */
export function IconCrab({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      {/* Глаза-стебельки */}
      <path d="M8 8V4.8M12 8V4.8" stroke="#ea580c" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="4.5" r="1.2" fill="#fdba74" />
      <circle cx="12" cy="4.5" r="1.2" fill="#fdba74" />
      <circle cx="8" cy="4.5" r="0.6" fill="rgba(4,18,26,0.92)" />
      <circle cx="12" cy="4.5" r="0.6" fill="rgba(4,18,26,0.92)" />
      {/* Клешни */}
      <path
        d="M4.5 9.5C2.5 7.5 2.5 5 4 4c.8 1.4 1.5 2.8 1.5 4.5M15.5 9.5C17.5 7.5 17.5 5 16 4c-.8 1.4-1.5 2.8-1.5 4.5"
        fill="none"
        stroke="#f97316"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Панцирь */}
      <ellipse cx="10" cy="12" rx="6" ry="4.5" fill="#ea580c" />
      <ellipse cx="10" cy="10.8" rx="3.8" ry="1.6" fill="#fdba74" opacity="0.45" />
      {/* Механическая ухмылка */}
      <path
        d="M7.5 13.5q2.5 1.5 5 0"
        fill="none"
        stroke="rgba(4,18,26,0.85)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Кракен — глубокий пурпур, 8 щупалец и всевидящее око Бездны. */
export function IconKraken({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      {/* Щупальца */}
      <g fill="none" stroke="#a855f7" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3.5 12.5c-.8 1.8-2.2 2.2-1.8 4.2" />
        <path d="M6 13.2c-.5 1.8.4 2.4.2 4.1" />
        <path d="M8.7 13.6c-.2 1.6.3 2.5.1 3.9" />
        <path d="M11.3 13.6c.2 1.6-.3 2.5-.1 3.9" />
        <path d="M14 13.2c.5 1.8-.4 2.4-.2 4.1" />
        <path d="M16.5 12.5c.8 1.8 2.2 2.2 1.8 4.2" />
      </g>
      {/* Голова Кракена */}
      <path
        d="M10 2.2c4.2 0 7 3.2 7 7.2 0 1.8-.6 3.2-1.5 4.2H4.5C3.6 12.6 3 11.2 3 9.4c0-4 2.8-7.2 7-7.2Z"
        fill="#9333ea"
      />
      <ellipse cx="10" cy="5.8" rx="3" ry="1.3" fill="#e9d5ff" opacity="0.5" />
      {/* Око Бездны */}
      <circle cx="10" cy="9.2" r="2.2" fill="rgba(4,18,26,0.95)" />
      <circle cx="10" cy="9.2" r="1.2" fill="#f43f5e" />
      <circle cx="10.4" cy="8.8" r="0.4" fill="#ffffff" />
    </svg>
  )
}

/** Повелитель Времени — лазурная хроносфера, стрелки часов и пространственный вихрь. */
export function IconChrono({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      {/* Внешний хроно-вихрь */}
      <path
        d="M3 10a7 7 0 0 1 12.8-3.8M17 10a7 7 0 0 1-12.8 3.8"
        fill="none"
        stroke="#818cf8"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="2.5 1.5"
      />
      {/* Хроносфера */}
      <circle cx="10" cy="10" r="5.6" fill="#38bdf8" />
      <circle cx="10" cy="10" r="5.6" fill="none" stroke="#c7d2fe" strokeWidth="0.8" />
      <ellipse cx="8.5" cy="8" rx="2.2" ry="1" fill="#ffffff" opacity="0.5" />
      {/* Стрелки циферблата */}
      <circle cx="10" cy="10" r="1" fill="rgba(4,18,26,0.9)" />
      <path
        d="M10 10V6.5M10 10l2.5 1.2"
        stroke="rgba(4,18,26,0.9)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="10" r="0.4" fill="#67e8f9" />
    </svg>
  )
}

/** Иконка босса узла карты кампании по его виду. */
export function IconBoss({
  kind,
  className = "h-6 w-6 sm:h-7 sm:w-7",
}: {
  kind?: BossVariantKind
  className?: string
}) {
  switch (kind) {
    case "king":
      return <IconKing className={className} />
    case "jellyfish":
      return <IconJelly className={className} />
    case "crab":
      return <IconCrab className={className} />
    case "octopus":
      return <IconOctopus className={className} />
    case "kraken":
      return <IconKraken className={className} />
    case "chrono":
      return <IconChrono className={className} />
    default:
      return <IconOctopus className={className} />
  }
}

/** Золотая монета глубин. */
export function IconCoin({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="8.5" fill="#ffc94d" />
      <circle cx="10" cy="10" r="6.6" fill="#d99b1a" />
      <circle cx="10" cy="10" r="5.2" fill="#ffd86b" />
      <polygon points="10,6.5 12.8,10 10,13.5 7.2,10" fill="#a46e00" />
      <circle cx="8" cy="8" r="1.2" fill="#fff9db" opacity="0.8" />
    </svg>
  )
}

/** Кристалл глубин: валюта забега в кампании. */
export function IconCrystal({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <polygon points="10,2 16,6.5 13.5,17.5 6.5,17.5 4,6.5" fill="#c084fc" />
      <polygon points="10,2 16,6.5 13,8 10,6 7,8 4,6.5" fill="#e879f9" opacity="0.9" />
      <polygon points="10,6 13,8 10,17.5 7,8" fill="#a855f7" />
      <polygon points="10,2 13,8 10,17.5" fill="#f0abfc" opacity="0.4" />
      <circle cx="8" cy="7" r="1" fill="#fff" opacity="0.8" />
    </svg>
  )
}

/** Защитный энергощит. */
export function IconShield({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path
        d="M10 2.5 4.5 5v5.5c0 4.2 2.7 7.5 5.5 8.5 2.8-1 5.5-4.3 5.5-8.5V5L10 2.5Z"
        fill="#35e0ff"
        stroke="#1a8ea8"
        strokeWidth="1"
      />
      <path
        d="M10 4.5 6 6.5v4c0 3 1.8 5.5 4 6.3 2.2-.8 4-3.3 4-6.3v-4L10 4.5Z"
        fill="#8de7ff"
        opacity="0.45"
      />
    </svg>
  )
}

/** Лавка подводного торговца. */
export function IconShop({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M3 6.5 4.5 4h11L17 6.5H3Z" fill="#ffc94d" />
      <path
        d="M3 6.5v2a2 2 0 0 0 3.5 1.3A2 2 0 0 0 10 9.8a2 2 0 0 0 3.5 0A2 2 0 0 0 17 8.5v-2H3Z"
        fill="#e6a822"
      />
      <rect
        x="4.5"
        y="10"
        width="11"
        height="6.5"
        rx="1"
        fill="#2d6a7a"
        stroke="#ffc94d"
        strokeWidth="1"
      />
      <rect x="7.5" y="12" width="5" height="4.5" fill="#ffc94d" opacity="0.85" />
    </svg>
  )
}

/** Элитный узел испытания: скрещенные клинки. */
export function IconChallenge({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="#ff477e"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="m4 4 12 12M16 4 4 16" />
      <path d="M3 7 7 3M17 7l-4-4M3 13l4 4M17 13l-4 4" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.5" fill="#ff477e" stroke="none" />
    </svg>
  )
}

/** Водоворот/стихия для узлов-событий. */
export function IconVortex({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="#fbbf24"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5c0 4.1-3.4 7.5-7.5 7.5A6 6 0 0 1 4 11.5 4.5 4.5 0 0 1 8.5 7a3 3 0 0 1 3 3 1.5 1.5 0 0 1-1.5 1.5" />
    </svg>
  )
}

/** Боевой узел кампании: скрещенные плазменные орудия / тактический боевой прицел */
export function IconCombat({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      {/* Прицельный контур */}
      <circle
        cx="10"
        cy="10"
        r="7.5"
        stroke="#35e0ff"
        strokeWidth="1.1"
        strokeDasharray="2.5 1.8"
        opacity="0.8"
      />
      {/* Скрещенные орудия/бластеры */}
      <path d="m5 15 10-10M5 5l10 10" stroke="#35e0ff" strokeWidth="1.7" strokeLinecap="round" />
      {/* Сопла/энергетические наконечники */}
      <circle cx="5" cy="5" r="1.1" fill="#9deeff" />
      <circle cx="15" cy="5" r="1.1" fill="#9deeff" />
      <circle cx="5" cy="15" r="1.1" fill="#9deeff" />
      <circle cx="15" cy="15" r="1.1" fill="#9deeff" />
      {/* Центральное плазменное ядро */}
      <circle cx="10" cy="10" r="2.2" fill="#04121c" stroke="#35e0ff" strokeWidth="1.1" />
      <circle cx="10" cy="10" r="1" fill="#5dffb0" />
    </svg>
  )
}

export function IconChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function Key({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <span
      className={`inline-flex h-8 items-center justify-center border border-line bg-deep px-2 font-display text-[11px] text-cyan-neon shadow-[0_3px_0_rgba(3,14,21,0.9),inset_0_1px_0_rgba(141,220,255,0.15)] ${
        wide ? "min-w-16" : "min-w-8"
      }`}
      style={{
        clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)",
      }}
    >
      {children}
    </span>
  )
}

export function EffectChip({ label, good }: { label: string; good: boolean }) {
  return (
    <span
      className={`hud-chip px-1.5 py-0.5 font-display text-[10px] tracking-widest sm:px-2.5 sm:py-1 ${
        good ? "text-[#7dffb9]" : "text-[#ff9d94]"
      }`}
    >
      {label}
    </span>
  )
}

/** Содержимое панели управления (без карточки-обёртки) — вкладывается в секцию меню. */
export function ControlsPanel() {
  return (
    <ul className="space-y-2.5 text-sm text-foam/90">
      <li className="flex items-center gap-3">
        <span className="text-cyan-neon">
          <IconMouse />
        </span>
        <span>
          Мышь / палец — двигать ракетку, <b className="text-cyan-neon">клик</b> — запуск (на таче:
          веди пальцем и отпусти)
        </span>
      </li>
      <li className="flex items-center gap-3">
        <span className="flex gap-1">
          <Key>←</Key>
          <Key>→</Key>
        </span>
        <span>
          или <Key>A</Key> <Key>D</Key> — движение
        </span>
      </li>
      <li className="flex items-center gap-3">
        <Key wide>ПРОБЕЛ</Key>
        <span>запуск шара и стрельба оружием</span>
      </li>
      <li className="flex items-center gap-3">
        <span className="flex gap-1">
          <Key>P</Key>
          <Key>ESC</Key>
        </span>
        <span>пауза</span>
        <Key>M</Key>
        <span>звук</span>
      </li>
    </ul>
  )
}

/** Декорация меню: плавающие шары в правой части экрана. */
export function FloatingBalls() {
  const balls = [
    { c: "#ff6a5c", s: 74, x: "78%", y: "16%", d: "0s", t: "-6deg" },
    { c: "#ffc94d", s: 46, x: "70%", y: "34%", d: "0.6s", t: "4deg" },
    { c: "#5dffb0", s: 58, x: "86%", y: "40%", d: "1.1s", t: "0deg" },
    { c: "#ff5ca8", s: 34, x: "64%", y: "58%", d: "0.3s", t: "8deg" },
    { c: "#35e0ff", s: 90, x: "80%", y: "66%", d: "1.6s", t: "-3deg" },
    { c: "#ffc94d", s: 26, x: "92%", y: "24%", d: "0.9s", t: "0deg" },
  ]
  return (
    <>
      {balls.map((b, i) => (
        <div
          key={i}
          className="anim-bob pointer-events-none absolute hidden md:block"
          style={{
            left: b.x,
            top: b.y,
            width: b.s,
            height: b.s,
            animationDelay: b.d,
            ["--tilt" as string]: b.t,
          }}
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), ${b.c} 45%, rgba(0,0,0,0.35) 100%)`,
              boxShadow: `0 0 34px ${b.c}66, inset 0 -8px 16px rgba(0,0,0,0.35)`,
            }}
          />
        </div>
      ))}
    </>
  )
}
