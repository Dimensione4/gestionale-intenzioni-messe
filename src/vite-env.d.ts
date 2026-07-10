/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_DRIVE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_DRIVE_CLIENT_SECRET?: string;
  readonly VITE_GOOGLE_DRIVE_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
