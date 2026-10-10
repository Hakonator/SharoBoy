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
    drawWorld(context, state)
    if (dragPreview) {
      drawBlock(context, dragPreview.block, false, 0.22)
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
    if (selected.length === 1) drawTransformHandles(context, selected[0]!)
    for (const block of clonePreview) drawBlock(context, block, false, 0.42)
    if (marquee) drawMarquee(context, marquee.start, marquee.end)
    context.restore()
  }, [clonePreview, dragPreview, groupPreview, marquee, size, state])

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
    const blockIds = state.selectedBlockIds.includes(block.id) ? state.selectedBlockIds : [block.id]
    if (blockIds.length !== state.selectedBlockIds.length)
      dispatch({ type: "SELECT_BLOCK", blockId: block.id })
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
    const drag = dragRef.current
    const point = toWorldPoint(event)
    if (!point) return
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
    if (!drag || !drag.moved) return
    const point = toWorldPoint(event)
    if (!point) return
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
      dispatch({ type: "MOVE_BLOCKS", blockIds: drag.blockIds, delta })
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
                  dispatch({ type: "PASTE_CLIPBOARD" })
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
                  if (block)
                    dispatch({
                      type: "UPDATE_BLOCK",
                      blockId: block.id,
                      updates: { shape: block.shape === "circle" ? "ellipse" : "circle" },
                    })
                  setContextMenu(null)
                }}
              >
                🔘 Сменить форму (
                {state.map.blocks.find((item) => item.id === contextMenu.blockId)?.shape ===
                "circle"
                  ? "Эллипс"
                  : "Круг"}
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
                    dispatch({ type: "PASTE_CLIPBOARD" })
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

function drawWorld(context: CanvasRenderingContext2D, state: EditorState) {
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

  context.fillStyle = "rgba(4, 18, 26, 0.78)"
  context.font = `bold ${Math.max(18, Math.min(32, ry * 0.8))}px sans-serif`
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(String(block.hp), 0, 0)
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
    if (rx > 0 && ry > 0 && (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1) {
      return block
    }
  }
  return undefined
}

function isInsideWorld(point: { x: number; y: number }) {
  return point.x >= 0 && point.x <= WORLD_WIDTH && point.y >= 0 && point.y <= WORLD_HEIGHT
}
