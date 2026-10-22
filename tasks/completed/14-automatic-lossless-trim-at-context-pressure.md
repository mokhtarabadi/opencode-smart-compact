# Task 14: Automatic Lossless Trim At Context Pressure

**File:** `tasks/qa/14-automatic-lossless-trim-at-context-pressure.md`
**Source:** manager
**Type:** feature
**Status:** in-progress

## Goal

Give the plugin one automatic action that is safe to run without asking: when a session's
model-visible context crosses a configured fill ratio, queue a tool-output-only trim for the
next request instead of only advising the agent. Summarization stays agent-driven. Alongside
it, audit the machine's live plugin state (thresholds, storage hygiene) so the shipped
defaults and the platform config are both defensible.

## Manager's Notes

- The Manager asked whether the plugin already reminds the agent to compact, and whether it
  is automatic. The audit answer: the reminder is automatic, the compression is not.
- The observed evidence on this machine: four sessions latched the advisory at 0.74-0.78 fill
  and pruned zero tokens, so an advisory alone does not produce action.
- The Manager accepted the recommended set: lower the platform thresholds, add the automatic
  trim, and clean the orphaned per-session state. His words: "بزن" and, for the follow-up,
  "تسکش کن تغییراتمون رو و بعدش ببندش".
- The Manager forwarded the plugin decision explicitly: this work is for the agent that runs
  under context pressure, so the trim is preferred over automatic summarization.

## Local TODOs

- [x] Confirm the installed plugin version against the local repository and the remote branch.
- [x] Measure the real behaviour of the awareness layer from persisted per-session state.
- [x] Add `awareness.autoTrimRatio` to the config section (default, merge, validation, keys).
- [x] Add the pure `shouldAutoTrim` decision and wire it into the context hook.
- [x] Unit-test the decision, the config range, and the hook wiring.
- [x] Isolate the test suite from the developer's real global config file.
- [x] Sync `README.md`, `docs/AGENT-TOOLS.md`, `src/DECISIONS.md`, `CHANGELOG.md`.
- [x] Lower the platform thresholds and set the new key in the global config file.
- [x] Remove the orphaned per-session plugin state rows.

## Acceptance Criteria

- [x] At or above `awareness.autoTrimRatio`, the context hook queues a trim for the next
      request by itself, without summarizing a turn and without a user message.
- [x] A compaction already pending is never overwritten by the automatic trim.
- [x] `autoTrimRatio` defaults to `0` (off), so existing installs keep the purely advisory
      behaviour until they opt in.
- [x] The config section validates the new key: `0` plus the open `(0, 1)` range only, with a
      named warning for anything else, and no unknown-key warning for the supported key.
- [x] The test suite is independent of a developer's real `~/.config/opencode` files.
- [x] `npm run typecheck` and `npm test` exit 0, and `lint_task_file` passes on this file.

## Verification Evidence

- **Test command:** `rtk test npm test`
- **Expected result:** the whole node:test suite green, exit 0
- **Actual result:** exit 0, `tests 91 / pass 91 / fail 0` (three new cases: the
  `shouldAutoTrim` matrix, the hook-level auto-trim wiring, the auto-trim-off default, plus
  the `autoTrimRatio` range check in the config suite).
- **Test command:** `rtk test npm run typecheck`
- **Expected result:** `tsc --noEmit` clean
- **Actual result:** exit 0, no diagnostics.
- **Exit code:** 0

> Verification runner rule: the first run of each verification used the `rtk test` prefix. A
> raw rerun was used once, only after a failing RTK run, to read the failing assertion detail.

**Stack skill selection:** root `.`; markers scanned `package.json`, `tsconfig.json`,
`src/index.ts`; matched skills: none; reason: no stack marker found — plain TypeScript OpenCode
V2 plugin, no web or mobile framework markers. Closest discipline reused:
`verification-before-completion` plus the `opencode` skill for the plugin hook contract.

**Sibling doc sync:** `src/DECISIONS.md` gained D7 (auto-trim is the only automatic action),
`README.md` gained the `autoTrimRatio` key plus the corrected comparison paragraph,
`docs/AGENT-TOOLS.md` gained the agent-facing paragraph, and `CHANGELOG.md` gained one entry
under `Unreleased` → `Added`. `src/README.md` needed no change: the module map already lists
`awareness.ts` and the hook owner did not change.

## Definition of Done

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

## Risk & Rollback

- **Risk:** the automatic trim could prune a tool result the agent is about to reuse, costing
  one `read_omitted_content` round-trip or a re-run of the source tool.
- **Mitigation:** only completed tool results over the configured size are eligible, pending or
  errored calls are never pruned, `question` output is protected, user messages and recent
  turns are preserved, and every pruned original is cached under a Content ID.
- **Rollback plan:** set `awareness.autoTrimRatio` to `0` in the config, or revert the
  `shouldAutoTrim` block in `src/index.ts`; both are single-key, single-block reverts.

---

## Execution Log & Reasoning

### What was built

One automatic action at context pressure: `shouldAutoTrim(ratio, autoTrimRatio, hasPending)`
decides when the hook may schedule `pending = { mode: "trim", keepTurns: 0 }` on its own. The
existing prune pass applies it on the next request, so the code path is the same one a manual
`compact_context` trim uses and cannot drift from it.

### Assumptions

- **A1 — pressure trigger, not task boundary.** The Manager's phrasing was "trim at the start
  of a task". The plugin only ever sees model-visible messages: it has no access to the Brain
  task id, the Kanban file, or a session boundary, so detecting a task start would mean
  heuristic matching on message text. Rejected in favour of the measured pressure ratio, which
  is deterministic and correlates with the moment relief is actually needed. Recorded in D7.
- **A2 — defaults unchanged.** `autoTrimRatio` ships as `0` in `DEFAULT_CONFIG`; the platform
  opts in through its global config file. Changing a shipped default would silently alter the
  behaviour of every existing install, which the task did not authorize.
- **A3 — thresholds are platform config, not defaults.** `warnRatio 0.5` and
  `emergencyRatio 0.8` were applied to `~/.config/opencode/smart-compact.jsonc` only. The
  shipped defaults stay `0.7` / `0.9`.

### Findings from the audit that shaped the work

- The installed plugin is the repository head: cache commit `fa02c759` equals both local `HEAD`
  and `origin/main`, version `0.2.1`.
- Awareness had fired four times on this machine (ratios 0.7413-0.7768, all `warn`) and every
  one of those sessions pruned zero tokens and summarized zero turns. That is the evidence
  that the advisory does not produce action by itself.
- The four warning sessions are ephemeral: they hold no rows in `session`, `session_v2`, or
  `session_message`, but their plugin state rows survived. They were removed after backing them
  up to `/tmp/sc-orphan-states-backup.json`.
- Correction to an earlier claim in this session: those orphans were each under 10 KB, so the
  25.2 MB of plugin storage is cached omission originals for live sessions, not orphan bloat.
  Per-session omission storage has no cap; that is a separate, unstarted piece of work.

### Test isolation bug found and fixed

`loadConfig` resolves the global file through `XDG_CONFIG_HOME` or `$HOME/.config`. The suite
never isolated that path, so once the platform config file existed with real values, four tests
failed against the developer's machine rather than against the code. Both affected files now
point `XDG_CONFIG_HOME` at an empty temporary directory before any config read. The suite is
green with the platform config in place, which is the arrangement that actually ships.

### Files

- `src/config.ts` — `autoTrimRatio` on `AwarenessConfig`, default `0`, merge with an explicit
  `0` branch, range validation, known-key entry.
- `src/awareness.ts` — pure `shouldAutoTrim`.
- `src/index.ts` — the auto-trim block in `runAwareness`, after the state load and before the
  advisory branches, with one log line when it queues.
- `tests/awareness.test.ts`, `tests/awareness-hook.test.ts`, `tests/config-validation.test.ts`
  — decision matrix, hook wiring, off-by-default, range check, and XDG isolation.
- `README.md`, `docs/AGENT-TOOLS.md`, `src/DECISIONS.md`, `CHANGELOG.md` — docs sync.

### Local TODO checks

- [x] Installed version matched against repository and remote.
- [x] Live behaviour measured from persisted state rather than assumed.
- [x] Config key added, merged, validated, and documented.
- [x] Decision and hook wiring covered by tests.
- [x] Platform thresholds applied and verified with the real `loadConfig` on the real path.
- [x] Orphaned state removed with a backup taken first.

### Closure

Manager instruction (verbatim): "تسکش کن تغییراتمون رو و بعدش ببندش"

Closure performed via `git mv` to `tasks/completed/` and
`custom_context_commit_and_clean_task`. No source changes in closure.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 38efe448..ee8a26e4 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -14,6 +14,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ### Added
 
+- Automatic lossless trim (`awareness.autoTrimRatio`, default `0` = off): at or above that fill of the context window the context hook queues a tool-output-only trim for the next request instead of only advising. Nothing is summarized, no user message is touched, a compaction already queued is never overwritten, and every pruned original stays retrievable through `read_omitted_content`. Summarization stays agent-driven (`src/awareness.ts:shouldAutoTrim`, `src/index.ts:runAwareness`).
 - Context-pressure awareness (`src/awareness.ts` plus the `awareness` config section): when the model-visible context of a session crosses a fraction of the model's context window, the agent receives one advisory reminder on the next model call stating the current fill percentage and the token numbers behind it, naming the `compact_context` tool to call, and telling it to re-orient on the project before compacting. Advisory only: the plugin never compacts on its own, never aborts a step, and never mutates persisted history. Defaults `enabled true`, `warnRatio 0.7`, `emergencyRatio 0.9`, `rearmStep 0.05`; fires once per crossing and re-arms only after the fill grows by a further step.
 - Agent guide `docs/AGENT-TOOLS.md`: copy-paste English doc for OpenCode agents covering capabilities plus `compact_context` and `read_omitted_content` call schemas.
 - Living folder docs `src/README.md` plus `src/DECISIONS.md`: module map plus D1-D5 architectural decisions.
diff --git a/README.md b/README.md
index 1168546e..79585ca9 100644
--- a/README.md
+++ b/README.md
@@ -125,18 +125,21 @@ Copy this recommended file to `~/.config/opencode/smart-compact.jsonc` for the b
     "enabled": true,
     "warnRatio": 0.7,
     "emergencyRatio": 0.9,
-    "rearmStep": 0.05
+    "rearmStep": 0.05,
+    "autoTrimRatio": 0
   }
 }
 ```
 
 `tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. Unknown config keys produce a warning naming the exact key path. When measured cost exceeds `emergencyBudgetTokens` (0 disables) the run warns and still compacts: the budget is an early signal that a session is getting large, never a gate, because refusing to compact an over-budget session would deadlock it. `/magic-stats` also reports memo-saved tokens, last-run time, and whether the tokenizer backed the run.
 
-`awareness` is the context-pressure reminder. When the model-visible context of a session crosses `warnRatio` of the model's context window, the agent gets one advisory note on the next model call stating the current fill percentage and the token numbers behind it, naming the `compact_context` tool to call, and telling it to re-orient on the project before compacting. It is advisory only: the plugin never compacts on its own, never aborts a step, and never mutates stored history. It fires once per crossing, and re-arms only after the fill grows by `rearmStep`. The measured percentage is a lower bound, because provider system prompts and tool schemas are invisible to the plugin. Set `awareness.enabled` to `false` to silence it.
+`awareness` is the context-pressure reminder. When the model-visible context of a session crosses `warnRatio` of the model's context window, the agent gets one advisory note on the next model call stating the current fill percentage and the token numbers behind it, naming the `compact_context` tool to call, and telling it to re-orient on the project before compacting. It is advisory only: the plugin never summarizes on its own, never aborts a step, and never mutates stored history. It fires once per crossing, and re-arms only after the fill grows by `rearmStep`. The measured percentage is a lower bound, because provider system prompts and tool schemas are invisible to the plugin. Set `awareness.enabled` to `false` to silence it.
+
+`awareness.autoTrimRatio` is the one automatic action, and it is lossless: at or above that fill the plugin queues a tool-output-only trim for the next request, so bulky completed tool results become notices while their originals stay cached under a Content ID. No turn is summarized, no user message is touched, and a compaction already queued is never overwritten. `0` (the default) disables it; a 1M-token window rarely needs it before the advisory fires, while a 200K window benefits from setting it near `warnRatio`.
 
 ## Comparison
 
-Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and never compresses on its own without being asked. The trade-off is that compaction is agent-driven rather than automatic — the context-pressure reminder only tells the agent how full the window is and what to call; the agent (or you) still decides when to compact.
+Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and never summarizes a turn without being asked. The trade-off is that compaction is agent-driven rather than automatic — the context-pressure reminder only tells the agent how full the window is and what to call; the agent (or you) still decides when to summarize. Tool-output trimming is the exception: with `awareness.autoTrimRatio` set it runs on its own at that fill, and it is lossless because every pruned original stays cached.
 
 ## Development
 
diff --git a/docs/AGENT-TOOLS.md b/docs/AGENT-TOOLS.md
index 8b9765ab..aca5d42a 100644
--- a/docs/AGENT-TOOLS.md
+++ b/docs/AGENT-TOOLS.md
@@ -100,7 +100,7 @@ Returns: cached original text, possibly stale. If missing: `"No omitted content
     "stripReasoning": { "enabled": true, "thresholdChars": 500 }
   },
   "tokens": { "enabled": true, "emergencyBudgetTokens": 50000 },
-  "awareness": { "enabled": true, "warnRatio": 0.7, "emergencyRatio": 0.9, "rearmStep": 0.05 }
+  "awareness": { "enabled": true, "warnRatio": 0.7, "emergencyRatio": 0.9, "rearmStep": 0.05, "autoTrimRatio": 0 }
 }
 ```
 5. Human tools are out of scope. Only the two tools above are agent-callable. Ignore file-system, shell, or Manager UI tools.
@@ -130,3 +130,5 @@ What it means and what to do:
 - Your user messages are never summarized, and pruned tool output stays retrievable via `read_omitted_content` by Content ID.
 
 It fires once per crossing, not on every request, and re-arms only after the fill grows by a further step. Configure it under `awareness` in the config file (`enabled`, `warnRatio`, `emergencyRatio`, `rearmStep`); set `enabled: false` to silence it.
+
+`awareness.autoTrimRatio` is the only automatic action: at or above that fill the plugin queues a tool-output-only trim for the next request by itself. It never summarizes a turn and never touches a user message, so nothing you need to reason about is lost, and every pruned original stays available through `read_omitted_content`. `0` disables it.
diff --git a/src/DECISIONS.md b/src/DECISIONS.md
index 8426f260..04925e65 100644
--- a/src/DECISIONS.md
+++ b/src/DECISIONS.md
@@ -23,3 +23,9 @@ V1 mutated transcript. V2 transforms model-visible messages per request. First a
 ## D6 Context-pressure awareness is advisory (2026-10-21)
 
 The agent is told how full the context window is and how to reclaim room, but the plugin never compacts on its own, never aborts a step, and never mutates persisted history. The reminder rides on the outgoing model call as one system part (`event.system.push`), so it reaches the agent on the next request without adding a turn or growing the transcript. Warning ratios mirror the budget meter (0.7 / 0.9); a per-session latch makes it fire once per crossing and re-arm only after the fill grows by `rearmStep`. The measured ratio is a lower bound: provider system prompts and tool schemas are invisible to the plugin. See `src/awareness.ts` and `src/index.ts:runAwareness`.
+
+## D7 Auto-trim is the only automatic action (2026-10-22)
+
+Context pressure alone may now trigger one action: at `awareness.autoTrimRatio` the hook queues `pending = { mode: "trim", keepTurns: 0 }` for the next request, reusing the same prune pass a manual trim uses. Trimming is the safe half of compaction - no turn is summarized, no user message is touched, and every pruned original is cached under a Content ID - so running it without asking cannot lose the thread of a task. Summarization stays explicit because it replaces turns with summaries and the agent's own reasoning about which detail matters is the only thing that can decide that safely. A pending compaction is never overwritten, and `0` (the shipped default) keeps the plugin purely advisory, so existing installs see no behavior change until they opt in.
+
+The alternative considered was detecting the task boundary (Brain task id, first user message of a task) and trimming there. It was rejected: the plugin only sees model-visible messages, a heuristic on message text is fragile, and the pressure signal already correlates with the moment relief is needed. See `src/awareness.ts:shouldAutoTrim` and `src/index.ts:runAwareness`.
diff --git a/src/awareness.ts b/src/awareness.ts
index fd26cb60..47ef9e7d 100644
--- a/src/awareness.ts
+++ b/src/awareness.ts
@@ -134,6 +134,25 @@ export function shouldFireAwareness(
   return ratio >= last + rearmStep;
 }
 
+/**
+ * Whether the pressure is high enough to schedule a lossless tool-output trim.
+ *
+ * Trimming only replaces bulky completed tool results with a notice whose
+ * original stays cached, so it is always safe to run without asking the agent:
+ * nothing is summarized, no user message is touched, and no step is aborted.
+ * A compaction already waiting to apply wins, so the pending request is never
+ * overwritten by a weaker one.
+ */
+export function shouldAutoTrim(
+  ratio: number,
+  autoTrimRatio: number,
+  hasPending: boolean,
+): boolean {
+  if (!Number.isFinite(ratio) || !Number.isFinite(autoTrimRatio) || autoTrimRatio <= 0) return false;
+  if (hasPending) return false;
+  return ratio >= autoTrimRatio;
+}
+
 /**
  * The professional reminder addressed to the agent.
  *
diff --git a/src/config.ts b/src/config.ts
index 3c6f5b6c..d4597ff8 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -53,6 +53,12 @@ export interface AwarenessConfig {
   emergencyRatio: number;
   /** How much the fill must grow before the reminder re-arms. */
   rearmStep: number;
+  /**
+   * Fill ratio that schedules a lossless tool-output trim for the next request.
+   * 0 disables it. Trimming never summarizes a turn, so the only thing it can
+   * cost is a cache round-trip through `read_omitted_content`.
+   */
+  autoTrimRatio: number;
 }
 
 export interface SmartCompactConfig {
@@ -86,7 +92,7 @@ export const DEFAULT_CONFIG: SmartCompactConfig = {
     stripReasoning: { enabled: true, thresholdChars: 500 },
   },
   tokens: { enabled: false, emergencyBudgetTokens: 50000 },
-  awareness: { enabled: true, warnRatio: 0.7, emergencyRatio: 0.9, rearmStep: 0.05 },
+  awareness: { enabled: true, warnRatio: 0.7, emergencyRatio: 0.9, rearmStep: 0.05, autoTrimRatio: 0 },
 };
 
 /** Strip JSONC comments and trailing commas. Best-effort; never throws. */
@@ -155,11 +161,24 @@ function mergeAwareness(base: AwarenessConfig, patch: unknown): AwarenessConfig
     ? record.emergencyRatio
     : base.emergencyRatio;
   const rearmStep = isValidRearmStep(record.rearmStep) ? record.rearmStep : base.rearmStep;
+  // 0 is a valid value here: it means "never auto-trim", the shipped default.
+  const autoTrimRatio =
+    record.autoTrimRatio === 0
+      ? 0
+      : isValidRatio(record.autoTrimRatio)
+        ? record.autoTrimRatio
+        : base.autoTrimRatio;
   // Ordering guard: the warn threshold must stay below the emergency one.
   if (warnRatio >= emergencyRatio) {
-    return { enabled, warnRatio: base.warnRatio, emergencyRatio: base.emergencyRatio, rearmStep };
+    return {
+      enabled,
+      warnRatio: base.warnRatio,
+      emergencyRatio: base.emergencyRatio,
+      rearmStep,
+      autoTrimRatio,
+    };
   }
-  return { enabled, warnRatio, emergencyRatio, rearmStep };
+  return { enabled, warnRatio, emergencyRatio, rearmStep, autoTrimRatio };
 }
 
 function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConfig {
@@ -246,7 +265,7 @@ const KNOWN_KEYS: Record<string, readonly string[]> = {
   "strategies.purgeErrors": ["enabled", "turns", "protectedTools"],
   "strategies.stripReasoning": ["enabled", "thresholdChars"],
   tokens: ["enabled", "emergencyBudgetTokens"],
-  awareness: ["enabled", "warnRatio", "emergencyRatio", "rearmStep"],
+  awareness: ["enabled", "warnRatio", "emergencyRatio", "rearmStep", "autoTrimRatio"],
 };
 
 /** Collect one warning per unknown key, naming its exact dotted path. */
@@ -317,6 +336,12 @@ export function validateAwareness(raw: unknown): string[] {
       "Invalid config value: awareness.rearmStep must be a number greater than 0 and less than 0.5",
     );
   }
+  const autoTrimRatio = record.autoTrimRatio;
+  if (autoTrimRatio !== undefined && autoTrimRatio !== 0 && !isValidRatio(autoTrimRatio)) {
+    warnings.push(
+      "Invalid config value: awareness.autoTrimRatio must be 0 or a number greater than 0 and less than 1",
+    );
+  }
   if (isValidRatio(warnRatio) && isValidRatio(emergencyRatio) && warnRatio >= emergencyRatio) {
     warnings.push(
       "Invalid config value: awareness.warnRatio must be less than awareness.emergencyRatio",
diff --git a/src/index.ts b/src/index.ts
index 43bb7c5e..d50f1635 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -17,6 +17,7 @@ import {
   getAwarenessLevel,
   measureVisibleTokens,
   resolveContextLimit,
+  shouldAutoTrim,
   shouldFireAwareness,
   type AwarenessModel,
 } from "./awareness.js";
@@ -163,6 +164,17 @@ async function runAwareness(
     const usedTokens = measureVisibleTokens(messages);
     const ratio = usedTokens / limitTokens;
     const state = await loadState(ctx, sessionID);
+    // Lossless relief below the advisory threshold: schedule the tool-output
+    // prune pass for the next request. Nothing is summarized and no user
+    // message is touched, so this is safe to do without asking the agent.
+    if (shouldAutoTrim(ratio, awareness.autoTrimRatio, state.pending !== null)) {
+      state.pending = { mode: "trim", keepTurns: 0 };
+      await saveState(ctx, sessionID, state);
+      console.log(
+        `[smart-compact] ${Math.round(ratio * 100)}% of the window is in use; ` +
+          `tool output will be trimmed on the next request.`,
+      );
+    }
     // Hysteresis: the latch is cleared only once the context has fallen
     // meaningfully below the warn threshold. Clearing it on every small dip
     // under the threshold would let a session hovering at the boundary re-fire
diff --git a/tests/awareness-hook.test.ts b/tests/awareness-hook.test.ts
index 206910da..a5bd8653 100644
--- a/tests/awareness-hook.test.ts
+++ b/tests/awareness-hook.test.ts
@@ -1,8 +1,15 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
+import { mkdtempSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
 import plugin from "../src/index.js";
 import type { Msg } from "../src/types.js";
 
+// The hook resolves the global config from XDG_CONFIG_HOME: point it at an
+// empty directory so the developer's real global file cannot change results.
+process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "smart-compact-xdg-"));
+
 /**
  * One assistant turn of `chars` characters. The plugin estimates about four
  * characters per token, so 32000 characters is roughly 8000 tokens, which is
@@ -200,6 +207,39 @@ test("the kill switch silences the reminder entirely", async () => {
   assert.equal(system.length, 0);
 });
 
+test("autoTrimRatio queues a lossless trim below the advisory threshold", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"autoTrimRatio": 0.4}}');
+  const h = await harness({ limitContext: 10_000, directory: dir });
+  const system: Array<{ type: string; text: string }> = [];
+  const base = { sessionID: "ses-auto", model: { providerID: "test", id: "model-x" }, system };
+  // 25 percent: below the auto-trim line, nothing is queued.
+  await h.hook({ ...base, messages: [bigMessage(10000)] });
+  assert.equal((h.storage.get("session:ses-auto") as { pending?: unknown } | undefined)?.pending ?? null, null);
+  // 50 percent: above the line but below warnRatio, so a trim is queued silently.
+  await h.hook({ ...base, messages: [bigMessage(20000)] });
+  const state = h.storage.get("session:ses-auto") as { pending?: unknown };
+  assert.deepEqual(state.pending, { mode: "trim", keepTurns: 0 });
+  // Trimming is lossless, so no advisory is posted at this fill.
+  assert.equal(system.length, 0);
+});
+
+test("autoTrimRatio stays off by default", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  await h.hook({
+    sessionID: "ses-default",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(20000)],
+  });
+  assert.equal((h.storage.get("session:ses-default") as { pending?: unknown } | undefined)?.pending ?? null, null);
+});
+
 test("a session hovering at the threshold does not re-fire on every request", async () => {
   const h = await harness({ limitContext: 10_000 });
   const system: Array<{ type: string; text: string }> = [];
diff --git a/tests/awareness.test.ts b/tests/awareness.test.ts
index 18c70df0..0e4cb655 100644
--- a/tests/awareness.test.ts
+++ b/tests/awareness.test.ts
@@ -5,6 +5,7 @@ import {
   getAwarenessLevel,
   measureVisibleTokens,
   resolveContextLimit,
+  shouldAutoTrim,
   shouldFireAwareness,
 } from "../src/awareness.js";
 import type { Msg } from "../src/types.js";
@@ -128,3 +129,16 @@ test("buildAwarenessMessage escalates the wording at the emergency level", () =>
   assert.match(text, /95%/);
   assert.match(text, /emergency context pressure/);
 });
+
+test("shouldAutoTrim schedules a trim only above its own ratio and never over a pending run", () => {
+  assert.equal(shouldAutoTrim(0.4, 0.5, false), false);
+  assert.equal(shouldAutoTrim(0.5, 0.5, false), true);
+  assert.equal(shouldAutoTrim(0.9, 0.5, false), true);
+  // 0 is the shipped default: auto-trim off.
+  assert.equal(shouldAutoTrim(0.99, 0, false), false);
+  // A compaction already queued for the next request wins over a weaker trim.
+  assert.equal(shouldAutoTrim(0.99, 0.5, true), false);
+  // Malformed input never schedules anything.
+  assert.equal(shouldAutoTrim(Number.NaN, 0.5, false), false);
+  assert.equal(shouldAutoTrim(0.99, Number.NaN, false), false);
+});
diff --git a/tests/config-validation.test.ts b/tests/config-validation.test.ts
index 7fdaf599..a96f8795 100644
--- a/tests/config-validation.test.ts
+++ b/tests/config-validation.test.ts
@@ -1,11 +1,19 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
+import { mkdtempSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
 import {
   isOverEmergencyBudget,
   DEFAULT_CONFIG,
   validateConfig,
 } from "../src/config.js";
 
+// Isolate the suite from the developer's real global config, so a machine that
+// configures `~/.config/opencode/smart-compact.jsonc` cannot change the
+// assertions below.
+process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "smart-compact-xdg-"));
+
 test("validateConfig accepts known keys without warnings", () => {
   assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
   assert.deepEqual(validateConfig({}), []);
@@ -62,6 +70,7 @@ test("awareness defaults are on with the approved thresholds", () => {
     warnRatio: 0.7,
     emergencyRatio: 0.9,
     rearmStep: 0.05,
+    autoTrimRatio: 0,
   });
   assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
 });
@@ -75,6 +84,11 @@ test("validateConfig names unknown awareness keys and rejects out-of-range value
   assert.ok(badStep.some((w) => w.includes("awareness.rearmStep")));
   const inverted = validateConfig({ awareness: { warnRatio: 0.95, emergencyRatio: 0.9 } });
   assert.ok(inverted.some((w) => w.includes("awareness.warnRatio")));
+  // autoTrimRatio accepts 0 (off) plus the open (0, 1) range, nothing else.
+  assert.deepEqual(validateConfig({ awareness: { autoTrimRatio: 0 } }), []);
+  assert.deepEqual(validateConfig({ awareness: { autoTrimRatio: 0.5 } }), []);
+  const badAutoTrim = validateConfig({ awareness: { autoTrimRatio: 1 } });
+  assert.ok(badAutoTrim.some((w) => w.includes("awareness.autoTrimRatio")));
 });
 
 test("loadConfig overrides one awareness key and keeps its siblings", async () => {
```
<!-- END_GIT_DIFF -->
