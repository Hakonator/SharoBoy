import React from "react"
import ReactDOM from "react-dom/client"

import "./index.css"
import App from "./App.tsx"

// Модуль выполнился — сторожевой скрипт в index.html увидит этот флаг
// и не будет показывать диагностическое сообщение.
;(window as unknown as { __sharoboy_booted?: boolean }).__sharoboy_booted = true

/** Страховочный экран: если приложение упало при загрузке/рендере,
 *  показываем причину вместо чёрного экрана. */
class BootBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error("[ШАРОБОЙ] ошибка при запуске:", error)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(120% 90% at 50% 0%, #0e3a4e 0%, #082434 46%, #04121c 100%)",
            color: "#eaf7ff",
            padding: 24,
            fontFamily: "Rubik, sans-serif",
          }}
        >
          <div style={{ maxWidth: 620, width: "100%" }}>
            <h1 style={{ fontFamily: "'Russo One', sans-serif", fontSize: 34, margin: "0 0 8px" }}>
              ШАРОБОЙ: сбой запуска
            </h1>
            <p style={{ color: "#7fa6ba", marginTop: 0 }}>
              Игра не смогла стартовать. Причина ниже — попробуйте жёсткую перезагрузку страницы
              (Ctrl+Shift+R / Cmd+Shift+R).
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#ff6a5c",
                background: "rgba(7,26,38,0.9)",
                border: "1px solid #1d4a61",
                padding: 14,
                fontSize: 13,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {String(this.state.error?.stack || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                fontFamily: "'Russo One', sans-serif",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#35e0ff",
                border: "1px solid rgba(53,224,255,0.45)",
                background: "rgba(9,36,52,0.7)",
                padding: "10px 22px",
                cursor: "pointer",
              }}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById("root")
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <BootBoundary>
        <App />
      </BootBoundary>
    </React.StrictMode>
  )
}

// PWA: сервис-воркер только в продакшен-сборке (в dev он мешает HMR).
// BASE_URL учитывает путь GitHub Pages («/SharoBoy/» или «/SharoBoy/beta/»).
//
// AD-036: имя кэша в sw.js содержит номер сборки, поэтому каждая выкатка
// публикует новый воркер. Регистрация с `updateViaCache: "none"` гарантирует,
// что сам sw.js не залипнет в HTTP-кэше.
//
// AD-039: новая версия НЕ перезагружает страницу сама. Раньше `controllerchange`
// вызывал `location.reload()` безусловно — игрока выбрасывало из боя посреди
// забега (инцидент 04.11.2026: начал на сборке 361, игра перезагрузилась на 362).
// Теперь показываем баннер «доступно обновление»: перезагрузка — по кнопке,
// а «Позже» оставляет воркер ждать до конца сессии.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Первый запуск тоже даёт controllerchange — обновлением он не считается.
    const hadController = Boolean(navigator.serviceWorker.controller)
    /** Ждёт перезагрузки: баннер уже показан игроку. */
    let pending = false
    let reloading = false

    const showUpdateBanner = (apply: () => void) => {
      if (pending) return
      pending = true
      mountUpdateBanner(() => {
        if (reloading) return
        reloading = true
        apply()
      })
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloading) return
      // Новый воркер активировался и уже управляет страницей: обновление
      // применится обычной перезагрузкой.
      showUpdateBanner(() => window.location.reload())
    })

    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {})
        // Воркер уже скачан и ждёт активации (например, страница открыта давно).
        if (reg.waiting) showUpdateBanner(() => window.location.reload())
      })
      .catch((err) => console.warn("[ШАРОБОЙ] сервис-воркер не зарегистрирован:", err))
  })
}

/**
 * Баннер «доступно обновление»: единственное место, где приложение само
 * предлагает перезагрузку. Стили инлайновые — баннер живёт вне React-дерева
 * (регистрация воркера происходит после монтирования приложения) и не должен
 * зависеть от Tailwind-классов в момент, когда страница уже собрана.
 */
function mountUpdateBanner(onApply: () => void) {
  if (document.getElementById("sharoboy-update-banner")) return
  const box = document.createElement("div")
  box.id = "sharoboy-update-banner"
  box.setAttribute("role", "status")
  box.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:22px",
    "transform:translateX(-50%)",
    "z-index:2147483000",
    "display:flex",
    "align-items:center",
    "gap:12px",
    "padding:10px 16px",
    "border:1px solid rgba(53,224,255,0.45)",
    "border-radius:10px",
    "background:rgba(7,26,38,0.94)",
    "color:#eaf7ff",
    "font-family:Rubik, sans-serif",
    "font-size:14px",
    "box-shadow:0 8px 28px rgba(2,12,20,0.55)",
  ].join(";")

  const label = document.createElement("span")
  label.textContent = "Доступно обновление игры"
  box.appendChild(label)

  const apply = document.createElement("button")
  apply.type = "button"
  apply.textContent = "Обновить"
  apply.style.cssText = [
    "font-family:'Russo One', sans-serif",
    "font-size:13px",
    "letter-spacing:0.04em",
    "text-transform:uppercase",
    "color:#04121c",
    "background:#35e0ff",
    "border:0",
    "border-radius:6px",
    "padding:6px 14px",
    "cursor:pointer",
  ].join(";")
  apply.addEventListener("click", onApply)
  box.appendChild(apply)

  const later = document.createElement("button")
  later.type = "button"
  later.textContent = "Позже"
  later.style.cssText = [
    "font-family:Rubik, sans-serif",
    "font-size:13px",
    "color:#7fa6ba",
    "background:transparent",
    "border:1px solid rgba(127,166,186,0.4)",
    "border-radius:6px",
    "padding:6px 12px",
    "cursor:pointer",
  ].join(";")
  later.addEventListener("click", () => box.remove())
  box.appendChild(later)

  document.body.appendChild(box)
}
