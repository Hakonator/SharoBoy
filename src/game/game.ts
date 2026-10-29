/**
 * Ядро движка: класс Game — владелец состояния и игровой цикл.
 * Подсистемы вынесены в модули папки game/ и работают с состоянием
 * через свободные функции (g: Game, ...); класс оставляет публичный API.
 */
import { DEBUG_TOOLS } from "../config"

import { SFX } from "./audio"
import { BossSystem } from "./boss"
import { Physics } from "./physics"
import { PowersSystem } from "./powers"
import { WeaponsSystem } from "./weapons"
import { InputController } from "./input"
import { Effects } from "./effects"
import { lsGet } from "./utils"
import {
  type GameSettings,
  loadSettings,
  particleLimitForQuality,
  subscribeSettings,
} from "./settings"
import {
  type TacticalModulesSettings,
  loadTacticalModules,
  saveTacticalModules,
} from "./tacticalModules"
import type {
  CampaignEventData,
  CampaignShopItem,
  CampaignShopState,
  IntermediateScoreData,
  MinibossCreature,
  RunScoreBreakdown,
} from "./types"
import type { Ball, Block, Bubble, HudData, MouthBubble, PaddleShapeKind } from "./types"
import type { PaddleState, Phase, PowerUp, Projectile, ScoreEntry, SparkHit } from "./types"
import type { CampaignMap } from "./campaignMap"
import type { PlayerMapSpec } from "./mapSpec"
import type { LevelSpec } from "./levels"
import type { MinibossKind } from "./minibosses"
import type { BossVariantKind } from "./bossVariants"
import type { BossTransmissionData } from "./bossDialogs"
import { buyCampaignShopItem, closeCampaignShop } from "./campaignShop"
import { chooseCampaignEventChoice as chooseCampaignEventOption } from "./campaignEvents"
import { makeBossHost, makePowersHost, makePhysicsHost, makeWeaponsHost } from "./game/hosts"
import { paddleShape } from "./game/paddleControl"
import {
  loadProgress,
  buyUpgrade,
  applyUpgrades,
  saveProgress,
  buyCosmeticItem,
  equipCosmeticItem,
} from "./game/progress"
import {
  type CosmeticCategory,
  type PlayerCosmetics,
  DEFAULT_UNLOCKED_COSMETICS,
  DEFAULT_EQUIPPED_COSMETICS,
} from "./cosmetics"
import { type CampaignModifierId, computeRunMultipliers } from "./campaignModifiers"
import type { ActiveChallengeState } from "./campaignChallenges"
import { clearAccountStorage } from "./account"
import {
  loadScoreEntries,
  createInput,
  attach,
  destroy,
  setNick,
  resizeHandler,
} from "./game/lifecycle"
import {
  startGame,
  startEndless,
  startCustomMap,
  stopCustomMap,
  toMenu,
  togglePause,
} from "./game/modes"
import {
  startLevelBattle,
  enterMapNode,
  dismissCampaignEvent,
  enterNextNodeOnAction,
} from "./game/campaignFlow"
import {
  toggleDebug,
  toggleFps,
  toggleHitboxes,
  toggleSlowMotion,
  toggleInvincible,
  toggleDebugEffect,
  isDebugEffectActive,
  spawnDebugBoss,
  spawnDebugMiniboss,
  spawnDebugSpecialBlocks,
  debugDamageUp,
  debugSkipLevel,
} from "./game/debug"
import { setMusicVolume, setSfxVolume, toggleMute, toggleMusic } from "./game/audioControls"
import { pushHud } from "./game/hudSync"
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
  /** Детальная статистика забега — для Score Breakdown */
  runBlocksDestroyed = 0
  runBlocksScore = 0
  runBossesScore = 0
  runMaxCombo = 0
  runCritHits = 0
  runClutchSaves = 0
  runSectorsCleared = 0
  runFastClears = 0
  runSectorStartTime = 0
  scoreBreakdown: RunScoreBreakdown | null = null
  /** Промежуточный подсчёт накапливаемых очков после завершения уровня. */
  intermediateScore: IntermediateScoreData | null = null
  intermediateScoreContinue: (() => void) | null = null
  levelScoreStart = 0
  levelBlocksStart = 0
  /** очередь открытых достижений до следующей отправки HUD */
  achQueue: string[] = []
  mode: "campaign" | "endless" | "custom" = "campaign"
  customWinCondition: PlayerMapSpec["winCondition"] | null = null
  customTargetBlocks: Block[] = []
  onCustomComplete: ((result: "won" | "over") => void) | null = null
  wave = 0
  waveSpec: { name: string; speed: number } | null = null
  /** Режим отладки: позволяет тестировать новые механики и контент. */
  debug = false
  /** Принудительный тип босса для отладки (null = стандартное поведение). */
  debugBossType: BossVariantKind | null = null
  /** Активный тип босса на текущем уровне (для лора и интро). */
  activeBossKind: BossVariantKind | null = null
  /** Интро-сообщение / протокол босса (трансляция перед началом боя). */
  bossTransmission: BossTransmissionData | null = null
  /** Таймер автозакрытия сообщения босса (в секундах). */
  bossTransmissionTimer = 0
  /** Псевдоним для обратной совместимости. */
  get bossDialog(): BossTransmissionData | null {
    return this.bossTransmission
  }
  set bossDialog(val: BossTransmissionData | null) {
    this.bossTransmission = val
  }
  /** Финальный босс, побеждённый в текущем забеге кампании ("kraken" | "chrono"). */
  finalBossDefeated: BossVariantKind | null = null
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
  /** Счётчик FPS (F1; отключается в сборке через VITE_DEBUG_TOOLS=0):
      состояние сохраняется в localStorage. */
  showFps = DEBUG_TOOLS && lsGet(FPS_LS_KEY) === "1"
  /** DEV (F2): рисовать хитбоксы сущностей. */
  showHitboxes = false
  /** DEV (F3): замедление времени ×0.25 для отладки. */
  slowMotion = false
  /** DEV (F4): бессмертие — жизни не тратятся. */
  invincible = false
  /** Текущий FPS (усреднение за окно ~0.5 с) — значение для счётчика. */
  fps = 0
  fpsFrames = 0
  fpsElapsed = 0
  paddle: PaddleState = { x: 480, y: 600, w: 150, baseW: 150, h: 18, vx: 0, squash: 0 }
  aimAngle = -Math.PI / 2
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
  /** Активность проникающего шара «Кинетический клинок». */
  pierceUntil = 0
  /** Активность взрывного шара «Плазменный заряд». */
  explosiveUntil = 0
  /** Активность увеличенного шара «Гравитационное ядро». */
  bigUntil = 0
  magnetUntil = 0
  magneticPaddleUntil = 0
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
  blocksInitial = 1
  /**
   * Босс текущей арены побеждён. Победа над боссом — самостоятельное условие
   * зачистки: остатки его тела (тарелки, сегменты, лёд) добивать не нужно.
   */
  bossDefeated = false
  /** Время последнего критического сэйва (кулдаун 2.5 сек). */
  lastClutchTime = -999
  /** Таймер пульса гравитационного фокуса последних блоков. */
  focusPulseTimer = 0
  /** Показано ли оповещение фокуса на текущем уровне. */
  focusAlertShown = false
  coins = 0
  /** Постоянные несгораемые мета-кристаллы профиля. */
  metaCrystals = 0
  /** Косметика игрока (скины ракетки, шлейфы шара, темы поля). */
  cosmetics: PlayerCosmetics = {
    unlocked: [...DEFAULT_UNLOCKED_COSMETICS],
    equipped: { ...DEFAULT_EQUIPPED_COSMETICS },
  }
  /** Серия чистых попаданий по боссу без касания ракетки (для крита ×3). */
  bossCleanHits = 0
  /** Кристаллы текущего забега в кампании (тратятся в лавках и событиях). */
  crystals = 0
  /** Всего собрано кристаллов за забег (для конверсии в монеты в конце). */
  crystalsRunTotal = 0
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
  /** Структурированные данные интерактивного события с выбором вариантов. */
  campaignEventData: CampaignEventData | null = null
  /** Узел назначения события-телепорта (бой стартует после подтверждения). */
  campaignEventTarget = -1
  /** Узлы-события, которые уже сработали (повторный вход — обычный бой). */
  campaignSpentEvents: number[] = []
  /** Просмотренные сюжетные терминалы по номерам Актов (1, 2, 3). */
  campaignTerminalsSeen: number[] = []
  /** Ожидаемый узел боя сразу после закрытия сюжетного терминала. */
  campaignPendingBattleNodeId: number | null = null
  /** Активный открытый магазин на карте забега (null — закрыт). */
  campaignShop: CampaignShopState | null = null
  /** Ассортименты магазинов по id узлов (для сохранения статуса купленных товаров). */
  campaignShops: Record<number, CampaignShopItem[]> = {}
  /** Временные бонусы и перки текущего забега кампании. */
  campaignPerks: {
    laserStart?: boolean
    wideStart?: boolean
    magnetStart?: boolean
    fireStart?: boolean
    coinBoost?: boolean
  } = {}
  /** Постоянные пассивные реликвии текущего забега кампании. */
  campaignRelics: {
    relicShield?: boolean
    relicSpark?: boolean
    relicFire?: boolean
    relicConverter?: boolean
  } = {}
  campaignSparkBounceCount = 0
  campaignPlayerId = -1
  campaignVisited: number[] = []
  campaignVisible: number[] = []
  /** Активные модификаторы (мутаторы) текущего забега кампании. */
  campaignModifiers: CampaignModifierId[] = []
  /** Активное квестовое испытание на текущем боевом узле карты. */
  activeChallenge: ActiveChallengeState | null = null
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
  settings: GameSettings = loadSettings()
  tacticalModules: TacticalModulesSettings = loadTacticalModules()
  unsubSettings?: () => void

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudData) => void, nick?: string) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no 2d context")
    this.ctx = ctx
    this.onHud = onHud
    if (nick) this.nick = nick
    this.fx.maxParticles = particleLimitForQuality(this.settings.graphicsQuality)
    this.unsubSettings = subscribeSettings((s) => {
      this.settings = s
      this.fx.maxParticles = particleLimitForQuality(s.graphicsQuality)
    })
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
  startGame(modifiers?: CampaignModifierId[]) {
    startGame(this, modifiers)
  }
  startLevelBattle(n: number) {
    startLevelBattle(this, n)
  }
  startEndless() {
    startEndless(this)
  }
  startCustomMap(spec: PlayerMapSpec, onComplete?: (result: "won" | "over") => void) {
    startCustomMap(this, spec, onComplete)
  }
  stopCustomMap() {
    stopCustomMap(this)
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
  nextMusicTrack() {
    this.sfx.ensure()
    this.sfx.nextTrack()
    pushHud(this)
  }
  toggleFps(): boolean {
    return toggleFps(this)
  }
  toggleHitboxes(): boolean {
    return toggleHitboxes(this)
  }
  toggleSlowMotion(): boolean {
    return toggleSlowMotion(this)
  }
  toggleInvincible(): boolean {
    return toggleInvincible(this)
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
  isAimGuideActive(): boolean {
    const hasUpgrade = (this.upgrades.aimGuide ?? 0) > 0
    const enabled = this.tacticalModules.aimGuide
    return (hasUpgrade && enabled) || this.debugEffects.has("aimGuide")
  }
  isBounceGuideActive(): boolean {
    if (!this.isAimGuideActive()) return false
    if ((this.upgrades.aimGuide ?? 0) > 0 && (this.upgrades.bounceGuide ?? 0) > 0) return true
    return this.debugEffects.has("bounceGuide")
  }
  setTacticalModule(key: keyof TacticalModulesSettings, val: boolean) {
    this.tacticalModules[key] = val
    saveTacticalModules(this.tacticalModules)
    pushHud(this)
  }
  toggleTacticalModule(key: keyof TacticalModulesSettings) {
    this.setTacticalModule(key, !this.tacticalModules[key])
  }
  enterMapNode(id: number) {
    enterMapNode(this, id)
  }
  dismissCampaignEvent() {
    dismissCampaignEvent(this)
  }
  dismissBossTransmission() {
    this.bossTransmission = null
    this.bossTransmissionTimer = 0
    pushHud(this)
  }
  dismissBossDialog() {
    this.dismissBossTransmission()
  }
  chooseCampaignEventOption(index: number) {
    chooseCampaignEventOption(this, index)
  }
  buyCampaignShopItem(itemId: string): boolean {
    return buyCampaignShopItem(this, itemId)
  }
  closeCampaignShop() {
    closeCampaignShop(this)
  }
  addCrystals(n: number) {
    const { crystalMultiplier } = computeRunMultipliers(this.campaignModifiers)
    const multiplied = Math.round(n * crystalMultiplier)
    this.crystals += multiplied
    this.crystalsRunTotal += multiplied
    pushHud(this)
  }
  enterNextNodeOnAction() {
    enterNextNodeOnAction(this)
  }
  buyUpgrade(id: string): boolean {
    return buyUpgrade(this, id)
  }
  buyCosmeticItem(category: CosmeticCategory, id: string): boolean {
    return buyCosmeticItem(this, category, id)
  }
  equipCosmeticItem(category: CosmeticCategory, id: string): boolean {
    return equipCosmeticItem(this, category, id)
  }
  resetAccountData() {
    this.coins = 0
    this.metaCrystals = 0
    this.cosmetics = {
      unlocked: [...DEFAULT_UNLOCKED_COSMETICS],
      equipped: { ...DEFAULT_EQUIPPED_COSMETICS },
    }
    this.bossCleanHits = 0
    this.crystals = 0
    this.crystalsRunTotal = 0
    this.upgrades = {}
    this.best = 0
    this.top = []
    this.topEndless = []
    this.score = 0
    this.combo = 0
    this.achQueue = []
    this.nick = ""
    applyUpgrades(this)
    saveProgress(this)
    clearAccountStorage()
    pushHud(this)
  }
  debugDamageUp() {
    debugDamageUp(this)
  }
  debugSkipLevel() {
    debugSkipLevel(this)
  }
  spawnDebugBoss(kind: BossVariantKind) {
    spawnDebugBoss(this, kind)
  }
  spawnDebugMiniboss(kind: MinibossKind) {
    spawnDebugMiniboss(this, kind)
  }
  spawnDebugSpecialBlocks() {
    spawnDebugSpecialBlocks(this)
  }
  setMusicVolume(v: number) {
    setMusicVolume(this, v)
  }
  setSfxVolume(v: number) {
    setSfxVolume(this, v)
  }
  continueFromIntermediateScore() {
    if (!this.intermediateScore) return
    const action = this.intermediateScoreContinue
    this.intermediateScore = null
    this.intermediateScoreContinue = null
    this.sfx.ui()
    action?.()
    pushHud(this)
  }
  launch() {
    launch(this)
  }
}
