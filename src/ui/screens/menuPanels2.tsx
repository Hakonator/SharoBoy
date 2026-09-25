import { ACHIEVEMENTS } from "../../game/achievements"

import { MenuSection } from "./shared"

/** Секция отладки: выбор босса и активируемые эффекты. */
export function MenuDebug({
  debug,
  onToggleDebug,
  debugBoss,
  onSelectDebugBoss,
  isDebugEffectActive,
  onToggleDebugEffect,
  onDebugStartGame,
}: {
  debug: boolean
  onToggleDebug: () => void
  debugBoss: string
  onSelectDebugBoss: (boss: string) => void
  isDebugEffectActive: (id: string) => boolean
  onToggleDebugEffect: (id: string) => void
  onDebugStartGame: () => void
}) {
  return (
    <MenuSection title="🐛 Отладка" dot={debug}>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-foam">
          <input
            type="checkbox"
            checked={debug}
            onChange={onToggleDebug}
            className="h-4 w-4 accent-cyan-400"
          />
          Режим отладки
        </label>
        {debug && (
          <>
            {/* Блок 1: выбор босса для тестирования */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-dim">Босс</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "", label: "Нет" },
                  { id: "octopus", label: "🐙 Осьминог" },
                  { id: "kraken", label: "🦑 Кракен" },
                  { id: "jellyfish", label: "🪼 Медуза (босс)" },
                  { id: "minibossFish", label: "🐟 Рыба (мини)" },
                  { id: "minibossJelly", label: "🪼 Медуза (мини)" },
                ].map((b) => (
                  <label
                    key={b.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition ${
                      debugBoss === b.id
                        ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/50"
                        : "bg-white/5 text-foam hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="radio"
                      name="debugBoss"
                      value={b.id}
                      checked={debugBoss === b.id}
                      onChange={() => onSelectDebugBoss(b.id)}
                      className="sr-only"
                    />
                    {b.label}
                  </label>
                ))}
              </div>
            </div>
            {/* Блок 2: активируемые эффекты (галочки) */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-dim">Эффекты</p>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    id: "paddleRotation",
                    label: "↻ Поворот ракетки",
                    hint: "ЛКМ/ПКМ удержание = ±30°, ускорение мяча (взаимоисключает другие режимы формы)",
                  },
                  {
                    id: "paddleImpulse",
                    label: "⚡ Импульсный удар",
                    hint: "ЛКМ/ПКМ клик = резкий доворот и возврат (взаимоисключает другие режимы формы)",
                  },
                  {
                    id: "paddleConvex",
                    label: "∩ Выпуклая ракетка",
                    hint: "Купол: мяч отскакивает веером от центра к краям (взаимоисключает другие режимы формы)",
                  },
                  {
                    id: "paddleConcave",
                    label: "∪ Вогнутая ракетка",
                    hint: "Чаша: мяч отскакивает от краёв к центру (взаимоисключает другие режимы формы)",
                  },
                ].map((e) => (
                  <label
                    key={e.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition ${
                      isDebugEffectActive(e.id)
                        ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/50"
                        : "bg-white/5 text-foam hover:bg-white/10"
                    }`}
                    title={e.hint}
                  >
                    <input
                      type="checkbox"
                      checked={isDebugEffectActive(e.id)}
                      onChange={() => onToggleDebugEffect(e.id)}
                      className="sr-only"
                    />
                    {e.label}
                  </label>
                ))}
              </div>
            </div>
            {/* Кнопка запуска уровня */}
            <button className="btn-ghost w-full px-4 py-2 text-sm" onClick={onDebugStartGame}>
              ▶ Запустить уровень
            </button>
          </>
        )}
      </div>
    </MenuSection>
  )
}

/** Сетка достижений с состоянием разблокировки. */
export function MenuAchievements({ unlocked }: { unlocked: Record<string, number> }) {
  return (
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
  )
}
