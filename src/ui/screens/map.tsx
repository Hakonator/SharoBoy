import { type ReactNode } from "react"

import { IconBall, IconFish, IconJelly, IconOctopus } from "../icons"
import type { HudData } from "../../game/types"

/**
 * Экран рогаликовой карты кампании: узлы слева-направо, рёбра-связи и туман
 * войны. Видны только посещённые и соседние узлы; кликабельны только соседние.
 */
export function MapScreen({
  hud,
  onMapNode,
  onEventDismiss,
  onMenu,
}: {
  hud: HudData
  onMapNode: (id: number) => void
  onEventDismiss: () => void
  onMenu: () => void
}) {
  const view = hud.map
  if (!view) return null

  const byId = new Map(view.nodes.map((n) => [n.id, n]))
  const revealed = new Set<number>([...view.visited, ...view.visible])
  const playerOut = new Set<number>(view.visible)
  const revealedEdges = view.edges.filter((e) => revealed.has(e.from) && revealed.has(e.to))
  // маркеры существ — только на УЖЕ ПОСЕЩЁННЫХ узлах: до боя локация хранит
  // сюрприз. SVG-иконки в едином стиле вместо эмодзи (на части систем эмодзи
  // показывались квадратами). рыба/медуза — источник жизней, осьминог — босс
  const mbIcon: Record<string, (p: { className?: string }) => ReactNode> = {
    fish: IconFish,
    jelly: IconJelly,
  }
  const mbName: Record<string, string> = { fish: "рыба", jelly: "медуза" }
  const visitedMb = view.visited.filter((id) => (view.minibosses[id]?.length ?? 0) > 0)

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-abyss/55">
      {/* Верхний бар: счёт, жизни, рекорд и выход в меню */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-4">
        <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
          <div className="hud-chip px-3 py-1.5">
            <div className="hud-label">Счёт</div>
            <div className="font-display text-lg leading-none text-foam tabular-nums sm:text-2xl">
              {hud.score.toLocaleString("ru-RU")}
            </div>
          </div>
          <div className="hud-chip px-3 py-1.5 sm:px-3.5 sm:py-2">
            <div className="hud-label hidden sm:block">Жизни</div>
            <div className="flex gap-1 sm:mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <IconBall
                  key={i}
                  color="#35e0ff"
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    i < hud.lives ? "opacity-100" : "opacity-20 grayscale"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hud-chip hidden px-3.5 py-2 sm:block">
            <div className="hud-label">Рекорд</div>
            <div className="font-display text-xl leading-none text-gold tabular-nums sm:text-2xl">
              {hud.best.toLocaleString("ru-RU")}
            </div>
          </div>
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onMenu}>
            ✕ В меню
          </button>
        </div>
      </div>

      {/* Карта: рёбра в SVG, узлы — круглые кнопки в %-координатах. Ярусов
          много, поэтому на узких экранах карта скроллится по горизонтали. */}
      <div className="relative flex-1 overflow-x-auto overflow-y-hidden">
        <div className="relative h-full min-w-[900px]">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {revealedEdges.map((e) => {
              const a = byId.get(e.from)
              const b = byId.get(e.to)
              if (!a || !b) return null
              const active = view.playerId === e.from
              return (
                <line
                  key={`${e.from}-${e.to}`}
                  x1={a.x * 100}
                  y1={a.y * 100}
                  x2={b.x * 100}
                  y2={b.y * 100}
                  stroke={active ? "#35e0ff" : "rgba(63,148,181,0.45)"}
                  strokeWidth={active ? 1.2 : 0.7}
                  strokeDasharray={active ? undefined : "2.4 1.8"}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>

          {view.nodes
            .filter((n) => revealed.has(n.id))
            .map((n) => {
              const isCurrent = n.id === view.playerId
              const clickable = playerOut.has(n.id)
              const mbKinds = view.minibosses[n.id] ?? []
              const showMb = view.visited.includes(n.id) && mbKinds.length > 0
              const size = n.isBoss ? "h-12 w-12 sm:h-14 sm:w-14" : "h-7 w-7 sm:h-8 sm:w-8"
              const tint = n.isBoss
                ? "bg-coral shadow-[0_0_18px_rgba(255,106,92,0.85)]"
                : isCurrent
                  ? "bg-cyan-neon shadow-[0_0_16px_rgba(53,224,255,0.9)]"
                  : clickable
                    ? "bg-mint shadow-[0_0_14px_rgba(93,255,176,0.75)]"
                    : "bg-deep border border-line"
              return (
                <button
                  key={n.id}
                  disabled={!clickable}
                  onClick={() => clickable && onMapNode(n.id)}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 select-none flex-col items-center gap-1 ${
                    clickable ? "cursor-pointer" : "cursor-default"
                  }`}
                  style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%` }}
                  aria-label={clickable ? `Открыть узел ${n.name}` : n.name}
                >
                  <span
                    className={`relative flex items-center justify-center rounded-full font-display leading-none ${size} ${tint} ${
                      clickable ? "transition-transform hover:scale-110 active:scale-95" : ""
                    }`}
                  >
                    {n.isBoss ? (
                      <IconOctopus className="h-6 w-6 sm:h-7 sm:w-7" />
                    ) : isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-abyss sm:h-2.5 sm:w-2.5" />
                    ) : null}
                    {!n.isBoss && showMb && (
                      <span
                        className="absolute -right-2 -top-2.5 flex items-center gap-0.5 drop-shadow-[0_1px_0_rgba(4,18,26,0.9)]"
                        aria-label={`Мини-босс: ${mbKinds.map((k) => mbName[k] ?? k).join(" и ")}`}
                      >
                        {mbKinds.map((k) => {
                          const Icon = mbIcon[k]
                          return Icon ? <Icon key={k} className="h-3 w-3 sm:h-4 sm:w-4" /> : null
                        })}
                      </span>
                    )}
                  </span>
                  {n.isBoss && !clickable && (
                    <span className="whitespace-nowrap font-display text-[10px] tracking-widest text-coral drop-shadow-[0_2px_0_rgba(4,18,26,0.9)] sm:text-xs">
                      БОСС
                    </span>
                  )}
                  {clickable && (
                    <span className="whitespace-nowrap font-display text-[10px] tracking-wider text-foam drop-shadow-[0_2px_0_rgba(4,18,26,0.9)] sm:text-xs">
                      {n.name}
                    </span>
                  )}
                </button>
              )
            })}
        </div>
      </div>

      {/* Подсказка снизу + легенда существ, если игрок уже их встречал */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-1 px-4">
        {visitedMb.length > 0 && (
          <div className="hud-chip flex items-center justify-center gap-1.5 px-3 py-1 font-display text-[10px] tracking-wider text-mint sm:text-xs">
            <span className="flex items-center gap-0.5">
              <IconFish className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <IconJelly className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
            МИНИ-БОСС В УЗЛЕ — ПОБЕДИ И ПОЛУЧИ ЖИЗНЬ
          </div>
        )}
        <div className="hud-chip flex items-center justify-center gap-1.5 px-3 py-1 font-display text-[10px] tracking-wider text-coral sm:text-xs">
          <IconOctopus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          ФИНАЛЬНЫЙ БОСС ГЛУБИН
        </div>
        <div className="hud-chip px-5 py-2 text-center font-display text-xs tracking-widest text-cyan-neon sm:text-sm">
          {playerOut.size > 1
            ? "ВЫБЕРИ ОДИН ИЗ ПУТЕЙ"
            : playerOut.size === 1
              ? "ВЫБЕРИ СЛЕДУЮЩИЙ УЗЕЛ"
              : "ПУТЬ ЗАВЕРШЁН"}
        </div>
      </div>

      {/* Оверлей события: боя не было — игрока отнесло в пройденный узел */}
      {hud.campaignEvent && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-abyss/70 p-4">
          <div className="hud-chip flex max-w-md flex-col items-center px-6 py-5 text-center">
            <div className="hud-label mb-2">СЛУЧАЙНОЕ СОБЫТИЕ</div>
            <p className="font-display text-sm leading-relaxed text-foam sm:text-base">
              {hud.campaignEvent}
            </p>
            <button className="btn-ghost mt-4 px-5 py-2 text-sm" onClick={onEventDismiss}>
              ПЛЫТЬ ДАЛЬШЕ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
