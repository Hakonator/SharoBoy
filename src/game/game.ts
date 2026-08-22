import { SFX } from "./audio";

/* ============================================================
   ШАРОБОЙ — движок. Блоки = шары и овалы, ракетка = круглый брус.
   ============================================================ */

export type Phase = "menu" | "playing" | "paused" | "over" | "won";
export type PowerType =
  | "wide"
  | "multi"
  | "life"
  | "slow"
  | "fast"
  | "shield"
  | "shrink"
  | "laser"
  | "rocket"
  | "fire";

export interface HudData {
  phase: Phase;
  score: number;
  best: number;
  lives: number;
  level: number;
  levelCount: number;
  levelName: string;
  combo: number;
  blocksLeft: number;
  muted: boolean;
  banner: string | null;
  stuck: boolean;
  newRecord: boolean;
  shield: number;
  wideOn: boolean;
  slowOn: boolean;
  fastOn: boolean;
  shrinkOn: boolean;
  laserOn: boolean;
  rocketOn: boolean;
  fireOn: boolean;
  top: number[];
  topEndless: number[];
  mode: "campaign" | "endless";
  wave: number;
}

interface Block {
  x: number;
  y: number;
  rx: number;
  ry: number;
  circle: boolean;
  hp: number;
  maxHp: number;
  tier: 1 | 2 | 3;
  flash: number;
  seed: number;
  dead: boolean;
  /** базовая x для покачивания ряда */
  x0: number;
  swayAmp: number;
  swayFreq: number;
  swayPh: number;
  /** блок-бомба: детонирует по площади при разрушении */
  bomb: boolean;
  boomQueued?: boolean;
  /** миньон босса: орбита вокруг ядра */
  minionOrbit?: { ang: number; rad: number; dir: number; speed: number };
}

interface BossState {
  x: number;
  y: number;
  baseY: number;
  r: number;
  hp: number;
  maxHp: number;
  t: number;
  flash: number;
  dropTimer: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  speed: number;
  stuck: boolean;
  stuckOffset: number;
  trail: { x: number; y: number }[];
  /** сплющивание при ударе (0..1) */
  squash: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grav: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  t: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  size: number;
}

interface PowerUp {
  x: number;
  y: number;
  vy: number;
  type: PowerType;
  t: number;
}

interface Projectile {
  x: number;
  y: number;
  vy: number;
  kind: "laser" | "rocket";
  r: number;
  dead: boolean;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  sp: number;
  ph: number;
  a: number;
}

const TIER = {
  1: { base: "#5dffb0", light: "#c9ffe4", dark: "#0c8f58", glow: "rgba(93,255,176,0.55)" },
  2: { base: "#ffc94d", light: "#ffedb8", dark: "#b57510", glow: "rgba(255,201,77,0.55)" },
  3: { base: "#ff6a5c", light: "#ffc4bd", dark: "#b02818", glow: "rgba(255,106,92,0.6)" },
} as const;

/** Положительные бонусы — зелёные, отрицательные (анти-бонусы) — красные. */
const POWER_META: Record<PowerType, { label: string; good: boolean; color: string; edge: string }> = {
  wide: { label: "ШИР", good: true, color: "#4dff9e", edge: "#d2ffee" },
  multi: { label: "×3", good: true, color: "#4dff9e", edge: "#d2ffee" },
  life: { label: "+1", good: true, color: "#4dff9e", edge: "#d2ffee" },
  slow: { label: "СК↓", good: true, color: "#4dff9e", edge: "#d2ffee" },
  shield: { label: "ЩИТ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  laser: { label: "ЛАЗ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  rocket: { label: "РКТ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  fire: { label: "ОГНЬ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  fast: { label: "СК↑", good: false, color: "#ff5347", edge: "#ffd0cb" },
  shrink: { label: "УЗК", good: false, color: "#ff5347", edge: "#ffd0cb" },
};

interface LayoutItem {
  /** x — в единицах cell от центра поля, y — в единицах cell от верха зоны */
  x: number;
  y: number;
  rx: number;
  ry?: number;
  hp: 1 | 2 | 3;
  bomb?: boolean;
}

interface BaseSpec {
  name: string;
  speed: number;
}

interface PatternSpec extends BaseSpec {
  rows: number;
  counts: number[];
  shape: (r: number, i: number) => "circle" | "eh" | "ev";
  hp: (r: number, i: number) => 1 | 2 | 3;
}

interface LayoutSpec extends BaseSpec {
  layout: LayoutItem[];
}

interface BossSpec extends BaseSpec {
  boss: { hp: number; minions: number; bombs: number };
}

type LevelSpec = PatternSpec | LayoutSpec | BossSpec;

/**
 * Уровень 1 «СТРЕЛА»: плотная симметричная ракета остриём вниз.
 * 32 цели: плотная полоса мелких шаров, широкие овалы-крылья,
 * малые вертикальные овалы-стабилизаторы и треугольник с крупным овалом-остриём.
 */
const L1_LAYOUT: LayoutItem[] = [
  // плотная верхняя полоса из мелких шаров (прилегают почти вплотную)
  ...[-5.1, -4.25, -3.4, -2.55, -1.7, -0.85, 0, 0.85, 1.7, 2.55, 3.4, 4.25, 5.1].map(
    (x): LayoutItem => ({ x, y: 0.6, rx: 0.36, hp: 1 })
  ),
  // широкие горизонтальные овалы-крылья
  { x: -4.0, y: 1.7, rx: 1.35, ry: 0.55, hp: 2 },
  { x: 4.0, y: 1.7, rx: 1.35, ry: 0.55, hp: 2 },
  // малые вертикальные овалы-стабилизаторы
  { x: -4.17, y: 4.2, rx: 0.44, ry: 0.85, hp: 1 },
  { x: 4.17, y: 4.2, rx: 0.44, ry: 0.85, hp: 1 },
  // остриё — крупный вертикальный овал
  { x: 0, y: 6.0, rx: 0.6, ry: 1.25, hp: 3 },
  // треугольник стрелы (ряды снизу вверх), набран плотно
  { x: -0.98, y: 5.05, rx: 0.58, hp: 2 },
  { x: 0.98, y: 5.05, rx: 0.58, hp: 2 },
  { x: 0, y: 5.05, rx: 0.38, hp: 1 },
  { x: -1.96, y: 4.12, rx: 0.48, hp: 1 },
  { x: 0, y: 4.12, rx: 0.52, hp: 2 },
  { x: 1.96, y: 4.12, rx: 0.48, hp: 1 },
  { x: -1.58, y: 3.23, rx: 0.48, hp: 1 },
  { x: -0.53, y: 3.23, rx: 0.52, hp: 2 },
  { x: 0.53, y: 3.23, rx: 0.52, hp: 2 },
  { x: 1.58, y: 3.23, rx: 0.48, hp: 1 },
  { x: -2.11, y: 2.34, rx: 0.45, hp: 1 },
  { x: -1.05, y: 2.34, rx: 0.5, hp: 2 },
  { x: 0, y: 2.34, rx: 0.5, hp: 2 },
  { x: 1.05, y: 2.34, rx: 0.5, hp: 2 },
  { x: 2.11, y: 2.34, rx: 0.45, hp: 1 },
  // мелкие шары-заполнители между крыльями и корпусом
  { x: -2.2, y: 1.5, rx: 0.32, hp: 1 },
  { x: 2.2, y: 1.5, rx: 0.32, hp: 1 },
  { x: -2.9, y: 2.9, rx: 0.3, hp: 1 },
  { x: 2.9, y: 2.9, rx: 0.3, hp: 1 },
  { x: -3.3, y: 3.7, rx: 0.3, hp: 1 },
  { x: 3.3, y: 3.7, rx: 0.3, hp: 1 },
  // бомбы у основания стрелы
  { x: -2.6, y: 6.6, rx: 0.42, hp: 1, bomb: true },
  { x: 2.6, y: 6.6, rx: 0.42, hp: 1, bomb: true },
];

const LEVELS: LevelSpec[] = [
  {
    name: "СТРЕЛА",
    speed: 400,
    layout: L1_LAYOUT,
  },
  {
    name: "ОВАЛЬНЫЙ РИФ",
    rows: 6,
    counts: [7, 8, 9, 9, 8, 7],
    shape: (r, i) => ((r + i) % 3 === 0 ? (i % 2 ? "ev" : "eh") : "circle"),
    hp: (r, i) => (r < 2 ? (i % 4 === 0 ? 3 : 2) : r < 4 ? 2 : 1),
    speed: 450,
  },
  {
    name: "ЯДРО",
    rows: 7,
    counts: [9, 10, 9, 10, 9, 10, 9],
    shape: (r, i) => ((r + i) % 2 === 0 ? (r % 2 ? "ev" : "eh") : "circle"),
    hp: (r, i) => (r < 2 ? 3 : r < 5 ? 2 : i % 2 ? 2 : 1),
    speed: 500,
  },
  {
    name: "ЦАРЬ-ШАР",
    speed: 430,
    boss: { hp: 45, minions: 4, bombs: 4 },
  },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Детерминированный ГПСЧ (mulberry32) — для волн бесконечного режима. */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Сид дня: одна и та же последовательность волн для всех игроков в этот день. */
function daySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: HudData) => void;
  private raf = 0;
  private last = 0;
  private time = 0;
  private destroyed = false;

  private w = 800;
  private h = 600;
  private dpr = 1;

  phase: Phase = "menu";
  private score = 0;
  private best = 0;
  private lives = 3;
  private level = 1;
  private combo = 0;
  private newRecord = false;
  private banner: string | null = null;
  private bannerTimer = 0;
  private transition = 0;

  private paddle = { x: 400, y: 540, w: 150, baseW: 150, h: 18, squash: 0, vx: 0 };
  private wideUntil = 0;
  private slowUntil = 0;
  private fastUntil = 0;
  private shrinkUntil = 0;
  private laserUntil = 0;
  private rocketUntil = 0;
  private shield = 0;
  private weaponCd = 0;
  private tapFire = false;
  private effectsKey = "";
  private balls: Ball[] = [];
  private blocks: Block[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private powers: PowerUp[] = [];
  private bubbles: Bubble[] = [];
  private projectiles: Projectile[] = [];

  private keys = { left: false, right: false, space: false };
  private pointerX: number | null = null;
  private shake = 0;

  private hitStop = 0;
  private flash = 0;
  private countdown = 0;
  private levelLostBall = false;
  private top: number[] = [];
  private topEndless: number[] = [];

  private mode: "campaign" | "endless" = "campaign";
  private wave = 0;
  private waveSpec: { name: string; speed: number } | null = null;
  private fireUntil = 0;
  private boss: BossState | null = null;
  private boomQueue: { x: number; y: number; at: number }[] = [];
  private bossHitCd = 0;

  sfx = new SFX();

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudData) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.onHud = onHud;
    this.best = Number(localStorage.getItem("sharoboy-best") || 0) || 0;
    try {
      const parsed = JSON.parse(localStorage.getItem("sharoboy-top") || "[]") as unknown;
      this.top = Array.isArray(parsed) ? (parsed as number[]).filter((n) => typeof n === "number") : [];
    } catch {
      this.top = [];
    }
    try {
      const parsedE = JSON.parse(localStorage.getItem("sharoboy-top-endless") || "[]") as unknown;
      this.topEndless = Array.isArray(parsedE) ? (parsedE as number[]).filter((n) => typeof n === "number") : [];
    } catch {
      this.topEndless = [];
    }
  }

  /* ---------------- lifecycle ---------------- */

  attach() {
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    document.addEventListener("visibilitychange", this.handleVis);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.handleResize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.pushHud();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("visibilitychange", this.handleVis);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
  }

  /* ---------------- input ---------------- */

  private handleResize = () => {
    const oldW = this.w;
    const oldH = this.h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";

    const sx = this.w / oldW;
    const sy = this.h / oldH;
    if (oldW > 0 && (sx !== 1 || sy !== 1)) {
      for (const b of this.blocks) {
        b.x = clamp(b.x * sx, b.rx + 6, this.w - b.rx - 6);
        b.x0 = clamp(b.x0 * sx, b.rx + 6, this.w - b.rx - 6);
        b.y = clamp(b.y * sy, b.ry + 6, this.h * 0.75);
      }
      for (const b of this.balls) {
        b.x = clamp(b.x * sx, b.r, this.w - b.r);
        b.y = clamp(b.y * sy, b.r, this.h - 40);
      }
    }
    this.paddle.baseW = clamp(this.w * 0.17, 118, 200);
    this.paddle.h = clamp(this.h * 0.024, 15, 20);
    this.paddle.y = this.h - clamp(this.h * 0.07, 42, 72);
    this.paddle.x = clamp(this.paddle.x || this.w / 2, this.paddle.w / 2, this.w - this.paddle.w / 2);
    this.seedBubbles();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(c)) e.preventDefault();
    if (c === "ArrowLeft" || c === "KeyA") this.keys.left = true;
    if (c === "ArrowRight" || c === "KeyD") this.keys.right = true;
    if (c === "KeyM") this.toggleMute();
    if (c === "KeyP" || c === "Escape") {
      if (this.phase === "playing" || this.phase === "paused") this.togglePause();
    }
    if (c === "Space") this.keys.space = true;
    if (c === "Space" || c === "Enter") {
      if (this.phase === "menu" || this.phase === "won") this.startGame();
      else if (this.phase === "over") {
        if (this.mode === "endless") this.startEndless();
        else this.startGame();
      } else if (this.phase === "playing") this.launch();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false;
    if (e.code === "Space") this.keys.space = false;
  };

  private handleVis = () => {
    if (document.hidden && this.phase === "playing") this.togglePause();
  };

  private handlePointerMove = (e: PointerEvent) => {
    this.pointerX = e.clientX;
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.sfx.ensure();
    this.pointerX = e.clientX;
    this.tapFire = true;
    if (this.phase === "playing") this.launch();
  };

  /* ---------------- public controls ---------------- */

  startGame() {
    this.sfx.ensure();
    this.sfx.ui();
    this.mode = "campaign";
    this.wave = 0;
    this.waveSpec = null;
    this.boss = null;
    this.boomQueue = [];
    this.fireUntil = 0;
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.level = 1;
    this.newRecord = false;
    this.particles = [];
    this.rings = [];
    this.popups = [];
    this.powers = [];
    this.projectiles = [];
    this.wideUntil = 0;
    this.slowUntil = 0;
    this.fastUntil = 0;
    this.shrinkUntil = 0;
    this.laserUntil = 0;
    this.rocketUntil = 0;
    this.shield = 0;
    this.weaponCd = 0;
    this.effectsKey = "";
    this.transition = 0;
    this.buildLevel(1);
    this.serveBall();
    this.phase = "playing";
    this.setBanner(`УРОВЕНЬ 1 — ${LEVELS[0].name}`);
    this.pushHud();
  }

  startEndless() {
    this.sfx.ensure();
    this.sfx.ui();
    this.mode = "endless";
    this.wave = 1;
    this.waveSpec = { name: "ВОЛНА 1", speed: 400 };
    this.boss = null;
    this.boomQueue = [];
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.level = 1;
    this.newRecord = false;
    this.particles = [];
    this.rings = [];
    this.popups = [];
    this.powers = [];
    this.projectiles = [];
    this.wideUntil = 0;
    this.slowUntil = 0;
    this.fastUntil = 0;
    this.shrinkUntil = 0;
    this.laserUntil = 0;
    this.rocketUntil = 0;
    this.fireUntil = 0;
    this.shield = 0;
    this.weaponCd = 0;
    this.effectsKey = "";
    this.transition = 0;
    this.buildWave(1);
    this.serveBall();
    this.phase = "playing";
    this.setBanner("БЕСКОНЕЧНЫЙ РЕЖИМ — ВОЛНА 1");
    this.pushHud();
  }

  toMenu() {
    this.sfx.ui();
    this.phase = "menu";
    this.balls = [];
    this.blocks = [];
    this.powers = [];
    this.projectiles = [];
    this.banner = null;
    this.pushHud();
  }

  togglePause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.keys.space = false;
      this.sfx.ui();
    } else if (this.phase === "paused") {
      this.phase = "playing";
      this.countdown = 3;
      this.sfx.ui();
      this.last = performance.now();
    }
    this.pushHud();
  }

  toggleMute() {
    this.sfx.ensure();
    this.sfx.setMuted(!this.sfx.muted);
    this.pushHud();
  }

  launch() {
    let launched = false;
    for (const b of this.balls) {
      if (b.stuck) {
        b.stuck = false;
        const a = rand(-0.22, 0.22);
        b.vx = Math.sin(a) * b.speed;
        b.vy = -Math.cos(a) * b.speed;
        launched = true;
      }
    }
    if (launched) {
      this.sfx.launch();
      this.pushHud();
    }
  }

  /* ---------------- setup ---------------- */

  private seedBubbles() {
    const n = Math.round(clamp((this.w * this.h) / 26000, 24, 60));
    this.bubbles = Array.from({ length: n }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: rand(2, 9),
      sp: rand(9, 30),
      ph: rand(0, Math.PI * 2),
      a: rand(0.05, 0.2),
    }));
  }

  private buildLevel(n: number) {
    this.levelLostBall = false;
    this.buildFromSpec(LEVELS[n - 1]);
  }

  private buildFromSpec(spec: LevelSpec) {
    this.boss = null;
    this.boomQueue = [];
    if ("boss" in spec) {
      this.buildBossLevel(spec.boss.hp, spec.boss.minions, spec.boss.bombs);
      return;
    }
    const margin = clamp(this.w * 0.055, 22, 72);
    const top = clamp(this.h * 0.14, 86, 160);
    const bottom = clamp(this.h * 0.6, 300, 660);
    const blocks: Block[] = [];

    // авторская раскладка: единый масштаб cell, фигура вписывается в зону
    if ("layout" in spec) {
      let maxAx = 0;
      let maxY = 0;
      for (const it of spec.layout) {
        maxAx = Math.max(maxAx, Math.abs(it.x) + it.rx);
        maxY = Math.max(maxY, it.y + (it.ry ?? it.rx));
      }
      const unit = Math.min((this.w - margin * 2) / (maxAx * 2), (bottom - top) / (maxY + 0.4));
      for (const it of spec.layout) {
        const rx = Math.max(it.rx * unit, 8);
        const ry = Math.max((it.ry ?? it.rx) * unit, 8);
        const cx = clamp(this.w / 2 + it.x * unit, margin * 0.5 + rx, this.w - margin * 0.5 - rx);
        blocks.push({
          x: cx,
          y: top + it.y * unit,
          rx,
          ry,
          circle: Math.abs(rx - ry) < 0.6,
          hp: it.hp,
          maxHp: it.hp,
          tier: it.hp,
          flash: 0,
          seed: rand(0, Math.PI * 2),
          dead: false,
          x0: cx,
          swayAmp: 0,
          swayFreq: 0,
          swayPh: 0,
          bomb: it.bomb ?? false,
        });
      }
      this.blocks = blocks;
      return;
    }

    const gap = (bottom - top) / spec.rows;

    for (let r = 0; r < spec.rows; r++) {
      let count = spec.counts[r % spec.counts.length];
      while ((this.w - margin * 2) / count < 60 && count > 3) count--;
      const slot = (this.w - margin * 2) / count;
      for (let i = 0; i < count; i++) {
        const kind = spec.shape(r, i);
        const isBomb = Math.random() < 0.07;
        const hp = (isBomb ? 1 : spec.hp(r, i)) as 1 | 2 | 3;
        const cx = clamp(
          margin + slot * (i + 0.5) + rand(-1, 1) * slot * 0.02,
          margin + slot * 0.3,
          this.w - margin - slot * 0.3
        );
        const cy = top + gap * (r + 0.5) + rand(-1, 1) * gap * 0.02;
        let rx: number;
        let ry: number;
        if (kind === "circle") {
          // диаметры почти касаются соседей — плотная кладка
          const rr = clamp(Math.min(slot * 0.5, gap * 0.44) * rand(0.9, 1), 12, 42);
          rx = ry = rr;
        } else if (kind === "eh") {
          rx = clamp(slot * 0.52 * rand(0.9, 1), 18, 60);
          ry = clamp(gap * 0.3 * rand(0.9, 1), 11, 27);
        } else {
          rx = clamp(slot * 0.27 * rand(0.9, 1), 10, 26);
          ry = clamp(gap * 0.47 * rand(0.9, 1), 15, 46);
        }
        blocks.push({
          x: cx,
          y: cy,
          rx,
          ry,
          circle: kind === "circle",
          hp,
          maxHp: hp,
          tier: hp,
          flash: 0,
          seed: rand(0, Math.PI * 2),
          x0: cx,
          swayAmp: rand(5, 13),
          swayFreq: rand(0.5, 1.0) * (r % 2 === 0 ? 1 : -1),
          swayPh: rand(0, Math.PI * 2),
          bomb: isBomb,
          dead: false,
        });
      }
    }
    this.blocks = blocks;
  }

  /** Бесконечный режим: волна n с детерминированным сидом дня. Каждая 5-я — босс. */
  private buildWave(n: number) {
    this.levelLostBall = false;
    this.waveSpec = { name: `ВОЛНА ${n}`, speed: clamp(380 + n * 22, 380, 650) };
    if (n % 5 === 0) {
      this.buildBossLevel(38 + n * 4, Math.min(5, 3 + Math.floor(n / 10)), 4);
      return;
    }
    const rng = mulberry32(daySeed() * 31 + n * 7919);
    const rows = clamp(5 + Math.floor(n / 3), 5, 8);
    const spec: PatternSpec = {
      name: this.waveSpec.name,
      speed: this.waveSpec.speed,
      rows,
      counts: Array.from({ length: rows }, (_, r) => clamp(6 + ((r + n) % 3) + Math.floor(n / 4), 6, 10)),
      shape: () => {
        const t = rng();
        return (t < 0.5 ? "circle" : t < 0.78 ? "eh" : "ev") as "circle" | "eh" | "ev";
      },
      hp: (r) =>
        (r < rows * 0.4 ? (rng() < 0.4 ? 3 : 2) : r < rows * 0.75 ? (rng() < 0.45 ? 2 : 1) : 1) as 1 | 2 | 3,
    };
    this.buildFromSpec(spec);
  }

  /** Уровень-босс: ЦАРЬ-ШАР с орбитальными миньонами и бомбами по углам. */
  private buildBossLevel(hp: number, minions: number, bombs: number) {
    const top = clamp(this.h * 0.14, 86, 160);
    const r = clamp(Math.min(this.w, this.h) * 0.1, 52, 84);
    const baseY = top + r + 34;
    this.boss = { x: this.w / 2, y: baseY, baseY, r, hp, maxHp: hp, t: 0, flash: 0, dropTimer: 5 };
    const blocks: Block[] = [];
    const orbit = clamp(r * 2.5, 110, Math.min(this.w * 0.3, 280));
    for (let i = 0; i < minions; i++) {
      blocks.push({
        x: this.w / 2,
        y: baseY,
        rx: 15,
        ry: 15,
        circle: true,
        hp: 2,
        maxHp: 2,
        tier: 2,
        flash: 0,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: this.w / 2,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        minionOrbit: { ang: (i * Math.PI * 2) / minions, rad: orbit, dir: i % 2 ? 1 : -1, speed: 1.05 },
      });
    }
    const spots = [
      [0.13, 0.16],
      [0.87, 0.16],
      [0.13, 0.55],
      [0.87, 0.55],
      [0.5, 0.7],
    ];
    for (let i = 0; i < bombs; i++) {
      const [fx, fy] = spots[i % spots.length];
      const bx = clamp(this.w * fx, 40, this.w - 40);
      const by = top + fy * clamp(this.h * 0.42, 220, 420);
      blocks.push({
        x: bx,
        y: by,
        rx: 20,
        ry: 20,
        circle: true,
        hp: 1,
        maxHp: 1,
        tier: 1,
        flash: 0,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: bx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: true,
      });
    }
    this.blocks = blocks;
  }

  private levelSpeed() {
    return this.mode === "endless" ? this.waveSpec?.speed ?? 400 : LEVELS[this.level - 1].speed;
  }

  private levelDisplayName() {
    return this.mode === "endless" ? this.waveSpec?.name ?? "ВОЛНА" : LEVELS[this.level - 1].name;
  }

  private serveBall() {
    const base = clamp(
      Math.min(this.h * 0.62, this.levelSpeed() + (this.mode === "endless" ? this.wave * 14 : this.level * 30)),
      340,
      720
    );
    this.balls = [
      {
        x: this.paddle.x,
        y: this.paddle.y - this.paddle.h / 2 - 10,
        vx: 0,
        vy: 0,
        r: 9,
        speed: base,
        stuck: true,
        stuckOffset: 0,
        trail: [],
        squash: 0,
      },
    ];
    this.combo = 0;
  }

  private setBanner(text: string) {
    this.banner = text;
    this.bannerTimer = 1.7;
    this.pushHud();
  }

  /* ---------------- main loop ---------------- */

  private loop = (t: number) => {
    if (this.destroyed) return;
    const dtRaw = clamp((t - this.last) / 1000, 0, 0.033);
    this.last = t;
    // hit-stop: время на миг замедляется на самых сочных событиях
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dtRaw);
    const dt = this.hitStop > 0 ? dtRaw * 0.18 : dtRaw;
    this.time += dt;
    this.flash = Math.max(0, this.flash - dtRaw * 2.6);
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // фоновые пузыри — всегда
    for (const b of this.bubbles) {
      b.y -= b.sp * dt;
      b.x += Math.sin(this.time * 0.7 + b.ph) * 8 * dt;
      if (b.y < -20) {
        b.y = this.h + 20;
        b.x = Math.random() * this.w;
      }
    }

    // обратный отсчёт после снятия с паузы
    if (this.countdown > 0 && this.phase === "playing") {
      const prev = Math.ceil(this.countdown);
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown > 0 && Math.ceil(this.countdown) !== prev) this.sfx.ui();
    }

    // живые ряды: мягкое покачивание блоков (узорные уровни)
    for (const b of this.blocks) {
      if (b.swayAmp > 0) {
        b.x = clamp(
          b.x0 + Math.sin(this.time * b.swayFreq + b.swayPh) * b.swayAmp,
          b.rx + 4,
          this.w - b.rx - 4
        );
      }
    }

    if (this.bannerTimer > 0 && this.phase === "playing") {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.banner = null;
        this.pushHud();
      }
    }

    if (this.transition > 0 && this.phase === "playing") {
      this.transition -= dt;
      if (this.transition <= 0) {
        if (this.mode === "endless") {
          this.wave++;
          this.buildWave(this.wave);
          this.serveBall();
          this.setBanner(this.wave % 5 === 0 ? `ВОЛНА ${this.wave} — БОСС!` : `ВОЛНА ${this.wave}`);
        } else {
          this.level++;
          this.buildLevel(this.level);
          this.serveBall();
          this.setBanner(`УРОВЕНЬ ${this.level} — ${LEVELS[this.level - 1].name}`);
        }
      }
    }

    this.shake = Math.max(0, this.shake - dt * 26);
    this.paddle.squash = Math.max(0, this.paddle.squash - dt * 6);

    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - 1.6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) r.t += dt * 2.6;
    this.rings = this.rings.filter((r) => r.t < 1);
    for (const p of this.popups) {
      p.t += dt;
      p.y -= 34 * dt;
    }
    this.popups = this.popups.filter((p) => p.t < 1);

    if (this.phase !== "playing") return;

    this.syncEffectsHud();
    this.updatePaddle(dt);
    this.updatePowers(dt);
    if (this.boss) this.updateBoss(dt);
    if (this.boomQueue.length) {
      const due = this.boomQueue.filter((q) => this.time >= q.at);
      if (due.length) {
        this.boomQueue = this.boomQueue.filter((q) => this.time < q.at);
        for (const q of due) this.explode(q.x, q.y);
      }
    }

    const frozen = this.transition > 0 || this.bannerTimer > 1.1 || this.countdown > 0;
    if (!frozen) {
      this.tryFire(dt);
      this.updateProjectiles(dt);
      for (const ball of this.balls) this.updateBall(ball, dt);
      this.balls = this.balls.filter((b) => !(b as Ball & { lost?: boolean }).lost);
      if (this.balls.length === 0) this.onBallLost();
    } else {
      for (const ball of this.balls)
        if (ball.stuck) this.stickBall(ball);
    }

    if (this.blocks.length === 0 && !this.boss && this.transition <= 0 && this.phase === "playing") {
      this.onLevelCleared();
    }
  }

  private updatePaddle(dt: number) {
    const p = this.paddle;
    let wMult = 1;
    if (this.time < this.wideUntil) wMult = 1.45;
    else if (this.time < this.shrinkUntil) wMult = 0.6;
    const targetW = p.baseW * wMult;
    p.w += (targetW - p.w) * Math.min(1, dt * 10);
    const prevX = p.x;
    if (this.keys.left || this.keys.right) {
      const v = 820;
      p.x += (this.keys.right ? v : 0) * dt - (this.keys.left ? v : 0) * dt;
      this.pointerX = null;
    } else if (this.pointerX !== null) {
      const k = 1 - Math.exp(-dt * 16);
      p.x += (this.pointerX - p.x) * k;
    }
    p.x = clamp(p.x, p.w / 2 + 4, this.w - p.w / 2 - 4);
    p.vx = (p.x - prevX) / Math.max(dt, 1e-4);
  }

  private stickBall(b: Ball) {
    b.x = this.paddle.x + b.stuckOffset;
    b.y = this.paddle.y - this.paddle.h / 2 - b.r - 1.5;
  }

  private updateBall(ball: Ball, dt: number) {
    if (ball.stuck) {
      this.stickBall(ball);
      return;
    }

    const speed = Math.hypot(ball.vx, ball.vy) || ball.speed;
    const steps = Math.max(1, Math.ceil((speed * dt) / (ball.r * 0.7)));
    const sdt = dt / steps;

    for (let s = 0; s < steps; s++) {
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;

      // стены
      if (ball.x < ball.r) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
        this.sfx.wall();
      } else if (ball.x > this.w - ball.r) {
        ball.x = this.w - ball.r;
        ball.vx = -Math.abs(ball.vx);
        this.sfx.wall();
      }
      if (ball.y < ball.r + 2) {
        ball.y = ball.r + 2;
        ball.vy = Math.abs(ball.vy);
        this.sfx.wall();
      }

      // низ — защитный экран или потеря
      if (this.shield > 0 && ball.vy > 0 && ball.y + ball.r >= this.h - 14) {
        this.shield--;
        ball.y = this.h - 14 - ball.r;
        ball.vy = -Math.abs(ball.vy);
        ball.squash = 1;
        this.sfx.shieldHit();
        this.burst(ball.x, this.h - 14, "#4dff9e", 14, 220);
        this.rings.push({ x: ball.x, y: this.h - 14, r: 8, maxR: 74, color: "rgba(77,255,158,0.8)", t: 0 });
        this.shake = Math.min(this.shake + 2.5, 8);
        this.pushHud();
        continue;
      }
      if (ball.y > this.h + ball.r * 2) {
        (ball as Ball & { lost?: boolean }).lost = true;
        return;
      }

      this.collidePaddle(ball);
      this.collideBlocks(ball);
      this.collideBoss(ball);
    }

    // страховка от горизонтального зацикливания
    const sp = Math.hypot(ball.vx, ball.vy) || 1;
    if (Math.abs(ball.vy) < sp * 0.16) {
      const sign = ball.vy === 0 ? -1 : Math.sign(ball.vy);
      ball.vy = sign * sp * 0.22;
      const nx = Math.sqrt(Math.max(sp * sp - ball.vy * ball.vy, 0));
      ball.vx = Math.sign(ball.vx || 1) * nx;
    }

    ball.squash = Math.max(0, ball.squash - dt * 6);

    // искры огненного ядра
    if (this.time < this.fireUntil && Math.random() < 0.75) {
      this.particles.push({
        x: ball.x + rand(-5, 5),
        y: ball.y + rand(-5, 5),
        vx: rand(-30, 30),
        vy: rand(-120, -40),
        life: rand(0.2, 0.45),
        maxLife: 0.45,
        size: rand(2, 4),
        color: Math.random() < 0.5 ? "#ff8a3d" : "#ffc94d",
        grav: -120,
      });
    }

    // режимы скорости шара (замедление / ускорение от бонусов)
    const mult = this.time < this.slowUntil ? 0.72 : this.time < this.fastUntil ? 1.32 : 1;
    const cur = Math.hypot(ball.vx, ball.vy) || 1;
    const target = ball.speed * mult;
    if (Math.abs(cur - target) > 1) {
      ball.vx = (ball.vx / cur) * target;
      ball.vy = (ball.vy / cur) * target;
    }

    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 9) ball.trail.shift();
  }

  private collidePaddle(ball: Ball) {
    if (ball.vy <= 0) return;
    const p = this.paddle;
    const hw = p.w / 2;
    const hh = p.h / 2;
    const cx = clamp(ball.x, p.x - hw, p.x + hw);
    const cy = clamp(ball.y, p.y - hh, p.y + hh);
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    if (dx * dx + dy * dy > ball.r * ball.r) return;

    const rel = clamp((ball.x - p.x) / hw, -1, 1);
    const ang = rel * 1.13; // ~65°
    ball.speed = Math.min(ball.speed + 9, 760);
    ball.vx = Math.sin(ang) * ball.speed + clamp(p.vx * 0.12, -70, 70);
    ball.vy = -Math.cos(ang) * ball.speed;
    ball.y = p.y - hh - ball.r - 0.5;
    ball.squash = 1;
    this.combo = 0;
    p.squash = 1;
    this.sfx.paddle();
    this.burst(ball.x, p.y - hh, "#7cf5ff", 6, 130);
    this.pushHud();
  }

  private collideBlocks(ball: Ball) {
    const fire = this.time < this.fireUntil;
    for (const b of this.blocks) {
      if (b.dead) continue;
      const ex = b.rx + ball.r;
      const ey = b.ry + ball.r;
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      const q = (dx * dx) / (ex * ex) + (dy * dy) / (ey * ey);
      if (q > 1) continue;

      // нормаль через градиент эллипса
      let nx = dx / (ex * ex);
      let ny = dy / (ey * ey);
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      // выталкиваем к границе
      const sc = 1 / Math.sqrt(Math.max(q, 1e-6));
      ball.x = b.x + dx * sc + nx * 0.8;
      ball.y = b.y + dy * sc + ny * 0.8;
      if (!fire) {
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
        }
        this.damageBlock(b);
        return;
      }
      // огненное ядро прожигает блоки насквозь
      this.sfx.burn();
      this.damageBlock(b, 2);
    }
  }

  private damageBlock(b: Block, dmg = 1) {
    b.hp -= dmg;
    b.flash = 1;
    const tier = TIER[b.tier];
    this.sfx.blockHit(this.combo);

    if (b.hp > 0) {
      this.burst(b.x, b.y, tier.base, 5, 120);
      return;
    }

    b.dead = true;
    this.blocks = this.blocks.filter((x) => !x.dead);
    if (b.bomb && !b.boomQueued) {
      b.boomQueued = true;
      this.boomQueue.push({ x: b.x, y: b.y, at: this.time + 0.09 });
    }
    this.combo++;
    const sizeBonus = Math.round((34 - Math.min(b.rx, b.ry)) * 1.4);
    const base = (b.tier === 3 ? 120 : b.tier === 2 ? 80 : 50) + Math.max(0, sizeBonus);
    const pts = base * Math.max(1, this.combo);
    this.score += pts;
    if (this.score > this.best) {
      this.best = this.score;
      this.newRecord = true;
      localStorage.setItem("sharoboy-best", String(this.best));
    }

    this.sfx.blockBreak(this.combo);
    this.burst(b.x, b.y, tier.base, b.circle ? 12 : 16, 230);
    this.burst(b.x, b.y, tier.light, 6, 150);
    this.rings.push({ x: b.x, y: b.y, r: Math.max(b.rx, b.ry), maxR: Math.max(b.rx, b.ry) * 2.6, color: tier.glow, t: 0 });
    this.popups.push({
      x: b.x,
      y: b.y - Math.max(b.ry, 14),
      text: this.combo > 1 ? `+${pts} ×${this.combo}` : `+${pts}`,
      color: this.combo > 3 ? "#ffc94d" : "#eaf7ff",
      t: 0,
      size: this.combo > 3 ? 20 : 15,
    });
    this.shake = Math.min(this.shake + (b.tier === 3 ? 3.4 : 2), 9);
    if (b.tier === 3) this.hitStop = Math.max(this.hitStop, 0.055);

    // вехи серии
    if (this.combo === 5 || this.combo === 10 || this.combo === 15) {
      const word = this.combo === 5 ? "ГОРЯЧО!" : this.combo === 10 ? "НЕУДЕРЖИМО!" : "БЕЗУМИЕ!";
      this.popups.push({ x: b.x, y: b.y - 28, text: `${word} ×${this.combo}`, color: "#ffc94d", t: 0, size: 22 });
      this.rings.push({ x: b.x, y: b.y, r: 10, maxR: 130, color: "rgba(255,201,77,0.8)", t: 0 });
      this.sfx.power();
    }

    // бонусы (зелёные) и анти-бонусы (красные) — падают часто
    if (Math.random() < 0.24) {
      const roll = Math.random();
      const type: PowerType =
        roll < 0.08 ? "life"
        : roll < 0.17 ? "wide"
        : roll < 0.26 ? "multi"
        : roll < 0.35 ? "slow"
        : roll < 0.44 ? "shield"
        : roll < 0.53 ? "laser"
        : roll < 0.61 ? "rocket"
        : roll < 0.71 ? "fire"
        : roll < 0.87 ? "fast"
        : "shrink";
      const skip =
        (type === "multi" && this.balls.length >= 4) ||
        (type === "life" && this.lives >= 5) ||
        (type === "shield" && this.shield >= 5);
      if (!skip) this.powers.push({ x: b.x, y: b.y, vy: 150, type, t: 0 });
    }
    this.pushHud();
  }

  private updatePowers(dt: number) {
    const p = this.paddle;
    for (const pw of this.powers) {
      pw.t += dt;
      pw.y += pw.vy * dt;
      const hw = p.w / 2;
      if (
        pw.y > p.y - p.h / 2 - 12 &&
        pw.y < p.y + p.h / 2 + 14 &&
        pw.x > p.x - hw - 12 &&
        pw.x < p.x + hw + 12
      ) {
        this.applyPower(pw.type);
        pw.t = 99;
      }
    }
    this.powers = this.powers.filter((pw) => pw.t < 90 && pw.y < this.h + 30);
  }

  private applyPower(type: PowerType) {
    const meta = POWER_META[type];
    if (meta.good) this.sfx.power();
    else this.sfx.powerBad();
    const popup = (text: string) =>
      this.popups.push({ x: this.paddle.x, y: this.paddle.y - 36, text, color: meta.color, t: 0, size: 18 });

    switch (type) {
      case "wide":
        this.wideUntil = this.time + 12;
        this.shrinkUntil = 0;
        popup("ШИРЕ!");
        break;
      case "shrink":
        this.shrinkUntil = this.time + 10;
        this.wideUntil = 0;
        popup("УЗКАЯ РАКЕТКА");
        break;
      case "life":
        this.lives = Math.min(this.lives + 1, 5);
        popup("+ЖИЗНЬ");
        break;
      case "slow":
        this.slowUntil = this.time + 10;
        this.fastUntil = 0;
        popup("ЗАМЕДЛЕНИЕ");
        break;
      case "fast":
        this.fastUntil = this.time + 8;
        this.slowUntil = 0;
        popup("УСКОРЕНИЕ!");
        break;
      case "shield":
        this.shield = Math.min(this.shield + 3, 5);
        popup("ЩИТ +3");
        break;
      case "laser":
        this.laserUntil = this.time + 12;
        popup("ЛАЗЕР — ПРОБЕЛ");
        break;
      case "rocket":
        this.rocketUntil = this.time + 12;
        popup("РАКЕТЫ — ПРОБЕЛ");
        break;
      case "fire":
        this.fireUntil = this.time + 8;
        popup("ОГНЕННОЕ ЯДРО!");
        break;
      case "multi": {
        const src = [...this.balls].filter((b) => !b.stuck);
        const donors = src.length ? src : this.balls.slice(0, 1);
        for (const d of donors) {
          for (const da of [-0.55, 0.55]) {
            if (this.balls.length >= 6) break;
            const ang = Math.atan2(d.vy || -1, d.vx) + da;
            this.balls.push({
              x: d.x,
              y: d.y,
              vx: Math.cos(ang) * d.speed,
              vy: Math.sin(ang) * d.speed,
              r: d.r,
              speed: d.speed,
            stuck: false,
            stuckOffset: 0,
            trail: [],
            squash: 0,
          });          }
        }
        popup("×3 ШАРА!");
        break;
      }
    }
    this.burst(this.paddle.x, this.paddle.y - 10, meta.color, 12, 190);
    this.pushHud();
  }

  /* ---------------- оружие: лазеры и ракеты ---------------- */

  private tryFire(dt: number) {
    const laserOn = this.time < this.laserUntil;
    const rocketOn = this.time < this.rocketUntil;
    if ((!laserOn && !rocketOn) || (!this.keys.space && !this.tapFire)) {
      this.weaponCd = 0;
      this.tapFire = false;
      return;
    }
    this.tapFire = false;
    this.weaponCd -= dt;
    if (this.weaponCd > 0) return;
    const p = this.paddle;
    if (laserOn) {
      this.projectiles.push(
        { x: p.x - p.w * 0.36, y: p.y - p.h, vy: -1000, kind: "laser", r: 4, dead: false },
        { x: p.x + p.w * 0.36, y: p.y - p.h, vy: -1000, kind: "laser", r: 4, dead: false }
      );
      this.sfx.laser();
      this.weaponCd = 0.14;
      this.burst(p.x, p.y - p.h, "#7cf5ff", 4, 110);
    } else {
      this.projectiles.push({ x: p.x, y: p.y - p.h - 6, vy: -560, kind: "rocket", r: 7, dead: false });
      this.sfx.rocket();
      this.weaponCd = 0.32;
      this.burst(p.x, p.y - p.h, "#ffc94d", 5, 120);
    }
    if (this.projectiles.length > 48) this.projectiles.splice(0, this.projectiles.length - 48);
    p.squash = Math.max(p.squash, 0.35);
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.y += pr.vy * dt;
      if (pr.kind === "rocket" && Math.random() < 0.55) {
        this.particles.push({
          x: pr.x + rand(-2.5, 2.5),
          y: pr.y + 9,
          vx: rand(-26, 26),
          vy: rand(60, 150),
          life: rand(0.2, 0.42),
          maxLife: 0.42,
          size: rand(2, 4),
          color: Math.random() < 0.5 ? "#ffc94d" : "#ff8a3d",
          grav: 0,
        });
      }
      if (pr.y < -30) pr.dead = true;
    }
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      for (const b of this.blocks) {
        if (b.dead) continue;
        const dx = (pr.x - b.x) / (b.rx + pr.r);
        const dy = (pr.y - b.y) / (b.ry + pr.r);
        if (dx * dx + dy * dy <= 1) {
          pr.dead = true;
          if (pr.kind === "rocket") this.explode(pr.x, pr.y);
          else {
            this.damageBlock(b);
            this.burst(pr.x, pr.y, "#7cf5ff", 6, 150);
          }
          break;
        }
      }
      if (!pr.dead && this.boss) {
        if (Math.hypot(pr.x - this.boss.x, pr.y - this.boss.y) < this.boss.r + pr.r + 4) {
          pr.dead = true;
          if (pr.kind === "rocket") this.explode(pr.x, pr.y);
          else {
            this.damageBoss(1, true);
            this.burst(pr.x, pr.y, "#7cf5ff", 6, 150);
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  private explode(x: number, y: number) {
    this.sfx.explosion();
    this.shake = Math.min(this.shake + 5, 12);
    this.flash = Math.max(this.flash, 0.4);
    this.rings.push({ x, y, r: 12, maxR: 150, color: "rgba(255,138,61,0.85)", t: 0 });
    this.burst(x, y, "#ffc94d", 14, 270);
    this.burst(x, y, "#ff8a3d", 10, 210);
    const R = 90;
    for (const b of [...this.blocks]) {
      if (b.dead) continue;
      if (Math.hypot(b.x - x, b.y - y) < R + Math.max(b.rx, b.ry)) this.damageBlock(b, 3);
    }
    if (this.boss && Math.hypot(this.boss.x - x, this.boss.y - y) < R + this.boss.r) this.damageBoss(3, true);
  }

  /* ---------------- босс «ЦАРЬ-ШАР» ---------------- */

  private updateBoss(dt: number) {
    const bo = this.boss;
    if (!bo) return;
    bo.t += dt;
    bo.flash = Math.max(0, bo.flash - dt * 4);
    this.bossHitCd = Math.max(0, this.bossHitCd - dt);
    const angry = bo.hp < bo.maxHp * 0.4;
    bo.x = this.w / 2 + Math.sin(bo.t * (angry ? 0.95 : 0.55)) * this.w * 0.2;
    bo.y = bo.baseY + Math.sin(bo.t * 1.6) * 12;
    for (const b of this.blocks) {
      const o = b.minionOrbit;
      if (!o) continue;
      o.ang += dt * o.speed * o.dir * (angry ? 1.6 : 1);
      b.x0 = clamp(bo.x + Math.cos(o.ang) * o.rad, b.rx + 4, this.w - b.rx - 4);
      b.y = clamp(bo.y + Math.sin(o.ang) * o.rad * 0.42 + 8, b.ry + 4, this.h * 0.7);
      b.x = b.x0;
    }
    const frozen = this.transition > 0 || this.bannerTimer > 1.1 || this.countdown > 0;
    if (!frozen) {
      bo.dropTimer -= dt;
      if (bo.dropTimer <= 0) {
        bo.dropTimer = angry ? 4.5 : 6.5;
        const pool: PowerType[] = ["wide", "multi", "slow", "shield", "laser", "rocket", "fire", "fast"];
        const type = pool[Math.floor(Math.random() * pool.length)];
        this.powers.push({ x: bo.x, y: bo.y + bo.r + 10, vy: 150, type, t: 0 });
        this.burst(bo.x, bo.y + bo.r, "#ff5ca8", 8, 140);
      }
    }
  }

  private collideBoss(ball: Ball) {
    const bo = this.boss;
    if (!bo) return;
    const dx = ball.x - bo.x;
    const dy = ball.y - bo.y;
    const rr = bo.r + ball.r;
    if (dx * dx + dy * dy >= rr * rr) return;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    ball.x = bo.x + nx * rr;
    ball.y = bo.y + ny * rr;
    const fire = this.time < this.fireUntil;
    if (!fire) {
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
      }
    }
    ball.squash = 1;
    this.damageBoss(fire ? 2 : 1, false);
  }

  private damageBoss(dmg: number, force: boolean) {
    const bo = this.boss;
    if (!bo) return;
    if (!force && this.bossHitCd > 0) return;
    this.bossHitCd = 0.12;
    bo.hp -= dmg;
    bo.flash = 1;
    this.sfx.blockHit(this.combo);
    this.burst(bo.x + rand(-bo.r * 0.5, bo.r * 0.5), bo.y + rand(-bo.r * 0.4, bo.r * 0.4), "#ff5ca8", 7, 170);
    this.shake = Math.min(this.shake + 1.2, 8);
    if (bo.hp <= 0) this.killBoss();
  }

  private killBoss() {
    const bo = this.boss;
    if (!bo) return;
    this.boss = null;
    this.sfx.bossDie();
    this.sfx.explosion();
    this.flash = 1;
    this.shake = 14;
    this.hitStop = Math.max(this.hitStop, 0.5);
    for (let i = 0; i < 70; i++) {
      const c = ["#ff5ca8", "#ffc94d", "#ff6a5c", "#eaf7ff"][i % 4];
      const a = rand(0, Math.PI * 2);
      const v = rand(60, 420);
      this.particles.push({
        x: bo.x,
        y: bo.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.5, 1.2),
        maxLife: 1.2,
        size: rand(3, 7),
        color: c,
        grav: 220,
      });
    }
    this.rings.push({ x: bo.x, y: bo.y, r: bo.r, maxR: bo.r * 4.5, color: "rgba(255,92,168,0.9)", t: 0 });
    this.rings.push({ x: bo.x, y: bo.y, r: bo.r * 0.5, maxR: bo.r * 3, color: "rgba(255,201,77,0.9)", t: 0 });
    const pts = this.mode === "campaign" ? 1500 : 500 + this.wave * 100;
    this.score += pts;
    if (this.score > this.best) {
      this.best = this.score;
      this.newRecord = true;
      localStorage.setItem("sharoboy-best", String(this.best));
    }
    this.popups.push({ x: bo.x, y: bo.y, text: `ЦАРЬ ПОВЕРЖЕН! +${pts}`, color: "#ffc94d", t: 0, size: 24 });
    // миньоны разлетаются цепочкой взрывов
    let k = 0;
    for (const b of [...this.blocks]) {
      if (b.minionOrbit) {
        this.boomQueue.push({ x: b.x, y: b.y, at: this.time + 0.12 + k * 0.09 });
        k++;
        b.dead = true;
      }
    }
    this.blocks = this.blocks.filter((x) => !x.dead);
    // прощальные подарки
    const gifts: PowerType[] = ["fire", "shield", "multi"];
    for (let g = 0; g < 2; g++) {
      this.powers.push({
        x: clamp(bo.x + rand(-90, 90), 40, this.w - 40),
        y: bo.y,
        vy: 150,
        type: gifts[g % gifts.length],
        t: 0,
      });
    }
    this.pushHud();
  }

  private onBallLost() {
    this.lives--;
    this.combo = 0;
    this.levelLostBall = true;
    this.shake = 10;
    this.sfx.loseLife();
    this.wideUntil = 0;
    this.slowUntil = 0;
    this.fastUntil = 0;
    this.shrinkUntil = 0;
    this.laserUntil = 0;
    this.rocketUntil = 0;
    this.fireUntil = 0;
    this.weaponCd = 0;
    this.powers = [];
    this.projectiles = [];
    if (this.lives <= 0) {
      this.phase = "over";
      this.sfx.gameOver();
      this.saveTop();
      this.pushHud();
      return;
    }
    this.serveBall();
    this.pushHud();
  }

  private onLevelCleared() {
    // бонус за уровень без единой потери шара
    if (!this.levelLostBall) {
      this.score += 500;
      if (this.score > this.best) {
        this.best = this.score;
        this.newRecord = true;
        localStorage.setItem("sharoboy-best", String(this.best));
      }
      this.popups.push({ x: this.w / 2, y: this.h * 0.42, text: "ЧИСТО! +500", color: "#5dffb0", t: 0, size: 26 });
      this.sfx.power();
    }
    this.flash = 1;
    this.hitStop = Math.max(this.hitStop, 0.35);
    if (this.mode === "endless") {
      this.sfx.levelClear();
      this.lives = Math.min(this.lives + 1, 5);
      this.setBanner(`ВОЛНА ${this.wave} ПРОЙДЕНА!  +ЖИЗНЬ`);
      this.transition = 1.6;
      return;
    }
    if (this.level >= LEVELS.length) {
      this.phase = "won";
      this.sfx.win();
      for (let i = 0; i < 130; i++) {
        const c = ["#35e0ff", "#5dffb0", "#ffc94d", "#ff6a5c", "#ff5ca8"][i % 5];
        this.particles.push({
          x: Math.random() * this.w,
          y: rand(-40, this.h * 0.3),
          vx: rand(-80, 80),
          vy: rand(60, 260),
          life: rand(1.2, 2.4),
          maxLife: 2.4,
          size: rand(3, 7),
          color: c,
          grav: 260,
        });
      }
      this.saveTop();
      this.pushHud();
      return;
    }
    this.sfx.levelClear();
    this.lives = Math.min(this.lives + 1, 5);
    this.setBanner(`УРОВЕНЬ ${this.level} ПРОЙДЕН!  +ЖИЗНЬ`);
    this.transition = 1.75;
  }

  private burst(x: number, y: number, color: string, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(power * 0.3, power);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.35, 0.8),
        maxLife: 0.8,
        size: rand(2, 5),
        color,
        grav: 300,
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  private syncEffectsHud() {
    const t = this.time;
    const key = [
      this.shield,
      t < this.wideUntil ? 1 : 0,
      t < this.slowUntil ? 1 : 0,
      t < this.fastUntil ? 1 : 0,
      t < this.shrinkUntil ? 1 : 0,
      t < this.laserUntil ? 1 : 0,
      t < this.rocketUntil ? 1 : 0,
      t < this.fireUntil ? 1 : 0,
    ].join("");
    if (key !== this.effectsKey) {
      this.effectsKey = key;
      this.pushHud();
    }
  }

  private pushHud() {
    this.onHud({
      phase: this.phase,
      score: this.score,
      best: this.best,
      lives: this.lives,
      level: this.mode === "endless" ? this.wave : this.level,
      levelCount: this.mode === "endless" ? -1 : LEVELS.length,
      levelName: this.levelDisplayName(),
      mode: this.mode,
      wave: this.wave,
      combo: this.combo,
      blocksLeft: this.blocks.length,
      muted: this.sfx.muted,
      banner: this.banner,
      stuck: this.balls.some((b) => b.stuck),
      newRecord: this.newRecord,
      shield: this.shield,
      wideOn: this.time < this.wideUntil,
      slowOn: this.time < this.slowUntil,
      fastOn: this.time < this.fastUntil,
      shrinkOn: this.time < this.shrinkUntil,
      laserOn: this.time < this.laserUntil,
      rocketOn: this.time < this.rocketUntil,
      fireOn: this.time < this.fireUntil,
      top: this.top,
      topEndless: this.topEndless,
    });
  }

  private saveTop() {
    if (this.score <= 0) return;
    if (this.mode === "endless") {
      this.topEndless = [...this.topEndless, this.score].sort((a, b) => b - a).slice(0, 5);
      localStorage.setItem("sharoboy-top-endless", JSON.stringify(this.topEndless));
    } else {
      this.top = [...this.top, this.score].sort((a, b) => b - a).slice(0, 5);
      localStorage.setItem("sharoboy-top", JSON.stringify(this.top));
    }
  }

  /* ---------------- drawing ---------------- */

  private draw() {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // фон
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0e3a4e");
    bg.addColorStop(0.5, "#082434");
    bg.addColorStop(1, "#04101a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // зарево реагирует на серию: растёт и теплеет
    const heat = Math.min(this.combo, 12) / 12;
    const glow = ctx.createRadialGradient(w / 2, h * 0.16, 40, w / 2, h * 0.16, Math.max(w, h) * 0.7);
    glow.addColorStop(
      0,
      heat > 0.5 ? `rgba(255,201,77,${0.08 + heat * 0.12})` : `rgba(53,224,255,${0.1 + heat * 0.08})`
    );
    glow.addColorStop(1, "rgba(53,224,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // пузыри фона
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(140,220,255,${b.a})`;
      ctx.fill();
    }

    // тряска
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }

    this.drawDanger();
    this.drawBlocks();
    this.drawBoss();
    this.drawRings();
    this.drawPowers();
    this.drawProjectiles();
    this.drawParticles();
    this.drawShield();
    this.drawPaddle();
    this.drawBalls();
    this.drawPopups();

    ctx.restore();

    // вспышка на сочных событиях
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(234,247,255,${this.flash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }

    // обратный отсчёт после паузы
    if (this.countdown > 0 && this.phase === "playing") {
      ctx.fillStyle = "rgba(4,16,26,0.45)";
      ctx.fillRect(0, 0, w, h);
      const n = Math.ceil(this.countdown);
      const frac = this.countdown - Math.floor(this.countdown);
      ctx.save();
      ctx.translate(w / 2, h * 0.44);
      ctx.scale(0.8 + frac * 0.5, 0.8 + frac * 0.5);
      ctx.font = '120px "Russo One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#35e0ff";
      ctx.shadowBlur = 34;
      ctx.fillStyle = "#eaf7ff";
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }

    // виньетка
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
    vg.addColorStop(0, "rgba(2,10,16,0)");
    vg.addColorStop(1, "rgba(2,10,16,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  private drawDanger() {
    const { ctx, w, h } = this;
    let danger = false;
    for (const b of this.balls) if (!b.stuck && b.y > h * 0.78) danger = true;
    if (!danger) return;
    const g = ctx.createLinearGradient(0, h - 90, 0, h);
    g.addColorStop(0, "rgba(255,106,92,0)");
    g.addColorStop(1, `rgba(255,106,92,${0.16 + Math.sin(this.time * 10) * 0.06})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h - 90, w, 90);
  }

  private drawBlocks() {
    const { ctx } = this;
    for (const b of this.blocks) {
      const wobX = Math.cos(this.time * 1.1 + b.seed) * 1.6;
      const wobY = Math.sin(this.time * 1.4 + b.seed) * 2;
      const x = b.x + wobX;
      const y = b.y + wobY;
      const tier = TIER[b.tier];
      b.flash = Math.max(0, b.flash - 0.08);

      if (b.bomb) {
        this.drawBomb(b, x, y);
        continue;
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(b.rx, b.ry);
      const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15);
      g.addColorStop(0, tier.light);
      g.addColorStop(0.42, tier.base);
      g.addColorStop(1, tier.dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();

      // блик
      ctx.beginPath();
      ctx.ellipse(-0.32, -0.42, 0.3, 0.18, -0.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill();

      // ободок
      ctx.beginPath();
      ctx.arc(0, 0, 0.97, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(4,18,26,0.5)";
      ctx.lineWidth = 0.06;
      ctx.stroke();

      if (b.flash > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.85})`;
        ctx.fill();
      }
      ctx.restore();

      // трещины при повреждении
      if (b.hp < b.maxHp) {
        ctx.strokeStyle = "rgba(4,18,26,0.55)";
        ctx.lineWidth = 1.6;
        const rr = Math.max(b.rx, b.ry) * 0.6;
        ctx.beginPath();
        ctx.moveTo(x - rr * 0.5, y - rr * 0.2);
        ctx.lineTo(x - rr * 0.1, y + rr * 0.1);
        ctx.lineTo(x + rr * 0.25, y - rr * 0.25);
        if (b.hp === 1 && b.maxHp === 3) {
          ctx.moveTo(x + rr * 0.1, y + rr * 0.35);
          ctx.lineTo(x + rr * 0.45, y + rr * 0.05);
        }
        ctx.stroke();
      }

      // пипсы HP
      if (b.maxHp > 1 && b.hp > 1) {
        ctx.fillStyle = "rgba(4,18,26,0.75)";
        for (let i = 0; i < b.hp; i++) {
          ctx.beginPath();
          ctx.arc(x + (i - (b.hp - 1) / 2) * 8, y + b.ry * 0.55, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawBomb(b: Block, x: number, y: number) {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6 + b.seed);
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = "rgba(255,140,60,0.9)";
    ctx.shadowBlur = 8 + pulse * 12;
    ctx.scale(b.rx, b.ry);
    const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15);
    g.addColorStop(0, "#7b8b98");
    g.addColorStop(0.45, "#3a4750");
    g.addColorStop(1, "#141b21");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 0.96, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,150,70,${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 0.07;
    ctx.stroke();
    ctx.restore();
    // фитиль с искрой
    ctx.strokeStyle = "#c9a25f";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - b.ry);
    ctx.quadraticCurveTo(x + 4, y - b.ry - 9, x + 11, y - b.ry - 6);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = "#ffc94d";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ffe9a8";
    ctx.beginPath();
    ctx.arc(x + 11, y - b.ry - 6, 2.4 + pulse * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBoss() {
    const bo = this.boss;
    if (!bo || this.phase === "menu") return;
    const { ctx } = this;
    const angry = bo.hp < bo.maxHp * 0.4;
    ctx.save();
    ctx.translate(bo.x, bo.y);

    // тело с аурой
    ctx.shadowColor = angry ? "#ff5347" : "#ff5ca8";
    ctx.shadowBlur = 32;
    const g = ctx.createRadialGradient(-bo.r * 0.3, -bo.r * 0.35, bo.r * 0.1, 0, 0, bo.r);
    g.addColorStop(0, angry ? "#ffd0cb" : "#ffc4dd");
    g.addColorStop(0.45, angry ? "#ff5347" : "#e0355f");
    g.addColorStop(1, angry ? "#7c1208" : "#5e0f2e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, bo.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // корона
    const cw = bo.r * 0.95;
    const cy0 = -bo.r * 0.78;
    const chh = bo.r * 0.42;
    ctx.fillStyle = "#ffc94d";
    ctx.strokeStyle = "#8a5a00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, cy0);
    ctx.lineTo(-cw / 2, cy0 - chh * 0.7);
    ctx.lineTo(-cw * 0.25, cy0 - chh * 0.28);
    ctx.lineTo(0, cy0 - chh);
    ctx.lineTo(cw * 0.25, cy0 - chh * 0.28);
    ctx.lineTo(cw / 2, cy0 - chh * 0.7);
    ctx.lineTo(cw / 2, cy0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff5347";
    ctx.beginPath();
    ctx.arc(0, cy0 - chh * 0.62, bo.r * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // глаза следят за ближайшим шаром
    let tx = this.paddle.x - bo.x;
    let ty = this.paddle.y - bo.y;
    let bd = Infinity;
    for (const b of this.balls) {
      const d = Math.hypot(b.x - bo.x, b.y - bo.y);
      if (d < bd) {
        bd = d;
        tx = b.x - bo.x;
        ty = b.y - bo.y;
      }
    }
    const tl = Math.hypot(tx, ty) || 1;
    const px = (tx / tl) * bo.r * 0.09;
    const py = (ty / tl) * bo.r * 0.09;
    for (const sx of [-1, 1]) {
      const exx = sx * bo.r * 0.34;
      const eyy = -bo.r * 0.12;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(exx, eyy, bo.r * 0.2, bo.r * (angry ? 0.17 : 0.24), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = angry ? "#7c1208" : "#2a0a18";
      ctx.beginPath();
      ctx.arc(exx + px, eyy + py, bo.r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      if (angry) {
        ctx.strokeStyle = "#7c1208";
        ctx.lineWidth = bo.r * 0.05;
        ctx.beginPath();
        ctx.moveTo(exx - sx * bo.r * 0.22, eyy - bo.r * 0.3);
        ctx.lineTo(exx + sx * bo.r * 0.14, eyy - bo.r * 0.16);
        ctx.stroke();
      }
    }

    // рот: зигзаг-пасть в ярости, иначе ухмылка
    ctx.strokeStyle = "#2a0a18";
    ctx.lineWidth = bo.r * 0.05;
    ctx.beginPath();
    if (angry) {
      ctx.moveTo(-bo.r * 0.3, bo.r * 0.42);
      for (let i = 1; i <= 6; i++) {
        ctx.lineTo(-bo.r * 0.3 + (bo.r * 0.6 * i) / 6, bo.r * (0.42 + (i % 2 ? -0.08 : 0.08)));
      }
    } else {
      ctx.arc(0, bo.r * 0.3, bo.r * 0.26, 0.2, Math.PI - 0.2);
    }
    ctx.stroke();

    if (bo.flash > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, bo.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.6})`;
      ctx.fill();
    }

    // кольцо HP
    const pct = Math.max(0, bo.hp / bo.maxHp);
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(234,247,255,0.15)";
    ctx.beginPath();
    ctx.arc(0, 0, bo.r + 13, 0, Math.PI * 2);
    ctx.stroke();
    const hpColor = pct > 0.5 ? "#5dffb0" : pct > 0.25 ? "#ffc94d" : "#ff5347";
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = hpColor;
    ctx.beginPath();
    ctx.arc(0, 0, bo.r + 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    ctx.restore();
  }

  private drawRings() {
    const { ctx } = this;
    for (const r of this.rings) {
      const rr = r.r + (r.maxR - r.r) * r.t;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rr, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - r.t;
      ctx.lineWidth = 3 * (1 - r.t) + 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawPowers() {
    const { ctx } = this;
    for (const pw of this.powers) {
      const meta = POWER_META[pw.type];
      ctx.save();
      ctx.translate(pw.x, pw.y);
      ctx.rotate(Math.sin(pw.t * 5) * 0.12);
      const pulse = 1 + Math.sin(pw.t * 9) * 0.05;
      ctx.scale(pulse, pulse);
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = meta.color;
      this.roundRect(-24, -16, 48, 32, 16);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = meta.edge;
      ctx.lineWidth = 2.5;
      this.roundRect(-24, -16, 48, 32, 16);
      ctx.stroke();
      // блик
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      this.roundRect(-18, -12.5, 36, 10, 8);
      ctx.fill();
      ctx.fillStyle = "#04121c";
      ctx.font = '700 15px "Russo One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.label, 0, 2);
      ctx.restore();
    }
  }

  private drawShield() {
    if (this.shield <= 0 || this.phase === "menu") return;
    const { ctx, w, h } = this;
    const y = h - 14;
    const a = 0.5 + Math.sin(this.time * 6) * 0.18;
    const g = ctx.createLinearGradient(0, y - 9, 0, y + 9);
    g.addColorStop(0, "rgba(77,255,158,0)");
    g.addColorStop(0.5, `rgba(77,255,158,${a})`);
    g.addColorStop(1, "rgba(77,255,158,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 9, w, 18);
    ctx.strokeStyle = `rgba(210,255,238,${Math.min(1, a + 0.2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    // пипсы зарядов
    ctx.shadowColor = "#4dff9e";
    ctx.shadowBlur = 9;
    for (let i = 0; i < this.shield; i++) {
      const px = w / 2 + (i - (this.shield - 1) / 2) * 15;
      ctx.beginPath();
      ctx.arc(px, y, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = "#4dff9e";
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  private drawProjectiles() {
    const { ctx } = this;
    for (const pr of this.projectiles) {
      if (pr.kind === "laser") {
        ctx.save();
        ctx.shadowColor = "#7cf5ff";
        ctx.shadowBlur = 12;
        const g = ctx.createLinearGradient(pr.x, pr.y - 18, pr.x, pr.y + 18);
        g.addColorStop(0, "rgba(124,245,255,0)");
        g.addColorStop(0.5, "#eaffff");
        g.addColorStop(1, "rgba(124,245,255,0.25)");
        ctx.fillStyle = g;
        ctx.fillRect(pr.x - 2.5, pr.y - 18, 5, 36);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.shadowColor = "#ffc94d";
        ctx.shadowBlur = 14;
        const g = ctx.createLinearGradient(0, -11, 0, 8);
        g.addColorStop(0, "#ffe9a8");
        g.addColorStop(0.5, "#ffc94d");
        g.addColorStop(1, "#c07f0e");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.quadraticCurveTo(6, -4, 5, 6);
        ctx.lineTo(-5, 6);
        ctx.quadraticCurveTo(-6, -4, 0, -11);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ff6a5c";
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.quadraticCurveTo(3.4, -7, 3, -4);
        ctx.lineTo(-3, -4);
        ctx.quadraticCurveTo(-3.4, -7, 0, -11);
        ctx.fill();
        // пламя
        const fl = 6 + Math.sin(this.time * 42) * 3;
        ctx.fillStyle = "#ff8a3d";
        ctx.beginPath();
        ctx.moveTo(-3, 6);
        ctx.lineTo(0, 10 + fl);
        ctx.lineTo(3, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPaddle() {
    if (this.phase === "menu") return;
    const { ctx } = this;
    const p = this.paddle;
    const sq = p.squash * 0.35;
    const ww = p.w * (1 + sq * 0.25);
    const hh = p.h * (1 - sq);
    const wide = this.time < this.wideUntil;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(clamp(p.vx * 0.00011, -0.1, 0.1));
    const shrink = !wide && this.time < this.shrinkUntil;
    ctx.shadowColor = wide ? "#ffc94d" : shrink ? "#ff5347" : "#35e0ff";
    ctx.shadowBlur = 22;
    const g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
    if (wide) {
      g.addColorStop(0, "#ffe9a8");
      g.addColorStop(0.5, "#ffc94d");
      g.addColorStop(1, "#c07f0e");
    } else if (shrink) {
      g.addColorStop(0, "#ffb8b0");
      g.addColorStop(0.5, "#ff5347");
      g.addColorStop(1, "#8f1d12");
    } else {
      g.addColorStop(0, "#aef7ff");
      g.addColorStop(0.5, "#35e0ff");
      g.addColorStop(1, "#0e86a3");
    }
    ctx.fillStyle = g;
    this.roundRect(-ww / 2, -hh / 2, ww, hh, hh / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // верхний блик
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    this.roundRect(-ww / 2 + 6, -hh / 2 + 2.5, ww - 12, hh * 0.3, hh * 0.15);
    ctx.fill();
    // бортики-заглушки
    ctx.fillStyle = "rgba(4,18,26,0.35)";
    ctx.beginPath();
    ctx.arc(-ww / 2 + hh / 2, 0, hh * 0.22, 0, Math.PI * 2);
    ctx.arc(ww / 2 - hh / 2, 0, hh * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // оружейные пилоны
    const laserOn = this.time < this.laserUntil;
    const rocketOn = this.time < this.rocketUntil;
    if (laserOn) {
      ctx.shadowColor = "#7cf5ff";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#9df2ff";
      for (const sx of [-0.36, 0.36]) {
        this.roundRect(ww * sx - 3, -hh / 2 - 9, 6, 10, 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    if (rocketOn) {
      ctx.shadowColor = "#ffc94d";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffe9a8";
      this.roundRect(-4.5, -hh / 2 - 13, 9, 14, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ff6a5c";
      ctx.beginPath();
      ctx.arc(0, -hh / 2 - 13, 3, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBalls() {
    if (this.phase === "menu") return;
    const { ctx } = this;
    // цвет шара подсказывает режим: огонь / замедление / ускорение / норма
    const mode = this.time < this.fireUntil
      ? { trail: "rgba(255,138,61,", mid: "#ffe9a8", core: "#ff5347", glow: "#ff8a3d" }
      : this.time < this.slowUntil
        ? { trail: "rgba(93,255,176,", mid: "#d2ffee", core: "#2fd98a", glow: "#5dffb0" }
        : this.time < this.fastUntil
          ? { trail: "rgba(255,106,92,", mid: "#ffd9d4", core: "#ff5347", glow: "#ff6a5c" }
          : { trail: "rgba(120,240,255,", mid: "#c9f6ff", core: "#38bcd8", glow: "#7cf5ff" };
    for (const b of this.balls) {
      // хвост
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        const a = (i / b.trail.length) * 0.28;
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.r * (0.3 + (i / b.trail.length) * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `${mode.trail}${a})`;
        ctx.fill();
      }

      if (b.stuck) {
        const pr = b.r + 6 + Math.sin(this.time * 6) * 2.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = `${mode.trail}0.65)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // сплющивание при ударе
      const sq = b.squash * 0.28;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(1 + sq, 1 - sq);
      ctx.shadowColor = mode.glow;
      ctx.shadowBlur = 16;
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, b.r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, mode.mid);
      g.addColorStop(1, mode.core);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPopups() {
    const { ctx } = this;
    for (const p of this.popups) {
      const a = 1 - p.t;
      ctx.globalAlpha = clamp(a * 1.4, 0, 1);
      ctx.font = `${p.size}px "Russo One", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(4,18,26,0.8)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}
