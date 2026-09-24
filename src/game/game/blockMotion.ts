/**
 * Маршрутизатор траекторий и анимаций блоков: сеточное покачивание/дрейф
 * медузы (как раньше), специализированные маршруты §6 — горизонталь /
 * вертикаль / окружность, пульсация размера, вращение с трением и кулдаун
 * порталов. Чистый шаг без побочных эффектов, кроме состояния блока.
 */
import type { Game } from "../game"
import type { Block } from "../types"
import { PULSE_AMPLITUDE } from "../blockKinds"
import { clamp } from "../utils"

import { blockTop } from "./paddleControl"

/** Один шаг анимации/движения блока (каждый блок — каждый кадр). */
export function stepBlock(g: Game, b: Block, dt: number) {
  const t = g.time
  // нижняя граница по вертикали: блок не заходит в неигровую HUD-зону сверху
  const yMin = blockTop(g) + b.ry
  // горизонтальное покачивание (сетка)
  if (b.swayAmp > 0) {
    b.x = clamp(b.x0 + Math.sin(t * b.swayFreq + b.swayPh) * b.swayAmp, b.rx + 4, g.w - b.rx - 4)
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
    const baseY = b.y0 ?? b.y
    const off = Math.sin(t * d.freq + d.ph) * d.amp
    if (d.kind === "h") {
      b.x = clamp(b.x0 + off, b.rx + 4, g.w - b.rx - 4)
    } else if (d.kind === "v") {
      b.y = clamp(baseY + off, yMin, g.h * 0.75)
    } else {
      b.x = clamp(b.x0 + Math.cos(t * d.freq + d.ph) * d.amp, b.rx + 4, g.w - b.rx - 4)
      b.y = clamp(baseY + Math.sin(t * d.freq + d.ph) * d.amp * 0.6, yMin, g.h * 0.75)
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
