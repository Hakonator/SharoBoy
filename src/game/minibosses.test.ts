import { describe, expect, it } from "vitest"

import {
  buildArmoredCrab,
  buildEel,
  buildFish,
  buildJelly,
  carveLevelBlocks,
  isMinibossWeakPart,
  minibossChance,
  minibossHpFor,
  MINIBOSS_DUET_SHIFT,
  MINIBOSS_HP_FIRST,
  MINIBOSS_HP_LAST,
  MINIBOSS_KINDS,
  MINIBOSS_LIFE_CHANCE,
  MINIBOSS_NODE_CHANCE,
  MINIBOSS_PITY_STEP,
  minibossName,
  rollMinibossLive,
  CRAB_ARMOR,
  CRAB_SHARD_COUNT,
  EEL_SWAY_PERIOD,
} from "./minibosses"
import { mulberry32 } from "./utils"
import { MAP_TIERS } from "./campaignMap"
import type { Block } from "./types"

const W = 960
const H = 640
const TOP = 120

/** Универсальные проверки собранного существа. */
function expectValidCreature(blocks: Block[]) {
  expect(blocks.length).toBeGreaterThan(0)
  for (const b of blocks) {
    expect(b.isMiniboss).toBe(true)
    expect(b.dead).toBe(false)
    expect([1, 2, 3]).toContain(b.hp)
    expect(b.tier).toBe(b.hp)
    expect(b.maxHp).toBe(b.hp)
    // существо целиком в пределах поля: ниже HUD-зоны, выше зоны ракетки
    expect(b.x - b.rx).toBeGreaterThan(0)
    expect(b.x + b.rx).toBeLessThan(W)
    expect(b.y - b.ry).toBeGreaterThan(TOP - 1)
    expect(b.y + b.ry).toBeLessThan(H * 0.85)
    // существует «плавание» и одна фаза на всё существо (цельность)
    expect(b.swayAmp).toBeGreaterThan(0)
    expect(b.swayPh).toBe(0)
  }
}

describe("minibosses", () => {
  it("рыба и медуза собираются в корректные существа", () => {
    expectValidCreature(buildFish(W, H, TOP))
    expectValidCreature(buildJelly(W, H, TOP))
  })

  it("у рыбы есть все части силуэта: тело, хвост, плавники и глаз", () => {
    const fish = buildFish(W, H, TOP)
    const partOf = (s: string) => fish.filter((b) => b.mbPart === s).length
    expect(partOf("body")).toBe(3)
    expect(partOf("tail")).toBe(3)
    expect(partOf("dorsal")).toBe(1)
    expect(partOf("pectoral")).toBe(1)
    expect(partOf("eye")).toBe(1)
  })

  it("у медузы купол с бахромой и пятью щупальцами-цепочками", () => {
    const jelly = buildJelly(W, H, TOP)
    expect(jelly.filter((b) => b.mbPart === "dome").length).toBe(2) // купол без лишних шариков
    expect(jelly.filter((b) => b.mbPart === "fringe").length).toBe(7) // бахрома
    expect(jelly.filter((b) => b.mbPart === "tentacle").length).toBe(20) // 5 × 4
    expect(new Set(jelly.filter((b) => b.mbPart === "tentacle").map((b) => b.tentacleId))).toEqual(
      new Set([0, 1, 2, 3, 4])
    )
  })

  it("пул HP существа: 20 на старте кампании, 100 в конце", () => {
    expect(MINIBOSS_HP_FIRST).toBe(20)
    expect(MINIBOSS_HP_LAST).toBe(100)
  })

  it("шанс жизни за минибосса — 80%", () => {
    expect(MINIBOSS_LIFE_CHANCE).toBe(0.8)
  })

  it("шанс появления растёт без минибосса и ограничен единицей", () => {
    expect(minibossChance(0)).toBe(MINIBOSS_NODE_CHANCE)
    expect(minibossChance(3)).toBeCloseTo(MINIBOSS_NODE_CHANCE + 3 * MINIBOSS_PITY_STEP)
    expect(minibossChance(10)).toBe(MINIBOSS_NODE_CHANCE + 10 * MINIBOSS_PITY_STEP)
    expect(minibossChance(100)).toBe(1)
    expect(minibossChance(-5)).toBe(MINIBOSS_NODE_CHANCE) // мусор на входе не ломает
  })

  it("rollMinibossLive: без появления жалость растёт, с появлением — сброс", () => {
    // rand() = 0.999 — всегда выше шанса: существо не появляется
    const miss = rollMinibossLive(2, () => 0.999)
    expect(miss.kinds).toEqual([])
    expect(miss.pity).toBe(3)
    // rand() = 0 — появление гарантировано, жалость обнуляется
    const hit = rollMinibossLive(5, () => 0)
    expect(hit.kinds.length).toBeGreaterThanOrEqual(1)
    expect(hit.pity).toBe(0)
  })

  it("rollMinibossLive: базовый шанс появления ≈ MINIBOSS_NODE_CHANCE", () => {
    const rng = mulberry32(4242)
    let hits = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      if (rollMinibossLive(0, rng).kinds.length) hits++
    }
    expect(hits / N).toBeGreaterThan(MINIBOSS_NODE_CHANCE - 0.05)
    expect(hits / N).toBeLessThan(MINIBOSS_NODE_CHANCE + 0.05)
  })

  it("rollMinibossLive: оба вида существ, дуэты бывают и реже одиночных", () => {
    const rng = mulberry32(777)
    const kinds = new Set<string>()
    let duets = 0
    let hits = 0
    for (let i = 0; i < 4000; i++) {
      const roll = rollMinibossLive(0, rng)
      if (!roll.kinds.length) continue
      hits++
      kinds.add(roll.kinds[0])
      if (roll.kinds.length === 2) duets++
    }
    expect(kinds).toEqual(new Set(MINIBOSS_KINDS))
    expect(duets).toBeGreaterThan(0)
    expect(duets / hits).toBeLessThan(0.5)
  })

  it("в дуэте всегда два РАЗНЫХ существа из пула", () => {
    // последовательность: появление → вид №0 (рыба) → дуэт сработал
    const seq = [0, 0, 0]
    let i = 0
    const duet = rollMinibossLive(0, () => seq[i++])
    expect(duet.kinds).toEqual(["fish", "jelly"])
    expect(duet.kinds[0]).not.toBe(duet.kinds[1])
    // появление → вид №3 (угорь) → дуэта нет
    const seq2 = [0, 0.9, 0.9]
    i = 0
    const single = rollMinibossLive(0, () => seq2[i++])
    expect(single.kinds).toEqual(["slippery_eel"])
  })

  it("HP минибосса плавно растёт от 20 на первых ярусах до 100 в конце", () => {
    // первый боевой ярус — стартовый пул, последний боевой — максимум
    expect(minibossHpFor(1, MAP_TIERS)).toBe(MINIBOSS_HP_FIRST)
    expect(minibossHpFor(MAP_TIERS - 2, MAP_TIERS)).toBe(MINIBOSS_HP_LAST)
    // монотонный неубывающий рост между ярусами
    for (let t = 2; t < MAP_TIERS; t++) {
      expect(minibossHpFor(t, MAP_TIERS)).toBeGreaterThanOrEqual(minibossHpFor(t - 1, MAP_TIERS))
    }
    // рост плавный: не больше 5 HP за ярус (шаг ≈ 3 при 28 боевых ярусах)
    for (let t = 2; t <= MAP_TIERS - 2; t++) {
      expect(minibossHpFor(t, MAP_TIERS) - minibossHpFor(t - 1, MAP_TIERS)).toBeLessThanOrEqual(5)
    }
    // значения кратны 5 — ровные деления HP-полоски
    for (let t = 1; t <= MAP_TIERS; t++) expect(minibossHpFor(t, MAP_TIERS) % 5).toBe(0)
    // середина кампании — примерно посередине диапазона
    const mid = minibossHpFor(Math.ceil((MAP_TIERS - 2) / 2), MAP_TIERS)
    expect(mid).toBeGreaterThanOrEqual(55)
    expect(mid).toBeLessThanOrEqual(65)
    // мусор на входе зажимается в границы диапазона
    expect(minibossHpFor(-3, MAP_TIERS)).toBe(MINIBOSS_HP_FIRST)
    expect(minibossHpFor(MAP_TIERS + 5, MAP_TIERS)).toBe(MINIBOSS_HP_LAST)
    // вырожденная карта не делит на ноль
    expect(minibossHpFor(1, 1)).toBe(MINIBOSS_HP_FIRST)
  })

  it("carveLevelBlocks убирает только blocks, налегающие на существо", () => {
    const creature = buildFish(W, H, TOP)
    const inside: Block = {
      ...creature[0],
      x: creature[0].x,
      y: creature[0].y,
      rx: 40,
      ry: 40,
      isMiniboss: false,
      mbGroup: undefined,
      mbPart: undefined,
    }
    const far: Block = {
      ...creature[0],
      x: 60,
      y: H - 120,
      rx: 15,
      ry: 15,
      isMiniboss: false,
      mbGroup: undefined,
      mbPart: undefined,
    }
    const kept = carveLevelBlocks([inside, far], creature)
    expect(kept).toEqual([far])
  })

  it("не вырезает близкие блоки вне реального эллипса части существа", () => {
    const body = buildFish(W, H, TOP)[0]
    const creature = [body]
    const near: Block = {
      ...body,
      x: body.x + body.rx + 4 + 4,
      y: body.y,
      rx: 4,
      ry: 4,
      isMiniboss: false,
      mbGroup: undefined,
      mbPart: undefined,
    }
    expect(carveLevelBlocks([near], creature)).toEqual([near])
  })

  it("carveLevelBlocks не трогает блоки другого существа (дуэт)", () => {
    // Регресс «невидимой медузы»: даже если второе существо налегает на первое,
    // вырезаются только ОБЫЧНЫЕ блоки уровня, чужой силуэт остаётся целым.
    const fish = buildFish(W, H, TOP) // центр по умолчанию — та же точка, где родится медуза
    const jelly = buildJelly(W, H, TOP)
    expect(carveLevelBlocks(fish, jelly)).toEqual(fish)
    expect(carveLevelBlocks(jelly, fish)).toEqual(jelly)
  })

  it("дуэт со сдвигом MINIBOSS_DUET_SHIFT не налегает на первое существо", () => {
    const fish = buildFish(W, H, TOP)
    const jelly = buildJelly(W, H, TOP, 0, W / 2 + W * MINIBOSS_DUET_SHIFT)
    // ни один блок медузы не пересекается с блоками рыбы (с запасом carve-а)
    const pad = 6
    for (const c of jelly) {
      for (const f of fish) {
        const dx = c.x - f.x
        const dy = c.y - f.y
        const rr = Math.max(f.rx, f.ry) + c.rx + pad
        expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(rr * rr)
      }
    }
  })

  it("buildFish/buildJelly принимают кастомный центр (дуэт)", () => {
    const fish = buildFish(W, H, TOP, 0, W / 2 + W * MINIBOSS_DUET_SHIFT)
    const body = fish.filter((b) => b.mbPart === "body")
    const cx = body.reduce((s, b) => s + b.x, 0) / body.length
    expect(cx).toBeCloseTo(W / 2 + W * MINIBOSS_DUET_SHIFT)
    const jelly = buildJelly(W, H, TOP, 0, W * 0.3)
    const dome = jelly.filter((b) => b.mbPart === "dome")
    expect(dome[0].x).toBeCloseTo(W * 0.3)
  })

  it("имена существ заданы", () => {
    expect(minibossName("fish")).toBe("РЫБА-ШАР")
    expect(minibossName("jelly")).toBe("МЕДУЗА")
    expect(minibossName("armored_crab")).toBe("ПАНЦИРНЫЙ КРАБ")
    expect(minibossName("slippery_eel")).toBe("СКОЛЬЗКИЙ УГОРЬ")
  })
})

describe("T-058: новые минибоссы", () => {
  it("пул видов фиксирован: классическая пара остаётся первыми двумя", () => {
    // Порядок — контракт: выбор идёт по индексу, старые карты должны играться
    // так же, поэтому новые виды только дописываются в конец.
    expect(MINIBOSS_KINDS.slice(0, 2)).toEqual(["fish", "jelly"])
    expect(MINIBOSS_KINDS).toEqual(["fish", "jelly", "armored_crab", "slippery_eel"])
  })

  it("оба новых вида собираются в корректные существа", () => {
    expectValidCreature(buildArmoredCrab(W, H, TOP))
    expectValidCreature(buildEel(W, H, TOP))
  })

  it("у краба есть корпус, панцирь, две клешни, щель и глаза", () => {
    const crab = buildArmoredCrab(W, H, TOP)
    const partOf = (s: string) => crab.filter((b) => b.mbPart === s).length
    expect(partOf("crab_body")).toBe(3)
    expect(partOf("shell")).toBe(3)
    expect(partOf("claw")).toBe(2)
    expect(partOf("gap")).toBe(1)
    expect(partOf("eye")).toBe(2)
    // щель — уязвимая точка, остальные части бронированы
    expect(isMinibossWeakPart("gap")).toBe(true)
    expect(isMinibossWeakPart("shell")).toBe(false)
    expect(isMinibossWeakPart("claw")).toBe(false)
  })

  it("у угря есть нос, цепочка сегментов и хвост", () => {
    const eel = buildEel(W, H, TOP)
    expect(eel.filter((b) => b.mbPart === "eel_head").length).toBe(1)
    expect(eel.filter((b) => b.mbPart === "eel_seg").length).toBe(7)
    // Хвост — один блок: прежние две «лопасти» рисовались как ножницы.
    expect(eel.filter((b) => b.mbPart === "eel_fin").length).toBe(1)
    // сегменты идут от головы к хвосту без разрывов
    const segs = eel
      .filter((b) => b.mbPart === "eel_seg")
      .map((b) => b.x)
      .sort((a, b) => b - a)
    expect(segs[0]).toBeGreaterThan(segs[segs.length - 1])
    // Шаг между сегментами равномерный. Конкретное число не фиксируем:
    // оно подбиралось по пропорциям силуэта (SEG_STEP, см. buildEel) и
    // менялось 04.11.2026 с 20 на 26 — «угорь» при 20 был 4.7:1, слишком
    // толстый. Тест держит инвариант равномерности, а не балансное число.
    const step = segs[0]! - segs[1]!
    expect(step).toBeGreaterThan(0)
    for (let i = 1; i < segs.length; i++) expect(segs[i - 1] - segs[i]).toBeCloseTo(step, 5)
  })

  it("угорь вытянутый: длина тела заметно больше толщины", () => {
    const eel = buildEel(W, H, TOP)
    const left = Math.min(...eel.map((b) => b.x - b.rx))
    const right = Math.max(...eel.map((b) => b.x + b.rx))
    const thickness = Math.max(...eel.map((b) => b.ry)) * 2
    // 4.7:1 читалось как «головастик», а не угорь: при такой пропорции любой
    // профиль носа выглядит сигарой с шипом (разбор 04.11.2026).
    // Порог 5.5 отсекает регресс к прежним пропорциям, не фиксируя точное
    // значение — оно ограничено мобильной шириной экрана.
    expect((right - left) / thickness).toBeGreaterThan(5.5)
  })

  it("силуэт угря зеркально симметричен — разворот не разъезжается с хитбоксами", () => {
    const eel = buildEel(W, H, TOP)
    const cx =
      (Math.min(...eel.map((b) => b.x - b.rx)) + Math.max(...eel.map((b) => b.x + b.rx))) / 2
    const geo = (dx: number, rx: number, ry: number) => `${dx.toFixed(3)}|${rx}|${ry}`
    const present = new Set(eel.map((b) => geo(b.x - cx, b.rx, b.ry)))
    // Рендер отражает силуэт по mbFacing: у каждой части обязана быть
    // зеркальная пара того же размера, иначе голова «уедет» с хитбокса.
    for (const b of eel) {
      expect(present.has(geo(cx - b.x, b.rx, b.ry))).toBe(true)
    }
    // нос и хвост — один размер
    const head = eel.find((b) => b.mbPart === "eel_head")!
    const fin = eel.find((b) => b.mbPart === "eel_fin")!
    expect(fin.rx).toBe(head.rx)
    expect(fin.ry).toBe(head.ry)
  })

  it("три пластины панциря посажены вплотную — единый купол без зазоров", () => {
    const shells = buildArmoredCrab(W, H, TOP)
      .filter((b) => b.mbPart === "shell")
      .sort((a, b) => a.x - b.x)
    expect(shells).toHaveLength(3)
    for (let i = 1; i < shells.length; i++) {
      const gap = shells[i]!.x - shells[i - 1]!.x - (shells[i - 1]!.rx + shells[i]!.rx)
      // Пластины обязаны ПЕРЕКРЫВАТЬСЯ: с прежним шагом 40 при радиусах 24–27
      // между щитками оставался просвет, и панцирь читался как три отдельные
      // «ракушки» (замечание 04.11.2026). Проверяем именно зазор кромок, а не
      // шаг центров: шаг больше радиуса ещё не значит «плотно».
      expect(gap).toBeLessThan(0)
      expect(gap).toBeGreaterThan(-24)
    }
  })

  it("балансовые числа новых видов зафиксированы", () => {
    expect(CRAB_ARMOR).toBe(3)
    expect(CRAB_SHARD_COUNT).toBe(2)
    // Угорь плавает маятником через всё поле; период задаёт «ровность» хода.
    // 9 / 0.7 — скорость снижена на 30% относительно периода 9 (04.11.2026).
    expect(EEL_SWAY_PERIOD).toBeCloseTo(12.857, 2)
    // Один проход от стены к стене — около 6.4 с: не дёрганье и не вялость.
    expect(EEL_SWAY_PERIOD / 2).toBeGreaterThan(4.5)
    expect(EEL_SWAY_PERIOD / 2).toBeLessThan(9)
  })

  it("у угря нет рывка: размах равен ширине поля и клампится по стенам", () => {
    // Амплитуда намеренно больше реального хода: `stepBlock` ужимает её до
    // свободного места, поэтому существо доходит ровно до стен при любой
    // ширине. Если задать размах «на глаз», на телефоне угорь будет плавать
    // в пятачке в центре (жалоба игрока 04.11.2026).
    for (const w of [400, 768, 1280, 1920]) {
      const eel = buildEel(w, H, TOP)
      expect(eel.every((b) => b.swayAmp >= w / 2)).toBe(true)
      expect(eel.every((b) => b.swayFreq === (Math.PI * 2) / EEL_SWAY_PERIOD)).toBe(true)
      // Период осмысленный: проход от стены к стене занимает от 2 до 10 с.
      const halfPeriod = Math.PI / (eel[0]!.swayFreq || 1)
      expect(halfPeriod).toBeGreaterThan(2)
      expect(halfPeriod).toBeLessThan(10)
    }
  })

  it("каждый вид пула достижим при фиксированной последовательности rand", () => {
    // индекс вида = floor(rand * 4): 0 → fish, 0.3 → jelly, 0.55 → crab, 0.9 → eel
    const cases: [number, string][] = [
      [0.05, "fish"],
      [0.3, "jelly"],
      [0.55, "armored_crab"],
      [0.9, "slippery_eel"],
    ]
    for (const [kindRoll, expected] of cases) {
      const seq = [0, kindRoll, 0.9]
      let i = 0
      const roll = rollMinibossLive(0, () => seq[i++]!)
      expect(roll.kinds).toEqual([expected])
    }
  })
})
