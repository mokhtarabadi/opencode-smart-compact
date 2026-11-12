# DECISIONS — src

## D1 Budget meter display-only (2026-10-16)

Warn at 0.7, emergency at 0.9. Never gates compaction. Over-budget still compacts because compaction is the remedy. See `src/config.ts:getBudgetState`, `src/actions.ts:formatBudgetMeter`.

## D2 Fixed prune order (2026-10-16)

Weights tool-result 100, summary 50, omission 10, then size desc. Two-pass collect then rank. User turns never enter candidates. See `src/prune.ts:rankPruneCandidates`.

## D3 Backup pointer best-effort (2026-10-16)

Post-prune write with fresh keys + after ratio, cap 20, warn on failure never blocks. Storage epoch ms UTC, ISO display only. See `src/store.ts`.

## D4 Per-turn summaries, verbatim users (V2 rewrite)

V1 mutated transcript. V2 transforms model-visible messages per request. First assistant of turn carries summary, rest absorbed empty. See `src/summarize.ts`.

## D5 Discard vs protect (ongoing)

`question` never pruned. `read` always pruned. `todowrite`/`skill` discarded without cache. `task` higher bar. Pending/errored never pruned.

## D6 Context-pressure awareness is advisory (2026-10-21)

The agent is told how full the context window is and how to reclaim room, but the plugin never compacts on its own, never aborts a step, and never mutates persisted history. The reminder rides on the outgoing model call as one system part (`event.system.push`), so it reaches the agent on the next request without adding a turn or growing the transcript. Warning ratios mirror the budget meter (0.7 / 0.9); a per-session latch makes it fire once per crossing and re-arm only after the fill grows by `rearmStep`. The measured ratio is a lower bound: provider system prompts and tool schemas are invisible to the plugin. See `src/awareness.ts` and `src/index.ts:runAwareness`.

## D7 Auto-trim is the only automatic action (2026-10-22)

Context pressure alone may now trigger one action: at `awareness.autoTrimRatio` the hook queues `pending = { mode: "trim", keepTurns: 0 }` for the next request, reusing the same prune pass a manual trim uses. Trimming is the safe half of compaction - no turn is summarized, no user message is touched, and every pruned original is cached under a Content ID - so running it without asking cannot lose the thread of a task. Summarization stays explicit because it replaces turns with summaries and the agent's own reasoning about which detail matters is the only thing that can decide that safely. A pending compaction is never overwritten, and `0` disables the action (superseded by D11: the shipped default is now `0.55`, so a default install does engage).

The alternative considered was detecting the task boundary (Brain task id, first user message of a task) and trimming there. It was rejected: the plugin only sees model-visible messages, a heuristic on message text is fragile, and the pressure signal already correlates with the moment relief is needed. See `src/awareness.ts:shouldAutoTrim` and `src/index.ts:runAwareness`.

The latch: `autoTrimLastRatio` records the fill at which a trim was queued, and `shouldAutoTrim` fires again only once the fill has grown by `rearmStep`, so a session that stays above the line does not queue a trim on every request. The value is cleared once the fill drops a re-arm step below the line, mirroring the advisory latch. Reset is driven by the ratio, not by the pending slot, because prune runs before awareness inside one request and would otherwise look like an immediate re-arm. Added after review F1; see `src/types.ts` and `src/store.ts` (a field missing from the `loadState` whitelist is dropped on every load).

## D8 Same-session hook serialization is a host guarantee (2026-10-22)

The state read-modify-write in the `context` hook has no lock, and it does not need one inside one host process: in OpenCode v2.1.3 the `context` event has exactly one emit site, inside `SessionRunner.runStep`, and the runner map holds one fiber per `sessionID` — a second input while a step is running only sets `pendingWake` and is drained by the same fiber. Hooks are awaited, not fire-and-forget (`@opencode/plugin` 2.0.22 adapter wraps each callback in an awaited promise).

Two caveats recorded rather than guarded: the guarantee is a property of the runner map, not of the hook layer, so it must be re-checked when the host major version moves; and it does not extend across processes, so two OpenCode servers over the same project could each run a step and lose an update, because `ctx.storage` has no compare-and-set. The plugin accepts the cross-process case: the cost is a lost latch or a re-queued trim, never lost content, since pruned originals stay cached.

## D9 Savings are readable by the agent, through one formatter (2026-10-24)

`/magic-stats` was Manager-only, so an agent could not tell whether a compaction had actually reclaimed anything. It had to ask, or wait for an advisory reminder, which is the wrong shape for a decision an agent makes many times per session. `compact_stats` closes that: a read-only tool with no inputs that returns the same line. Both lanes call `formatStats` in `src/actions.ts`, so a change to the wording or the counters can never make the two disagree, and a malformed counter renders `0` instead of `NaN` because a stats read must not throw into a tool call. It is deliberately not automatic and not injected into the prompt: it costs one tool call, and an agent that does not need the numbers should not pay for them. See `src/actions.ts:formatStats` and `src/index.ts` (stats command plus `compact_stats`).

## D10 Awareness silence is recorded, not just kept (2026-10-28)

A session at high fill produced zero advisories with no clue why: the unknown-model path in `runAwareness` returned before measuring, leaving no trace in state, logs, or stats. The silence policy itself is kept — guessing a denominator would fire wrong ratios — but it is now observable: the resolved window and model persist in session state (`awarenessWindow`, `awarenessModel`, both whitelisted in `loadState`), an unknown model logs one console line per model, and `formatStats` ends with either `window <tokens> (<model>)` or `window unknown (<model> — awareness off)`. Malformed values render "unknown", never throw. See `src/index.ts:runAwareness`, `src/actions.ts:formatStats`.

## D11 Auto-trim ships armed (2026-11-03)

A real long session pruned 1,059,881 tokens and summarized 71 turns, but every reclaim was a manual `compact_context` call: `autoTrimRatio` defaulted to `0`, so the only automatic relief in the plugin never ran. Trimming is lossless by construction (notices plus cached originals, no summary, no user message touched), so the safe operation is now the default: `autoTrimRatio: 0.55`, just above `warnRatio`. The existing hysteresis is unchanged — a sustained period queues one trim and the latch re-arms only on growth or after dropping below the line — so this changes *whether* the plugin engages, not *how often* it can. `0` remains the explicit opt-out. See `src/config.ts:DEFAULT_CONFIG`, `src/awareness.ts:shouldAutoTrim`, and the hook-level default-trim test.

## D12 The emergency budget is a share of the window (2026-11-03)

The old absolute 50,000-token budget was 5 percent of a 1M window, so the warning fired from the first few turns and could never be satisfied, which trains an operator to ignore the channel. The budget now derives from the same resolved window the awareness ratio uses: `emergencyBudgetRatio` (0.6) of `limit.context`, with `emergencyBudgetTokens` as an explicit override. With no known window the warning stays off rather than firing against a guessed denominator; a zero ratio is the explicit opt-out. The predicate remains a warning, never a gate. One window lookup per request feeds both the budget and the reminder, so the two thresholds cannot disagree. See `src/config.ts:resolveEmergencyBudget`, `src/index.ts:resolveWindowForRequest`.

## D13 Configured window fallback, labelled as configured (2026-11-03)

`resolveContextLimit` deliberately refuses to guess when a model entry has no `limit.context`, which left the whole advisory subsystem silently inert for such providers. `awareness.contextWindowTokens` now supplies an explicit fallback; it is used only on a registry miss, and both the reminder and the stats line say the denominator is configured rather than measured. With neither source the advisory still stays silent. `awarenessWindowSource` persists alongside the window so the label survives a restart. See `src/awareness.ts:resolveAwarenessWindow`, `src/index.ts:runAwareness`. Superseded in part by D17: the same key is now also a hard cap when the registry does report a larger window.

## D14 Omission originals live in a bounded file store (2026-11-03)

Session state used to hold the full text of every pruned result, so 397 omissions meant megabytes rewritten on every save, and a retrieval could re-inflate the context pruning had just relieved. Originals now live one file per omission under the plugin data dir; state keeps only the id-to-path mapping. The store is capped at 500 files / 8 MiB per session and evicts oldest-first, retrieval is capped at 20,000 characters with an explicit notice, and a missing file fails closed with the existing missing-original notice. Legacy inline originals migrate on first load; a failed migration keeps the text inline so nothing is lost. See `src/omissions.ts`, `src/store.ts:loadState`, `src/prune.ts:pruneToolResults`.

## D15 The prune memo was removed, not rekeyed (2026-11-03)

`measureMemoized` keyed its cache by `callId`, but a call id identifies one immutable invocation and the prune loop already skips call ids in `state.omittedCalls`; a hit required measuring the same unpruned call twice, a band narrow enough that a real session reported about zero saved tokens. Rekeying by content hash would still pay a hash plus an entry per call for a near-zero hit rate, so the field, the helpers, and the `memo-saved` stat are gone. Legacy state drops `pruneMemo` and `savedTokens` on load. See `src/prune.ts`, `src/store.ts`, `src/actions.ts:formatStats`.

## D16 Stats prove which code and which measurement produced them (2026-11-03)

A review could not tell whether a session ran repository HEAD or the local working tree, nor whether its token figures came from the tokenizer or the heuristic estimate. `compact_stats` now starts with the package version and reports the measurement path used by the last run; it also reports heuristic summary fallbacks, turning a silent quality cliff (a batch whose `<summary>` blocks all missed) into a diagnosable number. No tokenizer dependency was added: the path is reported, not changed by default. See `src/version.ts`, `src/tokens.ts:measurementPath`, `src/summarize.ts:summarizeTurns`.

## D17 The configured window is a cap, not just a fallback (2026-11-10)

A ~10 hour session on a 1,000,000-token model produced zero reminders and zero automatic trims: `resolveAwarenessWindow` returned the registry number unconditionally, so `warnRatio 0.5` needed ~500,000 visible tokens, a fill pruning never allows. The fallback was therefore useless for its most important case — an operator who wants the plugin to engage well below the model's advertised capacity. A positive `awareness.contextWindowTokens` now resolves to `min(registry, configured)`: it is the denominator exactly when the registry has no limit, and a hard cap when the registry reports a larger one. `ResolvedWindow` reports both numbers (`registryTokens`, `capped`), the reminder says `capped=true` instead of claiming a missing `limit.context`, and `compact_stats` appends `, capped from <registry>`. A configured value equal to or larger than the registry number is not a cap (it never raises the denominator above real capacity). The alternative — a second cap-only key — was rejected: one operator-facing number, one meaning, and the existing key already documented "the denominator I want". See `src/awareness.ts:resolveAwarenessWindow`, `src/index.ts:runAwareness`, `src/actions.ts:formatStats`.

## D18 Absolute token thresholds cover what a ratio cannot (2026-11-10)

Even with a cap, a ratio cannot say "this session is already too big": an install that does not want to shrink the denominator still needs a signal at a real size. `awareness.warnAtTokens` / `awareness.emergencyAtTokens` add absolute lines in measured tokens (both `0` = disabled, the shipped default, so nobody inherits new noise). The fired level is the stronger of the ratio level and the token level — two independent, separately tested pure helpers (`getAwarenessLevel`, `getAwarenessTokenLevel`) combined by `getEffectiveAwarenessLevel`. Hysteresis had to become combined too: `isBelowAwarenessRearmLine` requires every armed signal to fall below its own line, using `rearmStep` as a relative margin on the token line (`warnAtTokens * (1 - rearmStep)`) because the step is a fraction. Without that, a token-triggered warning could keep the ratio latch alive and block the next crossing. Emergency keeps its per-request re-fire. See `src/awareness.ts`, `src/index.ts:runAwareness`.

## D19 The omission notice names the recovery path (2026-11-12)

A pruned tool result was replaced by a notice that mentioned a Content ID and said the agent could "call read_omitted_content if the original is required" — but an agent that reads a notice has no way to know a recovery path exists unless the notice says so, and a notice that reads like a deletion is never acted on: the original then stays in the store, uncalled, and the turn loses that content for good. The notice is therefore the whole recovery contract and now carries it in full: the tool (`read_omitted_content`), the argument (`contentId`), the exact id to pass, and the sentence that the original is RECOVERABLE, not lost. The wording is a single formatter (`omissionNotice`), so a change is one line, and the fail-closed twin (`missingOmissionNotice`) keeps its own distinct wording — it names the same id but says the original is gone, so the two notices can never be confused. `read_omitted_content` now answers an unknown id with that same missing notice instead of a second, differently worded string. See `src/prune.ts:omissionNotice`, `src/prune.ts:missingOmissionNotice`, `src/index.ts` (the tool).

## D20 The reminder names the reclaim action, and emergency is a policy function (2026-11-12)

Two gaps in the advisory lane. First, the reminder reported how much pressure there was (a ratio plus token numbers) but not what to do about it, so an agent under pressure had to infer the tool and the mode from the surrounding prose. The reminder now carries a dedicated reclaim line next to the ratio, naming the plugin's own strategy names — `trim` (lossless: tool output becomes a notice, every original stays recoverable) and `compact` (also summarizes old assistant turns) — which are exactly the `mode` values the `compact_context` tool accepts, so the sentence can be followed as a verbatim call. Second, the emergency re-fire was an inline `level !== "emergency"` branch in the hook: real behaviour, but not a policy anyone could read or test in isolation. It is now a pure function (`shouldFireAwarenessReminder`) that bypasses the single-shot latch for the emergency level and keeps it for warn, and the hook consumes it. The hysteresis is deliberately untouched: the latch is still cleared only once every armed signal fell below its re-arm line, so the wording never oscillates between levels and a downgrade from emergency to warn stays silent. See `src/awareness.ts:buildReclaimAction`, `src/awareness.ts:shouldFireAwarenessReminder`, `src/index.ts:runAwareness`.

## D21 Only a completed tool result may be pruned (2026-11-12)

`D5` recorded "pending/errored never pruned" as a rule, but nothing in the prune pass enforced it: a part carrying `result.type === "error"` was a candidate like any other, so a failure message could be replaced by an omission notice — hiding the very text the agent needs to diagnose the failure — and a call still in flight had no finished payload to replace at all. The prune pass now reads the outcome of every tool-result part (`toolResultStatus`, from `result.type` or the host's `state.status` when present) and only ever touches a completed result; pending and errored parts are left exactly as the provider wrote them. The check is fail-safe in the sense that matters here: an unknown shape is treated as completed (so the normal prune behaviour is unchanged) rather than as protected. See `src/prune.ts:toolResultStatus`, `src/prune.ts:pruneToolResults`.
