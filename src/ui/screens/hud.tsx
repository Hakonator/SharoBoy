import { useEffect, useRef } from "react"

import { DEBUG_TOOLS } from "../../config"
import {
  IconBall,
  IconBoss,
  IconMusic,
  IconPlay,
  IconPause,
  IconSound,
  EffectChip,
  VolSlider,
} from "../icons"
import type { HudData } from "../../game/types"
import type { BossDialogData } from "../../game/bossDialogs"
import { computeRunMultipliers, CAMPAIGN_MODIFIERS_MAP } from "../../game/campaignModifiers"

/** Наложение во время игры: верхний HUD-бар, цели на мобильных, эффекты, подсказки, баннер. */
export function HudOverlay({
  hud,
  inGame,
  portrait,
  onPause,
  onMute,
  onMusic,
  onMusicVolume,
  onSfxVolume,
  debug,
  onDebugSkipLevel,
  onExitCustomMap,
  onDismissBossDialog,
}: {
  hud: HudData
  inGame: boolean
  /** Вертикальный экран: HUD свёрнут в два ряда внутри зарезервированной
   *  неигровой зоны сверху (viewport.hudTopCss → Game.blockTop). */
  portrait: boolean
  onPause: () => void
  onMute: () => void
  onMusic: () => void
  /** Ползунок громкости музыки (0..1). */
  onMusicVolume: (v: number) => void
  /** Ползунок громкости эффектов (0..1). */
  onSfxVolume: (v: number) => void
  /** Режим отладки включён в меню. */
  debug: boolean
  /** Мгновенно завершить уровень через debug API. */
  onDebugSkipLevel: () => void
  onExitCustomMap: () => void
  /** Закрыть активный интро-диалог босса. */
  onDismissBossDialog?: () => void
}) {
  const canSkipLevel = DEBUG_TOOLS && debug && hud.phase === "playing"
  useEffect(() => {
    if (hud.mode !== "custom" || (hud.phase !== "playing" && hud.phase !== "paused")) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onExitCustomMap()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [hud.mode, hud.phase, onExitCustomMap])
  /* Портрет: чипы и кнопки компактнее — зона HUD уже (HUD_TOP_PORTRAIT_CSS),
   * и на планшетах в портрете чипы не растут до десктопных размеров. */
  const pad = portrait ? "px-2 py-1" : "px-3 py-1.5 sm:px-3.5 sm:py-2"
  const val = portrait ? "text-base" : "text-lg sm:text-2xl"
  const iconBtn = portrait ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10"
  const scoreChip = (
    <div className={`hud-chip ${pad}`}>
      <div className="hud-label">Счёт</div>
      <div className={`font-display ${val} leading-none text-foam tabular-nums`}>
        {hud.score.toLocaleString("ru-RU")}
      </div>
    </div>
  )
  /** Цели: компактный чип — в портрете всегда, в ландшафте только до md. */
  const goalsChip = (hidden: boolean) => (
    <div
      className={`hud-chip flex flex-col justify-center ${
        portrait ? "px-2 py-0.5" : "px-3 py-1"
      } font-display text-[11px] leading-tight text-cyan-neon ${hidden ? "md:hidden" : ""}`}
    >
      <span className="text-dim">
        {hud.mode === "endless" ? `ВОЛНА ${hud.wave}` : `УР. ${hud.level}/${hud.levelCount}`}
      </span>
      <span>
        ЦЕЛИ: <span className="tabular-nums">{hud.blocksLeft}</span>
      </span>
    </div>
  )
  const bestChip = (
    <div className={`hud-chip hidden ${pad} sm:block`}>
      <div className="hud-label">Рекорд</div>
      <div className={`font-display ${val} leading-none text-gold tabular-nums`}>
        {hud.best.toLocaleString("ru-RU")}
      </div>
    </div>
  )
  const comboChip =
    hud.combo >= 2 ? (
      <div key={`combo-${hud.combo}`} className={`hud-chip anim-combo ${pad}`}>
        <div className="hud-label">Серия</div>
        <div className={`font-display ${val} leading-none text-punch`}>×{hud.combo}</div>
      </div>
    ) : null
  const coinsChip =
    hud.coins > 0 ? (
      <div className={`hud-chip ${pad}`}>
        <div className="hud-label">Монеты</div>
        <div className={`font-display ${val} leading-none text-gold tabular-nums`}>{hud.coins}</div>
      </div>
    ) : null
  const shieldChip =
    hud.shield > 0 ? (
      <div key={`shield-${hud.shield}`} className={`hud-chip anim-combo ${pad}`}>
        <div className="hud-label">Щит</div>
        <div className={portrait ? "flex gap-1" : "mt-1 flex gap-1"}>
          {Array.from({ length: hud.shield }).map((_, i) => (
            <span
              key={i}
              className={`${portrait ? "h-3 w-3" : "h-3.5 w-3.5"} rounded-full bg-[#4dff9e] shadow-[0_0_8px_rgba(77,255,158,0.8)]`}
            />
          ))}
        </div>
      </div>
    ) : null
  const crystalsChip =
    hud.mode === "campaign" && (hud.crystals ?? 0) > 0 ? (
      <div className={`hud-chip ${pad} border-purple-500/20 bg-purple-950/20`}>
        <div className="hud-label text-purple-300">Кристаллы</div>
        <div className={`font-display ${val} leading-none text-purple-200 tabular-nums`}>
          {hud.crystals} 💎
        </div>
      </div>
    ) : null
  const { crystalMultiplier } = computeRunMultipliers(hud.campaignModifiers ?? [])
  const mutatorBadge =
    (hud.campaignModifiers?.length ?? 0) > 0 ? (
      <div
        className={`hud-chip hidden sm:flex items-center gap-1.5 border-purple-500/30 bg-purple-950/30 ${pad}`}
        title={(hud.campaignModifiers ?? [])
          .map((m) => CAMPAIGN_MODIFIERS_MAP[m]?.title ?? m)
          .join(", ")}
      >
        <div className="hud-label text-purple-300">Мутаторы</div>
        <div className={`font-display ${val} leading-none font-bold text-purple-200`}>
          ×{crystalMultiplier.toFixed(2)}
        </div>
      </div>
    ) : null
  const rightControls = (
    <div className="flex items-start gap-1.5 sm:gap-2">
      <div className={`hud-chip ${pad}`}>
        <div className="hud-label hidden sm:block">Жизни</div>
        <div className={portrait ? "flex gap-1" : "flex gap-1 sm:mt-1"}>
          {Array.from({ length: 5 }).map((_, i) => (
            <IconBall
              key={i}
              color="#35e0ff"
              className={`${portrait ? "h-3 w-3" : "h-3 w-3 sm:h-4 sm:w-4"} ${
                i < hud.lives ? "opacity-100" : "opacity-20 grayscale"
              }`}
            />
          ))}
        </div>
      </div>
      <button
        className={`icon-btn pointer-events-auto flex ${iconBtn} items-center justify-center`}
        onClick={onPause}
        aria-label="Пауза"
      >
        {hud.phase === "paused" ? <IconPlay /> : <IconPause />}
      </button>
      {canSkipLevel && (
        <button
          type="button"
          className={`icon-btn pointer-events-auto flex ${iconBtn} shrink-0 items-center justify-center rounded-lg border border-gold/70 bg-gold/20 text-gold shadow-[0_0_12px_rgba(255,201,77,0.35)] transition-transform hover:bg-gold/30 active:scale-95 font-display text-sm leading-tight sm:text-base`}
          aria-label="Быстро завершить уровень (Отладка)"
          title="Быстро завершить уровень (Отладка)"
          onClick={onDebugSkipLevel}
        >
          <span aria-hidden="true">⏭</span>
        </button>
      )}
      <div className="flex items-center gap-1.5">
        <button
          className={`icon-btn pointer-events-auto flex ${iconBtn} items-center justify-center`}
          onClick={onMusic}
          aria-label="Музыка"
        >
          <IconMusic off={hud.musicMuted} />
        </button>
        <VolSlider
          value={hud.musicVolume}
          onChange={onMusicVolume}
          label="Громкость музыки"
          className="hidden sm:block"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <button
          className={`icon-btn pointer-events-auto flex ${iconBtn} items-center justify-center`}
          onClick={onMute}
          aria-label="Звук"
        >
          <IconSound off={hud.muted} />
        </button>
        <VolSlider
          value={hud.sfxVolume}
          onChange={onSfxVolume}
          label="Громкость звука"
          className="hidden sm:block"
        />
      </div>
    </div>
  )
  return (
    <>
      {inGame && (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 ${
            portrait
              ? "flex flex-col gap-1 p-2"
              : "flex items-start justify-between gap-1.5 p-2 sm:gap-2 sm:p-4"
          }`}
        >
          {portrait ? (
            <>
              {/* Вертикальный экран: ряд 1 — счёт/цели и жизни/кнопки, ряд 2 —
                  рекорд/серия/монеты/щит. Высота зоны = HUD_TOP_PORTRAIT_CSS. */}
              <div className="flex items-start justify-between gap-1">
                <div className="flex flex-wrap items-start gap-1">
                  {scoreChip}
                  {goalsChip(false)}
                </div>
                {rightControls}
              </div>
              {(hud.best > 0 || comboChip || coinsChip || shieldChip || crystalsChip) && (
                <div className="flex flex-wrap items-start gap-1">
                  {bestChip}
                  {comboChip}
                  {coinsChip}
                  {crystalsChip}
                  {shieldChip}
                </div>
              )}
              {hud.activeChallenge && (
                <div
                  className={`hud-chip flex items-center justify-between px-3 py-1 text-xs font-bold ${
                    hud.activeChallenge.failed
                      ? "border-red-500/50 bg-red-950/40 text-red-300"
                      : hud.activeChallenge.completed
                        ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-200"
                        : "border-[#ff477e]/60 bg-[#ff477e]/15 text-[#ff477e]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>{hud.activeChallenge.title}</span>
                  </div>
                  <div className="tabular-nums font-display">{hud.activeChallenge.statusText}</div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
                {scoreChip}
                {goalsChip(true)}
                {bestChip}
                {comboChip}
                {coinsChip}
                {crystalsChip}
                {mutatorBadge}
                {shieldChip}
              </div>

              {/* Ландшафт/десктоп: центральная плашка челленджа или целей */}
              {hud.activeChallenge ? (
                <div
                  className={`hud-chip px-5 py-2 text-center transition-all ${
                    hud.activeChallenge.failed
                      ? "border-red-500/60 bg-red-950/50 text-red-300"
                      : hud.activeChallenge.completed
                        ? "border-emerald-500/60 bg-emerald-950/50 text-emerald-200 shadow-[0_0_16px_rgba(16,185,129,0.3)]"
                        : "border-[#ff477e]/60 bg-abyss/90 shadow-[0_0_20px_rgba(255,71,126,0.35)]"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm">🎯</span>
                    <span className="hud-label font-bold tracking-wider text-[#ff477e]">
                      {hud.activeChallenge.title}
                    </span>
                  </div>
                  <div className="font-display text-base font-bold tracking-wide sm:text-lg">
                    {hud.activeChallenge.statusText}
                  </div>
                  <div className="mt-0.5 text-[10px] text-foam/80">
                    Награда: +{hud.activeChallenge.rewardCrystals} 💎 +
                    {hud.activeChallenge.rewardMeta} 💠
                  </div>
                </div>
              ) : (
                <div className="hud-chip stripe-hazard hidden px-5 py-2 text-center md:block">
                  <div className="hud-label">
                    {hud.mode === "endless"
                      ? `Волна ${hud.wave} · ∞`
                      : `Уровень ${hud.level}/${hud.levelCount} · ${hud.levelName}`}
                  </div>
                  <div className="font-display text-lg leading-tight text-cyan-neon">
                    ЦЕЛИ: <span className="text-foam tabular-nums">{hud.blocksLeft}</span>
                  </div>
                </div>
              )}
              {rightControls}
            </>
          )}
        </div>
      )}

      {/* Телефон: лента эффектов — горизонтальная полоса по центру нижнего
          края, целиком НИЖЕ ракетки (тач-отступ 110 CSS px оставляет снизу
          свободную полосу ~100 px). Десктоп — как раньше, слева внизу. */}
      {inGame &&
        (hud.wideOn ||
          hud.slowOn ||
          hud.fastOn ||
          hud.shrinkOn ||
          hud.magnetOn ||
          hud.fireOn ||
          hud.frostOn ||
          hud.sparkOn ||
          hud.pierceOn ||
          hud.explosiveOn) && (
          <div className="pointer-events-none absolute inset-x-1 bottom-2 z-20 flex flex-wrap justify-center gap-1 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-[46vw] sm:gap-1.5">
            {hud.wideOn && <EffectChip label="ШИРЕ" good />}
            {hud.fireOn && <EffectChip label="ОГНЬ" good />}
            {hud.frostOn && <EffectChip label="МОРОЗ" good />}
            {hud.sparkOn && <EffectChip label="ЭЛЕКТРО" good />}
            {hud.pierceOn && <EffectChip label="КЛИН" good />}
            {hud.explosiveOn && <EffectChip label="ВЗРЫВ" good />}
            {hud.magnetOn && <EffectChip label="МАГНИТ" good />}
            {hud.slowOn && <EffectChip label="МЕДЛЕННЕЕ" good />}
            {hud.fastOn && <EffectChip label="БЫСТРЕЕ" good={false} />}
            {hud.shrinkOn && <EffectChip label="УЗКАЯ" good={false} />}
          </div>
        )}

      {hud.phase === "playing" && (
        /* Телефон: подсказки в свободной полосе ниже ракетки (над лентой
           эффектов); десктоп — как раньше, над ракеткой. При активной
           трансляции босса десктопные подсказки сдвигаются ниже ракетки (sm:bottom-3),
           чтобы полностью освободить зону над ракеткой для баннера босса. */
        <div
          className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1.5 sm:gap-2 ${
            (hud.bossTransmission ?? hud.bossDialog)
              ? "bottom-14 sm:bottom-3"
              : "bottom-14 sm:bottom-[102px]"
          }`}
        >
          {hud.laserArmed && (
            <div className="anim-blink hud-chip px-3 py-1.5 font-display text-xs tracking-wider text-[#9df2ff] sm:px-4 sm:py-2 sm:text-sm">
              ЛАЗЕР ГОТОВ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.rocketOn && (
            <div className="anim-blink hud-chip px-3 py-1.5 font-display text-xs tracking-wider text-mint sm:px-4 sm:py-2 sm:text-sm">
              РАКЕТЫ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.stuck && (
            <div className="anim-blink hud-chip px-3 py-1.5 font-display text-xs tracking-wider text-cyan-neon sm:px-4 sm:py-2 sm:text-sm">
              ТАП / КЛИК / ПРОБЕЛ — ЗАПУСК
            </div>
          )}
        </div>
      )}

      {hud.mode === "custom" && (hud.phase === "playing" || hud.phase === "paused") && (
        <button
          className="absolute bottom-4 right-4 z-40 rounded-lg border-2 border-punch bg-abyss/95 px-4 py-2 font-display text-sm font-black text-foam shadow-[0_0_16px_rgba(255,83,112,0.65)] hover:bg-punch hover:text-abyss"
          onClick={onExitCustomMap}
          type="button"
        >
          ⏹ В редактор
        </button>
      )}

      {(hud.bossTransmission ?? hud.bossDialog) && inGame && (
        <BossTransmissionBanner
          dialog={(hud.bossTransmission ?? hud.bossDialog)!}
          onDismiss={onDismissBossDialog}
        />
      )}

      {hud.banner && inGame && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="anim-banner px-6 text-center">
            <div
              className="font-display text-3xl tracking-wide text-foam sm:text-5xl"
              style={{ textShadow: "0 0 24px rgba(53,224,255,0.8), 0 4px 0 rgba(4,18,26,0.9)" }}
            >
              {hud.banner}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Неоновый терминал входящей трансляции / протокола босса станции «СФЕРА-1080». */
export function BossTransmissionBanner({
  dialog,
  onDismiss,
}: {
  dialog: BossDialogData
  onDismiss?: () => void
}) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    const t = setTimeout(() => {
      onDismissRef.current?.()
    }, 6000)
    return () => clearTimeout(t)
  }, [dialog.kind])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 pointer-coarse:bottom-[136px] z-30 flex justify-center px-2.5 sm:px-4">
      <style>{`
        @keyframes sb-trans-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div
        className="anim-rise relative w-full max-w-sm overflow-hidden rounded-xl border bg-abyss/95 p-2.5 shadow-2xl backdrop-blur-md transition-all sm:max-w-xl sm:p-4"
        style={{
          borderColor: dialog.accentColor,
          boxShadow: `0 0 25px ${dialog.accentColor}35, inset 0 0 15px ${dialog.accentColor}15`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1 opacity-80"
          style={{
            background: `linear-gradient(90deg, transparent, ${dialog.accentColor}, transparent)`,
          }}
        />

        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-deep/80 sm:h-11 sm:w-11"
              style={{ borderColor: `${dialog.accentColor}60` }}
            >
              <IconBoss kind={dialog.kind} className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-black sm:text-[10px]"
                  style={{ backgroundColor: dialog.accentColor }}
                >
                  {dialog.callsign}
                </span>
                <span className="truncate font-mono text-[9px] tracking-wider text-foam/60 sm:text-[11px]">
                  {dialog.protocol}
                </span>
              </div>
              <h3
                className="truncate font-display text-sm font-black tracking-wide sm:text-lg"
                style={{
                  color: dialog.accentColor,
                  textShadow: `0 0 12px ${dialog.accentColor}80`,
                }}
              >
                {dialog.name}
              </h3>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-red-500/30 bg-red-950/40 px-2 py-0.5 font-mono text-[9px] text-red-300 sm:text-[10px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
            <span>В ЭФИРЕ</span>
          </div>
        </div>

        <div className="mt-1.5 rounded-lg border border-foam/10 bg-deep/60 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-foam/90 sm:mt-2.5 sm:px-3 sm:py-2 sm:text-xs sm:leading-relaxed">
          <span className="mr-1.5 font-bold text-cyan-neon">›</span>
          <span>{dialog.introLine}</span>
          <span className="animate-pulse font-bold text-mint">_</span>
        </div>

        {/* Шкала авто-закрытия трансляции */}
        <div className="mt-1.5 sm:mt-2">
          <div className="h-1 w-full overflow-hidden rounded bg-foam/10">
            <div
              className="h-full"
              style={{
                backgroundColor: dialog.accentColor,
                animation: "sb-trans-progress 5.5s linear forwards",
                boxShadow: `0 0 8px ${dialog.accentColor}`,
              }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[8px] text-foam/50 sm:text-[10px]">
            <span>🛰 ПЕРЕХВАТ СИСТЕМЫ «СФЕРА-1080»</span>
            <span>АВТО-ЗАКРЫТИЕ</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Псевдоним для обратной совместимости. */
export const BossIntroBanner = BossTransmissionBanner
