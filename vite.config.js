import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages отдаёт проект из подкаталога /SharoBoy/, поэтому в CI
// (GitHub задаёт CI=true) база сборки — "/SharoBoy/"; локально остаётся "/".
export default defineConfig({
  base: process.env.CI ? "/SharoBoy/" : "/",
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


