import { TIER } from "../../game/palette"
import type { PlayerBlockEffect, PlayerBlockSpec, PlayerMapWinCondition } from "../../game/mapSpec"

import type { EditorInspectorProps } from "./types"

export function EditorInspector({ state, dispatch }: EditorInspectorProps) {
  const block = state.map.blocks.find((item) => item.id === state.selectedBlockId)
  const updateBlock = (updates: Partial<PlayerBlockSpec>) => {
    if (block) dispatch({ type: "UPDATE_BLOCK", blockId: block.id, updates })
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
            className={INPUT_CLASS}
            value={state.map.metadata.author ?? ""}
            onChange={(event) =>
              dispatch({ type: "UPDATE_METADATA", metadata: { author: event.target.value } })
            }
          />
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
        <input
          aria-label="Ширина слайдер"
          className="w-full accent-cyan-neon"
          max={100}
          min={20}
          onChange={(event) => {
            const width = Number(event.target.value)
            updateBlock({
              size: { width, height: block.shape === "circle" ? width : block.size.height },
            })
          }}
          type="range"
          value={block.size.width}
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
        <input
          aria-label="Высота слайдер"
          className="w-full accent-cyan-neon"
          max={100}
          min={20}
          onChange={(event) => {
            const height = Number(event.target.value)
            updateBlock({
              size: { width: block.shape === "circle" ? height : block.size.width, height },
            })
          }}
          type="range"
          value={block.size.height}
        />
      </div>
      <NumberField
        label="Поворот (°)"
        min={-360}
        max={360}
        step={1}
        value={((block.rotation ?? 0) * 180) / Math.PI}
        onChange={(degrees) => updateBlock({ rotation: (degrees * Math.PI) / 180 })}
      />
      <input
        aria-label="Поворот слайдер"
        className="w-full accent-cyan-neon"
        max={180}
        min={-180}
        onChange={(event) =>
          updateBlock({ rotation: (Number(event.target.value) * Math.PI) / 180 })
        }
        type="range"
        value={Math.max(-180, Math.min(180, ((block.rotation ?? 0) * 180) / Math.PI))}
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
  return (
    <Field label={label}>
      <input
        className={INPUT_CLASS}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={value}
      />
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
        min={1}
        max={1000}
        value={effect.radius ?? 240}
        onChange={(radius) => onChange({ ...effect, radius })}
      />
      <NumberField
        label="Сила"
        min={-10000}
        max={10000}
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
