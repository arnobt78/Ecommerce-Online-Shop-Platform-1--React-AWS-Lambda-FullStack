# CodeBook — Backend Migration + TypeScript Plan

**Status:** Phase 1 (backend migration) functionally complete and locally verified; Phase 2 (TypeScript + Vite) 100% done — backend and frontend both fully strict-typed, zero `.js`/`.jsx` remain, asset restructure + font self-hosting + a deployment-readiness audit (git tracking reconciliation, dead code removal, persisted query cache, admin code-splitting) also complete; Phase 3 (cache audit) complete; Phase 4 (UI/UX polish) complete; Phase 5 (config-hygiene + auth hardening + auth-page redesign) complete; Phase 6 (layout-alignment fix + CRA cleanup + Sentry error monitoring + post-implementation deep audit) complete; Phase 7 (SEO/lint hygiene, README rewrite, university-library catalog enrichment — book-cover art, trailer video, recommendations reel, admin catalog insights) complete. Deployment (Coolify) intentionally on hold. See §11 and §6 checklists for the authoritative item-by-item status.
**Traceability:** REQ-1200 to REQ-1636 in `.agile-v/REQUIREMENTS.md`. Risks: `RISK-0006`, `RISK-0007` in `.agile-v/RISK_REGISTER.md` (`RISK-0005` closed — see §1).
**Trigger:** AWS account `849695476938` closes **2026-08-16** (free-tier period ended). After that date the current production backend (Lambda + API Gateway) stops responding and all DynamoDB data is permanently deleted.

---

## 0. Why, in one paragraph

CodeBook's backend (33 AWS Lambda functions + API Gateway + 6 DynamoDB tables) becomes unreachable on 2026-08-16. The plan: move the backend to Express.js + PostgreSQL, self-hosted on the user's existing Hetzner VPS via Coolify (same pattern already used for 8+ other projects), keeping every current feature, API contract, and the frontend UI byte-for-byte identical, plus one new feature (Google one-click sign-in). Once that's stable, convert the whole codebase (frontend + backend) to strict TypeScript, and migrate the frontend build tool from CRA to Vite along the way. Frontend stays on Vercel throughout — only the backend's home changes.

---

## 1. Data strategy — decided, no migration needed (2026-07-30)

**Original assumption (superseded):** export live DynamoDB data before the AWS account closes.

**User decision:** not needed — production DynamoDB data does not need to be preserved. The new backend seeds fresh from local repo data instead:

- `data/db.json` — legacy json-server mock file, still present in the repo, containing **15 real product records** (`name`, `overview`, `long_description`, `price`, `poster`, `image_local`, `rating`, `stock`, `size`, `best_seller`, `featured_product`, etc.) and a `featured_products` array. This becomes the seed source for the `products` table.
- `data/routes.json` — legacy json-server routing config only, not seed data (reference/context only).
- **New test accounts** (replacing the current `.env`-driven CRA dropdown, which today actually resolves to `admin@example.com` / `test@example.com`, both `12345678` — worth knowing since it doesn't match what was described, but the new accounts requested are what we're building):
  - `test@admin.com` / `12345678` — role `admin`
  - `test@user.com` / `12345678` — role `user` (matches your own `docs/DROPDOWN_TEST_CREDENTIALS_DOCS.md` reference template exactly — this is what you were recalling as "current")
- `tickets`, `reviews`, `activity_log` have no legacy seed source (they're AWS-era-only domains) — they start empty, which is correct/expected behavior for a fresh dev/demo database.

`RISK-0005` (AWS data loss) is now **closed/accepted** — this was only a risk if data preservation mattered, and it doesn't.

---

## 2. Current architecture (as audited)

```bash
React 19 SPA (CRA/react-scripts) — Vercel
   │  fetch, JWT in sessionStorage
   ▼
AWS API Gateway (HTTP API, CORS: *)
   │
   ▼
33 AWS Lambda functions (Node 22), aws-lambda/functions/{auth,products,orders,admin,payment,email,notifications,tickets,reviews}/
   │  shared/{auth,response,products,orders,users,reviews,tickets,activityLog,qrcode}.js
   ▼
DynamoDB: codebook-products, codebook-orders, codebook-users,
          codebook-activity-log, codebook-tickets, codebook-reviews
   (no dedicated notifications table — computed from orders+tickets)

External: Stripe (payments), Cloudinary (images), Brevo (email), Shippo (labels)
```

Response contract is already Express-shaped: every Lambda returns `{ statusCode, headers, body: JSON.stringify(data) }` via `shared/response.js` (`successResponse`/`errorResponse`/`handleOptions`) — maps almost mechanically to `res.status(code).json(data)`.

Auth: `shared/auth.js` — JWT (`jsonwebtoken`, 7-day expiry, role embedded in token) + `bcryptjs`. Frontend stores token + user id + role in `sessionStorage` (`src/services/authService.js`).

**Known cleanup candidate (not touched yet):** root-level `lib/` duplicates `aws-lambda/shared/` using `@aws-sdk` directly — looks like leftover from the archived Vercel-serverless-functions backend (REQ-1102). Audit for zero references before deleting (REQ-1213).

---

## 3. Target architecture

```bash
React 19 SPA (unchanged UI/behavior) — Vercel
   │  fetch/TanStack Query, JWT in sessionStorage (unchanged in phase 1)
   ▼
Express.js (Node 22) — Docker container on Hetzner VPS (77.42.71.87), via Coolify
   │  CORS_ORIGINS = actual Vercel frontend origin (no more "*")
   │  same route surface, same request/response shapes, + /auth/google, /auth/google/callback
   ▼
PostgreSQL (Prisma) — existing shared Coolify Postgres container (xok0c8w8808g8080og4gccwc)
   database: codebook_db, user: codebook_user (matches established project convention)
   seeded from data/db.json + fresh test accounts (see §1)

External: Stripe, Cloudinary, Brevo, Shippo, Google OAuth — unchanged / new
```

**Why Express.js:** requested directly; matches the user's own established Node.js/Express + Coolify pattern (already used for the `sernitas-care` project on the same VPS); simplest, most direct 1:1 port of the existing Lambda-handler style (one file per action → one Express route handler).

**Why PostgreSQL + Prisma:** the user already runs a shared Postgres container on this VPS for 8+ other projects, all using Prisma with `prisma db push` (no shadow-DB migrations). Reusing that container/convention means zero new infra to operate and zero new patterns to learn later.

**Why not Redis (for now):** per the user's own `PROJECT_ENGINEERING_PLAYBOOK.md` §3 ("MUST NOT invent infra... until measured need"), a single small VPS instance with TanStack Query as the primary cache has no current multi-instance or expensive-aggregation need. Revisit if traffic/scale ever demands it (REQ-1403).

---

## 4. Data model (Postgres schema, seeded fresh)

6 Prisma models, matching the current DynamoDB tables' domains:

| Domain       | Postgres table                                                                                                                           | Notes                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products     | `products`                                                                                                                               | Seeded from `data/db.json` (15 records). Includes `featured_product` flag — no separate table.                                                                                                                                                        |
| Orders       | `orders` (+ `order_items` if currently embedded as a list — confirm exact shape from `aws-lambda/shared/orders.js` during schema design) | Stripe payment intent id, tracking, refund state                                                                                                                                                                                                      |
| Users        | `users`                                                                                                                                  | Role-based (`user`/`admin`, already exists today), hashed password (**nullable** — Google-only accounts have none), **new fields**: `image`/`avatar_url` (nullable), `google_id` (nullable, unique), `email_verified` (nullable timestamp) — REQ-1506 |
| Activity log | `activity_log`                                                                                                                           | Admin audit trail — starts empty                                                                                                                                                                                                                      |
| Tickets      | `tickets` (+ `ticket_replies` if embedded)                                                                                               | Support tickets — starts empty                                                                                                                                                                                                                        |
| Reviews      | `reviews`                                                                                                                                | Product reviews, moderation status — starts empty                                                                                                                                                                                                     |

Exact column/relation design happens in the Constrain phase (Logic Gatekeeper + Prisma schema authoring), reading the actual `aws-lambda/shared/*.js` item shapes — not guessed here.

---

## 5. New feature — Google one-click sign-in (REQ-1500 to REQ-1505)

Requested alongside the migration. Not present in the original AWS backend — this is net-new.

- **Frontend:** "Continue with Google" button on both `Login.js` (below "Log In") and `Register.js` (below "Sign Up").
- **Backend:** OAuth2 authorization-code flow — `GET /auth/google` (redirect to Google) → `GET /auth/google/callback` (exchange code, find-or-create user by verified email, issue the app's own JWT) → redirect to a frontend callback route with the token.
- **Why this pattern over a client-only ID-token flow:** matches the redirect/callback convention you already use on other Coolify-hosted projects (`docs/SUBDOMAIN_ARNOBMAHMUD_SETUP.md` §5 — e.g. `.../api/auth/callback/google`), and you provided both a Client ID _and_ Client Secret, which only the code-exchange flow needs.
- **Frontend callback route** (e.g. `/auth/callback`): receives the token, runs the exact same session-bootstrap `Login.js` already does today (store token+role in `sessionStorage`, clear/prefetch React Query cache, navigate to `/products`) — no duplicated logic.
- **New Google users** default to role `user`. Linking behavior for an email that already has a password account is a small Constrain-phase decision, not a blocker.
- **Avatar handling (REQ-1506, REQ-1507):** Google supplies a profile picture URL on sign-in — store it in the new `users.image` column. A reusable `UserAvatar` component displays `image` if present, otherwise falls back to a deterministic Robohash avatar (`https://robohash.org/<user id>?set=set4`) — so regular email/password users (who have no `image`) still get a distinct generated avatar instead of a blank/broken image. One component, used everywhere a user avatar appears (navbar, admin user list/detail, tickets, reviews) — not copy-pasted per page.

**Credential handling (important):** you shared a live `GOOGLE_ID` and `GOOGLE_SECRET` in chat. The secret will **only** ever be placed in a gitignored `.env`/`.env.local` file locally and in Coolify's environment variables in production — never in this repo's tracked files, never in this plan, never in `.env.example`. See `RISK_REGISTER.md` RISK-0007.

---

## 6. Phasing (sequenced deliberately — see RISK-0006)

### Phase 1 — Backend platform migration + Google sign-in (REQ-1200 to REQ-1213, REQ-1500 to REQ-1505) — **deadline-relevant**

1. ✅ Provision local Postgres (`codebook_dev`) — Coolify provisioning deferred with deployment, see step 9 (REQ-1201).
2. ✅ Design Prisma schema (REQ-1202).
3. ✅ Write idempotent seed script: `data/db.json` products + `test@admin.com`/`test@user.com` test accounts, plus DB-driven demo-login flow (REQ-1204, REQ-0104).
4. ✅ Scaffold Express app; port `shared/*.js` → Express middleware/services (REQ-1205).
5. ✅ Implement all 33 existing routes with identical contracts (REQ-1200), plus `/auth/google` + `/auth/google/callback` (REQ-1502).
6. ✅ Re-point Stripe webhook, keep JWT auth as-is, keep Cloudinary/Brevo/Shippo config-only (REQ-1206-1208).
7. ✅ Restrict CORS to real origins — set to `http://localhost:3000` locally, production origin set at deploy time (REQ-1209).
8. ✅ Add "Continue with Google" buttons + frontend callback route (REQ-1500, 1501, 1503).
9. ⬜ Dockerfile + Coolify deploy at a new subdomain (REQ-1210) — **explicitly deferred by user request**: local migration + testing finishes first, deployment discussed later.
10. ⬜ Point frontend at new URL (REQ-1211), verify end-to-end, decommission AWS (REQ-1212) — blocked on step 9.
11. ✅ Resolve the `lib/` dead-code question (REQ-1213).

**Definition of done for Phase 1:** every existing user-facing feature works identically against the new backend; Google sign-in works on both Login and Register; no UI changes elsewhere; no secrets in git.
**Status: functionally complete and locally verified (steps 1–8, 11). Only the Coolify deploy itself (steps 9–10) remains, on hold per user instruction.**

### Phase 2 — TypeScript migration + Vite (REQ-1300 to REQ-1311) — user explicitly pulled this in ahead of the original "after Phase 1 deploy" gate

1. ✅ Add strict TS to Express backend, convert `.js` → `.ts` (REQ-1301). All 26 files under `backend/src/` + `prisma/seed.ts` converted, `tsconfig.json` strict (`noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, etc.), `tsc` build + runtime smoke-tested (health/products/demo-accounts/login all verified against the real DB).
2. ✅ Add strict TS to the frontend, convert `.js`/`.jsx` → `.ts`/`.tsx`, migrating CRA → Vite in the same pass (REQ-1300, REQ-1303). **100% complete**: every file under `src/` is now `.ts`/`.tsx` — zero `.js`/`.jsx` remain. `tsconfig.json`'s incremental-adoption `allowJs`/`checkJs` escape hatch has been removed now that it's no longer needed. `vite.config.ts`, root `index.html`, `tsconfig.json`/`tsconfig.node.json`, flat `eslint.config.js`, all `REACT_APP_*` env vars renamed to `VITE_*`, `postcss.config.cjs`/`tailwind.config.cjs` all in place. `tsc -b` and `npx eslint src` both run clean (0 errors; the only remaining warnings are 6 pre-existing, accepted `react-refresh/only-export-components` notices on files that intentionally colocate a context with its consumer hook). Production build verified (`tsc -b && vite build`, 2931 modules, clean) and dev server verified in a real browser across every major page — home, products list, product detail, cart, dashboard (empty + populated), tickets, and all 8 admin pages (dashboard/products/orders/users/analytics/history/tickets/reviews/settings) — 0 console errors throughout, live DB data, correct Tailwind styling and cache-invalidation behavior.
3. ✅ Single-source DTOs: Prisma-generated backend types, shared/generated types on the frontend — no hand-duplicated interfaces (REQ-1302). Backend uses Prisma's generated types directly (`import type { Product } from "@prisma/client"` etc.); frontend has one hand-synced `src/types/index.ts` mirroring `schema.prisma` field-for-field (no shared-package tooling exists between the two, so this is the standard manually-synced-DTO pattern for a decoupled frontend/backend).
4. ✅ Zod validation at API boundaries (REQ-1304). Every backend route that accepts a body validates it with a Zod schema colocated in the relevant `*.service.ts` (`createProductSchema`, `createOrderSchema`, `registerSchema`, `createReviewSchema`, `createTicketSchema`, etc.) before the service layer ever sees the data.
5. ✅ Strict null checks, no `any`, discriminated unions for API results (REQ-1305). True across the entire codebase now — backend and frontend. `ApiResult<T>` discriminated union defined in `src/types/index.ts` for call sites that want it; most services throw and let TanStack Query's error state handle it instead, matching the existing codebase convention.
6. ✅ Asset restructure (REQ-1306): `src/assets/` (bundler-imported logo + hero image) deleted; both files moved into `public/` alongside the existing product images. `public/assets/images/*.avif` flattened to `public/images/*.avif` (dropped the redundant `assets/` wrapper level). All references updated: the 3 `import Logo from ...` bundler imports became plain `/logo.png` public-path strings, `data/db.json`'s 20 `image_local` paths rewritten from `/assets/images/*` to `/images/*`, and the backend reseeded (idempotent upsert) so the already-seeded DB rows picked up the corrected paths too. `public/manifest.json`, `logo192.png`, `logo512.png` were audited and kept — they're actively referenced (`og:image`/`twitter:image`/`apple-touch-icon`/`<link rel="manifest">` in `index.html`), not dead PWA scaffolding.
7. ✅ Self-hosted fonts (REQ-1307): dropped the Google Fonts `@import` entirely. Poppins was imported but never actually used anywhere (`font-family: "Roboto"` is the only font applied) — removed as dead weight. Roboto is now self-hosted from `public/fonts/roboto/roboto-var.woff2`, a single ~43KB variable-weight file (weight range 300–700) covering every `font-light/normal/medium/semibold` utility actually used in the codebase, downloaded once from Google's static CDN and served from our own origin (no runtime request to `fonts.googleapis.com`). `bootstrap-icons` (previously loaded from the jsdelivr CDN) is now an npm dependency imported directly in `index.css`, so Vite bundles its font files locally with content-hash cache-busting too — verified in the production build output.
8. ✅ Deployment-readiness deep audit (REQ-1308 to REQ-1311). **Git tracking reconciled** (REQ-1308): the entire live codebase was untracked while the index held 258+15 stale file paths under a pre-restructure `codebook/` subfolder and a retired reference-backend folder, both already deleted from disk — a hard blocker for any git-based deploy. Reconciled with `git add -A` after confirming `.env`/`.env.local`/`backend/.env` are correctly gitignored; staged only, not committed. **ESLint scope + real errors fixed** (REQ-1309): excluded the retired `aws-lambda/`/`.aws-sam/` legacy backend from lint scope (was throwing 38 spurious parse errors on non-live code); fixed a real `require()` lint error in `backend/prisma/seed.ts` (→ `fs.readFileSync`/`JSON.parse`). **Dead code + debug artifacts removed** (REQ-1309): two obsolete root scripts from the retired AWS Lambda era (`test-migration.js`, `add-vercel-env.sh` — the latter also had a live Stripe key hardcoded inline), a stray verification screenshot, one orphaned component (`LoadingSpinner.tsx`, zero references anywhere), and `.playwright-mcp/` debug-log output added to `.gitignore`. **Persisted query cache** (REQ-1310): `@tanstack/react-query-persist-client` now persists the TanStack Query cache to `localStorage` (10-min staleTime, 1-hr maxAge, version-tied `buster`), so a reload/reopened tab paints from last-known-good data instantly; verified the existing per-logout `queryClient.clear()` calls also wipe the persisted snapshot (8 cached queries → 1 immediately after logout in a live browser check), so no cross-account data leak on a shared browser. **Admin console code-split** (REQ-1311): `/admin/*` routes now load as one separate `React.lazy` chunk (139KB/28KB gzip) instead of shipping in every customer's initial bundle, with an idle-time background prefetch for already-logged-in admins so their first `/admin` click still feels instant. `tsc -b`/`eslint`/`vite build` all clean on both frontend and backend after every change; verified live in the browser (admin dashboard/analytics/products all render correctly through the lazy chunk, 0 console errors).

**Status: 100% done and verified.** Backend: fully typed, built, and runtime smoke-tested. Frontend: fully typed (0 `.js`/`.jsx` remain), Vite build tooling complete, `tsc -b`/`eslint`/`vite build` all clean, and verified end-to-end in a real browser across every page type. Asset restructuring and font self-hosting (REQ-1306/1307) also complete.

### Phase 3 — Cache/invalidation audit (REQ-1400 to REQ-1403) — can run alongside Phase 2

1. ✅ Single `queryKeys` module (REQ-1400).
2. ✅ Audit every mutation hook for full invalidation coverage — current page + related list/detail/dashboard/badges, no full-page reload (REQ-1401).
3. ✅ TanStack-Query-only, no SSE/WebSocket (REQ-1402, decided).
4. ✅ Confirm Redis stays out of scope for v1 (REQ-1403).

**Status: audit pass completed this round — see §11 for findings/fixes.**

### Phase 4 — UI/UX polish (REQ-1600 to REQ-1615) — added mid-project, see §11

1. ✅ Sonner toasts with dynamic per-message titles (REQ-1600).
2. ✅ Real backend error messages surfaced instead of generic HTTP status text (REQ-1601).
3. ✅ AlertDialog confirmation on destructive admin actions (REQ-1602).
4. ✅ Testimonials/FAQ real content, no Lorem ipsum (REQ-1603, REQ-1604).
5. ✅ Lucide icon pass — full `bi-*` → `lucide-react` sweep complete (REQ-1605). Every Bootstrap Icon usage across ~40 files replaced; `bootstrap-icons` npm dependency and CSS import removed entirely (production CSS bundle 141KB → 61KB). One real latent bug caught and fixed mid-sweep: a click-outside handler in `DropdownLoggedIn.tsx` was selecting the account-menu icon by its `.bi-person-circle` CSS class, which the swap would have silently broken — replaced with a `data-user-avatar-trigger` attribute shared by both the logged-in and logged-out button.
6. ✅ Framer Motion animation system: stagger reveal, scroll reveal, per-route transition (REQ-1606).
7. ✅ RippleButton — Login/Register submit buttons, plus wider rollout (REQ-1607, REQ-1621) across every primary-CTA submit/action button on the purchase + engagement funnel: Add to Cart, Place Order, Pay Now, Create Ticket, Submit/Update Review, admin Create/Update Product, admin Post/Update Response, Add/Save Address. Secondary Cancel buttons deliberately left plain.
8. ✅ Gradient/icon KPI cards — Dashboard + Analytics summary rows, plus the deeper nested stat blocks (REQ-1608, REQ-1621): "Average Order Value"/"Products Sold"/"User Analytics" converted to the full `AdminMetricsCard` system; "Product Performance"'s mini-stats (nested inside an existing Card) got a colored-icon-badge treatment instead of a second full gradient card, to avoid visual over-nesting.
9. ✅ Rotating Ken-Burns hero background (REQ-1609).
10. ✅ Clickable product/order/user detail links across admin tables (REQ-1610).
11. ✅ TanStack Table migration with dropdown row actions (REQ-1611). Two new reusable primitives — `DataTable` (generic `@tanstack/react-table` wrapper matching the old `SortableTable`'s visual output 1:1) and `DropdownMenu` (hand-built shadcn-style, same pattern as `AlertDialog`) — then all 6 admin list pages (Products, Orders, Users, Reviews, Tickets, History) migrated from `SortableTable` + inline action buttons to `DataTable` + dropdown row actions. `SortableTable.tsx` deleted (dead code). Verified live: sorting, dropdown open/close, click-outside, and row-click navigation (Tickets) all work with 0 console errors.
12. ✅ Auto-generate + attach + email invoice PDF on order success (REQ-1612). `pdfkit` generates the invoice server-side (`backend/src/services/invoice.service.ts`) and attaches it to the existing Brevo `order-confirmation` email — no frontend changes needed, no headless-browser dependency, PDF failure never blocks the confirmation email itself. Invoice number derived from the order id (no schema change). Verified in isolation: valid single-page PDF, correct line items/total; a layout bug (order-id UUID overlapping the date line) was caught and fixed before considering this done.
13. ✅ Multi-model AI insights (REQ-1613). User supplied 9 free-tier provider keys. `backend/src/lib/ai/` — one generic OpenAI-compatible chat-completion client shared across Gemini, Groq, OpenRouter, Cerebras, NVIDIA NIM, Mistral, Cohere, GitHub Models, and Hugging Face, tried in priority order with automatic silent fallback (never depends on a single provider). `POST /admin/ai-insights` takes a client-computed analytics summary (zero extra DB queries — reuses data already in the TanStack Query cache) and returns 3-5 short, data-grounded recommendations, with a 10-minute in-memory response cache (no Redis, per REQ-1403). New "AI Business Insights" card on the Analytics page with loading/error/not-configured states and a manual Refresh button. Verified live against real Gemini traffic; caught and fixed a `max_tokens` truncation bug (reasoning models spend part of the budget on hidden reasoning) during verification.
14. N/A `SAFE_IMAGE_REUSABLE_COMPONENT.md` (REQ-1614) — Next.js-specific, doesn't apply to this CRA stack.
15. ⬜ `VERCEL_PRODUCTION_GUARDRAILS.md` adaptation (REQ-1615) — deferred until deployment is back in scope.
16. ✅ Product catalog data-enrichment, phase 1 of a broader page-redesign initiative (REQ-1616). 8 new digital-catalog-appropriate `Product` fields (`sku`, `isbn`, `publisher`, `publishedYear`, `language`, `edition`, `fileFormat`, `tags`), deliberately excluding physical-inventory fields (weight/dimensions/warehouse) since the storefront is confirmed digital-download-only. All 15 seed products hand-enriched with real values; new "Book Details" section (customer `ProductDetail.tsx`) and "Catalog & Inventory Metadata" card (`AdminProductDetailPage.tsx`) plus matching `ProductForm.tsx` inputs. Caught and fixed a real bug: the persisted query cache (REQ-1310) held stale pre-change product shapes, crashing on `product.tags` — fixed with defensive nullable typing plus an app-version bump to trigger the existing cache-buster. Verified live (edit→save→revisit round-trip against the real DB).
17. ✅ Customer-facing Order Detail page + status timeline (REQ-1617), phase 2. New `GET /orders/:id` (ownership-checked) embeds a chronological timeline derived entirely from existing `ActivityLog` rows — no schema change. New `/orders/:id` page: itemized cartList breakdown + timeline + reused `OrderTrackingInfo`. Dashboard order cards now link to it. Caught and fixed a real naming collision between the new customer-facing `getOrderById`/`useOrder` and the pre-existing admin ones sharing the same barrel export — renamed to `getOrderDetail`/`useOrderDetail`.
18. ✅ Customer address book + admin user order/address visibility (REQ-1618), phase 3. New `Address` model + self-service `/addresses` CRUD (ownership always from the JWT, never a client-supplied id). Found a real pre-existing gap while scoping: `shipping.service.ts`'s Shippo label generation already reads `order.shippingAddress`/`order.address`, but checkout never collects either (`StripeCheckout.tsx`'s own on-screen note admits it uses fallback test addresses) — an address book is a genuine fix, not an invented feature. New `AddressBook.tsx` on the customer Dashboard (inline add/edit, `AlertDialog` delete confirm, single-default-per-user enforced service-side). `GET /admin/users/:id` now embeds `orders` + `addresses`, powering new read-only "Address Book" and "Order History" cards on `AdminUserDetailPage.tsx` (fixing that page's stale doc-comment claim that it already showed orders). Checkout itself was deliberately left unwired to addresses — out of this round's scope, flagged as a follow-up.
19. ✅ Tickets + Reviews data-enrichment (REQ-1619), phase 4 — final two domains of the page-redesign initiative. Tickets gained `priority` (low/medium/high/urgent), `category` (billing/technical/refund/account/other), and an optional ownership-checked `orderId` link, wired through ticket creation, the customer/admin detail pages, the customer list page, and a new admin Priority column + filter. Reviews gained a public `adminReply`/`adminReplyAt` "store response" (the standard seller-reply-to-review pattern) plus a computed "Verified Purchase" badge (zero schema — every review already requires a real order at creation). Reviews also got its first-ever detail page (`AdminReviewDetailPage.tsx` at `/admin/reviews/:id`), closing the one remaining admin list-without-detail gap (Products/Orders/Users/Tickets already had one). Caught and fixed a latent bug in the same session's REQ-1618 work (`AdminUserDetailPage.tsx` reading `user.addresses.length` with no fallback — same crash class as REQ-1616's `product.tags` bug). All page-redesign domains from the user's original scope are now done — see §11.
20. ✅ Checkout wired to the address book (REQ-1620) — closes the one item deliberately deferred from REQ-1618. New `Order.shippingAddress` snapshot column (a copy, not a live relation, so the order survives later edits/deletes of the source address); optional selector in `StripeCheckout.tsx` (defaults to the user's default address, never blocks checkout — this store is digital-download-only). This also completes the real gap `shipping.service.ts` already had a code path for (Shippo label generation reading `order.shippingAddress`) but that nothing populated until now. Surfaced the address on `OrderTrackingInfo` (restructured to show independent of shipment-tracking status) and `AdminOrderDetailPage.tsx`. Found and deleted a fully dead file in the process: `src/pages/Cart/components/Checkout.tsx` (superseded mock-payment component, zero references anywhere).
21. ✅ Instant-navigation / cache-freshness pass (REQ-1621) across the whole app, plus the two Phase-4 partial items (RippleButton rollout, KPI card conversion — see items 7–8 above). Audited every mutation hook's invalidation coverage and fixed 2 real gaps (order creation/status changes and address mutations weren't invalidating the admin user-detail view that embeds them, REQ-1618). Fixed one real `window.location.reload()` anti-pattern (`AdminReviewsPage.tsx`'s error retry → the query's own `refetch()`); confirmed the only other 2 full-reload call sites are legitimate (crash recovery, Google OAuth redirect). New `usePrefetchOnHover` hook + a `DataTable` `onRowHover` prop power instant-feeling list→detail navigation: direct cache seeding (zero network cost) where a list row already holds the exact shape a detail page needs, real network prefetch where it doesn't (verified live via network trace — hover fires the request before any click). Extracted a shared `AddressLines` component, removing a 4-way-duplicated address-rendering block. Note: several of the user's phrasing for this item referenced Next.js concepts (`page.tsx`, `"use client"`, SSR) that don't apply to this Vite SPA (no server-rendering layer) — translated to this architecture's real equivalent (TanStack Query cache + already-instant client-side routing) instead of attempted literally.

**Legend:** ✅ done & verified · 🚧 partially done (scoped intentionally) · ⬜ not started · N/A doesn't apply to this stack.

---

### Phase 5 — Config hygiene, auth hardening, auth-page redesign (REQ-1622 to REQ-1625) — added 2026-08-01

1. ✅ Build-artifact/config-hygiene audit (REQ-1622). Root-caused and fixed a real misconfiguration: `vite.config.js`/`vite.config.d.ts`/3 `.tsbuildinfo` files were committed to git because `tsconfig.node.json` (a composite project) had no emit redirect, so every `tsc -b` regenerated compiled duplicates of `vite.config.ts` straight into the repo root. Redirected both tsconfig projects' `outDir`/`tsBuildInfoFile` into `node_modules/.tsbuildcache/` (already gitignored), deleted the 5 stray committed files, added `*.tsbuildinfo` to `.gitignore` as a backstop. Separately investigated (and confirmed as a false alarm) whether `public/logo.png`/`logo192.png`/`logo512.png`/`manifest.json` were CRA leftovers — they're actively referenced by `index.html` and 3 live components, independent of any build tool, so left in place. `aws-lambda/` (the retired legacy Lambda backend) also left untouched — a deliberate "keep for reference" decision from REQ-1213, not an oversight.
2. ✅ De-duplicate the backend API base URL (REQ-1623). All 13 `src/services/*.ts` files plus `GoogleSignInButton.tsx` had independently hand-copied the same fallback pointing at the now-dead AWS Lambda API Gateway URL (closes 2026-08-16) — a real latent bug, not just duplication. Consolidated into one `src/lib/apiBase.ts` export (`API_BASE_URL`), falling back to the documented local-dev Express port instead.
3. ✅ Backend auth hardening (REQ-1624). Added `helmet` (security headers) and `express-rate-limit` (20 req/15min on the 3 credential-accepting auth routes: login, register, demo-login). Added fail-fast startup validation rejecting a missing/short/placeholder `JWT_SECRET` in production. Corrected the user's "shared base64 secret in backend and frontend" framing: a JWT signing secret must never exist in frontend code (anything in a browser bundle is public) — the frontend already correctly holds only the token it receives after login, never the secret that signs it.
4. ✅ Login/Register redesign (REQ-1625). New reusable `AuthSplitLayout` component (60/40 image+form split, `hidden lg:block` image panel with brand copy/feature bullets, `public/images/10011.avif` for Login / `10003.avif` for Register) built from this project's own existing light/dark Tailwind tokens — not copied from the two referenced sibling projects' Tailwind classes, since both use a different dark-glassmorphism design system; only the structural pattern was reused. Both pages now use the shared `FormInput`/`FormLabel` components instead of hand-rolled inputs. All existing behavior preserved (demo-account dropdown, Google sign-in, RippleButton, toasts, cache invalidation). Verified live: real login flow, desktop/mobile/dark-mode screenshots, 0 console errors.

**Status: 100% done and verified.**

---

### Phase 6 — Layout-alignment fix, CRA cleanup, Sentry error monitoring, post-implementation audit (REQ-1626 to REQ-1630) — added 2026-08-01

1. ✅ Page-width alignment fix (REQ-1626). User reported (with a screenshot) the Login card sitting visibly narrower than Header/Footer at a wide viewport. Two real causes found via direct DOM measurement: `AuthSplitLayout`'s own nested `max-w-6xl` (removed), and a **legacy global CSS rule** (`main { max-width: 1280px; margin: auto; padding: 15px; }` in `index.css`) silently capping every bare `<main>` tag across 12 files, overriding the Phase 5 `max-w-9xl` centralization. Removed the rule; its `min-height: 90vh` sticky-footer behavior replaced with the standard flex pattern (`App.tsx` root `flex min-h-screen flex-col`, routed-content wrapper `flex-1`) so short pages still pin the footer without depending on a bare-tag selector. Verified via `boundingBox()` measurements: Header/content/Footer now measure identically at every viewport width.
2. ✅ CRA-only leftover cleanup (REQ-1627). Audited for CRA scaffold files — all already absent from earlier rounds. Removed one real dead dependency (`web-vitals`, unused since `reportWebVitals.js` was deleted previously) and fixed one stale `REACT_APP_BASE_URL` doc comment (code already correctly used `VITE_BASE_URL`).
3. ✅ Sentry error monitoring with an ad-blocker-safe tunnel (REQ-1628). `docs/Redis_Sentry_PostHog_INTEGRATION_GUIDE.md` is Next.js-specific — translated to this stack's real packages (`@sentry/react` + `@sentry/node`, not `@sentry/nextjs`). New `backend/src/routes/monitoring.routes.ts` (`POST /api/monitoring`, rate-limited) parses the DSN from the incoming envelope and forwards it server-side to Sentry's real ingest URL — the browser SDK is configured with `tunnel: "<API_BASE_URL>/api/monitoring"` so it never contacts `*.ingest.sentry.io` directly (the domain most ad-blockers block). Wired into the existing `ErrorBoundary.tsx` (reused, not duplicated). `@sentry/vite-plugin` uploads production source maps at build time. Verified against the real Sentry project: a browser-triggered error produced `POST /api/monitoring → 200` with zero direct `sentry.io` requests, and `npm run build` successfully uploaded real source maps.
4. ✅ Data-loss recovery (REQ-1629). Found `public/manifest.json`/`logo192.png`/`logo512.png` had silently vanished from disk (cause undetermined) while still staged in git's index — surfaced as a real `Manifest: Syntax error` browser console error. Recovered all three from the git index; swept for other instances of the same issue, found none.
5. ✅ Post-implementation deep audit (REQ-1630). Re-ran `tsc -b`/`eslint`/`vite build`/`npm audit`/`depcheck` on both sides. Found and fixed 2 real gaps: dead `@testing-library/*` devDependencies (CRA-scaffold leftover, 0 test files, missed by REQ-1627's config-only cleanup) — uninstalled; both `.env.example` files were missing several genuinely-used env vars — documented (`VITE_BASE_URL`/`VITE_STRIPE_PUB_KEY`/`VITE_IMAGE_SERVICE`/`VITE_CLOUDINARY_*` frontend, `BASE_URL` backend). No other misconfiguration found.

**Status: 100% done and verified.**

---

### Phase 7 — SEO/lint hygiene, README rewrite, university-library catalog enrichment (REQ-1631 to REQ-1636) — added 2026-08-01

1. ✅ SEO metadata refresh (REQ-1631). `index.html`/`public/manifest.json`/`robots.txt`/`sitemap.xml` — author, canonical/OG/Twitter tags, refreshed stale author URLs.
2. ✅ Lint hygiene (REQ-1632). Backend gained a `lint` script + flat ESLint config; frontend's existing lint zeroed out via scoped overrides. Both clean.
3. ✅ Root `README.md` rewrite + new `SECURITY.md` (REQ-1633) for the current Vite/Express stack, with the AWS-legacy-demo caveat documented.
4. ✅ Catalog UI enrichment using the user's separate `university-library` reference project (REQ-1634). Added nullable `Product.coverColor`/`videoUrl` (`prisma db push`). New shared `BookCover` (memoized SVG 3D-cover, falls back to flat image when unset), `ProductVideo`, and a first `ProductReel`, plus `useRecommendedProducts` (derived from the already-cached product list, no new endpoint) powering a "You Might Also Like" section on the product detail page. Wired into `ProductCard`, `ProductDetail`, and admin CRUD (form/detail/table thumbnail). `adminService.getAdminStats()` extended client-side with category/language/publication-year/top-rated/catalog-health breakdowns — new `AdminCatalogInsights` dashboard section, no backend change needed.
5. ✅ Follow-up refinement (REQ-1635). Merged all 17 books from the reference project's own seed data as new products (15→32 catalog total), downloading their cover images locally instead of hotlinking. Fixed 6 coverColor instances that were too close to white (hid the cover SVG's decorative spine-curl lines — user spotted this in their own screenshot) via a perceived-luminance check. Rewrote `ProductReel` from a discrete `setInterval`+`scrollBy` design to a single `requestAnimationFrame` loop driving `transform` directly for a smooth, continuously-looping ticker-tape motion (verified via direct transform sampling: ~32px/s constant drift, correct pause/resume/manual-nudge behavior). Added shelf-gradient + drop-shadow + hover-lift to the cover presentation across card/detail/admin views.
6. ✅ Second follow-up (REQ-1636). Removed the original 15 CodeBook products entirely (32→17 catalog total, checked first that no FK constraint ties reviews/orders to products before deleting), fixing a resulting gap where zero products were featured (marked 3). Admin `ProductForm`'s Cover & Media section gained a live `BookCover` preview reacting to the color/image inputs in real time. `ProductDetail` completely redesigned — replaced the old wall of colored info pills with a clean hierarchy (eyebrow/title/author/rating, one-line stock status, prominent price+CTA, a scannable Book Details grid, QR code as a collapsible utility, Description in its own section); no logic changes, layout only.

**Status: 100% done and verified** — `tsc -b`/`eslint`/`vite build` clean both sides, `npm audit`/`depcheck` re-confirmed no new issues, verified live in-browser including cross-page cache invalidation after a real admin edit.

---

### Phase 8 — Commerce completeness, per-entity analytics, KPI/UI consistency, AI-driven insights (REQ-1637 to REQ-1654) — added 2026-08-01

Follows `docs/PROJECT_ENGINEERING_PLAYBOOK.md` §2 (audit → plan → implement → verify) and §6.3 (this is a Vite SPA — no RSC/`page.tsx`/`dehydrate` path exists or applies; TanStack Query cache + invalidation is the correct and only prefetch/freshness contract here, confirmed by the playbook's own stack-detection rule).

1. ✅ Payment-tampering security fix (REQ-1637). Found during a routine invalidation audit, not requested up front. `POST /payment/create-intent` recomputes the Stripe charge server-side from live DB prices (new `products.service.getProductsByIds`) instead of trusting a client-sent `amount`; stopped accepting client `metadata` entirely (previously spread *after* the trusted `userId`/`userEmail`/`userName`, letting a request body override whose account a webhook-fallback order was attributed to — identity now comes only from `req.user`). `POST /orders` now re-verifies `amount_paid` against the actual retrieved Stripe PaymentIntent (ownership + `succeeded` check) instead of trusting the request body. Verified against a real Stripe test-mode charge end-to-end; test order/stock rolled back afterward.
2. ✅ KPI card height + description-clamp consistency (REQ-1638). `AdminMetricsCard`/`ProductCard`/`ProductCardSkeleton` now use `h-full flex flex-col` (+ a shared `min-h` on the KPI card) so every card in a grid row is equal height regardless of subtitle/breakdown presence; `ProductCard`'s overview gained `line-clamp-3` (matches the skeleton's 3-line placeholder geometry) instead of growing to each product's full overview length.
3. ✅ Auto-refund on cancel + reason capture (REQ-1639, REQ-1643 — implemented together, same code path). `PUT /admin/orders/:id/status` now detects a paid order being cancelled and reuses the exact same Stripe refund logic as the dedicated `/refund` route (extracted into a shared `refundOrderPayment()` helper) instead of just flipping a status string. Found and fixed a related bug while here: the admin status dropdown offered a "Refunded" option that was never backend-valid (`updateOrderStatus`'s allow-list never included it) — removed from the editable select on both `AdminOrderDetailPage` and `AdminOrdersPage` (kept in the *filter* dropdown, since it's a real filterable state), and a refunded order's status now renders as a plain badge instead of a select that silently defaulted to "Pending". Added an optional free-text reason textarea to both the Cancel and Refund confirm dialogs — captured as an audit-log note only, never forwarded to Stripe's own 3-value `reason` enum (a latent bug in the pre-existing code that would have 400'd on any custom text). Verified against a real Stripe test-mode refund end-to-end (paid $9 order → cancel → real Stripe refund issued, stock restored, UI shows "Refunded" + refund ID/amount).
4. ✅ On-demand invoice download (REQ-1640). New `GET /orders/:id/invoice` streams the existing `generateInvoicePdf()` output (ownership-checked, admin-or-owner) instead of only ever attaching it to the confirmation email. Shared `downloadOrderInvoice()` service function + "Download Invoice" button on both the customer order detail page and the admin order detail page (`PageHeader`'s `actions` slot). Verified: downloaded a real PDF via the admin UI, confirmed valid 1-page PDF.
5. ✅ Idempotency on order creation (REQ-1641). Added a unique constraint on `Order.paymentIntentId` (nullable-safe — Postgres allows multiple NULLs) via `prisma db push` (checked first for existing duplicates; none). `createOrder()` now checks for an existing order by `paymentIntentId` *before* touching stock at all (the common case — no wasted decrement+rollback), plus a race-condition safety net catching the DB's `P2002` unique-violation error and returning the winning concurrent request's order instead of erroring. Verified: fired the same create-order request twice with a real succeeded Stripe PaymentIntent — both calls returned the identical order id/timestamp, exactly one DB row, stock decremented exactly once.
6. ✅ Rate limiting on payment/order endpoints (REQ-1642). New `paymentLimiter` (30 req/15min, same `express-rate-limit` pattern as REQ-1624's `authLimiter`) applied to `POST /payment/create-intent` and `POST /orders`.
7. ✅ Product detail (admin) analytics (REQ-1644). `calculateSingleProductAnalytics()` extended with a monthly sales-trend array (rendered via a new tiny reusable `Sparkline` UI primitive — plain SVG, no chart library) and a refund/cancellation rate specific to that product, alongside the pre-existing purchase-count/revenue/AOV stats. "View count" (raw page-view tracking) was deliberately not added — it would require new write-on-every-view infrastructure, out of proportion to the rest of this pass.
8. ✅ User detail (admin) analytics (REQ-1645). New `calculateCustomerInsights()` — lifetime value (gross and net-of-refunds), order-status breakdown, last-order date, refund/cancellation counts — all derived from the customer's own already-fetched `orders` array (no new endpoint), shown in a new "Customer Insights" card on `AdminUserDetailPage`.
9. ✅ Order detail timeline enrichment (REQ-1646). Found the admin order detail page had **no timeline at all** — only the customer-facing `GET /orders/:id` included `getOrderActivityTimeline()`; the admin `GET /admin/orders/:id` didn't. Added it there too, and extracted the customer page's timeline rendering (`formatDateTime`/`TIMELINE_ICON`/`timelineLabel`, which already handled refund/tracking events inline) into a new shared `OrderTimeline` UI component so both pages render identically and can never drift apart.
10. ✅ Order-status KPI breakdown badges (REQ-1647). Already existed on the admin Dashboard's Total Orders KPI (`ordersByStatus`) — found the Analytics page's equivalent KPI was missing the same breakdown. Added `ordersByStatus` to `AnalyticsSummary`/`calculateAnalyticsSummary()` and wired it into `AdminAnalyticsPage`'s Total Orders card for consistency.
11. ✅ AI restock prediction (REQ-1648) — implemented as **deterministic math, not an LLM call** (a numeric days-until-stockout projection is more reliable and explainable as plain arithmetic than a model guess): `getAdminStats()` computes each product's units-sold-in-last-30-days velocity and projects days until stockout, surfaced as a new "Restock Forecast" card (`AdminCatalogInsights`) linking through to the product.
12. ✅ AI sales trend narrative (REQ-1649) — already fully covered by the existing "AI Business Insights" panel (REQ-1613, `AdminAnalyticsPage`), which already turns revenue/orders/top-sellers/unsold-products/user-growth into a plain-English recommendation via the multi-provider LLM chain. No duplicate feature built.
13. ✅ AI order fraud/anomaly scoring (REQ-1650) — **deterministic**, not an LLM call: new `calculateOrderRiskFlags()` flags an order at 3×+ that customer's own historical average (or 3×+ the store average for a first-time customer's first order), shown as a "⚠ Review" badge next to the amount on `AdminOrdersPage` — a review signal only, never an auto-block.
14. ✅ AI review sentiment / fake-review flag (REQ-1651) — the one item that genuinely needed a language model (sentiment on free text). New `analyzeReviewSentiment()` (reuses the same multi-provider `createChatCompletion` chain as REQ-1613/1648) runs **on-demand per admin click** (`POST /admin/reviews/:id/analyze-sentiment`, new "Analyze with AI" button on `AdminReviewDetailPage`) rather than automatically on every review submission, keeping LLM cost/latency opt-in and off the checkout-adjacent review-creation path. Verified against real provider output (Gemini) for both a genuine positive review and a low-effort one-word review.
15. ✅ AI dynamic/suggested pricing (REQ-1652) — **deterministic**, not an LLM call: new `calculateSuggestedPrice()` (sell-through rate over the last 30 days) shown as a dismissible banner in admin `ProductForm` with an "Apply to field" button — copies the suggestion into the price input only; the admin must still explicitly save, never auto-applied.
16. ✅ AI churn/repeat-purchase likelihood (REQ-1653) — **deterministic**, not an LLM call: `calculateCustomerInsights()` (REQ-1645) also computes a low/medium/high churn heuristic from days-since-last-order vs. that customer's own average reorder interval (`null`/"not enough history" below 2 orders), shown alongside the other Customer Insights tiles.
17. ✅ Low-stock/out-of-stock admin digest email (REQ-1654). New `admin-low-stock-digest` email template + admin-only `POST /admin/notifications/low-stock-digest` route (deliberately its own endpoint, not the pre-existing unrestricted `/email/send`) computing every low/out-of-stock product in one consolidated email instead of the existing per-order ping. **Scope note:** triggered by a new "Email Stock Digest" button (`AdminCatalogInsights`), not a cron job — adding a scheduler would be new backend infrastructure beyond this pass; the digest itself is fully real and working (verified via a real Brevo send), and a scheduled job could call the same route later with no further changes.

Deterministic vs. LLM-based, and why: items 11/13/15/16 above are framed as "AI-driven" in the original ask but implemented as plain, explainable math (order velocity, sell-through rate, historical averages) rather than LLM calls — a numeric projection or a threshold comparison is more reliable, instant, and free to run than asking a model to guess at arithmetic, and every existing "AI" feature in this codebase (REQ-1613) already reserves the LLM for genuinely language-shaped problems (turning a data summary into prose, or judging free-text sentiment — REQ-1651). No new npm dependencies were added anywhere in this phase; every route/component/hook reuses infrastructure already in the codebase (`express-rate-limit`, `stripe`, `pdfkit`, the multi-provider `lib/ai/` chain, `@tanstack/react-query`).

Also found and fixed during this pass, not separately requested: the "Refunded" status-dropdown bug (item 3), the admin order-detail page's total absence of a timeline (item 9), and the Analytics page's missing order-status breakdown (item 10) — all pre-existing gaps surfaced while implementing the requested items, fixed in place per this project's standing audit convention.

18. ✅ Post-implementation deep audit (REQ-1655) — user asked for a full re-audit of items 1–17 before testing/committing (gaps, invalidation coverage, auth/zod, dead code, lint/build). Re-verified (not just re-read): every new/changed mutation hook's `invalidateQueries` keys traced against real `queryKey`s; every new/changed route's `requireAuth`/`requireAdmin` + validation + ownership checks; no `any`/dead code/duplicate fetches/leftover debug logs; `tsc`/`eslint --max-warnings=0`/`vite build` clean both sides. Found and fixed one real, previously-flagged-but-deferred gap: `POST /email/send` had no restriction on the `to` recipient — any authenticated non-admin user could relay any email template to any address (open relay). Fixed by requiring non-admin callers' `to` to equal their own email or the fixed admin alert address; admins remain exempt (legitimate on-behalf-of-customer sends).

**Status: 100% done and verified** — `tsc -b`/`eslint --max-warnings=0`/`vite build` clean both sides (backend and frontend, whole-codebase sweep not just touched files), every item browser- or API-verified against real Stripe test-mode charges/refunds, a real Brevo email send, and real multi-provider LLM output — not just compiled. Item 18 (REQ-1655) re-audit found and fixed one real security gap (`/email/send` open relay). See `.agile-v/STATE.md` for the detailed pass-by-pass trace.

---

## 7. What does **not** change

- UI, layout, Tailwind design system (`docs/UI_STYLING_GUIDE.md` — glassmorphism cards, color variants, exact shadow/opacity scale) — pixel-identical.
- All current features: catalog, cart, Stripe checkout, orders, admin dashboard/analytics, reviews, support tickets, notifications, activity log.
- JWT-in-sessionStorage auth model for email/password login (phase 1 — httpOnly-cookie hardening is a separate, later, explicitly-scoped decision, not bundled here).
- External services: Stripe, Cloudinary, Brevo, Shippo.
- Frontend hosting: stays on Vercel.

---

## 8. Decisions (resolved 2026-07-30)

1. **CRA vs. Vite (REQ-1303) — DECIDED: migrate to Vite**, bundled into Phase 2 (TypeScript pass). Same React 19 / React Router / component code and UI; only the build tool changes.
2. **Realtime scope (REQ-1402) — DECIDED: TanStack Query invalidation only.** No SSE/WebSocket. Phase 3 is an audit-and-fix pass on existing mutation hooks, not new infrastructure.
3. **Data migration (§1) — DECIDED: no DynamoDB export.** Fresh seed from `data/db.json` + new test accounts instead.

---

## 9. Non-negotiables carried into implementation (from your instructions + `PROJECT_ENGINEERING_PLAYBOOK.md`)

- No deleted features. Only dead code / debug logs removed, and only in files actually touched.
- Every CRUD mutation invalidates all affected cache keys — current page and every other mounted page — no `location.reload()`.
- Strict TypeScript everywhere in Phase 2 — no `any`.
- Reuse shared `lib/`, `hooks/`, `context/`, `services/` patterns already established in this repo; no parallel architectures.
- Match existing folder layout, naming, and Tailwind design tokens exactly.
- No unsolicited summary/changelog `.md` files during implementation — this plan file is the one exception, written because you asked for it explicitly.
- Code comments only where the _why_ isn't obvious from the code itself.
- Secrets (Google Client Secret, Stripe keys, JWT secret, DB password) never committed — `.env`/`.env.local` locally, Coolify env vars in production.

---

## 10. Next step

~~Gate 1 review: confirm the REQ-1200..1505 set above, then implementation starts with Phase 1, step 1.~~ Superseded — that Gate 1 review happened long ago and Phases 1–7 (REQ-1200 to REQ-1636) are all done, see §11. The only remaining step is deployment (Dockerfile + Coolify, REQ-1210/1211/1212), intentionally on hold at the user's request — everything else ships and runs locally.

---

## 11. Status as of 2026-08-01 — what's actually done vs. not

Phase 1 (backend migration) is **built and locally verified** but **not deployed** — see `.agile-v/STATE.md` for the authoritative, continuously-updated status. Summary:

**Done:**

- Full Express + Prisma backend at `backend/`, all 33 routes ported, Google OAuth sign-in, Robohash avatars, DB-driven demo login (no credentials in the frontend bundle), enriched product schema (`author`/`category`/`level`/`pages`), real product content (no Lorem ipsum anywhere in `src/`).
- Full local integration test via a real browser (login, RBAC, Stripe checkout, cache invalidation, ticket/notification cycle) — see DECISION_LOG entries through `00:00:17Z`.
- react-toastify → shadcn Sonner (dynamic per-message titles), AlertDialog confirmation on all destructive admin actions, testimonials/FAQ content rewritten.
- UI/UX pass (this entry): Framer Motion stagger reveal on Login/Register, per-route page-enter animation, `RippleButton` on primary CTAs, gradient/icon/badge KPI cards (`AdminMetricsCard`, matching `docs/UI_STYLING_GUIDE.md`'s card system) on the Dashboard and Analytics summary rows, rotating Ken-Burns hero background (`docs/HERO_ROTATING_BACKGROUND_SPEC.md`, React-ported), and clickable sky-colored product/order/user links replacing plain text in the Orders, Products, and Reviews admin tables.

**Not started / explicitly deferred (with why):** only one real item remains — everything else below this point is historical trace, already closed out (kept for traceability, not because it's still pending).

- **Coolify/VPS deployment (REQ-1201/1210/1211/1212)** — deferred by direct user request; everything above only runs on localhost so far. This is the only genuinely open item in the whole plan.
- ~~Full Lucide icon migration across every title/label/button/filter~~ — **done (REQ-1605)**, see §6 item 5.
- ~~TanStack Table migration with dropdown row actions~~ — **done (REQ-1611)**, see §6 item 11.
- ~~Auto-generate + attach + email an invoice PDF on successful order~~ — **done (REQ-1612)**, see §6 item 8.

- ~~Multi-model AI insights~~ — **done (REQ-1613)**, see §6 item 13. User supplied 9 free-tier provider keys 2026-07-31; adapted (not copy-pasted) the two reference docs to this project's Express backend + the "no Redis for v1" decision (REQ-1403).

- **`docs/SAFE_IMAGE_REUSABLE_COMPONENT.md`** — not applicable. It's a `next/image`-specific fallback pattern; this project is CRA and has never used `next/image`, so there's no optimizer to fall back from. No action taken.

- **`docs/VERCEL_PRODUCTION_GUARDRAILS.md`** (bot protection, security headers, robots.txt) — low priority, deferred: the doc is Next.js-specific (`next.config.ts`, `app/robots.ts`) and this project has no production traffic yet (still pre-deployment). Worth a lightweight pass (security headers + robots.txt in `vercel.json`) once actual deployment is back in scope.

- **Page/detail-page data-enrichment redesign** — Products (REQ-1616), Orders (REQ-1617), Users (REQ-1618), Tickets/Reviews (REQ-1619), and checkout→address-book wiring (REQ-1620) are all now done, closing out the user's original "everything, all pages... more feature functionalities" ask across every domain named in that request, plus the one item deliberately deferred from REQ-1618.
- **Instant-navigation / cache-freshness pass** — done (REQ-1621), see §6 item 21. Hover-prefetch, invalidation-gap fixes, dead/duplicate-code cleanup, and the RippleButton/KPI-card partial items (7, 8) all closed out.
- **Config hygiene, auth hardening, auth-page redesign** — done (REQ-1622 to REQ-1625), see Phase 5 above. Committed build-artifact leak fixed at the root cause, 13-file dead-URL duplication consolidated, `helmet`/rate-limiting/fail-fast secret validation added to the backend, Login/Register rebuilt as a professional 60/40 split screen.
- **Layout-alignment fix, CRA cleanup, Sentry monitoring, post-implementation audit** — done (REQ-1626 to REQ-1630), see Phase 6 above. Legacy global CSS rule silently capping page width found and removed, dead `web-vitals`/`@testing-library/*` dependencies removed, Sentry error monitoring wired end-to-end with an ad-blocker-safe tunnel (verified against the real Sentry project), 3 silently-vanished `public/` files recovered from git's index, and both `.env.example` files brought fully in sync with actually-used env vars.

- **SEO/lint hygiene, README rewrite, university-library catalog enrichment** — done (REQ-1631 to REQ-1636), see Phase 7 above. SEO metadata + lint hygiene + README/SECURITY.md pass, then book-cover art (`BookCover`)/trailer video (`ProductVideo`)/recommendations (`ProductReel` + `useRecommendedProducts`) on the storefront and admin CRUD, new `AdminCatalogInsights` dashboard section, catalog grown 15→32 products by merging in the reference project's own 17 books with locally-downloaded cover images, and a fix for coverColor values too close to white.

- **Phase 2 (strict TypeScript + Vite)** — see §6 for the full item-by-item breakdown. **100% done and verified.** Backend and frontend are both fully typed, strict, zero `.js`/`.jsx` remain anywhere in `src/`. `tsc -b`, `eslint`, and `vite build` all run clean. Verified in a real browser across every page type (home, products, product detail, cart, dashboard, tickets, and all 8 admin pages), 0 console errors. Asset restructuring (`src/assets` → `public/`, flattened `public/images/`) and font self-hosting (self-hosted Roboto variable font, npm-installed `bootstrap-icons`, dead Poppins import removed) also completed as part of this pass (REQ-1306/1307). A follow-up deployment-readiness audit (REQ-1308 to REQ-1311) additionally reconciled a broken git index (the live codebase was entirely untracked — see `.agile-v/STATE.md` eighth pass for detail), removed dead scripts/an orphaned component, added a localStorage-persisted query cache, and code-split the admin console into its own lazy-loaded chunk (~139KB kept out of the customer bundle).
