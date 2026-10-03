# Task 01: Phase 0 bootstrap

**File:** `tasks/completed/01-phase-0-bootstrap.md`
**Source:** manager
**Type:** feature
**Status:** closed

## Goal

Bootstrap project governance: Kanban dirs, AGENTS.md, conventions, opencode.json.

## Manager's Notes

Manager approved Phase 0 on 2026-10-03 with task file. Scope: Kanban dirs + AGENTS.md + docs/conventions.md + validated opencode.json. Stack: TypeScript OpenCode V2 plugin (src/index.ts, apply.ts, prune.ts, store.ts, summarize.ts, types.ts).

## Local TODOs

- [x] Create Kanban dirs tasks/backlog, in-progress, qa, completed, archive
- [x] Generate AGENTS.md from audit-agents Phase 0 template
- [x] Generate docs/conventions.md with DateTime, SOLID, Ledger, DSP
- [x] Generate validated opencode.json project-only
- [x] Verify with typecheck

## Acceptance Criteria

- [x] tasks/ has 5 Kanban subdirs
- [x] AGENTS.md exists at root with Core File Locations, ZAC, End-of-Task Sequence, Skill Loading, Context Bootstrapping
- [x] docs/conventions.md exists with required standards
- [x] opencode.json validates with zero errors
- [x] npm run typecheck exits 0

## Verification Evidence

- **Test command:** rtk test npm run typecheck
- **Expected result:** tsc --noEmit exits 0, no errors
- **Actual result:** tsc --noEmit exits 0, no errors (rtk wrapper absent, ran npm run typecheck directly, exit 0)
- **Exit code:** 0

> Verification runner rule: `npm run typecheck` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

The task is NOT done unless ALL of the following are true (unconditional, applies to every source type):

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** Invalid opencode.json breaks local config
- **Rollback plan:** Delete generated AGENTS.md, docs/conventions.md, opencode.json, keep src/ untouched; git status to confirm no src changes

---

## Execution Log & Reasoning

Brainstorm: not required — single-domain scaffolding, fully reversible file creation, no cross-disciplinary ambiguity.

Assumption A1: Phase 0 = governance bootstrap per audit-agents Phase 0 + opencode-init + migrate-kanban. Reason: Manager named those three skills explicitly.
Assumption A2: default_agent omitted until agents_dir exists. Reason: opencode-init forbids inventing agent names.
Seat Check: domains → scaffolding/governance → no UI, no schema, no deadlock → no Designer/Architect/Senior trigger → single-seat bootstrap, no consult required.

Closure: Manager authorized with "Close task" on 2026-10-03. File moved qa → completed, status set closed.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `11a620c42635479982e97be559592f4fda17b27c`
<!-- END_GIT_DIFF -->
