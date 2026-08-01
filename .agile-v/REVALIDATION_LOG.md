# REVALIDATION_LOG.md — Periodic Re-Verification of BASELINE REQs

Format: `Date | REQ-ID(s) | Trigger | Result | Verified By | Notes`

| Date | REQ-ID(s) | Trigger | Result | Verified By | Notes |
|---|---|---|---|---|---|
| 2026-07-30 | REQ-0004 (RISK-0003) | Bootstrap risk-register review | PASS | agile-v-core (orchestrator) | Confirmed no `src/` import of `@aws-sdk/*`; usage confined to `lib/` and `aws-lambda/`. |

## Revalidation Policy (this project)

- **R3 REQs** (auth, payments, refunds, user deletion): revalidate via Red Team Verifier the next time their code is touched — not on a fixed calendar, since this is a solo/portfolio project without a regulatory revalidation cadence.
- **R0-R1 REQs**: no scheduled revalidation; verify opportunistically.
- If this project ever takes on a compliance obligation (e.g. handling regulated data), switch `POLICY.yaml` `profile` off `lightweight-solo` and add a calendar-based cadence here.
