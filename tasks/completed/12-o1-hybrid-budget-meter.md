# Task 12: O1 hybrid budget meter plus ordered prune plus backup pointer

**File:** `tasks/completed/12-o1-hybrid-budget-meter.md`
**Source:** manager (2026-10-16, brain O1 plan autopilot approved)
**Type:** feature
**Status:** closed

## Goal

Add hybrid budget meter plus fixed cost prune order plus backup pointer. Keep verbatim user text. Keep per turn summaries. Keep stored history intact.

## Micro-task checklist

- [x] Step 1: Discover ID plus map integration points
- [x] Step 2: Implement D1 budget meter UI
- [x] Step 3: Implement D2 fixed cost prune order
- [x] Step 4: Implement D3 backup pointer plus harden R1 R2 R3
- [x] Step 5: Add TDD tests for meter order pointer
- [x] Step 6: Docs plus readiness for gate

## Verification Evidence

- **Test command:** `npx tsc --noEmit && npm test`
- **Expected result:** typecheck clean, suite green including 12 O1 plus 6 adversarial tests
- **Actual result:** typecheck clean, `npm test` 63 tests 63 pass 0 fail
- **Exit code:** 0
- **Stack detection:** root `package.json` markers TypeScript plus opencode plugin, no nest next vite expo prisma gin fastapi flask markers, blueprint no-match logged, strict tooling gate skipped for docs-only reason, typecheck plus tests are the gate.
- **Living docs:** no sibling `README.md` or `DECISIONS.md` in `src/` scope, skipped gracefully per Absent-File Policy, root README unchanged.

## Execution Log & Reasoning

- Step 1 mapping: hook `src/index.ts:215`, `runPrune src/index.ts:48`, one-shot `src/index.ts:224-227`, apply `src/index.ts:228-230`. Budget `isOverEmergencyBudget src/config.ts:243`. Measure `measureTokens src/prune.ts:16`, `countTokens src/tokens.ts:75`. Ordered prune exists `pruneToolResults src/prune.ts:167`, `applyOmissions src/prune.ts:223`. Backup pointer gap confirmed, only forward omissions cache.
- O1 approved: BUDGET_WARN_RATIO 0.7 warn display only, 0.9 emergency, fixed weights tool-result 100 summary 50 omission 10, pointer cap 20, Date.now stats only, UTC storage.
- Assumption A1: next ID is 12 from completed 01,05-11 plus archive 02-04, backlog empty.
- D1 done: `getBudgetState` plus `formatBudgetMeter` pure, hook logs before/after prune, no behavior change, R1 warn fatigue mitigated display-only.
- D2 done: `rankPruneCandidates` pure never mutates, two-pass prune collects then ranks, user turns never enter candidates, R2 order proven by tests.
- D3 done: `writeBackupPointer` plus `readLatestBackupPointer` cap 20, best-effort in runPrune never blocks, Date.now stats-only, UTC epoch storage ISO display, R3 bloat capped.
- Autopilot locked for O1, mode recorded here.
- Hotfix QA_REJECTED V1-V5: V1 duplicate callId collapse fixed via unique rank ids plus index order, no Map keyed by callId. V2 pointer moved post-prune with fresh keys plus after ratio plus warn on fail. V3 storage validated fail-closed plus filtered writes. V4 hook guards budget limit plus empty objects, formatters clamp NaN plus safe date. V5 empty catch replaced with warn.
- Hotfix tests T1-T6: duplicate prune both, malformed storage null, invalid formatter safe, 25 writes cap 20, NaN Infinity negative string safe, empty plus tie stable.
- QA re-audit: `QA_PASSED` under `task_id=12`. F1 duplicate-safe rank, F2 post-prune fresh pointer with warn, F3 fail-closed validation, F4 guards. Residual R1-R3 non-blocking. T1-T6 present. Evidence 63 tests pass.
- Code Reviewer: technical approval `PO_REVIEW_PENDING`. S1-S5 strengths hold. I1 dead rank map low, I2 suffix parse low, I3 double measure info. No high severity.
- Closure authorization: Manager replied "Approved for closure" via closure question. Lane moved to completed, no code change.

## Definition of Done

- [x] D1 meter pure reader plus format plus hook wiring
- [x] D2 rank pure function plus wiring, user turns never prune
- [x] D3 pointer write plus read cap 20 per session storage only
- [x] Tests for meter order pointer green
- [x] CHANGELOG plus task log updated

## Local TODOs

- [x] Map hook budget prune store actions plus tests
- [x] Implement meter rank pointer with docstrings
- [x] Add 12 O1 tests and run typecheck plus suite
- [x] Update CHANGELOG and task log

## Acceptance Criteria

- [x] Meter shows normal warn emergency at 0.7 and 0.9 display-only
- [x] Rank prunes tool-result before summary before omission
- [x] Pointer writes then reads match capped to 20 per session
- [x] Typecheck clean and 63 tests pass
- [x] Hotfix V1 duplicate keys both prune, V2 post-prune fresh pointer, V3 fail-closed validation, V4 guards, V5 warn on write fail
- [x] Hotfix T1-T6 adversarial coverage green

## Risk & Rollback

- **Risk:** warn fatigue at 0.7, wrong order in edge cases, pointer bloat.
- **Rollback plan:** revert `src/config.ts` meter block, `src/prune.ts` rank block, `src/store.ts` pointer block, plus hook wiring in `src/index.ts`.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `89d58ef4799b80256a62184844c34cfce2115d13`
<!-- END_GIT_DIFF -->
