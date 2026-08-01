# CLAUDE.md

Compact orientation for agent sessions. Full history/status lives in `.agile-v/STATE.md` (session-by-session log), `docs/PROJECT_PLAN.md` (phase checklist), `docs/PROJECT_WALKTHROUGH.md` (architecture tour) — read those for detail, this file is just the fast-start summary.

## What this is
E-commerce storefront (books/courses): catalog, cart, Stripe checkout, address book, order tracking, reviews, support tickets, admin console, AI business insights. Migrated from CRA+AWS Lambda/DynamoDB to a Vite SPA + Express/Prisma/Postgres backend (AWS retirement forced the move).

## Stack
- **Frontend:** React 19 + Vite (Rolldown) + TypeScript strict, React Router 7 (plain SPA — no data routers, no SSR), TanStack Query 5, Tailwind 3, shadcn/ui-style components in `src/components/ui/`.
- **Backend:** Express + Prisma + PostgreSQL, TypeScript strict, Zod validation at route boundary.
- **Services:** Stripe, Cloudinary, Brevo, Shippo, Google OAuth, 9 free-tier LLM providers (AI insights), Sentry (tunneled via `/api/monitoring`, ad-blocker-safe).
- `aws-lambda/` = retired backend, kept for reference only, excluded from lint/build.

## Standing conventions (violate these only with explicit new instruction)
- Strict TypeScript, no `any`. Shared/reusable `lib/`/`hooks/`/`context/`/`services/`/`components/ui/` — no parallel one-off implementations.
- Every mutation invalidates all affected TanStack Query keys — instant UI update everywhere, no `location.reload()`.
- Page width comes from one place: `mx-auto max-w-9xl px-2 sm:px-4 xl:px-8` in `App.tsx`'s wrapper. Don't add nested `max-w-*` in page/layout components.
- No Redis/SSR in this app by design (SPA + TanStack Query cache is the whole caching story).
- Delete dead code/files when found unused — don't leave commented-out or unreferenced code.
- No summary/changelog `.md` files unless asked. Exceptions: `.agile-v/*`, `docs/PROJECT_PLAN.md`, `docs/PROJECT_WALKTHROUGH.md`, this file.
- **Never `git commit`/`push` without the user explicitly asking that turn.**

## Known gotchas
- Vite's Rolldown bundler will silently flatten `React.lazy()` if the import target is a trivially-small facade file, or if `lazy()` is defined nested inside an already-lazy component. Fix pattern: consolidate into one substantial file, define `lazy()` at the same depth as `AllRoutes.tsx`'s existing working boundaries.
- `react-router`/`react-router-dom` pinned at `^7.18.2` — `npm audit fix` wants to downgrade to 7.11.0, which reintroduces 14 worse CVEs. Don't auto-fix; verify first.
- Persisted TanStack Query cache (localStorage) is busted via `__APP_VERSION__` tied to `package.json` version — bump the version on any query-response shape change, or stale cached shapes will crash components reading new fields.
- `.env.example` (both frontend and backend) must be kept in sync with real env var usage — check on every audit pass, it drifts easily.

## Current status (2026-08-01)
Phases 1–6 complete (backend migration, TypeScript/Vite conversion, cache/UI/UX polish, auth hardening, layout fix, Sentry monitoring, post-implementation audit). REQ-1200 to REQ-1630 in `.agile-v/REQUIREMENTS.md`. Coolify/VPS deployment intentionally deferred by user request — app runs locally only so far. `tsc -b`/`eslint`/`vite build` clean on both sides as of the last audit.
