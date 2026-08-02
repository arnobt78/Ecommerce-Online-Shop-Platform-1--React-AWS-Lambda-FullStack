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
- Guest checkout = synthetic `guest_<uuid>` id (`Order.userId` stays non-nullable, ownership checks unmodified); guests fetch via `GET /orders/guest/:orderId?email=`
- Fuzzy search needs Postgres `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`) — falls back to substring search if missing
- Scheduled jobs (low-stock digest, weekly AI summary) opt-in via `SCHEDULE_JOBS_ENABLED=true` (default off)
- CSV: products import+export, orders export-only (bulk order-create would bypass Stripe/stock/idempotency)
- Webhook/shared-secret comparisons use `timingSafeEqual` (see `webhooks.routes.ts`); unauthenticated email-collecting POSTs go through `publicWriteLimiter`
- Every service file gets re-exported from `src/services/index.ts` (barrel), even though hooks import it directly — keeps it discoverable

## Status (2026-08-02)
C1 Phases 1–9 done, audited twice (REQ-1200…1667), 78-file diff clean and uncommitted pending user go-ahead. Catalog: 17 books. Phase 8: payment-tampering fix, auto-refund-on-cancel, invoice download, order idempotency, per-entity admin analytics, deterministic restock/fraud/pricing/churn signals, on-demand AI review-sentiment, admin low-stock digest, `/email/send` open-relay fix. Phase 9: wishlist, back-in-stock alerts, coupons, guest checkout, live Shippo webhook, scheduled digest+AI-summary jobs, CSV import/export, return/RMA, refresh tokens, AI description generator, fuzzy search, AI ticket-reply drafts. Post-implementation re-audit (this pass) found only minor hardening gaps, all fixed: Shippo webhook secret compare made timing-safe, stock-alert subscribe rate-limited, `services/index.ts` barrel completed for the 5 services that were missing from it. No functional/architectural gaps found. Coolify/VPS deferred. Live demo still legacy AWS. Gate 2 / Red Team optional. Lint+tsc+build clean FE+BE.
