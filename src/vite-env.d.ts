/// <reference types="vite/client" />

// Augment ImportMetaEnv with our specific env vars for autocomplete + type safety.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
