# Agile V Skills Registry (24) — CodeBook

**Upstream:** https://github.com/Agile-V/agile_v_skills  
**Local copies:** `.agile-v/skills/01-…24-*.md`  
**Also installed globally:** `~/.claude/skills/<name>/SKILL.md`  
**Load order:** Always `01-agile-v-core` first, then task-specific skills.

| # | Skill file | V-position | When to load |
|---|------------|------------|--------------|
| 01 | `01-agile-v-core.md` | All | Every session |
| 02 | `02-agile-v-pipeline.md` | Orchestrate | Full pipeline / waves |
| 03 | `03-agile-v-lifecycle.md` | Evolve | Cycle 2+, change requests |
| 04 | `04-agile-v-compliance.md` | Verify | ISO/GxP, CAPA, gates |
| 05 | `05-agile-v-behavioral.md` | All | Agent behavior tuning |
| 06 | `06-agile-v-product-owner.md` | Specify | Sprint/backlog |
| 07 | `07-agile-v-quality-gates.md` | Verify | Gate definitions |
| 08 | `08-system-understanding-agent.md` | Gate 0 | Existing codebase |
| 09 | `09-impact-analysis-agent.md` | Constrain | Pre-change impact |
| 10 | `10-graph-traceability-agent.md` | Verify | REQ↔code↔test links |
| 11 | `11-regression-selection-agent.md` | Prove | Test selection |
| 12 | `12-diff-evidence-agent.md` | Verify | Predicted vs actual |
| 13 | `13-discovery-analyst.md` | Specify | User research → REQ |
| 14 | `14-requirement-architect.md` | Specify | New features / PRD |
| 15 | `15-logic-gatekeeper.md` | Constrain | REQ validation |
| 16 | `16-build-agent.md` | Apex | Generic implementation |
| 17 | `17-build-agent-js.md` | Apex | **This project (Vite SPA + Express)** |
| 18 | `18-test-designer.md` | Apex | Test cases from REQ |
| 19 | `19-red-team-verifier.md` | Verify | Independent verification |
| 20 | `20-compliance-auditor.md` | Verify | Audit artifacts |
| 21 | `21-threat-modeler.md` | Specify | Security STRIDE |
| 22 | `22-ux-spec-author.md` | Specify | UX/accessibility |
| 23 | `23-observability-planner.md` | Prove | Sentry/metrics |
| 24 | `24-release-manager.md` | Verify | Deploy/rollback |

**N/A this repo:** `build-agent-nestjs`, `build-agent-python`, `build-agent-dart`, `build-agent-embedded`, `schematic-generator` (no Nest/Python/Flutter/firmware/PCB).

**Cursor rule active:** `.cursor/rules/agile-v-infinity-loop.mdc` (`alwaysApply: true`)  
**Session hooks:** `AGENTS.md` · `.agile-v/ACTIVATION.md` · `.agile-v/SKILLS.md` · `CLAUDE.md`
