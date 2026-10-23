import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import {
  IconBall,
  IconChallenge,
  IconCoin,
  IconCombat,
  IconCrystal,
  IconFish,
  IconJelly,
  IconOctopus,
  IconBoss,
  IconShield,
  IconShop,
  IconVortex,
} from "../icons"
import type { HudData } from "../../game/types"
import { CAMPAIGN_MODIFIERS_MAP } from "../../game/campaignModifiers"
import { TIER_STEP_NODE_WIDTHS } from "../../game/campaignMap"

/**
 * Ширина пиктограммы обычного узла: `w-11` на мобильных, `w-12` от `sm`
 * (синхронизировано с классом размеров кнопки-узла ниже).
 */
const NODE_WIDTH_MOBILE = 44
/** Ширина узла от `sm`: используется только в медиа-запросе ниже. */
const NODE_WIDTH_DESKTOP = 48
/** Точка перелома Tailwind `sm` — с неё пиктограммы узлов крупнее. */
const SM_MIN_WIDTH = 640

/**
 * Активна ли десктопная раскладка (`sm` и шире). Нужна, потому что позиции
 * узлов считаются в px: при переходе через точку перелома шаг яруса растёт
 * с 88 до 96 px, как и сама пиктограмма.
 */
function useDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia(`(min-width: ${SM_MIN_WIDTH}px)`)
    const sync = () => setIsDesktop(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  return isDesktop
}

/**
 * Экран рогаликовой карты кампании: узлы слева-направо, рёбра-связи и туман
 * войны. Включает лавки торговцев за монеты, интерактивные события с выбором,
 * элитные узлы испытаний и финального босса.
 */
export function MapScreen({
  hud,
  onMapNode,
  onEventDismiss,
  onEventChoice,
  onBuyShopItem,
  onCloseShop,
  onMenu,
}: {
  hud: HudData
  onMapNode: (id: number) => void
  onEventDismiss: () => void
  onEventChoice?: (index: number) => void
  onBuyShopItem?: (itemId: string) => void
  onCloseShop?: () => void
  onMenu: () => void
}) {
  const view = hud.map
  const [mounted, setMounted] = useState(false)
  const prevPlayerIdRef = useRef<number | null>(null)
  const [travelTargetId, setTravelTargetId] = useState<number | null>(null)
  const [isTeleporting, setIsTeleporting] = useState(false)
  const [eventDismissed, setEventDismissed] = useState(false)
  const mapScrollRef = useRef<HTMLDivElement>(null)
  const travelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Постоянный шаг ярусов: ширина полотна и шаг в px, не зависящие от экрана.
     Полотно = (tiers − 1) шагов по `TIER_STEP_NODE_WIDTHS` узлов + по половине
     узла с краёв — ровно та же нормализация, что в `layoutTiers`, поэтому
     обратный перевод координаты в px — умножение на ширину полотна. */
  const isDesktop = useDesktopLayout()
  const tiers = view?.tiers ?? 0
  const nodeWidth = isDesktop ? NODE_WIDTH_DESKTOP : NODE_WIDTH_MOBILE
  const tierStep = nodeWidth * TIER_STEP_NODE_WIDTHS
  const canvasWidth = Math.max(0, tiers - 1) * tierStep + nodeWidth
  const nodeX = (x: number) => x * canvasWidth

  useEffect(() => {
    setMounted(true)
    return () => {
      if (travelTimerRef.current) clearTimeout(travelTimerRef.current)
    }
  }, [])

  // Плавное отслеживание перемещения и телепорта рамки
  useEffect(() => {
    if (!view) return
    const playerId = view.playerId
    if (prevPlayerIdRef.current !== null && prevPlayerIdRef.current !== playerId) {
      const prevNode = view.nodes.find((n) => n.id === prevPlayerIdRef.current)
      const currNode = view.nodes.find((n) => n.id === playerId)
      if (prevNode && currNode) {
        const dx = currNode.x - prevNode.x
        const dy = currNode.y - prevNode.y
        const dist = Math.hypot(dx, dy)
        // Телепорт: если прыжок назад (currNode.tier < prevNode.tier) или скачок через несколько ярусов
        const isTeleport = currNode.tier < prevNode.tier || dist > 0.08
        if (isTeleport) {
          setIsTeleporting(true)
          const timer = setTimeout(() => setIsTeleporting(false), 1200)
          return () => clearTimeout(timer)
        }
      }
    }
    prevPlayerIdRef.current = playerId
  }, [view])

  // Эффективный узел для отображения рамки и камеры: во время перемещения
  // рамка плавно стремится к целевому узлу
  const effectiveNode = useMemo(() => {
    if (!view) return undefined
    const byId = new Map(view.nodes.map((n) => [n.id, n]))
    const targetNode = travelTargetId !== null ? byId.get(travelTargetId) : undefined
    return targetNode ?? byId.get(view.playerId)
  }, [view, travelTargetId])

  // Автоцентрирование карты на эффективном узле (следует за рамкой)
  useEffect(() => {
    if (!mapScrollRef.current || !effectiveNode) return
    const el = mapScrollRef.current
    const targetX = effectiveNode.x * canvasWidth
    const targetScrollLeft = targetX - el.clientWidth / 2
    el.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: mounted ? "smooth" : "auto",
    })
  }, [effectiveNode, mounted, canvasWidth])

  if (!view) return null

  const byId = new Map(view.nodes.map((n) => [n.id, n]))
  const revealed = new Set<number>([...view.visited, ...view.visible])
  if (view.eventTargetId !== undefined) revealed.add(view.eventTargetId)
  const playerOut = new Set<number>(view.visible)
  const revealedEdges = view.edges.filter((e) => revealed.has(e.from) && revealed.has(e.to))
  const eventTarget = view.eventTargetId === undefined ? undefined : byId.get(view.eventTargetId)
  const player = byId.get(view.playerId)

  // Клик по узлу: запускает плавное движение рамки перед вызовом боевого цикла
  const handleNodeClick = (nodeId: number) => {
    if (travelTargetId !== null) return
    setTravelTargetId(nodeId)
    setIsTeleporting(false)

    travelTimerRef.current = setTimeout(() => {
      onMapNode(nodeId)
      setTravelTargetId(null)
    }, 550)
  }

  // Закрытие события: если есть телепорт, плавно летим рамкой к цели перед стартом
  const handleDismissEvent = () => {
    if (travelTargetId !== null) return

    if (eventTarget && player && eventTarget.id !== player.id) {
      setEventDismissed(true)
      setTravelTargetId(eventTarget.id)
      setIsTeleporting(true)

      travelTimerRef.current = setTimeout(() => {
        onEventDismiss()
        setTravelTargetId(null)
        setIsTeleporting(false)
        setEventDismissed(false)
      }, 950)
    } else {
      onEventDismiss()
    }
  }

  const mbIcon: Record<string, (p: { className?: string }) => ReactNode> = {
    fish: IconFish,
    jelly: IconJelly,
  }
  const mbName: Record<string, string> = { fish: "рыба", jelly: "медуза" }
  const visitedMb = view.visited.filter((id) => (view.minibosses[id]?.length ?? 0) > 0)

  const shop = hud.campaignShop
  const eventData = hud.campaignEventData

  const coins = hud.coins ?? 0
  const crystals = hud.crystals ?? 0

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-abyss/55">
      {/* Верхний бар: счёт, жизни, щиты, кристаллы, монеты, рекорд и выход в меню */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-4">
        <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
          <div className="hud-chip px-3 py-1.5">
            <div className="hud-label">Счёт</div>
            <div className="font-display text-lg leading-none text-foam tabular-nums sm:text-2xl">
              {(hud.score ?? 0).toLocaleString("ru-RU")}
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

          {(hud.shield ?? 0) > 0 && (
            <div className="hud-chip flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2">
              <IconShield className="h-4 w-4 text-cyan-neon" />
              <div>
                <div className="hud-label hidden sm:block">Щит</div>
                <div className="font-display text-sm font-bold text-cyan-neon tabular-nums sm:text-base">
                  {hud.shield}
                </div>
              </div>
            </div>
          )}

          <div className="hud-chip flex items-center gap-1.5 border-purple-500/30 bg-purple-500/10 px-3 py-1.5 shadow-[0_0_12px_rgba(192,132,252,0.2)] sm:px-3.5 sm:py-2">
            <IconCrystal className="h-4 w-4 sm:h-5 sm:w-5" />
            <div>
              <div className="hud-label text-purple-300">Кристаллы</div>
              <div className="font-display text-base font-bold text-purple-200 tabular-nums sm:text-xl">
                {crystals.toLocaleString("ru-RU")}
              </div>
            </div>
          </div>

          <div
            className="hud-chip flex items-center gap-1.5 border-sky-500/30 bg-sky-500/10 px-3 py-1.5 shadow-[0_0_12px_rgba(56,189,248,0.2)] sm:px-3.5 sm:py-2"
            title="Несгораемые мета-кристаллы за победу над боссами"
          >
            <span className="text-base sm:text-lg">💠</span>
            <div>
              <div className="hud-label text-sky-300">Мета-кристаллы</div>
              <div className="font-display text-base font-bold text-sky-200 tabular-nums sm:text-xl">
                {(hud.metaCrystals ?? 0).toLocaleString("ru-RU")}
              </div>
            </div>
          </div>

          <div className="hud-chip flex items-center gap-1.5 border-gold/30 bg-gold/10 px-3 py-1.5 shadow-[0_0_12px_rgba(255,201,77,0.15)] sm:px-3.5 sm:py-2">
            <IconCoin className="h-4 w-4 sm:h-5 sm:w-5" />
            <div>
              <div className="hud-label text-gold/80">Монеты</div>
              <div className="font-display text-base font-bold text-gold tabular-nums sm:text-xl">
                {coins.toLocaleString("ru-RU")}
              </div>
            </div>
          </div>

          {hud.campaignModifiers && hud.campaignModifiers.length > 0 && (
            <div className="hud-chip hidden items-center gap-1.5 border-purple-500/30 bg-purple-950/20 px-3 py-1.5 sm:flex sm:px-3.5 sm:py-2">
              <span className="text-base sm:text-lg">⚡</span>
              <div>
                <div className="hud-label text-purple-300">МУТАТОРЫ</div>
                <div className="flex items-center gap-1">
                  {hud.campaignModifiers.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-purple-500/25 px-1 py-0.5 text-[10px] font-bold text-purple-200"
                      title={CAMPAIGN_MODIFIERS_MAP[m]?.desc}
                    >
                      {CAMPAIGN_MODIFIERS_MAP[m]?.icon} {CAMPAIGN_MODIFIERS_MAP[m]?.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
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

      {/* Карта: рёбра в SVG, узлы — пиктограммы в px-координатах с динамической рамкой.
          Полотно — `(tiers − 1) * step + nodeWidth` px, то есть шаг ярусов постоянен
          (2 ширины узла) при любой ширине экрана; на узком экране карта скроллится. */}
      <div
        ref={mapScrollRef}
        className="relative flex-1 overflow-x-auto overflow-y-hidden arcade-scrollbar"
      >
        <div
          data-testid="campaign-map-canvas"
          className="relative h-full"
          style={{ width: `${canvasWidth}px`, minWidth: `${canvasWidth}px` }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${canvasWidth} 100`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <marker
                id="campaign-event-arrow"
                markerWidth="1"
                markerHeight="1"
                refX="0.87"
                refY="0.5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0 0 L1 0.5 L0 1 Z" fill="#ffc94d" />
              </marker>
            </defs>
            {revealedEdges.map((e) => {
              const a = byId.get(e.from)
              const b = byId.get(e.to)
              if (!a || !b) return null
              const active = view.playerId === e.from
              return (
                <line
                  key={`${e.from}-${e.to}`}
                  x1={nodeX(a.x)}
                  y1={a.y * 100}
                  x2={nodeX(b.x)}
                  y2={b.y * 100}
                  stroke={active ? "#35e0ff" : "rgba(63,148,181,0.45)"}
                  strokeWidth={active ? 1.2 : 0.7}
                  strokeDasharray={active ? undefined : "2.4 1.8"}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
            {eventTarget && player && eventTarget.id !== player.id && (
              <line
                x1={nodeX(player.x)}
                y1={player.y * 100}
                x2={nodeX(eventTarget.x)}
                y2={eventTarget.y * 100}
                stroke="#ffc94d"
                strokeWidth="0.35"
                strokeDasharray="2 1.4"
                strokeLinecap="round"
                markerEnd="url(#campaign-event-arrow)"
                style={{ filter: "drop-shadow(0 0 1px rgba(255, 201, 77, 0.75))" }}
              />
            )}
          </svg>

          {/* Динамическая технологичная рамка текущего положения игрока */}
          {effectiveNode && (
            <div
              data-testid="current-node-reticle"
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center ${
                effectiveNode.isBoss
                  ? "h-20 w-20 sm:h-24 sm:w-24"
                  : "h-16 w-16 sm:h-[72px] sm:w-[72px]"
              } ${isTeleporting ? "anim-warp" : "anim-radar"}`}
              style={{
                left: `${nodeX(effectiveNode.x)}px`,
                top: `${effectiveNode.y * 100}%`,
                transition: !mounted
                  ? "none"
                  : isTeleporting
                    ? "left 0.95s cubic-bezier(0.22, 1, 0.36, 1), top 0.95s cubic-bezier(0.22, 1, 0.36, 1)"
                    : "left 0.55s cubic-bezier(0.2, 0.9, 0.3, 1), top 0.55s cubic-bezier(0.2, 0.9, 0.3, 1)",
              }}
              aria-hidden
            >
              <svg viewBox="0 0 80 80" className="h-full w-full" fill="none">
                <defs>
                  <filter id="reticle-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* 4 угловые тактические скобки [ ] вокруг границ узла */}
                <g
                  stroke={isTeleporting ? "#ffc94d" : "#35e0ff"}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#reticle-glow)"
                >
                  {/* Верхний левый */}
                  <path d="M 6 22 L 6 8 L 22 8" />
                  {/* Верхний правый */}
                  <path d="M 58 8 L 74 8 L 74 22" />
                  {/* Нижний левый */}
                  <path d="M 6 58 L 6 72 L 22 72" />
                  {/* Нижний правый */}
                  <path d="M 58 72 L 74 72 L 74 58" />
                </g>

                {/* Внешнее тактическое кольцо со штрихами (вращается по часовой) */}
                <circle
                  cx="40"
                  cy="40"
                  r={effectiveNode.isBoss ? "38" : "33"}
                  stroke={isTeleporting ? "rgba(255,201,77,0.75)" : "rgba(53,224,255,0.7)"}
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                  className="anim-spin-slow origin-center"
                />

                {/* Внутреннее сканирующее кольцо (вращается против часовой) */}
                <circle
                  cx="40"
                  cy="40"
                  r={effectiveNode.isBoss ? "34" : "28"}
                  stroke={isTeleporting ? "rgba(255,201,77,0.4)" : "rgba(93,255,176,0.45)"}
                  strokeWidth="1"
                  strokeDasharray="8 12"
                  className="anim-spin-reverse origin-center"
                />

                {/* Прицельные маркерные засечки */}
                <g
                  stroke={isTeleporting ? "#ffc94d" : "#35e0ff"}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <line x1="40" y1="2" x2="40" y2="6" />
                  <line x1="40" y1="74" x2="40" y2="78" />
                  <line x1="2" y1="40" x2="6" y2="40" />
                  <line x1="74" y1="40" x2="78" y2="40" />
                </g>
              </svg>

              {/* Динамический плавающий маркер статуса */}
              <div
                className={`absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 font-display text-[9px] tracking-widest backdrop-blur-sm transition-colors ${
                  isTeleporting
                    ? "border-gold/80 bg-gold/20 text-gold shadow-[0_0_12px_rgba(255,201,77,0.7)] animate-pulse"
                    : "border-cyan-neon/60 bg-abyss/85 text-cyan-neon shadow-[0_0_10px_rgba(53,224,255,0.45)]"
                }`}
              >
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-mint animate-ping" />
                {isTeleporting ? "ТЕЛЕПОРТАЦИЯ..." : "ТЕКУЩИЙ СЕКТОР"}
              </div>
            </div>
          )}

          {view.nodes
            .filter((n) => revealed.has(n.id))
            .map((n) => {
              const isCurrent = n.id === (travelTargetId ?? view.playerId)
              const isEventTarget = n.id === view.eventTargetId
              const clickable = playerOut.has(n.id)
              const mbKinds = view.minibosses[n.id] ?? []
              const showMb = view.visited.includes(n.id) && mbKinds.length > 0
              const size = n.isBoss ? "h-14 w-14 sm:h-16 sm:w-16" : "h-11 w-11 sm:h-12 sm:w-12"

              let tint = "bg-deep border border-line text-dim/70"
              if (isEventTarget) {
                tint =
                  "border-2 border-gold bg-gold text-abyss shadow-[0_0_0_4px_rgba(255,201,77,0.25),0_0_24px_rgba(255,201,77,0.85)] animate-pulse"
              } else if (n.isBoss) {
                tint = isCurrent
                  ? "border-2 border-coral bg-coral/30 text-coral shadow-[0_0_24px_rgba(255,106,92,0.95)]"
                  : clickable
                    ? "border-2 border-coral bg-coral text-abyss shadow-[0_0_24px_rgba(255,106,92,0.9)]"
                    : "border-2 border-coral/70 bg-deep/90 text-coral/80 shadow-[0_0_16px_rgba(255,106,92,0.6)]"
              } else if (n.isShop) {
                tint = isCurrent
                  ? "border-2 border-gold bg-gold text-abyss shadow-[0_0_18px_rgba(255,201,77,0.9)]"
                  : clickable
                    ? "border-2 border-gold bg-deep text-gold shadow-[0_0_14px_rgba(255,201,77,0.8)]"
                    : "border border-gold/50 bg-deep/80 text-gold/70"
              } else if (n.isChallenge) {
                tint = isCurrent
                  ? "border-2 border-[#ff477e] bg-[#ff477e] text-abyss shadow-[0_0_18px_rgba(255,71,126,0.9)]"
                  : clickable
                    ? "border-2 border-[#ff477e] bg-deep text-[#ff477e] shadow-[0_0_14px_rgba(255,71,126,0.8)]"
                    : "border border-[#ff477e]/50 bg-deep/80 text-[#ff477e]/70"
              } else if (n.isEvent) {
                tint = isCurrent
                  ? "border-2 border-amber-400 bg-amber-400 text-abyss shadow-[0_0_18px_rgba(251,191,36,0.9)]"
                  : clickable
                    ? "border-2 border-amber-400 bg-deep text-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.8)]"
                    : "border border-amber-400/50 bg-deep/80 text-amber-300/70"
              } else if (isCurrent) {
                tint =
                  "border-2 border-cyan-neon bg-cyan-neon/25 text-cyan-neon shadow-[0_0_20px_rgba(53,224,255,0.9)]"
              } else if (clickable) {
                tint =
                  "border-2 border-mint bg-deep text-mint shadow-[0_0_16px_rgba(93,255,176,0.8)]"
              }

              return (
                <button
                  key={n.id}
                  disabled={!clickable || travelTargetId !== null}
                  onClick={() => clickable && travelTargetId === null && handleNodeClick(n.id)}
                  className={`absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2 select-none rounded-2xl font-display leading-none ${size} ${tint} backdrop-blur-sm ${
                    clickable && travelTargetId === null
                      ? "cursor-pointer group z-20 transition-transform hover:scale-115 active:scale-95"
                      : isCurrent
                        ? "cursor-default z-10"
                        : "cursor-default z-0"
                  }`}
                  style={{ left: `${nodeX(n.x)}px`, top: `${n.y * 100}%` }}
                  aria-label={clickable ? `Открыть узел ${n.name}` : n.name}
                >
                  {n.isBoss ? (
                    <IconBoss kind={n.bossKind} className="h-8 w-8 sm:h-9 sm:w-9" />
                  ) : n.isShop ? (
                    <IconShop className="h-5 w-5 sm:h-6 sm:w-6" />
                  ) : n.isChallenge ? (
                    <IconChallenge className="h-5 w-5 sm:h-6 sm:w-6" />
                  ) : n.isEvent ? (
                    <IconVortex className="h-5 w-5 sm:h-6 sm:w-6" />
                  ) : (
                    <IconCombat className="h-5 w-5 sm:h-6 sm:w-6" />
                  )}

                  {!n.isBoss && showMb && (
                    <span
                      className="absolute -right-2 -top-2.5 flex items-center gap-0.5 rounded-full border border-mint/50 bg-abyss/90 px-1 py-0.5 shadow-[0_0_8px_rgba(93,255,176,0.5)] drop-shadow-[0_1px_0_rgba(4,18,26,0.9)]"
                      aria-label={`Мини-босс: ${mbKinds.map((k) => mbName[k] ?? k).join(" и ")}`}
                    >
                      {mbKinds.map((k) => {
                        const Icon = mbIcon[k]
                        return Icon ? <Icon key={k} className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : null
                      })}
                    </span>
                  )}

                  {/* Информационная плашка под узлом (вынесена из вертикального потока flex,
                      чтобы геометрический центр кнопки находился строго в (n.x, n.y)) */}
                  {n.isBoss && !clickable && (
                    <div className="pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2 flex flex-col items-center sm:mt-4">
                      <span className="whitespace-nowrap font-display text-[10px] tracking-widest text-coral drop-shadow-[0_2px_0_rgba(4,18,26,0.9)] sm:text-xs">
                        БОСС
                      </span>
                    </div>
                  )}

                  {(clickable || isEventTarget || isCurrent) && (
                    <div className="pointer-events-none absolute top-full left-1/2 mt-3 -translate-x-1/2 flex flex-col items-center sm:mt-4">
                      <span
                        className={`whitespace-nowrap font-display text-[10px] tracking-wider drop-shadow-[0_2px_0_rgba(4,18,26,0.9)] sm:text-xs ${
                          isEventTarget
                            ? "text-gold"
                            : n.isShop
                              ? "text-gold"
                              : n.isChallenge
                                ? "text-[#ff477e]"
                                : n.isEvent
                                  ? "text-amber-300"
                                  : isCurrent
                                    ? "text-cyan-neon"
                                    : "text-foam"
                        }`}
                      >
                        {n.isChallenge && n.challenge ? n.challenge.title : n.name}
                      </span>
                      {n.isChallenge && n.challenge && clickable && (
                        <span className="whitespace-nowrap font-display text-[9px] text-[#ff477e]/90 drop-shadow-[0_1px_0_rgba(4,18,26,0.9)] sm:text-[10px]">
                          +{n.challenge.rewardCrystals} 💎 +{n.challenge.rewardMeta} 💠
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
        </div>
      </div>

      {/* Подсказка снизу + легенда */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-1 px-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {visitedMb.length > 0 && (
            <div className="hud-chip flex items-center justify-center gap-1.5 px-3 py-1 font-display text-[10px] tracking-wider text-mint sm:text-xs">
              <span className="flex items-center gap-0.5">
                <IconFish className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <IconJelly className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              МИНИ-БОСС В УЗЛЕ
            </div>
          )}
          <div className="hud-chip flex items-center justify-center gap-1.5 px-3 py-1 font-display text-[10px] tracking-wider text-cyan-neon sm:text-xs">
            <IconCombat className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            БОЙ
          </div>
          <div className="hud-chip flex items-center justify-center gap-1.5 px-3 py-1 font-display text-[10px] tracking-wider text-purple-300 sm:text-xs">
            <IconShop className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ЛАВКА ЗА КРИСТАЛЛЫ
          </div>
          <div className="hud-chip flex items-center justify-center gap-1.5 px-3 py-1 font-display text-[10px] tracking-wider text-[#ff477e] sm:text-xs">
            <IconChallenge className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ИСПЫТАНИЕ (+💎 +💠)
          </div>
          <div className="hud-chip flex items-center justify-center gap-1.5 px-3 py-1 font-display text-[10px] tracking-wider text-coral sm:text-xs">
            <IconOctopus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            БОСС АКТА
          </div>
        </div>

        <div className="hud-chip px-5 py-2 text-center font-display text-xs tracking-widest text-cyan-neon sm:text-sm">
          {playerOut.size > 1
            ? "ВЫБЕРИ ОДИН ИЗ ПУТЕЙ"
            : playerOut.size === 1
              ? "ВЫБЕРИ СЛЕДУЮЩИЙ УЗЕЛ"
              : "ПУТЬ ЗАВЕРШЁН"}
        </div>
      </div>

      {/* Модальное окно магазина */}
      {shop && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-abyss/80 p-3 backdrop-blur-md sm:p-6">
          <div className="hud-chip flex w-full max-w-xl flex-col items-center border border-purple-400/40 bg-abyss/95 p-4 text-center shadow-[0_0_32px_rgba(192,132,252,0.25)] sm:p-6">
            <div className="flex items-center gap-2">
              <IconShop className="h-6 w-6 text-purple-300" />
              <div className="hud-label text-purple-300">ПОДВОДНЫЙ ТОРГОВЕЦ</div>
            </div>
            <h2 className="mt-1 font-display text-xl text-foam sm:text-2xl">{shop.name}</h2>
            <div className="mt-2 flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/15 px-3.5 py-1 text-purple-200">
              <IconCrystal className="h-4 w-4" />
              <span className="font-display text-sm font-bold sm:text-base">
                Баланс: {crystals} 💎
              </span>
            </div>

            <div className="mt-4 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {shop.items.map((item) => {
                const isLife = item.category === "life"
                const isShield = item.category === "shield"
                const isRelic = item.category === "relic"
                const atMaxLife = isLife && hud.lives >= 5
                const atMaxShield = isShield && hud.shield >= 5
                const affordable = crystals >= item.price
                const canBuy = !item.sold && affordable && !atMaxLife && !atMaxShield

                let btnLabel = `КУПИТЬ (${item.price} 💎)`
                if (item.sold) btnLabel = "КУПЛЕНО"
                else if (atMaxLife) btnLabel = "МАКС. ЖИЗНЕЙ (5)"
                else if (atMaxShield) btnLabel = "МАКС. ЩИТОВ (5)"
                else if (!affordable) btnLabel = `НУЖНО ${item.price} 💎`

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                      item.sold
                        ? "border-line/40 bg-deep/40 opacity-60"
                        : isRelic
                          ? "border-purple-400/50 bg-deep/90 shadow-[0_0_16px_rgba(192,132,252,0.15)] hover:border-purple-300"
                          : "border-gold/30 bg-deep/90 hover:border-gold/60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-sm font-bold text-foam sm:text-base">
                            {item.name}
                          </span>
                          {isRelic && (
                            <span className="rounded bg-purple-500/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-200">
                              РЕЛИКВИЯ
                            </span>
                          )}
                        </div>
                        <span className="whitespace-nowrap font-display text-xs font-bold text-purple-300">
                          {item.price} 💎
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-foam/80">{item.desc}</p>
                    </div>

                    <button
                      disabled={!canBuy}
                      onClick={() => onBuyShopItem?.(item.id)}
                      className={`mt-3 w-full rounded py-1.5 font-display text-xs font-bold transition-all ${
                        item.sold
                          ? "cursor-default bg-line/20 text-foam/40"
                          : canBuy
                            ? isRelic
                              ? "cursor-pointer bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_12px_rgba(192,132,252,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                              : "cursor-pointer bg-gold text-abyss shadow-[0_0_12px_rgba(255,201,77,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                            : "cursor-not-allowed bg-line/30 text-foam/40"
                      }`}
                    >
                      {btnLabel}
                    </button>
                  </div>
                )
              })}
            </div>

            <button
              className="btn-ghost mt-5 px-6 py-2 font-display text-sm text-cyan-neon hover:text-foam"
              onClick={onCloseShop}
            >
              ПРОДОЛЖИТЬ ПУТЬ
            </button>
          </div>
        </div>
      )}

      {/* Оверлей интерактивного события с выбором */}
      {eventData && !eventDismissed && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-abyss/75 p-3 backdrop-blur-md sm:p-6">
          <div className="hud-chip flex w-full max-w-lg flex-col items-center border border-amber-400/40 bg-abyss/95 p-4 text-center shadow-[0_0_32px_rgba(251,191,36,0.2)] sm:p-6">
            <div className="flex items-center gap-2">
              <IconVortex className="h-5 w-5 text-amber-300" />
              <div className="hud-label text-amber-300">{eventData.title}</div>
            </div>
            <p className="mt-2 font-display text-sm leading-relaxed text-foam sm:text-base">
              {eventData.text}
            </p>

            {!eventData.resolved ? (
              <div className="mt-4 flex w-full flex-col gap-2.5">
                {eventData.choices.map((choice, idx) => {
                  const affordable = !choice.cost || crystals >= choice.cost
                  return (
                    <button
                      key={choice.id}
                      disabled={!affordable}
                      onClick={() => onEventChoice?.(idx)}
                      className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                        affordable
                          ? "cursor-pointer border-amber-400/40 bg-deep/90 hover:border-amber-300 hover:bg-deep active:scale-[0.99]"
                          : "cursor-not-allowed border-line/30 bg-deep/40 opacity-50"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-display text-sm font-bold text-amber-200">
                          {idx + 1}. {choice.label}
                        </span>
                        {choice.cost && (
                          <span
                            className={`font-display text-xs ${
                              affordable ? "text-purple-300" : "text-coral"
                            }`}
                          >
                            {choice.cost} 💎
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-foam/80">{choice.desc}</p>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mt-4 w-full">
                <div className="rounded-lg border border-mint/40 bg-mint/10 p-3 text-sm text-mint">
                  {eventData.outcomeText}
                </div>
                <button
                  className="btn-ghost mt-4 px-6 py-2 font-display text-sm text-cyan-neon hover:text-foam"
                  onClick={handleDismissEvent}
                >
                  ПРОДОЛЖИТЬ ПУТЬ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Обратная совместимость: оверлей текстового события (если eventData не задан) */}
      {!eventData && hud.campaignEvent && !eventDismissed && (
        <div className="absolute inset-0 z-30 flex items-start justify-center bg-abyss/25 px-3 pt-20 sm:items-center sm:bg-abyss/70 sm:p-4">
          <div className="hud-chip flex max-w-[min(90vw,28rem)] flex-col items-center bg-abyss/75 px-4 py-3 text-center backdrop-blur-sm sm:px-6 sm:py-5">
            <div className="hud-label mb-1 sm:mb-2">СЛУЧАЙНОЕ СОБЫТИЕ</div>
            <p className="font-display text-xs leading-relaxed text-foam sm:text-base">
              {hud.campaignEvent}
            </p>
            <button
              className="btn-ghost mt-2 px-4 py-1.5 text-xs sm:mt-4 sm:px-5 sm:py-2 sm:text-sm"
              onClick={handleDismissEvent}
            >
              ПЛЫТЬ ДАЛЬШЕ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
