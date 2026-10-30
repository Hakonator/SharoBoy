import { useState } from "react"

import type { PlayerBlockSpec } from "../../game/mapSpec"

import {
  BUILTIN_PREFABS,
  deleteCustomPrefab,
  loadCustomPrefabs,
  saveCustomPrefab,
  type EditorPrefab,
} from "./prefabs"
import type { EditorAction, EditorState } from "./types"

interface EditorPrefabsModalProps {
  state: EditorState
  dispatch: (action: EditorAction) => void
  onClose: () => void
  onNotice?: (text: string) => void
}

type CategoryFilter = "all" | "geometry" | "tactical" | "shapes" | "custom"

const CATEGORIES: Array<{
  id: CategoryFilter
  label: (allCount: number, customCount: number) => string
}> = [
  { id: "all", label: (all) => `Все (${all})` },
  { id: "geometry", label: () => "Геометрия" },
  { id: "tactical", label: () => "Тактические / Порталы" },
  { id: "shapes", label: () => "Фигурные" },
  { id: "custom", label: (_, custom) => `Мои шаблоны (${custom})` },
]

export function EditorPrefabsModal({
  state,
  dispatch,
  onClose,
  onNotice,
}: EditorPrefabsModalProps) {
  const [customPrefabs, setCustomPrefabs] = useState<EditorPrefab[]>(() => loadCustomPrefabs())
  const [category, setCategory] = useState<CategoryFilter>("all")
  const [saveTitle, setSaveTitle] = useState("")
  const [saveDesc, setSaveDesc] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const selectedBlocks = state.map.blocks.filter((b) => state.selectedBlockIds.includes(b.id))
  const canSaveSelection = selectedBlocks.length > 0

  const allPrefabs = [...customPrefabs, ...BUILTIN_PREFABS]
  const filtered =
    category === "all" ? allPrefabs : allPrefabs.filter((p) => p.category === category)

  const handleApplyPrefab = (prefab: EditorPrefab) => {
    // Clone blocks and generate fresh IDs
    const cloned: PlayerBlockSpec[] = prefab.blocks.map((b, idx) => ({
      ...structuredClone(b),
      id: `prefab-blk-${Date.now()}-${idx}`,
      position: { x: 960 + b.position.x, y: 500 + b.position.y },
    }))

    // Copy to clipboard and trigger interactive paste phantom
    dispatch({ type: "COPY_SELECTED" })
    dispatch({ type: "COMMIT_PASTE", blocks: cloned })
    onNotice?.(`Шаблон «${prefab.title}» размещён на поле.`)
    onClose()
  }

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSaveSelection) return
    const saved = saveCustomPrefab(saveTitle, saveDesc, selectedBlocks)
    setCustomPrefabs(loadCustomPrefabs())
    setSaveTitle("")
    setSaveDesc("")
    setIsSaving(false)
    onNotice?.(`Шаблон «${saved.title}» сохранён!`)
  }

  const handleDeleteCustom = (id: string) => {
    deleteCustomPrefab(id)
    setCustomPrefabs(loadCustomPrefabs())
    onNotice?.("Пользовательский шаблон удалён.")
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-cyan-neon/30 bg-abyss p-6 text-foam shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="font-display text-xl text-cyan-neon">Библиотека шаблонов (Префабы)</h2>
            <p className="text-xs text-dim">
              Быстрая вставка готовых геометрических фигур и сохранение собственных шаблонов
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost rounded-lg px-3 py-1.5 text-sm hover:border-punch hover:text-punch"
            onClick={onClose}
          >
            ✖ Закрыть
          </button>
        </div>

        {canSaveSelection && (
          <div className="mt-4 rounded-xl border border-emerald-400/40 bg-deep/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-300">
                💾 Сохранить выделение ({selectedBlocks.length} бл.) как новый шаблон
              </span>
              {!isSaving ? (
                <button
                  type="button"
                  className="rounded-lg border border-emerald-400 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                  onClick={() => setIsSaving(true)}
                >
                  + Сохранить шаблон
                </button>
              ) : null}
            </div>
            {isSaving && (
              <form onSubmit={handleSaveCustom} className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Название шаблона (напр., «Шестигранник»)"
                  className="flex-1 rounded-lg border border-line bg-abyss px-3 py-1.5 text-xs text-foam outline-none focus:border-cyan-neon"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  autoFocus
                  required
                />
                <input
                  type="text"
                  placeholder="Краткое описание"
                  className="flex-1 rounded-lg border border-line bg-abyss px-3 py-1.5 text-xs text-foam outline-none focus:border-cyan-neon"
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-bold text-abyss hover:bg-emerald-400"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => setIsSaving(false)}
                >
                  Отмена
                </button>
              </form>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-1.5 border-b border-line pb-3 text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`rounded-lg px-3 py-1.5 transition-colors ${
                category === cat.id
                  ? "bg-cyan-neon/20 border border-cyan-neon text-cyan-neon font-semibold"
                  : "bg-deep text-dim hover:text-foam"
              }`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label(allPrefabs.length, customPrefabs.length)}
            </button>
          ))}
        </div>

        <div className="mt-4 grid flex-1 grid-cols-1 gap-3.5 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((prefab) => (
            <div
              key={prefab.id}
              className="flex flex-col justify-between rounded-xl border border-line/60 bg-deep/70 p-4 transition-all hover:border-cyan-neon hover:shadow-lg hover:shadow-cyan-neon/5"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm text-foam">{prefab.title}</h3>
                  <span className="rounded bg-abyss px-1.5 py-0.5 text-[10px] font-mono text-cyan-neon border border-cyan-neon/30">
                    {prefab.blocks.length} бл.
                  </span>
                </div>
                <p className="mt-1 text-xs text-dim leading-snug">{prefab.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-line/30">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-cyan-neon/50 bg-cyan-neon/15 px-3 py-1.5 text-xs font-semibold text-cyan-neon transition-colors hover:bg-cyan-neon/30"
                  onClick={() => handleApplyPrefab(prefab)}
                >
                  ✨ Вставить на карту
                </button>
                {prefab.category === "custom" && (
                  <button
                    type="button"
                    className="rounded-lg border border-punch/40 p-1.5 text-xs text-punch hover:bg-punch/20"
                    title="Удалить пользовательский шаблон"
                    onClick={() => handleDeleteCustom(prefab.id)}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
