// Parent: REQ-1300, REQ-1303
// Vite replaces react-scripts (CRA) as the frontend build tool. Dev server
// runs on :3000 to match the port every doc/env file in this repo already
// references; path aliases mirror the pre-existing jsconfig.json (@components,
// @pages, @services, etc.) so no import path across ~150 files needs touching.
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8")
) as { version: string };

// SENTRY_ORG/PROJECT/AUTH_TOKEN are build-tool-only (no VITE_ prefix, so Vite
// never exposes them to the client bundle) — loadEnv reads them out of
// .env.local/.env here since plain `process.env` only sees real shell-exported
// vars, not this project's dotenv files.
const buildEnv = loadEnv("all", process.cwd(), "");

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    // Uploads production source maps to Sentry for readable stack traces —
    // a genuine no-op build step (not shipped to the browser) that silently
    // disables itself when SENTRY_AUTH_TOKEN isn't set (e.g. local dev),
    // rather than failing the build.
    sentryVitePlugin({
      org: buildEnv.SENTRY_ORG,
      project: buildEnv.SENTRY_PROJECT,
      authToken: buildEnv.SENTRY_AUTH_TOKEN,
      disable: !buildEnv.SENTRY_AUTH_TOKEN,
      release: { name: pkg.version },
    }),
  ],
  server: {
    port: 3000,
    open: false,
  },
  build: {
    outDir: "build", // keep the existing CRA output dir name (vercel.json / deploy tooling already expects "build")
    sourcemap: true,
    // Vite's default modulePreload eagerly injects <link rel="modulepreload">
    // into index.html for every dynamic-import() chunk found anywhere in the
    // app's module graph — since this is a single-HTML SPA, that defeats the
    // Analytics charts' React.lazy() split (recharts/d3, ~600KB) by fetching
    // it on every page regardless of route. Disabled so lazy chunks only
    // fetch when the route that actually uses them renders.
    modulePreload: false,
  },
  // CRA exposed env vars prefixed REACT_APP_; Vite requires VITE_. Both repo
  // .env files were renamed to match (see docs/PROJECT_WALKTHROUGH.md §3).
  envPrefix: "VITE_",
  // App version, baked in at build time — used as the persisted TanStack Query
  // cache's `buster` (src/index.tsx) so old localStorage-cached shapes never
  // leak across a deploy.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
