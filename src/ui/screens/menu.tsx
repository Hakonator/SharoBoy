import { useState, type ReactNode } from "react"

import { ACHIEVEMENTS } from "../../game/achievements"
import { MAX_NICK } from "../../game/profanity"
import { DEBUG_TOOLS } from "../../config"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../../game/upgrades"
import { ControlsPanel, FloatingBalls } from "../icons"
import type { GlobalScore, LeadPeriod, ScreenFilter } from "../../game/leaderboard"
import type { HudData } from "../../game/types"

import { MenuRecords, MenuGlobalTop } from "./menuTop"
import { MenuCornerControls, MenuDebug, MenuUpgrades, MenuAchievements } from "./menuPanels"
import type { PlayerStats } from "./types"

type MenuTabId = "upgrades" | "records" | "achievements" | "guide" | "debug"

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
  onCommunityMaps,
  onAdmin,
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
  onOpenSettings,
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
  onCommunityMaps: () => void
  onAdmin: () => void
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
  /** Открыть модальное окно настроек. */
  onOpenSettings?: () => void
}) {
  /** Активная вкладка в правой панели дашборда. Клик по активной сворачивает её. */
  const [activeTab, setActiveTab] = useState<MenuTabId | null>("upgrades")
  const [recordsSubTab, setRecordsSubTab] = useState<"local" | "global">("local")
  const [guideSubTab, setGuideSubTab] = useState<"controls" | "bonuses">("controls")

  /** Проверяем, есть ли улучшения, доступные для покупки прямо сейчас. */
  const canBuyAnyUpgrade =
    UPGRADES_ENABLED &&
    UPGRADE_DEFS.some((u) => {
      const lvl = hud.upgrades[u.id] ?? 0
      return lvl < u.max && hud.coins >= u.cost(lvl)
    })

  const unlockedCount = Object.keys(unlocked).length

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto md:overflow-hidden">
      <FloatingBalls />
      <MenuCornerControls
        hud={hud}
        onMute={onMute}
        onMusic={onMusic}
        onMusicVolume={onMusicVolume}
        onSfxVolume={onSfxVolume}
        onSettings={onOpenSettings}
      />
      <div className="relative flex min-h-full flex-col items-start justify-center gap-6 p-4 sm:p-6 md:h-full md:flex-row md:items-center md:gap-10 lg:gap-14 md:p-8 lg:p-12">
        {/* Левая колонка: логотип, режимы игры, ник */}
        <div className="anim-rise max-w-xl shrink-0">
          <h1 className="font-display leading-[0.95]">
            <span className="title-glow block text-6xl text-foam sm:text-7xl lg:text-8xl">
              ШАРО
            </span>
            <span className="title-glow block text-6xl text-cyan-neon sm:text-7xl lg:text-8xl">
              БОЙ<span className="text-punch">!</span>
            </span>
          </h1>
          <p className="mt-4 hidden max-w-md text-sm leading-relaxed text-foam/80 sm:block sm:text-base">
            Вместо кирпичей — <b className="text-mint">шары</b> и <b className="text-gold">овалы</b>{" "}
            разной величины. Отбивай ракеткой, собирай серии, лови бонусы, одолей{" "}
            <b className="text-cyan-neon">4 уровня с боссом</b> — или выживай в{" "}
            <b className="text-punch">бесконечных волнах</b>.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="btn-arcade px-7 py-3.5 text-base sm:text-lg" onClick={onCampaign}>
              Кампания
            </button>
            <button
              className="btn-ghost px-5 py-3.5 font-display text-sm sm:text-base"
              onClick={onCommunityMaps}
              type="button"
            >
              🗺 Карты сообщества
            </button>
            <button
              className="btn-ghost px-5 py-3.5 font-display text-sm sm:text-base"
              onClick={onEndless}
            >
              Бесконечный
            </button>
            {hud.best > 0 && (
              <div className="hud-chip px-3.5 py-2.5">
                <div className="hud-label">Рекорд</div>
                <div className="font-display text-lg text-gold tabular-nums">
                  {hud.best.toLocaleString("ru-RU")}
                </div>
              </div>
            )}
          </div>
          <button
            className="mt-3 text-xs text-dim underline decoration-line underline-offset-4 hover:text-gold"
            onClick={onAdmin}
            type="button"
          >
            🛡️ Панель модерации
          </button>

          {/* Ник доступен всегда — подписывает рекорды */}
          <div className="hud-chip mt-3 w-full max-w-64 p-2.5">
            <div className="hud-label mb-1.5">Ник для рекордов</div>
            <input
              value={nick}
              maxLength={MAX_NICK}
              placeholder="Без ника"
              onChange={(e) => onNickChange(e.target.value)}
              onKeyDown={(e) => {
                /* не даём движку ловить пробел/латиницу как управление */
                e.stopPropagation()
              }}
              className="h-9 w-full border border-line bg-deep px-3 font-display text-sm text-foam outline-none placeholder:text-dim/60 focus:border-cyan-neon"
            />
          </div>
        </div>

        {/* Правая колонка: Табовый Dashboard (0 скролла окна на ПК, компактный на мобильном) */}
        <div
          className="anim-rise flex w-full max-w-md flex-col md:max-w-lg lg:max-w-xl"
          style={{ animationDelay: "0.12s" }}
        >
          <div className="space-y-2.5">
            {topSubmit}

            {stats.games > 0 && (
              <div className="hud-chip flex items-stretch justify-between gap-2 px-3.5 py-2">
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
                    <div className="hud-label text-[10px]">{label}</div>
                    <div
                      className={`font-display text-xs leading-tight tabular-nums sm:text-sm ${color}`}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Единая карточка с табами */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-line/60 bg-deep/80 shadow-2xl backdrop-blur-md">
              {/* Навигационная панель табов */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-line/50 bg-abyss/85 p-2 sm:p-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab((cur) => (cur === "upgrades" ? null : "upgrades"))}
                  className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-display text-xs transition sm:text-sm ${
                    activeTab === "upgrades"
                      ? "bg-gold/20 text-gold ring-1 ring-gold/50 shadow-[0_0_10px_rgba(255,201,77,0.25)] font-bold"
                      : "bg-deep/50 text-dim hover:text-foam hover:bg-deep/90"
                  }`}
                >
                  <span>🛠 Прокачка</span>
                  {canBuyAnyUpgrade && (
                    <span
                      className="h-2 w-2 rounded-full bg-gold animate-pulse shadow-[0_0_6px_#ffc94d]"
                      title="Доступны покупки"
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab((cur) => (cur === "records" ? null : "records"))}
                  className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-display text-xs transition sm:text-sm ${
                    activeTab === "records"
                      ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.25)] font-bold"
                      : "bg-deep/50 text-dim hover:text-foam hover:bg-deep/90"
                  }`}
                >
                  <span>🏆 Рекорды</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab((cur) => (cur === "achievements" ? null : "achievements"))
                  }
                  className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-display text-xs transition sm:text-sm ${
                    activeTab === "achievements"
                      ? "bg-purple-500/20 text-purple-200 ring-1 ring-purple-400/50 shadow-[0_0_10px_rgba(168,85,247,0.25)] font-bold"
                      : "bg-deep/50 text-dim hover:text-foam hover:bg-deep/90"
                  }`}
                >
                  <span>🏅 Достижения</span>
                  <span className="text-[10px] font-mono text-dim/90">
                    {unlockedCount}/{ACHIEVEMENTS.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab((cur) => (cur === "guide" ? null : "guide"))}
                  className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-display text-xs transition sm:text-sm ${
                    activeTab === "guide"
                      ? "bg-mint/20 text-mint ring-1 ring-mint/50 shadow-[0_0_10px_rgba(0,255,163,0.25)] font-bold"
                      : "bg-deep/50 text-dim hover:text-foam hover:bg-deep/90"
                  }`}
                >
                  <span>🎮 Справка</span>
                </button>

                {DEBUG_TOOLS && (
                  <button
                    type="button"
                    onClick={() => setActiveTab((cur) => (cur === "debug" ? null : "debug"))}
                    className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-display text-xs transition sm:text-sm ${
                      activeTab === "debug"
                        ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.25)] font-bold"
                        : "bg-deep/50 text-dim hover:text-foam hover:bg-deep/90"
                    }`}
                  >
                    <span>🐛 Отладка</span>
                    {debug && (
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-neon shadow-[0_0_6px_#00f0ff]" />
                    )}
                  </button>
                )}
              </div>

              {/* Содержимое активного таба */}
              {activeTab ? (
                <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 max-h-[360px] sm:max-h-[440px] md:max-h-[min(65vh,480px)]">
                  {activeTab === "upgrades" && (
                    <MenuUpgrades hud={hud} onBuyUpgrade={onBuyUpgrade} />
                  )}

                  {activeTab === "records" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-line/40 pb-2">
                        <button
                          type="button"
                          onClick={() => setRecordsSubTab("local")}
                          className={`rounded px-2.5 py-1 font-display text-xs transition ${
                            recordsSubTab === "local"
                              ? "bg-cyan-500/20 text-cyan-200 font-bold ring-1 ring-cyan-400/40"
                              : "text-dim hover:text-foam"
                          }`}
                        >
                          📈 Мои рекорды
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecordsSubTab("global")}
                          className={`rounded px-2.5 py-1 font-display text-xs transition ${
                            recordsSubTab === "global"
                              ? "bg-cyan-500/20 text-cyan-200 font-bold ring-1 ring-cyan-400/40"
                              : "text-dim hover:text-foam"
                          }`}
                        >
                          🌍 Мировой топ
                        </button>
                      </div>
                      {recordsSubTab === "local" ? (
                        <MenuRecords hud={hud} />
                      ) : (
                        <MenuGlobalTop
                          period={period}
                          screen={screen}
                          globalTop={globalTop}
                          globalTopEndless={globalTopEndless}
                          onPeriod={onPeriod}
                          onScreen={onScreen}
                        />
                      )}
                    </div>
                  )}

                  {activeTab === "achievements" && <MenuAchievements unlocked={unlocked} />}

                  {activeTab === "guide" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 border-b border-line/40 pb-2">
                        <button
                          type="button"
                          onClick={() => setGuideSubTab("controls")}
                          className={`rounded px-2.5 py-1 font-display text-xs transition ${
                            guideSubTab === "controls"
                              ? "bg-mint/20 text-mint font-bold ring-1 ring-mint/40"
                              : "text-dim hover:text-foam"
                          }`}
                        >
                          ⌨️ Управление
                        </button>
                        <button
                          type="button"
                          onClick={() => setGuideSubTab("bonuses")}
                          className={`rounded px-2.5 py-1 font-display text-xs transition ${
                            guideSubTab === "bonuses"
                              ? "bg-mint/20 text-mint font-bold ring-1 ring-mint/40"
                              : "text-dim hover:text-foam"
                          }`}
                        >
                          🎁 Блоки и бонусы
                        </button>
                      </div>
                      {guideSubTab === "controls" ? (
                        <ControlsPanel />
                      ) : (
                        <div>
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
                            Тёмные <b className="text-coral">бомбы с фитилём</b> детонируют по
                            площади — собирай цепочки!
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "debug" && (
                    <MenuDebug
                      debug={debug}
                      onToggleDebug={onToggleDebug}
                      debugBoss={debugBoss}
                      onSelectDebugBoss={onSelectDebugBoss}
                      isDebugEffectActive={isDebugEffectActive}
                      onToggleDebugEffect={onToggleDebugEffect}
                      onDebugStartGame={onDebugStartGame}
                    />
                  )}
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-dim">
                  Нажмите на вкладку выше, чтобы открыть раздел
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
