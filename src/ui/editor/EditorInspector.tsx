import { TIER } from "../../game/palette"
import type { PlayerBlockEffect, PlayerBlockSpec, PlayerMapWinCondition } from "../../game/mapSpec"

import { defaultEffect } from "./editorState"
import { getBlocksBoundingBox } from "./EditorCanvas"
import type { EditorAction, EditorInspectorProps, EditorState, PlayerBlockUpdates } from "./types"

export function EditorInspector({ state, dispatch, author }: EditorInspectorProps) {
  const block =
    state.selectedBlockIds.length === 1
      ? state.map.blocks.find((item) => item.id === state.selectedBlockIds[0])
      : state.map.blocks.find((item) => item.id === state.selectedBlockId)
  const updateBlock = (updates: PlayerBlockUpdates) => {
    if (block) dispatch({ type: "UPDATE_BLOCK", blockId: block.id, updates })
  }

  if (state.selectedBlockIds.length > 1) {
    return <GroupInspector state={state} dispatch={dispatch} />
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
    let next = effects.filter((effect) => effect.kind !== kind)
    if (enabled && kind === "spring") {
      next = next.filter((effect) => effect.kind !== "cotton")
    } else if (enabled && kind === "cotton") {
      next = next.filter((effect) => effect.kind !== "spring")
    }
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

      <CloneSpacingControl
        dimH={block.size.height}
        dimW={block.size.width}
        gap={state.singleCloneGap ?? 0}
        label="Зазор протяжки блока"
        onChange={(gap) => dispatch({ type: "SET_SINGLE_CLONE_GAP", gap })}
        tip="Потяните изумрудный «+» в правом нижнем углу блока. Колёсико мыши меняет зазор."
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

function CloneSpacingControl({
  label,
  gap,
  onChange,
  dimW,
  dimH,
  tip,
}: {
  label: string
  gap: number
  onChange: (gap: number) => void
  dimW: number
  dimH: number
  tip?: string
}) {
  const PRESETS = [
    { label: "0 (встык)", value: 0 },
    { label: "+8", value: 8 },
    { label: "+16", value: 16 },
    { label: "+32", value: 32 },
    { label: "+64", value: 64 },
  ]
  const stepW = Math.max(8, Math.round(dimW + gap))
  const stepH = Math.max(8, Math.round(dimH + gap))

  return (
    <div className="space-y-2 rounded-lg border border-line bg-abyss/40 p-3">
      <div className="flex items-center justify-between">
        <span className="hud-label">{label}</span>
        <span className="font-mono text-xs font-bold text-cyan-neon">
          {gap > 0 ? `+${gap} px` : `${gap} px`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              gap === p.value
                ? "bg-cyan-neon font-bold text-abyss shadow-sm"
                : "border border-line bg-deep/70 text-foam hover:border-cyan-neon/50"
            }`}
            onClick={() => onChange(p.value)}
            type="button"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          className="btn-ghost px-2 py-1 text-xs"
          onClick={() => onChange(Math.max(-60, gap - 4))}
          title="Уменьшить зазор на 4px"
          type="button"
        >
          -4
        </button>
        <input
          aria-label={label}
          className="w-full accent-cyan-neon"
          max={200}
          min={-60}
          onChange={(e) => onChange(Number(e.target.value))}
          step={4}
          type="range"
          value={gap}
        />
        <button
          className="btn-ghost px-2 py-1 text-xs"
          onClick={() => onChange(Math.min(300, gap + 4))}
          title="Увеличить зазор на 4px"
          type="button"
        >
          +4
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-line/30 pt-1.5 font-mono text-[11px] text-dim">
        <span>
          Шаг гориз.: <strong className="text-foam">{stepW}px</strong>
        </span>
        <span>
          Шаг верт.: <strong className="text-foam">{stepH}px</strong>
        </span>
      </div>

      {tip && <p className="text-[10px] text-emerald-300/80">💡 {tip}</p>}
    </div>
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

function GroupInspector({
  state,
  dispatch,
}: {
  state: EditorState
  dispatch: (action: EditorAction) => void
}) {
  const selectedBlocks = state.map.blocks.filter((item) => state.selectedBlockIds.includes(item.id))
  const count = selectedBlocks.length
  const bbox = getBlocksBoundingBox(selectedBlocks)
  const totalHp = selectedBlocks.reduce((sum, item) => sum + item.hp, 0)
  const avgHp = Math.round(totalHp / (count || 1))

  const allSameHp = selectedBlocks.every((item) => item.hp === selectedBlocks[0]!.hp)
  const commonHp = allSameHp ? selectedBlocks[0]!.hp : avgHp
  const hpTier = TIER[Math.min(3, Math.max(1, Math.round(commonHp))) as 1 | 2 | 3]

  const allSameShape = selectedBlocks.every((item) => item.shape === selectedBlocks[0]!.shape)
  const commonShape = allSameShape ? selectedBlocks[0]!.shape : "mixed"

  const allSameWidth = selectedBlocks.every(
    (item) => item.size.width === selectedBlocks[0]!.size.width
  )
  const commonWidth = allSameWidth
    ? selectedBlocks[0]!.size.width
    : Math.round(selectedBlocks.reduce((sum, item) => sum + item.size.width, 0) / (count || 1))

  const allSameHeight = selectedBlocks.every(
    (item) => item.size.height === selectedBlocks[0]!.size.height
  )
  const commonHeight = allSameHeight
    ? selectedBlocks[0]!.size.height
    : Math.round(selectedBlocks.reduce((sum, item) => sum + item.size.height, 0) / (count || 1))

  const allSameRot = selectedBlocks.every(
    (item) => Math.abs((item.rotation ?? 0) - (selectedBlocks[0]!.rotation ?? 0)) < 0.01
  )
  const commonRot = allSameRot
    ? Math.round(((selectedBlocks[0]!.rotation ?? 0) * 180) / Math.PI / 5) * 5
    : 0

  const updateSelected = (updates: PlayerBlockUpdates) => {
    dispatch({ type: "UPDATE_BLOCKS", blockIds: state.selectedBlockIds, updates })
  }

  const setGroupEffect = (
    kind: PlayerBlockEffect["kind"],
    enabled: boolean,
    effect?: PlayerBlockEffect
  ) => {
    dispatch({
      type: "SET_BLOCKS_EFFECT",
      blockIds: state.selectedBlockIds,
      kind,
      enabled,
      effect,
    })
  }

  const getEffectCount = (kind: PlayerBlockEffect["kind"]) =>
    selectedBlocks.filter((item) => item.effects?.some((e) => e.kind === kind)).length

  const portalBlocks = selectedBlocks.filter((item) =>
    item.effects?.some((e) => e.kind === "portal")
  )
  const isLinkedPortalPair =
    count === 2 &&
    portalBlocks.length === 2 &&
    portalBlocks[0]!.effects?.find((e) => e.kind === "portal")?.kind === "portal" &&
    portalBlocks[1]!.effects?.find((e) => e.kind === "portal")?.kind === "portal" &&
    (portalBlocks[0]!.effects?.find((e) => e.kind === "portal") as { pairId: string }).pairId ===
      (portalBlocks[1]!.effects?.find((e) => e.kind === "portal") as { pairId: string }).pairId

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-line bg-deep/95 p-4 text-foam">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-cyan-neon">Множественный выбор</h2>
          <p className="text-xs text-dim">Выбрано блоков: {count}</p>
        </div>
        <span className="rounded-full bg-cyan-neon/20 border border-cyan-neon/40 px-2.5 py-0.5 text-xs text-cyan-neon font-bold">
          {count} бл.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line/40">
        <button
          type="button"
          className="btn-ghost flex items-center justify-between px-2.5 py-1.5 text-xs text-foam hover:border-cyan-neon"
          onClick={() => dispatch({ type: "COPY_SELECTED" })}
          title="Скопировать выделенную группу (Ctrl+C)"
        >
          <span>📋 Копия</span>
          <kbd className="rounded bg-abyss px-1 py-0.5 text-[10px] text-dim">Ctrl+C</kbd>
        </button>
        <button
          type="button"
          className="btn-ghost flex items-center justify-between px-2.5 py-1.5 text-xs text-cyan-neon hover:border-cyan-neon"
          onClick={() => dispatch({ type: "START_PASTE" })}
          title="Вставить с фантомом под курсором (Ctrl+V)"
        >
          <span>✨ Фантом</span>
          <kbd className="rounded bg-abyss px-1 py-0.5 text-[10px] text-dim">Ctrl+V</kbd>
        </button>
        <button
          type="button"
          className="btn-ghost flex items-center justify-between px-2.5 py-1.5 text-xs text-punch hover:border-punch/60"
          onClick={() => dispatch({ type: "DELETE_SELECTED_BLOCKS" })}
          title="Удалить выделенные блоки (Delete / Backspace)"
        >
          <span>🗑 Удалить</span>
          <kbd className="rounded bg-abyss px-1 py-0.5 text-[10px] text-dim">Del</kbd>
        </button>
        <button
          type="button"
          className="btn-ghost flex items-center justify-between px-2.5 py-1.5 text-xs text-dim hover:text-foam"
          onClick={() => dispatch({ type: "SELECT_BLOCKS", blockIds: [] })}
          title="Снять выделение со всех блоков (Escape)"
        >
          <span>✖ Снять</span>
          <kbd className="rounded bg-abyss px-1 py-0.5 text-[10px] text-dim">Esc</kbd>
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-emerald-400/25 bg-abyss/40 px-3 py-2 text-[11px] text-emerald-300">
        <span className="text-base leading-none">✨</span>
        <span>
          <strong>Копирование протяжкой:</strong> потяните мышью за маркер <strong>«+»</strong> в
          правом нижнем углу рамки на поле.
        </span>
      </div>

      <CloneSpacingControl
        dimH={bbox.height}
        dimW={bbox.width}
        gap={state.groupCloneGap ?? 0}
        label="Зазор протяжки группы"
        onChange={(gap) => dispatch({ type: "SET_GROUP_CLONE_GAP", gap })}
        tip="Колёсико мыши регулирует зазор между группами при протяжке."
      />

      <section className="space-y-3 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <span className="hud-label">Здоровье (HP)</span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ backgroundColor: hpTier.base, color: "#07131b" }}
          >
            {allSameHp ? `HP ${commonHp}` : `~ HP ${commonHp}`}
          </span>
        </div>
        <input
          className="w-full accent-cyan-neon"
          max="8"
          min="1"
          onChange={(event) => updateSelected({ hp: Number(event.target.value) })}
          style={{ accentColor: hpTier.base }}
          type="range"
          value={commonHp}
        />
        <div className="flex justify-between font-mono text-[11px] text-dim">
          <span>1</span>
          <span>4</span>
          <span>8</span>
        </div>
        <div className="flex gap-1.5 pt-0.5">
          {[1, 2, 3, 5, 8].map((h) => (
            <button
              key={h}
              type="button"
              className={`flex-1 rounded border border-line py-1 text-xs transition-colors hover:border-cyan-neon ${
                allSameHp && commonHp === h
                  ? "bg-cyan-neon/20 text-cyan-neon font-bold"
                  : "bg-abyss text-foam"
              }`}
              onClick={() => updateSelected({ hp: h })}
            >
              {h}
            </button>
          ))}
        </div>
      </section>

      <Field label="Форма (для всех)">
        <select
          className={INPUT_CLASS}
          onChange={(event) => {
            const shape = event.target.value as PlayerBlockSpec["shape"]
            updateSelected({ shape })
          }}
          value={commonShape}
        >
          {!allSameShape && (
            <option value="mixed" disabled>
              — Смешанные формы (
              {Array.from(new Set(selectedBlocks.map((b) => b.shape))).join(", ")}) —
            </option>
          )}
          <option value="circle">Круг (круглые блоки)</option>
          <option value="ellipse">Эллипс</option>
          <option value="rect">Прямоугольник</option>
          <option value="round_rect">Скруглённый прямоугольник</option>
        </select>
        {commonShape === "circle" && (
          <p className="mt-1 text-[11px] text-dim">
            ✓ У круга ширина и высота автоматически приравниваются.
          </p>
        )}
      </Field>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Ширина"
            min={20}
            max={100}
            value={commonWidth}
            onChange={(width) => updateSelected({ size: { width } })}
          />
          <NumberField
            label="Высота"
            min={20}
            max={100}
            value={commonHeight}
            onChange={(height) => updateSelected({ size: { height } })}
          />
        </div>
        <div className="flex gap-1 pt-0.5">
          {[
            { w: 32, h: 32, label: "32×32" },
            { w: 40, h: 40, label: "40×40" },
            { w: 64, h: 40, label: "64×40" },
            { w: 80, h: 40, label: "80×40" },
            { w: 90, h: 45, label: "90×45" },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="flex-1 rounded border border-line bg-abyss py-1 text-[10px] text-dim hover:text-foam hover:border-cyan-neon"
              onClick={() => updateSelected({ size: { width: preset.w, height: preset.h } })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="hud-label">Поворот (°)</span>
          {commonRot !== 0 && (
            <button
              type="button"
              className="text-[11px] text-cyan-neon hover:underline"
              onClick={() => updateSelected({ rotation: 0 })}
            >
              Сброс на 0°
            </button>
          )}
        </div>
        <NumberField
          label=""
          min={-360}
          max={360}
          step={5}
          value={commonRot}
          onChange={(deg) => updateSelected({ rotation: (deg * Math.PI) / 180 })}
        />
      </div>

      <section className="space-y-3 border-t border-line pt-3">
        <div>
          <h3 className="hud-label">Массовые эффекты</h3>
          <p className="mt-0.5 text-[11px] text-dim">
            Включение и параметры применяются ко всем выбранным блокам.
          </p>
        </div>

        <GroupEffectRow
          label="Броня"
          kind="armor"
          count={getEffectCount("armor")}
          total={count}
          onToggle={(enabled) => setGroupEffect("armor", enabled)}
        >
          <NumberField
            label="Очки брони"
            min={1}
            max={5}
            value={
              selectedBlocks
                .find((b) => b.effects?.some((e) => e.kind === "armor"))
                ?.effects?.find((e) => e.kind === "armor")?.kind === "armor"
                ? (
                    selectedBlocks
                      .find((b) => b.effects?.some((e) => e.kind === "armor"))!
                      .effects!.find((e) => e.kind === "armor") as { amount: number }
                  ).amount
                : 1
            }
            onChange={(amount) => setGroupEffect("armor", true, { kind: "armor", amount })}
          />
        </GroupEffectRow>

        <GroupEffectRow
          label="Хрупкая цепь"
          kind="brittle"
          count={getEffectCount("brittle")}
          total={count}
          onToggle={(enabled) => setGroupEffect("brittle", enabled)}
        >
          <div className="space-y-2 rounded-lg border border-line p-3">
            <NumberField
              label="Радиус цепи"
              min={40}
              max={400}
              value={120}
              onChange={(radius) =>
                setGroupEffect("brittle", true, { kind: "brittle", radius, damage: 1 })
              }
            />
            <NumberField
              label="Цепной урон"
              min={1}
              max={3}
              value={1}
              onChange={(damage) =>
                setGroupEffect("brittle", true, { kind: "brittle", radius: 120, damage })
              }
            />
          </div>
        </GroupEffectRow>

        <GroupEffectRow
          label="Фазовый блок"
          kind="phase"
          count={getEffectCount("phase")}
          total={count}
          onToggle={(enabled) => setGroupEffect("phase", enabled)}
        >
          <div className="space-y-2 rounded-lg border border-line p-3">
            <NumberField
              label="Период (сек)"
              min={1}
              max={10}
              step={0.2}
              value={3.2}
              onChange={(period) =>
                setGroupEffect("phase", true, {
                  kind: "phase",
                  period,
                  activeFraction: 0.6,
                  offset: 0,
                })
              }
            />
            <NumberField
              label="Доля активности"
              min={0.1}
              max={0.9}
              step={0.05}
              value={0.6}
              onChange={(activeFraction) =>
                setGroupEffect("phase", true, {
                  kind: "phase",
                  period: 3.2,
                  activeFraction,
                  offset: 0,
                })
              }
            />
          </div>
        </GroupEffectRow>

        <GroupEffectRow
          label="Пружина (ускоритель)"
          kind="spring"
          count={getEffectCount("spring")}
          total={count}
          mutualNotice="Взаимоисключение: автоматически снимает «Вату»"
          onToggle={(enabled) => setGroupEffect("spring", enabled)}
        >
          <EffectTuning
            effect={{ kind: "spring", speedMultiplier: 1.3, duration: 2 }}
            kind="spring"
            onChange={(effect) => setGroupEffect("spring", true, effect)}
          />
        </GroupEffectRow>

        <GroupEffectRow
          label="Вата (замедлитель)"
          kind="cotton"
          count={getEffectCount("cotton")}
          total={count}
          mutualNotice="Взаимоисключение: автоматически снимает «Пружину»"
          onToggle={(enabled) => setGroupEffect("cotton", enabled)}
        >
          <EffectTuning
            effect={{ kind: "cotton", speedMultiplier: 0.5, duration: 2 }}
            kind="cotton"
            onChange={(effect) => setGroupEffect("cotton", true, effect)}
          />
        </GroupEffectRow>

        <GroupEffectRow
          label="Пульсация"
          kind="pulse"
          count={getEffectCount("pulse")}
          total={count}
          onToggle={(enabled) => setGroupEffect("pulse", enabled)}
        >
          <div className="space-y-2 rounded-lg border border-line p-3">
            <NumberField
              label="Амплитуда"
              min={0.1}
              max={2}
              step={0.1}
              value={0.5}
              onChange={(amplitude) =>
                setGroupEffect("pulse", true, { kind: "pulse", amplitude, frequency: 1 })
              }
            />
            <NumberField
              label="Частота"
              min={0.1}
              max={5}
              step={0.1}
              value={1}
              onChange={(frequency) =>
                setGroupEffect("pulse", true, { kind: "pulse", amplitude: 0.5, frequency })
              }
            />
          </div>
        </GroupEffectRow>

        <GroupEffectRow
          label="Магнит"
          kind="magnet"
          count={getEffectCount("magnet")}
          total={count}
          onToggle={(enabled) => setGroupEffect("magnet", enabled)}
        >
          <MagnetFields
            effect={{ kind: "magnet", mode: "attract", radius: 240, force: 2200 }}
            onChange={(effect) => setGroupEffect("magnet", true, effect)}
          />
        </GroupEffectRow>

        <div className="rounded-lg border border-line/70 bg-abyss/40 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foam">Порталы</span>
            {count === 2 ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isLinkedPortalPair ? "bg-emerald-400/20 text-emerald-300" : "bg-cyan-neon/20 text-cyan-neon"}`}
              >
                {isLinkedPortalPair ? "✓ Пара связана" : "Выбрано ровно 2 блока"}
              </span>
            ) : (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-300 font-semibold">
                Требуется 2 блока (сейчас: {count})
              </span>
            )}
          </div>

          {count === 2 ? (
            isLinkedPortalPair ? (
              <div className="space-y-2">
                <p className="text-[11px] text-emerald-300">
                  Выделенные 2 блока образуют согласованную пару порталов.
                </p>
                <button
                  type="button"
                  className="btn-ghost w-full py-1.5 text-xs text-punch hover:border-punch/60"
                  onClick={() =>
                    dispatch({ type: "UNLINK_PORTALS", blockIds: state.selectedBlockIds })
                  }
                >
                  Разорвать связь порталов
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-dim">
                  Свяжите два блока в парный телепорт, чтобы шар переносился между ними.
                </p>
                <button
                  type="button"
                  className="btn-ghost w-full py-1.5 text-xs text-cyan-neon hover:border-cyan-neon"
                  onClick={() =>
                    dispatch({
                      type: "LINK_PORTAL_PAIR",
                      blockIds: [state.selectedBlockIds[0]!, state.selectedBlockIds[1]!],
                    })
                  }
                >
                  🔗 Связать в пару порталов
                </button>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-dim">
                Порталы на карте обязаны быть строго парными (ровно 2 блока на ID пары). Массовое
                добавление порталов на произвольное число блоков заблокировано для сохранения
                валидности карты.
              </p>
              {portalBlocks.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost w-full py-1 text-xs text-punch hover:border-punch/60"
                  onClick={() =>
                    dispatch({ type: "UNLINK_PORTALS", blockIds: state.selectedBlockIds })
                  }
                >
                  Очистить порталы из группы ({portalBlocks.length} бл.)
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="pt-2 border-t border-line/40 text-[11px] text-dim space-y-1">
        <p>
          • <span className="text-foam">Ctrl+Z</span> — отмена изменений / перемещений
        </p>
        <p>
          • <span className="text-foam">Ctrl+Y</span> — повтор операции
        </p>
      </div>
    </aside>
  )
}

function GroupEffectRow({
  label,
  kind: _kind,
  count,
  total,
  mutualNotice,
  onToggle,
  children,
}: {
  label: string
  kind: PlayerBlockEffect["kind"]
  count: number
  total: number
  mutualNotice?: string
  onToggle: (enabled: boolean) => void
  children?: React.ReactNode
}) {
  const all = count === total
  const some = count > 0 && count < total
  const none = count === 0

  return (
    <div className="rounded-lg border border-line bg-abyss/40 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foam">{label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              all
                ? "bg-emerald-400/20 text-emerald-300"
                : some
                  ? "bg-amber-400/20 text-amber-300"
                  : "bg-abyss text-dim"
            }`}
          >
            {all ? "✓ У всех" : some ? `~ ${count}/${total}` : "Выкл"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {none && (
            <button
              type="button"
              className="rounded border border-cyan-neon/40 bg-cyan-neon/10 px-2 py-0.5 text-[11px] text-cyan-neon hover:bg-cyan-neon/20"
              onClick={() => onToggle(true)}
            >
              Включить
            </button>
          )}
          {some && (
            <>
              <button
                type="button"
                className="rounded border border-cyan-neon/40 bg-cyan-neon/10 px-2 py-0.5 text-[11px] text-cyan-neon hover:bg-cyan-neon/20"
                onClick={() => onToggle(true)}
              >
                Все
              </button>
              <button
                type="button"
                className="rounded border border-punch/40 bg-punch/10 px-2 py-0.5 text-[11px] text-punch hover:bg-punch/20"
                onClick={() => onToggle(false)}
              >
                Снять
              </button>
            </>
          )}
          {all && (
            <button
              type="button"
              className="rounded border border-line bg-abyss px-2 py-0.5 text-[11px] text-dim hover:text-punch hover:border-punch/50"
              onClick={() => onToggle(false)}
            >
              Снять
            </button>
          )}
        </div>
      </div>
      {mutualNotice && (all || some) && (
        <p className="text-[10px] text-amber-300/90">{mutualNotice}</p>
      )}
      {(all || some) && children}
    </div>
  )
}
