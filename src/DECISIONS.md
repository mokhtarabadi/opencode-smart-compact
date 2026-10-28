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

Context pressure alone may now trigger one action: at `awareness.autoTrimRatio` the hook queues `pending = { mode: "trim", keepTurns: 0 }` for the next request, reusing the same prune pass a manual trim uses. Trimming is the safe half of compaction - no turn is summarized, no user message is touched, and every pruned original is cached under a Content ID - so running it without asking cannot lose the thread of a task. Summarization stays explicit because it replaces turns with summaries and the agent's own reasoning about which detail matters is the only thing that can decide that safely. A pending compaction is never overwritten, and `0` (the shipped default) keeps the plugin purely advisory, so existing installs see no behavior change until they opt in.

The alternative considered was detecting the task boundary (Brain task id, first user message of a task) and trimming there. It was rejected: the plugin only sees model-visible messages, a heuristic on message text is fragile, and the pressure signal already correlates with the moment relief is needed. See `src/awareness.ts:shouldAutoTrim` and `src/index.ts:runAwareness`.

The latch: `autoTrimLastRatio` records the fill at which a trim was queued, and `shouldAutoTrim` fires again only once the fill has grown by `rearmStep`, so a session that stays above the line does not queue a trim on every request. The value is cleared once the fill drops a re-arm step below the line, mirroring the advisory latch. Reset is driven by the ratio, not by the pending slot, because prune runs before awareness inside one request and would otherwise look like an immediate re-arm. Added after review F1; see `src/types.ts` and `src/store.ts` (a field missing from the `loadState` whitelist is dropped on every load).

## D8 Same-session hook serialization is a host guarantee (2026-10-22)

The state read-modify-write in the `context` hook has no lock, and it does not need one inside one host process: in OpenCode v2.1.3 the `context` event has exactly one emit site, inside `SessionRunner.runStep`, and the runner map holds one fiber per `sessionID` — a second input while a step is running only sets `pendingWake` and is drained by the same fiber. Hooks are awaited, not fire-and-forget (`@opencode/plugin` 2.0.22 adapter wraps each callback in an awaited promise).

Two caveats recorded rather than guarded: the guarantee is a property of the runner map, not of the hook layer, so it must be re-checked when the host major version moves; and it does not extend across processes, so two OpenCode servers over the same project could each run a step and lose an update, because `ctx.storage` has no compare-and-set. The plugin accepts the cross-process case: the cost is a lost latch or a re-queued trim, never lost content, since pruned originals stay cached.

## D9 Savings are readable by the agent, through one formatter (2026-10-24)

`/magic-stats` was Manager-only, so an agent could not tell whether a compaction had actually reclaimed anything. It had to ask, or wait for an advisory reminder, which is the wrong shape for a decision an agent makes many times per session. `compact_stats` closes that: a read-only tool with no inputs that returns the same line. Both lanes call `formatStats` in `src/actions.ts`, so a change to the wording or the counters can never make the two disagree, and a malformed counter renders `0` instead of `NaN` because a stats read must not throw into a tool call. It is deliberately not automatic and not injected into the prompt: it costs one tool call, and an agent that does not need the numbers should not pay for them. See `src/actions.ts:formatStats` and `src/index.ts` (stats command plus `compact_stats`).

## D10 Awareness silence is recorded, not just kept (2026-10-28)

A session at high fill produced zero advisories with no clue why: the unknown-model path in `runAwareness` returned before measuring, leaving no trace in state, logs, or stats. The silence policy itself is kept — guessing a denominator would fire wrong ratios — but it is now observable: the resolved window and model persist in session state (`awarenessWindow`, `awarenessModel`, both whitelisted in `loadState`), an unknown model logs one console line per model, and `formatStats` ends with either `window <tokens> (<model>)` or `window unknown (<model> — awareness off)`. Malformed values render "unknown", never throw. See `src/index.ts:runAwareness`, `src/actions.ts:formatStats`.
