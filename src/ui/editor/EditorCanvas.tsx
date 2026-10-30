import { useCallback, useEffect, useRef, useState } from "react"

import { TIER } from "../../game/palette"
import { PADDLE_ZONE_TOP } from "../../game/mapValidator"
import type { PlayerBlockEffect, PlayerBlockSpec } from "../../game/mapSpec"

import type { EditorCanvasProps, EditorState } from "./types"

const WORLD_WIDTH = 1920
const WORLD_HEIGHT = 1080
const HUD_BOTTOM = 140

interface DragState {
  kind: "move" | "marquee" | "resize" | "rotate" | "clone"
  blockIds: string[]
  startX: number
  startY: number
  originals: PlayerBlockSpec[]
  handle?: number
  clonePositions?: { x: number; y: number }[]
  source?: PlayerBlockSpec
  limitReached?: boolean
  moved: boolean
}

interface CanvasContextMenu {
  x: number
  y: number
  point: { x: number; y: number }
  blockId: string | null
}

function ContextMenuButton({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      className={`rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-cyan-neon/15 ${danger ? "text-punch hover:bg-punch/15" : "text-foam"}`}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      {children}
    </button>
  )
}

export function EditorCanvas({ state, dispatch, className = "" }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    block: PlayerBlockSpec
    position: { x: number; y: number }
  } | null>(null)
  const [marquee, setMarquee] = useState<{
    start: { x: number; y: number }
    end: { x: number; y: number }
  } | null>(null)
  const [groupPreview, setGroupPreview] = useState<{
    blocks: PlayerBlockSpec[]
    delta: { x: number; y: number }
  } | null>(null)
  const [clonePreview, setClonePreview] = useState<PlayerBlockSpec[]>([])
  const [canvasNotice, setCanvasNotice] = useState<string | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<CanvasContextMenu | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [phantomPos, setPhantomPos] = useState<{ x: number; y: number } | null>(null)
  const lastPointerPos = useRef<{ x: number; y: number }>({ x: 960, y: 500 })

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width <= 0 || size.height <= 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
    const context = canvas.getContext("2d")
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, size.width, size.height)
    context.fillStyle = "#07131b"
    context.fillRect(0, 0, size.width, size.height)

    const scale = Math.min(size.width / WORLD_WIDTH, size.height / WORLD_HEIGHT)
    const offsetX = (size.width - WORLD_WIDTH * scale) / 2
    const offsetY = (size.height - WORLD_HEIGHT * scale) / 2
    context.save()
    context.translate(offsetX, offsetY)
    context.scale(scale, scale)
    const draggedBlockIds = new Set<string>()
    if (groupPreview) {
      for (const block of groupPreview.blocks) draggedBlockIds.add(block.id)
    }
    if (dragPreview) draggedBlockIds.add(dragPreview.block.id)
    drawWorld(context, state, draggedBlockIds)
    if (dragPreview) {
      drawBlock(context, { ...dragPreview.block, position: dragPreview.position }, true, 0.76)
    }
    if (groupPreview)
      for (const block of groupPreview.blocks)
        drawBlock(
          context,
          {
            ...block,
            position: {
              x: block.position.x + groupPreview.delta.x,
              y: block.position.y + groupPreview.delta.y,
            },
          },
          true,
          0.72
        )
    const selected = state.map.blocks.filter((block) => state.selectedBlockIds.includes(block.id))
    if (selected.length === 1) {
      const selectedBlock = selected[0]!
      const previewBlock = dragPreview
        ? {
            ...selectedBlock,
            position: dragPreview.position,
            size: dragPreview.block.size,
            rotation: dragPreview.block.rotation,
          }
        : groupPreview
          ? {
              ...selectedBlock,
              position: {
                x: selectedBlock.position.x + groupPreview.delta.x,
                y: selectedBlock.position.y + groupPreview.delta.y,
              },
            }
          : selectedBlock
      drawTransformHandles(context, previewBlock)
    }
    for (const block of clonePreview) drawBlock(context, block, false, 0.42)
    if (marquee) drawMarquee(context, marquee.start, marquee.end)
    if (state.pastePhantom) {
      const targetPos = phantomPos ?? lastPointerPos.current
      const center = getBlocksBoundingCenter(state.pastePhantom)
      const rawDelta = { x: targetPos.x - center.x, y: targetPos.y - center.y }
      const delta = state.snapToGrid
        ? {
            x: Math.round(rawDelta.x / state.gridSize) * state.gridSize,
            y: Math.round(rawDelta.y / state.gridSize) * state.gridSize,
          }
        : rawDelta
      const clampedDelta = clampGroupPreview(state.pastePhantom, delta)
      const phantoms = state.pastePhantom.map((b) => ({
        ...b,
        position: {
          x: b.position.x + clampedDelta.x,
          y: b.position.y + clampedDelta.y,
        },
      }))

      drawPhantomGroup(context, phantoms)
      for (const block of phantoms) {
        drawBlock(context, block, true, 0.64)
      }
    }
    context.restore()
  }, [clonePreview, dragPreview, groupPreview, marquee, phantomPos, size, state])

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    },
    []
  )

  const showNotice = useCallback((message: string) => {
    setCanvasNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setCanvasNotice(null), 2600)
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !contextMenuRef.current?.contains(event.target)) {
        setContextMenu(null)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setContextMenu(null)
      }
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [contextMenu])

  const toWorldPoint = useCallback(
    (event: { clientX: number; clientY: number; currentTarget: HTMLCanvasElement }) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT)
      const offsetX = (rect.width - WORLD_WIDTH * scale) / 2
      const offsetY = (rect.height - WORLD_HEIGHT * scale) / 2
      return {
        x: (event.clientX - rect.left - offsetX) / scale,
        y: (event.clientY - rect.top - offsetY) / scale,
      }
    },
    []
  )

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (state.pastePhantom) {
      if (event.button === 0) {
        const point = toWorldPoint(event)
        const targetPos =
          point && isInsideWorld(point) ? point : (phantomPos ?? lastPointerPos.current)
        const center = getBlocksBoundingCenter(state.pastePhantom)
        const rawDelta = { x: targetPos.x - center.x, y: targetPos.y - center.y }
        const delta = state.snapToGrid
          ? {
              x: Math.round(rawDelta.x / state.gridSize) * state.gridSize,
              y: Math.round(rawDelta.y / state.gridSize) * state.gridSize,
            }
          : rawDelta
        const clampedDelta = clampGroupPreview(state.pastePhantom, delta)
        const committedBlocks = state.pastePhantom.map((b) => ({
          ...b,
          position: {
            x: b.position.x + clampedDelta.x,
            y: b.position.y + clampedDelta.y,
          },
        }))
        dispatch({ type: "COMMIT_PASTE", blocks: committedBlocks })
        setPhantomPos(null)
        showNotice(`Закреплено блоков: ${committedBlocks.length}. Нажмите Ctrl+Z для отмены.`)
      } else if (event.button === 2) {
        dispatch({ type: "CANCEL_PASTE" })
        setPhantomPos(null)
        showNotice("Вставка отменена.")
      }
      return
    }

    if (event.button !== 0) return
    const point = toWorldPoint(event)
    if (!point || !isInsideWorld(point)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const selected = state.map.blocks.filter((item) => state.selectedBlockIds.includes(item.id))
    if (selected.length === 1) {
      if (isCloneHandle(selected[0]!, point)) {
        if (selected[0]!.effects?.some((effect) => effect.kind === "portal")) {
          showNotice("Блоки с порталами нельзя копировать протяжкой: порталы требуют парной связи.")
          return
        }
        dragRef.current = {
          kind: "clone",
          blockIds: [selected[0]!.id],
          originals: [selected[0]!],
          source: selected[0]!,
          startX: point.x,
          startY: point.y,
          moved: false,
        }
        return
      }
      const handle = hitTestTransformHandle(selected[0]!, point)
      if (handle) {
        dragRef.current = {
          kind: handle.kind,
          blockIds: [selected[0]!.id],
          originals: [selected[0]!],
          startX: point.x,
          startY: point.y,
          handle: handle.index,
          moved: false,
        }
        return
      }
    }
    const block = hitTest(state.map.blocks, point)

    if (state.activeTool === "add") {
      dispatch({ type: "ADD_BLOCK", position: point })
      return
    }
    if (state.activeTool === "delete") {
      if (block) dispatch({ type: "DELETE_BLOCK", blockId: block.id })
      return
    }
    if (!block) {
      dispatch({ type: "SELECT_BLOCKS", blockIds: [] })
      dragRef.current = {
        kind: "marquee",
        blockIds: [],
        startX: point.x,
        startY: point.y,
        originals: [],
        moved: false,
      }
      setMarquee({ start: point, end: point })
      return
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      dispatch({ type: "TOGGLE_BLOCK_SELECTION", blockId: block.id })
      return
    }
    const isAlreadySelected = state.selectedBlockIds.includes(block.id)
    const blockIds = isAlreadySelected ? state.selectedBlockIds : [block.id]
    if (!isAlreadySelected) {
      dispatch({ type: "SELECT_BLOCK", blockId: block.id })
    }
    const originals = state.map.blocks.filter((item) => blockIds.includes(item.id))
    dragRef.current = {
      kind: "move",
      blockIds,
      startX: point.x,
      startY: point.y,
      originals,
      moved: false,
    }
    setGroupPreview({ blocks: originals, delta: { x: 0, y: 0 } })
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = toWorldPoint(event)
    if (!point) return
    lastPointerPos.current = point

    if (state.pastePhantom) {
      setPhantomPos(point)
      event.currentTarget.style.cursor = "copy"
      return
    }

    const drag = dragRef.current
    if (!drag) {
      const selected = state.map.blocks.filter((item) => state.selectedBlockIds.includes(item.id))
      const handle = selected.length === 1 ? hitTestTransformHandle(selected[0]!, point) : null
      event.currentTarget.style.cursor =
        selected.length === 1 && isCloneHandle(selected[0]!, point)
          ? "copy"
          : handle?.kind === "rotate"
            ? "grab"
            : handle
              ? "nwse-resize"
              : "default"
      return
    }
    if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > 2) drag.moved = true
    if (drag.kind === "marquee") {
      setMarquee({ start: { x: drag.startX, y: drag.startY }, end: point })
      return
    }
    if (drag.kind === "clone") {
      const source = drag.source
      if (!source) return
      const sequence = createCloneSequence(source, point, state, drag.startX, drag.startY)
      drag.clonePositions = sequence.positions
      drag.limitReached = sequence.limitReached
      setClonePreview(
        sequence.positions.map((position, index) => ({
          ...source,
          id: `preview-${index}`,
          position,
        }))
      )
      return
    }
    const block = drag.originals[0]
    if (!block) return
    const raw = { x: point.x - drag.startX, y: point.y - drag.startY }
    const snapped = state.snapToGrid
      ? {
          x: Math.round(raw.x / state.gridSize) * state.gridSize,
          y: Math.round(raw.y / state.gridSize) * state.gridSize,
        }
      : raw
    if (drag.kind === "move") {
      const delta = clampGroupPreview(drag.originals, snapped)
      setGroupPreview({ blocks: drag.originals, delta })
    } else if (drag.kind === "resize") {
      const handle = drag.handle ?? 2
      const sx = handle === 0 || handle === 3 ? -1 : 1
      const sy = handle === 0 || handle === 1 ? -1 : 1
      let width = clampSize(block.size.width + raw.x * sx * 2)
      let height = clampSize(block.size.height + raw.y * sy * 2)
      if (block.shape === "circle") width = height = clampSize(Math.max(width, height))
      setDragPreview({ block: { ...block, size: { width, height } }, position: block.position })
    } else {
      const from = Math.atan2(drag.startY - block.position.y, drag.startX - block.position.x)
      const to = Math.atan2(point.y - block.position.y, point.x - block.position.x)
      setDragPreview({
        block: { ...block, rotation: (block.rotation ?? 0) + to - from },
        position: block.position,
      })
    }
  }

  const finishDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    setDragPreview(null)
    setGroupPreview(null)
    setMarquee(null)
    setClonePreview([])
    if (!drag) return
    const point = toWorldPoint(event)
    if (!point) return
    if (!drag.moved) {
      if (drag.kind === "move" && drag.blockIds.length > 1) {
        const clicked = hitTest(state.map.blocks, point)
        if (clicked && drag.blockIds.includes(clicked.id)) {
          dispatch({ type: "SELECT_BLOCK", blockId: clicked.id })
        }
      }
      return
    }
    if (drag.kind === "marquee") {
      dispatch({
        type: "SELECT_BLOCKS",
        blockIds: state.map.blocks
          .filter((block) =>
            intersectsBlock(normalizeRect({ x: drag.startX, y: drag.startY }, point), block)
          )
          .map((block) => block.id),
      })
    } else if (drag.kind === "clone") {
      if (drag.clonePositions?.length) {
        dispatch({
          type: "CLONE_SEQUENCE",
          blockId: drag.blockIds[0]!,
          positions: drag.clonePositions,
        })
      }
      if (drag.limitReached) showNotice("Достигнут лимит карты: не более 200 блоков.")
    } else if (drag.kind === "move") {
      const rawDelta = { x: point.x - drag.startX, y: point.y - drag.startY }
      const delta = state.snapToGrid
        ? {
            x: Math.round(rawDelta.x / state.gridSize) * state.gridSize,
            y: Math.round(rawDelta.y / state.gridSize) * state.gridSize,
          }
        : rawDelta
      const clampedDelta = clampGroupPreview(drag.originals, delta)
      dispatch({ type: "MOVE_BLOCKS", blockIds: drag.blockIds, delta: clampedDelta })
    } else {
      const block = drag.originals[0]
      if (!block) return
      if (drag.kind === "resize") {
        const handle = drag.handle ?? 2
        const sx = handle === 0 || handle === 3 ? -1 : 1
        const sy = handle === 0 || handle === 1 ? -1 : 1
        let width = clampSize(block.size.width + (point.x - drag.startX) * sx * 2)
        let height = clampSize(block.size.height + (point.y - drag.startY) * sy * 2)
        if (block.shape === "circle") width = height = clampSize(Math.max(width, height))
        dispatch({ type: "UPDATE_BLOCK", blockId: block.id, updates: { size: { width, height } } })
      } else {
        const from = Math.atan2(drag.startY - block.position.y, drag.startX - block.position.x)
        const to = Math.atan2(point.y - block.position.y, point.x - block.position.x)
        dispatch({
          type: "UPDATE_BLOCK",
          blockId: block.id,
          updates: { rotation: (block.rotation ?? 0) + to - from },
        })
      }
    }
  }

  const onContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    if (state.pastePhantom) {
      dispatch({ type: "CANCEL_PASTE" })
      setPhantomPos(null)
      showNotice("Вставка отменена.")
      return
    }
    const point = toWorldPoint(event)
    const block = point && isInsideWorld(point) ? hitTest(state.map.blocks, point) : undefined
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!bounds) return
    if (block) dispatch({ type: "SELECT_BLOCK", blockId: block.id })
    setContextMenu({
      x: Math.min(event.clientX - bounds.left, bounds.width - 220),
      y: Math.min(event.clientY - bounds.top, bounds.height - 220),
      point: point ?? { x: 0, y: 0 },
      blockId: block?.id ?? null,
    })
  }

  return (
    <div
      className={`relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-line bg-ink ${className}`}
    >
      {canvasNotice && (
        <div
          className="pointer-events-none absolute inset-x-3 top-3 z-10 rounded-lg border border-amber-300/50 bg-amber-950/90 px-3 py-2 text-center text-sm text-amber-100 shadow-lg"
          role="status"
        >
          {canvasNotice}
        </div>
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute z-20 flex min-w-52 flex-col gap-1 rounded-xl border border-cyan-neon/70 bg-deep/95 p-2 text-foam shadow-[0_0_20px_rgba(53,224,255,0.35)] backdrop-blur"
          role="menu"
          style={{ left: Math.max(4, contextMenu.x), top: Math.max(4, contextMenu.y) }}
        >
          {contextMenu.blockId ? (
            <>
              <ContextMenuButton
                onClick={() => {
                  dispatch({ type: "SELECT_BLOCK", blockId: contextMenu.blockId })
                  dispatch({ type: "COPY_SELECTED" })
                  dispatch({ type: "START_PASTE" })
                  showNotice("Фантом следует за курсором. Кликните для размещения.")
                  setContextMenu(null)
                }}
              >
                📋 Дублировать
              </ContextMenuButton>
              <ContextMenuButton
                onClick={() => {
                  const block = state.map.blocks.find((item) => item.id === contextMenu.blockId)
                  if (block)
                    dispatch({
                      type: "UPDATE_BLOCK",
                      blockId: block.id,
                      updates: { rotation: (block.rotation ?? 0) + Math.PI / 2 },
                    })
                  setContextMenu(null)
                }}
              >
                🔄 Повернуть на 90°
              </ContextMenuButton>
              <ContextMenuButton
                onClick={() => {
                  const block = state.map.blocks.find((item) => item.id === contextMenu.blockId)
                  if (block) {
                    const nextShape: Record<PlayerBlockSpec["shape"], PlayerBlockSpec["shape"]> = {
                      circle: "ellipse",
                      ellipse: "rect",
                      rect: "round_rect",
                      round_rect: "circle",
                    }
                    const targetShape = nextShape[block.shape] ?? "ellipse"
                    dispatch({
                      type: "UPDATE_BLOCK",
                      blockId: block.id,
                      updates: { shape: targetShape },
                    })
                  }
                  setContextMenu(null)
                }}
              >
                🔘 Сменить форму (
                {(() => {
                  const current =
                    state.map.blocks.find((item) => item.id === contextMenu.blockId)?.shape ??
                    "circle"
                  const nextShape: Record<PlayerBlockSpec["shape"], string> = {
                    circle: "Эллипс",
                    ellipse: "Прямоугольник",
                    rect: "Скруглённый",
                    round_rect: "Круг",
                  }
                  return `→ ${nextShape[current] ?? "Эллипс"}`
                })()}
                )
              </ContextMenuButton>
              <ContextMenuButton
                danger
                onClick={() => {
                  dispatch({ type: "DELETE_BLOCK", blockId: contextMenu.blockId! })
                  setContextMenu(null)
                }}
              >
                🗑️ Удалить блок
              </ContextMenuButton>
            </>
          ) : (
            <>
              <ContextMenuButton
                onClick={() => {
                  dispatch({ type: "ADD_BLOCK", position: contextMenu.point })
                  setContextMenu(null)
                }}
              >
                ➕ Добавить блок здесь
              </ContextMenuButton>
              {state.clipboard.length > 0 && (
                <ContextMenuButton
                  onClick={() => {
                    dispatch({ type: "START_PASTE" })
                    showNotice("Фантом следует за курсором. Кликните для размещения.")
                    setContextMenu(null)
                  }}
                >
                  📋 Вставить из буфера
                </ContextMenuButton>
              )}
              <ContextMenuButton
                onClick={() => {
                  dispatch({ type: "SELECT_BLOCKS", blockIds: [] })
                  setContextMenu(null)
                }}
              >
                🧹 Снять выделение
              </ContextMenuButton>
            </>
          )}
          <ContextMenuButton onClick={() => setContextMenu(null)}>✖ Закрыть</ContextMenuButton>
        </div>
      )}
      <canvas
        ref={canvasRef}
        aria-label="Холст редактора карт"
        className="block h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onContextMenu={onContextMenu}
      />
      <span className="pointer-events-none absolute bottom-2 right-3 rounded bg-ink/80 px-2 py-1 font-mono text-xs text-dim">
        1920 × 1080
      </span>
    </div>
  )
}

function drawWorld(
  context: CanvasRenderingContext2D,
  state: EditorState,
  draggedBlockIds: ReadonlySet<string>
) {
  context.fillStyle = "#0b1b24"
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  drawGrid(context, state.gridSize, state.snapToGrid)

  context.fillStyle = "rgba(2, 9, 15, 0.72)"
  context.fillRect(0, 0, WORLD_WIDTH, HUD_BOTTOM)
  context.save()
  context.setLineDash([12, 10])
  context.strokeStyle = "#42e8ff"
  context.lineWidth = 3
  context.beginPath()
  context.moveTo(0, HUD_BOTTOM)
  context.lineTo(WORLD_WIDTH, HUD_BOTTOM)
  context.stroke()
  context.restore()
  context.fillStyle = "rgba(125, 232, 255, 0.68)"
  context.font = "bold 20px sans-serif"
  context.fillText("HUD / НЕИГРОВАЯ ЗОНА", 28, 44)

  for (const block of state.map.blocks) {
    if (draggedBlockIds.has(block.id)) continue
    drawBlock(context, block, state.selectedBlockIds.includes(block.id))
  }
  drawPaddleZone(context)
}

function drawGrid(context: CanvasRenderingContext2D, gridSize: number, snapToGrid: boolean) {
  if (!Number.isFinite(gridSize) || gridSize <= 0) return
  context.save()
  context.strokeStyle = snapToGrid ? "rgba(92, 218, 247, 0.13)" : "rgba(190, 220, 230, 0.08)"
  context.lineWidth = 1
  context.beginPath()
  for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
    context.moveTo(x, 0)
    context.lineTo(x, WORLD_HEIGHT)
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
    context.moveTo(0, y)
    context.lineTo(WORLD_WIDTH, y)
  }
  context.stroke()
  if (snapToGrid) {
    context.fillStyle = "rgba(86, 231, 255, 0.36)"
    for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
      for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
        context.fillRect(x - 1.5, y - 1.5, 3, 3)
      }
    }
  }
  context.restore()
}

function drawPaddleZone(context: CanvasRenderingContext2D) {
  context.fillStyle = "rgba(255, 83, 71, 0.16)"
  context.fillRect(0, PADDLE_ZONE_TOP, WORLD_WIDTH, WORLD_HEIGHT - PADDLE_ZONE_TOP)
  context.save()
  context.setLineDash([12, 10])
  context.strokeStyle = "#ff6a5c"
  context.lineWidth = 4
  context.beginPath()
  context.moveTo(0, PADDLE_ZONE_TOP)
  context.lineTo(WORLD_WIDTH, PADDLE_ZONE_TOP)
  context.stroke()
  context.setLineDash([])
  context.fillStyle = "#ffd9d4"
  context.font = "bold 24px sans-serif"
  context.fillText("ЗОНА РАКЕТКИ / НЕЛЬЗЯ СТАВИТЬ БЛОКИ", 28, PADDLE_ZONE_TOP + 44)
  context.restore()
}

function drawTransformHandles(context: CanvasRenderingContext2D, block: PlayerBlockSpec) {
  const halfW = block.size.width / 2
  const halfH = block.size.height / 2
  const corners = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ] as const
  context.save()
  context.translate(block.position.x, block.position.y)
  context.rotate(block.rotation ?? 0)
  context.strokeStyle = "#eaf7ff"
  context.fillStyle = "#35e0ff"
  context.lineWidth = 2
  for (const [x, y] of corners) {
    context.fillRect(x - 7, y - 7, 14, 14)
    context.strokeRect(x - 7, y - 7, 14, 14)
  }
  const cloneOffset = 18 / Math.SQRT2
  context.beginPath()
  context.arc(halfW + cloneOffset, halfH + cloneOffset, 10, 0, Math.PI * 2)
  context.fillStyle = "#42ffb0"
  context.fill()
  context.strokeStyle = "#05241c"
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = "#05241c"
  context.font = "bold 16px sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText("+", halfW + cloneOffset, halfH + cloneOffset)
  context.beginPath()
  context.moveTo(0, -halfH)
  context.lineTo(0, -halfH - 28)
  context.stroke()
  context.beginPath()
  context.arc(0, -halfH - 34, 8, 0, Math.PI * 2)
  context.fillStyle = "#ffc94d"
  context.fill()
  context.stroke()
  context.fillStyle = "#fff3d1"
  context.font = "bold 18px sans-serif"
  context.textAlign = "center"
  context.fillText("↻", 0, -halfH - 29)
  context.restore()
}

function drawMarquee(
  context: CanvasRenderingContext2D,
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const rect = normalizeRect(start, end)
  context.save()
  context.fillStyle = "rgba(53,224,255,0.12)"
  context.strokeStyle = "#35e0ff"
  context.lineWidth = 2
  context.setLineDash([8, 5])
  context.fillRect(rect.x, rect.y, rect.width, rect.height)
  context.strokeRect(rect.x, rect.y, rect.width, rect.height)
  context.restore()
}

function hitTestTransformHandle(
  block: PlayerBlockSpec,
  point: { x: number; y: number }
): { kind: "resize" | "rotate"; index: number } | null {
  const corners = blockCorners(block)
  for (const [index, corner] of corners.entries()) {
    if (Math.hypot(point.x - corner.x, point.y - corner.y) <= 14) return { kind: "resize", index }
  }
  const center = { x: block.position.x, y: block.position.y }
  const angle = block.rotation ?? 0
  const rotatePoint = {
    x: center.x + (block.size.height / 2 + 34) * Math.sin(angle),
    y: center.y - (block.size.height / 2 + 34) * Math.cos(angle),
  }
  return Math.hypot(point.x - rotatePoint.x, point.y - rotatePoint.y) <= 16
    ? { kind: "rotate", index: -1 }
    : null
}

function isCloneHandle(block: PlayerBlockSpec, point: { x: number; y: number }) {
  const angle = block.rotation ?? 0
  const localX =
    (point.x - block.position.x) * Math.cos(angle) + (point.y - block.position.y) * Math.sin(angle)
  const localY =
    -(point.x - block.position.x) * Math.sin(angle) + (point.y - block.position.y) * Math.cos(angle)
  const offset = 18 / Math.SQRT2
  return (
    Math.hypot(
      localX - (block.size.width / 2 + offset),
      localY - (block.size.height / 2 + offset)
    ) <= 13
  )
}

function blockCorners(block: PlayerBlockSpec) {
  const halfW = block.size.width / 2
  const halfH = block.size.height / 2
  const angle = block.rotation ?? 0
  return [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ].map(([x, y]) => ({
    x: block.position.x + x! * Math.cos(angle) - y! * Math.sin(angle),
    y: block.position.y + x! * Math.sin(angle) + y! * Math.cos(angle),
  }))
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

function intersectsBlock(rect: ReturnType<typeof normalizeRect>, block: PlayerBlockSpec) {
  const corners = blockCorners(block)
  const left = Math.min(...corners.map((corner) => corner.x))
  const right = Math.max(...corners.map((corner) => corner.x))
  const top = Math.min(...corners.map((corner) => corner.y))
  const bottom = Math.max(...corners.map((corner) => corner.y))
  return (
    left <= rect.x + rect.width &&
    right >= rect.x &&
    top <= rect.y + rect.height &&
    bottom >= rect.y
  )
}

function clampGroupPreview(blocks: PlayerBlockSpec[], delta: { x: number; y: number }) {
  const minX = Math.max(...blocks.map((block) => block.size.width / 2 - block.position.x))
  const maxX = Math.min(
    ...blocks.map((block) => WORLD_WIDTH - block.size.width / 2 - block.position.x)
  )
  const minY = Math.max(
    ...blocks.map((block) => HUD_BOTTOM + block.size.height / 2 - block.position.y)
  )
  const maxY = Math.min(
    ...blocks.map((block) => PADDLE_ZONE_TOP - block.size.height / 2 - block.position.y)
  )
  return { x: Math.max(minX, Math.min(maxX, delta.x)), y: Math.max(minY, Math.min(maxY, delta.y)) }
}

function clampSize(value: number) {
  return Math.max(20, Math.min(100, value))
}

const MAX_BLOCKS = 200

function createCloneSequence(
  source: PlayerBlockSpec,
  point: { x: number; y: number },
  state: EditorState,
  startX: number,
  startY: number
) {
  const dx = point.x - startX
  const dy = point.y - startY
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  const rawDistance = horizontal ? dx : dy
  const stepSize = Math.max(state.gridSize, horizontal ? source.size.width : source.size.height)
  const steps = Math.floor(Math.abs(rawDistance) / stepSize)
  const freeSlots = Math.max(0, MAX_BLOCKS - state.map.blocks.length)
  const positions: { x: number; y: number }[] = []
  for (let step = 1; step <= Math.min(steps, freeSlots); step += 1) {
    const position = {
      x: source.position.x + (horizontal ? Math.sign(rawDistance) * step * stepSize : 0),
      y: source.position.y + (!horizontal ? Math.sign(rawDistance) * step * stepSize : 0),
    }
    const halfW = source.size.width / 2
    const halfH = source.size.height / 2
    if (position.x - halfW < 0 || position.x + halfW > WORLD_WIDTH) continue
    if (position.y - halfH < HUD_BOTTOM || position.y + halfH > PADDLE_ZONE_TOP) continue
    positions.push(position)
  }
  return { positions, limitReached: steps > freeSlots }
}

function drawBlock(
  context: CanvasRenderingContext2D,
  block: PlayerBlockSpec,
  selected: boolean,
  alpha = 1
) {
  const tier = TIER[Math.min(3, Math.max(1, Math.round(block.hp))) as 1 | 2 | 3]
  context.save()
  context.globalAlpha *= alpha
  context.translate(block.position.x, block.position.y)
  context.rotate(block.rotation ?? 0)
  const rx = block.size.width / 2
  const ry = block.size.height / 2
  context.beginPath()
  if (block.shape === "circle") {
    context.arc(0, 0, Math.min(rx, ry), 0, Math.PI * 2)
  } else if (block.shape === "rect") {
    context.rect(-rx, -ry, rx * 2, ry * 2)
  } else if (block.shape === "round_rect") {
    const cr = Math.min(12, rx * 0.5, ry * 0.5)
    if (typeof context.roundRect === "function") {
      context.roundRect(-rx, -ry, rx * 2, ry * 2, cr)
    } else {
      context.rect(-rx, -ry, rx * 2, ry * 2)
    }
  } else {
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
  }
  context.fillStyle = tier.base
  context.shadowColor = selected ? "#52f5ff" : "transparent"
  context.shadowBlur = selected ? 24 : 0
  context.fill()
  context.shadowBlur = 0
  context.strokeStyle = selected ? "#c4ffff" : tier.light
  context.lineWidth = selected ? 5 : 2
  context.stroke()

  drawSpecialEffectVisuals(context, block.effects ?? [], rx, ry)
  drawArmorRings(context, block.effects ?? [], rx, ry, tier.base)

  context.fillStyle = "rgba(4, 18, 26, 0.78)"
  context.font = `bold ${Math.max(18, Math.min(32, ry * 0.8))}px sans-serif`
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.save()
  context.rotate(-(block.rotation ?? 0))
  context.fillText(String(block.hp), 0, 0)
  context.restore()
  drawEffectMarks(context, block.effects ?? [], rx, ry)
  context.restore()

  if (selected) {
    context.save()
    context.translate(block.position.x, block.position.y)
    context.rotate(block.rotation ?? 0)
    context.strokeStyle = "rgba(196, 255, 255, 0.7)"
    context.setLineDash([8, 6])
    context.lineWidth = 2
    context.strokeRect(-rx - 9, -ry - 9, rx * 2 + 18, ry * 2 + 18)
    context.restore()
  }
}

function drawSpecialEffectVisuals(
  context: CanvasRenderingContext2D,
  effects: PlayerBlockEffect[],
  rx: number,
  ry: number
) {
  const kinds = new Set(effects.map((effect) => effect.kind))
  if (kinds.has("portal")) {
    const gradient = context.createRadialGradient(-rx * 0.25, -ry * 0.3, 2, 0, 0, Math.max(rx, ry))
    gradient.addColorStop(0, "#2a1244")
    gradient.addColorStop(1, "#0b0518")
    context.fillStyle = gradient
    context.beginPath()
    context.ellipse(0, 0, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = "rgba(176,108,255,0.85)"
    context.lineWidth = Math.max(2, Math.min(rx, ry) * 0.08)
    for (let i = 0; i < 3; i += 1) {
      context.beginPath()
      context.ellipse(
        0,
        0,
        rx * (0.45 + i * 0.16),
        ry * (0.35 + i * 0.16),
        i * 0.45,
        0.2,
        Math.PI * 1.55
      )
      context.stroke()
    }
  }
  if (kinds.has("spring")) {
    context.fillStyle = "rgba(255,201,77,0.9)"
    context.beginPath()
    context.ellipse(0, 0, rx * 0.88, ry * 0.8, 0, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = "rgba(92,55,0,0.85)"
    context.lineWidth = Math.max(2, Math.min(rx, ry) * 0.06)
    for (let i = -1; i <= 1; i += 1) {
      context.beginPath()
      context.moveTo(i * rx * 0.35 - rx * 0.12, -ry * 0.55)
      context.quadraticCurveTo(i * rx * 0.35 + rx * 0.2, 0, i * rx * 0.35 - rx * 0.12, ry * 0.55)
      context.stroke()
    }
  }
  if (kinds.has("cotton")) {
    context.fillStyle = "rgba(246,243,255,0.95)"
    context.beginPath()
    context.ellipse(0, 0, rx * 0.9, ry * 0.78, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = "rgba(255,255,255,0.55)"
    context.beginPath()
    context.ellipse(-rx * 0.25, -ry * 0.32, rx * 0.32, ry * 0.1, -0.18, 0, Math.PI * 2)
    context.fill()
    context.beginPath()
    context.ellipse(rx * 0.28, ry * 0.25, rx * 0.24, ry * 0.08, 0.2, 0, Math.PI * 2)
    context.fill()
  }
  if (kinds.has("brittle")) {
    context.strokeStyle = "rgba(255, 107, 74, 0.85)"
    context.lineWidth = Math.max(1.8, Math.min(rx, ry) * 0.08)
    context.beginPath()
    context.moveTo(-rx * 0.45, -ry * 0.35)
    context.lineTo(-rx * 0.1, -ry * 0.05)
    context.lineTo(rx * 0.4, -ry * 0.4)
    context.moveTo(-rx * 0.1, -ry * 0.05)
    context.lineTo(rx * 0.15, ry * 0.35)
    context.lineTo(rx * 0.45, ry * 0.2)
    context.stroke()
  }
  if (kinds.has("phase")) {
    context.strokeStyle = "rgba(168, 226, 255, 0.85)"
    context.lineWidth = Math.max(1.5, Math.min(rx, ry) * 0.06)
    context.setLineDash([4, 4])
    context.beginPath()
    context.ellipse(0, 0, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2)
    context.stroke()
    context.setLineDash([])
  }
  const magnet = effects.find((effect) => effect.kind === "magnet")
  if (magnet?.kind === "magnet") {
    const repel = magnet.mode === "repel" || (magnet.force ?? 0) < 0
    const north = repel ? "#36e6dc" : "#ff536b"
    const south = repel ? "#4d9dff" : "#66c7ff"
    const halfWidth = rx * 0.42
    const top = -ry * 0.45
    const bottom = ry * 0.35
    context.lineCap = "round"
    context.lineWidth = Math.max(2, Math.min(rx, ry) * 0.13)
    context.strokeStyle = "#172536"
    context.beginPath()
    context.moveTo(-halfWidth, top)
    context.lineTo(-halfWidth, bottom)
    context.quadraticCurveTo(0, ry * 0.85, halfWidth, bottom)
    context.lineTo(halfWidth, top)
    context.stroke()
    context.lineWidth = Math.max(3, Math.min(rx, ry) * 0.19)
    context.strokeStyle = north
    context.beginPath()
    context.moveTo(-halfWidth, top)
    context.lineTo(-halfWidth, -ry * 0.12)
    context.stroke()
    context.strokeStyle = south
    context.beginPath()
    context.moveTo(halfWidth, top)
    context.lineTo(halfWidth, -ry * 0.12)
    context.stroke()
  }
  if (kinds.has("pulse")) {
    context.strokeStyle = "#7cf5ff"
    context.lineWidth = Math.max(1.5, Math.min(rx, ry) * 0.05)
    for (let i = 1; i <= 2; i += 1) {
      context.beginPath()
      context.ellipse(0, 0, rx * (0.3 + i * 0.22), ry * (0.3 + i * 0.22), 0, 0, Math.PI * 2)
      context.stroke()
    }
  }
  if (kinds.has("spin")) {
    context.strokeStyle = "#e8fbff"
    context.lineWidth = Math.max(2, Math.min(rx, ry) * 0.06)
    context.beginPath()
    context.arc(0, 0, Math.min(rx, ry) * 0.42, -0.4, Math.PI * 1.4)
    context.stroke()
    context.beginPath()
    context.moveTo(rx * 0.35, -ry * 0.25)
    context.lineTo(rx * 0.52, -ry * 0.32)
    context.lineTo(rx * 0.45, -ry * 0.08)
    context.stroke()
  }
}

function drawArmorRings(
  context: CanvasRenderingContext2D,
  effects: PlayerBlockEffect[],
  rx: number,
  ry: number,
  tierColor: string
) {
  const armor = effects.find((effect) => effect.kind === "armor")
  if (!armor || armor.amount <= 0) return

  const amount = Math.floor(armor.amount)
  const ringGap = Math.max(3.5, Math.min(rx, ry) * 0.1)
  for (let i = 0; i < amount; i += 1) {
    const offset = ringGap * (amount - i)
    const ringRx = rx + offset
    const ringRy = ry + offset
    context.lineWidth = Math.max(3, Math.min(rx, ry) * 0.14)
    context.strokeStyle = "#080808"
    context.beginPath()
    context.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2)
    context.stroke()
    if (i + 1 >= amount) continue
    context.strokeStyle = tierColor
    context.lineWidth = Math.max(1.2, Math.min(rx, ry) * 0.04)
    context.beginPath()
    context.ellipse(0, 0, ringRx - ringGap / 2, ringRy - ringGap / 2, 0, 0, Math.PI * 2)
    context.stroke()
  }
}

function drawEffectMarks(
  context: CanvasRenderingContext2D,
  effects: PlayerBlockEffect[],
  rx: number,
  ry: number
) {
  const marks = effects.map(effectMark).filter((mark): mark is string => mark !== null)
  if (marks.length === 0) return
  context.font = "bold 18px sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillStyle = "#ffffff"
  marks.forEach((mark, index) => {
    context.fillText(mark, -rx + 8 + index * 20, -ry - 12)
  })
}

function effectMark(effect: PlayerBlockEffect): string | null {
  switch (effect.kind) {
    case "armor":
      return `◆${effect.amount}`
    case "brittle":
      return "💥"
    case "phase":
      return "👻"
    case "spring":
      return "↟"
    case "cotton":
      return "☁"
    case "magnet":
      return effect.mode === "repel" || (effect.force ?? 0) < 0 ? "⊃−" : "⊃+"
    case "portal":
      return "◉"
    case "pulse":
      return "◎"
    case "spin":
      return "↻"
    case "normal":
      return null
  }
}

function hitTest(
  blocks: PlayerBlockSpec[],
  point: { x: number; y: number }
): PlayerBlockSpec | undefined {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index]
    if (!block) continue
    const dx = point.x - block.position.x
    const dy = point.y - block.position.y
    const rotation = -(block.rotation ?? 0)
    const localX = dx * Math.cos(rotation) - dy * Math.sin(rotation)
    const localY = dx * Math.sin(rotation) + dy * Math.cos(rotation)
    const rx = block.size.width / 2
    const ry = block.size.height / 2
    if (rx > 0 && ry > 0) {
      if (block.shape === "rect") {
        if (Math.abs(localX) <= rx && Math.abs(localY) <= ry) return block
      } else if (block.shape === "round_rect") {
        const cr = Math.min(12, rx * 0.5, ry * 0.5)
        const hx = Math.max(0, rx - cr)
        const hy = Math.max(0, ry - cr)
        const cx = Math.max(-hx, Math.min(hx, localX))
        const cy = Math.max(-hy, Math.min(hy, localY))
        const cdx = localX - cx
        const cdy = localY - cy
        if (cdx * cdx + cdy * cdy <= cr * cr) return block
      } else if ((localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1) {
        return block
      }
    }
  }
  return undefined
}

function isInsideWorld(point: { x: number; y: number }) {
  return point.x >= 0 && point.x <= WORLD_WIDTH && point.y >= 0 && point.y <= WORLD_HEIGHT
}

function getBlocksBoundingCenter(blocks: PlayerBlockSpec[]): { x: number; y: number } {
  if (blocks.length === 0) return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const b of blocks) {
    minX = Math.min(minX, b.position.x)
    maxX = Math.max(maxX, b.position.x)
    minY = Math.min(minY, b.position.y)
    maxY = Math.max(maxY, b.position.y)
  }
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  }
}

function drawPhantomGroup(context: CanvasRenderingContext2D, blocks: PlayerBlockSpec[]) {
  if (blocks.length === 0) return
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const b of blocks) {
    const hw = b.size.width / 2
    const hh = b.size.height / 2
    minX = Math.min(minX, b.position.x - hw)
    maxX = Math.max(maxX, b.position.x + hw)
    minY = Math.min(minY, b.position.y - hh)
    maxY = Math.max(maxY, b.position.y + hh)
  }
  const padding = 12
  const rect = {
    x: minX - padding,
    y: minY - padding,
    w: maxX - minX + padding * 2,
    h: maxY - minY + padding * 2,
  }

  context.save()
  context.strokeStyle = "#35e0ff"
  context.lineWidth = 2
  context.setLineDash([8, 6])
  context.strokeRect(rect.x, rect.y, rect.w, rect.h)

  // Soft cyan glow
  context.shadowColor = "#35e0ff"
  context.shadowBlur = 14
  context.strokeStyle = "rgba(53, 224, 255, 0.45)"
  context.strokeRect(rect.x, rect.y, rect.w, rect.h)

  // Floating guide badge
  context.shadowBlur = 0
  context.setLineDash([])
  const pillText = `ФАНТОМ (${blocks.length}): клик — закрепить • Esc — отмена`
  context.font = "bold 14px sans-serif"
  const textWidth = context.measureText(pillText).width
  const pillW = textWidth + 24
  const pillH = 28
  const pillX = rect.x + (rect.w - pillW) / 2
  const pillY = Math.max(HUD_BOTTOM + 8, rect.y - pillH - 8)

  context.fillStyle = "rgba(7, 19, 27, 0.94)"
  context.beginPath()
  if (typeof context.roundRect === "function") {
    context.roundRect(pillX, pillY, pillW, pillH, 6)
  } else {
    context.rect(pillX, pillY, pillW, pillH)
  }
  context.fill()
  context.strokeStyle = "#35e0ff"
  context.lineWidth = 1.5
  context.stroke()

  context.fillStyle = "#35e0ff"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(pillText, pillX + pillW / 2, pillY + pillH / 2)
  context.restore()
}
