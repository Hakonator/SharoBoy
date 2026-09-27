/**
 * Маршрутизатор траекторий и анимаций блоков: сеточное покачивание/дрейф
 * медузы (как раньше), специализированные маршруты §6 — горизонталь /
 * вертикаль / окружность, пульсация размера, вращение с трением и кулдаун
 * порталов. Чистый шаг без побочных эффектов, кроме состояния блока.
 */
import type { Game } from "../game"
import type { Block } from "../types"
import { DRIFT_MAX_RADIUS_MULT, PULSE_AMPLITUDE, SPIN_DEATH_DURATION } from "../blockKinds"
import { clamp } from "../utils"

import { blockTop } from "./paddleControl"

/** Один шаг анимации/движения блока (каждый блок — каждый кадр). */
export function stepBlock(g: Game, b: Block, dt: number) {
  const t = g.time
  if (b.spinDeathT !== undefined) {
    b.spinDeathT = Math.max(0, Math.min(SPIN_DEATH_DURATION, b.spinDeathT) - dt)
  }
  // нижняя граница по вертикали: блок не заходит в неигровую HUD-зону сверху
  const yMin = blockTop(g) + b.ry
  // горизонтальное покачивание (сетка)
  if (b.swayAmp > 0) {
    const rawOffset = Math.sin(t * b.swayFreq + b.swayPh) * b.swayAmp
    if (b.isMiniboss) {
      // Все части существа получают один и тот же сдвиг. Кламп по каждой
      // части отдельно растягивал медузу у стены и оставлял её «упираться».
      let minEdge = Infinity
      let maxEdge = -Infinity
      for (const part of g.blocks) {
        if (!part.isMiniboss || part.mbGroup !== b.mbGroup) continue
        minEdge = Math.min(minEdge, part.x0 - part.rx)
        maxEdge = Math.max(maxEdge, part.x0 + part.rx)
      }
      const minOffset = 4 - minEdge
      const maxOffset = g.w - 4 - maxEdge
      const offset = clamp(rawOffset, minOffset, maxOffset)
      b.x = b.x0 + offset
    } else {
      b.x = clamp(b.x0 + rawOffset, b.rx + 4, g.w - b.rx - 4)
    }
  }
  // вертикальный дрейф медузы: вся медуза целиком (одна фаза bobPh)
  if (b.bobAmp && b.bobFreq) {
    b.y = clamp(
      (b.y0 ?? b.y) + Math.sin(t * b.bobFreq + (b.bobPh ?? 0)) * b.bobAmp,
      yMin,
      g.h * 0.75
    )
  }
  const sp = b.sp
  if (!sp) return
  // вращение: угол интегрируется, угловая скорость гасится трением
  if (sp.rotVel) {
    b.rot += sp.rotVel * dt
    sp.rotVel *= Math.exp(-dt * 1.1)
    if (Math.abs(sp.rotVel) < 0.02) sp.rotVel = 0
  }
  // дрейф по маршруту: база — x0 (и y0 для вертикали/окружности)
  if (sp.drift) {
    const d = sp.drift
    const horizontalAmp = Math.min(d.amp, b.rx * DRIFT_MAX_RADIUS_MULT)
    const verticalAmp = Math.min(d.amp, b.ry * DRIFT_MAX_RADIUS_MULT)
    const phase = t * d.freq + d.ph
    if (d.kind === "h") {
      const off = Math.sin(phase) * horizontalAmp
      b.x = clamp(b.x0 + off, b.rx + 4, g.w - b.rx - 4)
    } else if (d.kind === "v") {
      b.y0 ??= b.y
      const base = b.y0
      const maxCenter = g.h * 0.75 - b.ry
      const centerMin = yMin + verticalAmp
      const centerMax = maxCenter - verticalAmp
      const safeBase =
        centerMin <= centerMax ? clamp(base, centerMin, centerMax) : (yMin + maxCenter) / 2
      b.y = safeBase + Math.sin(phase) * verticalAmp
    } else {
      b.x = clamp(b.x0 + Math.cos(phase) * horizontalAmp, b.rx + 4, g.w - b.rx - 4)
      b.y0 ??= b.y
      const base = b.y0
      const maxCenter = g.h * 0.75 - b.ry
      const circleVerticalAmp = verticalAmp * 0.6
      const centerMin = yMin + circleVerticalAmp
      const centerMax = maxCenter - circleVerticalAmp
      const safeBase =
        centerMin <= centerMax ? clamp(base, centerMin, centerMax) : (yMin + maxCenter) / 2
      b.y = safeBase + Math.sin(phase) * circleVerticalAmp
    }
  }
  // пульсация размера: хитбокс (collideBlocks читает rx/ry) следует за визуалом
  if (sp.pulse) {
    const k = 1 + Math.sin(t * sp.pulse.freq + sp.pulse.ph) * PULSE_AMPLITUDE
    b.rx = sp.pulse.rx0 * k
    b.ry = sp.pulse.ry0 * k
  }
  // кулдаун телепорта пары порталов
  if (sp.portalCd && sp.portalCd > 0) sp.portalCd = Math.max(0, sp.portalCd - dt)
}
