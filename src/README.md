# src — Smart Compact Core

Entry `index.ts` wires OpenCode V2 plugin: `session.hook("context")` transform, `command.transform` for `/magic-compact|trim|stats`, `tool.transform` for `compact_context` + `read_omitted_content`.

## Modules

- `index.ts` — setup, runPrune, measureVisibleCost, notify. No transcript mutation.
- `actions.ts` — shared `compactNow`, `scheduleTrim`, `parseCompactArgs`, budget/pointer formatters. Single source so tool + commands cannot drift.
- `plan.ts` — `buildTurns` groups history by user boundary, `selectTurns` excludes recent window.
- `summarize.ts` — batched `summarizeTurns` via `ctx.generate.text`, `<summary id>` parse, heuristic fallback.
- `prune.ts` — `pruneToolResults`, `applyOmissions`, memo, rank, truncate caps, discard/protected rules.
- `strategies.ts` — dedup identical calls, purge stale errors, strip long reasoning.
- `config.ts` — defaults ← global ← project JSONC, validation warnings, budget state.
- `store.ts` — per-session `loadState`/`saveState`, backup pointer capped 20.
- `types.ts` — minimal Msg/Part/SessionState shapes, decoupled from Effect schemas.
- `tokens.ts` — tokenizer-first counting with fallback.

## Boundaries

- Never import adapters in core. Depend on `Ctx` abstraction.
- Storage keys `session:<id>` only. No cross-session reads.
- User messages verbatim. Preserve-recent window always kept.
