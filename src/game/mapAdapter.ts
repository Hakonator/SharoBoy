import type { PlayerBlockEffect, PlayerBlockSpec, PlayerMapSpec } from "./mapSpec"
import type { Block } from "./types"
import { BLOCK_MAGNET_FORCE, BLOCK_MAGNET_RADIUS_MULT } from "./blockKinds"

/** Converts an already-validated authoring map into fresh runtime blocks. */
export function mapSpecToBlocks(spec: PlayerMapSpec): Block[] {
  const portalIds = makePortalIds(spec.blocks)
  return spec.blocks.map((block) => adaptBlock(block, portalIds))
}

function adaptBlock(block: PlayerBlockSpec, portalIds: ReadonlyMap<string, number>): Block {
  const rx = block.size.width / 2
  const ry = block.size.height / 2
  const hpTier = Math.max(1, Math.min(3, Math.round(block.hp))) as 1 | 2 | 3
  const runtime: Block = {
    x: block.position.x,
    y: block.position.y,
    rx,
    ry,
    rot: block.rotation ?? 0,
    circle: block.shape === "circle",
    hp: block.hp,
    maxHp: block.hp,
    tier: hpTier,
    flash: 0,
    seed: stableHash(block.id) / 0x1_0000_0000,
    dead: false,
    x0: block.position.x,
    swayAmp: 0,
    swayFreq: 0,
    swayPh: 0,
    bomb: false,
    splits: false,
  }

  for (const effect of block.effects ?? []) {
    applyEffect(runtime, effect, portalIds)
  }

  if (block.motion) {
    const motion = block.motion
    const amp = motion.path === "circle" ? motion.radius : motion.amplitude
    runtime.sp = {
      ...runtime.sp,
      drift: {
        kind: motion.path === "horizontal" ? "h" : motion.path === "vertical" ? "v" : "circle",
        amp,
        freq: motion.frequency,
        ph: motion.phase ?? 0,
      },
    }
    if (motion.path !== "horizontal") runtime.y0 = block.position.y
  }

  return runtime
}

function applyEffect(
  block: Block,
  effect: PlayerBlockEffect,
  portalIds: ReadonlyMap<string, number>
): void {
  switch (effect.kind) {
    case "normal":
      break
    case "armor":
      block.sp = { ...block.sp, armor: effect.amount, armorMax: effect.amount }
      break
    case "magnet":
      block.sp = {
        ...block.sp,
        magnet: {
          radius: effect.radius ?? Math.max(block.rx, block.ry) * BLOCK_MAGNET_RADIUS_MULT,
          force: effect.force ?? BLOCK_MAGNET_FORCE,
          ...(effect.mode ? { mode: effect.mode } : {}),
        },
      }
      break
    case "pulse":
      block.sp = {
        ...block.sp,
        // AD-003: runtime uses its fixed PULSE_AMPLITUDE; only freq and phase are mapped.
        pulse: { freq: effect.frequency, ph: effect.phase ?? 0, rx0: block.rx, ry0: block.ry },
      }
      break
    case "spring":
      // AD-003: runtime owns fixed speed and duration values.
      block.sp = { ...block.sp, spring: true }
      break
    case "cotton":
      // AD-003: runtime owns fixed speed and duration values.
      block.sp = { ...block.sp, cotton: true }
      break
    case "spin":
      block.sp = {
        ...block.sp,
        rotVel: 0,
        rotDir: effect.direction === "counterclockwise" ? -1 : 1,
      }
      break
    case "portal": {
      const portalId = portalIds.get(effect.pairId)
      if (portalId !== undefined) block.sp = { ...block.sp, portalId }
      break
    }
  }
}

function makePortalIds(blocks: readonly PlayerBlockSpec[]): Map<string, number> {
  const ids = new Map<string, number>()
  const used = new Set<number>()
  for (const block of blocks) {
    for (const effect of block.effects ?? []) {
      if (effect.kind !== "portal" || ids.has(effect.pairId)) continue
      let id = stableHash(effect.pairId) & 0x7fff_ffff
      while (used.has(id)) id = (id + 1) & 0x7fff_ffff
      ids.set(effect.pairId, id)
      used.add(id)
    }
  }
  return ids
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }
  return hash >>> 0
}
