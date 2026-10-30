import type { PlayerBlockSpec } from "../../game/mapSpec"

export const WORLD_WIDTH = 1920
export const WORLD_HEIGHT = 1080
export const HUD_ZONE_BOTTOM = 140

export function blockCorners(block: PlayerBlockSpec): { x: number; y: number }[] {
  const halfW = block.size.width / 2
  const halfH = block.size.height / 2
  const angle = block.rotation ?? 0
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ].map(([x, y]) => ({
    x: block.position.x + x * cos - y * sin,
    y: block.position.y + x * sin + y * cos,
  }))
}

export interface BoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
}

export function getBlocksBoundingBox(blocks: PlayerBlockSpec[]): BoundingBox {
  if (blocks.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 }
  }
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const b of blocks) {
    const corners = blockCorners(b)
    for (const c of corners) {
      minX = Math.min(minX, c.x)
      maxX = Math.max(maxX, c.x)
      minY = Math.min(minY, c.y)
      maxY = Math.max(maxY, c.y)
    }
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(20, maxX - minX),
    height: Math.max(20, maxY - minY),
  }
}

export function getBlocksBoundingCenter(blocks: PlayerBlockSpec[]): { x: number; y: number } {
  if (blocks.length === 0) return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }
  const bbox = getBlocksBoundingBox(blocks)
  return {
    x: bbox.minX + bbox.width / 2,
    y: bbox.minY + bbox.height / 2,
  }
}

export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

export function intersectsBlock(
  rect: { x: number; y: number; width: number; height: number },
  block: PlayerBlockSpec
): boolean {
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

/**
 * Checks if two blocks are touching or close neighbors within a given tolerance.
 */
export function areBlocksTouching(a: PlayerBlockSpec, b: PlayerBlockSpec, tolerance = 8): boolean {
  const boxA = getBlocksBoundingBox([a])
  const boxB = getBlocksBoundingBox([b])
  return (
    boxA.minX - tolerance <= boxB.maxX &&
    boxA.maxX + tolerance >= boxB.minX &&
    boxA.minY - tolerance <= boxB.maxY &&
    boxA.maxY + tolerance >= boxB.minY
  )
}
