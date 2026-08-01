# PLAYBOOK.md — How Agile-V Runs on CodeBook E-Commerce Platform

## 1. The Loop (Infinity Loop)

```
        SPECIFY              CONSTRAIN            ORCHESTRATE (apex)         PROVE               VERIFY
  ┌───────────────┐    ┌──────────────────┐    ┌────────────────────┐  ┌───────────────┐   ┌──────────────────┐
  │ requirement-   │───▶│ logic-gatekeeper │───▶│ build-agent-js      │─▶│ Build Agent    │──▶│ red-team-verifier│
  │ architect /    │    │                  │    │ (Vite SPA + Express)│  │ manifest +     │   │                  │
  │ discovery /    │    │  ▼ GATE 1 ▼      │    │ + test-designer     │  │ Test Designer  │   │  ▼ GATE 2 ▼      │
  │ threat / ux    │    │  Human confirms  │    │                     │  │                │   │  Human approves  │
  └───────────────┘    └──────────────────┘    └────────────────────┘  └───────────────┘   └──────────────────┘
                                                                                                       │
                                                                                                       ▼
                                                                                              EVOLVE → DECISION_LOG
```

Every new instruction re-enters at **Specify**. Bug reports re-enter at Specify (tie to existing REQ or create new).

**Session hooks:** `.agile-v/ACTIVATION.md` · `AGENTS.md` · `.cursor/rules/agile-v-infinity-loop.mdc` · `.agile-v/SKILLS.md` (24)

## 2. The 24-Skill Roster

See `.agile-v/SKILLS.md` and `.agile-v/skills/SKILLS_INDEX.md` for the full table. Summary:

| Active always | Primary build | Verify | N/A this repo |
|---|---|---|---|
| core, pipeline, compliance-auditor observe | `build-agent-js` | `red-team-verifier` | nestjs/python/dart/embedded/schematic |

## 3. Codebase Conventions (do not invent parallel patterns)

### Frontend (`src/`)
- **Pages:** `src/pages/<Feature>/` with local `components/` + barrel exports where established.
- **Services:** `src/services/<domain>Service.ts` via shared `API_BASE_URL` (`src/lib/apiBase.ts`).
- **Hooks:** `src/hooks/use<Domain>.ts` — TanStack Query; mutations must invalidate all affected keys (`src/utils/queryInvalidation.ts` helpers).
- **Context:** cross-cutting only (`CartContext`, `FilterContext`) — prefer Query + local state.
- **Routing:** `src/routes/AllRoutes.tsx`; admin routes lazy-split; protected via `ProtectedRoute`.
- **UI:** Tailwind + `src/components/ui/` (shadcn-style). Width only from `App.tsx` `max-w-9xl` wrapper.
- **Styling reference:** `docs/UI_STYLING_GUIDE.md`.

### Backend (`backend/`)
- Express + Prisma + PostgreSQL; Zod at route boundary; services in `backend/src/services/`.
- Routes: `backend/src/routes/*.routes.ts` mounted from `app.ts`.
- Auth: JWT + Google OAuth; helmet + rate-limit on credential routes.
- Sentry: `@sentry/node` + `POST /api/monitoring` tunnel.
- `aws-lambda/` = retired reference only — do not extend for new features.

### New REQ → checklist
1. Parent `REQ-XXXX` in `REQUIREMENTS.md`? Halt if missing → Specify.
2. Frontend: existing page/service/hook pair or new domain pair?
3. Backend: existing route/service or new?
4. R2/R3 → Red Team before Gate 2; update `EVAL_RESULTS.md`.
5. Append `DECISION_LOG.md` (never overwrite).

## 4. Human Gate Etiquette

- **Gate 1** after Specify+Constrain: Evidence Summary before code.
- **Gate 2** after Verify for R2/R3 (auth, payments, refunds, delete, infra).
- **Never** auto-commit, auto-push, or auto-deploy.
- Coolify/VPS = Human-Action only when user explicitly asks.

## 5. Open / deferred (do not surprise-start)

| Item | Status |
|---|---|
| Coolify/VPS deploy (REQ-1201, 1210–1212) | Deferred by user |
| Redis / PostHog | Out of scope unless asked |
| Independent Red Team / Gate 2 | Outstanding (self-test ≠ verify) |
| Shared `queryKeys` module (REQ-1400) | Still PROPOSED |
| Vercel security headers adaptation (REQ-1615) | Deferred until deploy in scope |
