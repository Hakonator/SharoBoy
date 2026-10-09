import type { BlockGroupSpec, PlayerBlockEffect, PlayerBlockSpec, PlayerMapSpec } from "./mapSpec"

export type MapValidationErrorCode =
  | "BLOCK_LIMIT"
  | "DUPLICATE_BLOCK_ID"
  | "DUPLICATE_GROUP_ID"
  | "DUPLICATE_GROUP_MEMBERSHIP"
  | "UNKNOWN_GROUP"
  | "UNKNOWN_BLOCK"
  | "INVALID_PORTAL_PAIR"
  | "INVALID_NUMBER"
  | "OUT_OF_RANGE"
  | "OUT_OF_BOUNDS"

export interface MapValidationError {
  path: string
  code: MapValidationErrorCode
  message: string
}

const MAP_WIDTH = 1920
const MAP_HEIGHT = 1080
const MAX_BLOCKS = 200

interface NumericRange {
  min: number
  max: number
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

/** Pure validation of the declarative map contract. */
export function validatePlayerMapSpec(spec: PlayerMapSpec): MapValidationError[] {
  const errors: MapValidationError[] = []
  const blockById = new Map<string, PlayerBlockSpec>()
  const groupById = new Map<string, BlockGroupSpec>()
  const portalIdsByPair = new Map<string, string[]>()

  const addError = (path: string, code: MapValidationErrorCode, message: string) => {
    errors.push({ path, code, message })
  }

  const checkNumber = (value: number, path: string, range?: NumericRange) => {
    if (!isFiniteNumber(value)) {
      addError(path, "INVALID_NUMBER", "Значение должно быть конечным числом.")
      return
    }
    if (range && (value < range.min || value > range.max)) {
      addError(path, "OUT_OF_RANGE", `Значение должно быть от ${range.min} до ${range.max}.`)
    }
  }

  if (spec.blocks.length > MAX_BLOCKS) {
    addError("blocks", "BLOCK_LIMIT", `Карта может содержать не более ${MAX_BLOCKS} блоков.`)
  }

  for (const [index, block] of spec.blocks.entries()) {
    const path = `blocks[${index}]`
    if (blockById.has(block.id)) {
      addError(`${path}.id`, "DUPLICATE_BLOCK_ID", `ID блока "${block.id}" уже используется.`)
    } else {
      blockById.set(block.id, block)
    }

    checkNumber(block.hp, `${path}.hp`, { min: 1, max: 8 })
    if (Number.isFinite(block.hp) && !Number.isInteger(block.hp)) {
      addError(`${path}.hp`, "OUT_OF_RANGE", "HP должно быть целым числом.")
    }
    checkNumber(block.size.width, `${path}.size.width`, { min: 20, max: 100 })
    checkNumber(block.size.height, `${path}.size.height`, { min: 20, max: 100 })
    checkNumber(block.position.x, `${path}.position.x`)
    checkNumber(block.position.y, `${path}.position.y`)
    if (block.rotation !== undefined) checkNumber(block.rotation, `${path}.rotation`)
    if (block.motion) validateMotion(block.motion, `${path}.motion`, checkNumber)

    if (
      [block.position.x, block.position.y, block.size.width, block.size.height].every(
        isFiniteNumber
      )
    ) {
      const halfWidth = block.size.width / 2
      const halfHeight = block.size.height / 2
      if (
        block.position.x - halfWidth < 0 ||
        block.position.x + halfWidth > MAP_WIDTH ||
        block.position.y - halfHeight < 0 ||
        block.position.y + halfHeight > MAP_HEIGHT
      ) {
        addError(
          `${path}.position`,
          "OUT_OF_BOUNDS",
          "Блок целиком должен находиться внутри поля 1920×1080."
        )
      }
    }

    if (block.groupId !== undefined && !spec.groups?.some((group) => group.id === block.groupId)) {
      addError(`${path}.groupId`, "UNKNOWN_GROUP", `Группа "${block.groupId}" не существует.`)
    }

    for (const [effectIndex, effect] of (block.effects ?? []).entries()) {
      validateEffect(effect, `${path}.effects[${effectIndex}]`, checkNumber)
      if (effect.kind === "portal") {
        const pairBlocks = portalIdsByPair.get(effect.pairId) ?? []
        pairBlocks.push(block.id)
        portalIdsByPair.set(effect.pairId, pairBlocks)
      }
    }

    for (const [linkIndex, link] of (block.links ?? []).entries()) {
      const linkPath = `${path}.links[${linkIndex}]`
      const target = spec.blocks.find((candidate) => candidate.id === link.targetBlockId)
      if (!target) {
        addError(
          `${linkPath}.targetBlockId`,
          "UNKNOWN_BLOCK",
          `Блок "${link.targetBlockId}" не существует.`
        )
      } else if (link.kind === "portal-pair") {
        const ownPortal = (block.effects ?? []).find((effect) => effect.kind === "portal")
        const targetHasPair = (target.effects ?? []).some(
          (effect) => effect.kind === "portal" && ownPortal?.pairId === effect.pairId
        )
        if (!ownPortal || !targetHasPair) {
          addError(linkPath, "INVALID_PORTAL_PAIR", "Цель ссылки должна быть порталом той же пары.")
        }
      }
    }
  }

  for (const [index, group] of (spec.groups ?? []).entries()) {
    const path = `groups[${index}]`
    if (groupById.has(group.id)) {
      addError(`${path}.id`, "DUPLICATE_GROUP_ID", `ID группы "${group.id}" уже используется.`)
    } else {
      groupById.set(group.id, group)
    }
    const seenMembers = new Set<string>()
    for (const [memberIndex, blockId] of group.blockIds.entries()) {
      if (seenMembers.has(blockId)) {
        addError(
          `${path}.blockIds[${memberIndex}]`,
          "DUPLICATE_GROUP_MEMBERSHIP",
          `Блок "${blockId}" указан в группе "${group.id}" больше одного раза.`
        )
      }
      seenMembers.add(blockId)
      const member = blockById.get(blockId)
      if (!member) {
        addError(
          `${path}.blockIds[${memberIndex}]`,
          "UNKNOWN_BLOCK",
          `Блок "${blockId}" не существует.`
        )
      } else if (member.groupId !== group.id) {
        addError(
          `${path}.blockIds[${memberIndex}]`,
          "UNKNOWN_GROUP",
          `Блок "${blockId}" не ссылается на группу "${group.id}".`
        )
      }
    }
  }

  for (const [index, block] of spec.blocks.entries()) {
    if (!block.groupId) continue
    const declaredMembershipCount = (spec.groups ?? []).filter((group) =>
      group.blockIds.includes(block.id)
    ).length
    if (declaredMembershipCount !== 1) {
      addError(
        `blocks[${index}].groupId`,
        declaredMembershipCount > 1 ? "DUPLICATE_GROUP_MEMBERSHIP" : "UNKNOWN_GROUP",
        declaredMembershipCount > 1
          ? `Блок "${block.id}" указан более чем в одной группе.`
          : `Группа "${block.groupId}" не перечисляет блок "${block.id}" как участника.`
      )
    }
  }

  for (const [pairId, blockIds] of portalIdsByPair) {
    if (blockIds.length !== 2) {
      for (const blockId of blockIds) {
        const blockIndex = spec.blocks.findIndex((block) => block.id === blockId)
        const effectIndex = spec.blocks[blockIndex].effects?.findIndex(
          (effect) => effect.kind === "portal" && effect.pairId === pairId
        )
        addError(
          `blocks[${blockIndex}].effects[${effectIndex}]`,
          "INVALID_PORTAL_PAIR",
          `Портальная пара "${pairId}" должна содержать ровно два блока.`
        )
      }
    }
  }

  for (const [index, targetId] of (spec.winCondition.kind === "targets"
    ? spec.winCondition.targetIds
    : []
  ).entries()) {
    if (!blockById.has(targetId)) {
      addError(
        `winCondition.targetIds[${index}]`,
        "UNKNOWN_BLOCK",
        `Целевой блок "${targetId}" не существует.`
      )
    }
  }

  return errors
}

function validateEffect(
  effect: PlayerBlockEffect,
  path: string,
  checkNumber: (value: number, path: string, range?: NumericRange) => void
) {
  switch (effect.kind) {
    case "armor":
      checkNumber(effect.amount, `${path}.amount`, { min: 1, max: 5 })
      break
    case "pulse":
      checkNumber(effect.amplitude, `${path}.amplitude`, { min: 0.1, max: 2 })
      checkNumber(effect.frequency, `${path}.frequency`, { min: 0.1, max: 5 })
      if (effect.phase !== undefined) checkNumber(effect.phase, `${path}.phase`)
      break
    case "spring":
      if (effect.speedMultiplier !== undefined) {
        checkNumber(effect.speedMultiplier, `${path}.speedMultiplier`, { min: 1.1, max: 3 })
      }
      if (effect.duration !== undefined)
        checkNumber(effect.duration, `${path}.duration`, { min: 1, max: 10 })
      break
    case "cotton":
      if (effect.speedMultiplier !== undefined) {
        checkNumber(effect.speedMultiplier, `${path}.speedMultiplier`, { min: 0.1, max: 0.9 })
      }
      if (effect.duration !== undefined)
        checkNumber(effect.duration, `${path}.duration`, { min: 1, max: 10 })
      break
    case "portal":
      if (effect.pairId.trim().length === 0) {
        checkNumber(Number.NaN, `${path}.pairId`)
      }
      break
  }
}

function validateMotion(
  motion: PlayerBlockSpec["motion"],
  path: string,
  checkNumber: (value: number, path: string, range?: NumericRange) => void
) {
  if (!motion) return
  if (motion.path === "circle") {
    checkNumber(motion.radius, `${path}.radius`, { min: 10, max: 1000 })
  } else {
    checkNumber(motion.amplitude, `${path}.amplitude`, { min: 10, max: 1000 })
  }
  checkNumber(motion.frequency, `${path}.frequency`, { min: 0.1, max: 5 })
  if (motion.phase !== undefined) checkNumber(motion.phase, `${path}.phase`)
}
