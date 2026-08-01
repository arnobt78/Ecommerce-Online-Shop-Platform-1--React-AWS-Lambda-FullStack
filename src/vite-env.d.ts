/// <reference types="vite/client" />

// Parent: REQ-1300, REQ-1305 — typed surface for import.meta.env, replacing
// CRA's process.env.REACT_APP_* globals (see docs/PROJECT_WALKTHROUGH.md §3
// for the full required-vars list).
interface ImportMetaEnv {
  readonly VITE_LAMBDA_API_URL: string;
  readonly VITE_STRIPE_PUB_KEY: string;
  readonly VITE_BASE_URL?: string;
  readonly VITE_IMAGE_SERVICE?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  readonly VITE_IMAGEKIT_URL_ENDPOINT?: string;
  readonly VITE_IMAGEKIT_PUBLIC_KEY?: string;
  // Sentry DSNs are designed to be public (unlike SENTRY_AUTH_TOKEN, which
  // stays backend/build-tooling-only) — safe to ship in the frontend bundle.
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config.ts `define` from package.json version — used as the
// persisted TanStack Query cache's `buster` so a deploy with a shape-changing
// query/response invalidates old localStorage-cached data automatically.
declare const __APP_VERSION__: string;
