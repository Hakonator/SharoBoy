import { useState } from "react"

import {
  type FlashMultiplier,
  type GameSettings,
  type GraphicsQuality,
  type ShakeMultiplier,
  loadSettings,
  resetSettings,
  saveSettings,
} from "../../game/settings"
import type { HudData } from "../../game/types"
import { IconMusic, IconSettings, IconSound, VolSlider } from "../icons"

interface SettingsModalProps {
  hud: HudData
  onClose: () => void
  onMusicVolume: (v: number) => void
  onSfxVolume: (v: number) => void
  onToggleMusic: () => void
  onToggleMute: () => void
}

export function SettingsModal({
  hud,
  onClose,
  onMusicVolume,
  onSfxVolume,
  onToggleMusic,
  onToggleMute,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())

  const updateSetting = <K extends keyof GameSettings>(key: K, val: GameSettings[K]) => {
    const updated = saveSettings({ [key]: val })
    setSettings(updated)
  }

  const handleReset = () => {
    const def = resetSettings()
    setSettings(def)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 p-4 backdrop-blur-sm">
      <div className="anim-pop flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl border border-line bg-deep/95 p-5 shadow-2xl sm:p-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between border-b border-line/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-cyan-neon">
              <IconSettings className="h-6 w-6" />
            </span>
            <h2 className="font-display text-xl tracking-wider text-foam">НАСТРОЙКИ</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dim transition hover:bg-line/40 hover:text-foam active:scale-95"
            aria-label="Закрыть настройки"
          >
            ✕
          </button>
        </div>

        {/* Скроллируемое тело */}
        <div className="space-y-6 overflow-y-auto py-4 pr-1 text-sm">
          {/* СЕКЦИЯ: ГРАФИКА */}
          <section className="space-y-3.5">
            <div className="font-display text-xs tracking-widest text-cyan-neon">
              🎨 ГРАФИКА И ЭФФЕКТЫ
            </div>

            {/* Качество графики */}
            <div className="rounded-lg border border-line/50 bg-abyss/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-foam">Качество графики</div>
                  <div className="text-xs text-dim">
                    {settings.graphicsQuality === "eco" &&
                      "Эко: 150 частиц, плавно на слабых экранах"}
                    {settings.graphicsQuality === "high" &&
                      "Высокое: 400 частиц, баланс и сочность"}
                    {settings.graphicsQuality === "ultra" &&
                      "Ультра: 650 частиц, максимум осколков и искр"}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "eco", label: "⚡ Эко" },
                    { id: "high", label: "✨ Высокое" },
                    { id: "ultra", label: "🔥 Ультра" },
                  ] as { id: GraphicsQuality; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSetting("graphicsQuality", opt.id)}
                    className={`rounded border py-1.5 text-xs font-semibold transition ${
                      settings.graphicsQuality === opt.id
                        ? "border-cyan-neon bg-cyan-neon/20 text-cyan-neon shadow-sm"
                        : "border-line/60 bg-deep/60 text-dim hover:text-foam"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Тряска экрана */}
            <div className="rounded-lg border border-line/50 bg-abyss/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-foam">Тряска экрана</div>
                  <div className="text-xs text-dim">
                    Динамическая отдача от взрывов и сильных соударений
                  </div>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 0, label: "Выкл" },
                    { id: 0.5, label: "50%" },
                    { id: 1, label: "100%" },
                  ] as { id: ShakeMultiplier; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSetting("screenShake", opt.id)}
                    className={`rounded border py-1.5 text-xs font-semibold transition ${
                      settings.screenShake === opt.id
                        ? "border-cyan-neon bg-cyan-neon/20 text-cyan-neon shadow-sm"
                        : "border-line/60 bg-deep/60 text-dim hover:text-foam"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Вспышки экрана */}
            <div className="rounded-lg border border-line/50 bg-abyss/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-foam">Вспышки экрана</div>
                  <div className="text-xs text-dim">
                    Световые импульсы от уничтожения блоков и бонусов
                  </div>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 0, label: "Выкл" },
                    { id: 0.5, label: "Мягко (50%)" },
                    { id: 1, label: "100%" },
                  ] as { id: FlashMultiplier; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSetting("screenFlash", opt.id)}
                    className={`rounded border py-1.5 text-xs font-semibold transition ${
                      settings.screenFlash === opt.id
                        ? "border-cyan-neon bg-cyan-neon/20 text-cyan-neon shadow-sm"
                        : "border-line/60 bg-deep/60 text-dim hover:text-foam"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* СЕКЦИЯ: ЗВУК */}
          <section className="space-y-3.5">
            <div className="font-display text-xs tracking-widest text-cyan-neon">
              🔊 ЗВУК И МУЗЫКА
            </div>

            {/* Музыка и эффекты: ползунки */}
            <div className="space-y-2 rounded-lg border border-line/50 bg-abyss/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleMusic}
                    className="rounded p-1 text-dim transition hover:text-foam"
                    aria-label="Вкл/выкл музыку"
                  >
                    <IconMusic off={hud.musicMuted} />
                  </button>
                  <span className="font-medium text-foam">Музыка</span>
                </div>
                <div className="flex items-center gap-2">
                  <VolSlider
                    value={hud.musicVolume}
                    onChange={onMusicVolume}
                    label="Громкость музыки"
                  />
                  <span className="w-9 text-right text-xs font-mono text-dim">
                    {hud.musicMuted ? "0%" : `${Math.round(hud.musicVolume * 100)}%`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleMute}
                    className="rounded p-1 text-dim transition hover:text-foam"
                    aria-label="Вкл/выкл эффекты"
                  >
                    <IconSound off={hud.muted} />
                  </button>
                  <span className="font-medium text-foam">Эффекты</span>
                </div>
                <div className="flex items-center gap-2">
                  <VolSlider
                    value={hud.sfxVolume}
                    onChange={onSfxVolume}
                    label="Громкость звуков"
                  />
                  <span className="w-9 text-right text-xs font-mono text-dim">
                    {hud.muted ? "0%" : `${Math.round(hud.sfxVolume * 100)}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Пространственное стерео */}
            <div className="flex items-center justify-between rounded-lg border border-line/50 bg-abyss/40 p-3">
              <div className="pr-3">
                <div className="font-medium text-foam">Пространственное стерео</div>
                <div className="text-xs text-dim">
                  Панорамирование звуков слева/справа по положению шара
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateSetting("stereoPanning", !settings.stereoPanning)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.stereoPanning ? "bg-cyan-neon" : "bg-line"
                }`}
                aria-pressed={settings.stereoPanning}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-deep shadow ring-0 transition duration-200 ease-in-out ${
                    settings.stereoPanning ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Восходящий тон комбо */}
            <div className="flex items-center justify-between rounded-lg border border-line/50 bg-abyss/40 p-3">
              <div className="pr-3">
                <div className="font-medium text-foam">Восходящий тон комбо</div>
                <div className="text-xs text-dim">
                  Повышение высоты звука при непрерывной серии разрушений
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateSetting("comboPitch", !settings.comboPitch)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.comboPitch ? "bg-cyan-neon" : "bg-line"
                }`}
                aria-pressed={settings.comboPitch}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-deep shadow ring-0 transition duration-200 ease-in-out ${
                    settings.comboPitch ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Фильтр паузы */}
            <div className="flex items-center justify-between rounded-lg border border-line/50 bg-abyss/40 p-3">
              <div className="pr-3">
                <div className="font-medium text-foam">Подводный фильтр в паузе</div>
                <div className="text-xs text-dim">
                  Приглушение музыки и звуков низкочастотным фильтром в паузе
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateSetting("underwaterFilter", !settings.underwaterFilter)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.underwaterFilter ? "bg-cyan-neon" : "bg-line"
                }`}
                aria-pressed={settings.underwaterFilter}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-deep shadow ring-0 transition duration-200 ease-in-out ${
                    settings.underwaterFilter ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>
        </div>

        {/* Подвал */}
        <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-3">
          <button
            onClick={handleReset}
            className="text-xs text-dim underline-offset-2 transition hover:text-coral hover:underline"
          >
            Сбросить по умолчанию
          </button>
          <button onClick={onClose} className="btn-arcade px-6 py-2 text-sm">
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}
