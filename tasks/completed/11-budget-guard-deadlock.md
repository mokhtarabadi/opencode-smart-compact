# Task 11: Emergency budget must never block compaction

**File:** `tasks/completed/11-budget-guard-deadlock.md`
**Source:** manager (2026-10-13, reported from the dumble overnight session)
**Type:** bug
**Status:** closed

## Goal

The emergency budget guard aborts compaction when the measured history is larger
than the budget, which deadlocks exactly the sessions that need compaction most:
once a session passes the budget, no compaction can ever run again. The budget
must warn, never gate.

## Observed failure

On a long session (~424k tokens) every compaction attempt printed
`compaction aborted: measured ~424k tokens exceeds the emergency budget of 50000
tokens. Raise tokens.emergencyBudgetTokens (0 disables) and rerun.` and did
nothing. The only way out was raising the budget in project config.

## Root cause

`checkBudgetGuard(measuredTokens, config)` returns `true` when
`measuredTokens > budget` (config.ts:240-244). Both callers treat that `true` as
an abort:

- `compactNow` (actions.ts:55-61) returns 0 without summarizing, so an explicit
  `compact_context` / `/magic-compact` request is refused.
- the per-request context hook (index.ts:60-68) returns before
  `applyStrategies` and `pruneToolResults`, so a large session silently loses
  every pruning and strategy benefit for every subsequent request — the exact
  silent degradation the project guardrails forbid.

## Fix

The predicate keeps its measurement but becomes a warning signal
(`isOverEmergencyBudget`). Both callers log/notify and then continue the work
they were asked to do. An explicit compaction request always proceeds; the
per-request hook always prunes. A zero budget still disables the warning.

## Verification Evidence

- **Test command:** `npm run typecheck && npm test`
- **Expected result:** typecheck clean; suite green, including the updated predicate test and a regression test proving the guard is warning-only
- **Actual result:** typecheck clean; `npm test` -> 45 tests, 45 pass, 0 fail
- **Regression proof (test has teeth):** the bug was reintroduced on purpose (`return 0;` after the warning in `compactNow`); the new test failed with `budget guard is advisory: no caller early-returns on an over-budget history`; after restoring the fix the suite returned to 45/45. Evidence captured in this run.
- **Exit code:** 0

## Definition of Done

- [x] Predicate renamed and documented as warning-only (`isOverEmergencyBudget`)
- [x] Neither caller aborts; both still surface the warning (the hook also notifies)
- [x] Tests updated + a regression test for the deadlock (proven to fail on the old shape)
- [x] README and CHANGELOG updated; patch version bumped (0.2.0 -> 0.2.1)

## Local TODOs

- [x] Rename `checkBudgetGuard` -> `isOverEmergencyBudget` and document it as warning-only
- [x] Remove the early return in `compactNow`; keep the warning
- [x] Remove the early return in `runPrune`; keep warn + notify
- [x] Update the predicate test and add the source-seam regression test
- [x] Update README + CHANGELOG; bump version to 0.2.1
- [x] Run `npm run typecheck && npm test`

## Acceptance Criteria

- [x] Over-budget session compacts successfully (no abort)
- [x] Per-request hook still prunes and applies strategies when over budget
- [x] Warning is still emitted with the measured cost

## Activation note

The running OpenCode plugin is the installed git version, so this source fix only takes effect after the plugin is republished/repointed. Until then the project-level `.opencode/smart-compact.jsonc` override (raised `tokens.emergencyBudgetTokens`) is the effective workaround and can be removed once the fixed version is installed.

## Risk & Rollback

- **Risk:** a genuinely runaway context now compacts instead of stopping, which
  is the intended behaviour (compaction is the remedy, not the hazard).
- **Rollback plan:** revert the two call sites and the rename.

## Execution Log & Reasoning

Reported by the Manager after a deadlocked session in another project. Traced to
the inverted use of the budget predicate as a gate. Both call sites were read
and confirmed.

### QA turn (Brain bridge, `task_id=11`, session `ses_ecc4e67b1ffeu3YLd0O70UHlOm`)

- **Verdict:** `QA_PASSED` (no blocking defect).
- **F1:** `compactNow` measures cost, warns over budget, then continues to build
  turns and summarize — no early return (cites `src/actions.ts:50`).
- **F2:** `runPrune` measures visible cost, warns + notifies, then continues to
  `applyStrategies` + `pruneToolResults` — no early return (cites `src/index.ts:59`).
- **F3:** predicate returns `false` for a zero budget and for under-budget, `true`
  for over-budget, so a zero budget disables the warning (cites `src/config.ts:239`).
- **R1 (advisory, non-blocking):** if `notify` throws, the prune pass is skipped
  for that request. Suggested hardening: wrap `notify` in try/finally. Not a
  release blocker.
- **F4 (gap, non-blocking):** no behavioral test drives `compactNow` over budget;
  the source-seam regression test still fails on a reintroduced abort
  (cites `tests/config-validation.test.ts:26`, `:58`).
- **Next stage:** QA recommends Code Reviewer for final review.

### Code Reviewer turn (Brain bridge, `task_id=11`, session `ses_ecc4e67b1ffeu3YLd0O70UHlOm`)

- **Verdict:** `APPROVED` (technical). Status `PO_REVIEW_PENDING`.
- **F1:** `compactNow` warns over budget then builds turns + summarizes, no early
  return. **F2:** `runPrune` warns + notifies then applies strategies + prunes, no
  early return. **F3:** predicate false for zero budget / low cost, true for high
  cost. **F4:** README + CHANGELOG + version in sync with warning-only behavior.
- **R1 (deferred):** throwing `notify` in `runPrune` would skip prune for that
  request; predates the fix, defer try/finally hardening to a follow-up.
- **R2 (accepted debt):** the regression test inspects source text (source-seam);
  it has proven teeth against the old abort shape, full ctx-harness test deferred.
- **Relay:** technical approval awaits the Manager's closure word; task stays in
  `tasks/qa/`.

### Closure authorization

- Manager replied **"Approved for closure"** (via the closure question) after the
  `PO_REVIEW_PENDING` relay. Exact closure phrase received; proceeding to the
  closure sequence.
- 2026-10-13: Closure executed after "Approved for closure"; file moved to
  `tasks/completed/` and committed via `commit_and_clean_task`.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `f696ed19d318afb9a60367f4cf994bb7abc47ce6`
<!-- END_GIT_DIFF -->
