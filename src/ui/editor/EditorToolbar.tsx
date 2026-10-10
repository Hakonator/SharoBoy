import type { EditorToolbarProps, EditorTool } from "./types"

const TOOLS: { id: EditorTool; label: string; icon: string }[] = [
  { id: "select", label: "Выбор", icon: "↖" },
  { id: "add", label: "Добавить блок", icon: "+" },
  { id: "delete", label: "Удалить", icon: "⌫" },
]

export function EditorToolbar({
  state,
  dispatch,
  onImportExport,
  onTestRun,
  onClose,
  musicMuted,
  onToggleMusic,
  onNextMusicTrack,
}: EditorToolbarProps) {
  const canUndo = state.history.past.length > 0
  const canRedo = state.history.future.length > 0

  return (
    <header className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-deep/95 p-3 text-foam shadow-xl">
      <div className="flex items-center gap-1" aria-label="Инструменты редактора">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            aria-pressed={state.activeTool === tool.id}
            className={
              state.activeTool === tool.id
                ? "flex items-center gap-2 rounded-lg border-2 border-cyan-neon bg-cyan-neon px-3 py-2 text-xs font-black text-ink shadow-[0_0_16px_rgba(53,224,255,0.8)]"
                : "btn-ghost flex items-center gap-2 px-3 py-2 text-xs"
            }
            style={
              state.activeTool === tool.id
                ? {
                    backgroundColor: "#35e0ff",
                    color: "#07131b",
                    boxShadow: "0 0 16px rgba(53,224,255,0.8)",
                  }
                : undefined
            }
            onClick={() => dispatch({ type: "SET_TOOL", tool: tool.id })}
            title={tool.label}
            type="button"
          >
            <span aria-hidden="true" className="font-display text-base">
              {tool.icon}
            </span>
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      <span className="mx-1 hidden h-8 border-l border-line sm:block" />

      <div className="flex items-center gap-1">
        <ToolbarButton
          disabled={!canUndo}
          label="Отменить"
          onClick={() => dispatch({ type: "UNDO" })}
          title="Отменить последнее изменение"
        >
          ↶
        </ToolbarButton>
        <ToolbarButton
          disabled={!canRedo}
          label="Повторить"
          onClick={() => dispatch({ type: "REDO" })}
          title="Повторить изменение"
        >
          ↷
        </ToolbarButton>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-line bg-abyss/70 px-3 py-2 text-xs">
        <input
          checked={state.snapToGrid}
          className="accent-cyan-neon"
          onChange={(event) =>
            dispatch({ type: "SET_SNAP_TO_GRID", enabled: event.target.checked })
          }
          type="checkbox"
        />
        <span>Привязка</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-dim">
        Сетка
        <select
          aria-label="Размер сетки"
          className="rounded-lg border border-line bg-abyss px-2 py-2 text-foam outline-none focus:border-cyan-neon"
          onChange={(event) =>
            dispatch({ type: "SET_GRID_SIZE", gridSize: Number(event.target.value) })
          }
          value={state.gridSize}
        >
          {[16, 32, 64].map((gridSize) => (
            <option key={gridSize} value={gridSize}>
              {gridSize}
            </option>
          ))}
        </select>
      </label>

      <span className="mx-1 hidden h-8 border-l border-line sm:block" />
      <ToolbarButton
        label="Очистить карту"
        onClick={() => {
          if (window.confirm("Удалить все блоки карты?")) {
            dispatch({
              type: "SET_MAP",
              map: {
                ...state.map,
                blocks: [],
                groups: [],
                winCondition: { kind: "all-destructible" },
              },
              preserveHistory: true,
            })
          }
        }}
        title="Удалить все блоки"
      >
        Очистить
      </ToolbarButton>
      <ToolbarButton
        label="Импорт / экспорт JSON"
        onClick={onImportExport}
        title="Импорт / экспорт JSON"
      >
        JSON
      </ToolbarButton>
      <ToolbarButton
        label={musicMuted ? "Включить музыку" : "Выключить музыку"}
        onClick={onToggleMusic}
        title={musicMuted ? "Включить музыку" : "Выключить музыку"}
      >
        {musicMuted ? "🔇" : "🎵"}
      </ToolbarButton>
      <ToolbarButton label="Следующий трек" onClick={onNextMusicTrack} title="Следующая композиция">
        ⏭
      </ToolbarButton>
      <button className="btn-arcade px-4 py-2 text-xs" onClick={onTestRun} type="button">
        ▶ Тест-прогон
      </button>
      <button className="btn-ghost ml-auto px-4 py-2 text-xs" onClick={onClose} type="button">
        Закрыть
      </button>
    </header>
  )
}

function ToolbarButton({
  children,
  disabled = false,
  label,
  onClick,
  title,
}: {
  children: React.ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
  title: string
}) {
  return (
    <button
      aria-label={label}
      className="btn-ghost px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-35"
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}
