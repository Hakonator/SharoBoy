import { SFX } from "./audio";

export type Phase = "menu" | "playing" | "paused" | "over" | "won";

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
  laserArmed: boolean;
  rocketOn: boolean;
  fireOn: boolean;
  magnetOn: boolean;
  top: number[];
  topEndless: number[];
  mode: "campaign" | "endless";
  wave: number;
  coins: number;
}

export interface Block {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** поворот эллипса (радианы); 0 — оси выровнены с экраном */
  rot: number;
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
  /** блок-«матрёшка»: рассыпается на мелкие шары */
  splits: boolean;
  /** миньон босса: орбита вокруг ядра */
  minionOrbit?: { ang: number; rad: number; dir: number; speed: number };
}

export interface Ball {
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
  /** время с последнего касания блока/ракетки — для ловли «ленивых» траекторий */
  sinceHit: number;
}

export interface Particle {
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

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  a: number;
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
  | "shrink";

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
  kind: "rocket";
  r: number;
  dead: boolean;
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

/** Положительные бонусы — зелёные, отрицательные (анти-бонусы) — красные. */
const POWER_META: Record<PowerType, { label: string; good: boolean; color: string; edge: string }> = {
  wide: { label: "ШИР", good: true, color: "#4dff9e", edge: "#d2ffee" },
  multi: { label: "×3", good: true, color: "#4dff9e", edge: "#d2ffee" },
  life: { label: "+1", good: true, color: "#4dff9e", edge: "#d2ffee" },
  coin: { label: "МОН", good: true, color: "#ffc94d", edge: "#fff1c4" },
  slow: { label: "СК↓", good: true, color: "#4dff9e", edge: "#d2ffee" },
  shield: { label: "ЩИТ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  laser: { label: "ЛАЗ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  rocket: { label: "РКТ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  fire: { label: "ОГНЬ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  fast: { label: "СК↑", good: false, color: "#ff5347", edge: "#ffd0cb" },
  shrink: { label: "УЗК", good: false, color: "#ff5347", edge: "#ffd0cb" },
  magnet: { label: "МАГ", good: true, color: "#4dff9e", edge: "#d2ffee" },
};

/* ---------- Скелет системы прокачки (пока ВЫКЛЮЧЕН) ----------
   Задумка: из мишеней изредка выпадают монеты; за них покупаются
   ПОСТОЯННЫЕ улучшения ракетки/шара, действующие между уровнями.
   Список эффектов и их баланс — TBD: добавлять в UPGRADE_DEFS. */
export const UPGRADES_ENABLED = false;

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  /** цена следующего уровня (индексация с 0) */
  cost: (level: number) => number;
}

/** Сюда будут добавлены определения постоянных улучшений. */
export const UPGRADE_DEFS: UpgradeDef[] = [];

const TIER: Record<number, { base: string; light: string; dark: string }> = {
  1: { base: "#5dffb0", light: "#eafff5", dark: "#0d7a4f" },
  2: { base: "#ffc94d", light: "#fff3d0", dark: "#a06a00" },
  3: { base: "#ff6a5c", light: "#ffd9d4", dark: "#8f1d12" },
};

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

/** Случайный наклон эллипса; уменьшается, пока повёрнутая фигура влезает в отведённое место. */
function fitTilt(rx: number, ry: number, maxHalfW: number, maxHalfH: number): number {
  let rot = rand(-0.7, 0.7);
  for (let i = 0; i < 3; i++) {
    const hw = Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot));
    const hh = Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot));
    if (hw <= maxHalfW && hh <= maxHalfH) return rot;
    rot *= 0.5;
  }
  return 0;
}

/** Габариты повёрнутого эллипса по осям экрана. */
function rotatedExtents(rx: number, ry: number, rot: number) {
  return {
    hw: Math.hypot(rx * Math.cos(rot), ry * Math.sin(rot)),
    hh: Math.hypot(rx * Math.sin(rot), ry * Math.cos(rot)),
  };
}

interface BaseSpec {
  name: string;
  speed: number;
}
interface PatternSpec extends BaseSpec {
  rows: number;
  counts: number[];
  shape: (row: number, idx: number) => "circle" | "eh" | "ev";
  hp: (row: number, idx: number) => 1 | 2 | 3;
}
interface LayoutItem {
  /** x — в единицах cell от центра поля, y — в единицах cell от верха зоны */
  x: number;
  y: number;
  rx: number;
  ry?: number;
  /** наклон эллипса в радианах */
  rot?: number;
  hp: 1 | 2 | 3;
  bomb?: boolean;
  splits?: boolean;
}
interface LayoutSpec extends BaseSpec {
  layout: LayoutItem[];
}
interface BossSpec extends BaseSpec {
  boss: { hp: number; minions: number; bombs: number };
}
type LevelSpec = PatternSpec | LayoutSpec | BossSpec;

/** Плотная «стрела/ракета» остриём вниз: крылья-овалы, нос, стабилизаторы, матрёшки. */
const L1_LAYOUT: LayoutItem[] = [
  // верхняя полоса мелких шаров
  ...[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((i) => ({
    x: i,
    y: 0,
    rx: 0.46,
    hp: 1 as const,
  })),
  // широкие «крылья» — наклонённые овалы (стреловидные)
  { x: -4.2, y: 1.9, rx: 1.35, ry: 0.55, rot: -0.38, hp: 2 },
  { x: 4.2, y: 1.9, rx: 1.35, ry: 0.55, rot: 0.38, hp: 2 },
  { x: -4.9, y: 3.1, rx: 1.15, ry: 0.5, rot: -0.32, hp: 2 },
  { x: 4.9, y: 3.1, rx: 1.15, ry: 0.5, rot: 0.32, hp: 2 },
  // корпус стрелы: треугольник из шаров
  { x: 0, y: 1.5, rx: 0.5, hp: 2 },
  { x: -1, y: 1.5, rx: 0.5, hp: 2 },
  { x: 1, y: 1.5, rx: 0.5, hp: 2 },
  { x: -2, y: 1.5, rx: 0.5, hp: 2 },
  { x: 2, y: 1.5, rx: 0.5, hp: 2 },
  { x: -1.5, y: 2.6, rx: 0.5, hp: 2 },
  { x: -0.5, y: 2.6, rx: 0.5, hp: 2 },
  { x: 0.5, y: 2.6, rx: 0.5, hp: 2 },
  { x: 1.5, y: 2.6, rx: 0.5, hp: 2 },
  { x: -1, y: 3.7, rx: 0.5, hp: 3 },
  { x: 0, y: 3.7, rx: 0.5, hp: 3 },
  { x: 1, y: 3.7, rx: 0.5, hp: 3 },
  { x: -0.5, y: 4.8, rx: 0.5, hp: 3 },
  { x: 0.5, y: 4.8, rx: 0.5, hp: 3 },
  // крупный вертикальный «нос»-остриё
  { x: 0, y: 6.3, rx: 0.58, ry: 1.2, hp: 3 },
  // малые вертикальные «стабилизаторы»
  { x: -3.5, y: 4.6, rx: 0.42, ry: 0.8, rot: -0.28, hp: 1 },
  { x: 3.5, y: 4.6, rx: 0.42, ry: 0.8, rot: 0.28, hp: 1 },
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
  // «матрёшки» с россыпью
  { x: -2.7, y: 5.4, rx: 0.6, hp: 2, splits: true },
  { x: 2.7, y: 5.4, rx: 0.6, hp: 2, splits: true },
  { x: -4.6, y: 0.9, rx: 0.55, hp: 2, splits: true },
  { x: 4.6, y: 0.9, rx: 0.55, hp: 2, splits: true },
];

const LEVELS: LevelSpec[] = [
  { name: "СТРЕЛА", speed: 400, layout: L1_LAYOUT },
  {
    name: "ОВАЛЬНЫЙ РИФ",
    rows: 6,
    counts: [7, 8, 9, 9, 8, 7],
    shape: (_r, i) => (i % 3 === 0 ? "eh" : i % 3 === 1 ? "circle" : "ev"),
    hp: (r, _i) => (r < 2 ? 3 : r < 4 ? 2 : 1),
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
    boss: { hp: 30, minions: 4, bombs: 4 },
  },
];

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: HudData) => void;
  private raf = 0;
  private last = 0;
  private time = 0;
  private destroyed = false;

  private w = 960;
  private h = 640;
  private dpr = 1;

  private phase: Phase = "menu";
  private score = 0;
  private best = 0;
  private newRecord = false;
  private lives = 3;
  private level = 1;
  private combo = 0;
  private banner: string | null = null;
  private bannerTimer = 0;
  private transition = 0;

  private paddle = { x: 480, y: 600, w: 128, h: 18, baseW: 128, vx: 0, squash: 0 };
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
  /** pointer lock активен: управление дельтами мыши за пределами экрана */
  private locked = false;
  private lockFailed = false;
  private virtualX: number | null = null;
  private shake = 0;
  private hitStop = 0;
  private flash = 0;
  private countdown = 0;
  private tapFire = false;

  private wideUntil = 0;
  private slowUntil = 0;
  private fastUntil = 0;
  private shrinkUntil = 0;
  private laserUntil = 0;
  private rocketUntil = 0;
  private shield = 0;
  private weaponCd = 0;
  private effectsKey = "";

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
  /** был ли луч в фазе «вкл» на прошлом тике (для фронта импульса) */
  private laserWasOn = false;
  /** бонус взведён, но залп ещё не начат; сгорает через laserArmedUntil */
  private laserArmed = false;
  private laserArmedUntil = 0;

  /** таймер периодического появления новых блоков */
  private spawnTimer = 18;
  /** таймер периодического «небесного» сброса бонусов */
  private skyDropTimer = 22;
  private magnetUntil = 0;
  /** таймер редкого смещения всего поля */
  private shiftTimer = 14;
  /** активная плавная анимация сдвига поля */
  private fieldShift: { dx: number; dy: number; t: number; dur: number } | null = null;
  /** сколько блоков было в начале уровня — для нарастания скорости шара */
  private blocksInitial = 1;

  /* ----- валюта и прокачка (механика заготовлена, не активирована) ----- */
  private coins = 0;
  private upgrades: Record<string, number> = {};

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
      this.topEndless = Array.isArray(parsedE)
        ? (parsedE as number[]).filter((n) => typeof n === "number")
        : [];
    } catch {
      this.topEndless = [];
    }
    this.loadProgress();
  }

  /* ---------- сохранение валюты/прокачки ---------- */

  private loadProgress() {
    try {
      this.coins = Math.max(0, Number(localStorage.getItem("sharoboy-coins") || 0) || 0);
      const up = JSON.parse(localStorage.getItem("sharoboy-upgrades") || "{}") as unknown;
      this.upgrades = up && typeof up === "object" ? (up as Record<string, number>) : {};
    } catch {
      this.coins = 0;
      this.upgrades = {};
    }
  }

  private saveProgress() {
    try {
      localStorage.setItem("sharoboy-coins", String(this.coins));
      localStorage.setItem("sharoboy-upgrades", JSON.stringify(this.upgrades));
    } catch {
      /* ignore */
    }
  }

  private addCoins(n: number) {
    this.coins += n;
    this.saveProgress();
    this.pushHud();
  }

  /** Покупка постоянного улучшения — будет вызываться из будущего UI прокачки. */
  buyUpgrade(id: string): boolean {
    const def = UPGRADE_DEFS.find((d) => d.id === id);
    if (!def) return false;
    const lvl = this.upgrades[id] ?? 0;
    if (lvl >= def.max) return false;
    const price = def.cost(lvl);
    if (this.coins < price) return false;
    this.coins -= price;
    this.upgrades[id] = lvl + 1;
    this.saveProgress();
    this.applyUpgrades();
    this.pushHud();
    return true;
  }

  /** Пересобирает производные характеристики из уровней улучшений.
   *  Определений пока нет — место для будущей логики прокачки. */
  private applyUpgrades() {
    for (const def of UPGRADE_DEFS) {
      const lvl = this.upgrades[def.id] ?? 0;
      if (lvl <= 0) continue;
      // здесь каждый def.id будет менять характеристики
      // (база ширины ракетки, скорость шара, шанс дропа и т.п.)
    }
  }

  /* ---------- lifecycle ---------- */

  attach() {
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("mousemove", this.handlePointerMove);
    document.addEventListener("pointerlockchange", this.handleLockChange);
    document.addEventListener("pointerlockerror", this.handleLockError);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.handleResize();
    this.spawnBubbles();
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
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("mousemove", this.handlePointerMove);
    document.removeEventListener("pointerlockchange", this.handleLockChange);
    document.removeEventListener("pointerlockerror", this.handleLockError);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
  }

  private loop = (t: number) => {
    if (this.destroyed) return;
    const dtRaw = clamp((t - this.last) / 1000, 0, 0.033);
    this.last = t;
    // hit-stop: время на миг замедляется на самых сочных событиях
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dtRaw);
    const dt = this.hitStop > 0 ? dtRaw * 0.18 : dtRaw;
    this.time += dt;
    this.flash = Math.max(0, this.flash - dtRaw * 2.6);
    try {
      this.update(dt);
      this.draw();
    } catch (err) {
      // страховка: единичная ошибка не должна намертво останавливать игру
      console.error("[ШАРОБОЙ] ошибка в игровом цикле:", err);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private handleResize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    const p = this.paddle;
    p.baseW = clamp(this.w * 0.15, 96, 170);
    p.h = clamp(p.baseW * 0.15, 14, 20);
    p.y = this.h - 56;
    p.x = clamp(p.x, p.w / 2, this.w - p.w / 2);
    if (this.blocks.length > 0 && (this.phase === "playing" || this.phase === "paused")) {
      // вписываем блоки в новую область
      const sx = this.w / (this.prevW || this.w);
      const sy = this.h / (this.prevH || this.h);
      for (const b of this.blocks) {
        b.x = clamp(b.x * sx, b.rx + 6, this.w - b.rx - 6);
        b.x0 = clamp(b.x0 * sx, b.rx + 6, this.w - b.rx - 6);
        b.y = clamp(b.y * sy, b.ry + 6, this.h * 0.75);
      }
    }
    this.prevW = this.w;
    this.prevH = this.h;
  };
  private prevW = 0;
  private prevH = 0;

  private spawnBubbles() {
    this.bubbles = [];
    const n = Math.floor(clamp(this.w / 70, 8, 20));
    for (let i = 0; i < n; i++) {
      this.bubbles.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        r: rand(2, 7),
        vy: rand(14, 42),
        a: rand(0.04, 0.14),
      });
    }
  }

  /* ---------- ввод ---------- */

  private handleKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (["ArrowLeft", "ArrowRight", "Space"].includes(c)) e.preventDefault();
    this.sfx.ensure();
    if (c === "ArrowLeft" || c === "KeyA") this.keys.left = true;
    if (c === "ArrowRight" || e.code === "KeyD") this.keys.right = true;
    if (c === "Space") this.keys.space = true;
    if (c === "KeyP" || c === "Escape") {
      if (this.phase === "playing" || this.phase === "paused") this.togglePause();
      return;
    }
    if (c === "KeyM") {
      this.toggleMute();
      return;
    }
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

  private handlePointerMove = (e: PointerEvent | MouseEvent) => {
    if (this.locked) {
      // курсор захвачен: ракетка следует за дельтами движения,
      // где бы физически ни находилась мышь — хоть за краем экрана
      const vx = (this.virtualX ?? this.paddle.x) + e.movementX;
      this.virtualX = clamp(vx, 0, this.w);
      this.pointerX = this.virtualX;
      return;
    }
    this.pointerX = e.clientX;
  };

  /** Окно потеряло фокус: отпускаем «залипшие» клавиши и указатель. */
  private handleBlur = () => {
    this.keys.left = false;
    this.keys.right = false;
    this.keys.space = false;
    this.pointerX = null;
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.sfx.ensure();
    this.pointerX = e.clientX;
    this.virtualX = e.clientX;
    this.tapFire = true;
    if (this.phase === "playing") {
      this.launch();
      this.requestLock();
    }
  };

  /* -------- захват курсора (pointer lock): управление за краем экрана -------- */

  private requestLock() {
    if (this.locked) return;
    try {
      const el = this.canvas as HTMLCanvasElement & {
        requestPointerLock?: () => Promise<void> | void;
      };
      if (typeof el.requestPointerLock !== "function") {
        this.lockFailed = true;
        return;
      }
      const res = el.requestPointerLock();
      if (res && typeof (res as Promise<void>).catch === "function") {
        (res as Promise<void>).catch(() => {
          this.lockFailed = true;
        });
      }
    } catch {
      // захват недоступен (sandbox/iframe) — остаёмся в обычном режиме
      this.lockFailed = true;
    }
  }

  private releaseLock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock?.();
    } catch {
      /* игнорируем */
    }
  }

  private handleLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (this.locked) {
      this.lockFailed = false;
      this.virtualX = this.pointerX ?? this.paddle.x;
    } else if (this.virtualX !== null) {
      // после Esc/паузы ракетка остаётся там, где её оставил виртуальный курсор
      this.pointerX = this.virtualX;
    }
  };

  private handleLockError = () => {
    this.lockFailed = true;
  };

  /* ---------- публичное API для React ---------- */

  startGame() {
    this.sfx.ensure();
    this.sfx.ui();
    this.mode = "campaign";
    this.wave = 0;
    this.waveSpec = null;
    this.boss = null;
    this.boomQueue = [];
    this.fireUntil = 0;
    this.magnetUntil = 0;
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
    this.laserArmed = false;
    this.rocketUntil = 0;
    this.fireUntil = 0;
    this.magnetUntil = 0;
    this.shield = 0;
    this.weaponCd = 0;
    this.effectsKey = "";
    this.transition = 0;
    this.buildLevel(1);
    this.applyUpgrades();
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
    this.laserArmed = false;
    this.rocketUntil = 0;
    this.fireUntil = 0;
    this.magnetUntil = 0;
    this.shield = 0;
    this.weaponCd = 0;
    this.effectsKey = "";
    this.transition = 0;
    this.buildWave(1);
    this.applyUpgrades();
    this.serveBall();
    this.phase = "playing";
    this.setBanner("БЕСКОНЕЧНЫЙ РЕЖИМ — ВОЛНА 1");
    this.pushHud();
  }

  toMenu() {
    this.sfx.ui();
    this.releaseLock();
    this.phase = "menu";
    this.balls = [];
    this.blocks = [];
    this.powers = [];
    this.projectiles = [];
    this.boss = null;
    this.boomQueue = [];
    this.banner = null;
    // полная зачистка транзиентных эффектов — в меню ничего не должно
    // «доживать» (зависшие попапы «ЧИСТО!», частицы, кольца, тряска)
    this.popups = [];
    this.particles = [];
    this.rings = [];
    this.shake = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.bannerTimer = 0;
    this.pushHud();
  }

  togglePause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.keys.space = false;
      this.releaseLock();
      this.sfx.ui();
    } else if (this.phase === "paused") {
      this.phase = "playing";
      this.countdown = 1.4;
      this.sfx.ui();
    }
    this.pushHud();
  }

  toggleMute() {
    this.sfx.muted = !this.sfx.muted;
    this.pushHud();
  }

  /* ---------- состояния ---------- */

  private setBanner(text: string) {
    this.banner = text;
    this.bannerTimer = 1.6;
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
    const blocks: Block[] = [];

    if ("layout" in spec) {
      // авторская раскладка: координаты в единицах cell от центра (x) и верха зоны (y)
      const xs = spec.layout.map((it) => Math.abs(it.x) + it.rx);
      const maxX = Math.max(...xs);
      const cell = Math.min((this.w - margin * 2) / (maxX * 2), this.h * 0.075);
      const ys = spec.layout.map((it) => it.y + (it.ry ?? it.rx));
      const maxY = Math.max(...ys);
      const zoneH = clamp(this.h * 0.42, 220, 420);
      const cellY = Math.min(cell, zoneH / maxY);
      for (const it of spec.layout) {
        const rx = Math.max(it.rx * cell, 8);
        const ry = Math.max((it.ry ?? it.rx) * cellY, 8);
        const cx = clamp(this.w / 2 + it.x * cell, margin * 0.5 + rx, this.w - margin * 0.5 - rx);
        blocks.push({
          x: cx,
          y: top + it.y * cellY,
          rx,
          ry,
          rot: it.rot ?? 0,
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
          splits: it.splits ?? false,
        });
      }
      this.blocks = blocks;
      this.blocksInitial = Math.max(1, blocks.length);
      return;
    }

    // процедурная сетка с плотной кладкой
    const zoneH = clamp(this.h * 0.42, 220, 420);
    const gap = zoneH / spec.rows;
    for (let r = 0; r < spec.rows; r++) {
      let count = spec.counts[r % spec.counts.length];
      while ((this.w - margin * 2) / count < 60 && count > 3) count--;
      const slot = (this.w - margin * 2) / count;
      for (let i = 0; i < count; i++) {
        const kind = spec.shape(r, i);
        const isBomb = Math.random() < 0.07;
        const isSplit = !isBomb && Math.random() < 0.09;
        const hp = (isBomb ? 1 : spec.hp(r, i)) as 1 | 2 | 3;
        const cx = clamp(
          margin + slot * (i + 0.5) + rand(-1, 1) * slot * 0.02,
          margin + slot * 0.3,
          this.w - margin - slot * 0.3
        );
        const cy = top + gap * (r + 0.5) + rand(-1, 1) * gap * 0.02;
        let rx: number;
        let ry: number;
        if (kind === "circle" || isBomb) {
          // бомбы — только круглые; диаметры почти касаются соседей (плотная кладка)
          const rr = clamp(Math.min(slot * 0.5, gap * 0.44) * rand(0.9, 1), 12, 42);
          rx = ry = rr;
        } else if (kind === "eh") {
          rx = clamp(slot * 0.52 * rand(0.9, 1), 18, 60);
          ry = clamp(gap * 0.3 * rand(0.9, 1), 11, 27);
        } else {
          rx = clamp(slot * 0.27 * rand(0.9, 1), 10, 26);
          ry = clamp(gap * 0.47 * rand(0.9, 1), 15, 46);
        }
        // овалы наклонены под случайным углом (укладываются в ячейку)
        const rot =
          kind !== "circle" && !isBomb && Math.random() < 0.65
            ? fitTilt(rx, ry, slot / 2 - 4, gap / 2 - 4)
            : 0;
        blocks.push({
          x: cx,
          y: cy,
          rx,
          ry,
          rot,
          circle: kind === "circle" || isBomb,
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
          splits: isSplit,
          dead: false,
        });
      }
    }
    this.blocks = blocks;
    this.blocksInitial = Math.max(1, blocks.length);
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
        rot: 0,
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
        splits: false,
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
        rot: 0,
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
        splits: false,
      });
    }
    this.blocks = blocks;
    this.blocksInitial = Math.max(1, blocks.length);
  }

  private levelSpeed() {
    return this.mode === "endless" ? this.waveSpec?.speed ?? 400 : LEVELS[this.level - 1].speed;
  }

  private levelDisplayName() {
    return this.mode === "endless" ? this.waveSpec?.name ?? "ВОЛНА" : LEVELS[this.level - 1].name;
  }

  private serveBall() {
    // базовая скорость повышена на 50% по просьбе игрока
    const base = clamp(
      Math.min(
        this.h * 0.62,
        (this.levelSpeed() + (this.mode === "endless" ? this.wave * 18 : this.level * 45)) * 1.5
      ),
      540,
      1140
    );
    const ball: Ball = {
      x: this.paddle.x,
      y: this.paddle.y - this.paddle.h / 2 - 12,
      vx: 0,
      vy: 0,
      r: clamp(Math.min(this.w, this.h) * 0.014, 8, 12),
      speed: base,
        stuck: true,
        stuckOffset: 0,
        trail: [],
        squash: 0,
        sinceHit: 0,    };
    this.balls = [ball];
    this.spawnTimer = rand(16, 22);
    this.skyDropTimer = rand(18, 27);
    this.shiftTimer = rand(12, 18);
    this.fieldShift = null;
    this.pushHud();
  }

  private launch() {
    let launched = false;
    for (const b of this.balls) {
      if (b.stuck) {
        b.stuck = false;
        // угол зависит от позиции на ракетке — магнитом можно целиться
        const rel = clamp(b.stuckOffset / (this.paddle.w / 2), -1, 1);
        const ang = -Math.PI / 2 + rel * 0.95 + rand(-0.05, 0.05);
        b.vx = Math.cos(ang) * b.speed;
        b.vy = Math.sin(ang) * b.speed;
        launched = true;
      }
    }
    if (launched) {
      this.sfx.launch();
      this.pushHud();
    }
  }

  /* ---------- апдейт ---------- */

  private update(dt: number) {
    // фон живёт всегда
    for (const b of this.bubbles) {
      b.y -= b.vy * dt;
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
      // ввод на выстрел читается ровно один раз за кадр —
      // лазер и ракеты больше не могут «украсть» нажатие друг у друга
      const wantFire = this.keys.space || this.tapFire;
      this.tapFire = false;
      this.tryFire(dt, wantFire);
      this.updateLaser(wantFire);
      this.periodicSpawn(dt);
      this.periodicPowerDrop(dt);
      this.periodicShift(dt);
      this.updateProjectiles(dt);
      for (const ball of this.balls) this.updateBall(ball, dt);
      this.balls = this.balls.filter((b) => !(b as Ball & { lost?: boolean }).lost);
      if (this.balls.length === 0) this.onAllBallsLost();
    }

    // живые ряды: мягкое покачивание блоков (узорные уровни)
    for (const b of this.blocks) {
      if (b.minionOrbit && this.boss) {
        const o = b.minionOrbit;
        o.ang += o.speed * o.dir * dt * (this.boss.hp < this.boss.maxHp * 0.4 ? 1.7 : 1);
        b.x = clamp(
          this.boss.x + Math.cos(o.ang) * o.rad,
          b.rx + 4,
          this.w - b.rx - 4
        );
        b.y = clamp(this.boss.y + Math.sin(o.ang) * o.rad * 0.55, b.ry + 4, this.h * 0.8);
        b.x0 = b.x;
      } else if (b.swayAmp > 0) {
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
        this.serveBall();
      }
    }

    // частицы / кольца / попапы
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.t += dt * 3;
      r.r = 4 + r.maxR * r.t;
    }
    this.rings = this.rings.filter((r) => r.t < 1);
    for (const p of this.popups) {
      p.t += dt;
    }
    this.popups = this.popups.filter((p) => p.t < 1);

    this.shake = Math.max(0, this.shake - dt * 26);

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
    p.w += (targetW - p.w) * (1 - Math.exp(-dt * 8));

    const prevX = p.x;
    const accel = 5200;
    const maxV = 1500;
    if (this.keys.left && !this.keys.right) {
      p.vx = Math.max(p.vx - accel * dt, -maxV);
    } else if (this.keys.right && !this.keys.left) {
      p.vx = Math.min(p.vx + accel * dt, maxV);
    } else if (this.pointerX !== null) {
      // при захваченном курсоре отклик практически мгновенный
      const k = 1 - Math.exp(-dt * (this.locked ? 44 : 26));
      p.x += (this.pointerX - p.x) * k;
      p.vx = (p.x - prevX) / Math.max(dt, 1e-4);
      return;
    } else {
      p.vx *= Math.exp(-dt * 10);
    }
    p.x += p.vx * dt;
    p.x = clamp(p.x, p.w / 2 + 4, this.w - p.w / 2 - 4);
    p.squash = Math.max(0, p.squash - dt * 5);
  }

  private updateBall(ball: Ball, dt: number) {
    if (ball.stuck) {
      ball.x = this.paddle.x + ball.stuckOffset;
      ball.y = this.paddle.y - this.paddle.h / 2 - ball.r - 2;
      return;
    }

    ball.sinceHit += dt;

    // субстепы против туннелирования
    const speed = Math.hypot(ball.vx, ball.vy) || 1;
    const steps = Math.max(1, Math.ceil((speed * dt) / (ball.r * 0.8)));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;

      // стены; лёгкий случайный подброс по вертикали, чтобы траектория не «застревала»
      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
        ball.vy += rand(-1, 1) * speed * 0.06;
        ball.squash = 1;
        this.sfx.wall();
      }
      if (ball.x + ball.r > this.w) {
        ball.x = this.w - ball.r;
        ball.vx = -Math.abs(ball.vx);
        ball.vy += rand(-1, 1) * speed * 0.06;
        ball.squash = 1;
        this.sfx.wall();
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
        ball.squash = 1;
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

    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 12) ball.trail.shift();

    ball.squash = Math.max(0, ball.squash - dt * 6);

    // страховка от горизонтального зацикливания
    const sp0 = Math.hypot(ball.vx, ball.vy) || 1;
    if (Math.abs(ball.vy) < sp0 * 0.16) {
      const sign = ball.vy === 0 ? -1 : Math.sign(ball.vy);
      ball.vy = sign * sp0 * 0.22;
      const nx = Math.sqrt(Math.max(sp0 * sp0 - ball.vy * ball.vy, 0));
      ball.vx = Math.sign(ball.vx || 1) * nx;
    }

    // «ленивый» шар: долго ни с чем не сталкивался — мягко доворачиваем к вертикали
    if (ball.sinceHit > 4) {
      const sp = Math.hypot(ball.vx, ball.vy) || 1;
      const excess = Math.min(ball.sinceHit - 4, 4);
      const k = 1 - Math.exp(-dt * (0.6 + excess * 0.5));
      const targetVy = (Math.sign(ball.vy) || -1) * sp * 0.5;
      ball.vy += (targetVy - ball.vy) * k;
      const c = sp / (Math.hypot(ball.vx, ball.vy) || 1);
      ball.vx *= c;
      ball.vy *= c;
    }

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

    // режимы скорости шара (замедление / ускорение от бонусов + прогресс уровня)
    const progress = 1 - this.blocks.length / this.blocksInitial;
    const progBoost = 1 + clamp(progress, 0, 1) * 0.24;
    const mult =
      (this.time < this.slowUntil ? 0.72 : this.time < this.fastUntil ? 1.32 : 1) * progBoost;
    const cur = Math.hypot(ball.vx, ball.vy) || 1;
    const target = ball.speed * mult;
    if (Math.abs(cur - target) > 1) {
      ball.vx = (ball.vx / cur) * target;
      ball.vy = (ball.vy / cur) * target;
    }
  }

  private collidePaddle(ball: Ball) {
    const p = this.paddle;
    const top = p.y - p.h / 2;
    if (ball.vy <= 0) return;
    if (
      ball.y + ball.r >= top &&
      ball.y - ball.r <= p.y + p.h / 2 &&
      ball.x >= p.x - p.w / 2 - ball.r &&
      ball.x <= p.x + p.w / 2 + ball.r
    ) {
      const rel = clamp((ball.x - p.x) / (p.w / 2), -1, 1);
      // магнит: шар прилипает к ракетке вместо отскока
      if (this.time < this.magnetUntil && !ball.stuck) {
        ball.stuck = true;
        ball.stuckOffset = clamp(ball.x - p.x, -p.w / 2 + ball.r, p.w / 2 - ball.r);
        ball.vx = 0;
        ball.vy = 0;
        ball.squash = 1;
        ball.sinceHit = 0;
        this.sfx.paddle(Math.abs(rel));
        this.burst(ball.x, top, "#4dff9e", 8, 140);
        return;
      }
      const ang = rel * 1.05 - Math.PI / 2; // до ±60°
      const sp = ball.speed * (this.time < this.slowUntil ? 0.72 : this.time < this.fastUntil ? 1.32 : 1);
      ball.vx = Math.cos(ang) * sp + p.vx * 0.18;
      ball.vy = Math.sin(ang) * sp;
      ball.y = top - ball.r - 0.5;
      ball.squash = 1;
      ball.sinceHit = 0;
      p.squash = 1;
      this.combo = 0;
      this.sfx.paddle(Math.abs(rel));
      this.burst(ball.x, top, "#7cf5ff", 5, 130);
      this.pushHud();
    }
  }

  private collideBlocks(ball: Ball) {
    const fire = this.time < this.fireUntil;
    for (const b of this.blocks) {
      if (b.dead) continue;
      const ex = b.rx + ball.r;
      const ey = b.ry + ball.r;
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;

      // переводим в локальную систему повёрнутого эллипса
      const cs = Math.cos(b.rot);
      const sn = Math.sin(b.rot);
      const lx = dx * cs + dy * sn;
      const ly = -dx * sn + dy * cs;
      const q = (lx * lx) / (ex * ex) + (ly * ly) / (ey * ey);
      if (q > 1) continue;

      // нормаль через градиент эллипса (в локальных осях), затем обратно в мир
      let nx = lx / (ex * ex);
      let ny = ly / (ey * ey);
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      const wnx = nx * cs - ny * sn;
      const wny = nx * sn + ny * cs;
      // выталкиваем к границе эллипса
      const sc = 1 / Math.sqrt(Math.max(q, 1e-6));
      const plx = lx * sc;
      const ply = ly * sc;
      ball.x = b.x + plx * cs - ply * sn + wnx * 0.8;
      ball.y = b.y + plx * sn + ply * cs + wny * 0.8;
      ball.sinceHit = 0;
      if (!fire) {
        const dot = ball.vx * wnx + ball.vy * wny;
        if (dot < 0) {
          ball.vx -= 2 * dot * wnx;
          ball.vy -= 2 * dot * wny;
        }
        this.damageBlock(b);
        return;
      }
      // огненное ядро прожигает блоки насквозь
      this.sfx.burn();
      this.damageBlock(b, 2);
    }
  }

  private collideBoss(ball: Ball) {
    const bo = this.boss;
    if (!bo || ball.stuck) return;
    const dx = ball.x - bo.x;
    const dy = ball.y - bo.y;
    const dist = Math.hypot(dx, dy);
    const min = bo.r + ball.r;
    if (dist >= min) return;
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    ball.x = bo.x + nx * (min + 1);
    ball.y = bo.y + ny * (min + 1);
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
    }
    ball.squash = 1;
    // шар отскакивает от босса, поэтому каждый прилёт — полноценный удар;
    // маленькая заслонка страхует лишь от двойного засчёта на субстепах
    if (ball.sinceHit > 0.03) {
      ball.sinceHit = 0;
      this.damageBoss(this.time < this.fireUntil ? 3 : 2, false);
    }
  }

  /* ---------------- босс ---------------- */

  private updateBoss(dt: number) {
    const bo = this.boss;
    if (!bo) return;
    bo.t += dt;
    bo.flash = Math.max(0, bo.flash - dt * 4);
    const angry = bo.hp < bo.maxHp * 0.4;
    const amp = clamp(this.w * 0.26, 120, 420);
    bo.x = this.w / 2 + Math.sin(bo.t * (angry ? 1.1 : 0.6)) * amp;
    bo.y = bo.baseY + Math.sin(bo.t * 1.7) * 22;

    bo.dropTimer -= dt;
    if (bo.dropTimer <= 0) {
      bo.dropTimer = angry ? 3.6 : 5;
      const types: PowerType[] = ["wide", "shield", "laser", "rocket", "multi"];
      this.powers.push({
        x: bo.x,
        y: bo.y + bo.r + 10,
        vy: 150,
        type: types[Math.floor(Math.random() * types.length)],
        t: 0,
      });
    }
  }

  private damageBoss(dmg: number, fromWeapon: boolean) {
    const bo = this.boss;
    if (!bo) return;
    if (fromWeapon && this.time < this.bossHitCd) return;
    this.bossHitCd = this.time + 0.08;
    bo.hp -= dmg;
    bo.flash = 1;
    this.sfx.brick(3);
    this.burst(bo.x + rand(-bo.r * 0.5, bo.r * 0.5), bo.y + rand(-bo.r * 0.3, bo.r * 0.3), "#ff5ca8", 8, 200);
    this.score += 5;
    if (bo.hp <= 0) {
      this.killBoss();
    } else {
      this.pushHud();
    }
  }

  private killBoss() {
    const bo = this.boss;
    if (!bo) return;
    this.boss = null;
    this.score += 1500;
    this.hitStop = Math.max(this.hitStop, 0.5);
    this.flash = 1;
    this.shake = Math.min(this.shake + 14, 18);
    this.sfx.bossDie();
    this.burst(bo.x, bo.y, "#ff5ca8", 40, 420);
    this.burst(bo.x, bo.y, "#ffc94d", 26, 320);
    this.rings.push({ x: bo.x, y: bo.y, r: 10, maxR: 320, color: "rgba(255,92,168,0.9)", t: 0 });
    this.popups.push({ x: bo.x, y: bo.y, text: "+1500", color: "#ffc94d", t: 0, size: 30 });
    // миньоны и оставшиеся бомбы разлетаются цепочкой взрывов —
    // поле после победы босса зачищается полностью
    let i = 0;
    for (const b of [...this.blocks]) {
      if (b.minionOrbit || b.bomb) {
        this.boomQueue.push({ x: b.x, y: b.y, at: this.time + 0.12 + i * 0.1 });
        b.hp = 0;
        b.dead = true;
        i++;
      }
    }
    this.blocks = this.blocks.filter((b) => !b.dead);
    // прощальные подарки
    this.powers.push({ x: bo.x - 40, y: bo.y, vy: 140, type: "multi", t: 0 });
    this.powers.push({ x: bo.x + 40, y: bo.y, vy: 140, type: "wide", t: 0 });
    this.pushHud();
  }

  /* ---------------- периодические события поля ---------------- */

  /** «Матрёшка»: вокруг разбитого блока рассыпаются шары покрупнее (3–10 шт). */
  private spawnScatter(b: Block) {
    if (this.blocks.length > 150) return;
    const n = 3 + Math.floor(rand(0, 8)); // 3..10
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.4, 0.4);
      const d = Math.max(b.rx, b.ry) * rand(1.7, 2.4);
      const r = rand(17, 23);
      const cx = clamp(b.x + Math.cos(a) * d, r + 6, this.w - r - 6);
      const cy = clamp(b.y + Math.sin(a) * d, r + 6, this.h * 0.72);
      this.blocks.push({
        x: cx,
        y: cy,
        rx: r,
        ry: r,
        rot: 0,
        circle: true,
        hp: 1,
        maxHp: 1,
        tier: 1,
        flash: 1,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: cx,
        swayAmp: 0,
        swayFreq: 0,
        swayPh: 0,
        bomb: false,
        splits: false,
      });
    }
    this.popups.push({ x: b.x, y: b.y, text: "РАССЫПЬ!", color: "#5dffb0", t: 0, size: 16 });
    this.rings.push({ x: b.x, y: b.y, r: 8, maxR: 90, color: "rgba(93,255,176,0.7)", t: 0 });
    this.burst(b.x, b.y, "#5dffb0", 10, 200);
  }

  /** Периодически в произвольном месте верхней зоны появляются новые блоки. */
  private periodicSpawn(dt: number) {
    if (this.boss) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = rand(16, 22);
    const cap = Math.min(this.blocksInitial + 12, 150);
    if (this.blocks.length >= cap) return;
    const kinds = ["circle", "eh", "ev"] as const;
    for (let attempt = 0; attempt < 7; attempt++) {
      const kind = kinds[Math.floor(rand(0, 3))];
      const rx = kind === "circle" ? rand(14, 26) : kind === "eh" ? rand(26, 44) : rand(12, 20);
      const ry = kind === "circle" ? rx : kind === "eh" ? rand(12, 20) : rand(24, 38);
      const rot = kind === "circle" ? 0 : fitTilt(rx, ry, 56, 52);
      const ext = rotatedExtents(rx, ry, rot);
      const x = rand(ext.hw + 12, this.w - ext.hw - 12);
      const y = rand(ext.hh + 70, this.h * 0.5);
      let overlaps = false;
      for (const b of this.blocks) {
        const be = rotatedExtents(b.rx, b.ry, b.rot);
        if (Math.abs(x - b.x) < be.hw + ext.hw + 8 && Math.abs(y - b.y) < be.hh + ext.hh + 8) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      // спавн — в основном одноразовые блоки, чтобы не затягивать зачистку
      const roll = Math.random();
      const hp = (roll < 0.78 ? 1 : roll < 0.95 ? 2 : 3) as 1 | 2 | 3;
      this.blocks.push({
        x,
        y,
        rx,
        ry,
        rot,
        circle: kind === "circle",
        hp,
        maxHp: hp,
        tier: hp,
        flash: 1,
        seed: rand(0, Math.PI * 2),
        dead: false,
        x0: x,
        swayAmp: rand(4, 10),
        swayFreq: rand(0.5, 1) * (Math.random() < 0.5 ? 1 : -1),
        swayPh: rand(0, Math.PI * 2),
        bomb: false,
        splits: false,
      });
      this.rings.push({ x, y, r: 6, maxR: 66, color: "rgba(124,245,255,0.7)", t: 0 });
      this.popups.push({ x, y: y - ry - 8, text: "ПОПОЛНЕНИЕ!", color: "#7cf5ff", t: 0, size: 14 });
      this.sfx.ui();
      return;
    }
  }

  /** Редко всё поле плавно сдвигается в случайную сторону (не выходя за экран). */
  private periodicShift(dt: number) {
    if (this.blocks.length === 0) return;

    // доводим начатый дрейф до конца: блоки едут по smoothstep-кривой
    if (this.fieldShift) {
      const fs = this.fieldShift;
      const p0 = clamp(fs.t / fs.dur, 0, 1);
      fs.t += dt;
      const p1 = clamp(fs.t / fs.dur, 0, 1);
      const ease = (p: number) => p * p * (3 - 2 * p);
      const f = ease(p1) - ease(p0);
      if (f > 0) {
        for (const b of this.blocks) {
          if (b.minionOrbit) continue;
          b.x = clamp(b.x + fs.dx * f, b.rx + 8, this.w - b.rx - 8);
          b.x0 = clamp(b.x0 + fs.dx * f, b.rx + 8, this.w - b.rx - 8);
          b.y = clamp(b.y + fs.dy * f, b.ry + 64, this.h * 0.78);
        }
      }
      if (fs.t >= fs.dur) this.fieldShift = null;
      return;
    }

    this.shiftTimer -= dt;
    if (this.shiftTimer > 0) return;
    this.shiftTimer = rand(12, 18);
    const ang = rand(0, Math.PI * 2);
    const mag = rand(22, 40);
    let dx = Math.cos(ang) * mag;
    let dy = Math.sin(ang) * mag * 0.6;
    // заранее не даём полю вылезти за экран
    for (const b of this.blocks) {
      if (b.minionOrbit) continue;
      const nx = b.x + dx;
      const ny = b.y + dy;
      dx = clamp(dx, b.rx + 8 - nx, this.w - b.rx - 8 - nx);
      dy = clamp(dy, b.ry + 64 - ny, this.h * 0.78 - ny);
    }
    this.fieldShift = { dx, dy, t: 0, dur: rand(0.6, 0.9) };
    this.popups.push({
      x: this.w / 2,
      y: this.h * 0.3,
      text: "СДВИГ ПОЛЯ",
      color: "#9fd6ea",
      t: 0,
      size: 18,
    });
    this.shake = Math.min(this.shake + 2, 6);
    this.sfx.ui();
  }

  private damageBlock(b: Block, dmg = 1) {
    b.hp -= dmg;
    b.flash = 1;
    if (b.hp > 0) {
      this.sfx.brick(b.hp);
      this.burst(b.x, b.y, TIER[b.tier].base, 4, 140);
      this.score += 5;
      this.pushHud();
      return;
    }
    b.dead = true;
    this.blocks = this.blocks.filter((x) => !x.dead);
    if (b.splits) this.spawnScatter(b);
    if (b.bomb && !b.boomQueued) {
      b.boomQueued = true;
      this.boomQueue.push({ x: b.x, y: b.y, at: this.time + 0.09 });
    }
    this.combo++;
    if (this.combo === 5) {
      this.popups.push({ x: this.w / 2, y: this.h * 0.35, text: "ГОРЯЧО! ×5", color: "#ffc94d", t: 0, size: 24 });
      this.rings.push({ x: this.w / 2, y: this.h * 0.35, r: 10, maxR: 160, color: "rgba(255,201,77,0.6)", t: 0 });
      this.sfx.power();
    } else if (this.combo === 10) {
      this.popups.push({ x: this.w / 2, y: this.h * 0.35, text: "НЕУДЕРЖИМО! ×10", color: "#ffc94d", t: 0, size: 26 });
      this.sfx.power();
    } else if (this.combo === 15) {
      this.popups.push({ x: this.w / 2, y: this.h * 0.35, text: "БЕЗУМИЕ! ×15", color: "#ff5ca8", t: 0, size: 28 });
      this.sfx.power();
    }
    const gained = (20 + b.tier * 20) * this.combo;
    this.score += gained;
    if (this.score > this.best) {
      this.best = this.score;
      this.newRecord = true;
      localStorage.setItem("sharoboy-best", String(this.best));
    }
    this.sfx.destroy(b.tier);
    this.burst(b.x, b.y, TIER[b.tier].base, 10 + b.tier * 4, 200 + b.tier * 60);
    this.burst(b.x, b.y, "#ffffff", 4, 160);
    this.rings.push({ x: b.x, y: b.y, r: 6, maxR: 46 + b.tier * 16, color: TIER[b.tier].base, t: 0 });
    this.popups.push({ x: b.x, y: b.y - 8, text: `+${gained}`, color: TIER[b.tier].base, t: 0, size: 13 + b.tier * 2 });
    this.shake = Math.min(this.shake + 1.2 + b.tier, 9);
    if (b.tier === 3) this.hitStop = Math.max(this.hitStop, 0.06);

    // монеты для будущей прокачки — падают редко
    if (Math.random() < 0.05) {
      this.powers.push({ x: b.x, y: b.y, vy: 150, type: "coin", t: 0 });
    }

    // бонусы (зелёные) и анти-бонусы (красные) — падают часто
    if (Math.random() < 0.24) this.dropPower(b.x, b.y);
    this.pushHud();
  }

  /** Общая таблица дропа; при дефиците целей вес лазеров/ракет растёт. */
  private pickPowerType(): PowerType {
    const scarcity = clamp(1 - this.blocks.length / this.blocksInitial, 0, 1);
    const boost = scarcity > 0.5 ? 1 + (scarcity - 0.5) * 14 : 1; // до ×8 на почти зачищенном поле
    const table: [PowerType, number][] = [
      ["life", 6],
      ["wide", 9],
      ["multi", 9],
      ["slow", 8],
      ["shield", 8],
      ["magnet", 9],
      ["laser", 10 * boost],
      ["rocket", 9 * boost],
      ["fire", 8],
      ["fast", 12],
      ["shrink", 8],
    ];
    const total = table.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [type, w] of table) {
      roll -= w;
      if (roll <= 0) return type;
    }
    return "wide";
  }

  private dropPower(x: number, y: number) {
    const type = this.pickPowerType();
    const skip =
      (type === "multi" && this.balls.length >= 4) ||
      (type === "life" && this.lives >= 5) ||
      (type === "shield" && this.shield >= 5);
    if (!skip) this.powers.push({ x, y, vy: 150, type, t: 0 });
  }

  /** Периодически бонусы сыплются прямо с верхней границы поля. */
  private periodicPowerDrop(dt: number) {
    if (this.boss && this.blocks.length > 0) {
      // у босса свой темп: небо не спамит
      this.skyDropTimer -= dt * 0.55;
    } else {
      this.skyDropTimer -= dt;
    }
    if (this.skyDropTimer > 0) return;
    this.skyDropTimer = rand(18, 27);
    if (this.powers.length >= 6) return;
    const x = rand(36, this.w - 36);
    this.dropPower(x, -22);
    // заметные сигналы: крупное кольцо, яркая подпись и звонкий звук
    this.rings.push({ x, y: 20, r: 6, maxR: 84, color: "rgba(124,245,255,0.85)", t: 0 });
    this.burst(x, 26, "#7cf5ff", 8, 150);
    this.popups.push({ x, y: 46, text: "С НЕБА!", color: "#eaffff", t: 0, size: 18 });
    this.sfx.power();
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

  private updatePowers(dt: number) {
    const p = this.paddle;
    for (const pw of this.powers) {
      pw.t += dt;
      pw.y += pw.vy * dt;
      pw.x += Math.sin(pw.t * 3) * 14 * dt;
      if (
        pw.y + 14 >= p.y - p.h / 2 &&
        pw.y - 14 <= p.y + p.h / 2 &&
        pw.x >= p.x - p.w / 2 - 16 &&
        pw.x <= p.x + p.w / 2 + 16
      ) {
        this.applyPower(pw.type);
        pw.t = 999;
      }
    }
    this.powers = this.powers.filter((pw) => pw.t < 900 && pw.y < this.h + 40);
  }

  private applyPower(type: PowerType) {
    const meta = POWER_META[type];
    if (meta.good) this.sfx.power();
    else this.sfx.powerBad();
    const popup = (text: string) =>
      this.popups.push({
        x: this.paddle.x,
        y: this.paddle.y - 30,
        text,
        color: meta.good ? "#5dffb0" : "#ff6a5c",
        t: 0,
        size: 16,
      });
    switch (type) {
      case "wide":
        this.wideUntil = this.time + 12;
        this.shrinkUntil = 0;
        popup("ШИРОКАЯ РАКЕТКА");
        break;
      case "shrink":
        this.shrinkUntil = this.time + 10;
        this.wideUntil = 0;
        popup("УЗКАЯ РАКЕТКА");
        break;
      case "life":
        this.lives = Math.min(this.lives + 1, 5);
        popup("+1 ЖИЗНЬ");
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
        // луч не стреляет сам: бонус взводит лазер, залп — по пробелу/клику
        this.laserArmed = true;
        this.laserArmedUntil = this.time + 4;
        popup("ЛАЗЕР ГОТОВ — ПРОБЕЛ");
        break;
      case "rocket":
        this.rocketUntil = this.time + 12;
        popup("РАКЕТЫ — ПРОБЕЛ");
        break;
      case "fire":
        this.fireUntil = this.time + 8;
        popup("ОГНЕННОЕ ЯДРО!");
        break;
      case "magnet":
        this.magnetUntil = this.time + 7;
        popup("МАГНИТ!");
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
              sinceHit: 0,
            });
          }
        }
        popup("×3 ШАРА!");
        break;
      }
      case "coin":
        this.addCoins(1);
        popup("+1 МОНЕТА");
        this.sfx.coin();
        this.burst(this.paddle.x, this.paddle.y - 12, "#ffd66b", 10, 170);
        break;
    }
    this.burst(this.paddle.x, this.paddle.y - 10, meta.color, 12, 190);
    this.pushHud();
  }

  /* ---------------- оружие: лазеры и ракеты ---------------- */

  private tryFire(dt: number, fire: boolean) {
    const rocketOn = this.time < this.rocketUntil;
    if (!rocketOn || !fire) {
      this.weaponCd = 0;
      return;
    }
    this.weaponCd -= dt;
    if (this.weaponCd > 0) return;
    const p = this.paddle;
    this.projectiles.push({ x: p.x, y: p.y - p.h - 6, vy: -560, kind: "rocket", r: 7, dead: false });
    this.sfx.rocket();
    this.weaponCd = 0.32;
    this.burst(p.x, p.y - p.h, "#ffc94d", 5, 120);
    if (this.projectiles.length > 48) this.projectiles.splice(0, this.projectiles.length - 48);
    p.squash = Math.max(p.squash, 0.35);
  }

  /** Лазер — не снаряд, а луч: короткие импульсы от пилонов, пока активен бонус (~2 с).
   *  Получает общий сигнал выстрела: одно нажатие может выстрелить и лазер, и ракеты. */
  private updateLaser(fire: boolean) {
    // взведённый заряд сгорает, если не выстрелить вовремя
    if (this.laserArmed && this.time > this.laserArmedUntil) this.laserArmed = false;
    // активация залпа: пробел, клик или тап
    if (this.laserArmed && fire) {
      this.laserArmed = false;
      this.laserUntil = this.time + 2;
      this.laserWasOn = false;
    }
    const active = this.time < this.laserUntil;
    const cyc = this.time % 0.3;
    const on = active && cyc < 0.17;
    if (on && !this.laserWasOn) {
      this.sfx.laser();
      const p = this.paddle;
      this.beamHit(p.x - p.w * 0.36);
      this.beamHit(p.x + p.w * 0.36);
      p.squash = Math.max(p.squash, 0.25);
    }
    this.laserWasOn = on;
  }

  /** Точечное поражение: первый блок (или босс) строго над излучателем. */
  private beamHit(px: number) {
    const pylonY = this.paddle.y - this.paddle.h / 2 - 8;
    let best: Block | null = null;
    let bestHH = 0;
    for (const b of this.blocks) {
      if (b.dead) continue;
      const e = rotatedExtents(b.rx, b.ry, b.rot);
      if (Math.abs(b.x - px) > e.hw + 3) continue;
      if (b.y + e.hh >= pylonY) continue;
      if (!best || b.y > best.y) {
        best = b;
        bestHH = e.hh;
      }
    }
    if (best) {
      this.damageBlock(best, 3);
      this.burst(px, best.y + bestHH, "#7cf5ff", 8, 180);
      this.rings.push({ x: px, y: best.y + bestHH, r: 4, maxR: 44, color: "rgba(124,245,255,0.85)", t: 0 });
      return;
    }
    if (this.boss && Math.abs(this.boss.x - px) < this.boss.r && this.boss.y + this.boss.r < pylonY) {
      this.damageBoss(2, true);
      this.burst(px, this.boss.y + this.boss.r, "#7cf5ff", 8, 180);
    }
  }

  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.y += pr.vy * dt;
      if (pr.y < -30) {
        pr.dead = true;
        continue;
      }
      if (pr.kind === "rocket") {
        // след
        this.particles.push({
          x: pr.x + rand(-2, 2),
          y: pr.y + 10,
          vx: rand(-15, 15),
          vy: rand(40, 90),
          life: 0.3,
          maxLife: 0.3,
          size: rand(2, 4),
          color: "#ff8a3d",
          grav: 0,
        });
      }
      for (const b of this.blocks) {
        if (b.dead) continue;
        const dx = (pr.x - b.x) / (b.rx + pr.r);
        const dy = (pr.y - b.y) / (b.ry + pr.r);
        if (dx * dx + dy * dy < 1) {
          if (pr.kind === "rocket") {
            this.explode(pr.x, pr.y);
          } else {
            this.damageBlock(b);
          }
          pr.dead = true;
          break;
        }
      }
      if (!pr.dead && this.boss) {
        if (Math.hypot(pr.x - this.boss.x, pr.y - this.boss.y) < this.boss.r + pr.r + 4) {
          pr.dead = true;
          this.explode(pr.x, pr.y);
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  /* ---------------- переходы ---------------- */

  private onAllBallsLost() {
    this.levelLostBall = true;
    this.lives--;
    this.combo = 0;
    this.shake = Math.min(this.shake + 8, 14);
    this.burst(this.paddle.x, this.h - 20, "#ff6a5c", 16, 260);
    this.sfx.loseLife();
    this.wideUntil = 0;
    this.slowUntil = 0;
    this.fastUntil = 0;
    this.shrinkUntil = 0;
    this.laserUntil = 0;
    this.laserArmed = false;
    this.rocketUntil = 0;
    this.fireUntil = 0;
    this.magnetUntil = 0;
    this.weaponCd = 0;
    this.powers = [];
    this.projectiles = [];
    if (this.lives <= 0) {
      this.phase = "over";
      this.releaseLock();
      this.sfx.gameOver();
      this.saveTop();
      this.pushHud();
      return;
    }
    this.transition = 1.0;
    this.pushHud();
  }

  /** Полный сброс временных эффектов между уровнями/волнами. */
  private clearAllEffects() {
    this.wideUntil = 0;
    this.slowUntil = 0;
    this.fastUntil = 0;
    this.shrinkUntil = 0;
    this.laserUntil = 0;
    this.laserArmed = false;
    this.rocketUntil = 0;
    this.fireUntil = 0;
    this.magnetUntil = 0;
    this.weaponCd = 0;
    this.shield = 0;
    this.laserWasOn = false;
    this.powers = [];
    this.projectiles = [];
    this.combo = 0;
    this.effectsKey = "";
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
      this.score += 200 + this.wave * 50;
      this.lives = Math.min(this.lives + 1, 5);
      this.sfx.levelClear();
      this.wave++;
      this.buildWave(this.wave);
      this.clearAllEffects();
      this.balls = [];
      this.serveBall();
      this.setBanner(this.wave % 5 === 0 ? `ВОЛНА ${this.wave} — БОСС!` : `ВОЛНА ${this.wave}`);
      this.pushHud();
      return;
    }
    if (this.level >= LEVELS.length) {
      this.phase = "won";
      this.releaseLock();
      this.sfx.win();
      this.saveTop();
      this.pushHud();
      return;
    }
    this.sfx.levelClear();
    this.level++;
    this.buildLevel(this.level);
    this.clearAllEffects();
    this.balls = [];
    this.serveBall();
    this.setBanner(`УРОВЕНЬ ${this.level} — ${LEVELS[this.level - 1].name}`);
    this.pushHud();
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

  private syncEffectsHud() {
    const t = this.time;
    const key = [
      t < this.wideUntil ? 1 : 0,
      t < this.slowUntil ? 1 : 0,
      t < this.fastUntil ? 1 : 0,
      t < this.shrinkUntil ? 1 : 0,
      t < this.laserUntil ? 1 : 0,
      this.laserArmed ? 1 : 0,
      t < this.rocketUntil ? 1 : 0,
      t < this.fireUntil ? 1 : 0,
      t < this.magnetUntil ? 1 : 0,
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
      blocksLeft: this.blocks.length + (this.boss ? 1 : 0),
      muted: this.sfx.muted,
      banner: this.banner,
      stuck: this.balls.some((b) => b.stuck),
      newRecord: this.newRecord,
      shield: this.shield,
      wideOn: this.time < this.wideUntil,
      slowOn: this.time < this.slowUntil,
      fastOn: this.time < this.fastUntil,
      shrinkOn: this.time < this.shrinkUntil,
      laserOn: this.time < this.laserUntil || this.laserArmed,
      laserArmed: this.laserArmed,
      rocketOn: this.time < this.rocketUntil,
      fireOn: this.time < this.fireUntil,
      magnetOn: this.time < this.magnetUntil,
      top: this.top,
      topEndless: this.topEndless,
      coins: this.coins,
    });
  }

  /* ---------------- отрисовка ---------------- */

  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(speed * 0.3, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.35, 0.8),
        maxLife: 0.8,
        size: rand(2, 5),
        color,
        grav: 380,
      });
    }
    if (this.particles.length > 420) this.particles.splice(0, this.particles.length - 420);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private draw() {
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // фон
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0d3448");
    g.addColorStop(0.5, "#082434");
    g.addColorStop(1, "#04121c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // зарево от комбо
    if (this.combo >= 2 && this.phase !== "menu") {
      const heat = clamp(this.combo / 15, 0, 1);
      const rg = ctx.createRadialGradient(w / 2, h * 0.2, 40, w / 2, h * 0.2, Math.max(w, h) * 0.7);
      rg.addColorStop(0, `rgba(255,201,77,${0.05 + heat * 0.12})`);
      rg.addColorStop(1, "rgba(255,201,77,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    // пузыри
    for (const b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(140,220,255,${b.a})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // тряска
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate(rand(-1, 1) * this.shake * 0.6, rand(-1, 1) * this.shake * 0.6);
    }

    this.drawBlocks();
    this.drawBoss();
    this.drawRings();
    this.drawParticles();
    this.drawPowers();
    this.drawLaserBeams();
    this.drawProjectiles();
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
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(2,8,14,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
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
      ctx.rotate(b.rot);
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

      // «матрёшка»: внутри кружатся мини-шарики — подсказка россыпи
      if (b.splits) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let i = 0; i < 3; i++) {
          const aa = b.seed + (i * Math.PI * 2) / 3 + this.time * 0.9;
          const ox = Math.cos(aa) * b.rx * 0.36;
          const oy = Math.sin(aa) * b.ry * 0.36;
          ctx.beginPath();
          ctx.ellipse(x + ox, y + oy, Math.max(3, b.rx * 0.17), Math.max(3, b.ry * 0.17), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawBomb(b: Block, x: number, y: number) {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6 + b.seed);
    ctx.save();
    ctx.shadowColor = "#ff8a3d";
    ctx.shadowBlur = 10 + pulse * 8;
    const g = ctx.createRadialGradient(x - b.rx * 0.3, y - b.ry * 0.35, 2, x, y, b.rx * 1.2);
    g.addColorStop(0, "#5c6672");
    g.addColorStop(0.5, "#2b323c");
    g.addColorStop(1, "#0c0f14");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, b.rx, b.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,138,61,${0.4 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // фитиль и искра
    const fx = x + b.rx * 0.5;
    const fy = y - b.ry * 0.85;
    ctx.strokeStyle = "#8a6a3d";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x + b.rx * 0.2, y - b.ry * 0.8);
    ctx.quadraticCurveTo(fx, fy - 8, fx + 6, fy - 12);
    ctx.stroke();
    ctx.fillStyle = Math.sin(this.time * 22) > 0 ? "#ffe9a8" : "#ff8a3d";
    ctx.beginPath();
    ctx.arc(fx + 6, fy - 13, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBoss() {
    const bo = this.boss;
    if (!bo) return;
    const { ctx } = this;
    const angry = bo.hp < bo.maxHp * 0.4;
    ctx.save();
    ctx.translate(bo.x, bo.y);

    // HP-кольцо
    const frac = clamp(bo.hp / bo.maxHp, 0, 1);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(4,18,26,0.7)";
    ctx.beginPath();
    ctx.arc(0, 0, bo.r + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = frac > 0.55 ? "#5dffb0" : frac > 0.25 ? "#ffc94d" : "#ff5347";
    ctx.beginPath();
    ctx.arc(0, 0, bo.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();

    // тело
    ctx.shadowColor = angry ? "#ff5347" : "#ff5ca8";
    ctx.shadowBlur = 30;
    const g = ctx.createRadialGradient(-bo.r * 0.35, -bo.r * 0.4, 4, 0, 0, bo.r * 1.2);
    if (angry) {
      g.addColorStop(0, "#ffd9d4");
      g.addColorStop(0.45, "#ff6a5c");
      g.addColorStop(1, "#5a0f08");
    } else {
      g.addColorStop(0, "#ffd0e8");
      g.addColorStop(0.45, "#ff5ca8");
      g.addColorStop(1, "#5a0f3c");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, bo.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // корона
    ctx.fillStyle = "#ffc94d";
    ctx.beginPath();
    const cw = bo.r * 0.7;
    ctx.moveTo(-cw, -bo.r * 0.72);
    ctx.lineTo(-cw * 0.66, -bo.r * 1.12);
    ctx.lineTo(-cw * 0.22, -bo.r * 0.8);
    ctx.lineTo(0, -bo.r * 1.22);
    ctx.lineTo(cw * 0.22, -bo.r * 0.8);
    ctx.lineTo(cw * 0.66, -bo.r * 1.12);
    ctx.lineTo(cw, -bo.r * 0.72);
    ctx.closePath();
    ctx.fill();

    // глаза следят за ближайшим шаром
    let tx = 0;
    let ty = 1;
    let nearest = Infinity;
    for (const b of this.balls) {
      const d = Math.hypot(b.x - bo.x, b.y - bo.y);
      if (d < nearest) {
        nearest = d;
        tx = (b.x - bo.x) / d;
        ty = (b.y - bo.y) / d;
      }
    }
    for (const sx of [-1, 1]) {
      const exx = sx * bo.r * 0.34;
      const eyy = -bo.r * 0.12;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(exx, eyy, bo.r * 0.2, bo.r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a1020";
      ctx.beginPath();
      ctx.arc(exx + tx * bo.r * 0.08, eyy + ty * bo.r * 0.09, bo.r * 0.09, 0, Math.PI * 2);
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

    // рот
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
    ctx.restore();
  }

  private drawRings() {
    const { ctx } = this;
    for (const r of this.rings) {
      const a = clamp(1 - r.t, 0, 1);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * a + 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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

  private drawPowers() {
    const { ctx } = this;
    for (const pw of this.powers) {
      // столб света сверху в первые мгновения падения — дроп невозможно пропустить
      if (pw.t < 0.5) {
        const a = (0.5 - pw.t) / 0.5;
        const tint = pw.type === "coin" ? "#ffc94d" : POWER_META[pw.type].color;
        ctx.fillStyle = tint + "30";
        ctx.fillRect(pw.x - 4, 0, 8, Math.max(0, pw.y));
        ctx.fillStyle = `rgba(240,255,255,${0.5 * a})`;
        ctx.fillRect(pw.x - 1.2, 0, 2.4, Math.max(0, pw.y));
      }
      if (pw.type === "coin") {
        this.drawCoin(pw.x, pw.y, pw.t);
        continue;
      }
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

  /** Круглая золотая монета: вращается, поблёскивает. */
  private drawCoin(x: number, y: number, t: number) {
    const { ctx } = this;
    // вращение вокруг вертикальной оси: диск периодически «схлопывается»
    const spin = 0.32 + 0.68 * Math.abs(Math.sin(t * 4.6));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(spin, 1);
    ctx.shadowColor = "#ffc94d";
    ctx.shadowBlur = 14;
    const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, 13);
    g.addColorStop(0, "#fff6cf");
    g.addColorStop(0.45, "#ffd66b");
    g.addColorStop(0.85, "#e8a91c");
    g.addColorStop(1, "#a8720a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // кант и внутреннее кольцо
    ctx.strokeStyle = "#8a5f06";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 12.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(138,95,6,0.65)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    // звёздочка в центре
    ctx.fillStyle = "#8a5f06";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? 5.2 : 2.2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // блик
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-4.5, -5.5, 3.6, 2, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // пробегающая искра
    const sp = (t * 2.2) % 1;
    if (sp < 0.3) {
      const sa = sp / 0.3;
      ctx.save();
      ctx.globalAlpha = Math.sin(sa * Math.PI) * 0.9;
      ctx.strokeStyle = "#fffbe8";
      ctx.lineWidth = 1.6;
      const cx = x - 12 + sa * 24;
      const cy = y - 11;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy + 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Импульсный лазерный луч от пилонов до первой цели. */
  private drawLaserBeams() {
    if (this.time >= this.laserUntil || this.phase === "menu") return;
    const cyc = this.time % 0.3;
    if (cyc >= 0.17) return;
    const onAmt = 1 - cyc / 0.17;
    const { ctx } = this;
    const p = this.paddle;
    const pylonY = p.y - p.h / 2 - 8;
    for (const sx of [-0.36, 0.36]) {
      const px = p.x + p.w * sx;
      let hitY = -30;
      let best: Block | null = null;
      for (const b of this.blocks) {
        if (b.dead) continue;
        const e = rotatedExtents(b.rx, b.ry, b.rot);
        if (Math.abs(b.x - px) > e.hw + 3 || b.y + e.hh >= pylonY) continue;
        if (!best || b.y > best.y) {
          best = b;
          hitY = b.y + e.hh - 2;
        }
      }
      if (best) hitY = Math.max(hitY, -30);
      else if (this.boss && Math.abs(this.boss.x - px) < this.boss.r && this.boss.y + this.boss.r < pylonY)
        hitY = this.boss.y + this.boss.r - 2;

      const wdt = 2.5 + 5 * onAmt;
      ctx.save();
      ctx.globalAlpha = 0.25 * onAmt;
      ctx.fillStyle = "#7cf5ff";
      ctx.fillRect(px - wdt * 2.4, hitY, wdt * 4.8, pylonY - hitY);
      ctx.globalAlpha = 0.95 * onAmt;
      ctx.shadowColor = "#7cf5ff";
      ctx.shadowBlur = 18;
      const g = ctx.createLinearGradient(px - wdt / 2, 0, px + wdt / 2, 0);
      g.addColorStop(0, "rgba(124,245,255,0.1)");
      g.addColorStop(0.5, "#f2ffff");
      g.addColorStop(1, "rgba(124,245,255,0.1)");
      ctx.fillStyle = g;
      ctx.fillRect(px - wdt / 2, hitY, wdt, pylonY - hitY);
      ctx.beginPath();
      ctx.arc(px, hitY + 3, 4.5 + 4.5 * onAmt, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(240,255,255,0.95)";
      ctx.fill();
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

  private drawPaddle() {
    if (this.phase === "menu") return;
    const { ctx } = this;
    const p = this.paddle;
    const wide = this.time < this.wideUntil;
    const ww = p.w * (1 + p.squash * 0.12);
    const hh = p.h * (1 - p.squash * 0.25);
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
    // блик
    ctx.fillStyle = "rgba(255,255,255,0.35)";
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
    if (laserOn || this.laserArmed) {
      const charge = !laserOn && this.laserArmed ? 8 + Math.sin(this.time * 16) * 6 : 10;
      ctx.shadowColor = "#7cf5ff";
      ctx.shadowBlur = charge;
      ctx.fillStyle = !laserOn && this.laserArmed ? "#5fd8ef" : "#9df2ff";
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
    // магнитное поле: бегущая дуга над ракеткой
    if (this.time < this.magnetUntil) {
      const pulse = 0.5 + Math.sin(this.time * 8) * 0.25;
      ctx.strokeStyle = `rgba(77,255,158,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 7]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.beginPath();
      ctx.arc(0, -hh / 2 - 4, ww * 0.44, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    ctx.restore();
  }

  private drawBalls() {
    if (this.phase === "menu") return;
    const { ctx } = this;
    const mode = this.time < this.fireUntil
      ? { trail: "rgba(255,138,61,", mid: "#ffe9a8", core: "#ff5347", glow: "#ff8a3d" }
      : this.time < this.slowUntil
        ? { trail: "rgba(93,255,176,", mid: "#d2ffee", core: "#2fd98a", glow: "#5dffb0" }
        : this.time < this.fastUntil
          ? { trail: "rgba(255,106,92,", mid: "#ffd9d4", core: "#ff5347", glow: "#ff6a5c" }
          : { trail: "rgba(120,240,255,", mid: "#c9f6ff", core: "#38bcd8", glow: "#7cf5ff" };
    for (const b of this.balls) {
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
        // штрихи подбираются так, чтобы ровно делить окружность —
        // без «шва», а начало дуги (единственный стык) спрятано внизу, в толще ракетки
        const c = Math.PI * 2 * pr;
        const n = 18;
        const seg = c / n;
        ctx.beginPath();
        ctx.arc(b.x, b.y, pr, Math.PI / 2, Math.PI / 2 + Math.PI * 2);
        ctx.strokeStyle = `${mode.trail}0.65)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([seg * 0.45, seg * 0.55]);
        ctx.lineDashOffset = -this.time * 30;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }

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
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `${p.size}px "Russo One", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(4,16,26,0.85)";
      const y = p.y - p.t * 34;
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }
}
