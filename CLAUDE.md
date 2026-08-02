# CLAUDE.md

Fast agent orientation. Detail: `.agile-v/STATE.md`, `docs/PROJECT_PLAN.md`, `docs/PROJECT_WALKTHROUGH.md`.

**Agile V ACTIVE:** `AGENTS.md` · `.agile-v/ACTIVATION.md` · `.agile-v/SKILLS.md` · `.cursor/rules/agile-v-infinity-loop.mdc`

## What
eBook storefront + admin: catalog, cart, Stripe, addresses, orders, reviews, tickets, AI insights. Migrated CRA/AWS Lambda+DynamoDB → **Vite SPA + Express/Prisma/Postgres**.

## Stack
- FE: React 19 · Vite · TS strict · RR7 SPA (no SSR) · TanStack Query 5 · Tailwind 3 · `src/components/ui/`
- BE: Express · Prisma · Postgres · Zod at routes
- Integrations: Stripe, Cloudinary, Brevo, Shippo, Google OAuth, multi-LLM AI, Sentry tunnel `/api/monitoring`
- `aws-lambda/` = reference only

## Conventions
- No `any`; shared hooks/services/ui — no parallel one-offs
- Mutations invalidate all affected Query keys — no `location.reload()`
- Width only from `App.tsx`: `mx-auto max-w-9xl px-2 sm:px-4 xl:px-8`
- No Redis/SSR by design (SPA + Query cache)
- Delete dead code; no unsolicited summary `.md` (except `.agile-v/*`, plan, walkthrough, this file)
- Never commit/push unless user asks that turn

## Local ports
- FE Vite `:3000` · BE Express `:4000` (`PORT=4000`, `VITE_LAMBDA_API_URL=http://localhost:4000`)
- Templates: `.env.example`, `backend/.env.example`

## Gotchas
- Rolldown may flatten trivial `React.lazy()` — keep admin lazy at `AllRoutes` depth
- Don't `npm audit fix` react-router (pin `^7.18.2`); bump `package.json` version on Query response shape changes (`__APP_VERSION__` cache buster)
- `prisma db push` only, no migrations folder — never `migrate dev`; keep both `.env.example` synced with real env reads
- `Product.coverColor` never white/near-white (luminance <230/255, hides `BookCoverSvg` spine-curl); `ProductReel` auto-scrolls via rAF+`transform`, not `scrollBy`/interval
- `Order.paymentIntentId` is `@unique` = idempotency — never remove
- Stripe refund `reason` is a fixed 3-value enum — always via `toStripeRefundReason()`/`refundOrderPayment()` in `orders.service.ts` (shared by cancel-refund, refund, return/RMA approval)
- "AI-driven" restock/fraud/pricing/churn = deterministic math; only review-sentiment, AI Insights, description generator, ticket-reply drafts call the LLM chain (`max_tokens` must stay ≥1024, reasoning models eat the budget)
- `POST /email/send` restricts non-admin `to` to self or the admin alert address (was an open relay)
- Access token 1h + rotating `RefreshToken` (hash-only stored), proactively renewed by `useTokenRefresh.ts` — don't retrofit a 401-retry interceptor into raw-fetch services
- Guest checkout = synthetic `guest_<uuid>` id (`Order.userId` stays non-nullable, ownership checks unmodified); guests fetch via `GET /orders/guest/:orderId?email=`, and can now also request a return the same way (email-verified, no `req.user`)
- **Never `router.use(requireAuth)` (blanket, no path) unless that router is mounted in `app.ts` with an explicit path prefix** (`app.use("/x", router)`) — otherwise it silently 401s every route mounted *after* it in `app.ts`, not just its own. Real bug this bit: `wishlist.routes.ts` had this pattern while mounted with no prefix, breaking every unauthenticated caller of `/stock-alerts`, `/coupons/validate`, and the Shippo webhook (which never sends a Bearer token) — fixed by moving `requireAuth` onto each route individually, the pattern every other route file already used
- Fuzzy search needs Postgres `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`) — falls back to substring search if missing
- Scheduled jobs (low-stock digest, weekly AI summary) opt-in via `SCHEDULE_JOBS_ENABLED=true` (default off)
- CSV: products import+export, orders export-only (bulk order-create would bypass Stripe/stock/idempotency)
- Webhook/shared-secret comparisons use `timingSafeEqual` (see `webhooks.routes.ts`); unauthenticated email-collecting POSTs go through `publicWriteLimiter`
- Every service file gets re-exported from `src/services/index.ts` (barrel), even though hooks import it directly — keeps it discoverable
- Detail pages: static shell (back button, title, breadcrumb) renders unconditionally, first paint — only the data-dependent area swaps between a shape-matching `*Skeleton` component (`animate-pulse`, same width/height as real content) and the loaded content, never a single centered spinner replacing the whole page (see `AdminOrderDetailPage`/`ProductDetailSkeleton`/`OrderDetailSkeleton`)
- Shared frontend types (`src/types/index.ts`) must mirror every Prisma column, not just the ones a feature happens to read at the time it's added — a field added to `schema.prisma` (e.g. `Order.guestEmail`) but not to the matching frontend interface compiles fine until something actually needs it, then either fails silently or gets read off a live, unverified source (form input) instead of the verified server value

## Status (2026-08-02)
C1 Phases 1–9 done (REQ-1200…1672), pushed to `origin/main` through `a01d06e`; REQ-1671/1672 uncommitted, pending user go-ahead. Catalog: 17 books. Phase 8: payment-tampering fix, auto-refund-on-cancel, invoice download, order idempotency, per-entity admin analytics, deterministic restock/fraud/pricing/churn signals, on-demand AI review-sentiment, admin low-stock digest, `/email/send` open-relay fix. Phase 9: wishlist, back-in-stock alerts, coupons, guest checkout, live Shippo webhook, scheduled digest+AI-summary jobs, CSV import/export, return/RMA, refresh tokens, AI description generator, fuzzy search, AI ticket-reply drafts.

Six post-implementation passes, each verified live against the real dev DB not just compiled: REQ-1668 (3 minor hardening gaps), REQ-1669 (whole-codebase, zero further gaps), REQ-1670 (demo coupons + a whole-page-spinner UX fix), REQ-1671 (guest checkout orders had no way to request a return — fixed with `optionalAuth`+email verification and a shared `ReturnRequestSection`; **also found and fixed a severe pre-existing bug**: `wishlist.routes.ts`'s blanket `router.use(requireAuth)`, mounted with no path prefix, was silently 401-blocking every route mounted after it — stock-alerts, coupon validation, and the real Shippo webhook, which never sends a token), REQ-1672 (the shared `Order` type was missing `isGuest`/`guestEmail`/`couponCode`/`discountAmount` — added them, and fixed a related edge case: the guest return form was verifying against the live, editable email input instead of `order.guestEmail`, the value the lookup itself already confirmed). Coolify/VPS deferred. Live demo still legacy AWS. Gate 2 / Red Team optional. Lint+tsc+build clean FE+BE, `npm audit`/`depcheck` clean (backend 0 vulns; frontend's one high advisory is the known RSC-mode-only react-router CVE, inapplicable to this SPA, already pinned per Gotchas).
