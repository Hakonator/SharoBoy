import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Базовый путь сборки:
//   локальный дев-сервер:                      "/"
//   GitHub Pages, стабильная версия (main):    "/SharoBoy/"  (CI=true)
//   GitHub Pages, бета-версия (beta):          "/SharoBoy/beta/"  (задаётся
//     переменной GH_PAGES_BASE в .github/workflows/deploy.yml)
export default defineConfig({
  base: process.env.GH_PAGES_BASE || (process.env.CI ? "/SharoBoy/" : "/"),
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});


