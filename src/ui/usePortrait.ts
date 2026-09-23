import { useEffect, useState } from "react"

/** Вертикальная ориентация окна (высота больше ширины). В портрете HUD-бар
 *  сворачивается в два ряда внутри зарезервированной неигровой зоны сверху —
 *  игровое поле ниже остаётся свободным от плашек. */
export function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(orientation: portrait)").matches
  )

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)")
    const onChange = (e: MediaQueryListEvent) => setPortrait(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return portrait
}
