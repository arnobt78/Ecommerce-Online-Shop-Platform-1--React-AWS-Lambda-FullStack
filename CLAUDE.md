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
- Rolldown may flatten trivial `React.lazy()` facades — keep admin lazy at `AllRoutes` depth
- Don’t `npm audit fix` react-router (pin `^7.18.2`)
- Bump `package.json` version on Query response shape changes (`__APP_VERSION__` cache buster)
- Keep both `.env.example` files synced with real env reads
- Schema changes: this project uses `prisma db push`, not `prisma migrate` (no migrations folder) — never offer `migrate dev`'s DB reset
- Book-cover art (`Product.coverColor`): never assign white/near-white (luminance check, threshold ~230/255) — hides `BookCoverSvg`'s white spine-curl lines
- `ProductReel` auto-scrolls via `requestAnimationFrame` + direct `transform`, not `scrollBy`/interval — keep it that way for smooth continuous motion, not discrete jumps
- `Order.paymentIntentId` is `@unique` (nullable-safe) — order creation is idempotent by design; never remove this constraint
- Stripe's refund `reason` param is a fixed 3-value enum (`duplicate`/`fraudulent`/`requested_by_customer`), NOT free text — admin-entered cancel/refund reasons are audit-log notes only, see `toStripeRefundReason()` in `orders.routes.ts`
- "AI-driven" admin features (restock/fraud/pricing/churn) are deterministic math, not LLM calls — only review-sentiment and the existing AI Insights panel actually call the LLM chain
- `POST /email/send` restricts non-admin callers' `to` to their own email or the fixed admin alert address (was an open relay) — admins exempt

## Status (2026-08-02)
C1 Phases 1–8 done + audited (REQ-1200…1655). Catalog: 17 books (university-library merge). Book-cover art/trailer video/recommendations reel + admin catalog insights, live cover-preview editor, `ProductDetail` redesigned. Phase 8: payment-tampering fix, auto-refund-on-cancel, invoice download, order idempotency, payment/order rate limiting, per-entity admin analytics, deterministic restock/fraud/pricing/churn signals, on-demand AI review-sentiment, admin low-stock digest. Post-audit (REQ-1655): re-verified invalidation/auth/zod/dead-code across Phase 8, fixed the `/email/send` open-relay gap. Coolify/VPS deferred. Live demo still legacy AWS (`codebook-aws.vercel.app`). Gate 2 / Red Team optional. Lint+tsc+build clean FE+BE (full sweep).
