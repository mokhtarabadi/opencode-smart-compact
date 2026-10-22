# Task 15: Post-Fix Hardening For Automatic Trim

**File:** `tasks/completed/15-post-fix-hardening-automatic-trim.md`
**Source:** manager
**Type:** bugfix
**Status:** closed

## Goal

Close the gaps the Code Reviewer found on task 14: one trim per sustained high-pressure
period instead of one per request, a test that pins the `awareness.enabled` master-switch
behaviour, and a decision (with evidence) on same-session overlapping hook executions.

## Manager's Notes

- The Manager asked for the last two commits to be diffed, handed to the Brain, and the
  findings collected into a post-fix task: "مشکلاتش رو بهمون بگو توی تسک post fix انجام بدیم و
  کامل کنیم".
- Brain review verdict on task 14: `APPROVED_WITH_CHANGES`, with F1 (re-queue per request) as
  the one item that must be fixed before the feature is treated as complete.
- No shipped default may change: `autoTrimRatio` stays `0`, `warnRatio`/`emergencyRatio` stay
  `0.7`/`0.9`. Automatic summarization stays out of scope.

## Local TODOs

- [x] Measure the first real impact of the re-queue path before changing the guard: does the
      second pass write anything, or is it only an extra pass plus a log line?
- [x] Add a per-session re-arm latch so one sustained high-pressure period queues at most one
      trim, resetting once the fill drops below the configured reset threshold.
- [x] Test consecutive requests that stay above the ratio across a consumed trim.
- [x] Test that an already pending compaction is never replaced by the auto-trim.
- [x] Add the missing test for `awareness.enabled: false` with a positive `autoTrimRatio`.
- [x] Decide C4: confirm whether the host can run overlapping `context` hooks for one session,
      then either add the serialization guard or record the verified guarantee in `src/DECISIONS.md`.
- [x] Update `src/DECISIONS.md`, `README.md`, `CHANGELOG.md` with whatever the guard becomes.

## Acceptance Criteria

- [x] One trim is queued per sustained high-pressure period; a second request at the same fill
      queues nothing.
- [x] The latch re-arms below its reset threshold and a genuinely new pressure rise queues
      another trim.
- [x] `awareness.enabled: false` suppresses auto-trim even with a positive `autoTrimRatio`, and
      a test pins that behaviour.
- [x] A pending compaction is never overwritten by the auto-trim.
- [x] The same-session concurrency question is answered with evidence: either a guard plus an
      overlap test, or a recorded guarantee.
- [x] `npm run typecheck` and `npm test` exit 0; task lint passes.

## Verification Evidence

- **Test command:** `rtk test npm test`
- **Expected result:** the whole node:test suite green, exit 0
- **Actual result:** exit 0, `tests 95 / pass 95 / fail 0` (three new hook-level cases, a widened
  `shouldAutoTrim` matrix, and an `autoTrimResetLine` boundary case on top of task 14's 91).
- **Test command:** `rtk test npm run typecheck`
- **Expected result:** `tsc --noEmit` clean
- **Actual result:** exit 0, no diagnostics.
- **Exit code:** 0

> Verification runner rule: the first run of each verification used the `rtk test` prefix; one
> raw `npm test` rerun was used only to read the pass/fail counts that the collapsed summary
> elides.

## Definition of Done

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

## Risk & Rollback

- **Risk:** a re-arm latch that resets too eagerly reproduces the per-request behaviour, and
  one that resets too lazily stops helping a session that stays full for a long time.
- **Mitigation:** the reset threshold is a config-adjacent constant with a test on both sides
  of the boundary, and the shipped default stays `0` (off) until the guard is proven.
- **Rollback plan:** set `awareness.autoTrimRatio` to `0`; the plugin returns to advisory-only
  behaviour with no other change.

---

## Execution Log & Reasoning

### Mode lock

Autopilot locked by the Manager ("lock auto pilot mode", 2026-10-22). QA, the fix loop, and
the code review are chained from the Hands against task id 15; only the plan gate, hard
blockers, and the closure word go to the Manager. No commit outside the closure path.

### What was built

A per-session re-arm latch for the automatic trim. `autoTrimLastRatio` joins the state (and the
`loadState` whitelist), records the fill at which a trim was queued, and `shouldAutoTrim` now
takes `{ ratio, autoTrimRatio, rearmStep, hasPending, lastRatio }`: the first crossing fires,
a later request fires only once the fill grew by `rearmStep`, and the caller clears the latch
once the fill drops a re-arm step below the line. Reset is driven by the ratio, never by the
pending slot, because prune runs before awareness inside one request and a consumed pending
would otherwise look like an immediate re-arm. All writes in the block collapse into one
`saveState` guarded by a `stateChanged` flag, so the block no longer writes twice.

C4 closed as a recorded guarantee, not a lock: in the installed host the `context` event has one
emit site inside `SessionRunner.runStep`, the runner map holds one fiber per `sessionID`, and
hooks are awaited. Recorded as D8 with the cross-process caveat.

### Plan gate

The Brain plan turn failed twice with `provider overall deadline hit (500.0s)` — the bridge was
reachable and the provider simply did not answer in time. Rather than stall the locked
autopilot, the Hands wrote the plan from the discovery evidence and the Manager approved it
explicitly ("تایید پلن، بدون Brain ادامه بده"). Plan-as-approved-by-Manager is the plan of
record for this task; no Brain-authored XML exists for it.

### Files

- `src/types.ts` — `autoTrimLastRatio?: number` with the reset semantics documented.
- `src/store.ts` — the field carried through the `loadState` whitelist with a finite-number guard.
- `src/awareness.ts` — `shouldAutoTrim` takes an object and honours `rearmStep` + `lastRatio`.
- `src/index.ts` — latch set/clear plus a single guarded save.
- `tests/awareness.test.ts` — widened matrix (first crossing, step, no re-fire, latched above
  current fill, malformed inputs).
- `tests/awareness-hook.test.ts` — sustained period trims once; drop-and-rise trims again;
  disabled awareness suppresses the trim even with a positive ratio.
- `README.md`, `src/DECISIONS.md` (D8), `CHANGELOG.md` — docs sync.

### Self-QA pass (independent Brain QA unavailable)

The Brain QA turn could not run: three consecutive `brain_turn` calls hit `provider overall
deadline hit (500.0s)` while the bridge itself stayed healthy. The Hands therefore ran the
adversarial pass itself, and it found one real edge case the plan had missed:

- **Found and fixed:** with `autoTrimRatio` smaller than `rearmStep`, the reset line
  (`autoTrimRatio - rearmStep`) landed at or below zero, so the latch could never clear and a
  session would trim once and never again. Extracted `autoTrimResetLine`, which falls back to
  the line itself when the step is at or above it, plus a boundary test.
- **Traced, not fixed (correct as built):** a consumed trim on request N+1 cannot re-queue on
  the same request, because the latch equals the fill measured after the prune, so the growth
  test fails; `pending` is normalized to `null` by `loadState`, so `state.pending !== null` is
  a sound `hasPending`; a throwing `runPrune` leaves `pending` set and retries next request
  (pre-existing behaviour, unchanged).
- **Not covered by a test:** the reset-line fallback end-to-end through the hook. The unit test
  covers the pure helper; a hook-level case would need a ratio below 0.03, which is outside the
  range this plugin realistically sees.

### Source of this scope

The Code Reviewer turn on task 14 returned `APPROVED_WITH_CHANGES` against the committed diff
of `7e88f166` (feature) and `c73dcadc` (closure), and produced the findings below.

- **F1 (minor, must fix) — re-queue per request.** `shouldAutoTrim` only checks the ratio and
  the pending slot. Because pruning runs before awareness in the same request, a trim can be
  consumed and immediately queued again while the fill stays high, which costs an extra pass
  and one log line per request.
- **F2 (minor) — `awareness.enabled` master switch.** The reviewer judged the coupling
  reasonable and did not ask to decouple it; what is missing is a test that pins the behaviour.
- **C3 refuted.** The auto-trim save and the latch-clear save share the same loaded state
  object, and the latch-clear branch does not touch `pending`, so no lost write.
- **C4 open.** A race requires overlapping requests in one session. Two sequential loads in one
  request cycle prove nothing, so the question needs a runtime answer, not a guess.

### Bridge note

`brain_turn` with `context_paths` returned `<missing_context>` for both an absolute and a
project-relative path, so the review was grounded on the inline hunk excerpt instead. Worth a
separate look at the bridge's path resolution; nothing in this task depends on it.

### QA round

The Brain QA turn returned `QA_PASSED` with no unmet acceptance criterion and one low-severity
documentation finding (R1): `README.md` claimed re-arming required dropping below the reset line
and rising again, while `shouldAutoTrim` also re-arms when the fill grows by `rearmStep` without
dropping. R1 reproduced — the code was right, the sentence was incomplete — and the README now
states both paths. No code change.

### Review round

The Code Reviewer returned `REJECTED_NEEDS_FIXES` on one reproduced finding: `shouldAutoTrim`
coerced a zero or invalid `rearmStep` to zero, so `ratio >= lastRatio + 0` passed at an
unchanged fill and the latch could re-queue on every request — the exact behaviour F1 was
meant to remove. Unreachable through `loadConfig` (the merge rejects a non-positive
`rearmStep` and falls back to `0.05`), but the defensive branch was still wrong and the
reviewer was right to refuse it.

Fix: a missing or non-positive step now suppresses growth-based re-arming entirely instead of
degenerating to a zero-step comparison, while the first crossing and the caller's reset line
keep working. Covered by four assertions in the `shouldAutoTrim` matrix. No behaviour change
for any config `loadConfig` can produce.

Round two returned `APPROVED` with no issues and no unmet acceptance criterion, and flipped the
task to `PO_REVIEW_PENDING`: code approved technically, the closure word is the Manager's. The
file stays in `tasks/qa/` until that word arrives.

### Hold (parked)

The Manager chose to wait for the Brain provider to recover rather than close on the Hands
self-QA ("صبر کنیم تا brain درست بشه"). State at the hold: implementation complete and staged,
95/95 tests green, typecheck clean, task parked in `tasks/qa/` with no further edits. On
resume: run the Brain QA turn, clear any findings, then the review turn, then ask for the
closure word. Nothing else is outstanding.

### Closure

Manager accept (verbatim, answering the relayed closure question): "Approved for closure"

Closure performed via `git mv` to `tasks/completed/` and
`custom_context_commit_and_clean_task`. No source changes in closure.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `cfd3c8ecd7c5402c156b953fc95a6237f4a6962c`
<!-- END_GIT_DIFF -->
