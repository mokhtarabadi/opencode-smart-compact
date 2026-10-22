# Task 15: Post-Fix Hardening For Automatic Trim

**File:** `tasks/qa/15-post-fix-hardening-automatic-trim.md`
**Source:** manager
**Type:** bugfix
**Status:** in-progress

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

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index ee8a26e4..3034a275 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -11,6 +11,8 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - O1 hotfix V1 duplicate keys: ranked prune no longer collapses duplicate callIds through a Map keyed by callId. Ranking uses unique per-entry ids with index order, both parts prune with distinct omission ids.
 - O1 hotfix V2 pointer freshness plus V3-V5 hardening: pointer writes post-prune with fresh keys plus after ratio and warns on failure. Storage reads validate shape fail-closed to null. Formatters guard NaN dates and arrays. Hook guards budget limit and empty state.
 - Emergency budget no longer blocks compaction. `checkBudgetGuard` was used as a gate: when a session's measured history exceeded `tokens.emergencyBudgetTokens`, `compactNow` returned without summarizing and the per-request hook returned before the strategies and the prune pass, so the largest sessions silently lost all compaction relief and an explicit `compact_context` / `/magic-compact` request was refused. The predicate is now `isOverEmergencyBudget`, a warning signal only: both callers warn (the hook also notifies) and continue the work. A zero budget still disables the warning.
+- Automatic trim no longer queues once per request while a session stays at high pressure. `shouldAutoTrim` now takes `rearmStep` and the latched `autoTrimLastRatio`, so the first crossing fires and a later request fires only after the fill grew by a step; the latch clears once the fill drops a re-arm step below the line, so a genuine new rise trims again. Reset is driven by the ratio rather than by the pending slot, because prune runs before awareness inside one request. Pinned by three hook-level tests (sustained period queues once, drop-and-rise trims again, disabled awareness suppresses the trim) and by the widened `shouldAutoTrim` matrix.
+- `autoTrimLastRatio` carried through `SessionState` and the `loadState` whitelist; without it the latch would be dropped on every load and the per-request behaviour would return silently.
 
 ### Added
 
diff --git a/README.md b/README.md
index 79585ca9..ad270a4e 100644
--- a/README.md
+++ b/README.md
@@ -135,7 +135,7 @@ Copy this recommended file to `~/.config/opencode/smart-compact.jsonc` for the b
 
 `awareness` is the context-pressure reminder. When the model-visible context of a session crosses `warnRatio` of the model's context window, the agent gets one advisory note on the next model call stating the current fill percentage and the token numbers behind it, naming the `compact_context` tool to call, and telling it to re-orient on the project before compacting. It is advisory only: the plugin never summarizes on its own, never aborts a step, and never mutates stored history. It fires once per crossing, and re-arms only after the fill grows by `rearmStep`. The measured percentage is a lower bound, because provider system prompts and tool schemas are invisible to the plugin. Set `awareness.enabled` to `false` to silence it.
 
-`awareness.autoTrimRatio` is the one automatic action, and it is lossless: at or above that fill the plugin queues a tool-output-only trim for the next request, so bulky completed tool results become notices while their originals stay cached under a Content ID. No turn is summarized, no user message is touched, and a compaction already queued is never overwritten. `0` (the default) disables it; a 1M-token window rarely needs it before the advisory fires, while a 200K window benefits from setting it near `warnRatio`.
+`awareness.autoTrimRatio` is the one automatic action, and it is lossless: at or above that fill the plugin queues a tool-output-only trim for the next request, so bulky completed tool results become notices while their originals stay cached under a Content ID. No turn is summarized, no user message is touched, and a compaction already queued is never overwritten. One sustained high-pressure period trims once: after the queued trim is consumed the per-session latch keeps the next request quiet, and it re-arms either once the fill has grown by a re-arm step, or after it drops below the line and rises again. `0` (the default) disables it; a 1M-token window rarely needs it before the advisory fires, while a 200K window benefits from setting it near `warnRatio`.
 
 ## Comparison
 
diff --git a/src/DECISIONS.md b/src/DECISIONS.md
index 04925e65..a1f1e83f 100644
--- a/src/DECISIONS.md
+++ b/src/DECISIONS.md
@@ -29,3 +29,11 @@ The agent is told how full the context window is and how to reclaim room, but th
 Context pressure alone may now trigger one action: at `awareness.autoTrimRatio` the hook queues `pending = { mode: "trim", keepTurns: 0 }` for the next request, reusing the same prune pass a manual trim uses. Trimming is the safe half of compaction - no turn is summarized, no user message is touched, and every pruned original is cached under a Content ID - so running it without asking cannot lose the thread of a task. Summarization stays explicit because it replaces turns with summaries and the agent's own reasoning about which detail matters is the only thing that can decide that safely. A pending compaction is never overwritten, and `0` (the shipped default) keeps the plugin purely advisory, so existing installs see no behavior change until they opt in.
 
 The alternative considered was detecting the task boundary (Brain task id, first user message of a task) and trimming there. It was rejected: the plugin only sees model-visible messages, a heuristic on message text is fragile, and the pressure signal already correlates with the moment relief is needed. See `src/awareness.ts:shouldAutoTrim` and `src/index.ts:runAwareness`.
+
+The latch: `autoTrimLastRatio` records the fill at which a trim was queued, and `shouldAutoTrim` fires again only once the fill has grown by `rearmStep`, so a session that stays above the line does not queue a trim on every request. The value is cleared once the fill drops a re-arm step below the line, mirroring the advisory latch. Reset is driven by the ratio, not by the pending slot, because prune runs before awareness inside one request and would otherwise look like an immediate re-arm. Added after review F1; see `src/types.ts` and `src/store.ts` (a field missing from the `loadState` whitelist is dropped on every load).
+
+## D8 Same-session hook serialization is a host guarantee (2026-10-22)
+
+The state read-modify-write in the `context` hook has no lock, and it does not need one inside one host process: in OpenCode v2.1.3 the `context` event has exactly one emit site, inside `SessionRunner.runStep`, and the runner map holds one fiber per `sessionID` — a second input while a step is running only sets `pendingWake` and is drained by the same fiber. Hooks are awaited, not fire-and-forget (`@opencode/plugin` 2.0.22 adapter wraps each callback in an awaited promise).
+
+Two caveats recorded rather than guarded: the guarantee is a property of the runner map, not of the hook layer, so it must be re-checked when the host major version moves; and it does not extend across processes, so two OpenCode servers over the same project could each run a step and lose an update, because `ctx.storage` has no compare-and-set. The plugin accepts the cross-process case: the cost is a lost latch or a re-queued trim, never lost content, since pruned originals stay cached.
diff --git a/src/awareness.ts b/src/awareness.ts
index 47ef9e7d..96c7f9ce 100644
--- a/src/awareness.ts
+++ b/src/awareness.ts
@@ -142,15 +142,44 @@ export function shouldFireAwareness(
  * nothing is summarized, no user message is touched, and no step is aborted.
  * A compaction already waiting to apply wins, so the pending request is never
  * overwritten by a weaker one.
+ *
+ * One sustained high-pressure period queues at most one trim: the first
+ * crossing fires, and a later request fires again only once the fill has grown
+ * by `rearmStep` since the last queued trim. The caller clears `lastRatio` when
+ * the fill drops back below the line, so a genuine new rise trims again.
  */
-export function shouldAutoTrim(
-  ratio: number,
-  autoTrimRatio: number,
-  hasPending: boolean,
-): boolean {
+export function shouldAutoTrim(args: {
+  ratio: number;
+  autoTrimRatio: number;
+  rearmStep: number;
+  hasPending: boolean;
+  lastRatio?: number;
+}): boolean {
+  const { ratio, autoTrimRatio, rearmStep, hasPending, lastRatio } = args;
   if (!Number.isFinite(ratio) || !Number.isFinite(autoTrimRatio) || autoTrimRatio <= 0) return false;
   if (hasPending) return false;
-  return ratio >= autoTrimRatio;
+  if (ratio < autoTrimRatio) return false;
+  if (typeof lastRatio !== "number" || !Number.isFinite(lastRatio)) return true;
+  // Without a usable step there is no growth test to apply: an unchanged fill
+  // would otherwise pass `ratio >= lastRatio` and re-queue on every request,
+  // which is exactly the behaviour the latch exists to prevent. Growth-based
+  // re-arming is suppressed; the initial crossing above and the caller's reset
+  // line still work.
+  if (!Number.isFinite(rearmStep) || rearmStep <= 0) return false;
+  return ratio >= lastRatio + rearmStep;
+}
+
+/**
+ * The fill below which the auto-trim latch is cleared. Normally one re-arm step
+ * under the line, mirroring the advisory latch. When `autoTrimRatio` is itself
+ * smaller than the step, the subtraction would land at or below zero and the
+ * latch could never clear, so the line itself is used instead.
+ */
+export function autoTrimResetLine(autoTrimRatio: number, rearmStep: number): number {
+  if (!Number.isFinite(autoTrimRatio) || autoTrimRatio <= 0) return 0;
+  const step = Number.isFinite(rearmStep) && rearmStep > 0 ? rearmStep : 0;
+  if (step >= autoTrimRatio) return autoTrimRatio;
+  return autoTrimRatio - step;
 }
 
 /**
diff --git a/src/index.ts b/src/index.ts
index d50f1635..fc5b6479 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -13,6 +13,7 @@ import { Plugin } from "@opencode/plugin";
 import { compactNow, formatBudgetMeter, parseCompactArgs, scheduleTrim } from "./actions.js";
 import { applySummaries } from "./apply.js";
 import {
+  autoTrimResetLine,
   buildAwarenessMessage,
   getAwarenessLevel,
   measureVisibleTokens,
@@ -167,14 +168,34 @@ async function runAwareness(
     // Lossless relief below the advisory threshold: schedule the tool-output
     // prune pass for the next request. Nothing is summarized and no user
     // message is touched, so this is safe to do without asking the agent.
-    if (shouldAutoTrim(ratio, awareness.autoTrimRatio, state.pending !== null)) {
+    // One sustained pressure period trims once: the latch clears only once the
+    // fill drops a re-arm step below the line, so a repeated request at the
+    // same fill queues nothing.
+    const autoTrimRatio = awareness.autoTrimRatio;
+    const trimResetLine = autoTrimResetLine(autoTrimRatio, awareness.rearmStep);
+    let stateChanged = false;
+    if (autoTrimRatio > 0 && ratio < trimResetLine && state.autoTrimLastRatio !== undefined) {
+      state.autoTrimLastRatio = undefined;
+      stateChanged = true;
+    }
+    if (
+      shouldAutoTrim({
+        ratio,
+        autoTrimRatio,
+        rearmStep: awareness.rearmStep,
+        hasPending: state.pending !== null,
+        lastRatio: state.autoTrimLastRatio,
+      })
+    ) {
       state.pending = { mode: "trim", keepTurns: 0 };
-      await saveState(ctx, sessionID, state);
+      state.autoTrimLastRatio = ratio;
+      stateChanged = true;
       console.log(
         `[smart-compact] ${Math.round(ratio * 100)}% of the window is in use; ` +
           `tool output will be trimmed on the next request.`,
       );
     }
+    if (stateChanged) await saveState(ctx, sessionID, state);
     // Hysteresis: the latch is cleared only once the context has fallen
     // meaningfully below the warn threshold. Clearing it on every small dip
     // under the threshold would let a session hovering at the boundary re-fire
diff --git a/src/store.ts b/src/store.ts
index 6058afdf..90b34988 100644
--- a/src/store.ts
+++ b/src/store.ts
@@ -60,6 +60,12 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
       value.awarenessLastLevel === "warn" || value.awarenessLastLevel === "emergency"
         ? value.awarenessLastLevel
         : undefined,
+    // The auto-trim latch survives a restart for the same reason as the
+    // advisory latch: a restarted session must not trim again immediately.
+    autoTrimLastRatio:
+      typeof value.autoTrimLastRatio === "number" && Number.isFinite(value.autoTrimLastRatio)
+        ? value.autoTrimLastRatio
+        : undefined,
   };
 }
 
diff --git a/src/types.ts b/src/types.ts
index a6cd6915..0b85800e 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -85,6 +85,12 @@ export interface SessionState {
   awarenessLastRatio?: number;
   /** Pressure level recorded at the last awareness reminder. */
   awarenessLastLevel?: "warn" | "emergency";
+  /**
+   * Fill ratio recorded when the automatic trim was last queued. One sustained
+   * high-pressure period queues at most one trim; the value is cleared once the
+   * fill drops below the auto-trim line by one re-arm step.
+   */
+  autoTrimLastRatio?: number;
 }
 
 export function emptyState(): SessionState {
diff --git a/tests/awareness-hook.test.ts b/tests/awareness-hook.test.ts
index a5bd8653..7f469508 100644
--- a/tests/awareness-hook.test.ts
+++ b/tests/awareness-hook.test.ts
@@ -240,6 +240,72 @@ test("autoTrimRatio stays off by default", async () => {
   assert.equal((h.storage.get("session:ses-default") as { pending?: unknown } | undefined)?.pending ?? null, null);
 });
 
+test("a sustained high-pressure period queues one trim, not one per request", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-latch-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"autoTrimRatio": 0.4}}');
+  const h = await harness({ limitContext: 10_000, directory: dir });
+  const system: Array<{ type: string; text: string }> = [];
+  const base = { sessionID: "ses-latch", model: { providerID: "test", id: "model-x" }, system };
+  const pendingOf = () =>
+    (h.storage.get("session:ses-latch") as { pending?: unknown } | undefined)?.pending ?? null;
+  // First request at 50 percent queues the trim.
+  await h.hook({ ...base, messages: [bigMessage(20000)] });
+  assert.deepEqual(pendingOf(), { mode: "trim", keepTurns: 0 });
+  // Second request at the same fill: the queued trim is consumed, nothing is re-queued.
+  await h.hook({ ...base, messages: [bigMessage(20000)] });
+  assert.equal(pendingOf(), null);
+  // Third request, still the same fill: the latch holds.
+  await h.hook({ ...base, messages: [bigMessage(20000)] });
+  assert.equal(pendingOf(), null);
+});
+
+test("the auto-trim latch clears below its line and a new rise trims again", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-reset-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"autoTrimRatio": 0.4}}');
+  const h = await harness({ limitContext: 10_000, directory: dir });
+  const system: Array<{ type: string; text: string }> = [];
+  const base = { sessionID: "ses-reset", model: { providerID: "test", id: "model-x" }, system };
+  const stateOf = () => h.storage.get("session:ses-reset") as { pending?: unknown; autoTrimLastRatio?: number };
+  await h.hook({ ...base, messages: [bigMessage(20000)] });
+  assert.deepEqual(stateOf().pending, { mode: "trim", keepTurns: 0 });
+  // Fill drops well below the line: the latch is cleared.
+  await h.hook({ ...base, messages: [bigMessage(8000)] });
+  assert.equal(stateOf().autoTrimLastRatio, undefined);
+  // A new rise past the line trims again.
+  await h.hook({ ...base, messages: [bigMessage(22000)] });
+  assert.deepEqual(stateOf().pending, { mode: "trim", keepTurns: 0 });
+});
+
+test("disabling awareness also stops the automatic trim", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-off-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(
+    join(dir, ".opencode", "smart-compact.jsonc"),
+    '{"awareness": {"enabled": false, "autoTrimRatio": 0.4}}',
+  );
+  const h = await harness({ limitContext: 10_000, directory: dir });
+  const system: Array<{ type: string; text: string }> = [];
+  await h.hook({
+    sessionID: "ses-off",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(20000)],
+  });
+  assert.equal((h.storage.get("session:ses-off") as { pending?: unknown } | undefined)?.pending ?? null, null);
+  assert.equal(system.length, 0);
+});
+
 test("a session hovering at the threshold does not re-fire on every request", async () => {
   const h = await harness({ limitContext: 10_000 });
   const system: Array<{ type: string; text: string }> = [];
diff --git a/tests/awareness.test.ts b/tests/awareness.test.ts
index 0e4cb655..f642c964 100644
--- a/tests/awareness.test.ts
+++ b/tests/awareness.test.ts
@@ -1,6 +1,7 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import {
+  autoTrimResetLine,
   buildAwarenessMessage,
   getAwarenessLevel,
   measureVisibleTokens,
@@ -130,15 +131,41 @@ test("buildAwarenessMessage escalates the wording at the emergency level", () =>
   assert.match(text, /emergency context pressure/);
 });
 
-test("shouldAutoTrim schedules a trim only above its own ratio and never over a pending run", () => {
-  assert.equal(shouldAutoTrim(0.4, 0.5, false), false);
-  assert.equal(shouldAutoTrim(0.5, 0.5, false), true);
-  assert.equal(shouldAutoTrim(0.9, 0.5, false), true);
+test("shouldAutoTrim fires on the first crossing and only re-arms after a step", () => {
+  const base = { autoTrimRatio: 0.5, rearmStep: 0.05, hasPending: false };
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.4 }), false);
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.5 }), true);
   // 0 is the shipped default: auto-trim off.
-  assert.equal(shouldAutoTrim(0.99, 0, false), false);
+  assert.equal(shouldAutoTrim({ ...base, autoTrimRatio: 0, ratio: 0.99 }), false);
   // A compaction already queued for the next request wins over a weaker trim.
-  assert.equal(shouldAutoTrim(0.99, 0.5, true), false);
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.99, hasPending: true }), false);
+  // Same fill again: the latch holds, so a sustained period trims once.
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.5, lastRatio: 0.5 }), false);
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.53, lastRatio: 0.5 }), false);
+  // A further step re-arms the trim.
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.55, lastRatio: 0.5 }), true);
+  // A latched ratio at or above the current fill never fires.
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.6, lastRatio: 0.7 }), false);
   // Malformed input never schedules anything.
-  assert.equal(shouldAutoTrim(Number.NaN, 0.5, false), false);
-  assert.equal(shouldAutoTrim(0.99, Number.NaN, false), false);
+  assert.equal(shouldAutoTrim({ ...base, ratio: Number.NaN }), false);
+  assert.equal(shouldAutoTrim({ ...base, autoTrimRatio: Number.NaN, ratio: 0.99 }), false);
+  assert.equal(shouldAutoTrim({ ...base, ratio: 0.99, lastRatio: Number.NaN }), true);
+  // A zero or invalid step cannot re-arm by growth: an unchanged fill would
+  // otherwise re-queue on every request (review R1), so the latch holds.
+  assert.equal(shouldAutoTrim({ ...base, rearmStep: 0, ratio: 0.9, lastRatio: 0.9 }), false);
+  assert.equal(shouldAutoTrim({ ...base, rearmStep: Number.NaN, ratio: 0.9, lastRatio: 0.5 }), false);
+  // The initial crossing still fires, and a reset (cleared latch) still fires.
+  assert.equal(shouldAutoTrim({ ...base, rearmStep: 0, ratio: 0.9 }), true);
+  assert.equal(shouldAutoTrim({ ...base, rearmStep: 0, ratio: 0.9, lastRatio: undefined }), true);
+});
+
+test("autoTrimResetLine never lands at or below zero", () => {
+  assert.equal(autoTrimResetLine(0.5, 0.05), 0.45);
+  // A step at or above the line would subtract to zero or below and the latch
+  // could never clear, so the line itself becomes the reset point.
+  assert.equal(autoTrimResetLine(0.03, 0.05), 0.03);
+  assert.equal(autoTrimResetLine(0.05, 0.05), 0.05);
+  // Disabled or malformed input resets at zero.
+  assert.equal(autoTrimResetLine(0, 0.05), 0);
+  assert.equal(autoTrimResetLine(Number.NaN, 0.05), 0);
 });
```
<!-- END_GIT_DIFF -->
