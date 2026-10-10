import { useCallback, useEffect, useRef, useState } from "react"

import { TIER } from "../../game/palette"
import type { PlayerBlockEffect, PlayerBlockSpec } from "../../game/mapSpec"

import type { EditorCanvasProps, EditorState } from "./types"

const WORLD_WIDTH = 1920
const WORLD_HEIGHT = 1080
const HUD_BOTTOM = 140

interface DragState {
  blockId: string
  startX: number
  startY: number
  originalX: number
  originalY: number
  moved: boolean
}

export function EditorCanvas({ state, dispatch, className = "" }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)
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
    context.restore()
  }, [size, state])

  const toWorldPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
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
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    const point = toWorldPoint(event)
    if (!point || !isInsideWorld(point)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const block = hitTest(state.map.blocks, point)

    if (state.activeTool === "add") {
      dispatch({ type: "ADD_BLOCK", position: point })
      return
    }
    if (state.activeTool === "delete") {
      if (block) dispatch({ type: "DELETE_BLOCK", blockId: block.id })
      return
    }
    dispatch({ type: "SELECT_BLOCK", blockId: block?.id ?? null })
    if (block) {
      dragRef.current = {
        blockId: block.id,
        startX: point.x,
        startY: point.y,
        originalX: block.position.x,
        originalY: block.position.y,
        moved: false,
      }
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    const point = toWorldPoint(event)
    if (!drag || !point) return
    if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > 2) drag.moved = true
  }

  const finishDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !drag.moved) return
    const point = toWorldPoint(event)
    if (!point || !isInsideWorld(point)) return
    dispatch({
      type: "MOVE_BLOCK",
      blockId: drag.blockId,
      position: {
        x: drag.originalX + point.x - drag.startX,
        y: drag.originalY + point.y - drag.startY,
      },
    })
  }

  return (
    <div
      className={`relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-line bg-ink ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-label="Холст редактора карт"
        className="block h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
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
    drawBlock(context, block, block.id === state.selectedBlockId)
  }
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

function drawBlock(context: CanvasRenderingContext2D, block: PlayerBlockSpec, selected: boolean) {
  const tier = TIER[Math.min(3, Math.max(1, Math.round(block.hp))) as 1 | 2 | 3]
  context.save()
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
