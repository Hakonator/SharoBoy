import type { PlayerMapSpec } from "./mapSpec"

export interface MapEditProposal {
  comment: string
  spec?: PlayerMapSpec
  title?: string
  description?: string
}

export interface ParsedEditProposal {
  comment: string
  spec: PlayerMapSpec | null
  title: string | null
  description: string | null
  isStructured: boolean
}

export function parseEditProposal(
  rawReason: string | null | undefined,
  fallbackSpec?: PlayerMapSpec
): ParsedEditProposal {
  if (!rawReason) {
    return {
      comment: "",
      spec: fallbackSpec ?? null,
      title: null,
      description: null,
      isStructured: false,
    }
  }

  try {
    const parsed: unknown = JSON.parse(rawReason)
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as { __isEditProposal?: unknown }).__isEditProposal
    ) {
      const p = parsed as {
        comment?: unknown
        spec?: unknown
        title?: unknown
        description?: unknown
      }
      return {
        comment: typeof p.comment === "string" ? p.comment : "",
        spec: (p.spec as PlayerMapSpec) ?? fallbackSpec ?? null,
        title: typeof p.title === "string" ? p.title : null,
        description: typeof p.description === "string" ? p.description : null,
        isStructured: true,
      }
    }
  } catch {
    /* raw text reason */
  }

  return {
    comment: rawReason,
    spec: fallbackSpec ?? null,
    title: null,
    description: null,
    isStructured: false,
  }
}

export function formatEditProposal(proposal: MapEditProposal): string {
  return JSON.stringify({
    __isEditProposal: true,
    comment: proposal.comment.trim(),
    spec: proposal.spec,
    title: proposal.title?.trim(),
    description: proposal.description?.trim(),
  })
}
