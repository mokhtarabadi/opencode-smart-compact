# Task 11: Emergency budget must never block compaction

**File:** `tasks/qa/11-budget-guard-deadlock.md`
**Source:** manager (2026-10-13, reported from the dumble overnight session)
**Type:** bug
**Status:** open

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

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 3cfc90de..a57157a3 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -6,6 +6,10 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ## [Unreleased]
 
+### Fixed
+
+- Emergency budget no longer blocks compaction. `checkBudgetGuard` was used as a gate: when a session's measured history exceeded `tokens.emergencyBudgetTokens`, `compactNow` returned without summarizing and the per-request hook returned before the strategies and the prune pass, so the largest sessions silently lost all compaction relief and an explicit `compact_context` / `/magic-compact` request was refused. The predicate is now `isOverEmergencyBudget`, a warning signal only: both callers warn (the hook also notifies) and continue the work. A zero budget still disables the warning.
+
 ### Added
 
 - `compact_context` tool: the agent can compress the session itself (summarize now, schedule pruning) instead of waiting for the Manager to run a slash command. Takes optional `keepTurns` and `mode` (`compact`/`trim`); invalid input returns a friendly message. Shared logic lives in `src/actions.ts` and backs both the tool and the `/magic-compact` / `/magic-trim` commands, so the paths cannot drift.
diff --git a/README.md b/README.md
index 719c097f..f7505717 100644
--- a/README.md
+++ b/README.md
@@ -123,7 +123,7 @@ Defaults are applied automatically; only override what you need.
 }
 ```
 
-`tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. Unknown config keys produce a warning naming the exact key path. When measured cost exceeds `emergencyBudgetTokens` (0 disables), the run aborts and state is left unchanged. `/magic-stats` also reports memo-saved tokens, last-run time, and whether the tokenizer backed the run.
+`tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. Unknown config keys produce a warning naming the exact key path. When measured cost exceeds `emergencyBudgetTokens` (0 disables) the run warns and still compacts: the budget is an early signal that a session is getting large, never a gate, because refusing to compact an over-budget session would deadlock it. `/magic-stats` also reports memo-saved tokens, last-run time, and whether the tokenizer backed the run.
 
 ## Comparison
 
diff --git a/package.json b/package.json
index 591d35a6..f67abba7 100644
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "@mokhtarabadi/opencode-smart-compact",
-  "version": "0.2.0",
+  "version": "0.2.1",
   "description": "Lossless, V2-native context compaction for OpenCode: per-turn summaries, verbatim user messages, retrievable tool-I/O pruning.",
   "type": "module",
   "module": "src/index.ts",
diff --git a/src/actions.ts b/src/actions.ts
index 89f05626..c60c29ba 100644
--- a/src/actions.ts
+++ b/src/actions.ts
@@ -5,7 +5,7 @@
  */
 import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
 import { summarizeTurns } from "./summarize.js";
-import { checkBudgetGuard, loadConfig } from "./config.js";
+import { isOverEmergencyBudget, loadConfig } from "./config.js";
 import { measureTokens } from "./prune.js";
 import { loadState, saveState, type Ctx } from "./store.js";
 
@@ -44,20 +44,23 @@ export function parseCompactArgs(input: unknown): CompactArgs {
  * messages stay verbatim) and schedule the tool-output prune pass for the next
  * request. Returns the number of turns summarized.
  *
- * The emergency budget guard runs before any work: an over-budget history
- * aborts with a warning and the stored state is left unchanged (returns 0,
- * nothing saved). A zero budget disables the guard.
+ * The emergency budget check runs before any work and is a warning only: an
+ * over-budget history still compacts, because refusing it would deadlock the
+ * sessions that need compaction most. A zero budget disables the warning.
  */
 export async function compactNow(ctx: Ctx, sessionID: string, keepTurns: number): Promise<number> {
   const config = await loadConfig(ctx);
   const state = await loadState(ctx, sessionID);
   const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
-  if (checkBudgetGuard(measureHistoryCost(entries, config), config)) {
+  const measuredCost = measureHistoryCost(entries, config);
+  if (isOverEmergencyBudget(measuredCost, config)) {
+    // Warning only: an explicit compaction request must always proceed, because
+    // compaction is the remedy for an over-budget history, not a hazard.
     console.warn(
-      `[smart-compact] compaction aborted: history exceeds the emergency budget of ` +
-        `${config.tokens.emergencyBudgetTokens} tokens. Raise tokens.emergencyBudgetTokens (0 disables) and rerun.`,
+      `[smart-compact] history is over the emergency budget of ` +
+        `${config.tokens.emergencyBudgetTokens} tokens (measured ~${measuredCost}); ` +
+        `compacting anyway. Raise tokens.emergencyBudgetTokens to silence this warning.`,
     );
-    return 0;
   }
   const turns = buildTurns(entries);
   const summarized = await summarizeTurns(
diff --git a/src/config.ts b/src/config.ts
index c02480ce..553bcd07 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -233,11 +233,14 @@ export function validateConfig(raw: unknown): string[] {
 }
 
 /**
- * Whether a compaction run must abort: true when the measured token cost
- * exceeds the configured emergency budget. A budget of 0 disables the
- * guard explicitly, and state is left unchanged on abort.
+ * Whether the measured token cost is over the configured emergency budget.
+ *
+ * This is a WARNING signal, never a gate: an over-budget history is exactly the
+ * history that needs compaction, so refusing to compact it deadlocks the
+ * session. Callers warn (and may notify) and then continue the work they were
+ * asked to do. A budget of 0 disables the warning explicitly.
  */
-export function checkBudgetGuard(measuredTokens: number, config: SmartCompactConfig): boolean {
+export function isOverEmergencyBudget(measuredTokens: number, config: SmartCompactConfig): boolean {
   const budget = config.tokens.emergencyBudgetTokens;
   if (typeof budget !== "number" || budget <= 0) return false;
   return measuredTokens > budget;
diff --git a/src/index.ts b/src/index.ts
index 9a4d14f6..0451f57d 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -14,7 +14,7 @@ import { compactNow, parseCompactArgs, scheduleTrim } from "./actions.js";
 import { applySummaries } from "./apply.js";
 import { applyOmissions, measureTokens, pruneToolResults, serializeResult } from "./prune.js";
 import { applyStrategies } from "./strategies.js";
-import { checkBudgetGuard, loadConfig, type SmartCompactConfig } from "./config.js";
+import { isOverEmergencyBudget, loadConfig, type SmartCompactConfig } from "./config.js";
 import { loadState, saveState, type Ctx } from "./store.js";
 import { isTokenizerAvailable } from "./tokens.js";
 import type { Msg, SessionState } from "./types.js";
@@ -53,18 +53,17 @@ async function runPrune(
 ): Promise<SessionState> {
   const started = Date.now();
   const state = await loadState(ctx, sessionID);
-  // Emergency budget guard runs before any mutation: an over-budget context
-  // aborts with a visible message and the stored state is left unchanged
-  // (no strategies applied, no save). A zero budget disables the guard.
+  // Emergency budget check is a warning only. Skipping the strategies and the
+  // prune pass here would remove the only size relief a large session has, so an
+  // over-budget context still gets pruned and still gets its warning.
   const measured = measureVisibleCost(messages, config);
-  if (checkBudgetGuard(measured, config)) {
+  if (isOverEmergencyBudget(measured, config)) {
     const text =
-      `[smart-compact] compaction aborted: measured ~${measured} tokens exceeds ` +
-      `the emergency budget of ${config.tokens.emergencyBudgetTokens} tokens. ` +
-      `Raise tokens.emergencyBudgetTokens (0 disables) and rerun.`;
+      `[smart-compact] context is over the emergency budget of ` +
+      `${config.tokens.emergencyBudgetTokens} tokens (measured ~${measured}); ` +
+      `pruning anyway. Raise tokens.emergencyBudgetTokens to silence this warning.`;
     console.warn(text);
     await notify(ctx, sessionID, text);
-    return state;
   }
   const strategies = applyStrategies(messages, config);
   const pruned = pruneToolResults(messages, state, config);
diff --git a/tests/config-validation.test.ts b/tests/config-validation.test.ts
index 3341f6aa..29038149 100644
--- a/tests/config-validation.test.ts
+++ b/tests/config-validation.test.ts
@@ -1,7 +1,7 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import {
-  checkBudgetGuard,
+  isOverEmergencyBudget,
   DEFAULT_CONFIG,
   validateConfig,
 } from "../src/config.js";
@@ -23,10 +23,14 @@ test("validateConfig names unknown nested keys with their path", () => {
   assert.ok(warnings.some((w) => w.includes("strategies.stripReasoning.huh")));
 });
 
-test("checkBudgetGuard aborts over budget and stays quiet otherwise", () => {
-  assert.equal(checkBudgetGuard(60000, DEFAULT_CONFIG), true);
-  assert.equal(checkBudgetGuard(100, DEFAULT_CONFIG), false);
-  assert.equal(checkBudgetGuard(999999999, { ...DEFAULT_CONFIG, tokens: { enabled: false, emergencyBudgetTokens: 0 } }), false);
+test("isOverEmergencyBudget flags an over-budget history as a warning only", () => {
+  // True means "warn", never "abort": an over-budget history must still compact.
+  assert.equal(isOverEmergencyBudget(60000, DEFAULT_CONFIG), true);
+  assert.equal(isOverEmergencyBudget(100, DEFAULT_CONFIG), false);
+  assert.equal(
+    isOverEmergencyBudget(999999999, { ...DEFAULT_CONFIG, tokens: { enabled: false, emergencyBudgetTokens: 0 } }),
+    false,
+  );
 });
 
 test("loadConfig merges project config and warns on unknown keys", async () => {
@@ -51,3 +55,25 @@ test("loadConfig merges project config and warns on unknown keys", async () => {
     console.warn = original;
   }
 });
+
+test("budget guard is advisory: no caller early-returns on an over-budget history", async () => {
+  // Regression guard for the deadlock: the budget check must never be followed
+  // by a bare early return, or the largest sessions silently lose all
+  // compaction relief. The full compactNow path needs a ctx harness plus the
+  // model for summarization, so the invariant is pinned at the source seam that
+  // caused the bug.
+  const { readFile } = await import("node:fs/promises");
+  // Tests compile to .test-build/tests, so the repo root is two levels up.
+  for (const file of ["../../src/actions.ts", "../../src/index.ts"]) {
+    const source = await readFile(new URL(file, import.meta.url), "utf8");
+    const checkAt = source.indexOf("isOverEmergencyBudget(");
+    assert.ok(checkAt > -1, `${file} should call the budget predicate`);
+    // The guarded block ends at the next closing brace of the if-statement; an
+    // early return inside it is the bug.
+    const guardedBlock = source.slice(checkAt, source.indexOf("\n  }", checkAt));
+    assert.ok(
+      !/return\s+(0|state)\s*;/.test(guardedBlock),
+      `${file} must warn and continue, not abort, when over budget`,
+    );
+  }
+});
```
<!-- END_GIT_DIFF -->
