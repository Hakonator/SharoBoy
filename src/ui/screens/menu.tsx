import { type ReactNode } from "react"

import { ACHIEVEMENTS } from "../../game/achievements"
import { MAX_NICK } from "../../game/profanity"
import { ControlsPanel, FloatingBalls } from "../icons"
import type { GlobalScore, LeadPeriod, ScreenFilter } from "../../game/leaderboard"
import type { HudData } from "../../game/types"

import { MenuSection } from "./shared"
import { MenuRecords, MenuGlobalTop } from "./menuTop"
import { MenuCornerControls, MenuUpgrades } from "./menuPanels"
import { MenuDebug } from "./menuPanels2"
import type { PlayerStats } from "./types"

export function MenuScreen({
  hud,
  stats,
  nick,
  period,
  screen,
  globalTop,
  globalTopEndless,
  unlocked,
  topSubmit,
  onNickChange,
  onPeriod,
  onScreen,
  onCampaign,
  onEndless,
  onBuyUpgrade,
  debug,
  onToggleDebug,
  debugBoss,
  onSelectDebugBoss,
  isDebugEffectActive,
  onToggleDebugEffect,
  onDebugStartGame,
  onMute,
  onMusic,
  onMusicVolume,
  onSfxVolume,
  showFps,
  onToggleFps,
}: {
  hud: HudData
  stats: PlayerStats
  nick: string
  period: LeadPeriod
  screen: ScreenFilter
  globalTop: GlobalScore[]
  globalTopEndless: GlobalScore[]
  unlocked: Record<string, number>
  topSubmit: ReactNode
  onNickChange: (v: string) => void
  onPeriod: (p: LeadPeriod) => void
  onScreen: (s: ScreenFilter) => void
  onCampaign: () => void
  onEndless: () => void
  onBuyUpgrade: (id: string) => void
  /** Режим отладки включён. */
  debug: boolean
  /** Переключатель режима отладки. */
  onToggleDebug: () => void
  /** Выбранный босс для тестирования (одиночный выбор). */
  debugBoss: string
  /** Выбрать босса для тестирования. */
  onSelectDebugBoss: (boss: string) => void
  /** Активен ли эффект отладки. */
  isDebugEffectActive: (id: string) => boolean
  /** Переключить эффект отладки. */
  onToggleDebugEffect: (id: string) => void
  /** Запустить уровень с выбранными настройками отладки. */
  onDebugStartGame: () => void
  /** Переключить звуковые эффекты (кнопка в углу меню). */
  onMute: () => void
  /** Переключить фоновую музыку (кнопка в углу меню). */
  onMusic: () => void
  /** Ползунок громкости музыки (0..1). */
  onMusicVolume: (v: number) => void
  /** Ползунок громкости эффектов (0..1). */
  onSfxVolume: (v: number) => void
  /** Показывается ли счётчик FPS на канвасе. */
  showFps: boolean
  /** Переключить отображение счётчика FPS. */
  onToggleFps: () => void
}) {
  /** Есть улучшение, которое игрок уже может купить, — индикатор на секции. */

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto">
      <FloatingBalls />
      <MenuCornerControls
        hud={hud}
        showFps={showFps}
        onToggleFps={onToggleFps}
        onMute={onMute}
        onMusic={onMusic}
        onMusicVolume={onMusicVolume}
        onSfxVolume={onSfxVolume}
      />
      <div className="relative flex min-h-full flex-col items-start justify-center gap-8 p-6 md:flex-row md:items-center md:gap-16 md:p-16 lg:p-24">
        <div className="anim-rise max-w-xl">
          <h1 className="font-display leading-[0.95]">
            <span className="title-glow block text-6xl text-foam sm:text-7xl lg:text-8xl">
              ШАРО
            </span>
            <span className="title-glow block text-6xl text-cyan-neon sm:text-7xl lg:text-8xl">
              БОЙ<span className="text-punch">!</span>
            </span>
          </h1>
          <p className="mt-5 hidden max-w-md text-base leading-relaxed text-foam/80 sm:block sm:text-lg">
            Вместо кирпичей — <b className="text-mint">шары</b> и <b className="text-gold">овалы</b>{" "}
            разной величины. Отбивай ракеткой, собирай серии, лови бонусы, одолей{" "}
            <b className="text-cyan-neon">4 уровня с боссом</b> — или выживай в{" "}
            <b className="text-punch">бесконечных волнах</b>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button className="btn-arcade px-8 py-4 text-lg sm:text-xl" onClick={onCampaign}>
              Кампания
            </button>
            <button
              className="btn-ghost px-6 py-4 font-display text-base sm:text-lg"
              onClick={onEndless}
            >
              Бесконечный
            </button>
            {hud.best > 0 && (
              <div className="hud-chip px-4 py-3">
                <div className="hud-label">Рекорд</div>
                <div className="font-display text-xl text-gold tabular-nums">
                  {hud.best.toLocaleString("ru-RU")}
                </div>
              </div>
            )}
          </div>

          {/* Ник доступен всегда — он подписывает и локальные рекорды,
              и отправку в мировой топ (не зависит от подключения Supabase). */}
          <div className="hud-chip mt-4 w-full max-w-64 p-3">
            <div className="hud-label mb-2">Ник для рекордов</div>
            <input
              value={nick}
              maxLength={MAX_NICK}
              placeholder="Без ника"
              onChange={(e) => onNickChange(e.target.value)}
              onKeyDown={(e) => {
                /* не даём движку ловить пробел/латиницу как управление */
                e.stopPropagation()
              }}
              className="h-10 w-full border border-line bg-deep px-3 font-display text-sm text-foam outline-none placeholder:text-dim/60 focus:border-cyan-neon"
            />
          </div>
        </div>

        <div className="anim-rise w-full max-w-sm md:max-w-md" style={{ animationDelay: "0.12s" }}>
          <div className="space-y-2.5">
            {topSubmit}
            {stats.games > 0 && (
              <div className="hud-chip flex items-stretch justify-between gap-2 px-4 py-2.5">
                {[
                  ["Игр", String(stats.games), "text-foam"],
                  ["Побед", String(stats.wins), "text-mint"],
                  ["Счёт", stats.bestScore.toLocaleString("ru-RU"), "text-gold"],
                  [
                    stats.bestWave > 0 ? "Волна" : "Уровень",
                    String(stats.bestWave > 0 ? stats.bestWave : stats.topLevel),
                    "text-cyan-neon",
                  ],
                ].map(([label, value, color]) => (
                  <div key={label} className="min-w-0 text-center">
                    <div className="hud-label">{label}</div>
                    <div className={`font-display text-sm leading-tight tabular-nums ${color}`}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <MenuRecords hud={hud} />
            <MenuUpgrades hud={hud} onBuyUpgrade={onBuyUpgrade} />
            {/* Секция отладки — для тестирования новых механик */}
            <MenuDebug
              debug={debug}
              onToggleDebug={onToggleDebug}
              debugBoss={debugBoss}
              onSelectDebugBoss={onSelectDebugBoss}
              isDebugEffectActive={isDebugEffectActive}
              onToggleDebugEffect={onToggleDebugEffect}
              onDebugStartGame={onDebugStartGame}
            />
            <MenuSection
              title="🏅 Достижения"
              badge={`${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}`}
            >
              <div className="grid grid-cols-2 gap-2">
                {ACHIEVEMENTS.map((d) => {
                  const got = !!unlocked[d.id]
                  return (
                    <div
                      key={d.id}
                      className={`rounded-lg border p-2 ${
                        got ? "border-gold/50 bg-gold/10" : "border-line/50 bg-deep/40 opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">{got ? d.icon : "🔒"}</span>
                        <div className="min-w-0">
                          <div className={`font-display text-sm ${got ? "text-gold" : "text-dim"}`}>
                            {d.name}
                          </div>
                          <div className="truncate text-[11px] text-dim">{d.desc}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </MenuSection>
            <MenuGlobalTop
              period={period}
              screen={screen}
              globalTop={globalTop}
              globalTopEndless={globalTopEndless}
              onPeriod={onPeriod}
              onScreen={onScreen}
            />
            <MenuSection title="🎮 Управление">
              <ControlsPanel />
            </MenuSection>
            <MenuSection title="🎁 Бонусы">
              <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-dim">
                <span className="rounded border border-line/60 bg-deep/50 px-2 py-1">
                  <b className="text-mint">зелёные</b> — 1 удар
                </span>
                <span className="rounded border border-line/60 bg-deep/50 px-2 py-1">
                  <b className="text-gold">жёлтые</b> — 2 удара
                </span>
                <span className="rounded border border-line/60 bg-deep/50 px-2 py-1">
                  <b className="text-coral">красные</b> — 3 удара
                </span>
                <span className="rounded border border-line/60 bg-deep/50 px-2 py-1">
                  <b className="text-mint">с шариками внутри</b> — рассыпаются
                </span>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-dim">
                <span>
                  <b className="text-[#4dff9e]">«ШИР»</b> — широкая ракетка
                </span>
                <span>
                  <b className="text-[#4dff9e]">«×3»</b> — тройной шар
                </span>
                <span>
                  <b className="text-[#4dff9e]">«+1»</b> — жизнь
                </span>
                <span>
                  <b className="text-[#4dff9e]">«МАГ»</b> — магнит шара
                </span>
                <span>
                  <b className="text-[#4dff9e]">«ОГНЬ»</b> — прожигает блоки
                </span>
                <span>
                  <b className="text-[#4dff9e]">«ЩИТ/ЛАЗ/РКТ»</b> — экран и оружие
                </span>
                <span>
                  <b className="text-[#4dff9e]">«ЛАЗ»</b> — луч на 2 с, выстрел — пробел
                </span>
                <span>
                  <b className="text-coral">«СК↑/УЗК»</b> — анти-бонусы
                </span>
              </div>
              <div className="mt-3 border-t border-line pt-2.5 text-xs text-dim">
                Тёмные <b className="text-coral">бомбы с фитилём</b> детонируют по площади — собирай
                цепочки!
              </div>
            </MenuSection>
          </div>
        </div>
      </div>
    </div>
  )
}
/** Пауза: продолжение, рестарт, выход в меню. */
