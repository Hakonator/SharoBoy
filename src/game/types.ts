/**
 * Общие типы сущностей движка и данных HUD.
 * Модуль без зависимостей — импортируется и движком, и UI.
 */

export type Phase = "menu" | "playing" | "paused" | "over" | "won"

export interface HudData {
  phase: Phase
  score: number
  best: number
  lives: number
  level: number
  levelCount: number
  levelName: string
  mode: "campaign" | "endless"
  wave: number
  combo: number
  blocksLeft: number
  muted: boolean
  /** id достижений, открытых с прошлой отправки HUD (очередь для тостов). */
  newAchievements: string[]
  banner: string | null
  stuck: boolean
  newRecord: boolean
  shield: number
  wideOn: boolean
  slowOn: boolean
  fastOn: boolean
  shrinkOn: boolean
  laserOn: boolean
  laserArmed: boolean
  rocketOn: boolean
  fireOn: boolean
  magnetOn: boolean
  coins: number
  upgrades: Record<string, number>
  top: ScoreEntry[]
  topEndless: ScoreEntry[]
}

export interface ScoreEntry {
  score: number
  nick: string
}

export interface Block {
  x: number
  y: number
  rx: number
  ry: number
  /** поворот эллипса (радианы); 0 — оси выровнены с экраном */
  rot: number
  circle: boolean
  hp: number
  maxHp: number
  tier: 1 | 2 | 3
  flash: number
  seed: number
  dead: boolean
  x0: number
  swayAmp: number
  swayFreq: number
  swayPh: number
  bomb: boolean
  boomQueued?: boolean
  splits: boolean
  minionOrbit?: { ang: number; rad: number; dir: number; speed: number }
}

export interface BossState {
  x: number
  y: number
  baseY: number
  r: number
  hp: number
  maxHp: number
  t: number
  flash: number
  dropTimer: number
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  speed: number
  stuck: boolean
  stuckOffset: number
  trail: { x: number; y: number }[]
  squash: number
  sinceHit: number
  /** шар вылетел за нижнюю границу и должен быть убран в этом же кадре */
  lost?: boolean
}

export type PowerType =
  | "wide"
  | "multi"
  | "life"
  | "coin"
  | "magnet"
  | "slow"
  | "shield"
  | "laser"
  | "rocket"
  | "fire"
  | "fast"
  | "shrink"

export interface PowerUp {
  x: number
  y: number
  vy: number
  type: PowerType
  t: number
  /** бонус подобран в этом кадре — убрать при ближайшей фильтрации */
  taken?: boolean
}

export interface PaddleState {
  x: number
  y: number
  w: number
  baseW: number
  h: number
  vx: number
  squash: number
}

export interface Projectile {
  x: number
  y: number
  vy: number
  kind: "rocket"
  r: number
  dead: boolean
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  grav: number
}

export interface Ring {
  x: number
  y: number
  r: number
  maxR: number
  color: string
  t: number
}

export interface Popup {
  x: number
  y: number
  text: string
  color: string
  t: number
  size: number
}

export interface Bubble {
  x: number
  y: number
  r: number
  vy: number
  ph: number
}
