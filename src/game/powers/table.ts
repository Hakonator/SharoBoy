/**
 * Таблица взвешенного выбора типа бонуса для дропов (блоки и «с неба»).
 * «Замедление» — точечный спас-бонус: попадает в таблицу только когда шар
 * разогнан эффектами/зачисткой до ≥1.5× номинала (см. physics/speed.ts).
 */
import type { PowerType } from "../types"

export interface PowerTableOpts {
  /** Активен босс: лазер и ракеты недоступны. */
  boss: boolean
  /** Кампания: жизни выпадают только с минибоссов. */
  campaign: boolean
  /** Блоков осталось мало — усиливаем «чистящие» бонусы. */
  fewBlocks: boolean
  /** Шар разогнан до порога — «замедление» становится полезным. */
  spedUp: boolean
}

export function buildPowerTable(o: PowerTableOpts): [PowerType, number][] {
  let table: [PowerType, number][] = [
    ["wide", 12],
    ["multi", 12],
    ["life", 6],
    ["shield", 10],
    ["laser", o.fewBlocks ? 72 : 9],
    ["rocket", o.fewBlocks ? 64 : 8],
    ["fire", 8],
    ["frost", 8],
    ["fast", 14],
    ["shrink", 10],
  ]
  if (o.spedUp) table.push(["slow", 12])
  // В кампании жизни выпадают только с минибоссов — из общих дропов исключены.
  if (o.campaign) table = table.filter(([t]) => t !== "life")
  if (o.boss) table = table.filter(([t]) => t !== "laser" && t !== "rocket")
  return table
}
