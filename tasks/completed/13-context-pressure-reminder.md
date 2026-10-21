# Task 13: Context Pressure Reminder For Agent Awareness

**File:** `tasks/qa/13-context-pressure-reminder.md`
**Source:** manager
**Type:** feature
**Status:** open

## Goal

Add a context-pressure awareness layer to the plugin: when a session's model-visible
context crosses a configured fill ratio of the model's context window, the plugin
informs the agent that the context is filling, states the current fill percentage,
and tells it exactly what to do (compact the session with the plugin's own
`compact_context` tool) instead of letting the agent forget until the Manager has to
run `/magic-compact` by hand.

## Manager's Notes

- The Manager's observed failure mode: the agent keeps working, forgets that the
  context window is filling, and the Manager ends up calling `/magic-compact` manually.
- The reminder must be a professional, complete message addressed to the AI agent, not
  a bare log line. It must include: the current fill percentage, the measured/limit
  token numbers, what to do, and how to do it.
- The message must explicitly instruct the agent to look the tool up in its own tool
  list (search for `compact_context`, or the `/magic-compact` command as the manual
  equivalent) and to re-orient on the project before compacting, so the compaction
  does not lose the thread of what the Manager asked for.
- The reminder must be advisory only: it must never auto-compact and must never
  interrupt a critical step. The agent decides.
- It must tell the agent the current context window status (how full it is now), so
  the agent can act on a concrete number instead of a vague warning.
- When the work in flight is not critical and the session can be compacted, the agent
  must compact — sessions and turns must not silently overflow.
- Separate concern from the existing budget meter: the meter is display-only; this is
  an agent-facing nudge.

## Local TODOs

- [x] Read the OpenCode v2 plugin API surface (`ctx.session.hook("context")` event
      shape, `ctx.session.synthetic`, `ctx.model.list()` limit lookup).
- [x] Decide the delivery channel for the reminder (hook-injected system part vs
      synthetic session message) and record the decision.
- [x] Add the `awareness` config section (defaults, merge, validation, unknown-key
      warnings) in `config.ts`.
- [x] Add the awareness module: measure visible context cost, resolve the model's
      context limit, build the professional reminder text, decide when to fire.
- [x] Wire the awareness pass into the `context` hook in `index.ts`.
- [x] Extend the per-session state with the awareness bookkeeping (last fired ratio,
      last fired level).
- [x] Write unit tests for measurement, threshold decision, and message content.
- [x] Update `src/README.md`, `docs/AGENT-TOOLS.md`, and `CHANGELOG.md`.
- [x] Verify: typecheck + test suite exit 0, task lint passes.

## Acceptance Criteria

- [x] When the model-visible context of a session crosses the configured warning
      ratio of the model's context window, the agent receives a message that states
      the current fill percentage and the token numbers behind it.
- [x] The message tells the agent to call the plugin's `compact_context` tool, how to
      find it (search the tool list; `/magic-compact` is the manual equivalent), and
      to re-orient on the project (read `AGENTS.md` and the active task file) before
      compacting so the thread of the request is preserved.
- [x] The message states that compaction is advisory and must be skipped when the
      agent is mid-critical-step, and that user messages are never summarized while
      pruned tool output stays retrievable via `read_omitted_content`.
- [x] The reminder fires once per threshold crossing, never on every request, and
      re-arms only after the fill ratio rises by the configured step.
- [x] Nothing is auto-compacted and no request is aborted by the awareness pass.
- [x] The feature is off by default or explicitly configurable, and the config
      section is documented in the README and validated like every other section.
- [x] `npm run typecheck` and `npm test` exit 0, and `lint_task_file` passes on this
      task file.

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck clean and the whole node:test suite green, exit 0
- **Actual result:** `npx tsc --noEmit` exited 0. `rtk test npm test` exited 0 with
  `tests 88 / pass 88 / fail 0` (up from 68 before this work: 11 awareness unit
  tests, 10 hook-level integration tests, 4 config tests). The hook
  integration test drives the real plugin setup against a stub context and
  asserts that exactly one system part is pushed at 80 percent fill, that a
  repeat at the same fill pushes nothing, that the latch re-arms only after the
  configured step, that a drop below the threshold clears the latch, that a
  session hovering at the boundary does not re-fire, that an emergency fill
  escalates the wording, that a downgrade back to warn stays quiet, and that an
  unknown model, a bare-array registry, a failing registry, and the disabled
  kill switch all produce no reminder. The stub context throws if the
  awareness pass calls `session.compact`, `session.prompt`, or
  `session.synthetic`, so the advisory-only guarantee is enforced by the test
  rather than by comment.
- **Exit code:** 0

> Verification runner rule: `[exact command]` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

**Stack skill selection:** root `.`; markers scanned `package.json`,
`tsconfig.json`, `src/index.ts`; matched skills: none; reason: no stack marker
found — this is a plain TypeScript OpenCode V2 plugin with no web or mobile
framework markers. Closest discipline reused: `verification-before-completion`
(strict gate: typecheck plus test suite plus recorded evidence, no completion
claim without a green exit code).

**Sibling doc sync:** `src/README.md` gained the module line and the awareness
boundary, `src/DECISIONS.md` gained D6, `docs/AGENT-TOOLS.md` gained the
agent-facing section, the root `README.md` gained the config block plus the
corrected comparison paragraph, and `CHANGELOG.md` gained one entry under
`Unreleased` → `Added`.

**Working tree hygiene (separate from the feature):** `node_modules` was
tracked in the index (17,911 paths) while ignored by `.gitignore`, so the tree
showed every dependency as deleted. The index entries were removed with an
index-only `git rm -r --cached node_modules`, leaving the installed tree
untouched and the ignore rule authoritative. `package-lock.json` was refreshed by
the install; it had been stale (unscoped name, version 0.1.0) against
`package.json` (scoped name, version 0.2.1) and is included in the staged set.

## Definition of Done

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** the reminder could fire on every request and flood the transcript, or it
  could interrupt a critical step mid-edit. Mitigation: threshold-crossing dedupe in
  per-session state, advisory-only wording, and no request mutation beyond an added
  system part.
- **Rollback plan:** set `awareness.enabled` to `false` in the config, or remove the
  hook wiring in `src/index.ts`; both are single-file, single-block reverts.

---

## Execution Log & Reasoning

### What was built

Context-pressure awareness. When the model-visible context of a session crosses a
configured fraction of the model's context window, the plugin pushes one advisory
system part onto the outgoing model call. The agent sees the live fill
percentage, the token numbers behind it, the tool to call, and the rules for
calling it safely. The plugin never compacts on its own, never aborts a step,
and never mutates persisted history.

### Why a system part, not a message

The reminder has to reach an agent that is mid-task, and it must not become a
turn of its own. `event.system.push` is documented to affect only the outgoing
model call, so the transcript does not grow, no new turn is admitted, and the
note rides along on every tool-driven continuation. A synthetic message would
create a durable inbox item and risk flooding the transcript. The existing
`notify()` helper stays reserved for Manager-visible notices.

### Files

- `src/awareness.ts` (new) — pure module: `measureVisibleTokens`,
  `resolveContextLimit`, `getAwarenessLevel`, `shouldFireAwareness`,
  `buildAwarenessMessage`. No I/O, no state, no SDK types.
- `src/config.ts` — new `awareness` section (`enabled`, `warnRatio`,
  `emergencyRatio`, `rearmStep`), defaults 0.7 / 0.9 / 0.05, a merge that keeps
  sibling keys on a partial update, unknown-key warnings, and range checks that
  fall back to the defaults instead of breaking the hook.
- `src/types.ts` — `awarenessLastRatio` and `awarenessLastLevel` on the session
  state.
- `src/store.ts` — the state loader is a whitelist, so the two latch fields had
  to be carried through it; without that the latch is dropped on every load and
  the reminder fires on every request.
- `src/index.ts` — `runAwareness` runs last inside the existing `context` hook,
  after pruning and summarization, so it measures exactly what the model is
  about to receive. Wrapped in a try/catch: a warning must never break a model
  call.
- `tests/awareness.test.ts` and `tests/awareness-hook.test.ts` (new) — unit
  tests plus a hook-level integration test that drives the real plugin setup
  against a stub context.
- `tests/config-validation.test.ts` — awareness defaults, partial override,
  unknown key, and out-of-range fallback.
- `src/README.md`, `src/DECISIONS.md` (D6), `docs/AGENT-TOOLS.md`, `README.md`,
  `CHANGELOG.md` — docs sync.

### Deviations from the Brain's implementation sketch, and why

The sketch for `measureVisibleTokens` walked a generic `parts` / `content` /
`text` shape. The real message shape in this repo is `Msg.content: Part[]`, and
the bulk of a session's context lives in tool results under
`part.result.value`. Measuring the sketched shape would have returned roughly
zero for every session, so the ratio would never have crossed a threshold and
the feature would never have fired. The measurement was therefore implemented
against the real type: text parts, reasoning parts, tool results, and tool-call
arguments, reusing the same dependency-free estimate as the prune pass.

The sketch also omitted the state loader, which reconstructs the session state
field by field. Carrying the two latch fields through it was required.

### Assumptions

- The measured ratio is a lower bound: provider system prompts and tool schemas
  are invisible to the plugin. The reminder says so instead of pretending the
  number is exact.
- A model missing from the registry, or one with no positive context limit,
  leaves the plugin silent rather than guessing a window size.
- `awareness.enabled` ships on, matching the plugin's own `enabled` default, so
  the reminder works without configuration. It stays a one-line kill switch.
- The model registry is read once per request through `ctx.model.list()`. The
  plugin already reads its config files on every request, so this stays in line
  with the existing per-request cost, and it avoids a stale cached window size
  when a provider limit changes.

### QA round one

The QA Engineer returned `QA_PASSED` with four issues and three missing tests.
Three of them reproduced and were fixed; one was disputed with evidence.

- Fixed: the hook only ever saw the `{data}` shape of the model registry, so
  the bare-array branch was untested. A case now covers it. The QA note that
  the production path is the bare array is the reverse of what the installed
  SDK shows — `ctx.model.list()` returns `{location, data}` and the bare array
  is what the model editor returns — so that branch is the defensive one, kept
  and now covered rather than dropped.
- Fixed: the kill switch had no test. A case now boots the plugin against a
  project config that disables awareness and asserts that nothing is pushed.
  The kill switch is the documented rollback path, so it earns a test.
- Fixed: a failing model registry now has a case asserting a silent skip and
  no throw.
- Fixed: `serializeResult` returned `undefined` for an undefined value while
  claiming to return a string. The awareness pass guards against it, and the
  helper itself now always returns a string, which also removes a latent
  crash in the prune pass where a tool result without a value was read for
  its length.
- Fixed: a session hovering at the threshold re-fired the reminder on
  alternating requests, because the latch was cleared on every dip under the
  threshold. The latch is now cleared only once the context has fallen
  meaningfully below it, by one re-arm step. A genuinely compacted session
  still falls far enough to re-arm, and a session that merely hovers stays
  quiet.

### QA round two

The QA Engineer returned `QA_PASSED` again, confirmed all five round-one fixes,
and found no new null-dereference, race, or threshold bypass. Two test gaps were
left open for the reviewer and were closed here: the emergency wording is now
covered at the hook level, not only in the unit test, and the behaviour of a
session that drops back from emergency to warn without the fill growing is now
locked by a case — the latch holds and nothing is pushed. A typo in the README
and changelog ("mututes" for "mutates") was corrected.

### Code review

The Code Reviewer returned technical approval with a pending-review notice:
the reminder matches the approved plan and the project rules. The reviewer
confirmed the pure module with no I/O, the single system-part delivery after
prune and apply, the latch with hysteresis, the config merge with range
validation and the tested kill switch, and all eight required points in the
message. Three notes were informational only: the lockfile refresh rides in
this diff, the clear line sits one re-arm step below the warn threshold, and
the state-loader carry was required. No code change was requested.

The file stays in `tasks/qa/` until the Manager gives the explicit closure
word. This entry is the `PO_REVIEW_PENDING` record.

### Autopilot lock

The Manager locked autopilot mode for this task. QA, the fix loop, and the code
review are chained from the Hands against the same task id, with the staged diff
attached to every turn. Closure stays a human gate: it needs the explicit
approval word, and this file will not move to `tasks/completed/` without it.

### Local TODO checks

- [x] API surface confirmed against the installed `@opencode/plugin` type
      declarations, not from memory: the `context` hook event carries `system`,
      `model`, and `messages`; `ctx.model.list()` returns a list under `data`.
- [x] Delivery channel chosen and recorded: one system part, advisory only.
- [x] Config section added with defaults, merge, validation, and warnings.
- [x] Awareness module added as a pure, dependency-free module.
- [x] Hook wired, with the pass running last and failing soft.
- [x] Session state extended, including the loader that persists it.
- [x] Tests written: 9 unit, 4 hook-level integration, 4 config.
- [x] Docs synced across the module map, the decision log, the agent guide, the
      root README, and the changelog.
- [x] Verification run and recorded.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 8ea49cf3..38efe448 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -14,6 +14,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ### Added
 
+- Context-pressure awareness (`src/awareness.ts` plus the `awareness` config section): when the model-visible context of a session crosses a fraction of the model's context window, the agent receives one advisory reminder on the next model call stating the current fill percentage and the token numbers behind it, naming the `compact_context` tool to call, and telling it to re-orient on the project before compacting. Advisory only: the plugin never compacts on its own, never aborts a step, and never mutates persisted history. Defaults `enabled true`, `warnRatio 0.7`, `emergencyRatio 0.9`, `rearmStep 0.05`; fires once per crossing and re-arms only after the fill grows by a further step.
 - Agent guide `docs/AGENT-TOOLS.md`: copy-paste English doc for OpenCode agents covering capabilities plus `compact_context` and `read_omitted_content` call schemas.
 - Living folder docs `src/README.md` plus `src/DECISIONS.md`: module map plus D1-D5 architectural decisions.
 - O1 hybrid budget meter (D1): pure `getBudgetState` plus `BUDGET_WARN_RATIO 0.7` and `BUDGET_EMERGENCY_RATIO 0.9` in `src/config.ts`, `formatBudgetMeter` in `src/actions.ts`, display-only before/after prune logs in `src/index.ts runPrune`. Warn-only, never changes prune behavior.
diff --git a/README.md b/README.md
index f7505717..6e0660ac 100644
--- a/README.md
+++ b/README.md
@@ -119,15 +119,23 @@ Defaults are applied automatically; only override what you need.
     "purgeErrors": { "enabled": true, "turns": 4, "protectedTools": ["question"] },
     "stripReasoning": { "enabled": true, "thresholdChars": 500 }
   },
-  "tokens": { "enabled": false, "emergencyBudgetTokens": 50000 }
+  "tokens": { "enabled": false, "emergencyBudgetTokens": 50000 },
+  "awareness": {
+    "enabled": true,
+    "warnRatio": 0.7,
+    "emergencyRatio": 0.9,
+    "rearmStep": 0.05
+  }
 }
 ```
 
 `tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. Unknown config keys produce a warning naming the exact key path. When measured cost exceeds `emergencyBudgetTokens` (0 disables) the run warns and still compacts: the budget is an early signal that a session is getting large, never a gate, because refusing to compact an over-budget session would deadlock it. `/magic-stats` also reports memo-saved tokens, last-run time, and whether the tokenizer backed the run.
 
+`awareness` is the context-pressure reminder. When the model-visible context of a session crosses `warnRatio` of the model's context window, the agent gets one advisory note on the next model call stating the current fill percentage and the token numbers behind it, naming the `compact_context` tool to call, and telling it to re-orient on the project before compacting. It is advisory only: the plugin never compacts on its own, never aborts a step, and never mutates stored history. It fires once per crossing, and re-arms only after the fill grows by `rearmStep`. The measured percentage is a lower bound, because provider system prompts and tool schemas are invisible to the plugin. Set `awareness.enabled` to `false` to silence it.
+
 ## Comparison
 
-Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and does not inject recurring prompts into every turn. The trade-off is that compaction is user-driven rather than automatic.
+Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and never compresses on its own without being asked. The trade-off is that compaction is agent-driven rather than automatic — the context-pressure reminder only tells the agent how full the window is and what to call; the agent (or you) still decides when to compact.
 
 ## Development
 
@@ -138,7 +146,7 @@ npm test            # compiles src + tests, runs node --test
 npm run verify:package   # validates the npm payload
 ```
 
-Source layout: `src/index.ts` (plugin entry), `plan.ts` (turn planning), `summarize.ts` (per-turn summaries), `apply.ts` (summary application), `prune.ts` (tool-result pruning), `strategies.ts` (deduplication, purge-errors), `config.ts`, `store.ts` (per-session state).
+Source layout: `src/index.ts` (plugin entry), `plan.ts` (turn planning), `summarize.ts` (per-turn summaries), `apply.ts` (summary application), `prune.ts` (tool-result pruning), `strategies.ts` (deduplication, purge-errors), `awareness.ts` (context-pressure reminder), `config.ts`, `store.ts` (per-session state).
 
 ## Releasing
 
diff --git a/docs/AGENT-TOOLS.md b/docs/AGENT-TOOLS.md
index 649b06a9..6da729b0 100644
--- a/docs/AGENT-TOOLS.md
+++ b/docs/AGENT-TOOLS.md
@@ -89,3 +89,22 @@ IF context heavy AND reasoning stale -> compact_context({"mode":"compact"})
 ELSE IF only tool I/O bulky -> compact_context({"mode":"trim"})
 ELSE IF see omitted-XXXX AND need original AND cannot re-run cheaply -> read_omitted_content({"contentId":"omitted-XXXX"})
 ELSE -> do nothing.
+
+## 5. The context-pressure reminder
+
+When the session's context crosses a configured fraction of the model's context window, the plugin pushes one advisory note onto the next model call. It looks like this:
+
+```
+[smart-compact] CONTEXT PRESSURE - 72% of the context window is in use (about 104000 of 145000 measured tokens).
+```
+
+What it means and what to do:
+
+- The percentage is the live fill of the context window, measured from the model-visible messages. It is a lower bound: provider system prompts and tool schemas are invisible to the plugin, so the real usage is higher.
+- Act on it yourself. Search your tool list for `compact_context` and call it. Never ask the Manager to run `/magic-compact` — that command is the Manager-only manual equivalent.
+- Re-orient before compacting: read `AGENTS.md` and the active task file, so the summary keeps the thread of what was asked.
+- If the work in flight is not a critical, hard-to-reverse step, compact now. Sessions and turns must not silently overflow.
+- It is advisory. If you are mid-critical-step, finish the step, then compact right after. Never abort a half-written edit, a running tool call, or a commit sequence to compact.
+- Your user messages are never summarized, and pruned tool output stays retrievable via `read_omitted_content` by Content ID.
+
+It fires once per crossing, not on every request, and re-arms only after the fill grows by a further step. Configure it under `awareness` in the config file (`enabled`, `warnRatio`, `emergencyRatio`, `rearmStep`); set `enabled: false` to silence it.
diff --git a/package-lock.json b/package-lock.json
index be0c7af9..50bc533a 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,16 +1,22 @@
 {
-  "name": "opencode-smart-compact",
-  "version": "0.1.0",
+  "name": "@mokhtarabadi/opencode-smart-compact",
+  "version": "0.2.1",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
-      "name": "opencode-smart-compact",
-      "version": "0.1.0",
+      "name": "@mokhtarabadi/opencode-smart-compact",
+      "version": "0.2.1",
       "license": "MIT",
       "devDependencies": {
         "@opencode/plugin": "2.0.22",
         "typescript": "^5.9.0"
+      },
+      "engines": {
+        "node": ">=20"
+      },
+      "peerDependencies": {
+        "@opencode/plugin": ">=2.0.0"
       }
     },
     "node_modules/@ai-sdk/provider": {
diff --git a/src/DECISIONS.md b/src/DECISIONS.md
index 13f5d0e9..8426f260 100644
--- a/src/DECISIONS.md
+++ b/src/DECISIONS.md
@@ -19,3 +19,7 @@ V1 mutated transcript. V2 transforms model-visible messages per request. First a
 ## D5 Discard vs protect (ongoing)
 
 `question` never pruned. `read` always pruned. `todowrite`/`skill` discarded without cache. `task` higher bar. Pending/errored never pruned.
+
+## D6 Context-pressure awareness is advisory (2026-10-21)
+
+The agent is told how full the context window is and how to reclaim room, but the plugin never compacts on its own, never aborts a step, and never mutates persisted history. The reminder rides on the outgoing model call as one system part (`event.system.push`), so it reaches the agent on the next request without adding a turn or growing the transcript. Warning ratios mirror the budget meter (0.7 / 0.9); a per-session latch makes it fire once per crossing and re-arm only after the fill grows by `rearmStep`. The measured ratio is a lower bound: provider system prompts and tool schemas are invisible to the plugin. See `src/awareness.ts` and `src/index.ts:runAwareness`.
diff --git a/src/README.md b/src/README.md
index e1d448a6..0f6ec852 100644
--- a/src/README.md
+++ b/src/README.md
@@ -4,8 +4,9 @@ Entry `index.ts` wires OpenCode V2 plugin: `session.hook("context")` transform,
 
 ## Modules
 
-- `index.ts` — setup, runPrune, measureVisibleCost, notify. No transcript mutation.
+- `index.ts` — setup, runPrune, measureVisibleCost, notify, runAwareness. No transcript mutation.
 - `actions.ts` — shared `compactNow`, `scheduleTrim`, `parseCompactArgs`, budget/pointer formatters. Single source so tool + commands cannot drift.
+- `awareness.ts` — context-pressure awareness: pure measurement of the model-visible messages, model limit lookup, threshold and latch decision, agent-facing reminder text. No I/O, no state.
 - `plan.ts` — `buildTurns` groups history by user boundary, `selectTurns` excludes recent window.
 - `summarize.ts` — batched `summarizeTurns` via `ctx.generate.text`, `<summary id>` parse, heuristic fallback.
 - `prune.ts` — `pruneToolResults`, `applyOmissions`, memo, rank, truncate caps, discard/protected rules.
@@ -20,3 +21,4 @@ Entry `index.ts` wires OpenCode V2 plugin: `session.hook("context")` transform,
 - Never import adapters in core. Depend on `Ctx` abstraction.
 - Storage keys `session:<id>` only. No cross-session reads.
 - User messages verbatim. Preserve-recent window always kept.
+- Awareness is advisory: it reminds, it never compacts, never aborts a step, never mutates history.
diff --git a/src/awareness.ts b/src/awareness.ts
new file mode 100644
index 00000000..fd26cb60
--- /dev/null
+++ b/src/awareness.ts
@@ -0,0 +1,170 @@
+/**
+ * Context-pressure awareness: pure measurement, threshold selection, and the
+ * agent-facing reminder text.
+ *
+ * This module performs no I/O, holds no state, and imports no SDK types. The
+ * `context` hook in `index.ts` owns delivery (one system part on the outgoing
+ * model call) and persistence (the per-session latch). Keeping the decision
+ * logic pure is what makes the threshold behaviour testable without a running
+ * OpenCode server.
+ *
+ * The measured ratio is a lower bound by construction: the plugin can only see
+ * the model-visible messages. Provider-side system prompts and the tool
+ * schemas are invisible to it, so the real fill is always higher than the
+ * number reported to the agent. The reminder says so explicitly.
+ */
+import { estimateTokens, serializeResult } from "./prune.js";
+import type { Msg, Part } from "./types.js";
+
+/** Severity of the current context pressure. `none` means "stay quiet". */
+export type AwarenessLevel = "none" | "warn" | "emergency";
+
+/** The two levels that produce a reminder. */
+export type AwarenessWarnLevel = "warn" | "emergency";
+
+/** The latch of the previous reminder for one session. */
+export interface AwarenessPrev {
+  /** Fill ratio recorded at the last reminder. */
+  lastRatio?: number;
+  /** Level recorded at the last reminder. */
+  lastLevel?: AwarenessWarnLevel;
+}
+
+/** Minimal structural view of a model entry used for the limit lookup. */
+export interface AwarenessModel {
+  providerID: string;
+  id: string;
+  limit?: { context?: number };
+}
+
+/** Text carried by one model-visible part, or an empty string when it has none. */
+function partText(part: Part): string {
+  if (part.type === "text" || part.type === "reasoning") {
+    return typeof part.text === "string" ? part.text : "";
+  }
+  if (part.type === "tool-result") {
+    const result = part.result as { value?: unknown } | undefined;
+    const text = serializeResult(result?.value);
+    return typeof text === "string" ? text : "";
+  }
+  if (part.type === "tool-call") {
+    const args = part.arguments ?? part.args;
+    return args === undefined ? "" : serializeResult(args);
+  }
+  // Media, compaction markers, and unknown part kinds carry no countable text.
+  return "";
+}
+
+/**
+ * Measured token cost of the model-visible messages.
+ *
+ * Counts every countable part — text, reasoning, tool results, and tool call
+ * arguments — because tool output is normally the bulk of a session's context.
+ * Uses the same dependency-free estimate as the prune pass (about four
+ * characters per token), so the plugin keeps working with no tokenizer
+ * installed and the number stays comparable with the rest of the plugin.
+ */
+export function measureVisibleTokens(messages: Msg[]): number {
+  const chunks: string[] = [];
+  for (const msg of messages ?? []) {
+    if (!msg || !Array.isArray(msg.content)) continue;
+    for (const part of msg.content) {
+      if (!part || typeof part !== "object") continue;
+      const text = partText(part);
+      if (text) chunks.push(text);
+    }
+  }
+  if (chunks.length === 0) return 0;
+  return estimateTokens(chunks.join("\n"));
+}
+
+/**
+ * The context window of the model a session is talking to, looked up by
+ * provider and model id. Returns `undefined` when the model is unknown or
+ * carries no usable positive limit — the caller then stays silent rather than
+ * guessing a window size.
+ */
+export function resolveContextLimit(
+  modelRef: { providerID: string; id: string },
+  models: ReadonlyArray<AwarenessModel>,
+): number | undefined {
+  if (!modelRef || typeof modelRef.providerID !== "string" || typeof modelRef.id !== "string") {
+    return undefined;
+  }
+  const found = (models ?? []).find(
+    (m) => m && m.providerID === modelRef.providerID && m.id === modelRef.id,
+  );
+  const limit = found?.limit?.context;
+  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) return undefined;
+  return Math.floor(limit);
+}
+
+/**
+ * The pressure level for a fill ratio. `emergency` wins over `warn`; a ratio
+ * below the warn threshold is `none` and produces no reminder.
+ */
+export function getAwarenessLevel(
+  ratio: number,
+  cfg: { warnRatio: number; emergencyRatio: number },
+): AwarenessLevel {
+  if (!Number.isFinite(ratio) || ratio < 0) return "none";
+  if (ratio >= cfg.emergencyRatio) return "emergency";
+  if (ratio >= cfg.warnRatio) return "warn";
+  return "none";
+}
+
+/**
+ * Whether a reminder should fire for the current ratio.
+ *
+ * The first crossing always fires. After that, a reminder re-fires only when
+ * the fill grew by at least `rearmStep`, or when the level escalated (warn to
+ * emergency) — an escalation is worth a nudge even below the re-arm step.
+ * A session that compacts drops below the warn threshold, which clears the
+ * latch in the hook, so the next refill warns again.
+ */
+export function shouldFireAwareness(
+  ratio: number,
+  level: AwarenessWarnLevel,
+  prev: AwarenessPrev,
+  rearmStep: number,
+): boolean {
+  if (typeof prev?.lastRatio !== "number") return true;
+  const last = prev.lastRatio;
+  if (typeof prev.lastLevel === "string" && prev.lastLevel !== level && ratio > last) return true;
+  return ratio >= last + rearmStep;
+}
+
+/**
+ * The professional reminder addressed to the agent.
+ *
+ * It states the current fill of the context window with the numbers behind
+ * it, names the exact tool to call and where to find it, tells the agent to
+ * re-orient on the project before compacting so the thread of the request
+ * survives, and keeps the whole thing advisory: the agent decides when it is
+ * safe to compact and no step is ever aborted.
+ */
+export function buildAwarenessMessage(args: {
+  usedTokens: number;
+  limitTokens: number;
+  ratioPct: number;
+  level: AwarenessWarnLevel;
+}): string {
+  const emergency = args.level === "emergency";
+  const status = emergency
+    ? "emergency context pressure - immediate action advised"
+    : "elevated context pressure - plan compaction soon";
+  return [
+    `[smart-compact] CONTEXT PRESSURE - ${args.ratioPct}% of the context window is in use (about ${args.usedTokens} of ${args.limitTokens} measured tokens).`,
+    "",
+    `Status: ${status}. The measured fill is a lower bound: it counts only the model-visible messages, while provider system prompts and tool schemas are invisible to the plugin, so the true usage is higher than this number.`,
+    "",
+    "What to do now:",
+    "1. Search your own tool list for `compact_context` and call it. `/magic-compact` is the Manager-only manual equivalent - never ask the Manager to run a slash command.",
+    "2. Before compacting, re-orient on the project: read AGENTS.md and the active task file, so the summary keeps the thread of what was asked.",
+    "3. If the work in flight is not a critical, hard-to-reverse step, you MUST compact now. Sessions and turns must not silently overflow.",
+    "",
+    "Rules:",
+    "- Advisory only. If you are mid-critical-step, finish that step and compact right after. Never abort a half-written edit, a running tool call, or a commit sequence to compact.",
+    "- User messages are never summarized. Pruned tool output stays retrievable via read_omitted_content by Content ID.",
+  ].join("\n");
+}
diff --git a/src/config.ts b/src/config.ts
index b5429b09..3c6f5b6c 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -38,11 +38,29 @@ export interface TokensConfig {
   emergencyBudgetTokens: number;
 }
 
+/**
+ * Context-pressure awareness: when the model-visible context crosses a
+ * fraction of the model's context window, the agent is told how full the
+ * window is and what to do about it. Advisory only - the plugin never
+ * compacts on its own and never aborts a step.
+ */
+export interface AwarenessConfig {
+  /** Master switch for the context-pressure reminder. */
+  enabled: boolean;
+  /** Fill ratio of the context window that raises the first reminder. */
+  warnRatio: number;
+  /** Fill ratio that raises the escalated reminder. */
+  emergencyRatio: number;
+  /** How much the fill must grow before the reminder re-arms. */
+  rearmStep: number;
+}
+
 export interface SmartCompactConfig {
   enabled: boolean;
   pruning: PruningConfig;
   strategies: StrategiesConfig;
   tokens: TokensConfig;
+  awareness: AwarenessConfig;
 }
 
 export const DEFAULT_CONFIG: SmartCompactConfig = {
@@ -68,6 +86,7 @@ export const DEFAULT_CONFIG: SmartCompactConfig = {
     stripReasoning: { enabled: true, thresholdChars: 500 },
   },
   tokens: { enabled: false, emergencyBudgetTokens: 50000 },
+  awareness: { enabled: true, warnRatio: 0.7, emergencyRatio: 0.9, rearmStep: 0.05 },
 };
 
 /** Strip JSONC comments and trailing commas. Best-effort; never throws. */
@@ -111,6 +130,38 @@ function asRecord(value: unknown): Record<string, unknown> | undefined {
     : undefined;
 }
 
+/** A fill ratio must be a finite number strictly inside (0, 1). */
+function isValidRatio(value: unknown): value is number {
+  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1;
+}
+
+/** A re-arm step must be a finite number strictly inside (0, 0.5). */
+function isValidRearmStep(value: unknown): value is number {
+  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 0.5;
+}
+
+/**
+ * Merge the awareness section. Every key is validated on its own, and the
+ * pair is checked together: an inverted warn/emergency pair would make the
+ * escalation unreachable, so both fall back to the base values together.
+ * Sibling keys survive a partial update.
+ */
+function mergeAwareness(base: AwarenessConfig, patch: unknown): AwarenessConfig {
+  const record = asRecord(patch);
+  if (!record) return base;
+  const enabled = typeof record.enabled === "boolean" ? record.enabled : base.enabled;
+  const warnRatio = isValidRatio(record.warnRatio) ? record.warnRatio : base.warnRatio;
+  const emergencyRatio = isValidRatio(record.emergencyRatio)
+    ? record.emergencyRatio
+    : base.emergencyRatio;
+  const rearmStep = isValidRearmStep(record.rearmStep) ? record.rearmStep : base.rearmStep;
+  // Ordering guard: the warn threshold must stay below the emergency one.
+  if (warnRatio >= emergencyRatio) {
+    return { enabled, warnRatio: base.warnRatio, emergencyRatio: base.emergencyRatio, rearmStep };
+  }
+  return { enabled, warnRatio, emergencyRatio, rearmStep };
+}
+
 function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConfig {
   const p = asRecord(patch);
   if (!p) return base;
@@ -171,12 +222,13 @@ function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConf
           ? tokens.emergencyBudgetTokens
           : base.tokens.emergencyBudgetTokens,
     },
+    awareness: mergeAwareness(base.awareness, p.awareness),
   };
 }
 
 /** Every known config key by section, used to warn on typos. */
 const KNOWN_KEYS: Record<string, readonly string[]> = {
-  "": ["enabled", "pruning", "strategies", "tokens"],
+  "": ["enabled", "pruning", "strategies", "tokens", "awareness"],
   pruning: [
     "maxChars",
     "maxWords",
@@ -194,6 +246,7 @@ const KNOWN_KEYS: Record<string, readonly string[]> = {
   "strategies.purgeErrors": ["enabled", "turns", "protectedTools"],
   "strategies.stripReasoning": ["enabled", "thresholdChars"],
   tokens: ["enabled", "emergencyBudgetTokens"],
+  awareness: ["enabled", "warnRatio", "emergencyRatio", "rearmStep"],
 };
 
 /** Collect one warning per unknown key, naming its exact dotted path. */
@@ -229,6 +282,46 @@ export function validateConfig(raw: unknown): string[] {
   }
   const tokens = asRecord(root.tokens);
   if (tokens) collectUnknown(tokens, "tokens", warnings);
+  const awareness = asRecord(root.awareness);
+  if (awareness) {
+    collectUnknown(awareness, "awareness", warnings);
+    warnings.push(...validateAwareness(awareness));
+  }
+  return warnings;
+}
+
+/**
+ * Range checks for the awareness section. Returns one warning per invalid
+ * value, naming the exact key path. The merge layer drops invalid values
+ * back to the defaults, so a bad threshold can never break the hook.
+ */
+export function validateAwareness(raw: unknown): string[] {
+  const warnings: string[] = [];
+  const record = asRecord(raw);
+  if (!record) return warnings;
+  const warnRatio = record.warnRatio;
+  const emergencyRatio = record.emergencyRatio;
+  const rearmStep = record.rearmStep;
+  if (warnRatio !== undefined && !isValidRatio(warnRatio)) {
+    warnings.push(
+      "Invalid config value: awareness.warnRatio must be a number greater than 0 and less than 1",
+    );
+  }
+  if (emergencyRatio !== undefined && !isValidRatio(emergencyRatio)) {
+    warnings.push(
+      "Invalid config value: awareness.emergencyRatio must be a number greater than 0 and less than 1",
+    );
+  }
+  if (rearmStep !== undefined && !isValidRearmStep(rearmStep)) {
+    warnings.push(
+      "Invalid config value: awareness.rearmStep must be a number greater than 0 and less than 0.5",
+    );
+  }
+  if (isValidRatio(warnRatio) && isValidRatio(emergencyRatio) && warnRatio >= emergencyRatio) {
+    warnings.push(
+      "Invalid config value: awareness.warnRatio must be less than awareness.emergencyRatio",
+    );
+  }
   return warnings;
 }
 
diff --git a/src/index.ts b/src/index.ts
index 533510ca..43bb7c5e 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -12,6 +12,14 @@
 import { Plugin } from "@opencode/plugin";
 import { compactNow, formatBudgetMeter, parseCompactArgs, scheduleTrim } from "./actions.js";
 import { applySummaries } from "./apply.js";
+import {
+  buildAwarenessMessage,
+  getAwarenessLevel,
+  measureVisibleTokens,
+  resolveContextLimit,
+  shouldFireAwareness,
+  type AwarenessModel,
+} from "./awareness.js";
 import { applyOmissions, measureTokens, pruneToolResults, serializeResult } from "./prune.js";
 import { applyStrategies } from "./strategies.js";
 import { getBudgetState, isOverEmergencyBudget, loadConfig, type SmartCompactConfig } from "./config.js";
@@ -118,6 +126,84 @@ function measureVisibleCost(messages: Msg[], config: SmartCompactConfig): number
   return total;
 }
 
+/**
+ * Context-pressure awareness: tell the agent how full the context window is
+ * once it crosses the configured ratio, and how to reclaim room.
+ *
+ * Advisory only. The reminder rides on the outgoing model call as one system
+ * part, so the agent sees it without the transcript growing and without a new
+ * turn. It never compacts, never prompts, never aborts a step, and never
+ * mutates the messages. Any failure is swallowed: a warning must never break
+ * the model call.
+ */
+async function runAwareness(
+  ctx: Ctx,
+  sessionID: string,
+  event: unknown,
+  messages: Msg[],
+  config: SmartCompactConfig,
+): Promise<void> {
+  try {
+    const awareness = config.awareness;
+    if (!awareness || !awareness.enabled) return;
+    const system = (event as { system?: unknown }).system;
+    if (!Array.isArray(system)) return;
+    const modelRef = (event as { model?: unknown }).model as
+      | { providerID: string; id: string }
+      | undefined;
+    if (!modelRef) return;
+    const payload = (await ctx.model.list()) as unknown;
+    const models: ReadonlyArray<AwarenessModel> = Array.isArray(payload)
+      ? (payload as ReadonlyArray<AwarenessModel>)
+      : ((payload as { data?: ReadonlyArray<AwarenessModel> })?.data ?? []);
+    const limitTokens = resolveContextLimit(modelRef, models);
+    // An unknown model or a missing limit means no usable window size: stay
+    // silent instead of guessing a denominator.
+    if (!limitTokens) return;
+    const usedTokens = measureVisibleTokens(messages);
+    const ratio = usedTokens / limitTokens;
+    const state = await loadState(ctx, sessionID);
+    // Hysteresis: the latch is cleared only once the context has fallen
+    // meaningfully below the warn threshold. Clearing it on every small dip
+    // under the threshold would let a session hovering at the boundary re-fire
+    // the reminder on alternating requests.
+    if (ratio < awareness.warnRatio - awareness.rearmStep) {
+      if (state.awarenessLastRatio !== undefined || state.awarenessLastLevel !== undefined) {
+        state.awarenessLastRatio = undefined;
+        state.awarenessLastLevel = undefined;
+        await saveState(ctx, sessionID, state);
+      }
+      return;
+    }
+    // Between the clear line and the warn line: keep the latch, stay quiet.
+    if (ratio < awareness.warnRatio) return;
+    const level = getAwarenessLevel(ratio, awareness);
+    if (level === "none") return;
+    if (
+      !shouldFireAwareness(
+        ratio,
+        level,
+        { lastRatio: state.awarenessLastRatio, lastLevel: state.awarenessLastLevel },
+        awareness.rearmStep,
+      )
+    ) {
+      return;
+    }
+    const text = buildAwarenessMessage({
+      usedTokens,
+      limitTokens,
+      ratioPct: Math.round(ratio * 100),
+      level,
+    });
+    (system as Array<{ type: string; text: string }>).push({ type: "text", text });
+    state.awarenessLastRatio = ratio;
+    state.awarenessLastLevel = level;
+    await saveState(ctx, sessionID, state);
+  } catch {
+    // Advisory only: a failure here must never break the model call.
+  }
+}
+
 export default Plugin.define({
   id: "smart-compact",
   async setup(ctx) {
@@ -251,6 +337,8 @@ export default Plugin.define({
       const fresh = await loadState(ctx, sessionID);
       applySummaries(messages, fresh);
       applyOmissions(messages, fresh, config);
+      // Awareness runs last so it measures exactly what the model receives.
+      await runAwareness(ctx, sessionID, event, messages, config);
     });
   },
 });
diff --git a/src/prune.ts b/src/prune.ts
index 9417a7eb..fb2ba5ef 100644
--- a/src/prune.ts
+++ b/src/prune.ts
@@ -45,11 +45,18 @@ export function shouldPrune(
   return exceeds(text, config.pruning.maxWords, config.pruning.maxChars);
 }
 
-/** Serialize a tool-result value to text for caching and token estimation. */
+/**
+ * Serialize a tool-result value to text for caching and token estimation.
+ * Always returns a string: `JSON.stringify` yields `undefined` for undefined
+ * values, functions, and symbols, and a result that claims to be a string but
+ * is not would break every `.length` and `.slice` on it downstream.
+ */
 export function serializeResult(value: unknown): string {
   if (typeof value === "string") return value;
+  if (value === undefined) return "";
   try {
-    return JSON.stringify(value);
+    const encoded = JSON.stringify(value);
+    return typeof encoded === "string" ? encoded : "";
   } catch {
     return String(value);
   }
diff --git a/src/store.ts b/src/store.ts
index 5369619c..6058afdf 100644
--- a/src/store.ts
+++ b/src/store.ts
@@ -50,6 +50,16 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
     nextOmissionId,
     pruneMemo: value.pruneMemo ?? {},
     pending: value.pending ?? null,
+    // The awareness latch survives a restart: without it a restarted session
+    // would re-warn on the very first request.
+    awarenessLastRatio:
+      typeof value.awarenessLastRatio === "number" && Number.isFinite(value.awarenessLastRatio)
+        ? value.awarenessLastRatio
+        : undefined,
+    awarenessLastLevel:
+      value.awarenessLastLevel === "warn" || value.awarenessLastLevel === "emergency"
+        ? value.awarenessLastLevel
+        : undefined,
   };
 }
 
diff --git a/src/types.ts b/src/types.ts
index ac40897b..a6cd6915 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -78,6 +78,13 @@ export interface SessionState {
   pruneMemo: Record<string, MemoEntry>;
   /** A pending command request, consumed by the next context hook. */
   pending?: { mode: "compact" | "trim"; keepTurns: number } | null;
+  /**
+   * Context fill ratio recorded at the last awareness reminder. Absent means
+   * the session has not been warned yet.
+   */
+  awarenessLastRatio?: number;
+  /** Pressure level recorded at the last awareness reminder. */
+  awarenessLastLevel?: "warn" | "emergency";
 }
 
 export function emptyState(): SessionState {
diff --git a/tests/awareness-hook.test.ts b/tests/awareness-hook.test.ts
new file mode 100644
index 00000000..206910da
--- /dev/null
+++ b/tests/awareness-hook.test.ts
@@ -0,0 +1,251 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import plugin from "../src/index.js";
+import type { Msg } from "../src/types.js";
+
+/**
+ * One assistant turn of `chars` characters. The plugin estimates about four
+ * characters per token, so 32000 characters is roughly 8000 tokens, which is
+ * 80 percent of the 10000 token window the harness declares.
+ */
+function bigMessage(chars: number): Msg {
+  return {
+    role: "assistant",
+    content: [{ type: "text", text: "x".repeat(chars) }],
+  };
+}
+
+interface HarnessOptions {
+  /** Context window the stub model reports. */
+  limitContext?: number;
+  /** Shape the model registry answers with. */
+  listShape?: "data" | "array" | "throw";
+  /** Directory the plugin resolves the project config from. */
+  directory?: string;
+}
+
+interface Harness {
+  ctx: unknown;
+  hook: (event: unknown) => Promise<void>;
+  storage: Map<string, unknown>;
+}
+
+/**
+ * Boot the plugin against a stub context and capture the "context" hook it
+ * registers. The stub records every storage write so the awareness latch can
+ * be inspected, and exposes a `session` domain whose `compact` and `prompt`
+ * throw: the awareness pass must never reach for them.
+ */
+async function harness(options: HarnessOptions = {}): Promise<Harness> {
+  const limitContext = options.limitContext ?? 10_000;
+  const listShape = options.listShape ?? "data";
+  const storage = new Map<string, unknown>();
+  let hook: (event: unknown) => Promise<void> = async () => {};
+  const editor = { add: () => {}, list: () => [], get: () => undefined };
+  const modelEntry = { providerID: "test", id: "model-x", limit: { context: limitContext } };
+  const ctx = {
+    location: { directory: options.directory ?? "/nonexistent-smart-compact-test" },
+    app: { name: "opencode", version: "test", channel: "test" },
+    options: {},
+    storage: {
+      get: async (key: string) => storage.get(key),
+      set: async (key: string, value: unknown) => void storage.set(key, value),
+      remove: async (key: string) => void storage.delete(key),
+      scan: async () => ({ entries: [] }),
+    },
+    model: {
+      list: async () => {
+        if (listShape === "throw") throw new Error("registry unavailable");
+        if (listShape === "array") return [modelEntry];
+        return { data: [modelEntry] };
+      },
+    },
+    command: { transform: async (cb: (e: unknown) => void) => void cb(editor) },
+    tool: { transform: async (cb: (e: unknown) => void) => void cb(editor) },
+    session: {
+      hook: async (name: string, fn: (event: unknown) => Promise<void>) => {
+        if (name === "context") hook = fn;
+      },
+      synthetic: async () => {
+        throw new Error("awareness must not post a synthetic message");
+      },
+      prompt: async () => {
+        throw new Error("awareness must not prompt the model");
+      },
+      compact: async () => {
+        throw new Error("awareness must never compact on its own");
+      },
+    },
+  };
+  await plugin.setup(ctx as never);
+  return { ctx, hook: (event) => hook(event), storage };
+}
+
+test("the context hook pushes one advisory system part when the window fills", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  await h.hook({
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(32000)],
+  });
+  assert.equal(system.length, 1);
+  assert.equal(system[0]!.type, "text");
+  assert.match(system[0]!.text, /CONTEXT PRESSURE/);
+  assert.match(system[0]!.text, /80%/);
+  assert.match(system[0]!.text, /compact_context/);
+});
+
+test("the reminder fires once per crossing and re-arms only after a further step", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  const event = {
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(32000)],
+  };
+  await h.hook(event);
+  assert.equal(system.length, 1);
+  // Same fill again: the latch holds, no second nudge.
+  await h.hook(event);
+  assert.equal(system.length, 1);
+  // A small growth stays below the re-arm step.
+  const grew = { ...event, messages: [bigMessage(32400)] };
+  await h.hook(grew);
+  assert.equal(system.length, 1);
+  // A further step re-arms the reminder.
+  const grewMore = { ...event, messages: [bigMessage(36000)] };
+  await h.hook(grewMore);
+  assert.equal(system.length, 2);
+});
+
+test("a session back under the threshold clears the latch and warns again later", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  const base = {
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+  };
+  await h.hook({ ...base, messages: [bigMessage(32000)] });
+  assert.equal(system.length, 1);
+  await h.hook({ ...base, messages: [bigMessage(100)] });
+  await h.hook({ ...base, messages: [bigMessage(32000)] });
+  assert.equal(system.length, 2);
+});
+
+test("no reminder for an unknown model, and none for a window that is not full", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  // Unknown model: the plugin must stay silent rather than guess a window.
+  await h.hook({
+    sessionID: "ses-test",
+    model: { providerID: "other", id: "model-y" },
+    system,
+    messages: [bigMessage(32000)],
+  });
+  assert.equal(system.length, 0);
+  // Known model, window barely used.
+  await h.hook({
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(100)],
+  });
+  assert.equal(system.length, 0);
+});
+
+test("the reminder also fires when the model registry answers with a bare array", async () => {
+  const h = await harness({ limitContext: 10_000, listShape: "array" });
+  const system: Array<{ type: string; text: string }> = [];
+  await h.hook({
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(32000)],
+  });
+  assert.equal(system.length, 1);
+  assert.match(system[0]!.text, /CONTEXT PRESSURE/);
+});
+
+test("a failing model registry is skipped silently and never breaks the call", async () => {
+  const h = await harness({ limitContext: 10_000, listShape: "throw" });
+  const system: Array<{ type: string; text: string }> = [];
+  await h.hook({
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(32000)],
+  });
+  assert.equal(system.length, 0);
+});
+
+test("the kill switch silences the reminder entirely", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-awareness-off-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"enabled": false}}');
+  const h = await harness({ limitContext: 10_000, directory: dir });
+  const system: Array<{ type: string; text: string }> = [];
+  await h.hook({
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(32000)],
+  });
+  assert.equal(system.length, 0);
+});
+
+test("a session hovering at the threshold does not re-fire on every request", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  const base = {
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+  };
+  // 80 percent: the reminder fires.
+  await h.hook({ ...base, messages: [bigMessage(32000)] });
+  assert.equal(system.length, 1);
+  // 69 percent: just under the threshold, but not far enough to clear the latch.
+  await h.hook({ ...base, messages: [bigMessage(27600)] });
+  // 80 percent again: the latch still holds, so no second nudge.
+  await h.hook({ ...base, messages: [bigMessage(32000)] });
+  assert.equal(system.length, 1);
+});
+
+test("the hook escalates the wording past the emergency threshold", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  // 95 percent of the window.
+  await h.hook({
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(38000)],
+  });
+  assert.equal(system.length, 1);
+  assert.match(system[0]!.text, /95%/);
+  assert.match(system[0]!.text, /emergency context pressure/);
+});
+
+test("a downgrade from emergency back to warn does not re-fire on its own", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  const base = {
+    sessionID: "ses-test",
+    model: { providerID: "test", id: "model-x" },
+    system,
+  };
+  // 95 percent: emergency wording.
+  await h.hook({ ...base, messages: [bigMessage(38000)] });
+  assert.equal(system.length, 1);
+  // 80 percent: the level drops back to warn, but the fill did not grow, so
+  // the latch holds and nothing is pushed.
+  await h.hook({ ...base, messages: [bigMessage(32000)] });
+  assert.equal(system.length, 1);
+});
diff --git a/tests/awareness.test.ts b/tests/awareness.test.ts
new file mode 100644
index 00000000..18c70df0
--- /dev/null
+++ b/tests/awareness.test.ts
@@ -0,0 +1,130 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import {
+  buildAwarenessMessage,
+  getAwarenessLevel,
+  measureVisibleTokens,
+  resolveContextLimit,
+  shouldFireAwareness,
+} from "../src/awareness.js";
+import type { Msg } from "../src/types.js";
+
+/** One assistant message with a text part, a tool result, and a media part. */
+function sampleMessage(): Msg {
+  return {
+    role: "assistant",
+    content: [
+      { type: "text", text: "a".repeat(400) },
+      { type: "tool-result", id: "call-1", result: { type: "text", value: "b".repeat(800) } },
+      { type: "media" },
+    ],
+  };
+}
+
+test("measureVisibleTokens counts text and tool results and ignores media", () => {
+  const messages = [sampleMessage()];
+  // Text (400 chars) plus the serialized tool result (800 chars) plus one
+  // newline separator between the two chunks. The media part carries no text.
+  assert.equal(measureVisibleTokens(messages), Math.ceil((400 + 1 + 800) / 4));
+});
+
+test("measureVisibleTokens ignores unknown part shapes and empty input", () => {
+  const onlyMedia: Msg = { role: "assistant", content: [{ type: "media" }, { type: "compaction" }] };
+  assert.equal(measureVisibleTokens([onlyMedia]), 0);
+  assert.equal(measureVisibleTokens([]), 0);
+});
+
+test("measureVisibleTokens counts an empty tool result as nothing", () => {
+  // A tool result with no value must not inflate the ratio.
+  const empty: Msg = {
+    role: "tool",
+    content: [{ type: "tool-result", id: "call-empty", result: { type: "text" } }],
+  };
+  assert.equal(measureVisibleTokens([empty]), 0);
+});
+
+test("resolveContextLimit matches provider plus model id", () => {
+  const models = [
+    { providerID: "opencode", id: "model-a", limit: { context: 200000 } },
+    { providerID: "anthropic", id: "model-b", limit: { context: 100000 } },
+  ];
+  assert.equal(resolveContextLimit({ providerID: "opencode", id: "model-a" }, models), 200000);
+  assert.equal(resolveContextLimit({ providerID: "anthropic", id: "model-b" }, models), 100000);
+});
+
+test("resolveContextLimit returns undefined for a miss or an unusable limit", () => {
+  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 0 } }];
+  assert.equal(resolveContextLimit({ providerID: "opencode", id: "nope" }, models), undefined);
+  assert.equal(resolveContextLimit({ providerID: "opencode", id: "model-a" }, models), undefined);
+  assert.equal(resolveContextLimit({ providerID: "x", id: "y" }, []), undefined);
+  assert.equal(
+    resolveContextLimit({ providerID: "x", id: "y" }, [{ providerID: "x", id: "y", limit: { context: -5 } }]),
+    undefined,
+  );
+});
+
+test("getAwarenessLevel maps the ratio to none, warn, and emergency", () => {
+  const cfg = { warnRatio: 0.7, emergencyRatio: 0.9 };
+  assert.equal(getAwarenessLevel(0.69, cfg), "none");
+  assert.equal(getAwarenessLevel(0.7, cfg), "warn");
+  assert.equal(getAwarenessLevel(0.89, cfg), "warn");
+  assert.equal(getAwarenessLevel(0.9, cfg), "emergency");
+  assert.equal(getAwarenessLevel(Number.NaN, cfg), "none");
+});
+
+test("shouldFireAwareness fires on the first crossing and stays quiet on a repeat", () => {
+  assert.equal(shouldFireAwareness(0.72, "warn", {}, 0.05), true);
+  assert.equal(shouldFireAwareness(0.72, "warn", { lastRatio: 0.72, lastLevel: "warn" }, 0.05), false);
+});
+
+test("shouldFireAwareness re-arms only after the configured step", () => {
+  const prev = { lastRatio: 0.72, lastLevel: "warn" as const };
+  assert.equal(shouldFireAwareness(0.74, "warn", prev, 0.05), false);
+  assert.equal(shouldFireAwareness(0.77, "warn", prev, 0.05), true);
+});
+
+test("shouldFireAwareness fires on an escalation before a full step", () => {
+  const prev = { lastRatio: 0.72, lastLevel: "warn" as const };
+  assert.equal(shouldFireAwareness(0.75, "emergency", prev, 0.05), true);
+});
+
+test("buildAwarenessMessage states the fill, the tool, and the advisory rules", () => {
+  const text = buildAwarenessMessage({
+    usedTokens: 104000,
+    limitTokens: 145000,
+    ratioPct: 72,
+    level: "warn",
+  });
+  // The live status of the context window.
+  assert.match(text, /72%/);
+  assert.match(text, /104000/);
+  assert.match(text, /145000/);
+  assert.match(text, /lower bound/);
+  // The tool to call and where to find it.
+  assert.match(text, /compact_context/);
+  assert.match(text, /magic-compact/);
+  assert.match(text, /never ask the Manager to run a slash command/);
+  // Re-orient before compacting.
+  assert.match(text, /AGENTS\.md/);
+  assert.match(text, /active task file/);
+  // The action itself.
+  assert.match(text, /you MUST compact now/);
+  assert.match(text, /not a critical/);
+  // Advisory only, and the safety guarantees.
+  assert.match(text, /Advisory only/);
+  assert.match(text, /mid-critical-step/);
+  assert.match(text, /Never abort a half-written edit/);
+  assert.match(text, /user messages are never summarized/i);
+  assert.match(text, /read_omitted_content/);
+});
+
+test("buildAwarenessMessage escalates the wording at the emergency level", () => {
+  const text = buildAwarenessMessage({
+    usedTokens: 190000,
+    limitTokens: 200000,
+    ratioPct: 95,
+    level: "emergency",
+  });
+  assert.match(text, /95%/);
+  assert.match(text, /emergency context pressure/);
+});
diff --git a/tests/config-validation.test.ts b/tests/config-validation.test.ts
index 29038149..7fdaf599 100644
--- a/tests/config-validation.test.ts
+++ b/tests/config-validation.test.ts
@@ -56,6 +56,64 @@ test("loadConfig merges project config and warns on unknown keys", async () => {
   }
 });
 
+test("awareness defaults are on with the approved thresholds", () => {
+  assert.deepEqual(DEFAULT_CONFIG.awareness, {
+    enabled: true,
+    warnRatio: 0.7,
+    emergencyRatio: 0.9,
+    rearmStep: 0.05,
+  });
+  assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
+});
+
+test("validateConfig names unknown awareness keys and rejects out-of-range values", () => {
+  const unknown = validateConfig({ awareness: { nope: 1 } });
+  assert.ok(unknown.some((w) => w.includes("awareness.nope")));
+  const badRatio = validateConfig({ awareness: { warnRatio: 1.5 } });
+  assert.ok(badRatio.some((w) => w.includes("awareness.warnRatio")));
+  const badStep = validateConfig({ awareness: { rearmStep: 0 } });
+  assert.ok(badStep.some((w) => w.includes("awareness.rearmStep")));
+  const inverted = validateConfig({ awareness: { warnRatio: 0.95, emergencyRatio: 0.9 } });
+  assert.ok(inverted.some((w) => w.includes("awareness.warnRatio")));
+});
+
+test("loadConfig overrides one awareness key and keeps its siblings", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-awareness-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"warnRatio": 0.5}}');
+  const { loadConfig } = await import("../src/config.js");
+  const config = await loadConfig({ location: { directory: dir } } as never);
+  assert.equal(config.awareness.warnRatio, 0.5);
+  assert.equal(config.awareness.emergencyRatio, 0.9);
+  assert.equal(config.awareness.rearmStep, 0.05);
+  assert.equal(config.awareness.enabled, true);
+});
+
+test("loadConfig drops invalid awareness values back to the defaults", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-awareness-bad-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(
+    join(dir, ".opencode", "smart-compact.jsonc"),
+    '{"awareness": {"warnRatio": 2, "rearmStep": 9}}',
+  );
+  const original = console.warn;
+  console.warn = () => {};
+  try {
+    const { loadConfig } = await import("../src/config.js");
+    const config = await loadConfig({ location: { directory: dir } } as never);
+    assert.equal(config.awareness.warnRatio, 0.7);
+    assert.equal(config.awareness.rearmStep, 0.05);
+  } finally {
+    console.warn = original;
+  }
+});
+
 test("budget guard is advisory: no caller early-returns on an over-budget history", async () => {
   // Regression guard for the deadlock: the budget check must never be followed
   // by a bare early return, or the largest sessions silently lose all
```
<!-- END_GIT_DIFF -->
