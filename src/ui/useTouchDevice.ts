import { useEffect, useState } from "react"

/**
 * Устройство управляется пальцем/стилусом (`pointer: coarse`, без точного
 * указателя). Тот же сигнал использует игровой ввод (`Game.touchMode`), поэтому
 * подсказки в справке и реальное управление совпадают.
 *
 * Гибридные устройства (ноутбук с тачскрином) считаются десктопом: там есть
 * клавиатура и мышь, а `(pointer: coarse)` у них обычно ложно.
 */
function detectTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(pointer: coarse)").matches
}

/** true — тач-устройство (смартфон/планшет), false — мышь и клавиатура. */
export function useTouchDevice(): boolean {
  const [touch, setTouch] = useState(detectTouchDevice)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(pointer: coarse)")
    const sync = () => setTouch(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])

  return touch
}
