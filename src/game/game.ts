/**
 * Ядро движка: класс Game — владелец состояния и игровой цикл.
 * Подсистемы вынесены в модули папки game/ и работают с состоянием
 * через свободные функции (g: Game, ...); класс оставляет публичный API.
 */
import { SFX } from "./audio"
import { BossSystem } from "./boss"
import { Physics } from "./physics"
import { PowersSystem } from "./powers"
import { WeaponsSystem } from "./weapons"
import { InputController } from "./input"
import { Effects } from "./effects"
import { lsGet } from "./utils"
import type { MinibossCreature } from "./types"
import type { Ball, Block, Bubble, HudData, MouthBubble, PaddleShapeKind } from "./types"
import type { PaddleState, Phase, PowerUp, Projectile, ScoreEntry, SparkHit } from "./types"
import type { CampaignMap } from "./campaignMap"
import type { LevelSpec } from "./levels"
import type { MinibossKind } from "./minibosses"
import { makeBossHost, makePowersHost } from "./game/hosts"
import { makePhysicsHost, makeWeaponsHost } from "./game/hostsWorld"
import { paddleShape } from "./game/paddleControl"
import { loadProgress, buyUpgrade } from "./game/progress"
import {
  loadScoreEntries,
  createInput,
  attach,
  destroy,
  setNick,
  resizeHandler,
} from "./game/lifecycle"
import { startGame, startEndless, toMenu, togglePause } from "./game/modes"
import {
  startLevelBattle,
  enterMapNode,
  dismissCampaignEvent,
  enterNextNodeOnAction,
} from "./game/campaignFlow"
import {
  toggleDebug,
  toggleFps,
  toggleDebugEffect,
  isDebugEffectActive,
  spawnDebugBoss,
  spawnDebugMiniboss,
  debugDamageUp,
  debugSkipLevel,
} from "./game/debug"
import { setMusicVolume, setSfxVolume, toggleMute, toggleMusic } from "./game/audioControls"
import { launch } from "./game/runFlow"
import { FPS_LS_KEY } from "./game/debug"
import { update, gameLoop } from "./game/updateStep"
import { draw } from "./game/drawScene"

export { UPGRADES_ENABLED, UPGRADE_DEFS } from "./upgrades"
export type { Block, HudData, Phase, PowerType, ScoreEntry } from "./types"
export { FPS_LS_KEY } from "./game/debug"

export class Game {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  onHud: (h: HudData) => void
  raf = 0
  last = 0
  destroyed = false
  time = 0
  /** Размер мира в «эталонных» единицах: окно 1920×1080 соответствует масштабу 1. */
  w = 960
  h = 640
  dpr = 1
  /** Мировые единицы → CSS-пиксели: весь мир масштабируется одним коэффициентом. */
  scale = 1
  /** CSS-размер окна (заполняется в resizeHandler): ориентация окна нужна
   *  для расчёта неигровой HUD-зоны (viewport.hudTopCss → Game.blockTop). */
  cssW = 1920
  cssH = 1080
  phase: Phase = "menu"
  score = 0
  best = 0
  lives = 3
  level = 1
  combo = 0
  newRecord = false
  /** статистика текущей партии — для достижений */
  runBossKills = 0
  runLivesLost = 0
  /** очередь открытых достижений до следующей отправки HUD */
  achQueue: string[] = []
  mode: "campaign" | "endless" = "campaign"
  wave = 0
  waveSpec: { name: string; speed: number } | null = null
  /** Режим отладки: позволяет тестировать новые механики и контент. */
  debug = false
  /** Принудительный тип босса для отладки (null = стандартное поведение). */
  debugBossType: "octopus" | "kraken" | null = null
  /** Живые существа-минибоссы уровня (их может быть несколько): у каждого свой
   *  пул HP, номер группы (mbGroup блоков) и центр для дропа жизни. */
  minibosses: MinibossCreature[] = []
  mbGroupSeq = 0
  /** Пузырьки воздуха изо рта рыбы-минибосса. */
  mouthBubbles: MouthBubble[] = []
  mouthBubbleTimer = 0
  mouthX = 0
  mouthY = 0
  fishMouth = false
  /** Множитель урона шара (скрытая отладка: клавиша "-" на цифровой клавиатуре). */
  debugBallDamage = 1
  /** Активные эффекты отладки (для тестирования механик). */
  debugEffects = new Set<string>()
  /** Счётчик FPS в углу канваса: вкл/выкл, состояние сохраняется в localStorage. */
  showFps = lsGet(FPS_LS_KEY) === "1"
  /** Текущий FPS (усреднение за окно ~0.5 с) — значение для счётчика. */
  fps = 0
  fpsFrames = 0
  fpsElapsed = 0
  paddle: PaddleState = { x: 480, y: 600, w: 150, baseW: 150, h: 18, vx: 0, squash: 0 }
  /** Импульсный поворот ракетки (однократный резкий доворот + возврат). */
  paddleImpulse: { dir: number; t: number } | null = null
  /** Предыдущее состояние кнопок мыши для детекта краёв нажатия. */
  prevLeftDown = false
  prevRightDown = false
  /** Режим тача: ракетка поднята выше, чтобы управляющий палец её не закрывал. */
  touchMode = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches
  /** Множитель ширины ракетки от прокачки (апгрейд «paddle»). */
  paddleWidthMult = 1
  balls: Ball[] = []
  blocks: Block[] = []
  powers: PowerUp[] = []
  projectiles: Projectile[] = []
  fx = new Effects()
  bubbles: Bubble[] = []
  input: InputController
  shake = 0
  wideUntil = 0
  slowUntil = 0
  fastUntil = 0
  shrinkUntil = 0
  laserUntil = 0
  laserArmed = false
  laserArmedUntil = 0
  laserWasOn = false
  rocketUntil = 0
  fireUntil = 0
  frostUntil = 0
  sparkUntil = 0
  magnetUntil = 0
  weaponCd = 0
  shield = 0
  readonly bossSys: BossSystem
  readonly physics: Physics
  readonly powersSys: PowersSystem
  readonly weaponsSys: WeaponsSystem
  boomQueue: { x: number; y: number; at: number }[] = []
  /** Очередь звеньев цепи искр электрошара (обрабатывается в updateStep). */
  sparkQueue: SparkHit[] = []
  spawnTimer = 18
  skyDropTimer = 22
  shiftTimer = 14
  fieldShift: null | { t: number; dur: number; dx: number; dy: number } = null
  blocksInitial = 1
  coins = 0
  upgrades: Record<string, number> = {}
  banner: string | null = null
  bannerTimer = 0
  transition = 0
  hitStop = 0
  flash = 0
  countdown = 0
  levelLostBall = false
  effectsKey = ""
  /** Карта забега кампании и позиция игрока на ней (для экрана карты). */
  campaign: CampaignMap | null = null
  /** Появлявшиеся минибоссы по узлам текущего забега (для маркеров карты) —
   *  заполняется в момент старта каждого боя. */
  campaignMbSeen: Record<number, MinibossKind[]> = {}
  /** Сколько боёв подряд прошло без минибосса (растит шанс появления). */
  minibossPity = 0
  /** Активное событие на карте (текст для оверлея; null — события нет). */
  campaignEvent: string | null = null
  /** Узел назначения события-телепорта (бой стартует после подтверждения). */
  campaignEventTarget = -1
  /** Узлы-события, которые уже сработали (повторный вход — обычный бой). */
  campaignSpentEvents: number[] = []
  campaignPlayerId = -1
  campaignVisited: number[] = []
  campaignVisible: number[] = []
  /** Раскладка текущего боя (null вне карты и на узле финального босса). */
  activeSpec: LevelSpec | null = null
  /** Идёт ли сейчас бой с финальным боссом (а не с обычным узлом). */
  onBossNode = false
  /** Номер забега: меняет сид карты, чтобы каждый старт был новым. */
  runSeq = 0
  /** Сид текущей карты кампании (для детерминированного выбора босса). */
  campaignSeed = 0
  top: ScoreEntry[] = []
  topEndless: ScoreEntry[] = []
  sfx = new SFX()
  nick = ""

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudData) => void, nick?: string) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no 2d context")
    this.ctx = ctx
    this.onHud = onHud
    if (nick) this.nick = nick
    this.input = createInput(this, canvas)
    this.bossSys = new BossSystem(makeBossHost(this))
    this.powersSys = new PowersSystem(makePowersHost(this))
    this.physics = new Physics(makePhysicsHost(this))
    this.weaponsSys = new WeaponsSystem(makeWeaponsHost(this))
    this.best = Number(lsGet("sharoboy-best") || 0) || 0
    this.top = loadScoreEntries(this, "sharoboy-top")
    this.topEndless = loadScoreEntries(this, "sharoboy-top-endless")
    loadProgress(this)
  }

  /** Текущая форма верхней поверхности ракетки — см. game/paddleControl.ts. */
  paddleShapeKind(): PaddleShapeKind {
    return paddleShape(this)
  }
  loop = (t: number) => gameLoop(this, t)
  /** Реакция на изменение размера окна (см. game/lifecycle.ts). */
  handleResize = () => resizeHandler(this)
  update(dt: number) {
    update(this, dt)
  }
  draw() {
    draw(this)
  }

  attach() {
    attach(this)
  }
  destroy() {
    destroy(this)
  }
  setNick(nick: string) {
    setNick(this, nick)
  }
  startGame() {
    startGame(this)
  }
  startLevelBattle(n: number) {
    startLevelBattle(this, n)
  }
  startEndless() {
    startEndless(this)
  }
  toMenu() {
    toMenu(this)
  }
  togglePause() {
    togglePause(this)
  }
  toggleMute() {
    toggleMute(this)
  }
  toggleMusic() {
    toggleMusic(this)
  }
  toggleFps(): boolean {
    return toggleFps(this)
  }
  toggleDebug() {
    toggleDebug(this)
  }
  toggleDebugEffect(id: string) {
    toggleDebugEffect(this, id)
  }
  isDebugEffectActive(id: string): boolean {
    return isDebugEffectActive(this, id)
  }
  enterMapNode(id: number) {
    enterMapNode(this, id)
  }
  dismissCampaignEvent() {
    dismissCampaignEvent(this)
  }
  enterNextNodeOnAction() {
    enterNextNodeOnAction(this)
  }
  buyUpgrade(id: string): boolean {
    return buyUpgrade(this, id)
  }
  debugDamageUp() {
    debugDamageUp(this)
  }
  debugSkipLevel() {
    debugSkipLevel(this)
  }
  spawnDebugBoss(kind: "octopus" | "kraken") {
    spawnDebugBoss(this, kind)
  }
  spawnDebugMiniboss(kind: MinibossKind) {
    spawnDebugMiniboss(this, kind)
  }
  setMusicVolume(v: number) {
    setMusicVolume(this, v)
  }
  setSfxVolume(v: number) {
    setSfxVolume(this, v)
  }
  launch() {
    launch(this)
  }
}
