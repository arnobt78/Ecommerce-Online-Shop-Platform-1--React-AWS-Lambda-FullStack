# Agent Instructions — CodeBook E-Commerce

**Agile V v1.4** — Infinity Loop **ACTIVE** on every prompt.

## Mandatory load order

1. **`agile-v-core`** → 2. **`agile-v-pipeline`** → 3. **`agile-v-lifecycle`** (C2+) → 4. **`.agile-v/SKILLS.md`** / **`skills/SKILLS_INDEX.md`** → 5. **`agile-v-compliance`** (gates)

**Session:** `.agile-v/ACTIVATION.md` · **Rule:** `.cursor/rules/agile-v-infinity-loop.mdc` (always on)

## Resume

1. `.agile-v/STATE.md` — **C1** · Phases 1–6 shipped locally · HEAD **`edae3e1`**
2. `.agile-v/CHECKPOINTS.md` if PENDING HITL (**none**)
3. Parent **`REQ-XXXX`** in `.agile-v/REQUIREMENTS.md` before any code (**halt if missing**)

## Engineering

`CLAUDE.md` · `docs/PROJECT_WALKTHROUGH.md` · `docs/PROJECT_PLAN.md`

**Stack:** React 19 + Vite (Rolldown) + TypeScript strict · Express + Prisma + PostgreSQL · TanStack Query 5 · Tailwind 3 · Stripe / Cloudinary / Brevo / Shippo / Google OAuth / Sentry tunnel

**Conventions:**

- Strict TS, no `any`; shared `lib/`/`hooks/`/`context/`/`services/`/`components/ui/`
- Every mutation invalidates all affected TanStack Query keys — no `location.reload()`
- Page width only from `App.tsx`: `mx-auto max-w-9xl px-2 sm:px-4 xl:px-8`
- No Redis/SSR by design
- Never `git commit`/`push` without explicit user ask that turn
- Coolify/VPS deploy deferred until user asks

## Verify

```bash
npm run lint && npm run typecheck && npm run build
cd backend && npm run lint && npm run typecheck
```

## Cycle

| Cycle | Status |
|-------|--------|
| C1 | Brownfield + migration REQ-1200…1633 — Orchestrate/Prove done; Gate 2 pending independent verify; deploy deferred |

**Next:** Await user intent → **Specify** new `REQ-XXXX` (or Red Team verify / deploy when asked).
