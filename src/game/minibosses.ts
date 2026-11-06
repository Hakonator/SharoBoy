/**
 * Мини-боссы кампании: стилизованные обитатели водной фауны (рыба, медуза),
 * собранные из перекрывающихся эллипсов в цельный силуэт. Блоки существа
 * неразрушаемы — урон идёт в пул HP каждого существа (от MINIBOSS_HP_FIRST на
 * первых ярусах до MINIBOSS_HP_LAST в конце кампании), над существом рисуется полоска
 * здоровья; при обнулении пула существо взрывается целиком. Появляются в
 * обычных боевых узлах кампании полностью случайно (иногда парой) с
 * pity-системой: пока существо не встретилось, шанс растёт, после появления —
 * снова базовый. За уничтожение полагается жизнь с шансом MINIBOSS_LIFE_CHANCE
 * — других источников жизней в кампании нет.
 *
 * Чистые функции без обращений к движку — модуль тестируется автономно.
 */
import type { Block, MinibossKindId } from "./types"
import { clamp, rand } from "./utils"

export type MinibossKind = MinibossKindId

/**
 * Порядок видов фиксирован: `rollMinibossLive` выбирает вид по индексу
 * `floor(rng() * MINIBOSS_KINDS.length)`, поэтому перестановка поменяла бы
 * исход уже сгенерированных карт. Новые виды **дописываются в конец**.
 */
export const MINIBOSS_KINDS: readonly MinibossKind[] = [
  "fish",
  "jelly",
  "armored_crab",
  "slippery_eel",
]

export const DEFEATED_MINIBOSSES_KEY = "sharoboy-defeated-minibosses"

/** Загрузить список поверженных видов минибоссов из localStorage. */
export function loadDefeatedMinibosses(): MinibossKind[] {
  try {
    const raw = localStorage.getItem(DEFEATED_MINIBOSSES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((k): k is MinibossKind => MINIBOSS_KINDS.includes(k as MinibossKind))
  } catch {
    return []
  }
}

/** Сохранить список поверженных видов минибоссов в localStorage. */
export function saveDefeatedMinibosses(kinds: readonly MinibossKind[]): void {
  try {
    localStorage.setItem(DEFEATED_MINIBOSSES_KEY, JSON.stringify(Array.from(new Set(kinds))))
  } catch {
    /* приватный режим */
  }
}

/** Шанс появления минибосса в обычном узле кампании (≈20%). */
export const MINIBOSS_NODE_CHANCE = 0.2
/** Шанс, что в узле появятся сразу ДВА существа (рыба + медуза). */
export const MINIBOSS_DUET_CHANCE = 0.25
/** Шанс дропа жизни за полностью уничтоженного минибосса. */
export const MINIBOSS_LIFE_CHANCE = 0.8
/** Горизонтальный сдвиг центра ВТОРОГО существа дуэта (доля ширины поля). */
export const MINIBOSS_DUET_SHIFT = 0.22

const NAMES: Record<MinibossKind, string> = {
  fish: "РЫБА-ШАР",
  jelly: "МЕДУЗА",
  armored_crab: "ПАНЦИРНЫЙ КРАБ",
  slippery_eel: "СКОЛЬЗКИЙ УГОРЬ",
}

export function minibossName(kind: MinibossKind): string {
  return NAMES[kind]
}

/** Шаг роста шанса за каждый бой подряд без минибосса (pity-система). */
export const MINIBOSS_PITY_STEP = 0.08

/**
 * Текущий шанс появления минибосса: базовый MINIBOSS_NODE_CHANCE плюс
 * MINIBOSS_PITY_STEP за каждый бой подряд без появления, но не больше 1.
 */
export function minibossChance(pity: number): number {
  return Math.min(1, MINIBOSS_NODE_CHANCE + Math.max(0, pity) * MINIBOSS_PITY_STEP)
}

/**
 * Полностью случайный ролл минибоссов для боевого узла (вызывается прямо в
 * момент старта боя). Пока существо не появляется, шанс растёт на
 * MINIBOSS_PITY_STEP за бой; когда появилось — возвращается к базовому.
 * Обычно одно существо, с шансом MINIBOSS_DUET_CHANCE — пара (рыба + медуза).
 * @param pity сколько боёв подряд прошло без минибосса
 * @param rand источник случайности (по умолчанию Math.random; для тестов
 *   можно передать детерминированный ГПСЧ)
 * @returns виды существ в узле и новое значение жалости
 */
export function rollMinibossLive(
  pity: number,
  rand: () => number = Math.random
): { kinds: MinibossKind[]; pity: number } {
  if (rand() >= minibossChance(pity)) return { kinds: [], pity: Math.max(0, pity) + 1 }
  // Вид выбирается по индексу в фиксированном пуле MINIBOSS_KINDS.
  const idx = Math.min(
    MINIBOSS_KINDS.length - 1,
    Math.max(0, Math.floor(rand() * MINIBOSS_KINDS.length))
  )
  const kind = MINIBOSS_KINDS[idx]!
  if (rand() < MINIBOSS_DUET_CHANCE) {
    // Второй вид — следующий по кругу: в дуэте всегда два РАЗНЫХ существа.
    const other = MINIBOSS_KINDS[(idx + 1) % MINIBOSS_KINDS.length]!
    return { kinds: [kind, other], pity: 0 }
  }
  return { kinds: [kind], pity: 0 }
}

/** Стартовый пул HP существа на первом боевом ярусе кампании. */
export const MINIBOSS_HP_FIRST = 20
/** Пул HP существа на последнем боевом ярусе перед финальным боссом. */
export const MINIBOSS_HP_LAST = 100

/**
 * HP минибосса на ярусе: плавный линейный рост от MINIBOSS_HP_FIRST на первом
 * боевом ярусе (tier 1) до MINIBOSS_HP_LAST на последнем боевом ярусе перед
 * финальным боссом — чем дальше по карте, тем жирнее существа. Значение
 * округляется до 5, чтобы деления HP-полоски оставались ровными.
 */
export function minibossHpFor(tier: number, tiers: number): number {
  const progress = clamp((tier - 1) / Math.max(1, tiers - 3), 0, 1)
  const hp = MINIBOSS_HP_FIRST + (MINIBOSS_HP_LAST - MINIBOSS_HP_FIRST) * progress
  return Math.round(hp / 5) * 5
}

/** Фабрика части существа: эллипс с наклоном, «плавание» через sway. */
function makePart(opts: {
  x: number
  y: number
  rx: number
  ry: number
  rot?: number
  tier: 1 | 2 | 3
  part: Block["mbPart"]
  swayAmp: number
  swayFreq: number
  bobAmp?: number
  bobFreq?: number
  bobPh?: number
  group?: number
  tentacleId?: number
  tentacleSeg?: number
}): Block {
  return {
    x: opts.x,
    y: opts.y,
    rx: opts.rx,
    ry: opts.ry,
    rot: opts.rot ?? 0,
    circle: Math.abs(opts.rx - opts.ry) < 0.6 && !(opts.rot ?? 0),
    hp: opts.tier,
    maxHp: opts.tier,
    tier: opts.tier,
    flash: 0,
    seed: rand(0, Math.PI * 2),
    dead: false,
    x0: opts.x,
    y0: opts.y,
    swayAmp: opts.swayAmp,
    swayFreq: opts.swayFreq,
    swayPh: 0, // одна фаза на всё существо — плывёт как единое целое
    bobAmp: opts.bobAmp ?? 0,
    bobFreq: opts.bobFreq ?? 0,
    bobPh: opts.bobPh ?? 0,
    bomb: false,
    splits: false,
    isMiniboss: true,
    mbGroup: opts.group ?? 0,
    mbPart: opts.part,
    tentacleId: opts.tentacleId,
    tentacleSeg: opts.tentacleSeg,
  }
}

/**
 * Рыба: обтекаемое тело из перекрывающихся эллипсов, раздвоенный хвост,
 * спинной и грудной плавники, глаз. Плывёт носом вправо, патрулирует поле.
 * Тиры: тело — 2 (золото), плавники — 1 (зелень), глаз — 3 (акцент).
 */
export function buildFish(w: number, h: number, top: number, group = 0, cx = w / 2): Block[] {
  void h
  const cy = top + 165
  // патрулирует всё поле: амплитуда — почти до стен (с запасом на нос и хвост),
  // частота низкая — неспешное движение
  const S = { swayAmp: Math.max(26, w / 2 - 110), swayFreq: 0.15 }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, group, ...S })
  return [
    // тело: три эллипса, сужающиеся к хвосту и к носу
    p(0, 0, 52, 30, 2, "body"),
    p(-36, 3, 38, 24, 2, "body"),
    p(36, -3, 38, 24, 2, "body"),
    // широкий и низкий раздвоенный хвост
    p(-52, 0, 14, 10, 1, "tail"),
    p(-72, -1, 26, 5, 1, "tail", -0.55),
    p(-72, 1, 26, 5, 1, "tail", 0.55),
    // массивный спинной плавник
    p(-2, -36, 26, 12, 1, "dorsal"),
    // грудной плавник
    p(16, 18, 18, 10, 1, "pectoral", 0.5),
    // глаз
    p(46, -10, 5, 5, 3, "eye"),
  ]
}

/**
 * Медуза: пышный купол с бахромой по нижнему краю и пятью щупальцами-цепочками.
 * Тиры: купол — 3 (розовый), щупальца — 1 (зелень).
 */
export function buildJelly(w: number, h: number, top: number, group = 0, cx = w / 2): Block[] {
  const cy = top + 160
  // Медленный патруль влево-вправо (без разворота) + вертикальный дрейф со
  // случайной фазой и некратной частотой — траектория выглядит случайной,
  // но ограничена: щупальца не опускаются ниже ~65% высоты поля.
  const bobAmp = Math.max(10, Math.min(28, h * 0.65 - cy - 90))
  const S = {
    swayAmp: Math.max(14, w / 2 - 56),
    swayFreq: 0.18,
    bobAmp,
    bobFreq: 0.1 + rand(0, 0.05),
    bobPh: rand(0, Math.PI * 2),
  }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, group, ...S })
  const blocks: Block[] = [
    // купол: большой эллипс плюс «наползание» сверху
    p(0, 0, 48, 34, 3, "dome"),
    p(0, -12, 40, 26, 3, "dome"),
  ]
  // бахрома по нижнему краю купола
  for (let i = -3; i <= 3; i++) blocks.push(p(i * 12, 24, 8, 8, 3, "fringe"))
  // щупальца: пять цепочек из четырёх шариков с лёгким изгибом
  for (let t = 0; t < 5; t++) {
    const tx = -32 + t * 16
    for (let s = 0; s < 4; s++) {
      blocks.push(
        makePart({
          x: cx + tx + (s % 2 ? 3 : -3),
          y: cy + 36 + s * 14,
          rx: 6.5,
          ry: 6.5,
          tier: 1,
          part: "tentacle",
          group,
          tentacleId: t,
          tentacleSeg: s,
          ...S,
        })
      )
    }
  }
  return blocks
}

/* ---------- «Панцирный краб» и «Скользкий угорь» (T-058) ---------- */

/** Броня «Панцирного краба»: сколько единиц урона гасит панцирь до первого пролома. */
export const CRAB_ARMOR = 3
/** Сколько осколков-снарядов вылетает из панциря при его разрушении. */
export const CRAB_SHARD_COUNT = 2
/** Скорость осколков-снарядов, px/с. */
export const CRAB_SHARD_SPEED = 250

/**
 * Период полного прохода угря туда-обратно, с.
 *
 * Скорость существа пропорциональна `amp · freq`, то есть обратно
 * пропорциональна периоду: чтобы сбавить ход на 30%, период нужно УМНОЖИТЬ
 * на 1/0.7 ≈ 1.43, а не на 1.3. `9 / 0.7 = 12.86` → один проход от стены к
 * стене занимает 6.4 с (было 4.5 с при периоде 9).
 */
export const EEL_SWAY_PERIOD = 9 / 0.7

/**
 * «Панцирный краб»: приземистый корпус, три панцирные пластины сверху,
 * две клешни по бокам и узкая щель между ними — единственная уязвимая точка,
 * пока броня цела. Панцирь — тир 3 (розовый), корпус и клешни — 2, щель — 1.
 */
export function buildArmoredCrab(
  w: number,
  h: number,
  top: number,
  group = 0,
  cx = w / 2
): Block[] {
  const cy = Math.min(top + 175, h * 0.42)
  const S = { swayAmp: Math.max(20, w / 2 - 150), swayFreq: 0.13 }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, group, ...S })
  return [
    // корпус: широкий низкий овал
    p(0, 10, 62, 26, 2, "crab_body"),
    p(-30, 6, 34, 22, 2, "crab_body"),
    p(30, 6, 34, 22, 2, "crab_body"),
    // панцирь: ТРИ пластины, посаженные ВПЛОТНУЮ (шаг 34 при rx 24-27) —
    // единый купол с двумя швами. С прежним шагом 40 между щитками оставался
    // зазор, и панцирь читался как три отдельные «ракушки» (замечание 04.11.2026).
    p(-34, -12, 24, 14, 3, "shell", -0.2),
    p(0, -17, 27, 16, 3, "shell"),
    p(34, -12, 24, 14, 3, "shell", 0.2),
    // клешни на вынесенных предплечьях: пинцер смотрит наружу-вниз
    p(-88, 2, 26, 17, 2, "claw", -0.35),
    p(88, 2, 26, 17, 2, "claw", 0.35),
    // щель — поперечная выемка в нижней части корпуса между клешнями
    p(0, 22, 15, 7, 1, "gap"),
    // глаза на стебельках
    p(-16, -34, 6, 6, 3, "eye"),
    p(16, -34, 6, 6, 3, "eye"),
  ]
}

/**
 * «Скользкий угорь»: вытянутое тело из цепочки сегментов, голова с пастью
 * и глазом, хвостовой плавник. Рывок в сторону ракетки делает его неуязвимым.
 *
 * Силуэт собран **зеркально симметричным относительно своего центра**:
 * нос (`eel_head`) и хвост (`eel_fin`) — блоки одного размера, радиусы
 * сегментов симметричны. Рендер отражает силуэт по `mbFacing` (нос всегда
 * по ходу движения), и при развороте картинка остаётся на тех же эллипсах,
 * что и физика. Асимметричный силуэт давал расхождение: нарисованная голова
 * оказывалась там, где хитбокса нет, а у стены существо не разворачивалось.
 */
export function buildEel(w: number, h: number, top: number, group = 0, cx = w / 2): Block[] {
  const cy = Math.min(top + 160, h * 0.4)
  /**
   * Патруль угря — **равномерный проход от стены до стены**.
   *
   * История (жалоба игрока 04.11.2026): сначала размах брался из свободного
   * места поля, и угорь проносился через экран за 2 с; затем его ужали до
   * `swayAmp` (±150), и он «плавал в маленьком пятачке в центре, не доплывая
   * до краёв». Обе крайности — следствие подбора числа наугад.
   *
   * Теперь амплитуда намеренно максимальная: `stepBlock` клампит её по
   * свободному месту поля, так что существо доходит ровно до стен и
   * разворачивается. Плавность даёт не амплитуда, а период: `EEL_SWAY_PERIOD`
   * задаёт 4.5 с на один проход.
   */
  const S = { swayAmp: w, swayFreq: (Math.PI * 2) / EEL_SWAY_PERIOD }
  const p = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    tier: 1 | 2 | 3,
    part: Block["mbPart"],
    rot?: number
  ) => makePart({ x: cx + x, y: cy + y, rx, ry, tier, part, rot, group, ...S })
  /**
   * Полурадиусы сегментов от носа к хвосту. Массив **зеркально симметричен**
   * (radius[i] === radius[last-i]): силуэт отражается по `mbFacing`, и
   * отражение обязано попадать на те же эллипсы, иначе голова съедет с
   * хитбокса. Поэтому тело толще всего в центре и тоньше к ОБОИМ концам —
   * при развороте картинка читается одинаково правильно.
   */
  const SEG_RADII = [9, 13, 15.5, 17, 15.5, 13, 9] as const
  /**
   * Шаг между центрами сегментов, px.
   *
   * 20 давал отношение длины к толщине 4.7:1 — это не угорь, а «головастик»:
   * при такой пропорции любой профиль носа читается как сигара с шипом
   * (разбор на стенде `scripts/preview-eel-proportions.mjs`, 04.11.2026).
   * 26 даёт ≈6:1 — силуэт уже вытянутый, но на телефоне (ширина 360-400 px)
   * угорь не занимает весь экран. Шаг 40 (9.4:1) красивее в стенде, но
   * физически не влезает в мобильную ширину.
   */
  const SEG_STEP = 26
  /** Нос и хвост — один размер: иначе отражение разъедется с хитбоксами. */
  const CAP_RX = 19
  const CAP_RY = 15
  const half = ((SEG_RADII.length - 1) / 2) * SEG_STEP
  const noseX = half + SEG_STEP
  const blocks: Block[] = [p(noseX, 0, CAP_RX, CAP_RY, 3, "eel_head")]
  for (let i = 0; i < SEG_RADII.length; i++) {
    const x = half - i * SEG_STEP
    // лёгкая дуга спины, тоже симметричная относительно центра тела
    const y = -3 * (1 - (x / noseX) ** 2)
    const rx = SEG_RADII[i]!
    blocks.push(p(x, y, rx, rx - 1.5, 1, "eel_seg"))
  }
  blocks.push(p(-noseX, 0, CAP_RX, CAP_RY, 1, "eel_fin"))
  return blocks
}

/** Части существа, попадание в которые считается попаданием в уязвимую точку. */
export function isMinibossWeakPart(part: Block["mbPart"]): boolean {
  return part === "gap"
}

function ellipsesOverlap(a: Block, b: Block, pad = 2): boolean {
  const rx = a.rx + b.rx + pad
  const ry = a.ry + b.ry + pad
  if (rx <= 0 || ry <= 0) return true
  const dx = (a.x - b.x) / rx
  const dy = (a.y - b.y) / ry
  return dx * dx + dy * dy < 1
}

/**
 * Убирает только блоки, реально пересекающие эллипсы существа, —
 * силуэт минибосса остаётся аккуратным, соседние блоки сохраняют фигуру.
 * Блоки ДРУГИХ существ (дуэт) не трогает: перекрытие двух существ во время
 * патруля допустимо, а вырезание частей чужого силуэта ломало рендер —
 * существо оставалось в g.minibosses с HP-полоской, но становилось невидимым.
 */
export function carveLevelBlocks(level: Block[], creature: Block[]): Block[] {
  return level.filter((b) => b.isMiniboss === true || !creature.some((c) => ellipsesOverlap(b, c)))
}
