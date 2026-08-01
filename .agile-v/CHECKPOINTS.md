# CHECKPOINTS.md — Durable Human Gate Interrupts

Format: `checkpoint_id | resume_token | Type | Raised | Scope | Question | Status`

| checkpoint_id | resume_token | Type | Raised | Scope | Question | Status |
|---|---|---|---|---|---|---|
| CKPT-0001 | `ckpt-0001-restructure-20260730` | Human-Decision | 2026-07-30T00:00:03Z | REQ-1101, REQ-1102, REQ-1103 | Uncommitted repo-flatten restructure — how to handle? | **RESOLVED + COMMITTED** — left uncommitted until user authorized; committed+pushed in `14e53b2` (2026-08-01) |

## Resume Protocol

No **PENDING** checkpoints. On resume: read `STATE.md` → this file → parent `REQ-XXXX` before coding.

CKPT-0001 history: initially resolved as "leave uncommitted"; later user explicitly asked to commit/push → included in `14e53b2` with REQ-1200…1630 work. REQ-1101/1102/1103 are **DONE**.
