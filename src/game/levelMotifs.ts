import type { LayoutItem, MotifSpec } from "./levels"
import { mulberry32 } from "./utils"

interface Point {
  x: number
  y: number
}

interface Motif {
  name: string
  points: Point[]
  difficulty: number
}

function ring(): Point[] {
  return Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2
    return { x: Math.cos(a) * 1.45, y: 3.5 + Math.sin(a) * 2.5 }
  })
}

function fortress(): Point[] {
  const points: Point[] = []
  for (let x = -3.3; x <= 3.3; x += 0.66) points.push({ x, y: 0.6 }, { x, y: 6.2 })
  for (let y = 1.5; y <= 5.7; y += 0.7) points.push({ x: -3.3, y }, { x: 3.3, y })
  for (const x of [-1.98, -0.66, 0.66, 1.98]) points.push({ x, y: 3.4 })
  return points
}

function wave(): Point[] {
  const points: Point[] = []
  for (let i = 0; i < 12; i++) {
    const x = -3.6 + i * 0.65
    points.push({ x, y: 0.7 + Math.sin(i * 0.45) * 0.36 })
    if (i % 2 === 0) points.push({ x, y: 3.2 + Math.sin(i * 0.45 + 1) * 0.34 })
    if (i % 3 === 0) points.push({ x, y: 5.9 + Math.sin(i * 0.45 + 2) * 0.3 })
  }
  return points
}

function star(): Point[] {
  const points: Point[] = []
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
    const next = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / 5
    const tip = { x: Math.cos(a) * 3.3, y: 3.5 + Math.sin(a) * 3.1 }
    const valley = { x: Math.cos((a + next) / 2) * 1.35, y: 3.5 + Math.sin((a + next) / 2) * 1.3 }
    for (let j = 0; j < 3; j++) {
      const t = j / 3
      points.push({ x: tip.x + (valley.x - tip.x) * t, y: tip.y + (valley.y - tip.y) * t })
    }
  }
  return points
}

function snake(): Point[] {
  const points: Point[] = []
  for (let row = 0; row < 8; row++) {
    const y = 0.65 + row * 0.78
    const leftToRight = row % 2 === 0
    for (let col = 0; col < 12; col++) {
      const x = -3.6 + col * 0.65
      if (col % 2 === 0 || (leftToRight ? col === 11 : col === 0)) points.push({ x, y })
    }
  }
  return points
}

function gates(): Point[] {
  const points: Point[] = []
  for (let row = 0; row < 6; row++) {
    const y = 0.6 + row * 1.15
    const gap = row % 2 === 0 ? 1.4 : -1.4
    for (let x = -3.6; x <= 3.6; x += 0.62) {
      if (Math.abs(x - gap) > 0.8) points.push({ x, y })
    }
  }
  return points
}

function splitCore(): Point[] {
  const points: Point[] = []
  for (const side of [-1, 1]) {
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        points.push({ x: side * (1.72 + col * 0.64), y: 0.7 + row * 1.05 })
      }
    }
  }
  return points
}

const MOTIFS: Motif[] = [
  { name: "КОЛЬЦО", points: ring(), difficulty: 0 },
  { name: "КРЕПОСТЬ", points: fortress(), difficulty: 0.06 },
  { name: "ВОЛНА", points: wave(), difficulty: 0.03 },
  { name: "ЗВЕЗДА", points: star(), difficulty: 0.08 },
  { name: "ЗМЕЯ", points: snake(), difficulty: 0.05 },
  { name: "ВОРОТА", points: gates(), difficulty: 0.04 },
  { name: "РАЗЛОМ", points: splitCore(), difficulty: 0.09 },
]

function makeItem(p: Point, i: number, rng: () => number, tier: number): LayoutItem {
  const center = Math.abs(p.x) < 0.7 && p.y > 1.8 && p.y < 5.3
  const edge = Math.abs(p.x) > 2.7 || p.y < 1.2 || p.y > 5.9
  const rx = 0.24 + rng() * 0.04
  return {
    x: p.x,
    y: p.y,
    rx,
    ry: i % 3 === 0 ? rx * 1.2 : rx,
    hp: center && tier > 4 ? 3 : center || tier > 9 ? 2 : 1,
    bomb: edge && rng() < Math.min(0.1, tier * 0.006),
    splits: !center && !edge && tier > 3 && rng() < 0.03,
  }
}

/** Seeded, recognizable level compositions shared by campaign and endless. */
export function generateMotifSpec(seedIn: number, tier: number, speed: number): MotifSpec {
  const rng = mulberry32(seedIn | 0 || 1)
  const motif = MOTIFS[Math.floor(rng() * MOTIFS.length)]
  const mirror = rng() < 0.5 ? -1 : 1
  const scale = 0.94 + rng() * 0.12
  const points = motif.points.map((p) => ({
    x: Math.max(-3.8, Math.min(3.8, p.x * mirror * scale)),
    y: Math.max(0.4, Math.min(6.6, 3.5 + (p.y - 3.5) * scale)),
  }))
  return {
    name: motif.name,
    speed: speed * (1 + Math.min(0.15, tier * 0.002) + motif.difficulty),
    seed: seedIn | 0 || 1,
    motif: true,
    layout: points.map((p, i) => makeItem(p, i, rng, tier)),
  }
}

export const LEVEL_MOTIF_NAMES: readonly string[] = MOTIFS.map((motif) => motif.name)