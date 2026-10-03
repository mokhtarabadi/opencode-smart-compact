# Task 08: Agent-callable compaction tool (`compact_context`)

**File:** `tasks/completed/08-agent-callable-compaction-tool.md`
**Source:** manager
**Type:** feature
**Status:** closed

> **Mode:** autopilot locked (Manager, this session).

## Goal

Add a `compact_context` tool so the agent can compress the session itself when the context window is under pressure, instead of relying on the Manager to run `/magic-compact`. The tool reuses the exact command logic (summarize now, schedule the prune pass for the next request) so the two paths can never drift.

## Manager's Notes

Manager order: "One gap worth your call: compaction is still Manager-run only — I cannot trigger it myself. Add it." The tool must expose the same behavior as `/magic-compact` and `/magic-trim`: `mode: "compact"` (default) summarizes old assistant turns and schedules pruning; `mode: "trim"` prunes tool output only; `keepTurns` controls how many recent turns stay unsummarized.

## Local TODOs

- [x] Extract the shared compaction logic into `src/actions.ts` (`parseCompactArgs`, `compactNow`, `scheduleTrim`)
- [x] Register the `compact_context` tool in `src/index.ts` and route the commands through the shared helpers
- [x] Add unit tests for `parseCompactArgs`
- [x] Update README, CHANGELOG, and AGENTS.md
- [x] Verify with the RTK-prefixed test command and record evidence

## Acceptance Criteria

- [x] A `compact_context` tool is registered and callable with optional `keepTurns` and `mode`
- [x] `mode: "compact"` summarizes eligible turns now and schedules pruning; `mode: "trim"` schedules pruning only
- [x] Invalid `keepTurns` returns a friendly message instead of throwing
- [x] The `/magic-compact` and `/magic-trim` commands use the same shared helpers (no duplicated logic)
- [x] `parseCompactArgs` is unit-tested for defaults, trim, keepTurns, and invalid input
- [x] `npm run typecheck` and `npm test` pass

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and unit tests pass, exit code 0
- **Actual result:** `tests 19, pass 19, fail 0`; `npm run typecheck` exit 0; `npm run verify:package` OK (14 files)
- **Exit code:** 0

> Verification runner rule: `npm test` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

## Risk & Rollback

- **Risk:** an agent-triggered compaction could summarize turns the agent still needs. Mitigated: summaries keep tool structure and user messages verbatim, and the original tool output stays retrievable via `read_omitted_content`; the agent chooses `keepTurns` to protect recent turns.
- **Rollback plan:** remove the tool registration and the `src/actions.ts` extraction; the commands keep working from the same helpers.

---

## Execution Log & Reasoning

**Plan verdict:** Manager-authorized direct feature — "compaction is still Manager-run only — I cannot trigger it myself. Add it." His order is the plan. **Brainstorm:** not required — a single-module additive change with an obvious design (reuse the command path), no cross-disciplinary ambiguity, no destructive or security surface. **Seat Check:** domain = plugin API (Senior Programmer) → requested: Senior Programmer; skipped: UI/UX Designer (no surface), Architect/Strategist (no schema or scope change).

**Design:** extracted the command logic into `src/actions.ts` so the agent-triggered and Manager-triggered paths share one implementation:
- `parseCompactArgs(input)` — pure normalizer: `mode` defaults to `compact` (`trim` only when explicitly `"trim"`), `keepTurns` defaults to `0` and must be a non-negative integer.
- `compactNow(ctx, sessionID, keepTurns)` — summarizes eligible turns now via `ctx.session.context` + `summarizeTurns`, sets `pending`, persists, returns the count.
- `scheduleTrim(ctx, sessionID, keepTurns)` — schedules a prune-only pass.

`src/index.ts` now registers the `compact_context` tool (optional `keepTurns`, `mode`); it catches `parseCompactArgs` errors and returns a friendly `content` string instead of throwing, matching `read_omitted_content`'s style. The `/magic-compact` and `/magic-trim` commands now call the same helpers, removing the previous duplicated body (and an unused `loadConfig` call in the COMPACT handler).

**Why a tool, not auto-invocation:** the plugin cannot force a compaction on its own — the `context` hook runs on every request and must stay cheap and side-effect-free apart from applying stored state. A tool lets the agent decide, with a description that tells it to call when the window is under pressure. Summaries are produced at call time (bounded by `MAX_TURN_CHARS`); the prune pass and application land on the next request, exactly like the commands.

**Safety:** user messages stay verbatim; only assistant prose/reasoning is replaced; tool-call/tool-result structure is preserved; the original tool output stays retrievable via `read_omitted_content`; the agent can pass `keepTurns` to protect recent turns. No transcript mutation — the state is per-session and per-request.

**Assumptions (logged):** A1 the tool keeps the same "summarize now, prune next request" semantics as the command (the hook is where messages are visible). A2 no version bump in this task — the git-spec install picks up the pushed commit, and bumping would let a push auto-publish; the Manager decides when to release.

**Verification:** `rtk test npm test` → `tests 19, pass 19, fail 0`, exit 0; `npm run typecheck` exit 0; `npm run verify:package` OK (14 files). The new `tests/actions.test.ts` covers defaults, `trim`, unknown mode → compact, valid `keepTurns`, and invalid `keepTurns` (-1, 1.5, "2", NaN).

**Live-test note:** the plugin is installed from the Git spec, so this change goes live only after the repo is pushed and the plugin re-added (or OpenCode re-fetches); the tool then appears alongside `read_omitted_content`. No push performed (ZAC).

**Gates (autopilot):** QA Engineer `VERDICT: QA_PASSED` (tool registration, validation, no transcript mutation, no logic drift, agent safety all confirmed; T1 integration-test gap noted as non-blocking). Code Reviewer `PO_REVIEW_PENDING` — technically approved, Low only: R1 prefer `deepStrictEqual` in the tests (already satisfied — `node:assert/strict` aliases `deepEqual` to `deepStrictEqual`), R2 an integration test for `compactNow`'s pending write in a future task. No blocking issues; closure awaits the Manager's exact word.

**Closure executed** on Manager quote "Approved for closure": moved to `tasks/completed/`, Status `closed`. Manager chose **not to push yet**, so the tool is committed locally and not yet live in OpenCode.

**Kanban cleanup note:** the qa file had already been staged by `qa_transition`, so the plain `mv` to `completed/` left a stale `tasks/qa/` copy in the index; the correct form was `git mv`. Cleaned up in the follow-up commit: the stale qa path is removed and the completed file re-referenced. The feature commit is `fcf512fd`.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `36b4ee361c7e2c1f89ac7c275fe2eed25953a5ac`
<!-- END_GIT_DIFF -->
