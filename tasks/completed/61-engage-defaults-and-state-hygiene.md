# Task 61: make smart-compact actually engage (auto-trim, budget scaling, awareness fallback, state hygiene)

**File:** `tasks/completed/61-engage-defaults-and-state-hygiene.md`
**Source:** manager (2026-11-03, after a single long session ran to ~681K measured tokens with zero automatic reclamation while emitting a budget warning on every turn)
**Type:** improvement
**Status:** closed
**Finished:** 2026-11-03T19:04:11Z

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
- **Closure (2026-11-03):** manager answered the relayed PO question with "Approved for closure (both)", naming this task and the goal-plugin task together. Moved to `tasks/completed/`, status closed. Committed through the MCP closure path only; no direct git commands were used.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `64554f765b5fce9261aa0a429905927edec32a36`
<!-- END_GIT_DIFF -->
