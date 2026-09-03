/**
 * Иконки и мелкие самодостаточные UI-элементы (без состояния и зависимостей).
 */
import type { ReactNode } from "react"

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
      className={`hud-chip px-2.5 py-1 font-display text-[10px] tracking-widest ${
        good ? "text-[#7dffb9]" : "text-[#ff9d94]"
      }`}
    >
      {label}
    </span>
  )
}

export function ControlsPanel() {
  return (
    <div className="hud-chip p-4 sm:p-5">
      <div className="hud-label mb-3">Управление</div>
      <ul className="space-y-2.5 text-sm text-foam/90">
        <li className="flex items-center gap-3">
          <span className="text-cyan-neon">
            <IconMouse />
          </span>
          <span>
            Мышь / палец — двигать ракетку, <b className="text-cyan-neon">клик</b> — запуск (на
            таче: веди пальцем и отпусти)
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
    </div>
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
