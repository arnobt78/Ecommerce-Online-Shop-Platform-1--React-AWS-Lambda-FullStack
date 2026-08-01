# Agile V — Session Activation (every prompt)

<!-- CodeBook E-Commerce | v1.4 | Sync: 2026-08-01 | Infinity Loop ACTIVE -->

## 1. Load skills (mandatory — every prompt)

| # | Skill | When |
|---|-------|------|
| 1 | `agile-v-core` | **Always first** |
| 2 | `agile-v-pipeline` | **Always** |
| 3 | `agile-v-lifecycle` | C2+ / archive / CR |
| 4 | Role from `SKILLS.md` / `skills/SKILLS_INDEX.md` | By pipeline stage |
| 5 | `agile-v-compliance` | Gates, risk, CAPA, Gate 2 close |
| 6 | `agile-v-quality-gates` | Constrain + Verify (optional tighten) |

**24 agents:** `.agile-v/SKILLS.md` · **Repo stack:** `build-agent-js` (Vite SPA + Express/Prisma)

## 2. Read (resume — in order)

1. `STATE.md` — **C1** · Phases 1–6 complete · HEAD **`edae3e1`** · idle, ready for next intent
2. `CHECKPOINTS.md` — halt if any **PENDING** HITL (**none** — CKPT-0001 RESOLVED + committed)
3. `REQUIREMENTS.md` — parent **REQ-XXXX** before code (last shipped **REQ-1630**; open: deploy REQs + optional polish)

## 3. Before coding (mandatory gate)

1. Read `STATE.md` + `CHECKPOINTS.md`.
2. Resolve parent `REQ-XXXX` — **halt if missing** (run Specify first).
3. Pipeline: **Specify → Constrain → [Gate1] → Orchestrate → Prove → Verify → [Gate2] → Accept**
4. CRUD: invalidate all affected TanStack Query keys — never hardcode ad-hoc keys without checking existing helpers.
5. Verify (this repo):
   ```bash
   npx tsc -b && npx eslint src
   cd backend && npx tsc --noEmit && npm run lint
   npm run build   # frontend vite + backend as needed
   ```
6. Gate 2 (R2/R3): `EVAL_RESULTS.md` `eval_gate_status: PASS` or `WAIVED` with `APPROVALS.md` ref.

## 4. Infinity Loop

```
Specify → Constrain → [Gate1] → Orchestrate → Prove → Verify → [Gate2] → Accept
         ↑___________________________________________________________|
```

## 5. Traceability

`REQ-XXXX` → `ART-XXXX` → `TC-XXXX` → `VER-XXXX` → append `DECISION_LOG.md`

## 6. Cycle index (living)

| Cycle | Scope | Status | HEAD |
|-------|-------|--------|------|
| C1 | Brownfield baseline + migration Phases 1–6 (REQ-1200…1630) | Orchestrate/Prove complete; Gate 2 not yet | `edae3e1` |

**Baseline:** `tsc`/`eslint`/`vite build` clean · app local-only · Coolify deferred · pushed `origin/main`

## 7. Halt if

No parent REQ · ambiguous REQ · self-verify only (no Red Team for R2/R3) · skip mutation invalidation · Gate 2 without EVAL PASS · PENDING checkpoint · Coolify deploy without explicit user ask

## 8. Project hooks

`AGENTS.md` · `CLAUDE.md` · `docs/PROJECT_WALKTHROUGH.md` · `docs/PROJECT_PLAN.md` · `.cursor/rules/agile-v-infinity-loop.mdc` (always on)

## 9. Default role map (this repo)

| Stage | Skill |
|-------|-------|
| Specify | `requirement-architect` (+ `ux-spec-author` if UI) |
| Constrain | `logic-gatekeeper` |
| Orchestrate | `build-agent-js` ∥ `test-designer` |
| Verify | `red-team-verifier` |
| Accept / gates | `agile-v-compliance` + `compliance-auditor` |

## 10. Session activation (2026-08-01) — **CURRENT**

- agile-v-core + pipeline + lifecycle + compliance loaded; **24 skills** indexed under `.agile-v/skills/`.
- Working tree clean; `main` == `origin/main` at **`edae3e1`**.
- CKPT-0001 closed — restructure committed in `14e53b2`.
- **Idle / ready** — no coding until user supplies next feature/fix intent → Specify (new REQ-XXXX).
- Explicitly deferred: Coolify/VPS (REQ-1201, 1210–1212); Redis/PostHog; independent Red Team Gate 2.
