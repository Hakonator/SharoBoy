import { TIER } from "../../game/palette"
import type { PlayerBlockEffect, PlayerBlockSpec, PlayerMapWinCondition } from "../../game/mapSpec"

import type { EditorInspectorProps } from "./types"

export function EditorInspector({ state, dispatch, author }: EditorInspectorProps) {
  const block =
    state.selectedBlockIds.length === 1
      ? state.map.blocks.find((item) => item.id === state.selectedBlockIds[0])
      : state.map.blocks.find((item) => item.id === state.selectedBlockId)
  const updateBlock = (updates: Partial<PlayerBlockSpec>) => {
    if (block) dispatch({ type: "UPDATE_BLOCK", blockId: block.id, updates })
  }

  if (state.selectedBlockIds.length > 1) {
    return (
      <aside className="rounded-xl border border-line bg-deep/95 p-4 text-foam flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg text-cyan-neon">Множественный выбор</h2>
          <p className="mt-1 text-sm text-dim">Выбрано блоков: {state.selectedBlockIds.length}</p>
          <p className="mt-1 text-xs text-dim">
            Перетаскивайте мышью любой блок, чтобы переместить всю группу.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-line/50">
          <button
            type="button"
            className="btn-ghost flex items-center justify-between px-3 py-2 text-xs text-foam hover:border-cyan-neon"
            onClick={() => dispatch({ type: "COPY_SELECTED" })}
            title="Скопировать выделенную группу (Ctrl+C)"
          >
            <span>📋 Копировать группу</span>
            <kbd className="rounded bg-abyss px-1.5 py-0.5 text-[10px] text-dim">Ctrl+C</kbd>
          </button>
          <button
            type="button"
            className="btn-ghost flex items-center justify-between px-3 py-2 text-xs text-cyan-neon hover:border-cyan-neon"
            onClick={() => dispatch({ type: "START_PASTE" })}
            title="Вставить с фантомом под курсором (Ctrl+V)"
          >
            <span>✨ Вставить (фантом)</span>
            <kbd className="rounded bg-abyss px-1.5 py-0.5 text-[10px] text-dim">Ctrl+V</kbd>
          </button>
          <button
            type="button"
            className="btn-ghost flex items-center justify-between px-3 py-2 text-xs text-punch hover:border-punch/60"
            onClick={() => dispatch({ type: "DELETE_SELECTED_BLOCKS" })}
            title="Удалить выделенные блоки (Delete / Backspace)"
          >
            <span>🗑 Удалить группу</span>
            <kbd className="rounded bg-abyss px-1.5 py-0.5 text-[10px] text-dim">Del</kbd>
          </button>
          <button
            type="button"
            className="btn-ghost flex items-center justify-between px-3 py-2 text-xs text-dim hover:text-foam"
            onClick={() => dispatch({ type: "SELECT_BLOCKS", blockIds: [] })}
            title="Снять выделение со всех блоков (Escape)"
          >
            <span>✖ Снять выделение</span>
            <kbd className="rounded bg-abyss px-1.5 py-0.5 text-[10px] text-dim">Esc</kbd>
          </button>
        </div>

        <div className="pt-2 border-t border-line/40 text-[11px] text-dim space-y-1">
          <p>
            • <span className="text-foam">Ctrl+Z</span> — отмена перемещения / вставки
          </p>
          <p>
            • <span className="text-foam">Ctrl+Y</span> — повтор операции
          </p>
        </div>
      </aside>
    )
  }

  if (!block) {
    const totalHp = state.map.blocks.reduce((sum, item) => sum + item.hp, 0)
    return (
      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-line bg-deep/95 p-4 text-foam">
        <h2 className="font-display text-lg text-cyan-neon">Свойства карты</h2>
        <Field label="Название">
          <input
            className={INPUT_CLASS}
            value={state.map.metadata.title}
            onChange={(event) =>
              dispatch({ type: "UPDATE_METADATA", metadata: { title: event.target.value } })
            }
          />
        </Field>
        <Field label="Автор">
          <input
            aria-describedby="editor-author-hint"
            className="cursor-not-allowed rounded-lg border border-line bg-abyss/40 px-3 py-2 text-foam opacity-75 outline-none"
            readOnly
            value={author}
          />
          <p id="editor-author-hint" className="mt-1 text-xs text-dim">
            Берётся из имени игрока на главной странице
          </p>
        </Field>
        <Field label="Описание">
          <textarea
            className={`${INPUT_CLASS} min-h-20 resize-y`}
            value={state.map.metadata.description ?? ""}
            onChange={(event) =>
              dispatch({ type: "UPDATE_METADATA", metadata: { description: event.target.value } })
            }
          />
        </Field>
        <Field label="Условие победы">
          <select
            className={INPUT_CLASS}
            onChange={(event) => {
              const winCondition: PlayerMapWinCondition =
                event.target.value === "targets"
                  ? { kind: "targets", targetIds: state.map.blocks.map((item) => item.id) }
                  : { kind: "all-destructible" }
              dispatch({ type: "UPDATE_METADATA", winCondition })
            }}
            value={state.map.winCondition.kind}
          >
            <option value="all-destructible">Все разрушаемые блоки</option>
            <option value="targets">Целевые блоки</option>
          </select>
        </Field>
        {state.map.winCondition.kind === "targets" && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <p className="hud-label">Цели</p>
            {state.map.blocks.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-xs">
                <input
                  checked={
                    state.map.winCondition.kind === "targets" &&
                    state.map.winCondition.targetIds.includes(item.id)
                  }
                  className="accent-cyan-neon"
                  onChange={(event) => {
                    if (state.map.winCondition.kind !== "targets") return
                    const current = state.map.winCondition.targetIds
                    const targetIds = event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id)
                    dispatch({
                      type: "UPDATE_METADATA",
                      winCondition: { kind: "targets", targetIds },
                    })
                  }}
                  type="checkbox"
                />
                <span>{item.id}</span>
              </label>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-center">
          <Stat label="Блоки" value={state.map.blocks.length} />
          <Stat label="Сумма HP" value={totalHp} />
        </div>
      </aside>
    )
  }

  const effects = block.effects ?? []
  const hpTier = TIER[Math.min(3, Math.max(1, Math.round(block.hp))) as 1 | 2 | 3]
  const has = (kind: PlayerBlockEffect["kind"]) => effects.some((effect) => effect.kind === kind)
  const setEffect = (kind: PlayerBlockEffect["kind"], enabled: boolean) => {
    const next = effects.filter((effect) => effect.kind !== kind)
    const added = defaultEffect(kind, block)
    updateBlock({
      effects: enabled && added ? [...next, added] : next.length > 0 ? next : undefined,
    })
  }

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-line bg-deep/95 p-4 text-foam">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg text-cyan-neon">Свойства блока</h2>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: hpTier.base, color: "#07131b" }}
        >
          HP {block.hp}
        </span>
      </div>
      <Field label="HP">
        <input
          className="w-full accent-cyan-neon"
          max="8"
          min="1"
          onChange={(event) => updateBlock({ hp: Number(event.target.value) })}
          style={{ accentColor: hpTier.base }}
          type="range"
          value={block.hp}
        />
        <div className="flex justify-between font-mono text-xs text-dim">
          <span>1</span>
          <span>8</span>
        </div>
      </Field>
      <Field label="Форма">
        <select
          className={INPUT_CLASS}
          onChange={(event) =>
            updateBlock({
              shape: event.target.value as PlayerBlockSpec["shape"],
              ...(event.target.value === "circle"
                ? {
                    size: {
                      width: Math.min(block.size.width, block.size.height),
                      height: Math.min(block.size.width, block.size.height),
                    },
                  }
                : {}),
            })
          }
          value={block.shape}
        >
          <option value="circle">Круг</option>
          <option value="ellipse">Эллипс</option>
          <option value="rect">Прямоугольник</option>
          <option value="round_rect">Скруглённый прямоугольник</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Ширина"
          min={20}
          max={100}
          value={block.size.width}
          onChange={(width) =>
            updateBlock({
              size: { width, height: block.shape === "circle" ? width : block.size.height },
            })
          }
        />
        <NumberField
          label="Высота"
          min={20}
          max={100}
          value={block.size.height}
          onChange={(height) =>
            updateBlock({
              size: { width: block.shape === "circle" ? height : block.size.width, height },
            })
          }
        />
      </div>
      <NumberField
        label="Поворот (°)"
        min={-360}
        max={360}
        step={5}
        value={Math.round(((block.rotation ?? 0) * 180) / Math.PI / 5) * 5}
        onChange={(degrees) => updateBlock({ rotation: (degrees * Math.PI) / 180 })}
      />

      <section className="space-y-3 border-t border-line pt-3">
        <h3 className="hud-label">Эффекты</h3>
        <EffectToggle
          label="Броня"
          checked={has("armor")}
          onChange={(enabled) => setEffect("armor", enabled)}
        />
        {effects.find((effect) => effect.kind === "armor")?.kind === "armor" && (
          <NumberField
            label="Очки брони"
            min={1}
            max={5}
            value={
              effects.find((effect) => effect.kind === "armor")!.kind === "armor"
                ? effects.find((effect) => effect.kind === "armor")!.amount
                : 1
            }
            onChange={(amount) => replaceEffect("armor", { kind: "armor", amount })}
          />
        )}
        <EffectToggle
          label="Хрупкая цепь"
          checked={has("brittle")}
          onChange={(enabled) => setEffect("brittle", enabled)}
        />
        {effects.find((effect) => effect.kind === "brittle")?.kind === "brittle" && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <NumberField
              label="Радиус цепи"
              min={40}
              max={400}
              value={
                effects.find((effect) => effect.kind === "brittle")?.kind === "brittle"
                  ? (effects.find((effect) => effect.kind === "brittle")!.radius ?? 120)
                  : 120
              }
              onChange={(radius) =>
                replaceEffect("brittle", { ...getEffect("brittle", effects), radius })
              }
            />
            <NumberField
              label="Цепной урон"
              min={1}
              max={3}
              value={
                effects.find((effect) => effect.kind === "brittle")?.kind === "brittle"
                  ? (effects.find((effect) => effect.kind === "brittle")!.damage ?? 1)
                  : 1
              }
              onChange={(damage) =>
                replaceEffect("brittle", { ...getEffect("brittle", effects), damage })
              }
            />
          </div>
        )}
        <EffectToggle
          label="Фазовый блок"
          checked={has("phase")}
          onChange={(enabled) => setEffect("phase", enabled)}
        />
        {effects.find((effect) => effect.kind === "phase")?.kind === "phase" && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <NumberField
              label="Период (сек)"
              min={1}
              max={10}
              step={0.2}
              value={
                effects.find((effect) => effect.kind === "phase")?.kind === "phase"
                  ? (effects.find((effect) => effect.kind === "phase")!.period ?? 3.2)
                  : 3.2
              }
              onChange={(period) =>
                replaceEffect("phase", { ...getEffect("phase", effects), period })
              }
            />
            <NumberField
              label="Доля активности"
              min={0.1}
              max={0.9}
              step={0.05}
              value={
                effects.find((effect) => effect.kind === "phase")?.kind === "phase"
                  ? (effects.find((effect) => effect.kind === "phase")!.activeFraction ?? 0.6)
                  : 0.6
              }
              onChange={(activeFraction) =>
                replaceEffect("phase", { ...getEffect("phase", effects), activeFraction })
              }
            />
          </div>
        )}
        <EffectToggle
          label="Пружина"
          checked={has("spring")}
          onChange={(enabled) => setEffect("spring", enabled)}
        />
        {effects.find((effect) => effect.kind === "spring")?.kind === "spring" && (
          <EffectTuning
            effect={
              effects.find((effect) => effect.kind === "spring") as Extract<
                PlayerBlockEffect,
                { kind: "spring" }
              >
            }
            kind="spring"
            onChange={(effect) => replaceEffect("spring", effect)}
          />
        )}
        <EffectToggle
          label="Вата"
          checked={has("cotton")}
          onChange={(enabled) => setEffect("cotton", enabled)}
        />
        {effects.find((effect) => effect.kind === "cotton")?.kind === "cotton" && (
          <EffectTuning
            effect={
              effects.find((effect) => effect.kind === "cotton") as Extract<
                PlayerBlockEffect,
                { kind: "cotton" }
              >
            }
            kind="cotton"
            onChange={(effect) => replaceEffect("cotton", effect)}
          />
        )}
        <EffectToggle
          label="Пульсация"
          checked={has("pulse")}
          onChange={(enabled) => setEffect("pulse", enabled)}
        />
        {effects.find((effect) => effect.kind === "pulse")?.kind === "pulse" && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <NumberField
              label="Амплитуда"
              min={0.1}
              max={2}
              step={0.1}
              value={
                effects.find((effect) => effect.kind === "pulse")?.kind === "pulse"
                  ? effects.find((effect) => effect.kind === "pulse")!.amplitude
                  : 0.5
              }
              onChange={(amplitude) =>
                replaceEffect("pulse", { ...getEffect("pulse", effects), amplitude })
              }
            />
            <NumberField
              label="Частота"
              min={0.1}
              max={5}
              step={0.1}
              value={
                effects.find((effect) => effect.kind === "pulse")?.kind === "pulse"
                  ? effects.find((effect) => effect.kind === "pulse")!.frequency
                  : 1
              }
              onChange={(frequency) =>
                replaceEffect("pulse", { ...getEffect("pulse", effects), frequency })
              }
            />
          </div>
        )}
        <EffectToggle
          label="Магнит"
          checked={has("magnet")}
          onChange={(enabled) => setEffect("magnet", enabled)}
        />
        {effects.find((effect) => effect.kind === "magnet")?.kind === "magnet" && (
          <MagnetFields
            effect={
              effects.find((effect) => effect.kind === "magnet") as Extract<
                PlayerBlockEffect,
                { kind: "magnet" }
              >
            }
            onChange={(effect) => replaceEffect("magnet", effect)}
          />
        )}
        <EffectToggle
          label="Портал"
          checked={has("portal")}
          onChange={(enabled) => setEffect("portal", enabled)}
        />
        {effects.find((effect) => effect.kind === "portal")?.kind === "portal" && (
          <Field label="ID пары порталов">
            <input
              className={INPUT_CLASS}
              value={
                effects.find((effect) => effect.kind === "portal")?.kind === "portal"
                  ? effects.find((effect) => effect.kind === "portal")!.pairId
                  : ""
              }
              onChange={(event) =>
                replaceEffect("portal", { kind: "portal", pairId: event.target.value })
              }
            />
          </Field>
        )}
      </section>

      <div className="mt-auto flex gap-2 border-t border-line pt-3">
        <button
          className="btn-ghost flex-1 px-3 py-2 text-xs"
          onClick={() =>
            dispatch({
              type: "ADD_BLOCK",
              position: { x: block.position.x + block.size.width + 24, y: block.position.y },
              block: { ...block, id: undefined },
            })
          }
          type="button"
        >
          Дублировать
        </button>
        <button
          className="btn-ghost flex-1 border-punch/50 px-3 py-2 text-xs text-punch"
          onClick={() => dispatch({ type: "DELETE_BLOCK", blockId: block.id })}
          type="button"
        >
          Удалить
        </button>
      </div>
    </aside>
  )

  function replaceEffect<K extends PlayerBlockEffect["kind"]>(
    kind: K,
    replacement: Extract<PlayerBlockEffect, { kind: K }>
  ) {
    updateBlock({ effects: [...effects.filter((effect) => effect.kind !== kind), replacement] })
  }
}

const INPUT_CLASS =
  "w-full rounded-lg border border-line bg-abyss px-3 py-2 text-sm text-foam outline-none focus:border-cyan-neon"

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="hud-label">{label}</span>
      {children}
    </label>
  )
}

function NumberField({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
}) {
  const normalize = (raw: number) => {
    const precision = step < 1 ? 1 : 0
    const factor = 10 ** precision
    return Math.max(min, Math.min(max, (Math.round(raw / step) * step * factor) / factor))
  }
  return (
    <Field label={label}>
      <div className="space-y-1.5">
        <input
          className={INPUT_CLASS}
          max={max}
          min={min}
          onChange={(event) => onChange(normalize(Number(event.target.value)))}
          step={step}
          type="number"
          value={normalize(value)}
        />
        <input
          aria-label={`${label} слайдер`}
          className="w-full accent-cyan-neon"
          max={max}
          min={min}
          onChange={(event) => onChange(normalize(Number(event.target.value)))}
          step={step}
          type="range"
          value={Math.max(min, Math.min(max, value))}
        />
      </div>
    </Field>
  )
}

function EffectToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-line bg-abyss/50 px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 accent-cyan-neon"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  )
}

function MagnetFields({
  effect,
  onChange,
}: {
  effect: Extract<PlayerBlockEffect, { kind: "magnet" }>
  onChange: (effect: Extract<PlayerBlockEffect, { kind: "magnet" }>) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <Field label="Полярность">
        <select
          className={INPUT_CLASS}
          onChange={(event) =>
            onChange({ ...effect, mode: event.target.value as "attract" | "repel" })
          }
          value={effect.mode ?? "attract"}
        >
          <option value="attract">Притяжение</option>
          <option value="repel">Отталкивание</option>
        </select>
      </Field>
      <NumberField
        label="Радиус"
        min={50}
        max={500}
        value={effect.radius ?? 240}
        onChange={(radius) => onChange({ ...effect, radius })}
      />
      <NumberField
        label="Сила"
        min={-5000}
        max={5000}
        value={effect.force ?? 2200}
        onChange={(force) => onChange({ ...effect, force })}
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-abyss/60 p-3">
      <div className="font-display text-lg text-cyan-neon">{value}</div>
      <div className="hud-label">{label}</div>
    </div>
  )
}

function defaultEffect(
  kind: PlayerBlockEffect["kind"],
  _block: PlayerBlockSpec
): PlayerBlockEffect | null {
  switch (kind) {
    case "armor":
      return { kind, amount: 1 }
    case "brittle":
      return { kind, radius: 120, damage: 1 }
    case "phase":
      return { kind, period: 3.2, activeFraction: 0.62, offset: 0 }
    case "spring":
      return { kind }
    case "cotton":
      return { kind }
    case "pulse":
      return { kind, amplitude: 0.5, frequency: 1 }
    case "magnet":
      return { kind, mode: "attract", radius: 240, force: 2200 }
    case "portal":
      return { kind, pairId: "portal-pair" }
    case "spin":
      return { kind, direction: "clockwise" }
    case "normal":
      return { kind }
  }
}

function getEffect<K extends PlayerBlockEffect["kind"]>(
  kind: K,
  effects: PlayerBlockEffect[]
): Extract<PlayerBlockEffect, { kind: K }> {
  const effect = effects.find((item) => item.kind === kind)
  return (effect ??
    defaultEffect(kind, {
      id: "",
      position: { x: 0, y: 0 },
      shape: "ellipse",
      size: { width: 40, height: 40 },
      hp: 1,
    })) as Extract<PlayerBlockEffect, { kind: K }>
}

function EffectTuning({
  effect,
  kind,
  onChange,
}: {
  effect: Extract<PlayerBlockEffect, { kind: "spring" | "cotton" }>
  kind: "spring" | "cotton"
  onChange: (effect: Extract<PlayerBlockEffect, { kind: "spring" | "cotton" }>) => void
}) {
  const min = kind === "spring" ? 1.1 : 0.1
  const max = kind === "spring" ? 3 : 0.9
  const fallback = kind === "spring" ? 1.3 : 0.5
  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <NumberField
        label="Множитель скорости"
        min={min}
        max={max}
        step={0.1}
        value={effect.speedMultiplier ?? fallback}
        onChange={(speedMultiplier) => onChange({ ...effect, speedMultiplier })}
      />
      <NumberField
        label="Длительность (сек)"
        min={1}
        max={10}
        step={0.5}
        value={effect.duration ?? 2}
        onChange={(duration) => onChange({ ...effect, duration })}
      />
    </div>
  )
}
