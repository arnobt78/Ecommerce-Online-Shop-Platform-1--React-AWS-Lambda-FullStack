# CodeBook | E-Commerce Platform 1 – React, Vite, TypeScript, Express & PostgreSQL Full-Stack Project (including Storefront + Admin Panel + Role-Based Access Control + AI Business Insights & more)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4-black)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-2D3748)](https://www.prisma.io/)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154)](https://tanstack.com/query)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC)](https://tailwindcss.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF)](https://stripe.com/)
[![Security Policy](https://img.shields.io/badge/Security-Policy-red)](./SECURITY.md)
[![launch with diploi badge](https://diploi.com/launch.svg)](https://diploi.com/launch/arnobt78/Ecommerce-Shop-1-BookStore--React-FullStack)

A modern, full-stack e-commerce platform for selling **computer science eBooks**. It includes a complete customer storefront (catalog, cart, Stripe checkout, address book, orders, reviews, support tickets) and a full **admin console** (products, orders, users, analytics, AI business insights, review moderation, tickets, activity log). The live API is an **Express + Prisma + PostgreSQL** backend in `backend/` (migrating away from the retired AWS Lambda + DynamoDB stack kept in `aws-lambda/` for reference). The frontend is a **React 19 + Vite + TypeScript** SPA with TanStack Query, Tailwind CSS, and JWT/Google OAuth auth.

- **Live demo (legacy AWS-backed showcase):** [https://codebook-aws.vercel.app/](https://codebook-aws.vercel.app/)
- **Security:** private vulnerability reports → see [SECURITY.md](./SECURITY.md) · [contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)
- **Author:** [Arnob Mahmud](https://www.arnobmahmud.com) · [GitHub @arnobt78](https://github.com/arnobt78)

> **Migration status (important for learners):** we are moving off AWS Lambda/DynamoDB to the Express API in `backend/`. That new backend is **not deployed to a public server yet**, and the **Vercel frontend is not cut over** to it. Local development uses Vite + `backend/` + Postgres. The public demo URL above still runs the older AWS-backed stack until Coolify/VPS + Vercel cutover is completed.

![Screenshot](https://github.com/user-attachments/assets/a09c1f37-b5fc-43eb-9b40-f762d8b1af41)
![Screenshot](https://github.com/user-attachments/assets/9084a2fd-2bf0-48ae-b0c1-0dddb6babaa4)
![Screenshot](https://github.com/user-attachments/assets/538e291b-90d5-4bf1-835a-310df4bf764d)
![Screenshot](https://github.com/user-attachments/assets/9700ff53-0d21-4fd6-93b3-fc2ca763ac9b)
![Screenshot](https://github.com/user-attachments/assets/7c9cb84e-26bd-4388-9cbd-45fd7edc9c2e)
![Screenshot](https://github.com/user-attachments/assets/071221f2-9229-4a8b-96da-7a2f0d7e1bce)
![Screenshot](https://github.com/user-attachments/assets/50382c4b-8aa0-4c9a-b878-d44143708628)
![Screenshot](https://github.com/user-attachments/assets/4ae29513-b8b3-4855-a29d-988ca3c252a6)
![Screenshot](https://github.com/user-attachments/assets/e079a69f-e64e-48d8-8840-cbfd11fbc60a)
![Screenshot](https://github.com/user-attachments/assets/bfa2c32a-ec77-486b-aa9a-d272a2735898)
![Screenshot](https://github.com/user-attachments/assets/afad029d-816c-4574-a3bd-a622f1d0e822)
![Screenshot](https://github.com/user-attachments/assets/8c4b16e3-cf38-47e5-8d90-e5201199830d)
![Screenshot](https://github.com/user-attachments/assets/449c8d9e-532f-4a3f-bf32-ee70fc729cad)
![Screenshot](https://github.com/user-attachments/assets/7c4715bd-adc3-4082-a0f9-27f793d1f219)
![Screenshot](https://github.com/user-attachments/assets/08826a4c-f40b-434a-bff7-5032253f6ef3)
![Screenshot](https://github.com/user-attachments/assets/1da1869d-d69d-44b6-8521-61f3d9faaf95)
![Screenshot](https://github.com/user-attachments/assets/b0bc9f98-de12-4d5f-95f1-f642c1d5e890)
![Screenshot](https://github.com/user-attachments/assets/b16256c1-01c7-409a-89bc-6b3f58abaa19)
![Screenshot](https://github.com/user-attachments/assets/4cfb857f-c346-455d-a067-aa1464f520bb)
![Screenshot](https://github.com/user-attachments/assets/7bfcdb50-cb3c-47b8-88dd-cc456052abef)

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Key Features](#key-features)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Environment Variables](#environment-variables)
8. [Installation & Local Run](#installation--local-run)
9. [Demo Accounts](#demo-accounts)
10. [Frontend Routes](#frontend-routes)
11. [Backend API Endpoints](#backend-api-endpoints)
12. [How Core Pieces Work (Learner Guide)](#how-core-pieces-work-learner-guide)
13. [Reusable Components & Patterns](#reusable-components--patterns)
14. [Libraries & Dependencies (Short Lessons)](#libraries--dependencies-short-lessons)
15. [Optional: Launch with Diploi](#optional-launch-with-diploi)
16. [Documentation Links](#documentation-links)
17. [Keywords](#keywords)
18. [Security](#security)
19. [Contributing](#contributing)
20. [Conclusion](#conclusion)
21. [License](#license)

---

## Project Overview

**CodeBook** teaches real e-commerce patterns in a single readable codebase:

- Customer journey: browse → filter → cart → Stripe pay → order history / digital library
- Admin journey: inventory, orders, refunds/labels, users, reviews, tickets, analytics + AI insights
- Engineering patterns: strict TypeScript, Zod at API boundaries, TanStack Query invalidation (no full-page reloads), JWT + Google OAuth, Sentry tunneled through your own API

### What makes it useful for learning?

| Topic            | What you can study here                                               |
| ---------------- | --------------------------------------------------------------------- |
| SPA architecture | Vite + React Router (no SSR / no Next.js App Router)                  |
| Server state     | TanStack Query keys, persist-to-localStorage, mutation invalidation   |
| Backend API      | Express routes → services → Prisma → PostgreSQL                       |
| Payments         | Stripe PaymentIntent + webhook signature verification                 |
| Auth             | Email/password JWT + Google OAuth CSRF `state` cookie                 |
| UI systems       | Shared `components/ui/*`, Tailwind tokens, Sonner toasts, AlertDialog |
| Ops readiness    | Helmet, rate limits, `.env.example` hygiene, Sentry tunnel            |

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────┐
│  Frontend — React 19 + Vite + TypeScript (SPA)               │
│  pages / components / hooks / services / context             │
│  TanStack Query 5 · Tailwind 3 · React Router 7              │
│  Local: http://localhost:3000                                │
│  Hosting target: Vercel (cutover to new API pending)         │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTPS / JSON + Bearer JWT
┌────────────────────────────▼─────────────────────────────────┐
│  Backend — Express + Prisma + PostgreSQL                     │
│  backend/src/{routes,services,lib}                           │
│  Local recommended: http://localhost:4000                    │
│  Deploy target: Coolify / Hetzner VPS (intentionally deferred)│
└────────────────────────────┬─────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   Stripe / Brevo      Cloudinary / Shippo   Google OAuth / LLMs
   (payments/email)      (images/labels)      (sign-in / AI insights)

Reference only (not live): aws-lambda/  ← retired AWS Lambda + DynamoDB API
```

**Response shape tip:** routes return plain JSON (`res.status(n).json(data)`). Services hold business logic; Zod validates bodies at the route boundary before services run.

---

## Key Features

### Storefront (customer)

- Product catalog with search/filter/sort, featured products, product detail (QR, ratings, book metadata)
- Cart (persisted to `localStorage`) + Stripe Checkout
- Optional **address book** + shipping address snapshot on orders
- Dashboard order history + customer **order detail** with status timeline
- Product reviews (verified-purchase badge) + support tickets (priority/category/order link)
- Login / Register split-layout auth + one-click **demo accounts** + **Continue with Google**

### Admin console

- Dashboard KPI cards + analytics charts (Recharts)
- Products / Orders / Users / Reviews / Tickets CRUD with DataTable + detail pages
- Order status, tracking, Shippo label generation, Stripe refunds
- Review moderation + store reply (`adminReply`)
- Activity / management history log
- **AI Business Insights** (multi-provider free-tier LLM fallback)

### Cross-cutting

- Role-based routes (`user` vs `admin`)
- Instant UI after mutations (TanStack Query invalidation — no `location.reload()`)
- Admin code-split lazy chunk + idle prefetch for admins
- Sentry error monitoring via first-party tunnel `POST /api/monitoring`
- Invoice PDF attached to order-confirmation email (pdfkit + Brevo)

---

## Technology Stack

| Layer                 | Choice                                    | Why it matters               |
| --------------------- | ----------------------------------------- | ---------------------------- |
| UI                    | React 19                                  | Component model + hooks      |
| Bundler               | Vite 8                                    | Fast HMR; replaces CRA       |
| Language              | TypeScript 5.9 (strict)                   | Fewer runtime surprises      |
| Routing               | React Router 7                            | Client-side SPA routes       |
| Server state          | TanStack Query 5                          | Cache, refetch, invalidation |
| Tables                | TanStack Table 8                          | Admin list pages             |
| Styling               | Tailwind CSS 3                            | Utility-first design system  |
| Icons / motion        | Lucide + Framer Motion                    | Consistent icons + reveals   |
| Toasts                | Sonner                                    | Dynamic success/error titles |
| API                   | Express 4                                 | Simple REST surface          |
| ORM / DB              | Prisma + PostgreSQL                       | Typed schema + seed          |
| Validation            | Zod                                       | Route-boundary schemas       |
| Auth                  | JWT + bcrypt + Google OAuth               | Dual login paths             |
| Payments              | Stripe                                    | Intent + webhook             |
| Email / ship / images | Brevo / Shippo / Cloudinary               | Real integrations            |
| Monitoring            | Sentry (`@sentry/react` + `@sentry/node`) | Ad-blocker-safe tunnel       |

---

## Project Structure

```text
ecommerce-codebook/
├── src/                      # Vite React frontend
│   ├── pages/                # Route pages (Home, Products, Cart, Admin/*, …)
│   ├── components/
│   │   ├── ui/               # Reusable primitives (DataTable, forms, RippleButton, …)
│   │   ├── Elements/         # ProductCard, ReviewForm, Rating, …
│   │   ├── Layouts/          # Header, Footer, AdminLayout
│   │   └── Sections/         # Search and composed sections
│   ├── hooks/                # useProducts, useAdmin, useAuth, useTickets, …
│   ├── services/             # fetch wrappers per domain (+ apiError.ts)
│   ├── context/              # CartContext, FilterContext
│   ├── routes/               # AllRoutes.tsx, ProtectedRoute.tsx
│   ├── lib/                  # apiBase.ts, toast.ts, sentry.ts
│   ├── utils/                # queryInvalidation helpers, export utils
│   ├── reducers/             # Cart / filter reducers
│   └── types/                # Shared frontend DTOs
├── backend/                  # Live Express API
│   ├── src/
│   │   ├── app.ts            # Middleware + route mounts
│   │   ├── server.ts         # listen(PORT)
│   │   ├── routes/           # HTTP endpoints
│   │   ├── services/         # Business logic + Prisma
│   │   └── lib/              # auth, rateLimit, ai/, sentry, …
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts           # Seeds from ../data/db.json
│   └── .env.example
├── aws-lambda/               # Retired AWS backend (reference only)
├── data/db.json              # Product seed source of truth
├── public/                   # favicon, logos, images, fonts, sitemap
├── docs/                     # Walkthrough, plan, styling, LLM guide
├── .agile-v/                 # Requirements / decisions (team process)
├── .env.example              # Frontend env template
├── SECURITY.md               # Private vulnerability reporting
└── README.md                 # You are here
```

---

## Prerequisites

- **Node.js** 20+ (22 recommended)
- **PostgreSQL** 14+ running locally (or Docker)
- Optional: Stripe / Google / Brevo / Cloudinary / Shippo / Sentry accounts for full feature parity

You can explore much of the UI with **minimal env** (see below). Payments, OAuth, email, and AI need their respective keys.

---

## Environment Variables

Templates live in:

- Root: [`.env.example`](./.env.example) → copy to `.env` or `.env.local` (frontend)
- Backend: [`backend/.env.example`](./backend/.env.example) → copy to `backend/.env`

**Never commit real `.env` files** (they are gitignored).

### Do you need a `.env` to run anything?

| Goal                                    | Minimum                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Frontend UI only against a mock/offline | Not practical — app expects an API                                                                |
| Full local stack (catalog, auth, admin) | **Yes:** `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `PORT`, and frontend `VITE_LAMBDA_API_URL` |
| Stripe checkout                         | Also Stripe keys (front + back)                                                                   |
| Google sign-in                          | Google OAuth trio + `FRONTEND_URL`                                                                |
| Emails / labels / AI / Sentry           | Optional — features degrade gracefully when unset                                                 |

### Recommended local ports (avoid clashes)

Vite already binds **frontend `:3000`**. Put the API on **`:4000`**:

```bash
# backend/.env
PORT=4000
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback

# root .env / .env.local
VITE_LAMBDA_API_URL=http://localhost:4000
```

> The name `VITE_LAMBDA_API_URL` is historical (AWS Lambda era). It now points at the Express API. Do not point production at the old API Gateway URL — that stack is being retired.

### Frontend variables (root `.env.example`)

| Variable                        | Required?             | Purpose                                                     |
| ------------------------------- | --------------------- | ----------------------------------------------------------- |
| `VITE_LAMBDA_API_URL`           | **Yes** for local API | Express base URL                                            |
| `VITE_BASE_URL`                 | Optional              | Absolute links / QR; falls back to `window.location.origin` |
| `VITE_STRIPE_PUB_KEY`           | For checkout          | Stripe publishable key                                      |
| `VITE_IMAGE_SERVICE`            | Optional              | Usually `cloudinary`                                        |
| `VITE_CLOUDINARY_CLOUD_NAME`    | Optional              | Own Cloudinary cloud                                        |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Optional              | Unsigned upload preset                                      |
| `VITE_SENTRY_DSN`               | Optional              | Browser Sentry DSN (public-safe)                            |

### Backend variables (`backend/.env.example`)

| Variable                                        | Required?           | Purpose                                  |
| ----------------------------------------------- | ------------------- | ---------------------------------------- |
| `PORT`                                          | Recommended         | Prefer `4000` locally                    |
| `NODE_ENV`                                      | Optional            | `development` / `production`             |
| `DATABASE_URL`                                  | **Yes**             | Postgres connection string               |
| `CORS_ORIGINS`                                  | **Yes** in real use | Comma-separated frontend origins         |
| `JWT_SECRET`                                    | **Yes**             | `openssl rand -base64 64` — backend only |
| `STRIPE_SECRET_KEY`                             | Checkout            | Secret key                               |
| `STRIPE_WEBHOOK_SECRET`                         | Webhooks            | From Stripe CLI / Dashboard              |
| `BREVO_*`                                       | Email               | Transactional mail                       |
| `SHIPPO_*`                                      | Labels              | Shipping label generation                |
| `GOOGLE_CLIENT_ID` / `SECRET` / `CALLBACK_URL`  | OAuth               | Google Cloud Console                     |
| `FRONTEND_URL`                                  | OAuth               | Where to land after Google callback      |
| `BASE_URL`                                      | Optional            | QR/link fallback behind proxies          |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, …             | Optional            | AI insights providers                    |
| `SENTRY_DSN` / `ORG` / `PROJECT` / `AUTH_TOKEN` | Optional            | Errors + source maps                     |

#### How to obtain common keys (short)

1. **Postgres** — install locally or `docker run` Postgres; create DB/user; paste into `DATABASE_URL`.
2. **JWT_SECRET** — `openssl rand -base64 64` (never put this in the frontend).
3. **Stripe** — [Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys); use **test** keys locally. Webhooks: Stripe CLI `stripe listen --forward-to localhost:4000/payment/webhook`.
4. **Google OAuth** — Google Cloud Console → OAuth client → Authorized redirect URI must **exactly** match `GOOGLE_CALLBACK_URL`.
5. **Brevo / Shippo / Cloudinary / Sentry** — create free/test accounts; copy keys into `backend/.env` (and frontend where noted).
6. **LLM keys** — see [`docs/LLM_MODEL_SELECTION.md`](./docs/LLM_MODEL_SELECTION.md); any non-empty subset enables AI insights.

---

## Installation & Local Run

```bash
# Clone
git clone https://github.com/arnobt78/Ecommerce-Shop-1-BookStore--React-FullStack.git
cd Ecommerce-Shop-1-BookStore--React-FullStack

# --- Backend ---
cd backend
cp .env.example .env
# edit .env: DATABASE_URL, JWT_SECRET, PORT=4000, CORS_ORIGINS=http://localhost:3000
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run dev
# → http://localhost:4000  |  health: GET /api/health

# --- Frontend (new terminal, repo root) ---
cd ..
cp .env.example .env.local
# set VITE_LAMBDA_API_URL=http://localhost:4000
npm install
npm run dev
# → http://localhost:3000
```

### Useful scripts

| Where      | Command                      | What it does                        |
| ---------- | ---------------------------- | ----------------------------------- |
| Root       | `npm run dev`                | Vite dev server                     |
| Root       | `npm run build`              | `tsc -b` + production bundle        |
| Root       | `npm run lint`               | ESLint (`--max-warnings 0`)         |
| Root       | `npm run typecheck`          | TypeScript project references       |
| `backend/` | `npm run dev`                | `tsx watch` API server              |
| `backend/` | `npm run seed`               | Idempotent seed from `data/db.json` |
| `backend/` | `npm run lint` / `typecheck` | Backend quality gates               |

### Optional: Launch with Diploi

One-click launch badge (same as the header):

[![launch with diploi button](https://diploi.com/launch-big.svg)](https://diploi.com/launch/arnobt78/Ecommerce-Shop-1-BookStore--React-FullStack)

More info: [https://diploi.com/](https://diploi.com/)

---

## Demo Accounts

Seeded by `npm run seed` (`User.isDemo = true`). The Login page loads them from `GET /auth/demo-accounts` — **no passwords in the frontend bundle**.

| Email            | Role  | Password (email login) |
| ---------------- | ----- | ---------------------- |
| `test@admin.com` | admin | `12345678`             |
| `test@user.com`  | user  | `12345678`             |

Prefer the Login page **demo dropdown** (one-click `POST /auth/demo-login`) while learning.

---

## Frontend Routes

| Path                                          | Access | Purpose                                                                           |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `/`                                           | Public | Home, hero, featured, FAQ                                                         |
| `/products`, `/products/:id`                  | Public | Catalog + detail                                                                  |
| `/login`, `/register`                         | Public | Auth split layout                                                                 |
| `/auth/callback`                              | Public | Google OAuth handoff                                                              |
| `/cart`, `/order-summary`                     | Auth   | Cart + summary                                                                    |
| `/payment-success`, `/payment-cancel`         | Auth   | Stripe return                                                                     |
| `/dashboard`                                  | Auth   | Orders + address book                                                             |
| `/orders/:id`                                 | Auth   | Customer order detail + timeline                                                  |
| `/tickets`, `/tickets/create`, `/tickets/:id` | Auth   | Support                                                                           |
| `/admin/*`                                    | Admin  | Dashboard, products, orders, users, insights, history, tickets, reviews, settings |

Guards live in `src/routes/ProtectedRoute.tsx` (`requiredRole="admin"` for admin trees). Admin pages are **lazy-loaded** so customers never download the admin chunk on first paint.

---

## Backend API Endpoints

Base URL = `VITE_LAMBDA_API_URL` (e.g. `http://localhost:4000`). Auth: `Authorization: Bearer <jwt>` unless noted.

### Health & monitoring

| Method | Path              | Notes                                                |
| ------ | ----------------- | ---------------------------------------------------- |
| GET    | `/api/health`     | `{ status: "ok" }`                                   |
| POST   | `/api/monitoring` | Sentry envelope tunnel (browser → your API → Sentry) |

### Auth

| Method | Path                    | Notes                           |
| ------ | ----------------------- | ------------------------------- |
| POST   | `/login`, `/register`   | Rate-limited                    |
| GET    | `/auth/demo-accounts`   | Public demo list                |
| POST   | `/auth/demo-login`      | Rate-limited one-click demo JWT |
| GET    | `/auth/google`          | Redirect to Google              |
| GET    | `/auth/google/callback` | OAuth callback + CSRF `state`   |

### Catalog & commerce

| Method          | Path                                            | Notes                                          |
| --------------- | ----------------------------------------------- | ---------------------------------------------- |
| GET             | `/products`, `/products/:id`                    | Public catalog                                 |
| GET             | `/featured-products`                            | Featured list (UI may also filter client-side) |
| POST/PUT/DELETE | `/admin/products`…                              | Admin CRUD                                     |
| GET/POST        | `/orders`, `/orders/:id`                        | Customer orders                                |
| GET/PUT/POST    | `/admin/orders`…                                | Status, tracking, label, refund                |
| POST/GET        | `/payment/create-intent`, `/payment/verify/:id` | Stripe                                         |
| POST            | `/payment/webhook`                              | Raw body + signature                           |

### Social / support / admin

| Domain        | Paths                                               |
| ------------- | --------------------------------------------------- |
| Addresses     | `GET/POST /addresses`, `PUT/DELETE /addresses/:id`  |
| Reviews       | `/reviews`, `/admin/reviews`, `/admin/reviews/:id`  |
| Tickets       | `/tickets`, `/tickets/:id/reply`, status + priority |
| Notifications | `/notifications/count`, `/notifications/mark-read`  |
| Users         | `/admin/users` CRUD                                 |
| Activity      | `/admin/activity-logs`                              |
| Email         | `POST /email/send`                                  |
| AI            | `POST /admin/ai-insights`                           |

---

## How Core Pieces Work (Learner Guide)

### 1. Frontend talks to the API

All services import one base URL:

```ts
// src/lib/apiBase.ts
export const API_BASE_URL =
  import.meta.env.VITE_LAMBDA_API_URL || "http://localhost:3000";
```

Example pattern (simplified):

```ts
const res = await fetch(`${API_BASE_URL}/products`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) throw await throwApiError(res);
return res.json();
```

### 2. TanStack Query + invalidation

Hooks wrap services. After a mutation succeeds, helpers in `src/utils/queryInvalidation.ts` invalidate **every** related key (lists, detail, admin stats, badges) so the UI updates without reload.

**Rule of thumb:** if you add a new write API, add/extend an invalidation helper — never leave stale screens.

### 3. Auth session

JWT + role + user id live in `sessionStorage`. `ProtectedRoute` checks them. Logout calls `queryClient.clear()` so persisted Query cache cannot leak across accounts.

### 4. Backend layering

```text
Route (Zod + auth middleware) → Service (Prisma / Stripe / email) → JSON response
```

Ownership for customer resources comes from `req.user.id` (JWT), never from a client-supplied user id — important for addresses and tickets.

### 5. Digital goods note

Products are **eBook downloads** (Dashboard library). Physical warehouse fields were intentionally not added. Shippo/address book support admin demos and optional shipping metadata, not a warehouse WMS.

---

## Reusable Components & Patterns

### UI primitives (`src/components/ui/`)

| Component                                    | Reuse idea                                             |
| -------------------------------------------- | ------------------------------------------------------ |
| `DataTable`                                  | Any sortable admin list + row actions (`DropdownMenu`) |
| `FormInput` / `FormSelect` / `FormTextarea`  | Controlled forms with shared error styling             |
| `AlertDialog`                                | Confirm destructive actions (delete, cancel, refund)   |
| `RippleButton`                               | Primary CTAs with click feedback                       |
| `AuthSplitLayout`                            | Login/Register 60/40 image+form shell                  |
| `AddressLines`                               | Render postal addresses consistently                   |
| `UserAvatar`                                 | Real image or Robohash fallback                        |
| `OrderTrackingInfo`                          | Tracking + shipping address display                    |
| `motion` (`ScrollReveal` / `Stagger*`)       | Page enter / field stagger animations                  |
| `EmptyState` / `ErrorState` / `LoadingState` | Consistent async UI                                    |

**How to reuse in another project**

1. Copy the primitive + its Tailwind classes (or extract a design-token layer).
2. Keep props narrow and typed — match existing call sites.
3. Prefer composition over forks (`PageHeader` + `DataTable` instead of one mega-page).

### Hooks & services

Pairing convention:

```text
productService.ts  ↔  useProducts.ts
ticketService.ts   ↔  useTickets.ts
adminService.ts    ↔  useAdmin.ts
```

When adding a domain elsewhere: **service (HTTP) → hook (Query) → page (UI)** — same three layers.

### Layout width

Page width comes from **one** wrapper in `App.tsx`:

`mx-auto max-w-9xl px-2 sm:px-4 xl:px-8`

Do not nest another `max-w-*` on pages or you will desync Header/Footer.

---

## Libraries & Dependencies (Short Lessons)

| Library                     | What it is               | How CodeBook uses it         |
| --------------------------- | ------------------------ | ---------------------------- |
| **React**                   | UI library               | Pages + components           |
| **Vite**                    | Dev server + bundler     | `npm run dev` / `build`      |
| **TypeScript**              | Typed JS                 | Strict frontend + backend    |
| **React Router**            | Client routing           | `AllRoutes.tsx`              |
| **TanStack Query**          | Async server-state cache | Hooks + persisted cache      |
| **TanStack Table**          | Headless tables          | Admin `DataTable`            |
| **Tailwind**                | Utility CSS              | Almost all styling           |
| **Framer Motion**           | Animation                | Auth stagger + route fade    |
| **Lucide**                  | Icons                    | Replaced Bootstrap Icons     |
| **Sonner**                  | Toasts                   | `src/lib/toast.ts` wrapper   |
| **Stripe.js**               | Browser payments         | `StripeCheckout`             |
| **Express**                 | HTTP framework           | `backend/src/app.ts`         |
| **Prisma**                  | ORM                      | Schema + seed + queries      |
| **Zod**                     | Schema validation        | Route inputs                 |
| **jsonwebtoken / bcryptjs** | Auth primitives          | Login/register               |
| **pdfkit**                  | PDF generation           | Invoice attachment           |
| **Sentry**                  | Error monitoring         | Tunnel via `/api/monitoring` |

---

## Documentation Links

| Doc                                                                                                  | Contents                                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`docs/PROJECT_WALKTHROUGH.md`](./docs/PROJECT_WALKTHROUGH.md)                                       | Contributor orientation                                                         |
| [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md)                                                     | Migration phases + checklist                                                    |
| [`docs/UI_STYLING_GUIDE.md`](./docs/UI_STYLING_GUIDE.md)                                             | Visual tokens / cards                                                           |
| [`docs/LLM_MODEL_SELECTION.md`](./docs/LLM_MODEL_SELECTION.md)                                       | Multi-provider AI reference                                                     |
| [`docs/Redis_Sentry_PostHog_INTEGRATION_GUIDE.md`](./docs/Redis_Sentry_PostHog_INTEGRATION_GUIDE.md) | Observability patterns (Next-oriented guide; this app uses Vite+Express Sentry) |
| [`.agile-v/REQUIREMENTS.md`](./.agile-v/REQUIREMENTS.md)                                             | Traceable REQ-IDs                                                               |
| [`SECURITY.md`](./SECURITY.md)                                                                       | Vulnerability reporting                                                         |
| [`LICENSE`](./LICENSE)                                                                               | MIT                                                                             |

---

## Keywords

**Frontend:** React 19, Vite, TypeScript, React Router 7, TanStack Query, TanStack Table, Tailwind CSS, Lucide, Framer Motion, Sonner, SPA, JWT sessionStorage, Google OAuth callback, code splitting, localStorage cart, persisted query cache

**Backend:** Express, Prisma, PostgreSQL, Zod, Helmet, express-rate-limit, bcrypt, jsonwebtoken, pdfkit, Stripe webhooks, Brevo, Shippo, Cloudinary, Sentry tunnel, multi-provider LLM insights

**E-commerce:** eBook storefront, shopping cart, checkout, order timeline, address book, reviews, support tickets, admin analytics, inventory stock, refunds, shipping labels, RBAC

**Learning:** full-stack project, educational codebase, reusable UI primitives, API design, cache invalidation, environment configuration

---

## Security

Please read **[SECURITY.md](./SECURITY.md)** before reporting issues.

- Private reports only: **[contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)**
- Do **not** file public GitHub issues for vulnerabilities
- Do **not** attach real secrets or `.env` files

---

## Contributing

This is an educational open-source project. Contributions are welcome:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Match existing patterns (TypeScript strict, shared UI, Query invalidation)
4. Run `npm run lint` and `npm run typecheck` (and the same under `backend/`)
5. Open a Pull Request with a clear description

### Style guidelines

- Functional React components + hooks
- No `any` — prefer precise types
- Reuse `components/ui` instead of one-off markup
- Invalidate all affected Query keys after writes
- Never commit secrets

---

## Conclusion

CodeBook is both a **working eBook store** and a **teaching codebase**: Vite SPA frontend, Express/Prisma API, real Stripe/auth/admin flows, and careful cache/invalidation habits. Use the legacy live demo to explore the UX today; use the local Vite + `backend/` stack to learn the post-AWS architecture as Coolify/Vercel cutover continues.

If you build something on top of it, share it — and enjoy the process.

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). Feel free to use, modify, and distribute the code as per the terms of the license.

---

## Happy Coding! 🎉

This is an **open-source project** — feel free to use, enhance, and extend this project further!

If you have any questions or want to share your work, reach out via GitHub or my portfolio at [https://www.arnobmahmud.com](https://www.arnobmahmud.com).
