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

/**
 * Удаляет элементы in-place без аллокации нового массива (против .filter()
 * в игровом цикле: каждый кадр filter оставлял старый массив мусором GC).
 * Порядок сохранённых элементов не меняется.
 */
export function compactInPlace<T>(arr: T[], keep: (item: T) => boolean): void {
  let j = 0
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    if (keep(item)) arr[j++] = item
  }
  arr.length = j
}

/**
 * Разбирает очередь отложенных событий in-place: «созревшие» (at <= time)
 * уходят в handle, остальные уплотняются к началу. Элементы, добавленные
 * handle'ом во время обхода (цепные взрывы бомб, звенья искр), переносятся
 * в конец и разбираются на следующих кадрах. Ноль аллокаций на кадр.
 */
export function drainQueue<T extends { at: number }>(
  queue: T[],
  time: number,
  handle: (q: T) => void
): void {
  const n = queue.length
  let j = 0
  for (let i = 0; i < n; i++) {
    const q = queue[i]
    if (time >= q.at) handle(q)
    else queue[j++] = q
  }
  const added = queue.length - n
  for (let k = 0; k < added; k++) queue[j + k] = queue[n + k]
  queue.length = j + added
}
