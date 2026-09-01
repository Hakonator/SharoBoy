/**
 * Спецификации уровней кампании: типы описаний, авторская раскладка
 * «СТРЕЛА» и список уровней (последний — босс «ЦАРЬ-ШАР»).
 */

interface BaseSpec {
  name: string
  speed: number
}
export interface LayoutItem {
  x: number
  y: number
  rx: number
  ry?: number
  hp: 1 | 2 | 3
  bomb?: boolean
  splits?: boolean
  rot?: number
}
interface LayoutSpec extends BaseSpec {
  layout: LayoutItem[]
}
export interface PatternSpec extends BaseSpec {
  rows: number
  counts: number[]
  shape: (r: number, i: number) => "circle" | "eh" | "ev"
  hp: (r: number, i: number) => 1 | 2 | 3
}
interface BossSpec extends BaseSpec {
  boss: { hp: number; minions: number; bombs: number }
}
export type LevelSpec = PatternSpec | LayoutSpec | BossSpec

/** «СТРЕЛА» — плотная авторская раскладка первого уровня. */
const ARROW_LAYOUT: LayoutItem[] = [
  // верхняя полоса мелких шаров
  ...Array.from({ length: 13 }, (_, i): LayoutItem => ({
    x: -3.6 + i * 0.6,
    y: 0.55,
    rx: 0.3,
    hp: 1,
  })),
  // широкие наклонённые «крылья»
  { x: -2.6, y: 1.8, rx: 1.35, ry: 0.55, hp: 2, rot: -0.32 },
  { x: 2.6, y: 1.8, rx: 1.35, ry: 0.55, hp: 2, rot: 0.32 },
  // ядро стрелы
  { x: -0.9, y: 1.7, rx: 0.42, hp: 1 },
  { x: 0.9, y: 1.7, rx: 0.42, hp: 1 },
  { x: -0.45, y: 2.6, rx: 0.42, hp: 2 },
  { x: 0.45, y: 2.6, rx: 0.42, hp: 2 },
  { x: 0, y: 3.5, rx: 0.45, hp: 3 },
  // «матрёшки» у основания крыльев
  { x: -3.6, y: 2.7, rx: 0.5, hp: 2, splits: true },
  { x: 3.6, y: 2.7, rx: 0.5, hp: 2, splits: true },
  // наклонённые стабилизаторы
  { x: -2.9, y: 4.4, rx: 0.42, ry: 0.8, hp: 1, rot: -0.25 },
  { x: 2.9, y: 4.4, rx: 0.42, ry: 0.8, hp: 1, rot: 0.25 },
  // нос-остриё
  { x: 0, y: 5.1, rx: 0.58, ry: 1.2, hp: 3 },
  // нижняя «матрёшка»
  { x: 0, y: 7.3, rx: 0.5, hp: 2, splits: true },
  // мелкие заполнители
  { x: -2.2, y: 1.5, rx: 0.32, hp: 1 },
  { x: 2.2, y: 1.5, rx: 0.32, hp: 1 },
  { x: -2.9, y: 2.9, rx: 0.3, hp: 1 },
  { x: 2.9, y: 2.9, rx: 0.3, hp: 1 },
  { x: -3.3, y: 3.7, rx: 0.3, hp: 1 },
  { x: 3.3, y: 3.7, rx: 0.3, hp: 1 },
  // бомбы у основания стрелы (только круглые)
  { x: -2.6, y: 6.6, rx: 0.42, hp: 1, bomb: true },
  { x: 2.6, y: 6.6, rx: 0.42, hp: 1, bomb: true },
]

export const LEVELS: LevelSpec[] = [
  { name: "СТРЕЛА", speed: 380, layout: ARROW_LAYOUT },
  {
    name: "ОВАЛЬНЫЙ РИФ",
    rows: 6,
    counts: [7, 8, 9, 9, 8, 7],
    shape: (r, i) => ((r + i) % 2 === 0 ? (r % 2 ? "ev" : "eh") : "circle"),
    hp: (r) => (r < 2 ? 2 : r < 4 ? (Math.random() < 0.5 ? 2 : 1) : 1),
    speed: 440,
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
]
