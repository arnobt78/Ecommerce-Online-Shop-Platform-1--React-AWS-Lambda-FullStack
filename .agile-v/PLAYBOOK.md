# PLAYBOOK.md — How Agile-V Runs on CodeBook E-Commerce Platform

## 1. The Loop (Infinity Loop, applied to this repo)

```
        SPECIFY              CONSTRAIN            ORCHESTRATE (apex)         PROVE               VERIFY
  ┌───────────────┐    ┌──────────────────┐    ┌────────────────────┐  ┌───────────────┐   ┌──────────────────┐
  │ requirement-   │───▶│ logic-gatekeeper │───▶│ build-agent-js      │─▶│ Build Agent    │──▶│ red-team-verifier│
  │ architect /    │    │ (ambiguity +     │    │ (frontend/Lambda)   │  │ manifest +     │   │ (independent,    │
  │ discovery-     │    │  platform limits)│    │ + test-designer     │  │ Test Designer  │   │  no shared       │
  │ analyst /      │    │                  │    │ (parallel, fresh    │  │ test cases     │   │  context with    │
  │ threat-modeler │    │  ▼ GATE 1 ▼      │    │  context each)      │  │                │   │  Build Agent)    │
  │ / ux-spec-     │    │  Human confirms  │    │                     │  │                │   │  ▼ GATE 2 ▼      │
  │ author         │    │  REQ set         │    │                     │  │                │   │  Human approves  │
  └───────────────┘    └──────────────────┘    └────────────────────┘  └───────────────┘   │  release         │
                                                                                              └──────────────────┘
                                                                                                       │
                                                                                                       ▼
                                                                                              EVOLVE (all agents)
                                                                                      DECISION_LOG.md append, CAPA if failed
```

Every new instruction you give re-enters at **Specify**. Bug reports re-enter at **Specify** too (a bug is a REQ that says "current behavior violates REQ-XXXX" or is a new REQ if no prior REQ covered it).

## 2. The 24-Skill Roster (mapped to this project)

| # | Skill | Role in this repo | Active? |
|---|---|---|---|
| 1 | `agile-v-core` | Values/directives, always loaded first | ✅ always |
| 2 | `agile-v-pipeline` | Stage orchestration, waves, handoffs | ✅ always |
| 3 | `agile-v-lifecycle` | Multi-cycle mgmt (C2+ when C1 closes), change requests | ✅ on-demand |
| 4 | `agile-v-compliance` | Risk register, CAPA, gates, revalidation | ✅ on-demand |
| 5 | `agile-v-product-owner` | Backlog/sprint framing of REQs into INVEST stories | ✅ on-demand (if you want sprint-style planning) |
| 6 | `agile-v-quality-gates` | Interface/test-quality guardrails on top of core gates | ✅ on-demand |
| 7 | `discovery-analyst` | Turn messy asks ("make checkout better") into hypotheses/REQs | ✅ Specify phase |
| 8 | `threat-modeler` | STRIDE pass before touching auth/payments/admin (R3 areas) | ✅ Specify phase, R3 changes |
| 9 | `ux-spec-author` | Design/flow specs before UI REQs | ✅ Specify phase, UI work |
| 10 | `requirement-architect` | Converts intent → REQUIREMENTS.md entries | ✅ Specify phase |
| 11 | `logic-gatekeeper` | Validates REQs before synthesis, Gate 1 | ✅ Constrain phase |
| 12 | `build-agent` | Generic base; not invoked directly here | ⚪ superseded by #13 |
| 13 | `build-agent-js` | **Primary Build Agent** — React/CRA frontend + Node Lambda backend | ✅ Orchestrate phase |
| 14 | `build-agent-nestjs` | Only relevant if backend migrates to NestJS | ⚪ N/A currently |
| 15 | `build-agent-python` | N/A — no Python in this stack | ⚪ N/A |
| 16 | `build-agent-dart` | N/A — no Flutter/Dart | ⚪ N/A |
| 17 | `build-agent-embedded` | N/A — no firmware/embedded | ⚪ N/A |
| 18 | `schematic-generator` | N/A — no hardware/PCB | ⚪ N/A |
| 19 | `test-designer` | Writes test cases from REQUIREMENTS.md only, parallel to Build Agent | ✅ Orchestrate phase |
| 20 | `red-team-verifier` | Independent verification, never the Build Agent | ✅ Verify phase (Gate 2 owner) |
| 21 | `compliance-auditor` | Decision logging + traceability audit, observes all stages | ✅ always observing |
| 22 | `documentation-agent` | Repo docs (README, docs/ suite) when requested | ✅ on-demand |
| 23 | `observability-planner` | Metrics/alerts after Gate 2, for prod features | ✅ post-Gate-2, prod-facing REQs |
| 24 | `release-manager` | Rollout/rollback plans post-Gate-2 (Vercel + Lambda deploys) | ✅ post-Gate-2, deploy-affecting REQs |

## 3. Codebase Conventions (follow these — do not introduce new patterns without a REQ + Gate 1)

### Frontend (`src/`)
- **Pages:** `src/pages/<Feature>/<Feature>Page.js`, with a `components/` subfolder for page-local components and an `index.js` barrel export (see `src/pages/Admin/`, `src/pages/Tickets/`).
- **Services:** one file per domain in `src/services/<domain>Service.js` (e.g. `productService.js`, `paymentService.js`), all routed through `apiClient.js` + `apiError.js`. New backend domains get a matching service file.
- **Hooks:** `src/hooks/use<Domain>.js` wrapping TanStack Query calls to the matching service (e.g. `useProducts.js` ↔ `productService.js`).
- **Context:** global cross-cutting state only (`CartContext`, `FilterContext`, `LoadingContext`) — not a dumping ground for feature state; prefer TanStack Query + local state first.
- **Reducers:** `src/reducers/<domain>Reducers.js` for context-managed state machines (cart, filters).
- **Routing:** all routes centralized in `src/routes/AllRoutes.js`; admin/protected routes gated via `ProtectedRoute.js`.
- **Styling:** Tailwind CSS utility classes per `docs/UI_STYLING_GUIDE.md` — reuse existing design tokens/patterns documented there before inventing new ones.

### Backend (`aws-lambda/functions/`)
- One directory per domain (`auth/`, `products/`, `orders/`, `reviews/`, `tickets/`, `notifications/`, `payment/`, `admin/`, `email/`), one file per action, verb-first or action-named (`create.js`, `list.js`, `get.js`, `update.js`, `delete.js`; admin domain uses more specific names like `refund-order.js`, `add-tracking.js`).
- Shared logic lives in `aws-lambda/shared/`; DynamoDB access is centralized (see `lib/dynamodb.js`-equivalent patterns) — do not hand-roll new DynamoDB clients per function.
- Admin-only endpoints live under `admin/` regardless of which domain they affect (e.g. `admin/order-status.js`, `admin/review-update.js`), mirroring the frontend's `pages/Admin/` grouping.

### New REQ → new artifact checklist
1. Does a `REQ-XXXX` exist in `REQUIREMENTS.md`? If not, halt and run Specify phase first.
2. Frontend change → does it belong under an existing `src/pages/<Feature>/` or need a new one? New domain → new `services/<x>Service.js` + `hooks/use<X>.js` pair.
3. Backend change → does it belong under an existing `aws-lambda/functions/<domain>/` or need a new domain folder?
4. R2/R3 change (per `POLICY.yaml`) → Red Team Verifier pass required before Gate 2.
5. Log the decision in `DECISION_LOG.md` (append, never overwrite).

## 4. Human Gate Etiquette for This Project

- **Gate 1** (after Specify+Constrain): short Evidence Summary, confirm REQ set before any code.
- **Gate 2** (after Verify): required before anything R2/R3 is considered "done" — auth, payments, refunds, user deletion, infra/deploy changes.
- **Never** auto-commit, auto-push, or auto-deploy. Vercel/AWS deploys are Human-Action checkpoints.
- **Never** run destructive git ops (`reset --hard`, `push --force`, `clean -f`, deleting the pending restructure) without explicit confirmation — see the open CKPT-0001 in `CHECKPOINTS.md`.
