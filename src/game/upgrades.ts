/* ---------- Система прокачки (ПОСТОЯННЫЕ улучшения, действуют между партиями) ----------
   Монеты выпадают из блоков и бонусов; за них покупаются улучшения.
   Уровни апгрейдов хранятся в localStorage и применяются на старте партии. */

export const UPGRADES_ENABLED = true

export interface UpgradeDef {
  id: string
  name: string
  desc: string
  max: number
  cost: (level: number) => number
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: "paddle",
    name: "Широкий размах",
    desc: "Ракетка на +12% за уровень — легче отбивать под острым углом.",
    max: 3,
    cost: (lvl) => [12, 35, 90][lvl] ?? 999,
  },
  {
    id: "life",
    name: "Запас прочности",
    desc: "+1 жизнь на старте партии.",
    max: 2,
    cost: (lvl) => [25, 70][lvl] ?? 999,
  },
  {
    id: "magnet",
    name: "Магнитный старт",
    desc: "В начале партии шар прилипает к ракетке на 4 сек за уровень.",
    max: 2,
    cost: (lvl) => [15, 45][lvl] ?? 999,
  },
  {
    id: "coin",
    name: "Монетный дождь",
    desc: "Каждая монета приносит ×2 за уровень.",
    max: 2,
    cost: (lvl) => [10, 30][lvl] ?? 999,
  },
  {
    id: "laser",
    name: "Лазер наготове",
    desc: "Начинайте партию с заряженным лазером.",
    max: 1,
    cost: (lvl) => [60][lvl] ?? 999,
  },
]
