/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Comma-separated exact scheme+host origins allowed to postMessage a
      Munshot host session into this app. Falls back to a hardcoded default
      (see src/lib/sdk.ts) when unset — see .env.example. */
  readonly VITE_MUNSHOT_ALLOWED_ORIGINS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
