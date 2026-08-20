import { SFX } from "./audio";

/* ============================================================
   ШАРОБОЙ — движок. Блоки = шары и овалы, ракетка = круглый брус.
   ============================================================ */

export type Phase = "menu" | "playing" | "paused" | "over" | "won";
export type PowerType = "wide" | "multi" | "life";

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

const POWER_META: Record<PowerType, { label: string; color: string; edge: string }> = {
  wide: { label: "Ш", color: "#ffc94d", edge: "#fff1c4" },
  multi: { label: "×3", color: "#ff5ca8", edge: "#ffd0e8" },
  life: { label: "+1", color: "#5dffb0", edge: "#d2ffee" },
};

interface LayoutItem {
  /** x — в единицах cell от центра поля, y — в единицах cell от верха зоны */
  x: number;
  y: number;
  rx: number;
  ry?: number;
  hp: 1 | 2 | 3;
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

type LevelSpec = PatternSpec | LayoutSpec;

/**
 * Уровень 1 «СТРЕЛА»: плотная симметричная ракета остриём вниз.
 * 32 цели: плотная полоса мелких шаров, широкие овалы-крылья,
 * малые вертикальные овалы-стабилизаторы и треугольник с крупным овалом-остриём.
 */
const L1_LAYOUT: LayoutItem[] = [
  // плотная верхняя полоса из мелких шаров
  ...[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(
    (x): LayoutItem => ({ x, y: 0.7, rx: 0.34, hp: 1 })
  ),
  // широкие горизонтальные овалы-крылья
  { x: -4.7, y: 2.0, rx: 1.35, ry: 0.55, hp: 2 },
  { x: 4.7, y: 2.0, rx: 1.35, ry: 0.55, hp: 2 },
  // малые вертикальные овалы-стабилизаторы
  { x: -4.9, y: 4.9, rx: 0.42, ry: 0.8, hp: 1 },
  { x: 4.9, y: 4.9, rx: 0.42, ry: 0.8, hp: 1 },
  // остриё — крупный вертикальный овал
  { x: 0, y: 7.0, rx: 0.58, ry: 1.2, hp: 3 },
  // треугольник стрелы (ряды снизу вверх)
  { x: -1.15, y: 5.9, rx: 0.55, hp: 2 },
  { x: 1.15, y: 5.9, rx: 0.55, hp: 2 },
  { x: -2.3, y: 4.85, rx: 0.45, hp: 1 },
  { x: 0, y: 4.85, rx: 0.5, hp: 2 },
  { x: 2.3, y: 4.85, rx: 0.45, hp: 1 },
  { x: -1.86, y: 3.8, rx: 0.45, hp: 1 },
  { x: -0.62, y: 3.8, rx: 0.5, hp: 2 },
  { x: 0.62, y: 3.8, rx: 0.5, hp: 2 },
  { x: 1.86, y: 3.8, rx: 0.45, hp: 1 },
  { x: -2.48, y: 2.75, rx: 0.42, hp: 1 },
  { x: -1.24, y: 2.75, rx: 0.48, hp: 2 },
  { x: 0, y: 2.75, rx: 0.48, hp: 2 },
  { x: 1.24, y: 2.75, rx: 0.48, hp: 2 },
  { x: 2.48, y: 2.75, rx: 0.42, hp: 1 },
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
    counts: [6, 7, 8, 8, 7, 6],
    shape: (r, i) => ((r + i) % 3 === 0 ? (i % 2 ? "ev" : "eh") : "circle"),
    hp: (r, i) => (r < 2 ? (i % 4 === 0 ? 3 : 2) : r < 4 ? 2 : 1),
    speed: 450,
  },
  {
    name: "ЯДРО",
    rows: 7,
    counts: [8, 9, 8, 9, 8, 9, 8],
    shape: (r, i) => ((r + i) % 2 === 0 ? (r % 2 ? "ev" : "eh") : "circle"),
    hp: (r, i) => (r < 2 ? 3 : r < 5 ? 2 : i % 2 ? 2 : 1),
    speed: 500,
  },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

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
  private balls: Ball[] = [];
  private blocks: Block[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private powers: PowerUp[] = [];
  private bubbles: Bubble[] = [];

  private keys = { left: false, right: false };
  private pointerX: number | null = null;
  private shake = 0;

  sfx = new SFX();

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudData) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.onHud = onHud;
    this.best = Number(localStorage.getItem("sharoboy-best") || 0) || 0;
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
    if (c === "Space" || c === "Enter") {
      if (this.phase === "menu" || this.phase === "over" || this.phase === "won") this.startGame();
      else if (this.phase === "playing") this.launch();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false;
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
    if (this.phase === "playing") this.launch();
  };

  /* ---------------- public controls ---------------- */

  startGame() {
    this.sfx.ensure();
    this.sfx.ui();
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.level = 1;
    this.newRecord = false;
    this.particles = [];
    this.rings = [];
    this.popups = [];
    this.powers = [];
    this.wideUntil = 0;
    this.transition = 0;
    this.buildLevel(1);
    this.serveBall();
    this.phase = "playing";
    this.setBanner(`УРОВЕНЬ 1 — ${LEVELS[0].name}`);
    this.pushHud();
  }

  toMenu() {
    this.sfx.ui();
    this.phase = "menu";
    this.balls = [];
    this.blocks = [];
    this.powers = [];
    this.banner = null;
    this.pushHud();
  }

  togglePause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.sfx.ui();
    } else if (this.phase === "paused") {
      this.phase = "playing";
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
    const spec = LEVELS[n - 1];
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
        blocks.push({
          x: clamp(this.w / 2 + it.x * unit, margin * 0.5 + rx, this.w - margin * 0.5 - rx),
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
        });
      }
      this.blocks = blocks;
      return;
    }

    const gap = (bottom - top) / spec.rows;

    for (let r = 0; r < spec.rows; r++) {
      let count = spec.counts[r % spec.counts.length];
      while ((this.w - margin * 2) / count < 58 && count > 3) count--;
      const slot = (this.w - margin * 2) / count;
      for (let i = 0; i < count; i++) {
        const kind = spec.shape(r, i);
        const hp = spec.hp(r, i);
        const cx = clamp(
          margin + slot * (i + 0.5) + rand(-1, 1) * slot * 0.06,
          margin + slot * 0.3,
          this.w - margin - slot * 0.3
        );
        const cy = top + gap * (r + 0.5) + rand(-1, 1) * gap * 0.06;
        let rx: number;
        let ry: number;
        if (kind === "circle") {
          const rr = clamp(Math.min(slot * 0.42, gap * 0.34) * rand(0.82, 1), 13, 36);
          rx = ry = rr;
        } else if (kind === "eh") {
          rx = clamp(slot * 0.44 * rand(0.85, 1), 20, 52);
          ry = clamp(gap * 0.24 * rand(0.85, 1), 11, 24);
        } else {
          rx = clamp(slot * 0.22 * rand(0.85, 1), 11, 24);
          ry = clamp(gap * 0.38 * rand(0.85, 1), 16, 40);
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
          dead: false,
        });
      }
    }
    this.blocks = blocks;
  }

  private serveBall() {
    const spec = LEVELS[this.level - 1];
    const base = clamp(Math.min(this.h * 0.62, spec.speed + this.level * 30), 340, 660);
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
    const dt = clamp((t - this.last) / 1000, 0, 0.033);
    this.last = t;
    this.time += dt;
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
        this.level++;
        this.buildLevel(this.level);
        this.serveBall();
        this.setBanner(`УРОВЕНЬ ${this.level} — ${LEVELS[this.level - 1].name}`);
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

    this.updatePaddle(dt);
    this.updatePowers(dt);

    const frozen = this.transition > 0 || this.bannerTimer > 1.1;
    if (!frozen) {
      for (const ball of this.balls) this.updateBall(ball, dt);
      this.balls = this.balls.filter((b) => !(b as Ball & { lost?: boolean }).lost);
      if (this.balls.length === 0) this.onBallLost();
    } else {
      for (const ball of this.balls)
        if (ball.stuck) this.stickBall(ball);
    }

    if (this.blocks.length === 0 && this.transition <= 0 && this.phase === "playing") {
      this.onLevelCleared();
    }
  }

  private updatePaddle(dt: number) {
    const p = this.paddle;
    const targetW = p.baseW * (this.time < this.wideUntil ? 1.45 : 1);
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

      // низ — потеря
      if (ball.y > this.h + ball.r * 2) {
        (ball as Ball & { lost?: boolean }).lost = true;
        return;
      }

      this.collidePaddle(ball);
      this.collideBlocks(ball);
    }

    // страховка от горизонтального зацикливания
    const sp = Math.hypot(ball.vx, ball.vy) || 1;
    if (Math.abs(ball.vy) < sp * 0.16) {
      const sign = ball.vy === 0 ? -1 : Math.sign(ball.vy);
      ball.vy = sign * sp * 0.22;
      const nx = Math.sqrt(Math.max(sp * sp - ball.vy * ball.vy, 0));
      ball.vx = Math.sign(ball.vx || 1) * nx;
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
    this.combo = 0;
    p.squash = 1;
    this.sfx.paddle();
    this.burst(ball.x, p.y - hh, "#7cf5ff", 6, 130);
    this.pushHud();
  }

  private collideBlocks(ball: Ball) {
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
      const dot = ball.vx * nx + ball.vy * ny;
      if (dot < 0) {
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
      }
      this.damageBlock(b);
      return;
    }
  }

  private damageBlock(b: Block) {
    b.hp--;
    b.flash = 1;
    const tier = TIER[b.tier];
    this.sfx.blockHit(this.combo);

    if (b.hp > 0) {
      this.burst(b.x, b.y, tier.base, 5, 120);
      return;
    }

    b.dead = true;
    this.blocks = this.blocks.filter((x) => !x.dead);
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

    // бонус
    if (Math.random() < 0.13) {
      const roll = Math.random();
      const type: PowerType = roll < 0.45 ? "wide" : roll < 0.85 ? "multi" : "life";
      if (!(type === "multi" && this.balls.length >= 4) && !(type === "life" && this.lives >= 5)) {
        this.powers.push({ x: b.x, y: b.y, vy: 150, type, t: 0 });
      }
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
    this.sfx.power();
    const meta = POWER_META[type];
    if (type === "wide") {
      this.wideUntil = this.time + 12;
      this.popups.push({ x: this.paddle.x, y: this.paddle.y - 30, text: "ШИРЕ!", color: meta.color, t: 0, size: 18 });
    } else if (type === "life") {
      this.lives = Math.min(this.lives + 1, 5);
      this.popups.push({ x: this.paddle.x, y: this.paddle.y - 30, text: "+ЖИЗНЬ", color: meta.color, t: 0, size: 18 });
    } else {
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
          });
        }
      }
      this.popups.push({ x: this.paddle.x, y: this.paddle.y - 30, text: "×3 ШАРА!", color: meta.color, t: 0, size: 18 });
    }
    this.burst(this.paddle.x, this.paddle.y - 10, meta.color, 10, 190);
    this.pushHud();
  }

  private onBallLost() {
    this.lives--;
    this.combo = 0;
    this.shake = 10;
    this.sfx.loseLife();
    this.wideUntil = 0;
    this.powers = [];
    if (this.lives <= 0) {
      this.phase = "over";
      this.sfx.gameOver();
      this.pushHud();
      return;
    }
    this.serveBall();
    this.pushHud();
  }

  private onLevelCleared() {
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

  private pushHud() {
    this.onHud({
      phase: this.phase,
      score: this.score,
      best: this.best,
      lives: this.lives,
      level: this.level,
      levelCount: LEVELS.length,
      levelName: LEVELS[this.level - 1].name,
      combo: this.combo,
      blocksLeft: this.blocks.length,
      muted: this.sfx.muted,
      banner: this.banner,
      stuck: this.balls.some((b) => b.stuck),
      newRecord: this.newRecord,
    });
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

    const glow = ctx.createRadialGradient(w / 2, h * 0.16, 40, w / 2, h * 0.16, Math.max(w, h) * 0.7);
    glow.addColorStop(0, "rgba(53,224,255,0.10)");
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
    this.drawRings();
    this.drawPowers();
    this.drawParticles();
    this.drawPaddle();
    this.drawBalls();
    this.drawPopups();

    ctx.restore();

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
      ctx.rotate(Math.sin(pw.t * 5) * 0.15);
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = meta.color;
      this.roundRect(-17, -12, 34, 24, 12);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = meta.edge;
      ctx.lineWidth = 2;
      this.roundRect(-17, -12, 34, 24, 12);
      ctx.stroke();
      ctx.fillStyle = "#04121c";
      ctx.font = '700 13px "Russo One", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(meta.label, 0, 1.5);
      ctx.restore();
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
    ctx.shadowColor = wide ? "#ffc94d" : "#35e0ff";
    ctx.shadowBlur = 22;
    const g = ctx.createLinearGradient(0, -hh / 2, 0, hh / 2);
    if (wide) {
      g.addColorStop(0, "#ffe9a8");
      g.addColorStop(0.5, "#ffc94d");
      g.addColorStop(1, "#c07f0e");
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
    ctx.restore();
  }

  private drawBalls() {
    if (this.phase === "menu") return;
    const { ctx } = this;
    for (const b of this.balls) {
      // хвост
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        const a = (i / b.trail.length) * 0.28;
        ctx.beginPath();
        ctx.arc(t.x, t.y, b.r * (0.3 + (i / b.trail.length) * 0.6), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120,240,255,${a})`;
        ctx.fill();
      }

      if (b.stuck) {
        const pr = b.r + 6 + Math.sin(this.time * 6) * 2.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, pr, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120,240,255,0.65)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.save();
      ctx.shadowColor = "#7cf5ff";
      ctx.shadowBlur = 16;
      const g = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, b.r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, "#c9f6ff");
      g.addColorStop(1, "#38bcd8");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
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
