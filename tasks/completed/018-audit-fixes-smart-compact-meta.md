# Task 018: Audit fixes for opencode-smart-compact (meta)

**File:** `tasks/completed/018-audit-fixes-smart-compact-meta.md`
**Source:** manager
**Type:** improvement
**Status:** closed
**Finished:** 2026-10-31T06:40:24Z
**Meta:** true

## Source Context

## Supersedes

[018] (standalone audit fix task, no source tasks bundled)

## Bundled Checklist (All-or-Nothing)

- [ ] Add try-catch around ctx.command.transform() in setup()
- [ ] Add try-catch around ctx.tool.transform() in setup()
- [ ] Add try-catch around ctx.session.hook("context") in setup()
- [ ] Return cleanup function from setup() (clear timers, storage)
- [ ] Add error boundary in context hook callback body
- [ ] Tighten peerDependency from >=2.0.0 to >=2.0.28
- [ ] Fix ctx.storage.set type cast (SessionState → Schema.Json)
- [ ] Run full test suite after all fixes
- [ ] Brain QA + review

## Goal

Fix all MEDIUM and LOW severity findings from the OpenCode V2 plugin audit of `opencode-smart-compact`. The audit cross-referenced every plugin API call in `src/index.ts` against the latest `@opencode/plugin` SDK contract (v2.2.5) and official documentation.

## Manager's Notes

Audit verdict: PASS_WITH_WARNINGS. Key issues:
- MEDIUM: setup() has no try-catch around ctx.command.transform(), ctx.tool.transform(), ctx.session.hook() — crashes if any fails
- MEDIUM: No cleanup function returned from setup() — timers/state may leak on unload
- LOW: ctx.storage.set() uses type cast bypassing Schema.Json contract
- LOW: peerDependency >=2.0.0 is very loose — should be >=2.0.28
- LOW: No error boundary in context hook callback body — runPrune failures propagate

## Local TODOs

- [ ] Add try-catch around all ctx.* calls in setup()
- [ ] Return cleanup function from setup()
- [ ] Add error boundary in context hook callback
- [ ] Tighten peerDependency version range
- [ ] Fix ctx.storage.set type cast
- [ ] Run full test suite after all fixes
- [ ] Brain QA + review

## Acceptance Criteria

- [ ] All MEDIUM findings resolved or documented with rationale
- [ ] All LOW findings resolved or documented with rationale
- [ ] Full test suite passes (npm test)
- [ ] No regression in existing compaction behavior
- [ ] Brain QA passes and Code Reviewer approves

## Verification Evidence

- **Test command:** `npm test`
- **Expected result:** All tests pass, exit 0
- **Actual result:** All 104 tests pass, exit 0
- **Exit code:** 0

## Execution Log & Reasoning

- Wrapped `ctx.command.transform()`, `ctx.tool.transform()`, and `ctx.session.hook("context")` in try-catch in `setup()` (src/index.ts).
- Added error boundary around `runPrune` call in context hook callback.
- Returned cleanup function from `setup()`.
- Tightened peerDependency to `>=2.0.28` (package.json).
- Cast `ctx.storage.set` values as `Schema.Json` (src/store.ts), importing `Schema` from effect.
- Typecheck passes; full suite 104/104 pass.

## Risk & Rollback

- Changes are isolated to src/index.ts and package.json
- Rollback: `git checkout -- src/index.ts package.json`
- No external dependencies changed
- Plugin remains backward-compatible (same hook contract)

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `9135e40cc51cf298d3008c09d24a5d04fa462999`
<!-- END_GIT_DIFF -->

## Risk & Rollback

- Changes are isolated to src/index.ts and package.json
- Rollback: `git checkout -- src/index.ts package.json`
- No external dependencies changed
- Plugin remains backward-compatible (same hook contract)