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
