import { useEffect, useRef, useState } from "react"

import type { HudData } from "../../game/types"
import {
  BALL_TRAILS,
  PADDLE_SKINS,
  TABLE_THEMES,
  isCosmeticUnlocked,
  type BallTrailId,
  type CosmeticCategory,
  type PaddleSkinId,
  type TableThemeId,
} from "../../game/cosmetics"
import { drawBackground } from "../../game/render/background"
import { drawPaddle } from "../../game/render/paddle"
import { drawBalls } from "../../game/render/projectiles"

interface MenuCosmeticsProps {
  hud: HudData
  onBuyCosmetic?: (category: CosmeticCategory, id: string) => void
  onEquipCosmetic?: (category: CosmeticCategory, id: string) => void
}

export function MenuCosmetics({ hud, onBuyCosmetic, onEquipCosmetic }: MenuCosmeticsProps) {
  const [activeCategory, setActiveCategory] = useState<CosmeticCategory>("paddle")
  const [hoveredItem, setHoveredItem] = useState<{ category: CosmeticCategory; id: string } | null>(
    null
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const cosmetics = hud.cosmetics ?? {
    unlocked: ["paddle:default", "ball:default", "theme:ocean"],
    equipped: { paddle: "default", ball: "default", theme: "ocean" },
  }

  // Для превью используем элемент под курсором или текущий экипированный
  const previewPaddle: PaddleSkinId =
    hoveredItem?.category === "paddle"
      ? (hoveredItem.id as PaddleSkinId)
      : cosmetics.equipped.paddle
  const previewBall: BallTrailId =
    hoveredItem?.category === "ball" ? (hoveredItem.id as BallTrailId) : cosmetics.equipped.ball
  const previewTheme: TableThemeId =
    hoveredItem?.category === "theme" ? (hoveredItem.id as TableThemeId) : cosmetics.equipped.theme

  // Анимационный цикл интерактивного превью
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId = 0
    const startTime = performance.now()
    const trailHistory: { x: number; y: number }[] = []

    const render = (now: number) => {
      const time = (now - startTime) / 1000
      const w = canvas.width
      const h = canvas.height

      // Фоновые пузырьки
      const bubbles = [
        { x: w * 0.18, y: (((h * 0.8 - time * 18) % h) + h) % h, r: 2.5, vy: -18, ph: 0 },
        { x: w * 0.45, y: (((h * 0.6 - time * 24) % h) + h) % h, r: 3.2, vy: -24, ph: 1 },
        { x: w * 0.78, y: (((h * 0.9 - time * 15) % h) + h) % h, r: 2.0, vy: -15, ph: 2 },
      ]

      // 1. Отрисовка фона выбранной темы
      drawBackground(ctx, w, h, 0, bubbles, previewTheme)

      // 2. Движение ракетки
      const paddleX = w / 2 + Math.sin(time * 1.8) * (w * 0.22)
      const paddleY = h - 18
      const paddleW = Math.min(84, w * 0.32)
      const paddleH = 12

      drawPaddle(ctx, {
        time,
        p: {
          x: paddleX,
          y: paddleY,
          w: paddleW,
          h: paddleH,
          baseW: paddleW,
          vx: Math.cos(time * 1.8) * 80,
          squash: Math.sin(time * 3.6) * 0.1,
          rot: 0,
        },
        wideUntil: 0,
        shrinkUntil: 0,
        laserUntil: 0,
        laserArmed: false,
        rocketUntil: 0,
        magnetUntil: 0,
        skin: previewPaddle,
      })

      // 3. Движение и шлейф шара
      const ballBounce = Math.abs(Math.sin(time * 3.2))
      const ballX = paddleX + Math.sin(time * 3.2) * 14
      const ballY = paddleY - 14 - ballBounce * (h * 0.48)
      const ballR = 6.5

      trailHistory.push({ x: ballX, y: ballY })
      if (trailHistory.length > 7) trailHistory.shift()

      drawBalls(
        ctx,
        [
          {
            x: ballX,
            y: ballY,
            vx: 0,
            vy: 0,
            r: ballR,
            speed: 1,
            stuck: false,
            stuckOffset: 0,
            trail: [...trailHistory],
            squash: ballBounce < 0.1 ? 0.35 : 0,
            sinceHit: 0,
          },
        ],
        {
          time,
          fire: false,
          frost: false,
          spark: false,
          slow: false,
          fast: false,
          trailSkin: previewBall,
        }
      )

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [previewPaddle, previewBall, previewTheme])

  const metaCrystals = hud.metaCrystals ?? 0

  return (
    <div className="space-y-3">
      {/* Шапка витрины: баланс кристаллов и подсказка */}
      <div className="flex items-center justify-between border-b border-line/40 pb-2 px-1">
        <span className="text-xs text-dim">Кастомизация стола и снаряжения</span>
        <div
          className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-950/40 px-2.5 py-1 text-xs font-display font-bold text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
          title="Несгораемые мета-кристаллы. Зарабатываются за победу над боссами кампании."
        >
          <span>💠</span>
          <span>{metaCrystals.toLocaleString("ru-RU")}</span>
          <span className="text-[10px] text-cyan-400/70 font-sans font-normal">кристаллов</span>
        </div>
      </div>

      {/* Интерактивное живое превью */}
      <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-black/60 shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={115}
          className="h-28 w-full block object-cover"
        />
        <div className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-abyss/70 px-1.5 py-0.5 font-mono text-[9px] text-dim/80 backdrop-blur-sm">
          Живое превью
        </div>
      </div>

      {/* Переключатель категорий косметики */}
      <div className="flex items-center gap-1.5">
        {[
          { id: "paddle" as const, label: "🏓 Ракетки" },
          { id: "ball" as const, label: "☄️ Шлейфы" },
          { id: "theme" as const, label: "🌌 Темы" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveCategory(tab.id)}
            className={`flex-1 rounded-lg py-1.5 font-display text-xs transition ${
              activeCategory === tab.id
                ? "bg-cyan-500/25 text-cyan-200 font-bold ring-1 ring-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                : "bg-deep/50 text-dim hover:text-foam hover:bg-deep/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Список доступных предметов выбранной категории */}
      <div className="space-y-2">
        {activeCategory === "paddle" &&
          PADDLE_SKINS.map((item) => {
            const isEquipped = cosmetics.equipped.paddle === item.id
            const unlocked = isCosmeticUnlocked("paddle", item.id, cosmetics)
            const afford = metaCrystals >= item.cost

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredItem({ category: "paddle", id: item.id })}
                onMouseLeave={() => setHoveredItem(null)}
                className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition ${
                  isEquipped
                    ? "border-cyan-400/60 bg-cyan-950/30 shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                    : unlocked
                      ? "border-line/60 bg-deep/60 hover:border-cyan-400/40"
                      : afford
                        ? "border-cyan-500/30 bg-deep/40 hover:border-cyan-400/60"
                        : "border-line/30 bg-deep/20 opacity-75"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span className="font-display text-xs font-bold text-foam sm:text-sm">
                      {item.name}
                    </span>
                    {/* Цветовой маркер скина */}
                    <span
                      className="h-2.5 w-7 rounded-sm border border-white/20 shadow-sm"
                      style={{
                        background: `linear-gradient(90deg, ${item.colors.top}, ${item.colors.mid}, ${item.colors.dark})`,
                        boxShadow: `0 0 8px ${item.colors.glow}`,
                      }}
                      title="Палитра скина"
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-dim/90">{item.desc}</div>
                </div>

                <div className="shrink-0 flex items-center">
                  {isEquipped ? (
                    <span className="rounded border border-cyan-400/60 bg-cyan-500/20 px-2.5 py-1 font-display text-xs font-bold text-cyan-200 shadow-[0_0_8px_rgba(0,240,255,0.3)]">
                      ✓ Надет
                    </span>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => onEquipCosmetic?.("paddle", item.id)}
                      className="rounded border border-mint/50 bg-mint/15 hover:bg-mint/30 px-3 py-1 font-display text-xs font-bold text-mint transition active:scale-95"
                    >
                      Надеть
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!afford}
                      onClick={() => onBuyCosmetic?.("paddle", item.id)}
                      className={`rounded px-2.5 py-1 font-display text-xs font-bold transition ${
                        afford
                          ? "bg-cyan-neon text-abyss shadow-[0_0_10px_rgba(0,240,255,0.4)] hover:scale-105 active:scale-95"
                          : "border border-line/40 bg-deep/80 text-dim/60 cursor-not-allowed"
                      }`}
                      title={afford ? undefined : "Недостаточно мета-кристаллов"}
                    >
                      {item.cost} 💠
                    </button>
                  )}
                </div>
              </div>
            )
          })}

        {activeCategory === "ball" &&
          BALL_TRAILS.map((item) => {
            const isEquipped = cosmetics.equipped.ball === item.id
            const unlocked = isCosmeticUnlocked("ball", item.id, cosmetics)
            const afford = metaCrystals >= item.cost

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredItem({ category: "ball", id: item.id })}
                onMouseLeave={() => setHoveredItem(null)}
                className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition ${
                  isEquipped
                    ? "border-cyan-400/60 bg-cyan-950/30 shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                    : unlocked
                      ? "border-line/60 bg-deep/60 hover:border-cyan-400/40"
                      : afford
                        ? "border-cyan-500/30 bg-deep/40 hover:border-cyan-400/60"
                        : "border-line/30 bg-deep/20 opacity-75"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span className="font-display text-xs font-bold text-foam sm:text-sm">
                      {item.name}
                    </span>
                    {/* Индикатор цвета шлейфа */}
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-white/20 shadow-sm"
                      style={{
                        backgroundColor: item.colors.mid,
                        boxShadow: `0 0 8px ${item.colors.glow}`,
                      }}
                      title="Цвет ядра"
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-dim/90">{item.desc}</div>
                </div>

                <div className="shrink-0 flex items-center">
                  {isEquipped ? (
                    <span className="rounded border border-cyan-400/60 bg-cyan-500/20 px-2.5 py-1 font-display text-xs font-bold text-cyan-200 shadow-[0_0_8px_rgba(0,240,255,0.3)]">
                      ✓ Надет
                    </span>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => onEquipCosmetic?.("ball", item.id)}
                      className="rounded border border-mint/50 bg-mint/15 hover:bg-mint/30 px-3 py-1 font-display text-xs font-bold text-mint transition active:scale-95"
                    >
                      Надеть
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!afford}
                      onClick={() => onBuyCosmetic?.("ball", item.id)}
                      className={`rounded px-2.5 py-1 font-display text-xs font-bold transition ${
                        afford
                          ? "bg-cyan-neon text-abyss shadow-[0_0_10px_rgba(0,240,255,0.4)] hover:scale-105 active:scale-95"
                          : "border border-line/40 bg-deep/80 text-dim/60 cursor-not-allowed"
                      }`}
                      title={afford ? undefined : "Недостаточно мета-кристаллов"}
                    >
                      {item.cost} 💠
                    </button>
                  )}
                </div>
              </div>
            )
          })}

        {activeCategory === "theme" &&
          TABLE_THEMES.map((item) => {
            const isEquipped = cosmetics.equipped.theme === item.id
            const unlocked = isCosmeticUnlocked("theme", item.id, cosmetics)
            const afford = metaCrystals >= item.cost

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredItem({ category: "theme", id: item.id })}
                onMouseLeave={() => setHoveredItem(null)}
                className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition ${
                  isEquipped
                    ? "border-cyan-400/60 bg-cyan-950/30 shadow-[0_0_12px_rgba(0,240,255,0.15)]"
                    : unlocked
                      ? "border-line/60 bg-deep/60 hover:border-cyan-400/40"
                      : afford
                        ? "border-cyan-500/30 bg-deep/40 hover:border-cyan-400/60"
                        : "border-line/30 bg-deep/20 opacity-75"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.icon}</span>
                    <span className="font-display text-xs font-bold text-foam sm:text-sm">
                      {item.name}
                    </span>
                    {/* Градиент темы стола */}
                    <span
                      className="h-2.5 w-7 rounded-sm border border-white/20 shadow-sm"
                      style={{
                        background: `linear-gradient(180deg, ${item.colors.bgTop}, ${item.colors.bgBot})`,
                      }}
                      title="Цветовая гамма темы"
                    />
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-dim/90">{item.desc}</div>
                </div>

                <div className="shrink-0 flex items-center">
                  {isEquipped ? (
                    <span className="rounded border border-cyan-400/60 bg-cyan-500/20 px-2.5 py-1 font-display text-xs font-bold text-cyan-200 shadow-[0_0_8px_rgba(0,240,255,0.3)]">
                      ✓ Выбрана
                    </span>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => onEquipCosmetic?.("theme", item.id)}
                      className="rounded border border-mint/50 bg-mint/15 hover:bg-mint/30 px-3 py-1 font-display text-xs font-bold text-mint transition active:scale-95"
                    >
                      Выбрать
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!afford}
                      onClick={() => onBuyCosmetic?.("theme", item.id)}
                      className={`rounded px-2.5 py-1 font-display text-xs font-bold transition ${
                        afford
                          ? "bg-cyan-neon text-abyss shadow-[0_0_10px_rgba(0,240,255,0.4)] hover:scale-105 active:scale-95"
                          : "border border-line/40 bg-deep/80 text-dim/60 cursor-not-allowed"
                      }`}
                      title={afford ? undefined : "Недостаточно мета-кристаллов"}
                    >
                      {item.cost} 💠
                    </button>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
