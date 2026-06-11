/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** nons-library-server base URL; empty = same origin */
  readonly VITE_LIBRARY_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
