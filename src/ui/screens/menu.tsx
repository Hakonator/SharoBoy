import { useState, type ReactNode } from "react"

import { ACHIEVEMENTS } from "../../game/achievements"
import { MAX_NICK } from "../../game/profanity"
import { DEBUG_TOOLS } from "../../config"
import { UPGRADE_DEFS, UPGRADES_ENABLED } from "../../game/upgrades"
import { ControlsPanel, FloatingBalls } from "../icons"
import type { CosmeticCategory } from "../../game/cosmetics"
import type { GlobalScore, LeadPeriod, ScreenFilter } from "../../game/leaderboard"
import type { HudData } from "../../game/types"

import { MenuRecords, MenuGlobalTop } from "./menuTop"
import { MenuCornerControls, MenuDebug, MenuUpgrades, MenuAchievements } from "./menuPanels"
import { MenuCosmetics } from "./MenuCosmetics"
import type { PlayerStats } from "./types"

type MenuTabId = "upgrades" | "cosmetics" | "records" | "achievements" | "guide" | "debug"

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
  onBuyCosmetic,
  onEquipCosmetic,
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
  onBuyCosmetic?: (category: CosmeticCategory, id: string) => void
  onEquipCosmetic?: (category: CosmeticCategory, id: string) => void
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
  /** Активная вкладка в правой панели дашборда. */
  const [activeTab, setActiveTab] = useState<MenuTabId>("upgrades")
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
    <div className="page-scroll absolute inset-0 z-40 overflow-y-auto md:overflow-hidden">
      <FloatingBalls />
      <MenuCornerControls
        hud={hud}
        onMute={onMute}
        onMusic={onMusic}
        onMusicVolume={onMusicVolume}
        onSfxVolume={onSfxVolume}
        onSettings={onOpenSettings}
      />
      {/* Отступ сверху на смартфоне оставляет место под угловые контролы
          (музыка/звук/настройки) — иначе они наезжают на название. */}
      <div className="relative flex min-h-full flex-col items-start justify-start gap-4 p-4 pt-16 sm:gap-6 sm:p-6 sm:pt-20 md:h-full md:flex-row md:items-start md:justify-center md:gap-10 md:p-8 md:pt-12 lg:gap-14 lg:p-12 lg:pt-16">
        {/* Левая колонка: логотип, режимы игры, ник */}
        <div className="anim-rise w-full max-w-xl shrink-0 md:w-auto md:pt-2">
          <h1 className="font-display leading-[0.95]">
            <span className="title-glow block text-5xl text-foam sm:text-7xl lg:text-8xl">
              ШАРО
            </span>
            <span className="title-glow block text-5xl text-cyan-neon sm:text-7xl lg:text-8xl">
              БОЙ<span className="text-punch">!</span>
            </span>
          </h1>
          <p className="mt-4 hidden max-w-md text-sm leading-relaxed text-foam/80 sm:block sm:text-base">
            Вместо кирпичей — <b className="text-mint">шары</b> и <b className="text-gold">овалы</b>{" "}
            разной величины. Отбивай ракеткой, собирай серии, лови бонусы, одолей{" "}
            <b className="text-cyan-neon">4 уровня с боссом</b> — или выживай в{" "}
            <b className="text-punch">бесконечных волнах</b>.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-5 sm:gap-3">
            <button
              className="btn-arcade px-4 py-2.5 text-sm sm:px-7 sm:py-3.5 sm:text-lg"
              onClick={onCampaign}
            >
              Кампания
            </button>
            <button
              className="btn-ghost px-3 py-2.5 font-display text-xs sm:px-5 sm:py-3.5 sm:text-base"
              onClick={onCommunityMaps}
              type="button"
            >
              🗺 Карты сообщества
            </button>
            <button
              className="btn-ghost px-3 py-2.5 font-display text-xs sm:px-5 sm:py-3.5 sm:text-base"
              onClick={onEndless}
            >
              Бесконечный
            </button>
            {hud.best > 0 && (
              <div className="hud-chip px-2.5 py-1.5 sm:px-3.5 sm:py-2.5">
                <div className="hud-label">Рекорд</div>
                <div className="font-display text-base text-gold tabular-nums sm:text-lg">
                  {hud.best.toLocaleString("ru-RU")}
                </div>
              </div>
            )}
          </div>
          <button
            className="mt-2 text-[11px] text-dim underline decoration-line underline-offset-4 hover:text-gold sm:mt-3 sm:text-xs"
            onClick={onAdmin}
            type="button"
          >
            🛡️ Панель модерации
          </button>

          {/* Ник доступен всегда — подписывает рекорды */}
          <div className="hud-chip mt-2.5 w-full max-w-64 p-2 sm:mt-3 sm:p-2.5">
            <div className="hud-label mb-1 sm:mb-1.5">Ник для рекордов</div>
            <input
              value={nick}
              maxLength={MAX_NICK}
              placeholder="Без ника"
              onChange={(e) => onNickChange(e.target.value)}
              onKeyDown={(e) => {
                /* не даём движку ловить пробел/латиницу как управление */
                e.stopPropagation()
              }}
              className="h-8 w-full border border-line bg-deep px-2.5 font-display text-sm text-foam outline-none placeholder:text-dim/60 focus:border-cyan-neon sm:h-9 sm:px-3"
            />
          </div>
        </div>

        {/* Правая колонка: Табовый Dashboard (0 скролла окна на ПК, компактный на мобильном) */}
        <div
          className="anim-rise flex w-full max-w-md flex-col md:max-w-lg lg:max-w-xl md:self-start"
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
              {/* Навигационная панель табов: переносится без горизонтального ползунка */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-line/50 bg-abyss/85 p-2 sm:p-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("upgrades")}
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
                  onClick={() => setActiveTab("cosmetics")}
                  className={`relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-display text-xs transition sm:text-sm ${
                    activeTab === "cosmetics"
                      ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/50 shadow-[0_0_10px_rgba(0,240,255,0.25)] font-bold"
                      : "bg-deep/50 text-dim hover:text-foam hover:bg-deep/90"
                  }`}
                >
                  <span>✨ Стили</span>
                  {hud.metaCrystals !== undefined && hud.metaCrystals > 0 && (
                    <span className="text-[10px] font-mono text-cyan-300">
                      💠{hud.metaCrystals}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("records")}
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
                  onClick={() => setActiveTab("achievements")}
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
                  onClick={() => setActiveTab("guide")}
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
                    onClick={() => setActiveTab("debug")}
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

              {/* Содержимое активного таба: на смартфоне растёт по контенту и
                  прокручивается вместе со страницей — вложенный скролл ловил
                  свайп и блокировал прокрутку меню пальцем. От `md` — внутренний
                  вертикальный слайдер фиксированной высоты в неоновом стиле. */}
              <div className="arcade-scrollbar p-3 sm:p-4 pr-2 sm:pr-2.5 md:min-h-0 md:flex-1 md:overflow-y-auto md:h-[450px]">
                {activeTab === "upgrades" && <MenuUpgrades hud={hud} onBuyUpgrade={onBuyUpgrade} />}

                {activeTab === "cosmetics" && (
                  <MenuCosmetics
                    hud={hud}
                    onBuyCosmetic={onBuyCosmetic}
                    onEquipCosmetic={onEquipCosmetic}
                  />
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
                          Тёмные <b className="text-coral">бомбы с фитилём</b> детонируют по площади
                          — собирай цепочки!
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
