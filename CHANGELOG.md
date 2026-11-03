# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed

- Auto-trim ships armed: `awareness.autoTrimRatio` now defaults to `0.55` (was `0`), so a long session reclaims bulky tool output without a manual `compact_context` call. The existing hysteresis is unchanged — one sustained period queues one trim, and the latch re-arms only on growth or after the fill drops below the line. Task 61 P1.
- Emergency budget scales with the model window: `tokens.emergencyBudgetTokens` defaults to `0` (derive) and `tokens.emergencyBudgetRatio` (default `0.6`) is applied to the resolved `limit.context`. A positive `emergencyBudgetTokens` stays an exact override, `emergencyBudgetRatio: 0` disables the derived warning, and an unknown window keeps it silent instead of firing forever. One per-request window lookup feeds both the budget and the reminder. Task 61 P2.
- Awareness gains `awareness.contextWindowTokens`, used only when the model registry entry has no usable `limit.context`; the reminder and the stats line state the denominator is configured, and with neither source the advisory still stays silent. Task 61 P3.
- `compact_stats` and `/magic-stats` now start with the plugin version, report which measurement path produced the numbers (`tokenizer` or `heuristic`), and count heuristic summary fallbacks. Task 61 P4/P7/F8.
- README documents the estimator calibration: roughly four characters per token is a lower bound for tool JSON and code.
- **Breaking (config semantics):** `tokens.emergencyBudgetTokens: 0` used to disable the warning and now means "derive from the window", with `tokens.emergencyBudgetRatio: 0` as the explicit opt-out. Anyone who pinned `0` to silence the warning must set the ratio to `0` instead. A positive `emergencyBudgetTokens` (for example an existing `50000`) still behaves exactly as before and stays absolute until changed. Task 61 P2.

### Added

- Bounded per-session omission store (`src/omissions.ts`): pruned originals move out of session state into one file per omission (500 files / 8 MiB per session, oldest-first eviction), state keeps only the id-to-path mapping, legacy inline originals migrate on first load, and `read_omitted_content` caps a single response at 20000 characters with an explicit truncation notice while a missing original still fails closed. Task 61 P5.

### Removed

- `pruneMemo` (the call-id keyed token memo) and the `memo-saved` stat: it measured about zero benefit while writing one entry per call into state. Legacy state drops the field on load. Task 61 P6.

### Added

- Awareness denominator made visible: the resolved context window (`awarenessWindow`) and model name (`awarenessModel`) persist in session state, `compact_stats` ends with `window <tokens> (<model>)`, and an unknown model (or registry entry without `limit.context`) logs one `[smart-compact] awareness disabled` line per model instead of staying silently advisory-free. Silence-by-design is kept — no ratio is ever guessed — but it is now diagnosable from the stats line. Pinned by three `formatStats` tests and two hook-level tests.
- `compact_stats`: read-only agent tool reporting the same session savings as `/magic-stats` (tokens pruned, tool results trimmed, turns summarized, cached omissions, memo-saved tokens, last run, tokenizer state). It takes no inputs, only reads storage, and shares `formatStats` with the slash command, so the Manager-facing and agent-facing numbers cannot drift.

### Fixed

- Audit fixes (OpenCode V2 plugin audit): wrap `ctx.command.transform()`, `ctx.tool.transform()`, and `ctx.session.hook("context")` in try-catch in `setup()`; add an error boundary around `runPrune` in the context hook; return a cleanup function from `setup()`; tighten `@opencode/plugin` peerDependency to `>=2.0.28`; cast `ctx.storage.set` values as `Schema.Json`.

- O1 hotfix V1 duplicate keys: ranked prune no longer collapses duplicate callIds through a Map keyed by callId. Ranking uses unique per-entry ids with index order, both parts prune with distinct omission ids.
- O1 hotfix V2 pointer freshness plus V3-V5 hardening: pointer writes post-prune with fresh keys plus after ratio and warns on failure. Storage reads validate shape fail-closed to null. Formatters guard NaN dates and arrays. Hook guards budget limit and empty state.
- Emergency budget no longer blocks compaction. `checkBudgetGuard` was used as a gate: when a session's measured history exceeded `tokens.emergencyBudgetTokens`, `compactNow` returned without summarizing and the per-request hook returned before the strategies and the prune pass, so the largest sessions silently lost all compaction relief and an explicit `compact_context` / `/magic-compact` request was refused. The predicate is now `isOverEmergencyBudget`, a warning signal only: both callers warn (the hook also notifies) and continue the work. A zero budget still disables the warning.
- Automatic trim no longer queues once per request while a session stays at high pressure. `shouldAutoTrim` now takes `rearmStep` and the latched `autoTrimLastRatio`, so the first crossing fires and a later request fires only after the fill grew by a step; the latch clears once the fill drops a re-arm step below the line, so a genuine new rise trims again. Reset is driven by the ratio rather than by the pending slot, because prune runs before awareness inside one request. Pinned by three hook-level tests (sustained period queues once, drop-and-rise trims again, disabled awareness suppresses the trim) and by the widened `shouldAutoTrim` matrix.
- `autoTrimLastRatio` carried through `SessionState` and the `loadState` whitelist; without it the latch would be dropped on every load and the per-request behaviour would return silently.

### Added

- Automatic lossless trim (`awareness.autoTrimRatio`, default `0` = off): at or above that fill of the context window the context hook queues a tool-output-only trim for the next request instead of only advising. Nothing is summarized, no user message is touched, a compaction already queued is never overwritten, and every pruned original stays retrievable through `read_omitted_content`. Summarization stays agent-driven (`src/awareness.ts:shouldAutoTrim`, `src/index.ts:runAwareness`).
- Context-pressure awareness (`src/awareness.ts` plus the `awareness` config section): when the model-visible context of a session crosses a fraction of the model's context window, the agent receives one advisory reminder on the next model call stating the current fill percentage and the token numbers behind it, naming the `compact_context` tool to call, and telling it to re-orient on the project before compacting. Advisory only: the plugin never compacts on its own, never aborts a step, and never mutates persisted history. Defaults `enabled true`, `warnRatio 0.7`, `emergencyRatio 0.9`, `rearmStep 0.05`; fires once per crossing and re-arms only after the fill grows by a further step.
- Agent guide `docs/AGENT-TOOLS.md`: copy-paste English doc for OpenCode agents covering capabilities plus `compact_context` and `read_omitted_content` call schemas.
- Living folder docs `src/README.md` plus `src/DECISIONS.md`: module map plus D1-D5 architectural decisions.
- O1 hybrid budget meter (D1): pure `getBudgetState` plus `BUDGET_WARN_RATIO 0.7` and `BUDGET_EMERGENCY_RATIO 0.9` in `src/config.ts`, `formatBudgetMeter` in `src/actions.ts`, display-only before/after prune logs in `src/index.ts runPrune`. Warn-only, never changes prune behavior.
- O1 fixed cost prune order (D2): `PRUNE_WEIGHTS` plus `rankPruneCandidates` in `src/prune.ts`, two-pass `pruneToolResults` collects eligible then prunes in ranked order. Tool results first, summaries second, omissions third. User turns never prune.
- O1 backup pointer (D3): `BackupPointer` plus `writeBackupPointer` and `readLatestBackupPointer` capped to 20 latest in `src/store.ts`, `formatBackupPointer` in `src/actions.ts`, best-effort write in `runPrune`. Per-session storage only, Date.now stats-only UTC.
- `compact_context` tool: the agent can compress the session itself (summarize now, schedule pruning) instead of waiting for the Manager to run a slash command. Takes optional `keepTurns` and `mode` (`compact`/`trim`); invalid input returns a friendly message. Shared logic lives in `src/actions.ts` and backs both the tool and the `/magic-compact` / `/magic-trim` commands, so the paths cannot drift.
- Token measurement module (`src/tokens.ts`): tokenizer-first counting with a dependency-free fallback, used only on explicit command paths; no new dependency.
- Preserve-recent window plus truncate-tools bounds in the prune pass: recent turns and the last user message always keep full text, over-long results are cached in full with a notice.
- Reasoning strip strategy plus fail-closed restore: long reasoning parts are replaced with a marker (protected tools exempt), and a cleared cache reports its missing Content ID instead of restoring a phantom.
- Config validation warnings naming exact key paths, plus an emergency budget guard that aborts over-budget runs.
- Prune memo gate keyed by call id plus content hash, with memo-saved tokens, last-run time, and tokenizer flag surfaced in `/magic-stats`.
- QA hardening: the emergency budget guard now aborts over-budget runs in both entry paths without mutating stored state; the preserve window feeds the summarization path; the optional tokenizer loads under ESM as well as CJS; the truncate cap never bites below the task bar; the memo hash covers the full text.

- Phase 0 bootstrap: Kanban dirs (`tasks/backlog`, `in-progress`, `qa`, `completed`, `archive`), `AGENTS.md` project hub, `docs/conventions.md` standards, validated `opencode.json` project config.
- Turn-based compaction planning (`src/plan.ts`) that groups history by user boundary.
- Unit test suite (`tests/`) run through a compiled build (`tsconfig.test.json`), wired to `npm test`.
- Automatic strategies (`src/strategies.ts`): deduplication of identical tool calls and purge-errors of stale errored tool inputs.
- Configuration (`src/config.ts`): `.opencode/smart-compact.jsonc` over global `~/.config/opencode/smart-compact.jsonc` over built-in defaults.
- `/magic-stats` and `/magic-compact` now post a user-visible synthetic message instead of logging only to the server.
- README rewritten for OpenCode V2: install, commands, pruning rules, strategies, and configuration.
- `LICENSE` (MIT) and `scripts/verify-package.mjs` publish gate added; `prepublishOnly` runs typecheck, tests, and payload verification.

### Changed

- Awareness reminder made unmissable: `buildAwarenessMessage` (`src/awareness.ts`) now opens with the action itself as a command ("ACT NOW" / "COMPACT NOW" naming `compact_context` first), states the fill vs hard limit, and names the loss if ignored (overflow drops in-flight work); still advisory-only, never aborts a step. Defaults retuned to `warnRatio 0.5` / `emergencyRatio 0.8` (`src/config.ts`, README updated) so the lower-bound measurement fires before the window is effectively gone. Emergency re-fires on every `runAwareness` while at or above the emergency line until the latch clears automatically below `warnRatio` minus `rearmStep`; warn keeps single-shot plus re-arm-step behavior (`src/index.ts`).
- `package.json` completed for publishing: exports map, `files` allowlist, `@opencode/plugin` peer dependency, repository metadata, engines, and package scripts; version bumped to 0.2.0.
- Summaries now preserve tool-call/tool-result/media structure and replace only prose and reasoning, instead of collapsing the whole assistant message.
- Summarization runs in the command handler via `ctx.generate.text`, out of the `context` hook.
- Omission ids are monotonic (`nextOmissionId`) and no longer collide across restarts.
- `read_omitted_content` is scoped to the calling session's state.
- Package renamed to `@mokhtarabadi/opencode-smart-compact` with `publishConfig.access: "public"` because the unscoped name is owned by another npm author.
- Automated npm publishing via GitHub Actions OIDC trusted publishing (`.github/workflows/publish.yml`); publishes on push when the version is new, with no token secret.
- Batched summarization (`src/summarize.ts`): eligible turns are summarized with one model call per bounded chunk instead of one call per turn, with a heuristic fallback for missing blocks.

### Fixed

- Per-tool pruning rules: `question` is never pruned, `task` uses a higher threshold, `todowrite`/`skill` are discarded without caching, `read` is always pruned.
