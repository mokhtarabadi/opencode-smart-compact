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
