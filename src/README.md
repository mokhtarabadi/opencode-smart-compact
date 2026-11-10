# src — Smart Compact Core

Entry `index.ts` wires OpenCode V2 plugin: `session.hook("context")` transform, `command.transform` for `/magic-compact|trim|stats`, `tool.transform` for `compact_context` + `read_omitted_content` + `compact_stats`.

## Modules

- `index.ts` — setup, runPrune, measureVisibleCost, notify, per-request window resolution, runAwareness. No transcript mutation.
- `actions.ts` — shared `compactNow`, `scheduleTrim`, `parseCompactArgs`, stats/budget/pointer formatters. Single source so tool + commands cannot drift.
- `awareness.ts` — context-pressure awareness: pure measurement of the model-visible messages, window resolution (registry, configured fallback, configured cap), ratio and absolute-token thresholds, latch decision, agent-facing reminder text. No I/O, no state.
- `plan.ts` — `buildTurns` groups history by user boundary, `selectTurns` excludes recent window.
- `summarize.ts` — batched `summarizeTurns` via `ctx.generate.text`, `<summary id>` parse, heuristic fallback counter.
- `prune.ts` — `pruneToolResults`, `applyOmissions`, rank, truncate caps, discard/protected rules; writes originals to the omission store.
- `omissions.ts` — bounded per-session file store for pruned originals, legacy migration, retrieval cap.
- `strategies.ts` — dedup identical calls, purge stale errors, strip long reasoning.
- `config.ts` — defaults ← global ← project JSONC, validation warnings, budget derivation/resolution, budget state.
- `store.ts` — per-session `loadState`/`saveState`, omission migration, backup pointer capped 20.
- `types.ts` — minimal Msg/Part/SessionState shapes, decoupled from Effect schemas.
- `tokens.ts` — tokenizer-first counting with fallback plus the reported measurement path.
- `version.ts` — package version for the stats line.

## Boundaries

- Never import adapters in core. Depend on `Ctx` abstraction.
- Storage keys `session:<id>` only. No cross-session reads.
- User messages verbatim. Preserve-recent window always kept.
- Awareness is advisory: it reminds, it never compacts, never aborts a step, never mutates history. Auto-trim is the one automatic action and is lossless; it is armed at `autoTrimRatio 0.55` by default with the existing one-trim-per-period latch.
- Session state never holds full tool-output originals: they live in the bounded file store under the plugin data dir, and every retrieval is capped at 20000 characters.
- Thresholds that depend on the window resolve through one `resolveAwarenessWindow` call per request, so the emergency budget and the awareness ratio cannot use different denominators.
- `awareness.contextWindowTokens` caps a larger registry window (`min(registry, configured)`) instead of being a registry-miss-only fallback, and `warnAtTokens` / `emergencyAtTokens` add absolute lines because a ratio is unreachable on a very large window. The fired level is the stronger of the two signals.
- Diagnostics are per event, never per request: one `awareness <level> fired: <used>/<limit> (<pct>%) registry=<n> capped=<bool>` line per reminder and one `auto-trim queued: …` line per queued trim.
