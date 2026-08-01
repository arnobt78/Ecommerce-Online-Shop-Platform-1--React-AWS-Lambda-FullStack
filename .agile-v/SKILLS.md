# Agile V Agent Skills Registry — CodeBook E-Commerce

<!-- 24 companion skills | Pipeline + SCOPE-V phase mapping | v1.4 -->

**Index + local skill files:** `.agile-v/skills/SKILLS_INDEX.md`  
**Primary Build Agent:** `build-agent-js` (Vite React 19 SPA + Express/Prisma)

## Orchestration & Lifecycle (4)

| # | Skill | V-Position | SCOPE-V Phases | Pipeline Stage |
|---|-------|------------|----------------|----------------|
| 1 | `agile-v-core` | Apex | All | All — load first |
| 2 | `agile-v-pipeline` | Apex | Orchestrate | Waves, handoffs, checkpoints |
| 3 | `agile-v-lifecycle` | Apex | Evolve | Cycles, CR, archival |
| 4 | `agile-v-compliance` | Right | Verify, Evolve | Risk, CAPA, gates, revalidation |

## Quality & Product (2)

| # | Skill | V-Position | SCOPE-V Phases | Pipeline Stage |
|---|-------|------------|----------------|----------------|
| 5 | `agile-v-quality-gates` | Right | Constrain, Verify | Gate criteria |
| 6 | `agile-v-product-owner` | Left | Specify | Backlog, INVEST |

## Left — Decomposition (4)

| # | Skill | V-Position | SCOPE-V Phases | Pipeline Stage |
|---|-------|------------|----------------|----------------|
| 7 | `requirement-architect` | Left | Specify | 1 — Requirements |
| 8 | `discovery-analyst` | Left | Specify | 1 — Discovery |
| 9 | `threat-modeler` | Left | Specify, Constrain | 1–2 — STRIDE (auth/payments) |
| 10 | `ux-spec-author` | Left | Specify | 1 — UI constraints |

## Apex — Constrain & Orchestrate (8)

| # | Skill | V-Position | SCOPE-V Phases | Pipeline Stage |
|---|-------|------------|----------------|----------------|
| 11 | `logic-gatekeeper` | Apex | Constrain | 2 — Validation |
| 12 | `build-agent` | Apex | Orchestrate, Prove | 3 — Generic (prefer #13) |
| 13 | `build-agent-js` | Apex | Orchestrate, Prove | 3 — **Primary** Vite/Express/TS |
| 14 | `build-agent-nestjs` | Apex | — | ⚪ N/A |
| 15 | `build-agent-python` | Apex | — | ⚪ N/A |
| 16 | `build-agent-dart` | Apex | — | ⚪ N/A |
| 17 | `build-agent-embedded` | Apex | — | ⚪ N/A |
| 18 | `schematic-generator` | Apex | — | ⚪ N/A |

## Right — Prove & Verify (+ observability / release)

| # | Skill | V-Position | SCOPE-V Phases | Pipeline Stage |
|---|-------|------------|----------------|----------------|
| 19 | `test-designer` | Right | Orchestrate, Prove | 3 — TEST_SPEC (parallel) |
| 20 | `red-team-verifier` | Right | Verify | 4 — Independent verify |
| 21 | `compliance-auditor` | Right | Verify, Evolve | All — DECISION_LOG, ATM |
| 22 | `documentation-agent` | Right | Prove | On request — docs/ |
| 23 | `observability-planner` | Right | Prove | Sentry (shipped REQ-1628); PostHog/Redis deferred |
| 24 | `release-manager` | Right | Verify | Post–Gate 2 deploy (Coolify deferred) |

## Default stage → skill map (this repo)

| Stage | Skill(s) |
|-------|----------|
| Specify | `requirement-architect` (+ `ux-spec-author` if UI, `threat-modeler` if R3) |
| Constrain | `logic-gatekeeper` |
| Orchestrate | `build-agent-js` ∥ `test-designer` |
| Prove | Build Agent evidence + Test Designer |
| Verify | `red-team-verifier` (never Build Agent self-verify alone) |
| Gates / Accept | `agile-v-compliance` + `compliance-auditor` |

## Engineering reminders (CodeBook)

- Strict TypeScript, no `any`
- Mutations → invalidate all affected TanStack Query keys (no `location.reload()`)
- Page width only from `App.tsx` wrapper: `mx-auto max-w-9xl px-2 sm:px-4 xl:px-8`
- No Redis/SSR by design (SPA + TanStack Query cache)
- Never commit/push without explicit user ask that turn
- Coolify/VPS deploy intentionally deferred (REQ-1201/1210–1212)
