# CHECKPOINTS.md — Durable Human Gate Interrupts

Format: `checkpoint_id | resume_token | Type | Raised | Scope | Question | Status`

| checkpoint_id | resume_token | Type | Raised | Scope | Question | Status |
|---|---|---|---|---|---|---|
| CKPT-0001 | `ckpt-0001-restructure-20260730` | Human-Decision | 2026-07-30T00:00:03Z | REQ-1101, REQ-1102, REQ-1103 | The repo has an **uncommitted** restructure: `codebook/**` contents moved to repo root (273 files marked deleted at old path, 16 new untracked paths at root), and `codebook-backend-serverless-json-server-archived-reference/**` deleted. `.gitignore` also modified. How should this be handled? | **RESOLVED** — decision: leave uncommitted for now |

## Resume Protocol

On resume, read this file first. CKPT-0001 is `RESOLVED`: the restructure stays **uncommitted** until the user explicitly asks to commit it. Do not run `git add`/`git commit`/`git checkout .`/`reset`/`clean` against these paths without a fresh explicit instruction — the resolution was "leave as-is," not "commit." REQ-1101/1102/1103 remain `IN-PROGRESS — UNCOMMITTED` in `REQUIREMENTS.md` + `ATM.md` until that happens.
