# Task 62: cap the awareness denominator and add absolute token thresholds

**File:** `tasks/qa/62-awareness-window-cap-and-absolute-token-thresholds.md`
**Source:** manager (2026-11-10, after a ~10 hour session on a 1,000,000-token model ran to 9.7M characters of transcript with zero awareness reminders and zero automatic trims)
**Type:** bug
**Status:** qa

## Goal

Make the context-pressure advisory fire on large-window models, where a ratio threshold is unreachable in practice.

Observed failure, verified by the Manager's session state: `awarenessWindow: 1000000`, `awarenessWindowSource: "registry"`, and **no** `awarenessLastRatio`, `awarenessLastLevel`, or `autoTrimLastRatio` was ever written during a 68-user / 1853-assistant-message session. So the reminder never fired, the auto-trim never queued, and only the per-request pruning pass did anything.

Root cause: `resolveAwarenessWindow` (`src/awareness.ts:120`) always prefers the registry `limit.context`, and `awareness.contextWindowTokens` is consulted **only** when the registry has no usable limit. An operator therefore cannot cap the denominator: with `warnRatio 0.5` the first warning needs ~500,000 visible tokens, which the plugin's own pruning keeps far out of reach.

Two independent fixes, because a ratio alone cannot express "this session is already too big" for a 1M window:

1. A positive `awareness.contextWindowTokens` becomes a **hard cap** on the denominator (`min(registry, configured)`), so a session can be warned at a fraction of a deliberately smaller window. The registry-only and config-only paths keep their current meaning, and "no window at all" keeps staying silent.
2. Absolute thresholds `awareness.warnAtTokens` / `awareness.emergencyAtTokens` (default `0` = disabled): the fired level is the stronger of the ratio level and the token level, so a 1M-window session can be warned at, say, 150K tokens regardless of the percentage.

Diagnosability is part of the fix: one `console.log` line per fired reminder and one per queued auto-trim (never per request), carrying the used/limit pair, the registry number, and whether the denominator was capped. `compact_stats` reports the effective window and the cap. A warning must still never break a model call.

## Local TODOs

- [x] Read `AGENTS.md`, `README.md`, `src/awareness.ts`, `src/config.ts`, `src/index.ts`, `src/actions.ts`, `src/store.ts`, `src/types.ts`, and the three targeted test files
- [x] Write the failing tests first (window cap matrix, token-level helper, rearm line, hook-level 1M fire, stats cap marker) and confirm RED
- [x] Implement the cap in `resolveAwarenessWindow` and the token helper in `awareness.ts`
- [x] Add `warnAtTokens` / `emergencyAtTokens` to the config surface, merge, and validation
- [x] Wire the combined level, the two diagnostic log lines, and the persisted cap metadata in `index.ts` / `store.ts` / `types.ts`
- [x] Extend the `compact_stats` line without restructuring it
- [x] Update README, `docs/AGENT-TOOLS.md`, `AGENTS.md` stale test line, `src/README.md`, `src/DECISIONS.md`, CHANGELOG, and the package version

## Acceptance Criteria

- [x] `resolveAwarenessWindow` returns `limitTokens = min(registry, configured)` when both exist, reports both numbers, and sets `capped: true` only when the configured value actually wins.
- [x] Registry-only, config-only, and neither-present behaviour is unchanged (registry wins, config is the fallback, silence otherwise).
- [x] `warnAtTokens` / `emergencyAtTokens` are validated as finite non-negative numbers, `0` disables each, an inverted pair is rejected with a warning and falls back to the defaults.
- [x] The fired level is the stronger of the ratio level and the token level; both halves are separately unit-tested pure functions.
- [x] A 1,000,000-token model with `contextWindowTokens: 200000` fires a reminder at 152,000 measured tokens and logs exactly one `awareness warn fired: 152000/200000 (76%) registry=1000000 capped=true` line.
- [x] A 1,000,000-token model with `warnAtTokens: 150000` fires at 150,000 measured tokens with no configured cap.
- [x] Exactly one `[smart-compact] auto-trim queued: …` line per queued trim, and no log line on a request that neither fires nor queues.
- [x] `compact_stats` reports the effective window plus `capped from 1000000` when the config capped it, in the existing one-line format.
- [x] `npm run typecheck` and `npm test` both exit 0.

## Verification Evidence

Real output observed in this session, pasted verbatim (tails only).

**Baseline before any change** (141 tests, typecheck 0):

```text
> @mokhtarabadi/opencode-smart-compact@0.2.2 typecheck
> tsc --noEmit
typecheck exit=0

ℹ tests 141
ℹ pass 141
ℹ fail 0
```

**RED — the new tests fail before the implementation** (`npm test`, exit 2, compile gate):

```text
tests/awareness.test.ts(7,3): error TS2724: '"../src/awareness.js"' has no exported member named 'getAwarenessTokenLevel'. Did you mean 'getAwarenessLevel'?
tests/awareness.test.ts(8,3): error TS2305: Module '"../src/awareness.js"' has no exported member 'getEffectiveAwarenessLevel'.
tests/awareness.test.ts(9,3): error TS2305: Module '"../src/awareness.js"' has no exported member 'isBelowAwarenessRearmLine'.
tests/awareness.test.ts(346,5): error TS2353: ... 'registryTokens' does not exist in type ...
tests/config-validation.test.ts(171,33): error TS2339: Property 'warnAtTokens' does not exist on type 'AwarenessConfig'.
tests/actions.test.ts(105,9): error TS2339: Property 'awarenessWindowRegistry' does not exist on type 'SessionState'.
EXIT=2
```

**GREEN — typecheck**:

```text
> @mokhtarabadi/opencode-smart-compact@0.3.0 typecheck
> tsc --noEmit
TC_EXIT=0
```

**GREEN — tests** (`npm test`, exit 0):

```text
ℹ tests 157
ℹ suites 0
ℹ pass 157
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
TEST_EXIT=0
```

**Package payload** (`npm run verify:package`, exit 0): `verify-package: OK (20 files)`.

**Behavioural proof** — the compiled plugin booted against a stub context (scratch script outside the repo), 1M-token registry model, project config; the log lines are exactly as shipped:

```text
--- capped denominator (registry 1M, contextWindowTokens 200000) ---
[smart-compact] auto-trim queued: 152000/200000 (76%) registry=1000000 capped=true; tool output will be trimmed on the next request.
[smart-compact] awareness warn fired: 152000/200000 (76%) registry=1000000 capped=true
reminder pushed: 1 | capped note: true
state: {"awarenessWindow":200000,"awarenessWindowSource":"config","awarenessWindowRegistry":1000000,"awarenessWindowCapped":true,"awarenessLastRatio":0.76,"awarenessLastLevel":"warn","autoTrim":{"mode":"trim","keepTurns":0}}
stats: [smart-compact] version 0.3.0; ...; window 200000 (test/model-x — configured, capped from 1000000).
--- absolute token line only (registry 1M, warnAtTokens 150000) ---
[smart-compact] awareness warn fired: 150000/1000000 (15%) registry=1000000 capped=false
reminder pushed: 1 | text has 15%: true
absolute reason stated: true
stats: [smart-compact] version 0.3.0; ...; window 1000000 (test/model-x).
```

This is the exact state the defect report said was never written: `awarenessLastRatio` / `awarenessLastLevel` / `autoTrimLastRatio` now exist on a 1M-window session.

## Definition of Done

- [x] Both verification commands pass with exit code 0, and the new tests were observed RED before the implementation
- [x] Every behaviour change has a test; the pure helpers are tested without the plugin context
- [x] No new log line per request; only per fire and per queued trim
- [x] `compact_stats` keeps its single-line, machine-parsable shape
- [x] `AGENTS.md`, `README.md`, `docs/AGENT-TOOLS.md`, `src/README.md`, `src/DECISIONS.md`, and `CHANGELOG.md` match the shipped behaviour
- [x] `package.json` version is `0.3.0`; nothing committed or published

## Risk & Rollback

- **Risk 1 — the cap silently changes the emergency budget.** `resolveEmergencyBudget` derives from `window.limitTokens`, so a configured cap also lowers the derived budget. Mitigation: this is intentional and documented (one denominator for every threshold, no disagreement); the budget stays a warning, never a gate.
- **Risk 2 — absolute thresholds fire too early on small windows.** Mitigation: both default to `0` (disabled), are opt-in per install, and the ratio path is untouched, so nobody inherits new noise without setting them.
- **Risk 3 — extra log volume.** Mitigation: the log lines sit inside the fire/queue branches only; a request that does neither logs nothing new, and both latching rules still apply.
- **Risk 4 — state shape growth.** Two new persisted fields (`awarenessWindowRegistry`, `awarenessWindowCapped`) must be whitelisted in `loadState` or they are dropped on every load. Mitigation: added to the whitelist and covered by the hook-level tests that assert persisted state.
- **Rollback:** revert to `contextWindowTokens` as a registry-miss-only fallback and drop `warnAtTokens` / `emergencyAtTokens` from `DEFAULT_CONFIG`; the config surface, the state shape, and the stats suffix are additive, so no stored session needs migration and no tool signature changes.

## Execution Log & Reasoning

- **Investigation (2026-11-10):** confirmed the defect at `src/awareness.ts:120-135` — the registry branch returned before the configured value was ever considered, so a 1M registry limit was unconditional and `warnRatio 0.5` needed ~500K measured tokens. The hook gated the fire on the same ratio (`src/index.ts:306-316`), so both the reminder and the auto-trim were unreachable on a large window. Ratio-only hysteresis is the second half of the problem: even a capped denominator leaves absolute size unexpressed, hence the token thresholds.
- **D1 (cap semantics) — `contextWindowTokens` is a cap, not a second key.** One operator-facing number with one meaning ("the denominator I want"), `source: "config"` plus `capped: true` plus `registryTokens` so no caller has to infer anything. A value equal to or larger than the registry number is not a cap, because a larger configured value would demand more context than the model accepts.
- **D2 (state, not recomputation) — `awarenessWindowRegistry` / `awarenessWindowCapped` persist** so `compact_stats` can name the cap without re-querying the registry (the stats path is read-only storage). Both were added to the `loadState` whitelist; without that they would have been dropped on every load, which is the exact class of bug the earlier review caught for `autoTrimLastRatio`.
- **D3 (hysteresis) — `isBelowAwarenessRearmLine` requires every armed signal to clear its own line.** `rearmStep` is a fraction, so the token margin is relative (`warnAtTokens * (1 - rearmStep)`). Without this, a token-triggered warning kept the ratio latch alive and the next ratio crossing stayed silent; with a ratio-only clear, a token-only install would hold a latch that no ratio rise could ever re-arm.
- **D4 (message honesty) — a capped denominator is described as a cap**, and a reminder raised by an absolute line says so (`awareness.warnAtTokens … at 150000 measured tokens`). An emergency at 15% otherwise looks like a bug to the agent reading it.
- **D5 (emergency semantics preserved)** — emergency still re-fires every request while at or above its line, now for either signal. Warn keeps the single-shot latch plus re-arm step, measured in ratio, which is the same quantity the cap makes meaningful.
- **D6 (diagnostics) — two lines, both per event.** The auto-trim line replaced the old `N% of the window is in use;` wording (nothing parsed it, and it lacked the denominator provenance); the fire line is new. A quiet request logs nothing new, which is what makes a dead advisory visible in a log rather than inferred from its absence.
- **Not changed on purpose:** the auto-trim trigger stays ratio-only. The defect is about the reminder and the trim not firing at all; plumbing a second signal into the trim would change how often lossless pruning rewrites tool output — a product decision, not part of this fix. The empty `catch` in `runAwareness` stays: it is the documented "a warning must never break a model call" boundary, and every real failure inside it already logs elsewhere.
- **Docs (2026-11-10):** README (cap + thresholds + stats suffix + budget consequence), `docs/AGENT-TOOLS.md` (sample config, stats reading, thresholds), `src/README.md` and `src/DECISIONS.md` (D17, D18), CHANGELOG `[0.3.0]`, `AGENTS.md` (the stale "no unit suite yet" line and the module list missing `awareness.ts`, `omissions.ts`, `tokens.ts`, `version.ts`), `package.json`/`package-lock.json` 0.3.0. The lock file's root entry had drifted to `0.2.1` with peer `>=2.0.0`; both were resynced to `package.json`.
- **Gates (2026-11-10):** `npm run typecheck` exit 0, `npm test` exit 0 with 157 passing (141 before, +16), `npm run verify:package` exit 0 (`OK (20 files)`). Nothing staged, committed, or published; `git status --short` handed to the Manager.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Pending — staged and injected by the Manager's commit path.
<!-- END_GIT_DIFF -->
