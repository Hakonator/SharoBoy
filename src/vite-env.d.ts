/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** «0» — урезать отладочные инструменты в сборке (см. src/config.ts). */
  readonly VITE_DEBUG_TOOLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
