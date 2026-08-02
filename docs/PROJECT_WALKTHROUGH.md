# CodeBook — Project Walkthrough

A living, practical tour of the codebase: what it is, how it's laid out, how to run it locally, and how the pieces fit together. For the migration history/status and REQ-level tracking, see `docs/PROJECT_PLAN.md` and `.agile-v/STATE.md` — this doc is the "orient a new contributor" reference, not the status tracker.

---

## 1. What this project is

CodeBook is an e-commerce storefront for programming books/courses: product catalog, cart, Stripe checkout, an optional saved-address book, order history/tracking, product reviews (with seller responses), a support-ticket system (with priority/category triage), and a full admin console (dashboard, analytics, product/order/user/review/ticket management, all with list + detail pages).

- **Frontend:** React 19 + Vite (migrated from Create React App, Phase 2 — REQ-1300/1303), strict TypeScript throughout — every file under `src/` is `.ts`/`.tsx`, zero `.js`/`.jsx` remain. React Router 7 (client-side routing only — this is a pure SPA, **no server-rendering layer**: no Next.js, no `page.tsx`/`"use client"` split, no SSR). TanStack Query 5, Tailwind CSS 3. Hosted on Vercel.
- **Backend:** Express.js (Node 22) + Prisma + PostgreSQL. Runs locally today; Coolify/VPS deployment is intentionally on hold (see `docs/PROJECT_PLAN.md` §6, Phase 1 steps 9–10).
- **External services:** Stripe (payments), Cloudinary (image hosting), Brevo (transactional email), Shippo (shipping labels — real saved addresses feed this, REQ-1620), Google OAuth (one-click sign-in), 9 free-tier LLM providers for AI business insights (`docs/LLM_MODEL_SELECTION.md`).

The original backend was 33 AWS Lambda functions + API Gateway + DynamoDB (still present in `aws-lambda/` for reference). That backend is being retired because the AWS account it lives in closes 2026-08-16 — `backend/` is the replacement and is what the frontend talks to now.

---

## 2. Repository layout

```text
ecommerce-codebook/
├── src/                    # React frontend (Vite)
│   ├── pages/               # Route-level pages (Home, Products, ProductDetail, Cart,
│   │                         #   Order (customer order detail), Payment, Dashboard, Tickets,
│   │                         #   Login, Register, Admin/* — every admin domain has both a
│   │                         #   list page and a detail page: Products, Orders, Users,
│   │                         #   Tickets, Reviews)
│   ├── components/
│   │   ├── ui/               # Reusable shadcn-style primitives: Card, DataTable (generic
│   │   │                     #   @tanstack/react-table wrapper — NOT the old SortableTable,
│   │   │                     #   which was deleted, REQ-1611), FormSelect, AlertDialog,
│   │   │                     #   AddressLines (shared 4-line postal address renderer),
│   │   │                     #   OrderTrackingInfo, motion.tsx (ScrollReveal/Stagger),
│   │   │                     #   RippleButton…
│   │   ├── Layouts/           # AdminLayout, site header/footer, etc.
│   │   ├── Elements/          # Small building blocks (ProductCard, ReviewCard/Form, Rating…)
│   │   ├── Sections/          # Larger composed page sections
│   │   └── Other/
│   ├── hooks/                # TanStack Query hooks per domain (useProducts, useAdmin,
│   │                         #   useAuth, useReviews, useTickets, useUser — addresses +
│   │                         #   customer order detail live here, useNotifications,
│   │                         #   usePrefetchOnHover — generic hover-prefetch helper…)
│   ├── services/              # fetch wrappers per domain (authService, productService,
│   │                         #   addressService, ticketService, reviewService…),
│   │                         #   apiError.ts (shared ApiError class + error handling)
│   ├── context/               # CartContext, FilterContext (React Context, not server state)
│   ├── routes/                # AllRoutes.tsx (route table), ProtectedRoute.tsx (auth guard)
│   ├── lib/                   # toast.ts (Sonner wrapper with dynamic titles)
│   ├── utils/                 # queryInvalidation.ts (centralized cache-invalidation helpers
│   │                         #   — every CRUD mutation routes through these, not ad hoc
│   │                         #   invalidateQueries calls scattered per hook)
│   └── App.tsx                 # Root component: providers + route-transition animation
│
├── backend/                 # Express + Prisma + PostgreSQL API (the live backend)
│   ├── src/
│   │   ├── server.ts          # Entry point
│   │   ├── app.ts             # Express app: middleware, CORS, route mounting
│   │   ├── routes/            # One file per domain (auth, products, orders, adminUsers,
│   │   │                     #   addresses, reviews, tickets, notifications, activityLog,
│   │   │                     #   payment, email, aiInsights)
│   │   ├── services/          # Business logic + Prisma queries, one file per domain
│   │   └── lib/                # Shared helpers (jwt, password hashing, ai/ — multi-provider
│   │                         #   LLM client, see docs/LLM_MODEL_SELECTION.md)
│   ├── prisma/
│   │   ├── schema.prisma      # DB schema (User, Address, Product, Order, Review, Ticket,
│   │   │                     #   ActivityLog…) — see §4 below
│   │   └── seed.ts            # Idempotent seed: reads data/db.json, upserts products + demo users
│   └── .env                   # Local secrets (gitignored) — DB URL, JWT secret, Stripe/Brevo/
│                             #   Shippo/AI-provider keys, Google OAuth client id/secret
│
├── aws-lambda/               # Legacy Lambda backend — kept for reference only, not live
├── data/
│   ├── db.json                # Seed source of truth: 15 real, hand-enriched product records
│   └── db.json                # Seed source of truth: 15 real, hand-enriched product records
├── docs/                     # Design specs, this walkthrough, the migration plan,
│                             #   LLM_MODEL_SELECTION.md (generic multi-provider AI reference)
├── .agile-v/                 # Agile-V governance: REQUIREMENTS.md, STATE.md, DECISION_LOG.md…
├── SECURITY.md               # Private vuln reporting (contact@arnobmahmud.com)
└── public/, build/            # Vite static assets / production build output
```

---

## 3. Running it locally

**Prerequisites:** Node 20+, a local PostgreSQL instance.

```bash
# 1. Backend (use PORT=4000 — Vite owns :3000)
cd backend
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, PORT=4000, CORS_ORIGINS=http://localhost:3000
npm install
npm run prisma:generate
npm run prisma:push       # syncs schema.prisma to the DB (no shadow-DB migrations)
npm run seed               # idempotent — safe to re-run, upserts from data/db.json
npm run dev                 # http://localhost:4000

# 2. Frontend (separate terminal, from repo root)
cp .env.example .env.local  # VITE_LAMBDA_API_URL=http://localhost:4000
npm install
npm run dev                 # http://localhost:3000 (Vite)
```

Required env files (both gitignored, never commit secrets):

- `backend/.env` — `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `PORT=4000`, Stripe/Brevo/Shippo keys, Google OAuth, `FRONTEND_URL=http://localhost:3000`, optional AI/Sentry keys.
- `.env.local` (repo root) — `VITE_LAMBDA_API_URL=http://localhost:4000`, optional Stripe pub key / Cloudinary / Sentry. Vite exposes only `VITE_*` via `import.meta.env`.

There is **no hardcoded demo-login credential** in any env file — see §5.

**Cache-busting note:** the frontend persists its TanStack Query cache to `localStorage` (REQ-1310) for instant reload paint. Whenever a Prisma schema change adds a *required* field read by existing UI, bump `package.json`'s `version` — the persisted-cache `buster` is keyed to it and discards stale shapes automatically. Two real bugs (REQ-1616, REQ-1619) were caused by skipping this step; see `.agile-v/DECISION_LOG.md`.

---

## 4. Data model (Prisma / PostgreSQL)

Seven domains, seeded fresh (no DynamoDB export — see `docs/PROJECT_PLAN.md` §1 for why):

| Model | Notes |
|---|---|
| `User` | `role` (`user`/`admin`), `password` (nullable — Google-only accounts have none), `googleId`, `image` (avatar URL, Robohash fallback if absent), `isDemo` (drives the DB-backed demo-login dropdown). Has an `addresses` relation. |
| `Address` | Customer address book (REQ-1618). `label`, `fullName`, `street1/2`, `city`, `state`, `zip`, `country`, `phone`, `isDefault` (single-default-per-user invariant enforced in the service layer, not a DB constraint). Self-service only — ownership always derived from the JWT. |
| `Product` | Seeded from `data/db.json` (17 products, merged in from the user's separate `university-library` reference project, REQ-1635; the original 15 CodeBook products were removed per REQ-1636). Core fields (`author`, `category`, `level`, `pages`) plus catalog-metadata fields added in REQ-1616 (`sku`, `isbn`, `publisher`, `publishedYear`, `language`, `edition`, `fileFormat`, `tags`) — deliberately digital-catalog-appropriate, no physical-inventory fields (this storefront is confirmed digital-download-only). Both nullable, added via `prisma db push` (REQ-1634): `coverColor` (hex, drives the `BookCover` 3D-cover art — never white/near-white, see gotcha below) and `videoUrl` (optional trailer, `ProductVideo`). |
| `Order` | Cart snapshot, Stripe payment intent id (`@unique` — REQ-1641, makes order creation idempotent), status, tracking/refund state, and `shippingAddress` (REQ-1620 — a *snapshot* of the customer's selected saved `Address` at checkout time, not a live relation, so the order keeps its own record even if the source address is later edited/deleted). Cancelling a *paid* order auto-refunds via the real Stripe flow (REQ-1639) instead of just relabeling status; the invoice PDF (REQ-1612) is downloadable on demand, not just emailed (REQ-1640, `GET /orders/:id/invoice`); the admin and customer order-detail pages share one `OrderTimeline` component (REQ-1646) so they can't drift out of sync. `isGuest`/`guestEmail` (REQ-1659) — a guest checkout order gets a synthetic `guest_<uuid>` `userId`, never a real `User.id`, so this stays additive rather than making `userId` nullable. `couponCode`/`discountAmount` (REQ-1658) — a snapshot of the applied coupon, recomputed server-side, never trusted from the client. |
| `Review` | Product reviews with moderation status (approved/pending/rejected) plus `adminReply`/`adminReplyAt` (REQ-1619 — a public seller response). Every review requires a real `orderId` at creation, so "Verified Purchase" is always true and needs no separate flag. |
| `Ticket` | Support tickets + replies (`messages` JSON array), plus `priority` (low/medium/high/urgent), `category` (billing/technical/refund/account/other), and an optional ownership-checked `orderId` link (REQ-1619). |
| `ActivityLog` | Admin audit trail — also the source of the customer-facing order status timeline (REQ-1617; no separate history table, the timeline is derived from these rows). |
| `Wishlist` | REQ-1656 — save-for-later join table, unique `(userId, productId)` pair. |
| `StockAlert` | REQ-1657 — "notify me" back-in-stock subscription, unique `(productId, email)`; `notifiedAt` marks it fulfilled instead of deleting the row. |
| `Coupon` | REQ-1658 — checkout discount codes (`percent`/`fixed`, min-order, max-uses, expiry). |
| `ReturnRequest` | REQ-1663 — customer-initiated post-delivery return/RMA, admin approve (real Stripe refund via the shared `refundOrderPayment()`)/reject. |
| `RefreshToken` | REQ-1667 — only a SHA-256 hash is ever persisted (never the raw token); rotated on every use. |

`npm run seed` in `backend/` is idempotent and safe to re-run — it upserts both `create` and `update` branches identically, so content edits in `data/db.json` propagate on re-seed (this was a real bug, fixed during the migration: the original upsert's `update` clause was a no-op).

---

## 5. Auth

Two ways in, both issuing the same JWT (1-hour expiry as of REQ-1667, was 7 days — role embedded, stored in `sessionStorage` client-side) plus a long-lived refresh token:

1. **Email/password** — `POST /auth/login`, `POST /auth/register`, bcrypt-hashed passwords.
2. **Google OAuth (one-click)** — `GET /auth/google` → Google consent → `GET /auth/google/callback` (CSRF-protected via an httpOnly `state` cookie, 5-minute expiry) → find-or-create user by verified email → redirect to the frontend's `AuthCallback.tsx` with the token.

**Demo login** (`Login.tsx` dropdown) is fully DB-driven, not env-var-driven: `GET /auth/demo-accounts` returns the public `{email, name, role}` of every `User` with `isDemo: true`; `POST /auth/demo-login` issues a JWT for a vetted demo email with no password check. This replaced an earlier `REACT_APP_GUEST_LOGIN`/`REACT_APP_ADMIN_LOGIN` env-var pattern — the DB is the single source of truth for which accounts are demo-safe, and nothing credential-shaped ships in the frontend bundle.

**Refresh tokens (REQ-1667):** every login path (email/password, demo, Google) also returns a `refreshToken` — a random 96-hex-char value whose SHA-256 hash (never the raw value) is the only thing persisted in the `RefreshToken` table. `POST /auth/refresh` exchanges a valid, non-revoked, non-expired refresh token for a new access token *and* rotates the refresh token itself (the old one is revoked, a new one issued) — presenting an already-rotated token again is treated as a theft signal and rejected. `POST /auth/logout` best-effort-revokes the current refresh token server-side. On the frontend, `useTokenRefresh.ts` (mounted once at the `App` root) proactively renews the access token — on mount, on tab focus/visibility-change, and on a 5-minute safety-net interval — by decoding the stored JWT's own `exp` claim client-side (timing only, not a trust decision) and refreshing whenever it's within 10 minutes of expiring. This was a deliberate alternative to retrofitting a 401-retry interceptor into every one of this codebase's ~15 raw-fetch service files, which would have been a much larger, riskier change for the value delivered.

Every route that mutates data derives ownership from the JWT (`req.user.id`), never from a client-supplied id in the URL or body — this matters most for `/addresses` and any order/ticket write that references another entity, to avoid IDOR-class bugs.

**Hardening:** `helmet` sets standard security headers on every response (`crossOriginResourcePolicy` explicitly `cross-origin`, since this API is meant to be called from a separate frontend origin). `express-rate-limit` (`lib/rateLimit.ts`) caps the 3 credential-accepting auth routes — `POST /login`, `POST /register`, `POST /auth/demo-login` — at 20 requests/15min per IP; the read-only demo-account list and the Google OAuth redirect/callback aren't limited since neither accepts a client-supplied credential to brute-force. `lib/auth.ts` fails fast at startup in production if `JWT_SECRET` is missing, under 32 characters, or still a known placeholder string. The signing secret only ever lives on the backend — the frontend holds the JWT it receives after login, never the key that signs it (a "shared secret" in frontend code would be public and forgeable by anyone).

---

## 6. Frontend architecture patterns

- **Server state:** TanStack Query exclusively. Every domain has a `hooks/use<Domain>.ts` file exporting query + mutation hooks. Every mutation's `onSuccess` invalidates every affected query key — current page and every other mounted page, **including any page that embeds this data indirectly** (e.g. an order mutation also invalidates `["admin-user", userId]` since `AdminUserDetailPage` embeds that user's orders) — routed through `src/utils/queryInvalidation.ts`'s centralized helpers rather than ad hoc per-hook `invalidateQueries` calls. No `location.reload()` anywhere in real app code (the only 3 hits in the whole codebase are legitimate: `ErrorBoundary`'s crash recovery, `GoogleSignInButton`'s OAuth redirect, and neither is a CRUD-refresh substitute).
- **Instant navigation:** this is a client-side-routed SPA, so internal `<Link>`/`useNavigate` navigation never does a full page reload by construction. On top of that, `hooks/usePrefetchOnHover.ts` (a debounced, deduped `queryClient.prefetchQuery` wrapper) plus `DataTable`'s `onRowHover` prop warm the destination page's query cache *before* the click lands — either by seeding `setQueryData` directly (zero network cost, used where a list row already holds the exact shape the detail page needs — e.g. `ProductCard`, Admin Orders/Products/Tickets/Reviews rows) or via a real background fetch (used where the list shape is a strict subset of the detail shape — e.g. `AdminUsersPage` rows lack the embedded `orders`/`addresses`, Dashboard order cards lack the order-detail `timeline`).
- **Client state:** React Context only for genuinely client-only state (`CartContext`, `FilterContext`). Everything server-derived goes through TanStack Query, not Context.
- **UI primitives:** `src/components/ui/` — shared, typed-by-convention building blocks (Card, `DataTable` — generic `@tanstack/react-table` wrapper, replaced the old hand-rolled `SortableTable` which no longer exists in this codebase — FormSelect, PageHeader, AlertDialog, `AddressLines` (shared postal-address renderer, used everywhere an `Address` or an order's `shippingAddress` snapshot is displayed), `OrderTrackingInfo`, RippleButton, ScrollReveal/StaggerContainer/StaggerItem). Pages compose these rather than hand-rolling markup.
- **Toasts:** `src/lib/toast.ts` wraps Sonner. Titles are derived dynamically from the message text via regex rules (`SUCCESS_TITLE_RULES`/`ERROR_TITLE_RULES`), not hardcoded per call site — one call site change doesn't require touching a title map.
- **Destructive-action confirmation:** hand-built shadcn-style `AlertDialog` (`src/components/ui/alert-dialog.tsx`) gates cancel/delete/refund actions in the admin console.
- **Micro-interactions:** `RippleButton` (`src/components/ui/ripple-button.tsx`) is a pure-CSS, drop-in `<button>` replacement applied to every primary-CTA submit/action button across the purchase and engagement funnel (Add to Cart, Place Order, Pay Now, Create Ticket, Submit Review, admin Create/Update Product, admin Post Response, Add/Save Address) — secondary Cancel buttons stay plain.
- **Animation:** Framer Motion via `src/components/ui/motion.tsx`. `ScrollReveal` triggers independently per element; `StaggerContainer`/`StaggerItem` orchestrate a parent-driven stagger — **only use `StaggerItem` for content present at initial mount**; async-gated content (e.g. a dropdown populated after a query resolves) needs `ScrollReveal` instead, because Framer Motion doesn't replay an already-completed parent transition for children that mount later. (Discovered and fixed on the Login demo-account dropdown — see `.agile-v/DECISION_LOG.md`.)
- **Design system:** `docs/UI_STYLING_GUIDE.md` — gradient/colored-border/backdrop-blur card system with six color variants (sky/emerald/amber/rose/violet/blue), used by `AdminMetricsCard` and other KPI surfaces (every top-level and secondary stat block on the Admin Dashboard/Analytics pages uses this system; nested mini-stats that already sit inside a titled Card use a lighter colored-icon-badge treatment instead, to avoid visually over-nesting gradient cards).
- **No server-rendering layer:** this is a Vite SPA. There is no `page.tsx`/`"use client"` split, no SSR, no route-level data preloading framework — if you're coming from a Next.js App Router project, the closest equivalents are: TanStack Query's cache (instead of RSC data fetching), `usePrefetchOnHover`/`setQueryData` seeding (instead of `<Link prefetch>`), and plain client-side routing (there's no server to "sync" with).
- **Backend base URL:** every `src/services/*.ts` file imports one constant, `API_BASE_URL` from `src/lib/apiBase.ts`, instead of each declaring its own copy — falls back to `http://localhost:3000` (the documented local-dev Express port) if `VITE_LAMBDA_API_URL` is unset.
- **Book-cover art / recommendations (REQ-1634–1635):** `BookCover` (`components/ui/book-cover.tsx`, memoized SVG cover + spine, falls back to the flat image when a product has no `coverColor`) is used on `ProductCard`, `ProductDetail`, and the admin CRUD form/detail/table. `ProductVideo` renders an optional trailer, no-op when `videoUrl` is unset. `ProductReel` (`components/ui/product-reel.tsx`) is a `requestAnimationFrame`-driven infinite ticker (track duplicated once, wraps at exactly one copy's measured width) — deliberately not `scrollBy`/`setInterval`, which reads as discrete jumps instead of a smooth continuous drift; pause-on-hover and manual chevrons adjust the same offset the auto-drift uses. `useRecommendedProducts` (in `hooks/useProducts.ts`) scores the already-cached product list by shared tags/category — no dedicated endpoint.
- **Auth pages:** `Login.tsx`/`Register.tsx` use the shared `AuthSplitLayout` (`src/components/ui/auth-split-layout.tsx`) — a 60/40 image+form split screen (`hidden lg:block` image panel with brand copy/feature bullets over a gradient overlay, `public/images/10011.avif`/`10003.avif`), built from this project's own existing light/dark Card tokens rather than a separate design system. Both forms use the shared `FormInput`/`FormLabel` components; `Login.tsx` uses controlled `useState` inputs (required for `FormInput`, which isn't `forwardRef`-wrapped), `Register.tsx` keeps its uncontrolled `form.elements` read.

---

## 7. Backend architecture patterns

- **Layering:** `routes/*.routes.ts` (HTTP layer, one file per domain) → `services/*.service.ts` (business logic + Prisma calls). Routes stay thin; validation (Zod schemas) and DB access live in services.
- **Auth middleware:** JWT verification + role check, applied per-route. Ownership for any user-scoped write (addresses, order references from tickets) is always derived from `req.user.id`, never trusted from the request body/params.
- **Response shape:** plain `res.status(code).json(data)` — no envelope wrapping, matching what the frontend already expects from the ported Lambda contract.
- **CORS:** locked to `CORS_ORIGINS` (comma-separated allow-list), not `*`.
- **Snapshots over live references:** denormalized JSON snapshots are used deliberately where a record needs to survive changes to its source (`Order.user`, `Order.cartList`, `Order.shippingAddress`) — this is a repeated, intentional pattern, not duplication to clean up.
- **Router-level auth middleware must be path-scoped:** `router.use(requireAuth)` (no path argument) applies to *every* request that reaches that router, not just its own routes — and if that router is mounted in `app.ts` with no path prefix (`app.use(router)`, common for routers whose own routes already carry the full path, e.g. `/wishlist`), its blanket auth check silently intercepts and 401s every route mounted *after* it in the chain too. This was a real, severe bug (REQ-1671): `wishlist.routes.ts` used this pattern while mounted with no prefix, breaking `/stock-alerts`, `/coupons/validate`, and the real Shippo webhook (which never sends a Bearer token) for any unauthenticated caller. Fixed by applying `requireAuth` per-route instead — the convention every other route file already follows. `tickets.routes.ts`/`notifications.routes.ts` also use the blanket form but are safe because they're mounted *with* an explicit prefix (`app.use("/tickets", ticketsRoutes)`), which scopes Express's dispatch to that router before its internal middleware ever runs.
- **Shared-secret comparisons:** any check against a value that's meant to stay secret (e.g. the Shippo webhook's URL-embedded secret) uses `crypto.timingSafeEqual`, not `===`/`!==`, to avoid a timing side-channel.
- **Public, unauthenticated write endpoints** (e.g. `POST /stock-alerts`, an email-collecting "notify me" route with no login required) go through `publicWriteLimiter` — the same reasoning as `paymentLimiter` on `/coupons/validate`: no client credential to rate-limit against, so the endpoint itself needs the bound.

---

## 8. Key admin features

- **Dashboard / Analytics:** gradient KPI cards (`AdminMetricsCard`) with real breakdown badges (e.g. orders-by-status) and an AI Business Insights panel (multi-provider LLM fallback chain, `docs/LLM_MODEL_SELECTION.md`) — not static numbers. `AdminCatalogInsights` (REQ-1634) adds category/language/publication-year breakdowns, top-rated products, and catalog-health metrics — all computed client-side in `adminService.getAdminStats()` from the products list it already fetches, no dedicated endpoint.
- **Products / Orders / Reviews / Users / Tickets:** every domain has both a `DataTable`-based list page (search + filter bar, sortable columns, hover-prefetch on rows) and a dedicated detail page — Reviews was the last domain to get one (`AdminReviewDetailPage.tsx`, REQ-1619). Row cells that reference another entity (order → customer, review → product/user) are clickable sky-colored links to that entity's detail page, not plain text.
- **User detail:** embeds that user's full order history and saved address book in one response (`GET /admin/users/:id`), so an admin sees everything about a customer without extra navigation.
- **Order detail:** shows the itemized cartList breakdown, the real saved shipping address (if the customer selected one at checkout), and the Shippo label-generation/manual-tracking controls.
- **History / Activity log:** admin audit trail of state-changing actions — also the data source for the customer-facing order status timeline.

---

## 9. What's next

See `docs/PROJECT_PLAN.md` §6 for the authoritative, checkbox-tracked phase list and §11 for a running done/not-done summary. As of the latest pass, every phase through REQ-1673 is implemented and verified (REQ-1656–1672 pushed to `origin/main`; REQ-1673 implemented/verified, pending commit) — Phase 9 added wishlist/favorites, back-in-stock alerts, coupon codes, guest checkout, a live Shippo tracking webhook, an opt-in scheduler for the low-stock digest + a new weekly AI sales-summary email, product CSV import/export, a customer return/RMA flow, refresh tokens, an AI product-description generator, `pg_trgm`-powered fuzzy product search, and AI-assisted support-ticket reply drafts, followed by six polish passes: REQ-1668 closed 3 minor hardening gaps; REQ-1669, a whole-codebase pass, found zero further gaps; REQ-1670 seeded 2 demo coupons and fixed a loading-UX inconsistency; REQ-1671 gave guest checkout orders a way to request a return and, while live-testing that fix, found and fixed a severe pre-existing bug where an unscoped `router.use(requireAuth)` in `wishlist.routes.ts` was silently 401-blocking every route mounted after it in `app.ts` for unauthenticated callers — including the real Shippo webhook, which never sends a Bearer token (see §7); REQ-1672, re-auditing REQ-1671, found the shared `Order` type was missing 4 fields that actually exist on the Prisma model, which had let a guest-return edge case go unnoticed; REQ-1673, pattern-matching REQ-1671's fix against every other customer self-service action, proactively found the same class of gap in invoice re-download (`GET /orders/:id/invoice`) before it was reported — fixed identically. The only intentionally-deferred items are Coolify/VPS deployment (explicit user hold), wiring the customer address book's *default* address automatically into every checkout without an explicit selection step (optional/manual by design), Stripe saved payment methods and admin 2FA (both explicitly declined by the user this round), and semantic (meaning-based, not just typo-tolerant) search beyond `pg_trgm`.

**Error monitoring:** Sentry (`@sentry/react` frontend, `@sentry/node` backend) — the browser SDK is tunneled through `POST /api/monitoring` (`backend/src/routes/monitoring.routes.ts`) instead of hitting `*.ingest.sentry.io` directly, so ad-blockers can't silently drop error reports. Wired into the existing `ErrorBoundary.tsx` rather than a separate component.
