# Task 61: make smart-compact actually engage (auto-trim, budget scaling, awareness fallback, state hygiene)

**File:** `tasks/backlog/61-engage-defaults-and-state-hygiene.md`
**Source:** manager (2026-11-03, after a single long session ran to ~681K measured tokens with zero automatic reclamation while emitting a budget warning on every turn)
**Type:** improvement
**Status:** open

## Goal

Close the gap between what the plugin can do and what it actually does by default. In one real session the plugin reported 1,059,881 tokens pruned across 930 tool results and 71 turns summarized — but **every one of those reclaims happened because the agent called `compact_context` manually**. Nothing engaged on its own, and the one signal that did fire (the emergency-budget warning) was unactionable and repeated on every single turn.

The target: with default configuration, a long session should stay near a healthy fraction of the model window without the agent remembering to compact, and every threshold that fires should be either actionable or silent.

## Observed evidence (one real session, 2026-11-03)

| Metric | Value |
|---|---|
| Model window | 1,000,000 |
| Measured context at end | ~681K (heuristic estimate) |
| Tokens pruned | ~1,059,881 across 930 tool results |
| Turns summarized | 71 |
| Cached omissions | 397 |
| `memo-saved` | ~0 tokens |
| Tokenizer | off |
| Awareness advisories seen | **zero** |
| Emergency-budget warnings seen | one per turn, never satisfiable |
| Automatic trims triggered | **zero** |

## Findings

### F1 — the emergency budget is absolute, not a share of the window (P2)

`src/config.ts:94` defaults `tokens: { enabled: false, emergencyBudgetTokens: 50000 }`, and `isOverEmergencyBudget` (`src/config.ts:362`) simply compares `measuredTokens > budget`.

On a 1M window, 50,000 is 5% of capacity, so the warning fires from the first few turns and can never be satisfied by any real working session. The code comment is right that this must never gate work — but a warning that is always on is indistinguishable from a warning that is always wrong, and it teaches the operator to ignore the channel.

**Fix:** derive the budget from the resolved context window (for example 60% of `limit.context`) with an explicit override, or at minimum document that the value is per-window and set a sane default for large windows. Reuse `resolveContextLimit` (`src/awareness.ts:88`) rather than introducing a second lookup.

### F2 — lossless auto-trim is disabled by default (P1, biggest win)

`src/config.ts:95` defaults `awareness: { …, autoTrimRatio: 0 }`, and `shouldAutoTrim` (`src/awareness.ts:161`) returns false for any ratio `<= 0`.

Trim is the plugin's safest operation by construction: it replaces bulky completed tool results with a notice whose original stays cached, touches no user message, summarizes nothing, and aborts no step. Leaving it off means the only reclamation path is an agent that remembers — exactly the failure mode the awareness module was built to prevent. In the observed session, 930 results were sitting prunable while context climbed past 68% of the window.

**Fix:** default to roughly `0.55`, keep the existing hysteresis (`rearmStep`, `hasPending`, reset line) so one sustained pressure period queues one trim rather than a loop.

### F3 — awareness advisories are silent whenever the model entry lacks `limit.context` (P3)

`src/index.ts:162` resolves the window through `resolveContextLimit`, and `src/index.ts:167-177` returns early when it is undefined, emitting a single `console.log` that no TUI user will ever see. `resolveContextLimit` (`src/awareness.ts:88`) deliberately returns `undefined` rather than guessing a denominator — a defensible choice, but it makes the entire advisory subsystem inert for any provider whose registry entry omits the limit, with no visible symptom.

**Fix:** add an explicit fallback, e.g. `awareness.contextWindowTokens`, used only when the registry has no limit, and surface the substitution in the reminder text so the operator knows the denominator is configured rather than measured. Keep staying silent when neither exists.

### F4 — measurements are heuristic, so every number understates (P4)

`src/tokens.ts` counts `ceil(len / 4)` unless `tokens.enabled` is true and `@anthropic-ai/tokenizer` loads. Session traffic was dominated by tool JSON and code, where the real ratio is closer to 3.2–3.5 characters per token, so a reported 681K was plausibly higher. Every threshold decision in the plugin — prune eligibility, budget warning, trim trigger — inherits that bias in the same direction, which means the plugin waits longer than it thinks.

**Fix:** ship a calibrated divisor per content shape (or enable the tokenizer by default when present and record which path produced the number in `compact_stats`), and state the approximation in the stats line the operator actually reads.

### F5 — the prune memo is near-dead but still consumes state (P6)

`measureMemoized` (`src/prune.ts:121-132`) keys its cache by `callId`, while the prune loop skips any part already in `state.omittedCalls` (`src/prune.ts:193`) and `isSmallInput` bypasses the memo entirely. A `callId` identifies one invocation whose text never changes, so a hit requires measuring the same unpruned call twice with identical content — a narrow band. Observed result: `memo-saved ~0` across 930 results.

The memo still writes one hash plus an integer per call id into session state, which is persisted and rewritten on every save.

**Fix:** delete it, or key it by content hash so equal outputs across different calls can share a measurement.

### F6 — omission originals live inside session state (P5)

`state.omissions` (`src/types.ts:68`) holds the full original text of every pruned result, written at `src/prune.ts:248` and read at `src/index.ts:329`. The observed session accumulated 397 omissions, roughly 3.6M characters, inside a single JSON blob that `saveState` (`src/store.ts:87`) rewrites.

Two consequences: session saves grow with history, and retrieving an original via `read_omitted_content` re-inflates the very context that pruning relieved — with no cap on how much can be restored at once.

**Fix:** move originals to per-session files with an LRU/size cap, keep only the id-to-path mapping in state, and bound a single retrieval (truncate with an explicit notice rather than replaying megabytes into the conversation).

### F7 — silent quality cliff in summarization (P7)

`summarizeTurns` (`src/summarize.ts:76`) falls back to `heuristicSummary`, a 400-character whitespace-collapsed truncation, whenever the model reply omits a `<summary>` block. This is correct as a resilience measure and wrong as an unmeasured one: a batch where every block is missed degrades a whole compaction to truncated prose with no counter, no warning, and no difference visible in `compact_stats`.

**Fix:** count fallbacks per run and report them in `compact_stats` (`fallbacks: N`), so a systematic parse failure is diagnosable instead of looking like a normal compaction.

### F8 — config/source drift is invisible (note, not a fix)

The plugin loads as `github:mokhtarabadi/opencode-smart-compact` in the global config, so a session runs repository HEAD, not the local working tree. During this review the local `src/` was read to explain observed behaviour, which is only valid if the two agree.

**Fix (cheap):** have `compact_stats` print the plugin version and build identity, so a review can prove which code produced the numbers.

## Scope

Ordered by value per unit of risk. Each item is independently shippable and independently revertible.

1. **P1** — default `autoTrimRatio` to ~0.55, keep hysteresis intact, add a test that one sustained period queues exactly one trim.
2. **P2** — window-scaled emergency budget using `resolveContextLimit`, explicit override preserved, test for a 1M window and for the unknown-window case.
3. **P3** — `awareness.contextWindowTokens` fallback plus a reminder that names the denominator's source; tests for registry-present, fallback-present, both-absent.
4. **P4** — calibrated token estimation or tokenizer-by-default, with the measurement path reported in `compact_stats`.
5. **P5** — omission originals to files with a cap, bounded single retrieval, migration for existing state.
6. **P6** — remove `pruneMemo` (or rekey it) and drop the field from state.
7. **P7** — fallback counter surfaced in `compact_stats`.
8. **F8** — version line in `compact_stats`.

## Acceptance Criteria

- [ ] A session that reaches the trim line reclaims tool output **without** any explicit `compact_context` call, and the trim fires once per sustained period rather than repeatedly.
- [ ] The emergency warning can be satisfied: on a 1M window it stays quiet during normal work and fires only near the derived threshold; with an explicit override it behaves exactly as configured.
- [ ] Awareness renders a pressure ratio for a provider whose registry entry has no `limit.context`, and the reminder states that the denominator is configured.
- [ ] `compact_stats` reports which measurement path produced its numbers (tokenizer vs heuristic) and the plugin version.
- [ ] `read_omitted_content` on a large original returns a bounded response with an explicit truncation notice, and session state no longer holds full originals.
- [ ] `pruneMemo` contributes zero benefit is either fixed to hit or removed, with the field gone from state.
- [ ] Summarization fallbacks are counted and visible in `compact_stats`.

## Verification Evidence

- **Typecheck:** `npm run typecheck` → exit 0
- **Tests:** `npm test` → all suites green, including new tests for F1/F2/F3/F5/F6/F7
- **Package:** `npm run verify:package` → exit 0
- **Behavioural proof:** a scripted session fixture that grows past the trim line with no manual call, asserting a trim occurred and context dropped; and a 1M-window fixture asserting the budget warning stays silent
- **Regression:** existing 14 suites unchanged in intent; no test weakened to accommodate a default change

## Definition of Done

- [ ] `npm run typecheck` and `npm test` pass with exit code 0, and the new tests fail without their fixes
- [ ] `lint_task_file` passes on this file and `CHANGELOG.md` carries one entry per shipped item
- [ ] The seven findings above are each either fixed or explicitly deferred with a one-line reason in the Execution Log
- [ ] `compact_stats` tells an operator which measurement path, which denominator and which version produced its numbers

## Local TODOs

- [ ] Reproduce F2/F3 with a fixture before changing defaults, so the fix has a red test first
- [ ] Confirm registry `limit.context` presence for the providers in use, and record which ones need the fallback
- [ ] Measure real chars/token on a representative session dump before choosing the calibration constant
- [ ] Check whether filesystem-backed omissions need a migration for existing sessions or can start empty

## Risk & Rollback

- **Risk 1 — over-eager trimming.** A low `autoTrimRatio` could trim during normal work. Mitigation: trim is lossless and cached, and the hysteresis already prevents re-queueing within a period; start at 0.55 and let a fixture prove the trigger point.
- **Risk 2 — budget change hides real pressure.** A window-scaled budget could stay quiet until genuinely late. Mitigation: keep the ratio configurable, default conservatively, and log the derived value once per session.
- **Risk 3 — state migration.** Moving originals out of state can orphan existing sessions' omissions. Mitigation: migrate on first load, and make a missing original fail closed with the existing notice (`src/prune.ts:278`) rather than throwing.
- **Rollback:** every item is a config default or an internal storage detail behind the same tools. Restoring `autoTrimRatio: 0`, `emergencyBudgetTokens`, and the state shape returns prior behaviour with no user-visible API change.

## Execution Log & Reasoning

- **Implementation (lane 1, 2026-11-03):** the whole scope shipped in one pass with gates green — `autoTrimRatio` 0→0.55, window-scaled budget (`resolveEmergencyBudget`, ratio 0.6, override wins, ratio 0 disables, silent when the window is unknown), `awareness.contextWindowTokens` fallback with a reminder naming a configured denominator, bounded file-backed omission store with legacy migration and a 20k retrieval cap, `pruneMemo` removed, summary-fallback counter, and version/measurement path in stats. Verified: typecheck 0, tests 0 (138 at that point), `verify:package` 0, HEAD unchanged.
- **Review round 1 (2026-11-03): APPROVED_WITH_CHANGES**, four corrections plus two explicit deferrals. Applied in the same run:
  - **R1 (budget-zero trap, fixed):** `emergencyBudgetTokens: 0` changed meaning from "disable" to "derive". Now documented as breaking in `CHANGELOG.md` with a migration line in `README.md`, the validation message says `0 (derive from the window)`, and `DEFAULT_CONFIG` references `DEFAULT_EMERGENCY_BUDGET_RATIO` — which also required moving that constant above `DEFAULT_CONFIG` (it was declared after it, a temporal-dead-zone error the reviewer caught).
  - **R2 (eviction deleted the newest file, fixed):** `enforceOmissionStoreCap` iterated oldest-first and unlinked until under cap, so a single original larger than the whole byte cap was deleted immediately after being written — losing the freshest output while older files survived. The loop now stops at the last entry with a warning, and a regression test writes a 16-byte original against a 10-byte cap and asserts it stays readable. Tests went 138 → 139.
  - **R3 (cached-count overstatement, fixed):** `docs/AGENT-TOOLS.md` no longer claims the count equals originals still readable; it states the records are retained under the cap and that an evicted original fails closed with the missing-original notice.
  - **R4 (global bound, deferred):** omissions are capped per session, but the id-to-path mappings and the session directories themselves have no global bound. Deferred deliberately: it needs a cross-session GC policy and that is a product decision, not a default change.
  - **R5 (calibration, deferred):** the estimator still divides by 4; only the measurement path is reported. Deferred because choosing a calibrated divisor needs a measured session dump rather than a guess.
  - **R6 (ratio alignment, accepted as-is):** `docs/AGENT-TOOLS.md` states warn/emergency as 0.5/0.8 to match the shipped defaults; the older 0.7/0.9 figures were documentation drift.
- **Post-fix gates:** typecheck 0, tests 0 (139 passed), `verify:package` 0.
- **Review round 2 (2026-11-03): APPROVED / PO_REVIEW_PENDING.** Reviewer confirmed R1–R3 against the diff, confirmed R4/R5 are recorded deferrals rather than dropped items, and accepted R6 as drift correction. No remaining issues; recommendation only: record cross-session GC as a product decision for a future task (already noted as R4). Statement of record: "Code approved technically" — closure is the manager's call, not the agent's.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index c0cfd71a..fcecf580 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -6,6 +6,23 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ## [Unreleased]
 
+### Changed
+
+- Auto-trim ships armed: `awareness.autoTrimRatio` now defaults to `0.55` (was `0`), so a long session reclaims bulky tool output without a manual `compact_context` call. The existing hysteresis is unchanged — one sustained period queues one trim, and the latch re-arms only on growth or after the fill drops below the line. Task 61 P1.
+- Emergency budget scales with the model window: `tokens.emergencyBudgetTokens` defaults to `0` (derive) and `tokens.emergencyBudgetRatio` (default `0.6`) is applied to the resolved `limit.context`. A positive `emergencyBudgetTokens` stays an exact override, `emergencyBudgetRatio: 0` disables the derived warning, and an unknown window keeps it silent instead of firing forever. One per-request window lookup feeds both the budget and the reminder. Task 61 P2.
+- Awareness gains `awareness.contextWindowTokens`, used only when the model registry entry has no usable `limit.context`; the reminder and the stats line state the denominator is configured, and with neither source the advisory still stays silent. Task 61 P3.
+- `compact_stats` and `/magic-stats` now start with the plugin version, report which measurement path produced the numbers (`tokenizer` or `heuristic`), and count heuristic summary fallbacks. Task 61 P4/P7/F8.
+- README documents the estimator calibration: roughly four characters per token is a lower bound for tool JSON and code.
+- **Breaking (config semantics):** `tokens.emergencyBudgetTokens: 0` used to disable the warning and now means "derive from the window", with `tokens.emergencyBudgetRatio: 0` as the explicit opt-out. Anyone who pinned `0` to silence the warning must set the ratio to `0` instead. A positive `emergencyBudgetTokens` (for example an existing `50000`) still behaves exactly as before and stays absolute until changed. Task 61 P2.
+
+### Added
+
+- Bounded per-session omission store (`src/omissions.ts`): pruned originals move out of session state into one file per omission (500 files / 8 MiB per session, oldest-first eviction), state keeps only the id-to-path mapping, legacy inline originals migrate on first load, and `read_omitted_content` caps a single response at 20000 characters with an explicit truncation notice while a missing original still fails closed. Task 61 P5.
+
+### Removed
+
+- `pruneMemo` (the call-id keyed token memo) and the `memo-saved` stat: it measured about zero benefit while writing one entry per call into state. Legacy state drops the field on load. Task 61 P6.
+
 ### Added
 
 - Awareness denominator made visible: the resolved context window (`awarenessWindow`) and model name (`awarenessModel`) persist in session state, `compact_stats` ends with `window <tokens> (<model>)`, and an unknown model (or registry entry without `limit.context`) logs one `[smart-compact] awareness disabled` line per model instead of staying silently advisory-free. Silence-by-design is kept — no ratio is ever guessed — but it is now diagnosable from the stats line. Pinned by three `formatStats` tests and two hook-level tests.
diff --git a/README.md b/README.md
index e979a3ac..33839e0d 100644
--- a/README.md
+++ b/README.md
@@ -20,7 +20,7 @@ Because the transcript is never modified, a compaction can be recomputed from st
 - **Verbatim user messages** — your instructions are never summarized away.
 - **Retrievable pruning** — bulky completed tool output is replaced with a notice; the original is cached and can be read back with `read_omitted_content`.
 - **Automatic strategies** — repeated identical tool calls are deduplicated (newest kept) and the arguments of stale errored tool calls are blanked.
-- **Zero ongoing prompt overhead** — compaction is command-driven, not a background loop, so cache invalidation happens once per compaction.
+- **Zero ongoing prompt overhead** — summarization is command-driven, not a background loop, so cache invalidation happens once per compaction; only the lossless tool-output trim runs automatically at the configured pressure.
 - **Observable** — `/magic-stats` reports tokens pruned, turns summarized, and cached omissions, and the agent-callable `compact_stats` tool reports the same figures without the Manager.
 
 ## Installation
@@ -69,11 +69,12 @@ Compaction is scheduled by the command and applied on the next model request.
 
 ### The stats tool
 
-`compact_stats` reports the same cumulative figures as `/magic-stats` — tokens pruned, tool results trimmed, turns summarized, cached omissions, memo-saved tokens, last run time, tokenizer state, and the awareness denominator — without the Manager having to run anything. It takes no inputs, only reads storage, and shares the formatter with the slash command, so the two lanes cannot report different numbers.
+`compact_stats` reports the same cumulative figures as `/magic-stats` — plugin version, tokens pruned, tool results trimmed, turns summarized with their heuristic fallbacks, cached omissions, last run time, which measurement path produced the numbers (tokenizer or heuristic), and the awareness denominator — without the Manager having to run anything. It takes no inputs, only reads storage, and shares the formatter with the slash command, so the two lanes cannot report different numbers.
 
 ## Pruning rules
 
-- Completed tool results over the configured size limit (default 1024 chars / 128 words) are pruned to a notice; the original is cached.
+- Completed tool results over the configured size limit (default 1024 chars / 128 words) are pruned to a notice; the original is cached in a per-session file store, not in the session state blob.
+- The omission store is bounded (500 files / 8 MiB per session, oldest evicted first), and a single `read_omitted_content` response is capped at 20000 characters with an explicit truncation notice.
 - With `pruning.useTokens`, the word thresholds double as token budgets and measured tokens decide instead of chars/words.
 - The preserve-recent window (default last 2 turns, plus always the last user message) keeps full text; sessions with no user message get no window.
 - Results over `truncateToolsChars` (default 1024) are pruned even under the size limit; `task` keeps its higher bar and is never capped below `taskMaxChars`.
@@ -125,26 +126,27 @@ Copy this recommended file to `~/.config/opencode/smart-compact.jsonc` for the b
     "purgeErrors": { "enabled": true, "turns": 4, "protectedTools": ["question"] },
     "stripReasoning": { "enabled": true, "thresholdChars": 500 }
   },
-  "tokens": { "enabled": true, "emergencyBudgetTokens": 50000 },
+  "tokens": { "enabled": true, "emergencyBudgetTokens": 0, "emergencyBudgetRatio": 0.6 },
   "awareness": {
     "enabled": true,
     "warnRatio": 0.5,
     "emergencyRatio": 0.8,
     "rearmStep": 0.05,
-    "autoTrimRatio": 0
+    "autoTrimRatio": 0.55,
+    "contextWindowTokens": 0
   }
 }
 ```
 
-`tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. Unknown config keys produce a warning naming the exact key path. When measured cost exceeds `emergencyBudgetTokens` (0 disables) the run warns and still compacts: the budget is an early signal that a session is getting large, never a gate, because refusing to compact an over-budget session would deadlock it. `/magic-stats` also reports memo-saved tokens, last-run time, and whether the tokenizer backed the run.
+`tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. The built-in estimate assumes about four characters per token, while tool JSON and code usually sit closer to 3.2–3.5, so treat the reported numbers as a lower bound. Unknown config keys produce a warning naming the exact key path. The emergency budget scales with the model: `emergencyBudgetTokens` pins an exact number, and when it is `0` the budget is `emergencyBudgetRatio` (default `0.6`) of the resolved context window. With no known window — or with `emergencyBudgetRatio: 0` — the warning stays off instead of firing against a guessed denominator. **Migration:** `emergencyBudgetTokens: 0` now means "derive from the window" rather than "disable". If you previously set it to `0` to silence the warning, set `emergencyBudgetRatio` to `0` instead; a positive `emergencyBudgetTokens` still pins an exact number and behaves exactly as before. When the measured cost exceeds the effective budget the run warns and still compacts: the budget is an early signal that a session is getting large, never a gate, because refusing to compact an over-budget session would deadlock it. `/magic-stats` also reports the plugin version, the measurement path that produced the numbers, heuristic-summary fallbacks, and the last-run time.
 
-`awareness` is the context-pressure reminder. When the model-visible context of a session crosses `warnRatio` (default `0.5`) of the model's context window, the agent gets an unmissable directive on the next model call: the first line is the action itself ("ACT NOW — search your tool list for `compact_context` and call it"), followed by the current fill percentage with the token numbers behind it, what is lost if it is ignored (overflow drops in-flight work), and a reminder to re-orient on the project before compacting. It is advisory only: the plugin never summarizes on its own, never aborts a step, and never mutates stored history. At warn level it fires once per crossing and re-arms only after the fill grows by `rearmStep`; at `emergencyRatio` (default `0.8`) it re-fires on every request until the pressure drops, so a heads-down agent cannot get one nudge and then silence. The latch clears automatically once the fill drops below `warnRatio` minus `rearmStep`. The measured percentage is a lower bound, because provider system prompts and tool schemas are invisible to the plugin. Set `awareness.enabled` to `false` to silence it.
+`awareness` is the context-pressure reminder. When the model-visible context of a session crosses `warnRatio` (default `0.5`) of the model's context window, the agent gets an unmissable directive on the next model call: the first line is the action itself ("ACT NOW — search your tool list for `compact_context` and call it"), followed by the current fill percentage with the token numbers behind it, what is lost if it is ignored (overflow drops in-flight work), and a reminder to re-orient on the project before compacting. It is advisory only: the plugin never summarizes on its own, never aborts a step, and never mutates stored history. At warn level it fires once per crossing and re-arms only after the fill grows by `rearmStep`; at `emergencyRatio` (default `0.8`) it re-fires on every request until the pressure drops, so a heads-down agent cannot get one nudge and then silence. The latch clears automatically once the fill drops below `warnRatio` minus `rearmStep`. The measured percentage is a lower bound, because provider system prompts and tool schemas are invisible to the plugin. When a provider's model entry carries no `limit.context`, set `awareness.contextWindowTokens` to a fallback window: the reminder then states that the denominator is configured rather than measured. With neither a registry limit nor a configured fallback the advisory stays silent. Set `awareness.enabled` to `false` to silence it.
 
-`awareness.autoTrimRatio` is the one automatic action, and it is lossless: at or above that fill the plugin queues a tool-output-only trim for the next request, so bulky completed tool results become notices while their originals stay cached under a Content ID. No turn is summarized, no user message is touched, and a compaction already queued is never overwritten. One sustained high-pressure period trims once: after the queued trim is consumed the per-session latch keeps the next request quiet, and it re-arms either once the fill has grown by a re-arm step, or after it drops below the line and rises again. `0` (the default) disables it; a 1M-token window rarely needs it before the advisory fires, while a 200K window benefits from setting it near `warnRatio`.
+`awareness.autoTrimRatio` is the one automatic action, and it is lossless: at or above that fill the plugin queues a tool-output-only trim for the next request, so bulky completed tool results become notices while their originals stay cached under a Content ID. No turn is summarized, no user message is touched, and a compaction already queued is never overwritten. It is armed by default at `0.55`, just above `warnRatio`, so a long session reclaims tool output without anyone remembering to call `compact_context`. One sustained high-pressure period trims once: after the queued trim is consumed the per-session latch keeps the next request quiet, and it re-arms either once the fill has grown by a re-arm step, or after it drops below the line and rises again. `0` disables it.
 
 ## Comparison
 
-Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and never summarizes a turn without being asked. The trade-off is that compaction is agent-driven rather than automatic — the context-pressure reminder only tells the agent how full the window is and what to call; the agent (or you) still decides when to summarize. Tool-output trimming is the exception: with `awareness.autoTrimRatio` set it runs on its own at that fill, and it is lossless because every pruned original stays cached.
+Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and never summarizes a turn without being asked. The trade-off is that compaction is agent-driven rather than automatic — the context-pressure reminder only tells the agent how full the window is and what to call; the agent (or you) still decides when to summarize. Tool-output trimming is the exception: armed by default at `awareness.autoTrimRatio`, it runs on its own at that fill, and it is lossless because every pruned original stays cached.
 
 ## Development
 
@@ -155,7 +157,7 @@ npm test            # compiles src + tests, runs node --test
 npm run verify:package   # validates the npm payload
 ```
 
-Source layout: `src/index.ts` (plugin entry), `plan.ts` (turn planning), `summarize.ts` (per-turn summaries), `apply.ts` (summary application), `prune.ts` (tool-result pruning), `strategies.ts` (deduplication, purge-errors), `awareness.ts` (context-pressure reminder), `config.ts`, `store.ts` (per-session state).
+Source layout: `src/index.ts` (plugin entry), `plan.ts` (turn planning), `summarize.ts` (per-turn summaries), `apply.ts` (summary application), `prune.ts` (tool-result pruning), `omissions.ts` (bounded on-disk original store and retrieval cap), `strategies.ts` (deduplication, purge-errors), `awareness.ts` (context-pressure reminder), `config.ts`, `store.ts` (per-session state), `version.ts` (package version for stats).
 
 ## Releasing
 
diff --git a/docs/AGENT-TOOLS.md b/docs/AGENT-TOOLS.md
index c8cae955..cab3849b 100644
--- a/docs/AGENT-TOOLS.md
+++ b/docs/AGENT-TOOLS.md
@@ -10,7 +10,7 @@ What it does to your context:
 
 - User messages: always kept verbatim, never summarized.
 - Old assistant turns: each replaced by its own 2-4 sentence summary. Restored from `state.summaries` by message ID.
-- Bulky tool results: pruned to `[omitted tool output ... Content ID: omitted-XXXX]` notice. Original cached in `state.omissions`, retrievable.
+- Bulky tool results: pruned to `[omitted tool output ... Content ID: omitted-XXXX]` notice. Original cached in a bounded per-session file store (state keeps only the id-to-path mapping), retrievable with a 20000-character response cap.
 - Recent window: last user message + `preserveRecentTurns` (default 2 turns) is never pruned.
 - Discard tools: replaced with fixed short text, never cached. Default: `todowrite -> "Successfully updated todos."`, `skill -> "Skill contents omitted..."`.
 - Protected tools: never pruned. Default: `question`.
@@ -73,7 +73,7 @@ Input schema:
 
 Call example: `read_omitted_content({"contentId":"omitted-0001"})`
 
-Returns: cached original text, possibly stale. If missing: `"No omitted content found for Content ID: X in this session. It was cleared by a newer compaction — rerun the tool..."` Then rerun source tool, do not retry IDs.
+Returns: cached original text, possibly stale, capped at 20000 characters with an explicit `TRUNCATED` notice naming the Content ID and both sizes. An unknown ID returns `"No omitted content found for Content ID: X in this session..."`; a known ID whose file was evicted or cleared returns `"[omitted tool output unavailable — the cached original for Content ID: X was cleared by a newer compaction. Rerun the tool to reproduce it.]"` Then rerun source tool, do not retry IDs.
 
 ### Tool C: compact_stats — read your own savings
 
@@ -98,16 +98,16 @@ Call example: `compact_stats({})`
 Returns:
 
 ```text
-[smart-compact] pruned ~130226 tokens across 213 tool results; summarized 0 turns; 13 cached omissions; memo-saved ~0 tokens; last run 1ms; tokenizer off.
+[smart-compact] version 0.2.1; pruned ~130226 tokens across 213 tool results; summarized 0 turns (fallbacks: 0); 13 cached omissions; last run 1ms; measurement heuristic; window 1000000 (opencode-go/model — configured).
 ```
 
-Reading it: `prunedParts` counts tool results that were replaced, `cached omissions` is how many originals `read_omitted_content` can still return, `summarizedTurns` stays 0 unless a compaction with `mode: "compact"` ran, and `memo-saved` counts tokens never remeasured on repeat passes.
+Reading it: `prunedParts` counts tool results that were replaced, `cached omissions` is how many omission records are retained under the store cap (500 files / 8 MiB per session) — an evicted original is still listed here until its mapping is rewritten, but reading it fails closed with the `missing original` notice rather than returning stale text — `summarizedTurns` stays 0 unless a compaction with `mode: "compact"` ran, `fallbacks` counts summaries that degraded to the heuristic, `measurement` names the path that produced the token numbers (`tokenizer` or `heuristic`), and `version` proves which plugin code produced the figures. `— configured` means the window came from `awareness.contextWindowTokens`, not the model registry.
 
 ## 3. Rules for you
 
 1. Never ask Manager to run slash commands in autopilot/auto mode. Call `compact_context` yourself and chain next turn.
 2. Never re-run source tool for pruned output to save tokens — retrieve with `read_omitted_content` by Content ID, else re-run source once if cache miss.
-3. `compact_context` never fails session on over-budget — over-budget still compacts with warning. Budget 0 disables warning.
+3. `compact_context` never fails session on over-budget — over-budget still compacts with warning. The budget follows the model window (`emergencyBudgetRatio`, default 0.6); an explicit `emergencyBudgetTokens` pins it, and a zero ratio or an unknown window disables the warning.
 4. Config: `.opencode/smart-compact.jsonc` (project) overrides `~/.config/opencode/smart-compact.jsonc` (global) overrides defaults. If the global file is missing, create it with the recommended content below. An outside reader or installer LLM follows the same step: create the global file verbatim, then continue.
 ```jsonc
 // Recommended global config. Create `~/.config/opencode/smart-compact.jsonc` with this if missing.
@@ -127,12 +127,17 @@ Reading it: `prunedParts` counts tool results that were replaced, `cached omissi
     "purgeErrors": { "enabled": true, "turns": 4, "protectedTools": ["question"] },
     "stripReasoning": { "enabled": true, "thresholdChars": 500 }
   },
-  "tokens": { "enabled": true, "emergencyBudgetTokens": 50000 },
-  "awareness": { "enabled": true, "warnRatio": 0.7, "emergencyRatio": 0.9, "rearmStep": 0.05, "autoTrimRatio": 0 }
+  "tokens": { "enabled": true, "emergencyBudgetTokens": 0, "emergencyBudgetRatio": 0.6 },
+  "awareness": {
+    "enabled": true, "warnRatio": 0.5, "emergencyRatio": 0.8, "rearmStep": 0.05,
+    "autoTrimRatio": 0.55, "contextWindowTokens": 0
+  }
 }
 ```
 5. Human tools are out of scope. Only the three tools above are agent-callable. Ignore file-system, shell, or Manager UI tools.
 
+`autoTrimRatio: 0.55` is armed by default: a long session trims its own tool output without a `compact_context` call. `contextWindowTokens` is only needed for providers whose model registry entry lacks `limit.context`.
+
 ## 4. Minimal decision flow
 
 IF context heavy AND reasoning stale -> compact_context({"mode":"compact"})
diff --git a/src/DECISIONS.md b/src/DECISIONS.md
index 3ea7b144..d95d06ce 100644
--- a/src/DECISIONS.md
+++ b/src/DECISIONS.md
@@ -26,7 +26,7 @@ The agent is told how full the context window is and how to reclaim room, but th
 
 ## D7 Auto-trim is the only automatic action (2026-10-22)
 
-Context pressure alone may now trigger one action: at `awareness.autoTrimRatio` the hook queues `pending = { mode: "trim", keepTurns: 0 }` for the next request, reusing the same prune pass a manual trim uses. Trimming is the safe half of compaction - no turn is summarized, no user message is touched, and every pruned original is cached under a Content ID - so running it without asking cannot lose the thread of a task. Summarization stays explicit because it replaces turns with summaries and the agent's own reasoning about which detail matters is the only thing that can decide that safely. A pending compaction is never overwritten, and `0` (the shipped default) keeps the plugin purely advisory, so existing installs see no behavior change until they opt in.
+Context pressure alone may now trigger one action: at `awareness.autoTrimRatio` the hook queues `pending = { mode: "trim", keepTurns: 0 }` for the next request, reusing the same prune pass a manual trim uses. Trimming is the safe half of compaction - no turn is summarized, no user message is touched, and every pruned original is cached under a Content ID - so running it without asking cannot lose the thread of a task. Summarization stays explicit because it replaces turns with summaries and the agent's own reasoning about which detail matters is the only thing that can decide that safely. A pending compaction is never overwritten, and `0` disables the action (superseded by D11: the shipped default is now `0.55`, so a default install does engage).
 
 The alternative considered was detecting the task boundary (Brain task id, first user message of a task) and trimming there. It was rejected: the plugin only sees model-visible messages, a heuristic on message text is fragile, and the pressure signal already correlates with the moment relief is needed. See `src/awareness.ts:shouldAutoTrim` and `src/index.ts:runAwareness`.
 
@@ -45,3 +45,27 @@ Two caveats recorded rather than guarded: the guarantee is a property of the run
 ## D10 Awareness silence is recorded, not just kept (2026-10-28)
 
 A session at high fill produced zero advisories with no clue why: the unknown-model path in `runAwareness` returned before measuring, leaving no trace in state, logs, or stats. The silence policy itself is kept — guessing a denominator would fire wrong ratios — but it is now observable: the resolved window and model persist in session state (`awarenessWindow`, `awarenessModel`, both whitelisted in `loadState`), an unknown model logs one console line per model, and `formatStats` ends with either `window <tokens> (<model>)` or `window unknown (<model> — awareness off)`. Malformed values render "unknown", never throw. See `src/index.ts:runAwareness`, `src/actions.ts:formatStats`.
+
+## D11 Auto-trim ships armed (2026-11-03)
+
+A real long session pruned 1,059,881 tokens and summarized 71 turns, but every reclaim was a manual `compact_context` call: `autoTrimRatio` defaulted to `0`, so the only automatic relief in the plugin never ran. Trimming is lossless by construction (notices plus cached originals, no summary, no user message touched), so the safe operation is now the default: `autoTrimRatio: 0.55`, just above `warnRatio`. The existing hysteresis is unchanged — a sustained period queues one trim and the latch re-arms only on growth or after dropping below the line — so this changes *whether* the plugin engages, not *how often* it can. `0` remains the explicit opt-out. See `src/config.ts:DEFAULT_CONFIG`, `src/awareness.ts:shouldAutoTrim`, and the hook-level default-trim test.
+
+## D12 The emergency budget is a share of the window (2026-11-03)
+
+The old absolute 50,000-token budget was 5 percent of a 1M window, so the warning fired from the first few turns and could never be satisfied, which trains an operator to ignore the channel. The budget now derives from the same resolved window the awareness ratio uses: `emergencyBudgetRatio` (0.6) of `limit.context`, with `emergencyBudgetTokens` as an explicit override. With no known window the warning stays off rather than firing against a guessed denominator; a zero ratio is the explicit opt-out. The predicate remains a warning, never a gate. One window lookup per request feeds both the budget and the reminder, so the two thresholds cannot disagree. See `src/config.ts:resolveEmergencyBudget`, `src/index.ts:resolveWindowForRequest`.
+
+## D13 Configured window fallback, labelled as configured (2026-11-03)
+
+`resolveContextLimit` deliberately refuses to guess when a model entry has no `limit.context`, which left the whole advisory subsystem silently inert for such providers. `awareness.contextWindowTokens` now supplies an explicit fallback; it is used only on a registry miss, and both the reminder and the stats line say the denominator is configured rather than measured. With neither source the advisory still stays silent. `awarenessWindowSource` persists alongside the window so the label survives a restart. See `src/awareness.ts:resolveAwarenessWindow`, `src/index.ts:runAwareness`.
+
+## D14 Omission originals live in a bounded file store (2026-11-03)
+
+Session state used to hold the full text of every pruned result, so 397 omissions meant megabytes rewritten on every save, and a retrieval could re-inflate the context pruning had just relieved. Originals now live one file per omission under the plugin data dir; state keeps only the id-to-path mapping. The store is capped at 500 files / 8 MiB per session and evicts oldest-first, retrieval is capped at 20,000 characters with an explicit notice, and a missing file fails closed with the existing missing-original notice. Legacy inline originals migrate on first load; a failed migration keeps the text inline so nothing is lost. See `src/omissions.ts`, `src/store.ts:loadState`, `src/prune.ts:pruneToolResults`.
+
+## D15 The prune memo was removed, not rekeyed (2026-11-03)
+
+`measureMemoized` keyed its cache by `callId`, but a call id identifies one immutable invocation and the prune loop already skips call ids in `state.omittedCalls`; a hit required measuring the same unpruned call twice, a band narrow enough that a real session reported about zero saved tokens. Rekeying by content hash would still pay a hash plus an entry per call for a near-zero hit rate, so the field, the helpers, and the `memo-saved` stat are gone. Legacy state drops `pruneMemo` and `savedTokens` on load. See `src/prune.ts`, `src/store.ts`, `src/actions.ts:formatStats`.
+
+## D16 Stats prove which code and which measurement produced them (2026-11-03)
+
+A review could not tell whether a session ran repository HEAD or the local working tree, nor whether its token figures came from the tokenizer or the heuristic estimate. `compact_stats` now starts with the package version and reports the measurement path used by the last run; it also reports heuristic summary fallbacks, turning a silent quality cliff (a batch whose `<summary>` blocks all missed) into a diagnosable number. No tokenizer dependency was added: the path is reported, not changed by default. See `src/version.ts`, `src/tokens.ts:measurementPath`, `src/summarize.ts:summarizeTurns`.
diff --git a/src/README.md b/src/README.md
index 95051764..d20b5fce 100644
--- a/src/README.md
+++ b/src/README.md
@@ -4,21 +4,25 @@ Entry `index.ts` wires OpenCode V2 plugin: `session.hook("context")` transform,
 
 ## Modules
 
-- `index.ts` — setup, runPrune, measureVisibleCost, notify, runAwareness. No transcript mutation.
-- `actions.ts` — shared `compactNow`, `scheduleTrim`, `parseCompactArgs`, budget/pointer formatters. Single source so tool + commands cannot drift.
-- `awareness.ts` — context-pressure awareness: pure measurement of the model-visible messages, model limit lookup, threshold and latch decision, agent-facing reminder text. No I/O, no state.
+- `index.ts` — setup, runPrune, measureVisibleCost, notify, per-request window resolution, runAwareness. No transcript mutation.
+- `actions.ts` — shared `compactNow`, `scheduleTrim`, `parseCompactArgs`, stats/budget/pointer formatters. Single source so tool + commands cannot drift.
+- `awareness.ts` — context-pressure awareness: pure measurement of the model-visible messages, registry/configured window resolution, threshold and latch decision, agent-facing reminder text. No I/O, no state.
 - `plan.ts` — `buildTurns` groups history by user boundary, `selectTurns` excludes recent window.
-- `summarize.ts` — batched `summarizeTurns` via `ctx.generate.text`, `<summary id>` parse, heuristic fallback.
-- `prune.ts` — `pruneToolResults`, `applyOmissions`, memo, rank, truncate caps, discard/protected rules.
+- `summarize.ts` — batched `summarizeTurns` via `ctx.generate.text`, `<summary id>` parse, heuristic fallback counter.
+- `prune.ts` — `pruneToolResults`, `applyOmissions`, rank, truncate caps, discard/protected rules; writes originals to the omission store.
+- `omissions.ts` — bounded per-session file store for pruned originals, legacy migration, retrieval cap.
 - `strategies.ts` — dedup identical calls, purge stale errors, strip long reasoning.
-- `config.ts` — defaults ← global ← project JSONC, validation warnings, budget state.
-- `store.ts` — per-session `loadState`/`saveState`, backup pointer capped 20.
+- `config.ts` — defaults ← global ← project JSONC, validation warnings, budget derivation/resolution, budget state.
+- `store.ts` — per-session `loadState`/`saveState`, omission migration, backup pointer capped 20.
 - `types.ts` — minimal Msg/Part/SessionState shapes, decoupled from Effect schemas.
-- `tokens.ts` — tokenizer-first counting with fallback.
+- `tokens.ts` — tokenizer-first counting with fallback plus the reported measurement path.
+- `version.ts` — package version for the stats line.
 
 ## Boundaries
 
 - Never import adapters in core. Depend on `Ctx` abstraction.
 - Storage keys `session:<id>` only. No cross-session reads.
 - User messages verbatim. Preserve-recent window always kept.
-- Awareness is advisory: it reminds, it never compacts, never aborts a step, never mutates history.
+- Awareness is advisory: it reminds, it never compacts, never aborts a step, never mutates history. Auto-trim is the one automatic action and is lossless; it is armed at `autoTrimRatio 0.55` by default with the existing one-trim-per-period latch.
+- Session state never holds full tool-output originals: they live in the bounded file store under the plugin data dir, and every retrieval is capped at 20000 characters.
+- Thresholds that depend on the window resolve through one `resolveAwarenessWindow` call per request, so the emergency budget and the awareness ratio cannot use different denominators.
diff --git a/src/actions.ts b/src/actions.ts
index 65b3eed2..48b5518a 100644
--- a/src/actions.ts
+++ b/src/actions.ts
@@ -4,11 +4,19 @@
  * can never drift.
  */
 import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
-import { summarizeTurns } from "./summarize.js";
-import { isOverEmergencyBudget, loadConfig, type BudgetState } from "./config.js";
+import { summarizeTurns, type SummarizeResult } from "./summarize.js";
+import {
+  emergencyBudgetDescription,
+  isOverEmergencyBudget,
+  loadConfig,
+  resolveEmergencyBudget,
+  type BudgetState,
+} from "./config.js";
 import { measureTokens } from "./prune.js";
 import { loadState, saveState, type BackupPointer, type Ctx } from "./store.js";
+import { measurementPath } from "./tokens.js";
 import type { SessionState } from "./types.js";
+import { PLUGIN_VERSION } from "./version.js";
 
 export type CompactMode = "compact" | "trim";
 
@@ -43,36 +51,50 @@ export function parseCompactArgs(input: unknown): CompactArgs {
 /**
  * Summarize the eligible turns now (each becomes a short summary; user
  * messages stay verbatim) and schedule the tool-output prune pass for the next
- * request. Returns the number of turns summarized.
+ * request. Returns how many turns were summarized and how many fell back to
+ * the heuristic.
  *
  * The emergency budget check runs before any work and is a warning only: an
  * over-budget history still compacts, because refusing it would deadlock the
- * sessions that need compaction most. A zero budget disables the warning.
+ * sessions that need compaction most. The budget is derived from the best
+ * denominator this path has — the window persisted by the last awareness pass
+ * — so a 1M-token session is not warned at 50K. An explicit override or no
+ * known window is handled by `resolveEmergencyBudget`.
  */
-export async function compactNow(ctx: Ctx, sessionID: string, keepTurns: number): Promise<number> {
+export async function compactNow(
+  ctx: Ctx,
+  sessionID: string,
+  keepTurns: number,
+): Promise<SummarizeResult> {
   const config = await loadConfig(ctx);
   const state = await loadState(ctx, sessionID);
   const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
   const measuredCost = measureHistoryCost(entries, config);
-  if (isOverEmergencyBudget(measuredCost, config)) {
+  if (isOverEmergencyBudget(measuredCost, config, state.awarenessWindow)) {
+    const budget = resolveEmergencyBudget(config, state.awarenessWindow);
     // Warning only: an explicit compaction request must always proceed, because
     // compaction is the remedy for an over-budget history, not a hazard.
     console.warn(
-      `[smart-compact] history is over the emergency budget of ` +
-        `${config.tokens.emergencyBudgetTokens} tokens (measured ~${measuredCost}); ` +
-        `compacting anyway. Raise tokens.emergencyBudgetTokens to silence this warning.`,
+      `[smart-compact] history is over the emergency budget of ${budget} tokens ` +
+        `(${emergencyBudgetDescription(config, state.awarenessWindow)}; measured ~${measuredCost}); ` +
+        `compacting anyway. Raise tokens.emergencyBudgetTokens or tokens.emergencyBudgetRatio ` +
+        `to silence this warning.`,
     );
   }
   const turns = buildTurns(entries);
-  const summarized = await summarizeTurns(
+  const result = await summarizeTurns(
     ctx,
     selectTurns(turns, keepTurns, config.pruning.preserveRecentTurns),
     state,
   );
-  state.stats.summarizedTurns += summarized;
+  state.stats.summarizedTurns += result.summarized;
+  state.stats.summaryFallbacks += result.fallbacks;
+  // The history cost above was measured with this path; record it so the stats
+  // line names the code that produced the numbers.
+  state.stats.measurementPath = measurementPath(config.tokens.enabled);
   state.pending = { mode: "compact", keepTurns };
   await saveState(ctx, sessionID, state);
-  return summarized;
+  return result;
 }
 
 /**
@@ -118,13 +140,17 @@ export function formatStats(state: SessionState): string {
   const prunedTokens = num(stats?.prunedTokens);
   const prunedParts = num(stats?.prunedParts);
   const summarizedTurns = num(stats?.summarizedTurns);
-  const savedTokens = num(stats?.savedTokens);
+  const summaryFallbacks = num(stats?.summaryFallbacks);
   const lastRunMs = num(stats?.lastRunMs);
   const cached = state?.omissions && typeof state.omissions === "object" ? Object.keys(state.omissions).length : 0;
-  const tokenizer = stats?.tokenizerUsed === true ? "on" : "off";
+  // Which measurement path produced the numbers: the optional tokenizer or the
+  // built-in estimate. Defaults to heuristic for a fresh or legacy session.
+  const measurement = stats?.measurementPath === "tokenizer" ? "tokenizer" : "heuristic";
   // Awareness denominator, so a silent advisory is diagnosable from the same
   // line: either the resolved window plus the model it came from, or the
-  // model the registry failed on. Malformed values render "unknown", never throw.
+  // model the registry failed on. A configured fallback is called out so the
+  // operator knows the denominator was supplied, not measured. Malformed
+  // values render "unknown", never throw.
   const windowTokens =
     typeof state?.awarenessWindow === "number" && Number.isFinite(state.awarenessWindow) && state.awarenessWindow > 0
       ? Math.floor(state.awarenessWindow)
@@ -133,15 +159,15 @@ export function formatStats(state: SessionState): string {
     typeof state?.awarenessModel === "string" && state.awarenessModel.length > 0
       ? state.awarenessModel
       : "no model seen yet";
+  const configured = state?.awarenessWindowSource === "config" ? " — configured" : "";
   const windowPart =
     windowTokens > 0
-      ? `window ${windowTokens} (${modelName})`
+      ? `window ${windowTokens} (${modelName}${configured})`
       : `window unknown (${modelName} — awareness off)`;
   return (
-    `[smart-compact] pruned ~${prunedTokens} tokens across ${prunedParts} tool results; ` +
-    `summarized ${summarizedTurns} turns; ${cached} cached omissions; ` +
-    `memo-saved ~${savedTokens} tokens; last run ${lastRunMs}ms; ` +
-    `tokenizer ${tokenizer}; ${windowPart}.`
+    `[smart-compact] version ${PLUGIN_VERSION}; pruned ~${prunedTokens} tokens across ${prunedParts} tool results; ` +
+    `summarized ${summarizedTurns} turns (fallbacks: ${summaryFallbacks}); ${cached} cached omissions; ` +
+    `last run ${lastRunMs}ms; measurement ${measurement}; ${windowPart}.`
   );
 }
 
diff --git a/src/awareness.ts b/src/awareness.ts
index a000975f..42be975f 100644
--- a/src/awareness.ts
+++ b/src/awareness.ts
@@ -99,6 +99,41 @@ export function resolveContextLimit(
   return Math.floor(limit);
 }
 
+/** Where the denominator of the pressure ratio came from. */
+export type WindowSource = "registry" | "config";
+
+/** A resolved denominator for the pressure ratio. */
+export interface ResolvedWindow {
+  /** Effective window in tokens, or absent when neither source exists. */
+  limitTokens?: number;
+  /** `registry` when `limit.context` supplied it, `config` for the fallback. */
+  source?: WindowSource;
+}
+
+/**
+ * Resolve the window a session is measured against: the model registry first,
+ * then the configured `awareness.contextWindowTokens` fallback. The fallback is
+ * used only when the registry entry is missing or carries no usable limit, so
+ * a provider that omits `limit.context` still gets a pressure ratio — and the
+ * reminder can say the denominator is configured rather than measured.
+ */
+export function resolveAwarenessWindow(
+  modelRef: { providerID: string; id: string },
+  models: ReadonlyArray<AwarenessModel>,
+  configuredTokens?: number,
+): ResolvedWindow {
+  const registry = resolveContextLimit(modelRef, models);
+  if (registry !== undefined) return { limitTokens: registry, source: "registry" };
+  if (
+    typeof configuredTokens === "number" &&
+    Number.isFinite(configuredTokens) &&
+    configuredTokens > 0
+  ) {
+    return { limitTokens: Math.floor(configuredTokens), source: "config" };
+  }
+  return {};
+}
+
 /**
  * The pressure level for a fill ratio. `emergency` wins over `warn`; a ratio
  * below the warn threshold is `none` and produces no reminder.
@@ -200,8 +235,10 @@ export function buildAwarenessMessage(args: {
   limitTokens: number;
   ratioPct: number;
   level: AwarenessWarnLevel;
+  /** How the denominator was obtained; `config` is called out explicitly. */
+  windowSource?: WindowSource;
 }): string {
-  const { usedTokens, limitTokens, ratioPct, level } = args;
+  const { usedTokens, limitTokens, ratioPct, level, windowSource } = args;
   const isEmergency = level === "emergency";
   const status = isEmergency
     ? "emergency context pressure - immediate action required"
@@ -209,11 +246,15 @@ export function buildAwarenessMessage(args: {
   const firstLine = isEmergency
     ? "COMPACT NOW — search your tool list for `compact_context` and call it immediately."
     : "ACT NOW — search your tool list for `compact_context` and call it before continuing.";
+  const configuredNote =
+    windowSource === "config"
+      ? `\nDenominator note: the model registry carries no \`limit.context\` for this model, so ${limitTokens} is the configured \`awareness.contextWindowTokens\` value. Treat the percentage as approximate.\n`
+      : "";
   const lines: string[] = [
     firstLine,
     "",
     `[smart-compact] CONTEXT PRESSURE - ${ratioPct}% of the context window is in use (about ${usedTokens} of ${limitTokens} measured tokens).`,
-    "",
+    ...(configuredNote ? [configuredNote] : []),
     `Status: ${status}. The measured fill is a lower bound: it counts only the model-visible messages, while provider system prompts and tool schemas are invisible to the plugin, so the true usage is higher than this number.`,
     "",
     "If you ignore this and the session overflows, in-flight work is dropped and cannot be recovered. Do not let sessions or turns silently overflow.",
diff --git a/src/config.ts b/src/config.ts
index f4f1e0c6..387012ff 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -34,8 +34,14 @@ export interface StrategiesConfig {
 export interface TokensConfig {
   /** Enable measured counting; false keeps the dependency-free fallback. */
   enabled: boolean;
-  /** Abort a compaction run above this measured cost. 0 disables the guard. */
+  /**
+   * Explicit absolute emergency budget in tokens. `0` (the default) derives
+   * the budget from the resolved context window instead, so the warning scales
+   * with the model rather than firing forever on a large window.
+   */
   emergencyBudgetTokens: number;
+  /** Fraction of the resolved window used when the budget is derived. */
+  emergencyBudgetRatio: number;
 }
 
 /**
@@ -59,6 +65,12 @@ export interface AwarenessConfig {
    * cost is a cache round-trip through `read_omitted_content`.
    */
   autoTrimRatio: number;
+  /**
+   * Fallback context window in tokens, used only when the model registry entry
+   * carries no usable `limit.context`. `0` (the default) keeps awareness
+   * silent for such a model instead of guessing a denominator.
+   */
+  contextWindowTokens: number;
 }
 
 export interface SmartCompactConfig {
@@ -69,6 +81,9 @@ export interface SmartCompactConfig {
   awareness: AwarenessConfig;
 }
 
+/** Default share of the resolved window used as the emergency budget. */
+export const DEFAULT_EMERGENCY_BUDGET_RATIO = 0.6;
+
 export const DEFAULT_CONFIG: SmartCompactConfig = {
   enabled: true,
   pruning: {
@@ -80,7 +95,8 @@ export const DEFAULT_CONFIG: SmartCompactConfig = {
     alwaysPruneTools: ["read"],
     discardTools: {
       todowrite: "Successfully updated todos.",
-      skill: "Skill contents omitted after compaction; recall the skill if needed.",
+      skill:
+        "Skill contents omitted after compaction; recall the skill if needed.",
     },
     preserveRecentTurns: 2,
     truncateToolsChars: 1024,
@@ -91,8 +107,19 @@ export const DEFAULT_CONFIG: SmartCompactConfig = {
     purgeErrors: { enabled: true, turns: 4, protectedTools: ["question"] },
     stripReasoning: { enabled: true, thresholdChars: 500 },
   },
-  tokens: { enabled: false, emergencyBudgetTokens: 50000 },
-  awareness: { enabled: true, warnRatio: 0.5, emergencyRatio: 0.8, rearmStep: 0.05, autoTrimRatio: 0 },
+  tokens: {
+    enabled: false,
+    emergencyBudgetTokens: 0,
+    emergencyBudgetRatio: DEFAULT_EMERGENCY_BUDGET_RATIO,
+  },
+  awareness: {
+    enabled: true,
+    warnRatio: 0.5,
+    emergencyRatio: 0.8,
+    rearmStep: 0.05,
+    autoTrimRatio: 0.55,
+    contextWindowTokens: 0,
+  },
 };
 
 /** Strip JSONC comments and trailing commas. Best-effort; never throws. */
@@ -121,7 +148,8 @@ function stripJsonc(text: string): string {
     }
     if (ch === "/" && next === "*") {
       i += 2;
-      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
+      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/"))
+        i += 1;
       i += 1;
       continue;
     }
@@ -138,12 +166,37 @@ function asRecord(value: unknown): Record<string, unknown> | undefined {
 
 /** A fill ratio must be a finite number strictly inside (0, 1). */
 function isValidRatio(value: unknown): value is number {
-  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1;
+  return (
+    typeof value === "number" &&
+    Number.isFinite(value) &&
+    value > 0 &&
+    value < 1
+  );
 }
 
 /** A re-arm step must be a finite number strictly inside (0, 0.5). */
 function isValidRearmStep(value: unknown): value is number {
-  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 0.5;
+  return (
+    typeof value === "number" &&
+    Number.isFinite(value) &&
+    value > 0 &&
+    value < 0.5
+  );
+}
+
+/** A derived-budget fraction must be finite and inside (0, 1]; 0 disables. */
+function isValidBudgetRatio(value: unknown): value is number {
+  return (
+    typeof value === "number" &&
+    Number.isFinite(value) &&
+    value >= 0 &&
+    value <= 1
+  );
+}
+
+/** A configured fallback window must be a positive whole number of tokens. */
+function isValidWindowTokens(value: unknown): value is number {
+  return typeof value === "number" && Number.isInteger(value) && value > 0;
 }
 
 /**
@@ -152,15 +205,23 @@ function isValidRearmStep(value: unknown): value is number {
  * escalation unreachable, so both fall back to the base values together.
  * Sibling keys survive a partial update.
  */
-function mergeAwareness(base: AwarenessConfig, patch: unknown): AwarenessConfig {
+function mergeAwareness(
+  base: AwarenessConfig,
+  patch: unknown,
+): AwarenessConfig {
   const record = asRecord(patch);
   if (!record) return base;
-  const enabled = typeof record.enabled === "boolean" ? record.enabled : base.enabled;
-  const warnRatio = isValidRatio(record.warnRatio) ? record.warnRatio : base.warnRatio;
+  const enabled =
+    typeof record.enabled === "boolean" ? record.enabled : base.enabled;
+  const warnRatio = isValidRatio(record.warnRatio)
+    ? record.warnRatio
+    : base.warnRatio;
   const emergencyRatio = isValidRatio(record.emergencyRatio)
     ? record.emergencyRatio
     : base.emergencyRatio;
-  const rearmStep = isValidRearmStep(record.rearmStep) ? record.rearmStep : base.rearmStep;
+  const rearmStep = isValidRearmStep(record.rearmStep)
+    ? record.rearmStep
+    : base.rearmStep;
   // 0 is a valid value here: it means "never auto-trim", the shipped default.
   const autoTrimRatio =
     record.autoTrimRatio === 0
@@ -168,6 +229,13 @@ function mergeAwareness(base: AwarenessConfig, patch: unknown): AwarenessConfig
       : isValidRatio(record.autoTrimRatio)
         ? record.autoTrimRatio
         : base.autoTrimRatio;
+  // 0 means "no configured denominator"; a positive integer is accepted.
+  const contextWindowTokens =
+    record.contextWindowTokens === 0
+      ? 0
+      : isValidWindowTokens(record.contextWindowTokens)
+        ? record.contextWindowTokens
+        : base.contextWindowTokens;
   // Ordering guard: the warn threshold must stay below the emergency one.
   if (warnRatio >= emergencyRatio) {
     return {
@@ -176,12 +244,23 @@ function mergeAwareness(base: AwarenessConfig, patch: unknown): AwarenessConfig
       emergencyRatio: base.emergencyRatio,
       rearmStep,
       autoTrimRatio,
+      contextWindowTokens,
     };
   }
-  return { enabled, warnRatio, emergencyRatio, rearmStep, autoTrimRatio };
+  return {
+    enabled,
+    warnRatio,
+    emergencyRatio,
+    rearmStep,
+    autoTrimRatio,
+    contextWindowTokens,
+  };
 }
 
-function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConfig {
+function mergeConfig(
+  base: SmartCompactConfig,
+  patch: unknown,
+): SmartCompactConfig {
   const p = asRecord(patch);
   if (!p) return base;
   const pruning = asRecord(p.pruning);
@@ -193,17 +272,33 @@ function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConf
   return {
     enabled: typeof p.enabled === "boolean" ? p.enabled : base.enabled,
     pruning: {
-      maxChars: typeof pruning?.maxChars === "number" ? pruning.maxChars : base.pruning.maxChars,
-      maxWords: typeof pruning?.maxWords === "number" ? pruning.maxWords : base.pruning.maxWords,
-      taskMaxChars: typeof pruning?.taskMaxChars === "number" ? pruning.taskMaxChars : base.pruning.taskMaxChars,
-      taskMaxWords: typeof pruning?.taskMaxWords === "number" ? pruning.taskMaxWords : base.pruning.taskMaxWords,
+      maxChars:
+        typeof pruning?.maxChars === "number"
+          ? pruning.maxChars
+          : base.pruning.maxChars,
+      maxWords:
+        typeof pruning?.maxWords === "number"
+          ? pruning.maxWords
+          : base.pruning.maxWords,
+      taskMaxChars:
+        typeof pruning?.taskMaxChars === "number"
+          ? pruning.taskMaxChars
+          : base.pruning.taskMaxChars,
+      taskMaxWords:
+        typeof pruning?.taskMaxWords === "number"
+          ? pruning.taskMaxWords
+          : base.pruning.taskMaxWords,
       protectedTools: Array.isArray(pruning?.protectedTools)
         ? (pruning.protectedTools as string[])
         : base.pruning.protectedTools,
       alwaysPruneTools: Array.isArray(pruning?.alwaysPruneTools)
         ? (pruning.alwaysPruneTools as string[])
         : base.pruning.alwaysPruneTools,
-      discardTools: { ...base.pruning.discardTools, ...(asRecord(pruning?.discardTools) as Record<string, string> | undefined) },
+      discardTools: {
+        ...base.pruning.discardTools,
+        ...(asRecord(pruning?.discardTools) as
+          Record<string, string> | undefined),
+      },
       preserveRecentTurns:
         typeof pruning?.preserveRecentTurns === "number"
           ? pruning.preserveRecentTurns
@@ -212,34 +307,59 @@ function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConf
         typeof pruning?.truncateToolsChars === "number"
           ? pruning.truncateToolsChars
           : base.pruning.truncateToolsChars,
-      useTokens: typeof pruning?.useTokens === "boolean" ? pruning.useTokens : base.pruning.useTokens,
+      useTokens:
+        typeof pruning?.useTokens === "boolean"
+          ? pruning.useTokens
+          : base.pruning.useTokens,
     },
     strategies: {
       deduplication: {
-        enabled: typeof dedup?.enabled === "boolean" ? dedup.enabled : base.strategies.deduplication.enabled,
+        enabled:
+          typeof dedup?.enabled === "boolean"
+            ? dedup.enabled
+            : base.strategies.deduplication.enabled,
         protectedTools: Array.isArray(dedup?.protectedTools)
           ? (dedup.protectedTools as string[])
           : base.strategies.deduplication.protectedTools,
       },
       purgeErrors: {
-        enabled: typeof purge?.enabled === "boolean" ? purge.enabled : base.strategies.purgeErrors.enabled,
-        turns: typeof purge?.turns === "number" ? purge.turns : base.strategies.purgeErrors.turns,
+        enabled:
+          typeof purge?.enabled === "boolean"
+            ? purge.enabled
+            : base.strategies.purgeErrors.enabled,
+        turns:
+          typeof purge?.turns === "number"
+            ? purge.turns
+            : base.strategies.purgeErrors.turns,
         protectedTools: Array.isArray(purge?.protectedTools)
           ? (purge.protectedTools as string[])
           : base.strategies.purgeErrors.protectedTools,
       },
       stripReasoning: {
-        enabled: typeof strip?.enabled === "boolean" ? strip.enabled : base.strategies.stripReasoning.enabled,
+        enabled:
+          typeof strip?.enabled === "boolean"
+            ? strip.enabled
+            : base.strategies.stripReasoning.enabled,
         thresholdChars:
-          typeof strip?.thresholdChars === "number" ? strip.thresholdChars : base.strategies.stripReasoning.thresholdChars,
+          typeof strip?.thresholdChars === "number"
+            ? strip.thresholdChars
+            : base.strategies.stripReasoning.thresholdChars,
       },
     },
     tokens: {
-      enabled: typeof tokens?.enabled === "boolean" ? tokens.enabled : base.tokens.enabled,
+      enabled:
+        typeof tokens?.enabled === "boolean"
+          ? tokens.enabled
+          : base.tokens.enabled,
       emergencyBudgetTokens:
-        typeof tokens?.emergencyBudgetTokens === "number"
+        typeof tokens?.emergencyBudgetTokens === "number" &&
+        Number.isFinite(tokens.emergencyBudgetTokens) &&
+        tokens.emergencyBudgetTokens >= 0
           ? tokens.emergencyBudgetTokens
           : base.tokens.emergencyBudgetTokens,
+      emergencyBudgetRatio: isValidBudgetRatio(tokens?.emergencyBudgetRatio)
+        ? tokens.emergencyBudgetRatio
+        : base.tokens.emergencyBudgetRatio,
     },
     awareness: mergeAwareness(base.awareness, p.awareness),
   };
@@ -264,12 +384,23 @@ const KNOWN_KEYS: Record<string, readonly string[]> = {
   "strategies.deduplication": ["enabled", "protectedTools"],
   "strategies.purgeErrors": ["enabled", "turns", "protectedTools"],
   "strategies.stripReasoning": ["enabled", "thresholdChars"],
-  tokens: ["enabled", "emergencyBudgetTokens"],
-  awareness: ["enabled", "warnRatio", "emergencyRatio", "rearmStep", "autoTrimRatio"],
+  tokens: ["enabled", "emergencyBudgetTokens", "emergencyBudgetRatio"],
+  awareness: [
+    "enabled",
+    "warnRatio",
+    "emergencyRatio",
+    "rearmStep",
+    "autoTrimRatio",
+    "contextWindowTokens",
+  ],
 };
 
 /** Collect one warning per unknown key, naming its exact dotted path. */
-function collectUnknown(record: Record<string, unknown>, section: string, out: string[]): void {
+function collectUnknown(
+  record: Record<string, unknown>,
+  section: string,
+  out: string[],
+): void {
   for (const key of Object.keys(record)) {
     const known = KNOWN_KEYS[section] ?? [];
     if (!known.includes(key)) {
@@ -300,7 +431,10 @@ export function validateConfig(raw: unknown): string[] {
     }
   }
   const tokens = asRecord(root.tokens);
-  if (tokens) collectUnknown(tokens, "tokens", warnings);
+  if (tokens) {
+    collectUnknown(tokens, "tokens", warnings);
+    warnings.push(...validateTokens(tokens));
+  }
   const awareness = asRecord(root.awareness);
   if (awareness) {
     collectUnknown(awareness, "awareness", warnings);
@@ -309,6 +443,33 @@ export function validateConfig(raw: unknown): string[] {
   return warnings;
 }
 
+/**
+ * Range checks for the token section. An explicit budget may be 0 (derive)
+ * or any non-negative number; the derived fraction must be inside (0, 1], or
+ * 0 to disable the window-scaled warning.
+ */
+export function validateTokens(raw: unknown): string[] {
+  const warnings: string[] = [];
+  const record = asRecord(raw);
+  if (!record) return warnings;
+  const budget = record.emergencyBudgetTokens;
+  if (
+    budget !== undefined &&
+    (typeof budget !== "number" || !Number.isFinite(budget) || budget < 0)
+  ) {
+    warnings.push(
+      "Invalid config value: tokens.emergencyBudgetTokens must be 0 (derive from the window) or a positive token count",
+    );
+  }
+  const ratio = record.emergencyBudgetRatio;
+  if (ratio !== undefined && !isValidBudgetRatio(ratio)) {
+    warnings.push(
+      "Invalid config value: tokens.emergencyBudgetRatio must be 0 (disabled) or a number greater than 0 and at most 1",
+    );
+  }
+  return warnings;
+}
+
 /**
  * Range checks for the awareness section. Returns one warning per invalid
  * value, naming the exact key path. The merge layer drops invalid values
@@ -337,12 +498,30 @@ export function validateAwareness(raw: unknown): string[] {
     );
   }
   const autoTrimRatio = record.autoTrimRatio;
-  if (autoTrimRatio !== undefined && autoTrimRatio !== 0 && !isValidRatio(autoTrimRatio)) {
+  if (
+    autoTrimRatio !== undefined &&
+    autoTrimRatio !== 0 &&
+    !isValidRatio(autoTrimRatio)
+  ) {
     warnings.push(
       "Invalid config value: awareness.autoTrimRatio must be 0 or a number greater than 0 and less than 1",
     );
   }
-  if (isValidRatio(warnRatio) && isValidRatio(emergencyRatio) && warnRatio >= emergencyRatio) {
+  const contextWindowTokens = record.contextWindowTokens;
+  if (
+    contextWindowTokens !== undefined &&
+    contextWindowTokens !== 0 &&
+    !isValidWindowTokens(contextWindowTokens)
+  ) {
+    warnings.push(
+      "Invalid config value: awareness.contextWindowTokens must be 0 or a positive whole number of tokens",
+    );
+  }
+  if (
+    isValidRatio(warnRatio) &&
+    isValidRatio(emergencyRatio) &&
+    warnRatio >= emergencyRatio
+  ) {
     warnings.push(
       "Invalid config value: awareness.warnRatio must be less than awareness.emergencyRatio",
     );
@@ -351,16 +530,89 @@ export function validateAwareness(raw: unknown): string[] {
 }
 
 /**
- * Whether the measured token cost is over the configured emergency budget.
+ * The effective emergency budget in tokens.
+ *
+ * An explicit `tokens.emergencyBudgetTokens` (> 0) always wins, so an operator
+ * can pin an exact number. Otherwise the budget is `emergencyBudgetRatio`
+ * (default 60 percent) of the resolved context window. With no known window the
+ * result is 0, which disables the warning: guessing a denominator is the same
+ * mistake the awareness module already avoids, and an absolute default is what
+ * made the old 50K warning fire forever on a 1M-token model.
+ */
+export function resolveEmergencyBudget(
+  config: SmartCompactConfig,
+  limitTokens?: number,
+): number {
+  const override = config?.tokens?.emergencyBudgetTokens;
+  if (
+    typeof override === "number" &&
+    Number.isFinite(override) &&
+    override > 0
+  ) {
+    return Math.floor(override);
+  }
+  const ratio = config?.tokens?.emergencyBudgetRatio;
+  const safeRatio = isValidBudgetRatio(ratio)
+    ? ratio
+    : DEFAULT_EMERGENCY_BUDGET_RATIO;
+  // A zero fraction is the explicit opt-out for the derived warning.
+  if (safeRatio <= 0) return 0;
+  if (
+    typeof limitTokens !== "number" ||
+    !Number.isFinite(limitTokens) ||
+    limitTokens <= 0
+  ) {
+    return 0;
+  }
+  return Math.floor(limitTokens * safeRatio);
+}
+
+/**
+ * Human-readable provenance for the effective budget, so a warning says where
+ * the number came from instead of repeating an opaque threshold.
+ */
+export function emergencyBudgetDescription(
+  config: SmartCompactConfig,
+  limitTokens?: number,
+): string {
+  const override = config?.tokens?.emergencyBudgetTokens;
+  if (
+    typeof override === "number" &&
+    Number.isFinite(override) &&
+    override > 0
+  ) {
+    return "configured via tokens.emergencyBudgetTokens";
+  }
+  if (
+    typeof limitTokens === "number" &&
+    Number.isFinite(limitTokens) &&
+    limitTokens > 0
+  ) {
+    const ratio = config?.tokens?.emergencyBudgetRatio;
+    const safeRatio = isValidBudgetRatio(ratio)
+      ? ratio
+      : DEFAULT_EMERGENCY_BUDGET_RATIO;
+    return `${Math.round(safeRatio * 100)}% of the ${Math.floor(limitTokens)}-token window`;
+  }
+  return "derived budget disabled (no context window known)";
+}
+
+/**
+ * Whether the measured token cost is over the effective emergency budget.
  *
  * This is a WARNING signal, never a gate: an over-budget history is exactly the
  * history that needs compaction, so refusing to compact it deadlocks the
  * session. Callers warn (and may notify) and then continue the work they were
- * asked to do. A budget of 0 disables the warning explicitly.
+ * asked to do. A budget of 0 (explicit, or because no window is known)
+ * disables the warning.
  */
-export function isOverEmergencyBudget(measuredTokens: number, config: SmartCompactConfig): boolean {
-  const budget = config.tokens.emergencyBudgetTokens;
-  if (typeof budget !== "number" || budget <= 0) return false;
+export function isOverEmergencyBudget(
+  measuredTokens: number,
+  config: SmartCompactConfig,
+  limitTokens?: number,
+): boolean {
+  const budget = resolveEmergencyBudget(config, limitTokens);
+  if (budget <= 0) return false;
   return measuredTokens > budget;
 }
 
@@ -401,12 +653,25 @@ export const PRUNE_WEIGHTS = {
  * Returns ratio clamped 0 to 1 and level by fixed thresholds.
  * Safe divide: non-positive limit yields ratio 0 and normal level.
  */
-export function getBudgetState(usedTokens: number, limitTokens: number): BudgetState {
+export function getBudgetState(
+  usedTokens: number,
+  limitTokens: number,
+): BudgetState {
   // Guard non-finite or non-positive limits first — no budget means no pressure.
-  if (typeof usedTokens !== "number" || !Number.isFinite(usedTokens)) usedTokens = 0;
-  if (typeof limitTokens !== "number" || !Number.isFinite(limitTokens) || limitTokens <= 0) {
+  if (typeof usedTokens !== "number" || !Number.isFinite(usedTokens))
+    usedTokens = 0;
+  if (
+    typeof limitTokens !== "number" ||
+    !Number.isFinite(limitTokens) ||
+    limitTokens <= 0
+  ) {
     // No measurable limit: report empty usage, never warn.
-    return { usedTokens: Math.max(0, usedTokens), limitTokens, ratio: 0, level: "normal" };
+    return {
+      usedTokens: Math.max(0, usedTokens),
+      limitTokens,
+      ratio: 0,
+      level: "normal",
+    };
   }
   // Clamp negative usage to zero, overuse to ratio 1.
   const safeUsed = Math.max(0, usedTokens);
@@ -415,7 +680,11 @@ export function getBudgetState(usedTokens: number, limitTokens: number): BudgetS
   const ratio = raw < 0 ? 0 : raw > 1 ? 1 : raw;
   // Fixed thresholds: emergency wins over warn.
   const level: BudgetLevel =
-    ratio >= BUDGET_EMERGENCY_RATIO ? "emergency" : ratio >= BUDGET_WARN_RATIO ? "warn" : "normal";
+    ratio >= BUDGET_EMERGENCY_RATIO
+      ? "emergency"
+      : ratio >= BUDGET_WARN_RATIO
+        ? "warn"
+        : "normal";
   return { usedTokens: safeUsed, limitTokens, ratio, level };
 }
 
@@ -439,14 +708,18 @@ export async function loadConfig(ctx: Ctx): Promise<SmartCompactConfig> {
   let config = DEFAULT_CONFIG;
   const global = await readConfigFile(globalConfigPath());
   if (global) {
-    for (const warning of validateConfig(global)) console.warn(`[smart-compact] ${warning} (global config)`);
+    for (const warning of validateConfig(global))
+      console.warn(`[smart-compact] ${warning} (global config)`);
     config = mergeConfig(config, global);
   }
   const directory = (ctx.location as { directory?: string }).directory;
   if (directory) {
-    const project = await readConfigFile(join(directory, ".opencode", "smart-compact.jsonc"));
+    const project = await readConfigFile(
+      join(directory, ".opencode", "smart-compact.jsonc"),
+    );
     if (project) {
-      for (const warning of validateConfig(project)) console.warn(`[smart-compact] ${warning} (project config)`);
+      for (const warning of validateConfig(project))
+        console.warn(`[smart-compact] ${warning} (project config)`);
       config = mergeConfig(config, project);
     }
   }
diff --git a/src/index.ts b/src/index.ts
index f9c77c3a..62973ca8 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -17,16 +17,35 @@ import {
   buildAwarenessMessage,
   getAwarenessLevel,
   measureVisibleTokens,
-  resolveContextLimit,
+  resolveAwarenessWindow,
   shouldAutoTrim,
   shouldFireAwareness,
   type AwarenessModel,
+  type ResolvedWindow,
 } from "./awareness.js";
-import { applyOmissions, measureTokens, pruneToolResults, serializeResult } from "./prune.js";
+import {
+  applyOmissions,
+  measureTokens,
+  missingOmissionNotice,
+  pruneToolResults,
+  serializeResult,
+} from "./prune.js";
+import {
+  MAX_OMISSION_RESPONSE_CHARS,
+  boundOmissionResponse,
+  readOmissionOriginal,
+} from "./omissions.js";
 import { applyStrategies } from "./strategies.js";
-import { getBudgetState, isOverEmergencyBudget, loadConfig, type SmartCompactConfig } from "./config.js";
+import {
+  emergencyBudgetDescription,
+  getBudgetState,
+  isOverEmergencyBudget,
+  loadConfig,
+  resolveEmergencyBudget,
+  type SmartCompactConfig,
+} from "./config.js";
 import { loadState, saveState, writeBackupPointer, type Ctx } from "./store.js";
-import { isTokenizerAvailable } from "./tokens.js";
+import { measurementPath } from "./tokens.js";
 import type { Msg, SessionState } from "./types.js";
 
 const COMPACT = "magic-compact";
@@ -61,6 +80,7 @@ async function runPrune(
   sessionID: string,
   messages: Msg[],
   config: SmartCompactConfig,
+  limitTokens?: number,
 ): Promise<SessionState> {
   const started = Date.now();
   const state = await loadState(ctx, sessionID);
@@ -68,24 +88,28 @@ async function runPrune(
   // prune pass here would remove the only size relief a large session has, so an
   // over-budget context still gets pruned and still gets its warning.
   const measured = measureVisibleCost(messages, config);
+  // The budget is a share of the resolved window (or an explicit override), so
+  // a 1M-token model is not warned from the first few turns. No window means
+  // no derived budget, which disables the warning instead of guessing.
+  const budgetLimit = resolveEmergencyBudget(config, limitTokens);
   // D1 meter: display-only budget ratio before prune, never changes behavior.
   // Guard legacy or partial config/state — fail closed to empty, never throw.
-  const budgetLimit = config?.tokens?.emergencyBudgetTokens ?? 0;
   const beforeMeter = getBudgetState(measured, budgetLimit);
   console.log(`[smart-compact] ${formatBudgetMeter(beforeMeter)} before prune.`);
-  if (isOverEmergencyBudget(measured, config)) {
+  if (isOverEmergencyBudget(measured, config, limitTokens)) {
     const text =
       `[smart-compact] context is over the emergency budget of ` +
-      `${config.tokens.emergencyBudgetTokens} tokens (measured ~${measured}); ` +
-      `pruning anyway. Raise tokens.emergencyBudgetTokens to silence this warning.`;
+      `${budgetLimit} tokens (${emergencyBudgetDescription(config, limitTokens)}; ` +
+      `measured ~${measured}); pruning anyway. Raise tokens.emergencyBudgetTokens ` +
+      `or tokens.emergencyBudgetRatio to silence this warning.`;
     console.warn(text);
     await notify(ctx, sessionID, text);
   }
   const strategies = applyStrategies(messages, config);
-  const pruned = pruneToolResults(messages, state, config);
+  const pruned = pruneToolResults(messages, state, config, sessionID);
   // D1 meter: display-only ratio after prune for observable headroom.
   const afterCost = measureVisibleCost(messages, config);
-  const afterMeter = getBudgetState(afterCost, config?.tokens?.emergencyBudgetTokens ?? 0);
+  const afterMeter = getBudgetState(afterCost, budgetLimit);
   console.log(`[smart-compact] ${formatBudgetMeter(afterMeter)} after prune.`);
   // D3 pointer (post-prune restore source): fresh keys plus after-prune ratio.
   // Best-effort with warn — a pointer failure never blocks prune (V5).
@@ -103,10 +127,9 @@ async function runPrune(
   }
   state.stats.prunedParts += pruned.pruned + strategies.pruned;
   state.stats.prunedTokens += pruned.tokens + strategies.tokens;
-  state.stats.savedTokens += pruned.memoTokens;
   state.stats.lastRun = Date.now();
   state.stats.lastRunMs = Date.now() - started;
-  state.stats.tokenizerUsed = isTokenizerAvailable();
+  state.stats.measurementPath = measurementPath(config.tokens.enabled);
   state.pending = null;
   await saveState(ctx, sessionID, state);
   return state;
@@ -129,6 +152,56 @@ function measureVisibleCost(messages: Msg[], config: SmartCompactConfig): number
   return total;
 }
 
+/** One registry-failure warning per process, so a broken registry is not noise. */
+let warnedRegistryFailure = false;
+
+/** The model registry as a plain list, tolerating both known response shapes. */
+async function listModels(ctx: Ctx): Promise<ReadonlyArray<AwarenessModel>> {
+  const payload = (await ctx.model.list()) as unknown;
+  return Array.isArray(payload)
+    ? (payload as ReadonlyArray<AwarenessModel>)
+    : ((payload as { data?: ReadonlyArray<AwarenessModel> })?.data ?? []);
+}
+
+/**
+ * Resolve the window once per model request: the registry limit first, then
+ * the configured `awareness.contextWindowTokens` fallback. The same result
+ * feeds the emergency budget and the awareness reminder, so the two cannot
+ * use different denominators.
+ */
+async function resolveWindowForRequest(
+  ctx: Ctx,
+  event: unknown,
+  config: SmartCompactConfig,
+): Promise<ResolvedWindow> {
+  try {
+    const modelRef = (event as { model?: unknown }).model as
+      | { providerID: string; id: string }
+      | undefined;
+    if (!modelRef || typeof modelRef.providerID !== "string" || typeof modelRef.id !== "string") {
+      return {};
+    }
+    let models: ReadonlyArray<AwarenessModel> = [];
+    try {
+      models = await listModels(ctx);
+    } catch (error) {
+      // The configured fallback can still provide a denominator, so carry on.
+      if (!warnedRegistryFailure) {
+        warnedRegistryFailure = true;
+        console.warn(
+          `[smart-compact] model registry unavailable: ${(error as Error)?.message ?? error}; ` +
+            `continuing with awareness.contextWindowTokens when configured.`,
+        );
+      }
+    }
+    return resolveAwarenessWindow(modelRef, models, config.awareness.contextWindowTokens);
+  } catch (error) {
+    // Never break the model call over a window lookup.
+    console.warn(`[smart-compact] window resolution failed: ${(error as Error)?.message ?? error}`);
+    return {};
+  }
+}
+
 /**
  * Context-pressure awareness: tell the agent how full the context window is
  * once it crosses the configured ratio, and how to reclaim room.
@@ -145,6 +218,7 @@ async function runAwareness(
   event: unknown,
   messages: Msg[],
   config: SmartCompactConfig,
+  window: ResolvedWindow,
 ): Promise<void> {
   try {
     const awareness = config.awareness;
@@ -155,33 +229,41 @@ async function runAwareness(
       | { providerID: string; id: string }
       | undefined;
     if (!modelRef) return;
-    const payload = (await ctx.model.list()) as unknown;
-    const models: ReadonlyArray<AwarenessModel> = Array.isArray(payload)
-      ? (payload as ReadonlyArray<AwarenessModel>)
-      : ((payload as { data?: ReadonlyArray<AwarenessModel> })?.data ?? []);
-    const limitTokens = resolveContextLimit(modelRef, models);
-    // An unknown model or a missing limit means no usable window size: stay
-    // silent instead of guessing a denominator. Record the model and log once
-    // per model so the silence is diagnosable instead of invisible: without
-    // this, a session can sit at high fill with zero warnings and no clue why.
+    const limitTokens = window.limitTokens;
+    // An unknown model with no configured fallback means no usable window
+    // size: stay silent instead of guessing a denominator. Record the model
+    // and log once per model so the silence is diagnosable instead of
+    // invisible: without this, a session can sit at high fill with zero
+    // warnings and no clue why.
     const modelKey = `${modelRef.providerID}/${modelRef.id}`;
     const state = await loadState(ctx, sessionID);
     if (!limitTokens) {
-      if (state.awarenessModel !== modelKey || state.awarenessWindow !== undefined) {
+      if (
+        state.awarenessModel !== modelKey ||
+        state.awarenessWindow !== undefined ||
+        state.awarenessWindowSource !== undefined
+      ) {
         state.awarenessModel = modelKey;
         state.awarenessWindow = undefined;
+        state.awarenessWindowSource = undefined;
         await saveState(ctx, sessionID, state);
         console.log(
           `[smart-compact] awareness disabled: unknown model ${modelKey} or missing context limit — ` +
             `no pressure ratio can be computed, so no advisory will fire. ` +
-            `Check that the model registry entry carries limit.context.`,
+            `Check that the model registry entry carries limit.context, or set ` +
+            `awareness.contextWindowTokens.`,
         );
       }
       return;
     }
-    if (state.awarenessModel !== modelKey || state.awarenessWindow !== limitTokens) {
+    if (
+      state.awarenessModel !== modelKey ||
+      state.awarenessWindow !== limitTokens ||
+      state.awarenessWindowSource !== window.source
+    ) {
       state.awarenessModel = modelKey;
       state.awarenessWindow = limitTokens;
+      state.awarenessWindowSource = window.source;
       await saveState(ctx, sessionID, state);
     }
     const usedTokens = measureVisibleTokens(messages);
@@ -254,6 +336,7 @@ async function runAwareness(
       limitTokens,
       ratioPct: Math.round(ratio * 100),
       level,
+      windowSource: window.source,
     });
     (system as Array<{ type: string; text: string }>).push({ type: "text", text });
     state.awarenessLastRatio = ratio;
@@ -275,11 +358,13 @@ export default Plugin.define({
         description: "Lossless context compression (optional: number of recent turns to keep)",
         async execute({ sessionID, prompt }) {
           const keepTurns = parseKeepTurns(prompt?.text);
-          const summarized = await compactNow(ctx, sessionID, keepTurns);
+          const result = await compactNow(ctx, sessionID, keepTurns);
+          const fallbackNote =
+            result.fallbacks > 0 ? ` (${result.fallbacks} fell back to heuristic summaries)` : "";
           await notify(
             ctx,
             sessionID,
-            `[smart-compact] summarized ${summarized} turn(s); bulky tool output will be trimmed on the next request.`,
+            `[smart-compact] summarized ${result.summarized} turn(s)${fallbackNote}; bulky tool output will be trimmed on the next request.`,
           );
         },
       });
@@ -313,7 +398,7 @@ export default Plugin.define({
       editor.add({
         name: TOOL,
         description:
-          "Read original tool output omitted by context compaction. Returns the cached, possibly stale original for a Content ID (e.g. omitted-0001). Use only when the original output cannot be reproduced by a new tool call.",
+          `Read original tool output omitted by context compaction. Returns the cached, possibly stale original for a Content ID (e.g. omitted-0001), capped at ${MAX_OMISSION_RESPONSE_CHARS} characters with an explicit truncation notice. Use only when the original output cannot be reproduced by a new tool call.`,
         input: {
           type: "object",
           properties: {
@@ -327,12 +412,19 @@ export default Plugin.define({
           if (!contentId) return { content: "Missing contentId." };
           const state = await loadState(ctx, context.sessionID);
           const record = state.omissions[contentId];
-          return {
-            content:
-              record?.content ??
-              `No omitted content found for Content ID: ${contentId} in this session. ` +
+          if (!record) {
+            return {
+              content:
+                `No omitted content found for Content ID: ${contentId} in this session. ` +
                 `It was cleared by a newer compaction — rerun the tool to reproduce the output instead of trusting a restore.`,
-          };
+            };
+          }
+          const original = readOmissionOriginal(record);
+          // Fail closed: a mapped record without a readable original (evicted
+          // file, or a cache cleared by a newer compaction) names the missing
+          // id instead of restoring a phantom.
+          if (original === undefined) return { content: missingOmissionNotice(contentId) };
+          return { content: boundOmissionResponse(contentId, original) };
         },
       });
 
@@ -370,9 +462,11 @@ export default Plugin.define({
             await scheduleTrim(ctx, context.sessionID, args.keepTurns);
             return { content: "[smart-compact] tool output will be trimmed on the next request." };
           }
-          const summarized = await compactNow(ctx, context.sessionID, args.keepTurns);
+          const result = await compactNow(ctx, context.sessionID, args.keepTurns);
+          const fallbackNote =
+            result.fallbacks > 0 ? ` (${result.fallbacks} fell back to heuristic summaries)` : "";
           return {
-            content: `[smart-compact] summarized ${summarized} turn(s); bulky tool output will be trimmed on the next request.`,
+            content: `[smart-compact] summarized ${result.summarized} turn(s)${fallbackNote}; bulky tool output will be trimmed on the next request.`,
           };
         },
       });
@@ -383,7 +477,7 @@ export default Plugin.define({
       editor.add({
         name: STATS_TOOL,
         description:
-          "Report this session's cumulative compaction savings: tokens pruned, tool results trimmed, turns summarized, cached omissions, memo-saved tokens, last run time and whether the tokenizer backed the run. Read-only, no inputs, safe to call at any time.",
+          "Report this session's cumulative compaction savings: plugin version, tokens pruned, tool results trimmed, turns summarized with heuristic fallbacks, cached omissions, last run time, which measurement path produced the numbers (tokenizer or heuristic) and the resolved context window. Read-only, no inputs, safe to call at any time.",
         input: {
           type: "object",
           properties: {},
@@ -412,10 +506,13 @@ export default Plugin.define({
       const config = await loadConfig(ctx);
       if (!config.enabled) return;
 
+      // One window lookup per request feeds both the emergency budget and the
+      // awareness ratio, so the two thresholds can never disagree.
+      const window = await resolveWindowForRequest(ctx, event, config);
       const state = await loadState(ctx, sessionID);
       if (state.pending) {
         try {
-          await runPrune(ctx, sessionID, messages, config);
+          await runPrune(ctx, sessionID, messages, config, window.limitTokens);
         } catch (error) {
           console.warn(`[smart-compact] runPrune failed for ${sessionID}: ${(error as Error)?.message ?? error}`);
         }
@@ -424,7 +521,7 @@ export default Plugin.define({
       applySummaries(messages, fresh);
       applyOmissions(messages, fresh, config);
       // Awareness runs last so it measures exactly what the model receives.
-      await runAwareness(ctx, sessionID, event, messages, config);
+      await runAwareness(ctx, sessionID, event, messages, config, window);
     });
     } catch (error) {
       console.warn(`[smart-compact] ctx.session.hook failed: ${(error as Error)?.message ?? error}`);
diff --git a/src/omissions.ts b/src/omissions.ts
new file mode 100644
index 00000000..d71b93ea
--- /dev/null
+++ b/src/omissions.ts
@@ -0,0 +1,264 @@
+/**
+ * On-disk store for pruned tool-output originals.
+ *
+ * Session state used to carry the full text of every omission, so a session
+ * with hundreds of pruned results rewrote megabytes on every save. Originals
+ * now live in one file per omission under a per-session directory, and state
+ * keeps only the id-to-path mapping. The store is bounded (file count plus
+ * total bytes) and evicts oldest-first, so it cannot grow without limit; a
+ * record whose file was evicted fails closed in `read_omitted_content` instead
+ * of restoring a phantom.
+ *
+ * Everything here is best-effort and never throws into the prune pass: a write
+ * failure returns to the caller as an exception it catches and logs, falling
+ * back to keeping the original inline so nothing is lost.
+ */
+import { createHash } from "node:crypto";
+import {
+  mkdirSync,
+  readFileSync,
+  readdirSync,
+  renameSync,
+  statSync,
+  unlinkSync,
+  writeFileSync,
+} from "node:fs";
+import { homedir } from "node:os";
+import { join } from "node:path";
+import type { OmissionRecord } from "./types.js";
+
+/** Environment override, used by the test suite and for unusual installs. */
+const DATA_DIR_ENV = "SMART_COMPACT_DATA_DIR";
+
+/** Maximum omission files kept per session. */
+export const DEFAULT_OMISSION_MAX_FILES = 500;
+
+/** Maximum total bytes kept per session (about 8 MiB). */
+export const DEFAULT_OMISSION_MAX_BYTES = 8 * 1024 * 1024;
+
+/** Maximum characters a single `read_omitted_content` response may return. */
+export const MAX_OMISSION_RESPONSE_CHARS = 20_000;
+
+export interface OmissionStoreLimits {
+  maxFiles: number;
+  maxBytes: number;
+}
+
+export const DEFAULT_OMISSION_LIMITS: OmissionStoreLimits = {
+  maxFiles: DEFAULT_OMISSION_MAX_FILES,
+  maxBytes: DEFAULT_OMISSION_MAX_BYTES,
+};
+
+/** Root directory for plugin-owned data (not the project, not plugin storage). */
+export function omissionDataDir(): string {
+  const override = process.env[DATA_DIR_ENV];
+  if (typeof override === "string" && override.trim() !== "") return override;
+  const xdg = process.env.XDG_DATA_HOME;
+  const base =
+    typeof xdg === "string" && xdg.trim() !== ""
+      ? xdg
+      : join(homedir(), ".local", "share");
+  return join(base, "opencode", "smart-compact");
+}
+
+/** Stable hash so two session ids that sanitize alike stay separated. */
+function sessionHash(sessionID: string): string {
+  return createHash("sha256").update(sessionID).digest("hex").slice(0, 16);
+}
+
+/** Per-session directory; the id is sanitized and hashed so it cannot escape. */
+export function sessionOmissionDir(sessionID: string): string {
+  const safe =
+    sessionID.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64) || "session";
+  return join(
+    omissionDataDir(),
+    "omissions",
+    `${safe}-${sessionHash(sessionID)}`,
+  );
+}
+
+/** Absolute path a Content ID's original occupies for one session. */
+export function omissionFilePath(sessionID: string, id: string): string {
+  const safeId = id.replace(/[^A-Za-z0-9._-]/g, "_");
+  return join(sessionOmissionDir(sessionID), `${safeId}.txt`);
+}
+
+/** Minimal file listing used by the cap; unreadable entries are skipped. */
+function listStoreFiles(
+  dir: string,
+): Array<{ name: string; path: string; size: number; mtimeMs: number }> {
+  let names: string[];
+  try {
+    names = readdirSync(dir);
+  } catch {
+    // A missing directory means nothing is stored yet, which is not an error.
+    return [];
+  }
+  const files: Array<{
+    name: string;
+    path: string;
+    size: number;
+    mtimeMs: number;
+  }> = [];
+  for (const name of names) {
+    if (!name.endsWith(".txt")) continue;
+    const path = join(dir, name);
+    try {
+      const stat = statSync(path);
+      if (!stat.isFile()) continue;
+      files.push({ name, path, size: stat.size, mtimeMs: stat.mtimeMs });
+    } catch {
+      // A file that vanished or is unreadable is already not consuming space
+      // we can account for; skip it rather than failing the whole prune pass.
+    }
+  }
+  return files;
+}
+
+/**
+ * Enforce the per-session cap by evicting oldest-first. Best-effort: an
+ * unlink failure is logged and the sweep continues, because a full disk must
+ * not turn into a crash. The newly written file is the newest (the ids are
+ * monotonic), so it is never the first eviction candidate.
+ */
+export function enforceOmissionStoreCap(
+  dir: string,
+  limits: OmissionStoreLimits = DEFAULT_OMISSION_LIMITS,
+): void {
+  const maxFiles = Number.isFinite(limits.maxFiles)
+    ? Math.max(0, Math.floor(limits.maxFiles))
+    : 0;
+  const maxBytes = Number.isFinite(limits.maxBytes)
+    ? Math.max(0, Math.floor(limits.maxBytes))
+    : 0;
+  const files = listStoreFiles(dir).sort((a, b) =>
+    a.mtimeMs === b.mtimeMs
+      ? a.name.localeCompare(b.name)
+      : a.mtimeMs - b.mtimeMs,
+  );
+  let totalBytes = files.reduce((sum, file) => sum + file.size, 0);
+  let count = files.length;
+  for (let index = 0; index < files.length; index += 1) {
+    if (count <= maxFiles && totalBytes <= maxBytes) break;
+    const file = files[index]!;
+    // Keep the newest original even when it alone exceeds the byte cap: it was
+    // just written, so deleting it would evict the only copy of the freshest
+    // output while older, less relevant files survive. The next write's eviction
+    // pass then removes it once something newer exists.
+    if (index === files.length - 1) {
+      console.warn(
+        `[smart-compact] omission store over cap, keeping newest readable: ${file.path}`,
+      );
+      break;
+    }
+    try {
+      unlinkSync(file.path);
+      count -= 1;
+      totalBytes -= file.size;
+    } catch (error) {
+      console.warn(
+        `[smart-compact] could not evict omission file ${file.path}: ${(error as Error)?.message ?? error}`,
+      );
+    }
+  }
+}
+
+/**
+ * Write one original to its per-session file and return the absolute path.
+ * The write is atomic (temp file plus rename), so a crash cannot leave a
+ * half-written original that `read_omitted_content` would return as truth.
+ * Throws only when the directory or file cannot be written; the caller keeps
+ * the text inline in that case.
+ */
+export function writeOmissionOriginal(
+  sessionID: string,
+  id: string,
+  content: string,
+  limits: OmissionStoreLimits = DEFAULT_OMISSION_LIMITS,
+): string {
+  const dir = sessionOmissionDir(sessionID);
+  mkdirSync(dir, { recursive: true });
+  const path = omissionFilePath(sessionID, id);
+  const temp = `${path}.tmp`;
+  writeFileSync(temp, content, "utf8");
+  renameSync(temp, path);
+  enforceOmissionStoreCap(dir, limits);
+  return path;
+}
+
+/**
+ * Read the original behind an omission record. A missing file returns
+ * undefined so the caller can print the fail-closed notice; a legacy inline
+ * `content` (not yet migrated, or kept because the file write failed) is
+ * returned as a last resort.
+ */
+export function readOmissionOriginal(
+  record: Pick<OmissionRecord, "path" | "content"> | undefined,
+): string | undefined {
+  if (!record) return undefined;
+  if (typeof record.path === "string" && record.path.length > 0) {
+    try {
+      return readFileSync(record.path, "utf8");
+    } catch {
+      // Evicted or moved: fail closed to the caller's missing-original notice.
+      return typeof record.content === "string" ? record.content : undefined;
+    }
+  }
+  return typeof record.content === "string" ? record.content : undefined;
+}
+
+/**
+ * Move inline originals from an older state blob into files. Called once on
+ * load; returns true when the state changed and should be persisted. A record
+ * whose write fails keeps its inline text, so migration never loses content.
+ */
+export function migrateLegacyOmissions(
+  sessionID: string,
+  omissions: Record<string, OmissionRecord>,
+): boolean {
+  let changed = false;
+  for (const [id, record] of Object.entries(omissions)) {
+    if (!record || typeof record !== "object") continue;
+    if (typeof record.content !== "string") continue;
+    if (typeof record.path === "string" && record.path.length > 0) {
+      // Already migrated but the old copy lingered: drop the duplicate.
+      delete record.content;
+      changed = true;
+      continue;
+    }
+    try {
+      record.path = writeOmissionOriginal(sessionID, id, record.content);
+      delete record.content;
+      changed = true;
+    } catch (error) {
+      console.warn(
+        `[smart-compact] could not migrate omission ${id} to a file: ` +
+          `${(error as Error)?.message ?? error}; keeping it inline for this session.`,
+      );
+    }
+  }
+  return changed;
+}
+
+/**
+ * Bound a single retrieval. Replaying a megabyte original re-inflates exactly
+ * the context pruning relieved, so the response is capped and says so plainly,
+ * naming the Content ID and both sizes.
+ */
+export function boundOmissionResponse(
+  id: string,
+  text: string,
+  maxChars: number = MAX_OMISSION_RESPONSE_CHARS,
+): string {
+  const limit =
+    typeof maxChars === "number" && Number.isFinite(maxChars) && maxChars > 0
+      ? Math.floor(maxChars)
+      : MAX_OMISSION_RESPONSE_CHARS;
+  if (text.length <= limit) return text;
+  return (
+    `${text.slice(0, limit)}\n\n` +
+    `[smart-compact] TRUNCATED: showing the first ${limit} of ${text.length} characters. ` +
+    `The full original remains cached under Content ID ${id}, but this tool always returns ` +
+    `the same capped view — reproduce any missing portion with the source tool if it is essential.]`
+  );
+}
diff --git a/src/prune.ts b/src/prune.ts
index fb2ba5ef..a8967d08 100644
--- a/src/prune.ts
+++ b/src/prune.ts
@@ -1,4 +1,5 @@
 import { DEFAULT_CONFIG, PRUNE_WEIGHTS, type SmartCompactConfig } from "./config.js";
+import { writeOmissionOriginal } from "./omissions.js";
 import { countTokens } from "./tokens.js";
 import type { Msg, OmissionRecord, Part, SessionState } from "./types.js";
 
@@ -86,52 +87,6 @@ function partCallId(part: Part): string | undefined {
   return typeof part.id === "string" ? part.id : undefined;
 }
 
-/**
- * Small content hash over the entire string plus a length prefix. Any edit —
- * including one in the middle — changes the hash and invalidates the memo.
- */
-export function memoHash(text: string): string {
-  let hash = 5381;
-  for (let i = 0; i < text.length; i += 1) {
-    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
-  }
-  return `${text.length}:${(hash >>> 0).toString(36)}`;
-}
-
-/** Whether a tool result is small enough to measure directly, memo aside. */
-function isSmallInput(text: string, config: SmartCompactConfig, tool?: string): boolean {
-  if (config.pruning.useTokens) {
-    // Token-heavy text (even a single long word) is never "small" here:
-    // the measured cost decides against the token budget for its tool.
-    const budget = (tool ?? "") === "task" ? config.pruning.taskMaxWords : config.pruning.maxWords;
-    return measureTokens(text, config) <= budget;
-  }
-  if (text.length > config.pruning.maxChars) return false;
-  return text.trim().split(/\s+/).filter(Boolean).length <= config.pruning.maxWords;
-}
-
-/**
- * Measure a tool result for one call id, reusing the memoized cost when the
- * content hash matches. Small inputs bypass the memo entirely — measuring
- * them directly is cheaper than bookkeeping. Returns the token cost and
- * whether the memo supplied it.
- */
-export function measureMemoized(
-  callId: string,
-  text: string,
-  config: SmartCompactConfig,
-  state: SessionState,
-  tool?: string,
-): { tokens: number; hit: boolean } {
-  if (isSmallInput(text, config, tool)) return { tokens: measureTokens(text, config), hit: false };
-  const hash = memoHash(text);
-  const entry = state.pruneMemo[callId];
-  if (entry && entry.hash === hash) return { tokens: entry.tokens, hit: true };
-  const tokens = measureTokens(text, config);
-  state.pruneMemo[callId] = { hash, tokens };
-  return { tokens, hit: false };
-}
-
 /**
  * Effective truncate cap for one tool. `task` keeps its higher bar: the cap
  * never bites below `taskMaxChars`. A non-positive `truncateToolsChars`
@@ -175,11 +130,10 @@ export function pruneToolResults(
   messages: Msg[],
   state: SessionState,
   config: SmartCompactConfig = DEFAULT_CONFIG,
-): { pruned: number; tokens: number; memoHits: number; memoTokens: number } {
+  sessionID = "unscoped",
+): { pruned: number; tokens: number } {
   let pruned = 0;
   let tokens = 0;
-  let memoHits = 0;
-  let memoTokens = 0;
   const kept = preserveWindow(messages, config.pruning.preserveRecentTurns);
   // O1 D2: collect eligible tool results first, then prune in fixed-cost rank.
   // User turns never enter candidates — only tool-result kind is ranked here.
@@ -235,23 +189,30 @@ export function pruneToolResults(
     // Keep rank id linkage explicit for audit (no Map keyed by callId remains).
     void byRankId;
     const { part, callId, name, text } = entry;
-      const id = nextOmissionId(state);
-      // Reuse the memoized measurement when the content is unchanged; the
-      // memo only ever affects the reported cost, never the prune decision.
-      const measured = measureMemoized(callId, text, config, state, name);
-      const saved = measured.tokens;
-      if (measured.hit) {
-        memoHits += 1;
-        memoTokens += saved;
-      }
-      const record: OmissionRecord = { id, callId, name, content: text, tokens: saved };
-      state.omissions[id] = record;
-      state.omittedCalls[callId] = id;
-      part.result = { type: "text", value: omissionNotice(id, name, saved) };
-      pruned += 1;
-      tokens += saved;
+    const id = nextOmissionId(state);
+    const saved = measureTokens(text, config);
+    // The original goes to the bounded per-session file store; state keeps only
+    // the id-to-path mapping. If the write fails, keep the text inline so a
+    // retrieval still works instead of silently losing the original.
+    let path: string | undefined;
+    try {
+      path = writeOmissionOriginal(sessionID, id, text);
+    } catch (error) {
+      console.warn(
+        `[smart-compact] could not store omission ${id} on disk: ` +
+          `${(error as Error)?.message ?? error}; keeping it inline.`,
+      );
+    }
+    const record: OmissionRecord = path
+      ? { id, callId, name, tokens: saved, path }
+      : { id, callId, name, tokens: saved, content: text };
+    state.omissions[id] = record;
+    state.omittedCalls[callId] = id;
+    part.result = { type: "text", value: omissionNotice(id, name, saved) };
+    pruned += 1;
+    tokens += saved;
   }
-  return { pruned, tokens, memoHits, memoTokens };
+  return { pruned, tokens };
 }
 
 /** Re-apply stored omissions and discard rules on every request (idempotent). */
diff --git a/src/store.ts b/src/store.ts
index 6ff47144..44dd3b97 100644
--- a/src/store.ts
+++ b/src/store.ts
@@ -1,6 +1,7 @@
 import type { Plugin } from "@opencode/plugin";
 import type { Schema } from "effect";
-import { emptyState, type SessionState } from "./types.js";
+import { migrateLegacyOmissions } from "./omissions.js";
+import { emptyState, type OmissionRecord, type SessionState, type SessionStats } from "./types.js";
 
 /** The plugin context handed to `setup`. */
 export type Ctx = Plugin.Context;
@@ -30,12 +31,30 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
   const raw = await ctx.storage.get(key(sessionID));
   if (!raw || typeof raw !== "object") return emptyState();
   const value = raw as Partial<SessionState>;
-  const omissions = value.omissions ?? {};
+  // Clone the omission map so migration can rewrite records without mutating
+  // the object still held by storage.
+  const omissions = { ...(value.omissions ?? {}) } as Record<string, OmissionRecord>;
+  // Legacy blobs carried the full original inline. Move it to the bounded file
+  // store once; the write is best-effort and a failure keeps the text inline.
+  const migrated = migrateLegacyOmissions(sessionID, omissions);
   const nextOmissionId =
     typeof value.nextOmissionId === "number" && value.nextOmissionId > 0
       ? value.nextOmissionId
       : deriveNextOmissionId(omissions);
-  return {
+  // Older stats carried `savedTokens` (the removed prune memo) and a boolean
+  // `tokenizerUsed`. Only the measurement path survives, mapped from the flag
+  // so an existing session still reports which code produced its numbers.
+  const legacyStats = (value.stats ?? {}) as SessionStats & {
+    savedTokens?: number;
+    tokenizerUsed?: boolean;
+  };
+  const measurementPath =
+    value.stats?.measurementPath === "tokenizer" || value.stats?.measurementPath === "heuristic"
+      ? value.stats.measurementPath
+      : legacyStats.tokenizerUsed === true
+        ? "tokenizer"
+        : undefined;
+  const state: SessionState = {
     summaries: value.summaries ?? {},
     omissions,
     omittedCalls: value.omittedCalls ?? {},
@@ -43,13 +62,16 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
       prunedTokens: value.stats?.prunedTokens ?? 0,
       summarizedTurns: value.stats?.summarizedTurns ?? 0,
       prunedParts: value.stats?.prunedParts ?? 0,
-      savedTokens: value.stats?.savedTokens ?? 0,
+      summaryFallbacks:
+        typeof value.stats?.summaryFallbacks === "number" &&
+        Number.isFinite(value.stats.summaryFallbacks)
+          ? value.stats.summaryFallbacks
+          : 0,
       lastRun: value.stats?.lastRun,
       lastRunMs: value.stats?.lastRunMs,
-      tokenizerUsed: value.stats?.tokenizerUsed,
+      measurementPath,
     },
     nextOmissionId,
-    pruneMemo: value.pruneMemo ?? {},
     pending: value.pending ?? null,
     // The awareness latch survives a restart: without it a restarted session
     // would re-warn on the very first request.
@@ -76,11 +98,29 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
       value.awarenessWindow > 0
         ? Math.floor(value.awarenessWindow)
         : undefined,
+    awarenessWindowSource:
+      value.awarenessWindowSource === "registry" || value.awarenessWindowSource === "config"
+        ? value.awarenessWindowSource
+        : undefined,
     awarenessModel:
       typeof value.awarenessModel === "string" && value.awarenessModel.length > 0
         ? value.awarenessModel
         : undefined,
   };
+  // Persist the migrated shape so the inline originals stop being rewritten on
+  // every save. Best-effort: a failed save leaves the migration to the next
+  // load, and the inline text still serves retrievals in the meantime.
+  if (migrated) {
+    try {
+      await saveState(ctx, sessionID, state);
+    } catch (error) {
+      console.warn(
+        `[smart-compact] could not persist the migrated omission store for ${sessionID}: ` +
+          `${(error as Error)?.message ?? error}`,
+      );
+    }
+  }
+  return state;
 }
 
 /** Persist the session state. */
diff --git a/src/summarize.ts b/src/summarize.ts
index 52220ba6..5abbf025 100644
--- a/src/summarize.ts
+++ b/src/summarize.ts
@@ -88,6 +88,14 @@ function batchPrompt(chunk: PendingTurn[]): string {
   return parts.join("\n");
 }
 
+/** Outcome of one summarization run. */
+export interface SummarizeResult {
+  /** Turns given a summary (including absorbed empty turns). */
+  summarized: number;
+  /** Turns that fell back to the 400-character heuristic. */
+  fallbacks: number;
+}
+
 /**
  * Summarize the eligible turns and store the result by assistant message id.
  * Turns are batched into as few `ctx.generate.text` calls as possible (one per
@@ -96,10 +104,17 @@ function batchPrompt(chunk: PendingTurn[]): string {
  * marked "absorbed" (empty string) so their prose is stripped without a
  * duplicate summary. Turns with no prose, reasoning, or tool markers are
  * absorbed without a model call. A failed or incomplete reply falls back to a
- * heuristic so compaction never fails.
+ * heuristic so compaction never fails; every fallback is counted, because a
+ * whole batch degrading to truncated prose must be visible in `compact_stats`
+ * instead of looking like a normal compaction.
  */
-export async function summarizeTurns(ctx: Ctx, turns: Turn[], state: SessionState): Promise<number> {
+export async function summarizeTurns(
+  ctx: Ctx,
+  turns: Turn[],
+  state: SessionState,
+): Promise<SummarizeResult> {
   let done = 0;
+  let fallbacks = 0;
   const pending: PendingTurn[] = [];
 
   for (const turn of turns) {
@@ -124,7 +139,9 @@ export async function summarizeTurns(ctx: Ctx, turns: Turn[], state: SessionStat
       parsed = new Map();
     }
     for (const item of chunk) {
-      state.summaries[item.firstId] = parsed.get(item.firstId) ?? heuristicSummary(item.body);
+      const parsedSummary = parsed.get(item.firstId);
+      if (parsedSummary === undefined) fallbacks += 1;
+      state.summaries[item.firstId] = parsedSummary ?? heuristicSummary(item.body);
       const assistants = item.turn.assistants;
       for (let i = 1; i < assistants.length; i += 1) {
         state.summaries[assistants[i]!.id] = "";
@@ -132,5 +149,5 @@ export async function summarizeTurns(ctx: Ctx, turns: Turn[], state: SessionStat
       done += 1;
     }
   }
-  return done;
+  return { summarized: done, fallbacks };
 }
diff --git a/src/tokens.ts b/src/tokens.ts
index d99560b7..7d93f735 100644
--- a/src/tokens.ts
+++ b/src/tokens.ts
@@ -10,6 +10,7 @@
  */
 
 import { createRequire } from "node:module";
+import type { MeasurementPath } from "./types.js";
 
 declare const require: ((id: string) => unknown) | undefined;
 
@@ -63,6 +64,16 @@ export function isTokenizerAvailable(): boolean {
   return loadTokenizerOnce() !== null;
 }
 
+/**
+ * The measurement path that will actually produce the numbers for a run:
+ * the tokenizer only when measurement is enabled AND the optional package
+ * loaded; otherwise the dependency-free heuristic. Surfaced in `compact_stats`
+ * so an operator can tell which code produced the figures.
+ */
+export function measurementPath(enabled: boolean): MeasurementPath {
+  return enabled && isTokenizerAvailable() ? "tokenizer" : "heuristic";
+}
+
 /**
  * Count tokens for `text`. Returns the fallback estimate when `enabled` is
  * false, when no tokenizer is installed, or when the tokenizer throws or
diff --git a/src/types.ts b/src/types.ts
index 4c39665c..26245821 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -19,7 +19,13 @@ export interface Msg {
   content: Part[];
 }
 
-/** The cached original of a pruned tool result, retrievable by id. */
+/**
+ * The cached original of a pruned tool result, retrievable by id.
+ *
+ * The original text lives in a per-session file under the bounded omission
+ * store, never in the state blob: state only carries the id-to-path mapping,
+ * so a session save stays small no matter how much history was pruned.
+ */
 export interface OmissionRecord {
   /** Stable id used by `read_omitted_content` (e.g. `omitted-0001`). */
   id: string;
@@ -27,32 +33,33 @@ export interface OmissionRecord {
   callId: string;
   /** Tool name, for the notice text. */
   name?: string;
-  /** The original serialized result value. */
-  content: string;
   /** Estimated tokens saved by pruning. */
   tokens: number;
+  /** Absolute path to the file that holds the original serialized result. */
+  path?: string;
+  /**
+   * Legacy inline original from an older state blob. `loadState` migrates it
+   * to `path`; it survives only when the file write failed, so a retrieval can
+   * still fail over to the text instead of losing it.
+   */
+  content?: string;
 }
 
+/** Which measurement path produced the token numbers. */
+export type MeasurementPath = "tokenizer" | "heuristic";
+
 /** Cumulative savings for one session. */
 export interface SessionStats {
   prunedTokens: number;
   summarizedTurns: number;
   prunedParts: number;
-  /** Context tokens saved on prune passes that reused a memoized measurement. */
-  savedTokens: number;
+  /** Heuristic summary fallbacks across all summarization runs. */
+  summaryFallbacks: number;
   lastRun?: number;
   /** Wall-clock cost of the most recent prune pass, in milliseconds. */
   lastRunMs?: number;
-  /** Whether a real tokenizer (not the fallback) backed the last run. */
-  tokenizerUsed?: boolean;
-}
-
-/** Memoized token measurement for one tool call, keyed by content hash. */
-export interface MemoEntry {
-  /** Hash of the measured content; a content change invalidates the entry. */
-  hash: string;
-  /** Measured token cost reused on a hash hit. */
-  tokens: number;
+  /** Token measurement path used by the most recent run. */
+  measurementPath?: MeasurementPath;
 }
 
 /** Per-session compaction state, persisted in plugin storage. */
@@ -71,11 +78,6 @@ export interface SessionState {
   stats: SessionStats;
   /** Monotonic counter for the next omission id. */
   nextOmissionId: number;
-  /**
-   * Call id → memoized token measurement. Lets repeat passes over identical
-   * content skip remeasuring; any content change invalidates the entry.
-   */
-  pruneMemo: Record<string, MemoEntry>;
   /** A pending command request, consumed by the next context hook. */
   pending?: { mode: "compact" | "trim"; keepTurns: number } | null;
   /**
@@ -93,11 +95,18 @@ export interface SessionState {
   autoTrimLastRatio?: number;
   /**
    * Resolved context window in tokens from the last awareness pass. Absent
-   * when the session model is unknown to the registry or carries no usable
-   * limit — in which case no ratio can be computed and the advisory stays
-   * silent. Surfaced in `compact_stats` so silence is diagnosable.
+   * when the session model is unknown to the registry, no configured fallback
+   * exists, and the entry carries no usable limit — in which case no ratio can
+   * be computed and the advisory stays silent. Surfaced in `compact_stats` so
+   * silence is diagnosable.
    */
   awarenessWindow?: number;
+  /**
+   * Where `awarenessWindow` came from: the model registry or the configured
+   * `awareness.contextWindowTokens` fallback. Lets the reminder and the stats
+   * line say the denominator is configured rather than measured.
+   */
+  awarenessWindowSource?: "registry" | "config";
   /**
    * "providerID/id" of the model seen on the last awareness pass. Recorded
    * even when the window is unknown, so the stats line can name the model
@@ -111,9 +120,8 @@ export function emptyState(): SessionState {
     summaries: {},
     omissions: {},
     omittedCalls: {},
-    stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0, savedTokens: 0 },
+    stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0, summaryFallbacks: 0 },
     nextOmissionId: 1,
-    pruneMemo: {},
     pending: null,
   };
 }
diff --git a/src/version.ts b/src/version.ts
new file mode 100644
index 00000000..777a7fea
--- /dev/null
+++ b/src/version.ts
@@ -0,0 +1,28 @@
+/**
+ * Plugin version, resolved from the package manifest at load time.
+ *
+ * The plugin may run from the repository source (tests compile into
+ * `.test-build/src`) or from an installed package, so both one and two levels
+ * up are probed. A missing or malformed manifest renders "unknown": a stats
+ * line must never throw because a file could not be read.
+ */
+import { existsSync, readFileSync } from "node:fs";
+
+function readPackageVersion(): string {
+  for (const relative of ["../package.json", "../../package.json"]) {
+    const url = new URL(relative, import.meta.url);
+    try {
+      if (!existsSync(url)) continue;
+      const parsed = JSON.parse(readFileSync(url, "utf8")) as { version?: unknown };
+      if (typeof parsed.version === "string" && /^\d+\.\d+\.\d+/.test(parsed.version)) {
+        return parsed.version;
+      }
+    } catch {
+      // Try the next candidate; a broken manifest renders "unknown".
+    }
+  }
+  return "unknown";
+}
+
+/** The version reported by `compact_stats` and `/magic-stats`. */
+export const PLUGIN_VERSION = readPackageVersion();
diff --git a/tests/actions.test.ts b/tests/actions.test.ts
index 49381bc0..45abf05e 100644
--- a/tests/actions.test.ts
+++ b/tests/actions.test.ts
@@ -2,6 +2,12 @@ import { test } from "node:test";
 import assert from "node:assert/strict";
 import { parseCompactArgs, formatStats } from "../src/actions.js";
 import { emptyState } from "../src/types.js";
+import { PLUGIN_VERSION } from "../src/version.js";
+
+test("the plugin version resolves from package.json", () => {
+  // F8: a review must be able to prove which code produced the numbers.
+  assert.match(PLUGIN_VERSION, /^\d+\.\d+\.\d+/);
+});
 
 test("parseCompactArgs defaults to compact-all", () => {
   assert.deepEqual(parseCompactArgs(undefined), { mode: "compact", keepTurns: 0 });
@@ -31,35 +37,45 @@ test("formatStats renders a fresh session as all zeros", () => {
   const text = formatStats(emptyState());
   assert.equal(
     text,
-    "[smart-compact] pruned ~0 tokens across 0 tool results; summarized 0 turns; " +
-      "0 cached omissions; memo-saved ~0 tokens; last run 0ms; tokenizer off; " +
-      "window unknown (no model seen yet — awareness off).",
+    `[smart-compact] version ${PLUGIN_VERSION}; pruned ~0 tokens across 0 tool results; ` +
+      "summarized 0 turns (fallbacks: 0); 0 cached omissions; last run 0ms; " +
+      "measurement heuristic; window unknown (no model seen yet — awareness off).",
   );
 });
 
-test("formatStats reports counters, cache size and tokenizer state", () => {
+test("formatStats reports counters, cache size and the measurement path", () => {
   const state = emptyState();
   state.stats = {
     prunedTokens: 1200,
     summarizedTurns: 4,
     prunedParts: 9,
-    savedTokens: 300,
+    summaryFallbacks: 3,
     lastRun: 1792837690007,
     lastRunMs: 12,
-    tokenizerUsed: true,
+    measurementPath: "tokenizer",
   };
   state.omissions = {
-    "omitted-0001": { id: "omitted-0001", callId: "c1", name: "shell", content: "x", tokens: 40 },
+    "omitted-0001": { id: "omitted-0001", callId: "c1", name: "shell", tokens: 40, path: "/tmp/x" },
   };
   const text = formatStats(state);
   assert.match(text, /pruned ~1200 tokens across 9 tool results/);
-  assert.match(text, /summarized 4 turns; 1 cached omissions/);
-  assert.match(text, /memo-saved ~300 tokens; last run 12ms; tokenizer on;/);
+  assert.match(text, /summarized 4 turns \(fallbacks: 3\); 1 cached omissions/);
+  assert.match(text, /last run 12ms; measurement tokenizer;/);
+});
+
+test("formatStats fails over to the heuristic measurement path", () => {
+  const state = emptyState();
+  state.stats = {
+    ...state.stats,
+    measurementPath: "heuristic",
+  };
+  const text = formatStats(state);
+  assert.match(text, /measurement heuristic/);
 });
 
 test("formatStats never renders NaN for malformed counters", () => {
   const state = emptyState();
-  state.stats = { prunedTokens: Number.NaN, summarizedTurns: 2, prunedParts: 1, savedTokens: 0 };
+  state.stats = { prunedTokens: Number.NaN, summarizedTurns: 2, prunedParts: 1, summaryFallbacks: 0 };
   const text = formatStats(state);
   assert.match(text, /pruned ~0 tokens/);
   assert.equal(text.includes("NaN"), false);
@@ -73,6 +89,15 @@ test("formatStats names the resolved window and model", () => {
   assert.match(text, /window 1048576 \(opencode-go\/muse-spark-1\.3-contributor\)\./);
 });
 
+test("formatStats marks a denominator supplied by config, not the registry", () => {
+  const state = emptyState();
+  state.awarenessWindow = 200_000;
+  state.awarenessWindowSource = "config";
+  state.awarenessModel = "custom/acme-1";
+  const text = formatStats(state);
+  assert.match(text, /window 200000 \(custom\/acme-1 — configured\)\./);
+});
+
 test("formatStats names the model the registry failed on", () => {
   const state = emptyState();
   state.awarenessWindow = undefined;
diff --git a/tests/awareness-hook.test.ts b/tests/awareness-hook.test.ts
index 03060935..20e028df 100644
--- a/tests/awareness-hook.test.ts
+++ b/tests/awareness-hook.test.ts
@@ -1,6 +1,6 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
-import { mkdtempSync } from "node:fs";
+import { existsSync, mkdtempSync, readFileSync } from "node:fs";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import plugin from "../src/index.js";
@@ -9,6 +9,9 @@ import type { Msg } from "../src/types.js";
 // The hook resolves the global config from XDG_CONFIG_HOME: point it at an
 // empty directory so the developer's real global file cannot change results.
 process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "smart-compact-xdg-"));
+// Omission originals now live on disk; keep every test file inside a temp dir
+// so the suite can never write into the developer's real data directory.
+process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-data-"));
 
 /**
  * One assistant turn of `chars` characters. The plugin estimates about four
@@ -22,6 +25,27 @@ function bigMessage(chars: number): Msg {
   };
 }
 
+/** One bulky completed tool result, which is what the emergency budget measures. */
+function bigToolResult(id: string, chars: number): Msg {
+  return {
+    role: "assistant",
+    content: [{ type: "tool-result", id, name: "bash", result: { type: "text", value: "x".repeat(chars) } }],
+  };
+}
+
+/** Run `fn` while collecting console.warn lines, restoring the console after. */
+async function captureWarnings(fn: () => Promise<void>): Promise<string[]> {
+  const original = console.warn;
+  const lines: string[] = [];
+  console.warn = (message: unknown) => void lines.push(String(message));
+  try {
+    await fn();
+  } finally {
+    console.warn = original;
+  }
+  return lines;
+}
+
 interface HarnessOptions {
   /** Context window the stub model reports. */
   limitContext?: number;
@@ -228,16 +252,76 @@ test("autoTrimRatio queues a lossless trim below the advisory threshold", async
   assert.equal(system.length, 0);
 });
 
-test("autoTrimRatio stays off by default", async () => {
+test("the shipped default arms auto-trim at 0.55", async () => {
   const h = await harness({ limitContext: 10_000 });
   const system: Array<{ type: string; text: string }> = [];
+  // 50 percent: below the shipped 0.55 line, nothing is queued.
   await h.hook({
-    sessionID: "ses-default",
+    sessionID: "ses-default-low",
     model: { providerID: "test", id: "model-x" },
     system,
     messages: [bigMessage(20000)],
   });
-  assert.equal((h.storage.get("session:ses-default") as { pending?: unknown } | undefined)?.pending ?? null, null);
+  assert.equal(
+    (h.storage.get("session:ses-default-low") as { pending?: unknown } | undefined)?.pending ?? null,
+    null,
+  );
+  // 60 percent: above the line, one lossless trim is queued with no manual call.
+  await h.hook({
+    sessionID: "ses-default-high",
+    model: { providerID: "test", id: "model-x" },
+    system,
+    messages: [bigMessage(24000)],
+  });
+  assert.deepEqual(
+    (h.storage.get("session:ses-default-high") as { pending?: unknown } | undefined)?.pending,
+    { mode: "trim", keepTurns: 0 },
+  );
+});
+
+test("the shipped default reclaims tool output with no manual compaction call", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  const sessionID = "ses-auto-default";
+  const original = "z".repeat(24000);
+  // Three user messages so the bulky result sits outside the default
+  // preserve-recent-2-turns window and is therefore prunable.
+  const messages: Msg[] = [
+    { id: "u1", role: "user", content: [{ type: "text", text: "start" }] },
+    {
+      id: "a1",
+      role: "assistant",
+      content: [{ type: "tool-result", id: "call-big", name: "bash", result: { type: "text", value: original } }],
+    },
+    { id: "u2", role: "user", content: [{ type: "text", text: "continue" }] },
+    { id: "u3", role: "user", content: [{ type: "text", text: "still going" }] },
+  ];
+  const model = { providerID: "test", id: "model-x" };
+  // 60 percent of the window: the default line queues a trim, no tool call made.
+  await h.hook({ sessionID, model, system, messages });
+  assert.deepEqual(
+    (h.storage.get(`session:${sessionID}`) as { pending?: unknown }).pending,
+    { mode: "trim", keepTurns: 0 },
+  );
+  // The next model request applies it: the bulky result becomes a notice and
+  // the original moves to a per-session file, not the state blob.
+  await h.hook({ sessionID, model, system, messages });
+  const value = (messages[1]!.content[0]!.result as { value: string }).value;
+  assert.match(value, /omitted-0001/);
+  // Context dropped: the 24000-character payload is now a short notice.
+  assert.ok(value.length < original.length / 10);
+  const state = h.storage.get(`session:${sessionID}`) as {
+    pending?: unknown;
+    omissions: Record<string, { path?: string; content?: string }>;
+  };
+  // One sustained period queues exactly one trim: the consumed request is not
+  // re-queued at the same fill.
+  assert.equal(state.pending ?? null, null);
+  const record = state.omissions["omitted-0001"]!;
+  assert.equal(record.content, undefined);
+  assert.equal(typeof record.path, "string");
+  assert.ok(existsSync(record.path!));
+  assert.equal(readFileSync(record.path!, "utf8"), original);
 });
 
 test("a sustained high-pressure period queues one trim, not one per request", async () => {
@@ -410,8 +494,132 @@ test("a resolved model records its window in state", async () => {
   });
   const state = h.storage.get("session:ses-known") as {
     awarenessWindow?: unknown;
+    awarenessWindowSource?: unknown;
     awarenessModel?: unknown;
   };
   assert.equal(state.awarenessWindow, 10_000);
+  assert.equal(state.awarenessWindowSource, "registry");
   assert.equal(state.awarenessModel, "test/model-x");
 });
+
+test("a configured fallback window renders a ratio and names itself as configured", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-window-fallback-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(
+    join(dir, ".opencode", "smart-compact.jsonc"),
+    '{"awareness": {"contextWindowTokens": 10000}}',
+  );
+  const h = await harness({ limitContext: 10_000, directory: dir });
+  const system: Array<{ type: string; text: string }> = [];
+  // The registry has no entry for this model, so only the configured window
+  // can produce a denominator — 20000 chars is about 5000 of 10000 tokens.
+  await h.hook({
+    sessionID: "ses-fallback",
+    model: { providerID: "custom", id: "acme-1" },
+    system,
+    messages: [bigMessage(20000)],
+  });
+  assert.equal(system.length, 1);
+  assert.match(system[0]!.text, /50%/);
+  assert.match(system[0]!.text, /configured/);
+  assert.match(system[0]!.text, /awareness\.contextWindowTokens/);
+  const state = h.storage.get("session:ses-fallback") as {
+    awarenessWindow?: unknown;
+    awarenessWindowSource?: unknown;
+  };
+  assert.equal(state.awarenessWindow, 10_000);
+  assert.equal(state.awarenessWindowSource, "config");
+});
+
+test("with neither a registry limit nor a configured window, awareness stays silent", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const system: Array<{ type: string; text: string }> = [];
+  await h.hook({
+    sessionID: "ses-no-window",
+    model: { providerID: "custom", id: "acme-1" },
+    system,
+    messages: [bigMessage(40000)],
+  });
+  assert.equal(system.length, 0);
+  const state = h.storage.get("session:ses-no-window") as {
+    awarenessWindow?: unknown;
+    awarenessWindowSource?: unknown;
+  };
+  assert.equal(state.awarenessWindow, undefined);
+  assert.equal(state.awarenessWindowSource, undefined);
+});
+
+test("a 1M window keeps the derived emergency budget quiet during normal work", async () => {
+  const h = await harness({ limitContext: 1_000_000 });
+  const sessionID = "ses-budget-1m";
+  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
+  const warnings = await captureWarnings(async () => {
+    // ~100K measured tokens against a derived 600K budget for a 1M window.
+    await h.hook({
+      sessionID,
+      model: { providerID: "test", id: "model-x" },
+      system: [],
+      messages: [bigToolResult("call-1m", 400_000)],
+    });
+  });
+  assert.equal(warnings.some((line) => /emergency budget/.test(line)), false);
+});
+
+test("the derived emergency budget fires near the window-scaled line", async () => {
+  const h = await harness({ limitContext: 100_000 });
+  const sessionID = "ses-budget-warn";
+  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
+  const warnings = await captureWarnings(async () => {
+    // ~75000 measured tokens against the derived 60000 (60 percent of 100K).
+    await h.hook({
+      sessionID,
+      model: { providerID: "test", id: "model-x" },
+      system: [],
+      messages: [bigToolResult("call-warn", 300_000)],
+    });
+  });
+  assert.ok(warnings.some((line) => /over the emergency budget of 60000 tokens/.test(line)));
+});
+
+test("an explicit emergency override behaves exactly as configured", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-budget-override-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(
+    join(dir, ".opencode", "smart-compact.jsonc"),
+    '{"tokens": {"emergencyBudgetTokens": 1000}}',
+  );
+  const h = await harness({ limitContext: 1_000_000, directory: dir });
+  const sessionID = "ses-budget-override";
+  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
+  const warnings = await captureWarnings(async () => {
+    // ~2000 measured tokens: over the pinned 1000 even on a 1M window.
+    await h.hook({
+      sessionID,
+      model: { providerID: "test", id: "model-x" },
+      system: [],
+      messages: [bigToolResult("call-override", 8000)],
+    });
+  });
+  assert.ok(warnings.some((line) => /over the emergency budget of 1000 tokens/.test(line)));
+});
+
+test("an unknown window disables the derived emergency warning", async () => {
+  const h = await harness({ limitContext: 10_000 });
+  const sessionID = "ses-budget-unknown";
+  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
+  const warnings = await captureWarnings(async () => {
+    await h.hook({
+      sessionID,
+      model: { providerID: "custom", id: "acme-1" },
+      system: [],
+      messages: [bigToolResult("call-unknown", 400_000)],
+    });
+  });
+  assert.equal(warnings.some((line) => /emergency budget/.test(line)), false);
+});
diff --git a/tests/awareness.test.ts b/tests/awareness.test.ts
index b1a64f30..5da1dd6d 100644
--- a/tests/awareness.test.ts
+++ b/tests/awareness.test.ts
@@ -5,6 +5,7 @@ import {
   buildAwarenessMessage,
   getAwarenessLevel,
   measureVisibleTokens,
+  resolveAwarenessWindow,
   resolveContextLimit,
   shouldAutoTrim,
   shouldFireAwareness,
@@ -65,6 +66,30 @@ test("resolveContextLimit returns undefined for a miss or an unusable limit", ()
   );
 });
 
+test("resolveAwarenessWindow prefers the registry and names its source", () => {
+  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 200_000 } }];
+  assert.deepEqual(resolveAwarenessWindow({ providerID: "opencode", id: "model-a" }, models, 500_000), {
+    limitTokens: 200_000,
+    source: "registry",
+  });
+});
+
+test("resolveAwarenessWindow falls back to the configured window", () => {
+  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 0 } }];
+  assert.deepEqual(resolveAwarenessWindow({ providerID: "opencode", id: "model-a" }, models, 150_000), {
+    limitTokens: 150_000,
+    source: "config",
+  });
+  // A configured value of 0 or a malformed value is "not configured".
+  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, models, 0), {});
+  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, models, Number.NaN), {});
+});
+
+test("resolveAwarenessWindow stays empty when neither source exists", () => {
+  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, [], 0), {});
+  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, [], undefined as never), {});
+});
+
 test("getAwarenessLevel maps the ratio to none, warn, and emergency", () => {
   const cfg = { warnRatio: 0.5, emergencyRatio: 0.8 };
   assert.equal(getAwarenessLevel(0.49, cfg), "none");
@@ -130,6 +155,30 @@ test("buildAwarenessMessage states the fill, the tool, and the advisory rules",
   assert.match(text, /elevated context pressure/);
 });
 
+test("buildAwarenessMessage names a configured denominator", () => {
+  const text = buildAwarenessMessage({
+    usedTokens: 60_000,
+    limitTokens: 100_000,
+    ratioPct: 60,
+    level: "warn",
+    windowSource: "config",
+  });
+  // The operator must know the denominator was configured, not measured.
+  assert.match(text, /configured/);
+  assert.match(text, /awareness\.contextWindowTokens/);
+});
+
+test("buildAwarenessMessage does not claim a configured denominator from the registry", () => {
+  const text = buildAwarenessMessage({
+    usedTokens: 60_000,
+    limitTokens: 100_000,
+    ratioPct: 60,
+    level: "warn",
+    windowSource: "registry",
+  });
+  assert.equal(/awareness\.contextWindowTokens/.test(text), false);
+});
+
 test("buildAwarenessMessage escalates the wording at the emergency level", () => {
   const text = buildAwarenessMessage({
     usedTokens: 190000,
@@ -149,7 +198,7 @@ test("shouldAutoTrim fires on the first crossing and only re-arms after a step",
   const base = { autoTrimRatio: 0.5, rearmStep: 0.05, hasPending: false };
   assert.equal(shouldAutoTrim({ ...base, ratio: 0.4 }), false);
   assert.equal(shouldAutoTrim({ ...base, ratio: 0.5 }), true);
-  // 0 is the shipped default: auto-trim off.
+  // 0 means "never auto-trim", an explicit opt-out.
   assert.equal(shouldAutoTrim({ ...base, autoTrimRatio: 0, ratio: 0.99 }), false);
   // A compaction already queued for the next request wins over a weaker trim.
   assert.equal(shouldAutoTrim({ ...base, ratio: 0.99, hasPending: true }), false);
diff --git a/tests/config-validation.test.ts b/tests/config-validation.test.ts
index b01fd074..fa496ba8 100644
--- a/tests/config-validation.test.ts
+++ b/tests/config-validation.test.ts
@@ -5,6 +5,7 @@ import { tmpdir } from "node:os";
 import { join } from "node:path";
 import {
   isOverEmergencyBudget,
+  resolveEmergencyBudget,
   DEFAULT_CONFIG,
   validateConfig,
 } from "../src/config.js";
@@ -31,14 +32,39 @@ test("validateConfig names unknown nested keys with their path", () => {
   assert.ok(warnings.some((w) => w.includes("strategies.stripReasoning.huh")));
 });
 
-test("isOverEmergencyBudget flags an over-budget history as a warning only", () => {
+test("the emergency budget derives from the window so a 1M session can satisfy it", () => {
+  // 60 percent of a 1M window: quiet during normal work, fires near the line.
+  assert.equal(resolveEmergencyBudget(DEFAULT_CONFIG, 1_000_000), 600_000);
+  assert.equal(isOverEmergencyBudget(100_000, DEFAULT_CONFIG, 1_000_000), false);
+  assert.equal(isOverEmergencyBudget(599_999, DEFAULT_CONFIG, 1_000_000), false);
+  assert.equal(isOverEmergencyBudget(700_000, DEFAULT_CONFIG, 1_000_000), true);
   // True means "warn", never "abort": an over-budget history must still compact.
-  assert.equal(isOverEmergencyBudget(60000, DEFAULT_CONFIG), true);
-  assert.equal(isOverEmergencyBudget(100, DEFAULT_CONFIG), false);
-  assert.equal(
-    isOverEmergencyBudget(999999999, { ...DEFAULT_CONFIG, tokens: { enabled: false, emergencyBudgetTokens: 0 } }),
-    false,
-  );
+  assert.equal(isOverEmergencyBudget(600_001, DEFAULT_CONFIG, 1_000_000), true);
+});
+
+test("the emergency budget stays quiet when no window is known", () => {
+  // Guessing a denominator is the mistake the awareness module already avoids,
+  // so an unknown window disables the derived warning instead of firing forever.
+  assert.equal(resolveEmergencyBudget(DEFAULT_CONFIG, undefined), 0);
+  assert.equal(resolveEmergencyBudget(DEFAULT_CONFIG, 0), 0);
+  assert.equal(isOverEmergencyBudget(10_000_000, DEFAULT_CONFIG), false);
+});
+
+test("an explicit emergencyBudgetTokens override wins at any window", () => {
+  const overridden = {
+    ...DEFAULT_CONFIG,
+    tokens: { ...DEFAULT_CONFIG.tokens, emergencyBudgetTokens: 60_000 },
+  };
+  assert.equal(resolveEmergencyBudget(overridden, 1_000_000), 60_000);
+  assert.equal(isOverEmergencyBudget(59_999, overridden, 1_000_000), false);
+  assert.equal(isOverEmergencyBudget(60_001, overridden, 1_000_000), true);
+  // 0 with no ratio and no window is the explicit "disabled" shape.
+  const disabled = { ...DEFAULT_CONFIG, tokens: { ...DEFAULT_CONFIG.tokens, emergencyBudgetTokens: 0 } };
+  assert.equal(isOverEmergencyBudget(999_999_999, disabled), false);
+  // A zero derived fraction is the explicit opt-out for the window-scaled path.
+  const ratioOff = { ...DEFAULT_CONFIG, tokens: { ...DEFAULT_CONFIG.tokens, emergencyBudgetRatio: 0 } };
+  assert.equal(resolveEmergencyBudget(ratioOff, 1_000_000), 0);
+  assert.equal(isOverEmergencyBudget(900_000, ratioOff, 1_000_000), false);
 });
 
 test("loadConfig merges project config and warns on unknown keys", async () => {
@@ -64,17 +90,23 @@ test("loadConfig merges project config and warns on unknown keys", async () => {
   }
 });
 
-test("awareness defaults are on with the approved thresholds", () => {
+test("awareness defaults are on, with auto-trim armed and no configured window", () => {
   assert.deepEqual(DEFAULT_CONFIG.awareness, {
     enabled: true,
     warnRatio: 0.5,
     emergencyRatio: 0.8,
     rearmStep: 0.05,
-    autoTrimRatio: 0,
+    autoTrimRatio: 0.55,
+    contextWindowTokens: 0,
   });
   assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
 });
 
+test("token defaults derive the budget from the window", () => {
+  assert.equal(DEFAULT_CONFIG.tokens.emergencyBudgetTokens, 0);
+  assert.equal(DEFAULT_CONFIG.tokens.emergencyBudgetRatio, 0.6);
+});
+
 test("validateConfig names unknown awareness keys and rejects out-of-range values", () => {
   const unknown = validateConfig({ awareness: { nope: 1 } });
   assert.ok(unknown.some((w) => w.includes("awareness.nope")));
@@ -91,6 +123,26 @@ test("validateConfig names unknown awareness keys and rejects out-of-range value
   assert.ok(badAutoTrim.some((w) => w.includes("awareness.autoTrimRatio")));
 });
 
+test("validateConfig accepts the fallback window and rejects impossible values", () => {
+  // 0 means "no configured denominator"; a positive integer is a window.
+  assert.deepEqual(validateConfig({ awareness: { contextWindowTokens: 0 } }), []);
+  assert.deepEqual(validateConfig({ awareness: { contextWindowTokens: 200_000 } }), []);
+  const badWindow = validateConfig({ awareness: { contextWindowTokens: -1 } });
+  assert.ok(badWindow.some((w) => w.includes("awareness.contextWindowTokens")));
+  const fractional = validateConfig({ awareness: { contextWindowTokens: 1.5 } });
+  assert.ok(fractional.some((w) => w.includes("awareness.contextWindowTokens")));
+});
+
+test("validateConfig range-checks the window-scaled budget ratio", () => {
+  assert.deepEqual(validateConfig({ tokens: { emergencyBudgetRatio: 0.6 } }), []);
+  // 0 is the explicit "do not derive" opt-out, not an invalid fraction.
+  assert.deepEqual(validateConfig({ tokens: { emergencyBudgetRatio: 0 } }), []);
+  const badRatio = validateConfig({ tokens: { emergencyBudgetRatio: 1.5 } });
+  assert.ok(badRatio.some((w) => w.includes("tokens.emergencyBudgetRatio")));
+  const badBudget = validateConfig({ tokens: { emergencyBudgetTokens: -5 } });
+  assert.ok(badBudget.some((w) => w.includes("tokens.emergencyBudgetTokens")));
+});
+
 test("loadConfig overrides one awareness key and keeps its siblings", async () => {
   const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
   const { tmpdir } = await import("node:os");
diff --git a/tests/omissions.test.ts b/tests/omissions.test.ts
new file mode 100644
index 00000000..44b163a9
--- /dev/null
+++ b/tests/omissions.test.ts
@@ -0,0 +1,127 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import {
+  MAX_OMISSION_RESPONSE_CHARS,
+  boundOmissionResponse,
+  migrateLegacyOmissions,
+  omissionFilePath,
+  readOmissionOriginal,
+  sessionOmissionDir,
+  writeOmissionOriginal,
+} from "../src/omissions.js";
+import type { OmissionRecord } from "../src/types.js";
+
+// Every test file gets its own data root, so the suite never touches the
+// developer's real omission store.
+process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(
+  join(tmpdir(), "smart-compact-omissions-"),
+);
+
+function record(patch: Partial<OmissionRecord>): OmissionRecord {
+  return { id: "omitted-0001", callId: "call-1", tokens: 10, ...patch };
+}
+
+test("writeOmissionOriginal stores the original outside session state", () => {
+  const content = "original tool output";
+  const path = writeOmissionOriginal("ses-store", "omitted-0001", content);
+  assert.ok(path.startsWith(sessionOmissionDir("ses-store")));
+  assert.equal(readFileSync(path, "utf8"), content);
+  assert.equal(existsSync(path), true);
+  // Two sessions never share a directory.
+  assert.notEqual(
+    sessionOmissionDir("ses-store"),
+    sessionOmissionDir("ses-other"),
+  );
+});
+
+test("readOmissionOriginal reads the file and fails closed when it is gone", () => {
+  const path = writeOmissionOriginal("ses-read", "omitted-0002", "stored text");
+  assert.equal(readOmissionOriginal(record({ path })), "stored text");
+  // A record whose file was evicted (or a session restored elsewhere) returns
+  // undefined so the tool can print the fail-closed notice.
+  assert.equal(
+    readOmissionOriginal(
+      record({ path: join(sessionOmissionDir("ses-read"), "absent.txt") }),
+    ),
+    undefined,
+  );
+  assert.equal(readOmissionOriginal(record({})), undefined);
+});
+
+test("readOmissionOriginal still sees a legacy in-state original", () => {
+  // Before migration, an old session carries the text inline; reading it must
+  // work rather than pretending the original is gone.
+  assert.equal(
+    readOmissionOriginal(record({ content: "legacy text" })),
+    "legacy text",
+  );
+});
+
+test("the store cap evicts the oldest files first", () => {
+  const session = "ses-evict-count";
+  const limits = { maxFiles: 2, maxBytes: 10_000_000 };
+  writeOmissionOriginal(session, "omitted-0001", "one", limits);
+  writeOmissionOriginal(session, "omitted-0002", "two", limits);
+  writeOmissionOriginal(session, "omitted-0003", "three", limits);
+  const files = readdirSync(sessionOmissionDir(session))
+    .filter((name) => name.endsWith(".txt"))
+    .sort();
+  assert.deepEqual(files, ["omitted-0002.txt", "omitted-0003.txt"]);
+  assert.equal(existsSync(omissionFilePath(session, "omitted-0001")), false);
+});
+
+test("the store also caps total bytes", () => {
+  const session = "ses-evict-bytes";
+  const limits = { maxFiles: 100, maxBytes: 10 };
+  writeOmissionOriginal(session, "omitted-0001", "aaaaaa", limits);
+  writeOmissionOriginal(session, "omitted-0002", "bbbbbb", limits);
+  // 12 bytes exceeds the 10-byte cap, so only the newest file survives.
+  assert.equal(existsSync(omissionFilePath(session, "omitted-0001")), false);
+  assert.equal(existsSync(omissionFilePath(session, "omitted-0002")), true);
+});
+
+test("a single original larger than the whole byte cap stays readable", () => {
+  const session = "ses-evict-newest";
+  const limits = { maxFiles: 10, maxBytes: 10 };
+  const body = "0123456789abcdef"; // 16 bytes, larger than the cap on its own
+  const written = writeOmissionOriginal(session, "omitted-0001", body, limits);
+  // The newest file is the only copy of the freshest output: evicting it would
+  // leave older files behind and lose the content the caller just produced.
+  assert.equal(existsSync(written), true);
+  assert.equal(readFileSync(written, "utf8"), body);
+});
+
+test("migrateLegacyOmissions moves inline originals to files", () => {
+  const omissions: Record<string, OmissionRecord> = {
+    "omitted-0001": {
+      id: "omitted-0001",
+      callId: "c1",
+      name: "bash",
+      tokens: 4,
+      content: "legacy body",
+    },
+  };
+  assert.equal(migrateLegacyOmissions("ses-migrate", omissions), true);
+  const migrated = omissions["omitted-0001"]!;
+  assert.equal(migrated.content, undefined);
+  assert.equal(typeof migrated.path, "string");
+  assert.equal(readFileSync(migrated.path!, "utf8"), "legacy body");
+  // Migration is idempotent: a second load has nothing to move.
+  assert.equal(migrateLegacyOmissions("ses-migrate", omissions), false);
+});
+
+test("a large original is truncated with an explicit notice", () => {
+  const original = "q".repeat(MAX_OMISSION_RESPONSE_CHARS + 5000);
+  const text = boundOmissionResponse("omitted-0007", original);
+  assert.ok(text.length < original.length);
+  assert.ok(text.startsWith("q".repeat(100)));
+  assert.match(text, /TRUNCATED/);
+  assert.match(text, /omitted-0007/);
+  assert.match(text, new RegExp(String(MAX_OMISSION_RESPONSE_CHARS)));
+  assert.match(text, new RegExp(String(original.length)));
+  // A response that fits is returned untouched.
+  assert.equal(boundOmissionResponse("omitted-0007", "short"), "short");
+});
diff --git a/tests/prune-bounds.test.ts b/tests/prune-bounds.test.ts
index 7650a752..5bbe92e6 100644
--- a/tests/prune-bounds.test.ts
+++ b/tests/prune-bounds.test.ts
@@ -1,10 +1,16 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
+import { mkdtempSync, readFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
 import { DEFAULT_CONFIG, type SmartCompactConfig } from "../src/config.js";
 import { pruneToolResults } from "../src/prune.js";
 import { selectTurns, type Turn } from "../src/plan.js";
 import { emptyState, type Msg } from "../src/types.js";
 
+// Omission originals live on disk; keep every test inside a temp directory.
+process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-bounds-data-"));
+
 function withPruning(patch: Partial<SmartCompactConfig["pruning"]>): SmartCompactConfig {
   return { ...DEFAULT_CONFIG, pruning: { ...DEFAULT_CONFIG.pruning, ...patch } };
 }
@@ -55,9 +61,12 @@ test("truncate cap prunes over-long results with the full original cached", () =
     },
   ];
   const state = emptyState();
-  const result = pruneToolResults(messages, state, config);
+  const result = pruneToolResults(messages, state, config, "ses-bounds");
   assert.equal(result.pruned, 1);
-  assert.equal(state.omissions["omitted-0001"]!.content, content);
+  // The full original is cached in the per-session file, never in the state blob.
+  const record = state.omissions["omitted-0001"]!;
+  assert.equal(record.content, undefined);
+  assert.equal(readFileSync(record.path!, "utf8"), content);
 });
 
 test("token-measured decisions prune by token budget when enabled", () => {
diff --git a/tests/prune-order.test.ts b/tests/prune-order.test.ts
index 0f73a167..c72b135b 100644
--- a/tests/prune-order.test.ts
+++ b/tests/prune-order.test.ts
@@ -1,9 +1,15 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
+import { mkdtempSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
 import { PRUNE_WEIGHTS } from "../src/config.js";
 import { pruneToolResults, rankPruneCandidates, type PruneCandidate } from "../src/prune.js";
 import { emptyState, type Msg } from "../src/types.js";
 
+// Omission originals live on disk; keep every test inside a temp directory.
+process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-order-data-"));
+
 test("prune weights keep fixed order tool-result first", () => {
   assert.ok(PRUNE_WEIGHTS["tool-result"] > PRUNE_WEIGHTS.summary);
   assert.ok(PRUNE_WEIGHTS.summary > PRUNE_WEIGHTS.omission);
diff --git a/tests/prune.test.ts b/tests/prune.test.ts
index f66d0cd1..67a2d524 100644
--- a/tests/prune.test.ts
+++ b/tests/prune.test.ts
@@ -1,5 +1,8 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
+import { mkdtempSync, readFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
 import {
   applyOmissions,
   pruneToolResults,
@@ -8,6 +11,9 @@ import {
 import { DEFAULT_CONFIG } from "../src/config.js";
 import { emptyState, type Msg } from "../src/types.js";
 
+// Omission originals live on disk; keep every test inside a temp directory.
+process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-prune-data-"));
+
 test("shouldPrune applies per-tool rules", () => {
   assert.equal(shouldPrune("read", "short"), true);
   assert.equal(shouldPrune("question", "x".repeat(5000)), false);
@@ -43,10 +49,12 @@ test("pruneToolResults allocates monotonic ids and caches originals", () => {
       ],
     },
   ];
-  const first = pruneToolResults(messages, state);
+  const first = pruneToolResults(messages, state, DEFAULT_CONFIG, "ses-prune-ids");
   assert.equal(first.pruned, 1);
-  assert.ok(state.omissions["omitted-0001"]);
-  assert.equal(state.omissions["omitted-0001"]!.content, "original file text");
+  const record = state.omissions["omitted-0001"]!;
+  assert.equal(record.content, undefined);
+  assert.equal(typeof record.path, "string");
+  assert.equal(readFileSync(record.path!, "utf8"), "original file text");
   assert.equal(state.nextOmissionId, 2);
 
   // A second, distinct call must not reuse omitted-0001.
@@ -84,8 +92,8 @@ test("applyOmissions replays a stored omission onto a fresh message", () => {  c
     id: "omitted-0001",
     callId: "call-1",
     name: "read",
-    content: "original",
     tokens: 2,
+    path: "/tmp/omitted-0001.txt",
   };
   state.omittedCalls["call-1"] = "omitted-0001";
   const messages: Msg[] = [
@@ -117,14 +125,15 @@ test("applyOmissions fails closed when the cached original is gone", () => {
   assert.match(value, /cleared/);
 });
 
-test("emptyState carries the new stats fields and an empty memo", () => {
-  const stats = emptyState().stats;
-  assert.equal(stats.savedTokens, 0);
-  assert.equal(stats.tokenizerUsed ?? false, false);
-  assert.deepEqual(emptyState().pruneMemo, {});
+test("emptyState carries the new stats fields and no prune memo", () => {
+  const state = emptyState();
+  assert.equal(state.stats.summaryFallbacks, 0);
+  assert.equal(state.stats.measurementPath, undefined);
+  assert.equal("pruneMemo" in state, false);
+  assert.equal("savedTokens" in state.stats, false);
 });
 
-test("pruneToolResults reuses memoized measurement for identical content", () => {
+test("a repeat prune pass stores a fresh file and reports no memo fields", () => {
   const big = "x".repeat(2000);
   const make = (): Msg[] => [
     {
@@ -134,14 +143,14 @@ test("pruneToolResults reuses memoized measurement for identical content", () =>
     },
   ];
   const state = emptyState();
-  const first = pruneToolResults(make(), state);
+  const first = pruneToolResults(make(), state, DEFAULT_CONFIG, "ses-prune-repeat");
   assert.equal(first.pruned, 1);
-  assert.equal(first.memoHits, 0);
-  // Simulate a fresh pass over the same content (mapping cleared).
+  assert.equal("memoHits" in first, false);
+  // The memo is gone: a fresh pass over the same content is measured again.
   delete state.omittedCalls["c1"];
   delete state.omissions["omitted-0001"];
-  const second = pruneToolResults(make(), state);
+  const second = pruneToolResults(make(), state, DEFAULT_CONFIG, "ses-prune-repeat");
   assert.equal(second.pruned, 1);
-  assert.equal(second.memoHits, 1);
   assert.equal(second.tokens, first.tokens);
+  assert.equal("memoHits" in second, false);
 });
diff --git a/tests/store.test.ts b/tests/store.test.ts
new file mode 100644
index 00000000..e13f24ee
--- /dev/null
+++ b/tests/store.test.ts
@@ -0,0 +1,82 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { existsSync, mkdtempSync, readFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import { loadState, type Ctx } from "../src/store.js";
+
+// Omission originals live on disk; keep every test inside a temp directory.
+process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-store-"));
+
+function fakeCtx(initial?: unknown): { ctx: Ctx; storage: Map<string, unknown> } {
+  const storage = new Map<string, unknown>();
+  if (initial !== undefined) storage.set("session:s1", initial);
+  const ctx = {
+    storage: {
+      get: async (key: string) => storage.get(key),
+      set: async (key: string, value: unknown) => void storage.set(key, value),
+      remove: async (key: string) => void storage.delete(key),
+      scan: async () => ({ entries: [] }),
+    },
+  } as unknown as Ctx;
+  return { ctx, storage };
+}
+
+test("loadState migrates legacy in-state originals to files and saves the new shape", async () => {
+  const { ctx, storage } = fakeCtx({
+    summaries: {},
+    omissions: {
+      "omitted-0001": { id: "omitted-0001", callId: "c1", name: "bash", tokens: 5, content: "legacy body" },
+    },
+    omittedCalls: { c1: "omitted-0001" },
+    stats: { prunedTokens: 5, summarizedTurns: 1, prunedParts: 1, savedTokens: 3, tokenizerUsed: true },
+    nextOmissionId: 2,
+    pruneMemo: { c1: { hash: "h", tokens: 5 } },
+  });
+  const state = await loadState(ctx, "s1");
+  const record = state.omissions["omitted-0001"]!;
+  assert.equal(record.content, undefined);
+  assert.equal(typeof record.path, "string");
+  assert.ok(existsSync(record.path!));
+  assert.equal(readFileSync(record.path!, "utf8"), "legacy body");
+  // P6: the memo is gone from state, and a legacy flag maps to the path name.
+  assert.equal("pruneMemo" in state, false);
+  assert.equal("savedTokens" in state.stats, false);
+  assert.equal(state.stats.measurementPath, "tokenizer");
+  // The migration is persisted, so the next load carries no inline original.
+  const saved = storage.get("session:s1") as {
+    omissions: Record<string, { content?: string; path?: string }>;
+    pruneMemo?: unknown;
+  };
+  assert.equal(saved.omissions["omitted-0001"]!.content, undefined);
+  assert.equal(typeof saved.omissions["omitted-0001"]!.path, "string");
+  assert.equal("pruneMemo" in saved, false);
+});
+
+test("loadState keeps the configured-window source and drops malformed values", async () => {
+  const { ctx } = fakeCtx({
+    summaries: {},
+    omissions: {},
+    omittedCalls: {},
+    stats: {},
+    nextOmissionId: 1,
+    awarenessWindow: 200_000,
+    awarenessWindowSource: "config",
+  });
+  const configured = await loadState(ctx, "s1");
+  assert.equal(configured.awarenessWindow, 200_000);
+  assert.equal(configured.awarenessWindowSource, "config");
+
+  const broken = fakeCtx({
+    summaries: {},
+    omissions: {},
+    omittedCalls: {},
+    stats: {},
+    nextOmissionId: 1,
+    awarenessWindow: Number.NaN,
+    awarenessWindowSource: "nonsense",
+  });
+  const state = await loadState(broken.ctx, "s1");
+  assert.equal(state.awarenessWindow, undefined);
+  assert.equal(state.awarenessWindowSource, undefined);
+});
diff --git a/tests/summarize.test.ts b/tests/summarize.test.ts
index 658be2ef..8355a420 100644
--- a/tests/summarize.test.ts
+++ b/tests/summarize.test.ts
@@ -4,9 +4,11 @@ import {
   chunkTurns,
   heuristicSummary,
   parseSummaryBlocks,
+  summarizeTurns,
   type PendingTurn,
 } from "../src/summarize.js";
 import type { Turn } from "../src/plan.js";
+import { emptyState } from "../src/types.js";
 
 function pending(firstId: string, body: string): PendingTurn {
   const turn: Turn = { userText: "u", assistants: [{ id: firstId, text: body }] };
@@ -49,3 +51,46 @@ test("heuristicSummary collapses whitespace and truncates", () => {
   assert.equal(heuristicSummary("a   b\n c"), "a b c");
   assert.ok(heuristicSummary("x".repeat(500)).length <= 401);
 });
+
+test("summarizeTurns counts heuristic fallbacks when the reply omits blocks", async () => {
+  const state = emptyState();
+  const turns: Turn[] = [
+    { userText: "one", assistants: [{ id: "a1", text: "first body" }] },
+    { userText: "two", assistants: [{ id: "a2", text: "second body" }] },
+  ];
+  const ctx = { generate: { text: async () => ({ text: "no summary blocks here" }) } };
+  const result = await summarizeTurns(ctx as never, turns, state);
+  assert.equal(result.summarized, 2);
+  // P7: an unmeasured quality cliff is a defect, so every miss is counted.
+  assert.equal(result.fallbacks, 2);
+  assert.equal(state.summaries["a1"], "first body");
+});
+
+test("summarizeTurns reports zero fallbacks when every block parses", async () => {
+  const state = emptyState();
+  const turns: Turn[] = [{ userText: "one", assistants: [{ id: "a1", text: "body" }] }];
+  const ctx = {
+    generate: {
+      text: async () => ({ text: '<summary id="a1">A real summary.</summary>' }),
+    },
+  };
+  const result = await summarizeTurns(ctx as never, turns, state);
+  assert.equal(result.summarized, 1);
+  assert.equal(result.fallbacks, 0);
+  assert.equal(state.summaries["a1"], "A real summary.");
+});
+
+test("summarizeTurns counts a failing model call as a fallback", async () => {
+  const state = emptyState();
+  const turns: Turn[] = [{ userText: "one", assistants: [{ id: "a1", text: "body" }] }];
+  const ctx = {
+    generate: {
+      text: async () => {
+        throw new Error("model unavailable");
+      },
+    },
+  };
+  const result = await summarizeTurns(ctx as never, turns, state);
+  assert.equal(result.summarized, 1);
+  assert.equal(result.fallbacks, 1);
+});
diff --git a/tests/tokens.test.ts b/tests/tokens.test.ts
index 01c8c8a5..89c8cff6 100644
--- a/tests/tokens.test.ts
+++ b/tests/tokens.test.ts
@@ -4,6 +4,7 @@ import {
   countTokens,
   estimateTokensFallback,
   isTokenizerAvailable,
+  measurementPath,
 } from "../src/tokens.js";
 
 test("estimateTokensFallback returns 0 for empty and ceil(len/4) otherwise", () => {
@@ -17,6 +18,13 @@ test("countTokens honors the disabled flag and uses the fallback", () => {
   assert.equal(countTokens("", false), 0);
 });
 
+test("measurementPath names the path that actually produced the numbers", () => {
+  // Disabled measurement always reports the heuristic, even if a tokenizer is
+  // installed; enabled measurement reports tokenizer only when it loaded.
+  assert.equal(measurementPath(false), "heuristic");
+  assert.equal(measurementPath(true), isTokenizerAvailable() ? "tokenizer" : "heuristic");
+});
+
 test("countTokens falls back when no tokenizer is available", () => {
   if (!isTokenizerAvailable()) {
     assert.equal(countTokens("abcdefgh", true), estimateTokensFallback("abcdefgh"));
```
<!-- END_GIT_DIFF -->
