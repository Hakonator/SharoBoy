/**
 * Мелкие утилиты движка: математика, безопасный localStorage,
 * детерминированный ГПСЧ и геометрия эллипсов.
 */

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Безопасный доступ к localStorage: в sandbox-окружениях обращение к
 *  хранилищу бросает SecurityError — игра должна работать и без него. */
export function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function lsSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* нет доступа к хранилищу — играем без рекордов на диске */
  }
}

/** Детерминированный ГПСЧ (mulberry32) — для волн бесконечного режима. */
export function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function daySeed() {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

/** Подбор угла наклона эллипса, при котором он укладывается в ячейку. */
export function fitTilt(rx: number, ry: number, halfW: number, halfH: number) {
  const t = rand(0.2, 0.7) * (Math.random() < 0.5 ? -1 : 1)
  for (const ang of [t, t * 0.6, t * 0.3, 0]) {
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    if (Math.hypot(rx * c, ry * s) <= halfW && Math.hypot(rx * s, ry * c) <= halfH) return ang
  }
  return 0
}

/** Габариты повёрнутого эллипса по осям экрана. */
export function rotatedExtents(rx: number, ry: number, rot: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return { hw: Math.hypot(rx * c, ry * s), hh: Math.hypot(rx * s, ry * c) }
}
