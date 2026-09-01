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
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn("[ШАРОБОЙ] сервис-воркер не зарегистрирован:", err))
  })
}
