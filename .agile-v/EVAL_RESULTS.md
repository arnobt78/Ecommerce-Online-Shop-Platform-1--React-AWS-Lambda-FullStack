# EVAL_RESULTS.md — Eval Flywheel & Gate 2 Record

`eval_gate_status`: **N/A** (no build/synthesis artifact produced yet this cycle — Gate 2 has not been reached)

## How this file is used

Whenever an R2/R3 REQ passes through Stage 3 (Orchestrate) and Stage 4 (Verify), Red Team Verifier appends a row here with the eval outcome. Human Gate 2 may only approve release when the relevant row(s) show `PASS`, or `WAIVED` with an approver reference in `APPROVALS.md`.

| Date | REQ-ID(s) | Eval Type | Result | eval_gate_status | Approver (if WAIVED) | Notes |
|---|---|---|---|---|---|---|

> Empty at bootstrap.
