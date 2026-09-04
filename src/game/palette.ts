/**
 * Визуальные константы сущностей: цвета бонусов и «матрёшек».
 * Используются и логикой (цвет попапов), и рендерингом.
 */
import type { PowerType } from "./types"

/** Положительные бонусы — зелёные, отрицательные — красные. */
export const POWER_META: Record<
  PowerType,
  { label: string; good: boolean; color: string; edge: string }
> = {
  wide: { label: "ШИР", good: true, color: "#4dff9e", edge: "#d2ffee" },
  multi: { label: "×3", good: true, color: "#4dff9e", edge: "#d2ffee" },
  life: { label: "+1", good: true, color: "#4dff9e", edge: "#d2ffee" },
  coin: { label: "МОН", good: true, color: "#ffc94d", edge: "#fff1c4" },
  magnet: { label: "МАГ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  slow: { label: "СК↓", good: true, color: "#4dff9e", edge: "#d2ffee" },
  shield: { label: "ЩИТ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  laser: { label: "ЛАЗ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  rocket: { label: "РКТ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  fire: { label: "ОГНЬ", good: true, color: "#4dff9e", edge: "#d2ffee" },
  fast: { label: "СК↑", good: false, color: "#ff5347", edge: "#ffd0cb" },
  shrink: { label: "УЗК", good: false, color: "#ff5347", edge: "#ffd0cb" },
}

export const TIER: Record<1 | 2 | 3, { base: string; light: string; dark: string }> = {
  1: { base: "#5dffb0", light: "#eafff4", dark: "#0f8f5b" },
  2: { base: "#ffc94d", light: "#fff3d1", dark: "#b0720a" },
  3: { base: "#ff6a5c", light: "#ffd9d4", dark: "#9c1f12" },
}
