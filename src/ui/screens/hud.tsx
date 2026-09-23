import {
  IconBall,
  IconMusic,
  IconPlay,
  IconPause,
  IconSound,
  EffectChip,
  VolSlider,
} from "../icons"
import type { HudData } from "../../game/types"

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
}) {
  const scoreChip = (
    <div className="hud-chip px-3 py-1.5 sm:px-3.5 sm:py-2">
      <div className="hud-label">Счёт</div>
      <div className="font-display text-lg leading-none text-foam tabular-nums sm:text-2xl">
        {hud.score.toLocaleString("ru-RU")}
      </div>
    </div>
  )
  /** Цели: компактный чип — в портрете всегда, в ландшафте только до md. */
  const goalsChip = (hidden: boolean) => (
    <div
      className={`hud-chip flex flex-col justify-center px-3 py-1 font-display text-[11px] leading-tight text-cyan-neon ${
        hidden ? "md:hidden" : ""
      }`}
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
    <div className="hud-chip hidden px-3.5 py-2 sm:block">
      <div className="hud-label">Рекорд</div>
      <div className="font-display text-xl leading-none text-gold tabular-nums sm:text-2xl">
        {hud.best.toLocaleString("ru-RU")}
      </div>
    </div>
  )
  const comboChip =
    hud.combo >= 2 ? (
      <div key={`combo-${hud.combo}`} className="hud-chip anim-combo px-3 py-1.5 sm:px-3.5 sm:py-2">
        <div className="hud-label">Серия</div>
        <div className="font-display text-lg leading-none text-punch sm:text-2xl">×{hud.combo}</div>
      </div>
    ) : null
  const coinsChip =
    hud.coins > 0 ? (
      <div className="hud-chip px-3 py-1.5 sm:px-3.5 sm:py-2">
        <div className="hud-label">Монеты</div>
        <div className="font-display text-lg leading-none text-gold tabular-nums sm:text-2xl">
          {hud.coins}
        </div>
      </div>
    ) : null
  const shieldChip =
    hud.shield > 0 ? (
      <div
        key={`shield-${hud.shield}`}
        className="hud-chip anim-combo px-3 py-1.5 sm:px-3.5 sm:py-2"
      >
        <div className="hud-label">Щит</div>
        <div className="mt-1 flex gap-1">
          {Array.from({ length: hud.shield }).map((_, i) => (
            <span
              key={i}
              className="h-3.5 w-3.5 rounded-full bg-[#4dff9e] shadow-[0_0_8px_rgba(77,255,158,0.8)]"
            />
          ))}
        </div>
      </div>
    ) : null
  const rightControls = (
    <div className="flex items-start gap-1.5 sm:gap-2">
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
      <button
        className="icon-btn pointer-events-auto flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10"
        onClick={onPause}
        aria-label="Пауза"
      >
        {hud.phase === "paused" ? <IconPlay /> : <IconPause />}
      </button>
      <div className="flex items-center gap-1.5">
        <button
          className="icon-btn pointer-events-auto flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10"
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
          className="icon-btn pointer-events-auto flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10"
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
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 p-2 sm:p-4 ${
            portrait
              ? "flex flex-col gap-1.5 sm:gap-2"
              : "flex items-start justify-between gap-1.5 sm:gap-2"
          }`}
        >
          {portrait ? (
            <>
              {/* Вертикальный экран: ряд 1 — счёт/цели и жизни/кнопки, ряд 2 —
                  рекорд/серия/монеты/щит. Высота зоны = HUD_TOP_PORTRAIT_CSS. */}
              <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
                  {scoreChip}
                  {goalsChip(false)}
                </div>
                {rightControls}
              </div>
              {(hud.best > 0 || comboChip || coinsChip || shieldChip) && (
                <div className="flex flex-wrap items-start gap-1.5 sm:gap-2">
                  {bestChip}
                  {comboChip}
                  {coinsChip}
                  {shieldChip}
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
                {shieldChip}
              </div>

              {/* Ландшафт/десктоп: центральная плашка целей на md+ */}
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
              {rightControls}
            </>
          )}
        </div>
      )}

      {inGame &&
        (hud.wideOn ||
          hud.slowOn ||
          hud.fastOn ||
          hud.shrinkOn ||
          hud.magnetOn ||
          hud.fireOn ||
          hud.frostOn ||
          hud.sparkOn) && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex max-w-[46vw] flex-wrap gap-1.5 sm:bottom-4 sm:left-4">
            {hud.wideOn && <EffectChip label="ШИРЕ" good />}
            {hud.fireOn && <EffectChip label="ОГНЬ" good />}
            {hud.frostOn && <EffectChip label="МОРОЗ" good />}
            {hud.sparkOn && <EffectChip label="ЭЛЕКТРО" good />}
            {hud.magnetOn && <EffectChip label="МАГНИТ" good />}
            {hud.slowOn && <EffectChip label="МЕДЛЕННЕЕ" good />}
            {hud.fastOn && <EffectChip label="БЫСТРЕЕ" good={false} />}
            {hud.shrinkOn && <EffectChip label="УЗКАЯ" good={false} />}
          </div>
        )}

      {hud.phase === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[96px] z-20 flex flex-col items-center gap-2 sm:bottom-[102px]">
          {hud.laserArmed && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-[#9df2ff]">
              ЛАЗЕР ГОТОВ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.rocketOn && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-mint">
              РАКЕТЫ — ПРОБЕЛ / ТАП
            </div>
          )}
          {hud.stuck && (
            <div className="anim-blink hud-chip px-4 py-2 font-display text-sm tracking-wider text-cyan-neon">
              ТАП / КЛИК / ПРОБЕЛ — ЗАПУСК
            </div>
          )}
        </div>
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
