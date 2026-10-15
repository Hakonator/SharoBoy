import { useEffect, useState } from "react"

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
import { IconCoin, IconMusic, IconSettings, IconSound, VolSlider } from "../icons"

interface SettingsModalProps {
  hud: HudData
  onClose: () => void
  onMusicVolume: (v: number) => void
  onSfxVolume: (v: number) => void
  onToggleMusic: () => void
  onToggleMute: () => void
  onResetAccount?: () => void
}

export function SettingsModal({
  hud,
  onClose,
  onMusicVolume,
  onSfxVolume,
  onToggleMusic,
  onToggleMute,
  onResetAccount,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings())
  const [confirmStep, setConfirmStep] = useState<"none" | "step1" | "step2">("none")
  const [confirmInput, setConfirmInput] = useState("")
  const [resetDone, setResetDone] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Escape") {
        e.stopPropagation()
        e.stopImmediatePropagation()
        e.preventDefault()
        if (confirmStep !== "none") {
          setConfirmStep("none")
          setConfirmInput("")
        } else {
          onClose()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [onClose, confirmStep])

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

          {/* СЕКЦИЯ: АККАУНТ И ПРОГРЕСС */}
          <section className="space-y-3.5">
            <div className="font-display text-xs tracking-widest text-coral">
              ⚠️ ПРОГРЕСС И ДАННЫЕ АККАУНТА
            </div>

            <div className="rounded-lg border border-coral/30 bg-abyss/40 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-foam">Обнуление данных аккаунта</div>
                  <div className="text-xs text-dim">
                    Сброс монет, улучшений, рекордов, статистики и всех достижений
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmStep("step1")
                    setResetDone(false)
                  }}
                  className="shrink-0 rounded border border-coral/50 bg-coral/15 px-3 py-1.5 font-display text-xs font-semibold text-coral transition hover:bg-coral/25 active:scale-95"
                >
                  🗑️ Обнулить данные
                </button>
              </div>

              {resetDone && (
                <div className="mt-2.5 rounded border border-mint/40 bg-mint/10 px-2.5 py-1.5 text-xs font-medium text-mint">
                  ✓ Данные аккаунта успешно обнулены!
                </div>
              )}
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

      {/* Шаг 1: Первое подтверждение с предупреждением о последствиях */}
      {confirmStep === "step1" && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-md">
          <div className="anim-pop w-full max-w-md rounded-xl border border-coral/60 bg-deep p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-coral">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-display text-lg tracking-wide text-foam">
                СБРОС ДАННЫХ АККАУНТА
              </h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-foam/90 sm:text-sm">
              Вы действительно хотите обнулить аккаунт? Будут безвозвратно удалены:
            </p>
            <ul className="mt-2.5 space-y-1 text-xs text-dim">
              <li className="flex items-center gap-1.5">
                <IconCoin className="h-4 w-4 shrink-0" /> Все монеты и кристаллы
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-cyan-neon">🛠</span> Все купленные постоянные улучшения
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-coral">🏆</span> Личные рекорды кампании и бесконечного режима
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-purple-400">🏅</span> Все открытые достижения
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-mint">📊</span> Статистика сыгранных партий и побед
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-foam">👤</span> Имя игрока (ник)
              </li>
            </ul>
            <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-line/60 pt-3.5">
              <button
                type="button"
                onClick={() => setConfirmStep("none")}
                className="rounded border border-line/60 bg-deep/80 px-4 py-2 font-display text-xs text-foam transition hover:bg-line/40 active:scale-95"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmStep("step2")
                  setConfirmInput("")
                }}
                className="rounded border border-coral bg-coral/20 px-4 py-2 font-display text-xs font-bold text-coral transition hover:bg-coral/30 active:scale-95"
              >
                Продолжить сброс →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Шаг 2: Дополнительный подтверждающий запрос со словом «СБРОС» */}
      {confirmStep === "step2" && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-abyss/85 p-4 backdrop-blur-md">
          <div className="anim-pop w-full max-w-md rounded-xl border border-coral bg-deep p-5 shadow-2xl ring-2 ring-coral/40">
            <div className="flex items-center gap-2.5 text-coral">
              <span className="text-2xl">🚨</span>
              <h3 className="font-display text-lg tracking-wide text-coral">
                ФИНАЛЬНОЕ ПОДТВЕРЖДЕНИЕ
              </h3>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-foam sm:text-sm">
              Это действие <b>необратимо</b>. Весь прогресс будет стёрт без возможности
              восстановления.
            </p>
            <div className="mt-4 rounded-lg border border-line/60 bg-abyss/60 p-3">
              <label htmlFor="confirm-reset-input" className="block text-xs font-medium text-dim">
                Для подтверждения введите слово <span className="font-bold text-coral">СБРОС</span>:
              </label>
              <input
                id="confirm-reset-input"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="СБРОС"
                autoFocus
                className="mt-2 h-10 w-full rounded border border-coral/50 bg-deep px-3 font-display text-sm tracking-widest text-foam uppercase outline-none placeholder:text-dim/40 focus:border-coral focus:ring-1 focus:ring-coral"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-line/60 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmStep("none")
                  setConfirmInput("")
                }}
                className="rounded border border-line/60 bg-deep/80 px-4 py-2 font-display text-xs text-foam transition hover:bg-line/40 active:scale-95"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={confirmInput.trim().toUpperCase() !== "СБРОС"}
                onClick={() => {
                  onResetAccount?.()
                  setResetDone(true)
                  setConfirmStep("none")
                  setConfirmInput("")
                }}
                className={`rounded px-4 py-2 font-display text-xs font-bold transition ${
                  confirmInput.trim().toUpperCase() === "СБРОС"
                    ? "cursor-pointer bg-coral text-abyss shadow-[0_0_15px_rgba(255,106,92,0.6)] hover:brightness-110 active:scale-95"
                    : "cursor-not-allowed border border-line/40 bg-line/20 text-dim/50"
                }`}
              >
                🔥 Подтверждаю, удалить всё
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
