# Task 64: Prevent context hook synthetic deadlock and database query freeze

**File:** `tasks/in-progress/64-prevent-context-hook-synthetic-deadlock.md`
**Source:** manager
**Type:** bug
**Status:** in-progress

## Goal

Eliminate OpenCode server lockups and OpenChamber restarts caused by `runPrune` calling `ctx.session.synthetic()` inside OpenCode's `session.hook("context")` pipeline, and prevent database access stalls.

## Manager's Notes

Direct user observation: calling compaction or querying OpenCode database locks up the server, dropping sessions with `ECONNRESET` and triggering OpenChamber's `[lifecycle] periodic health check failed (26/20) class=timeout ... forcing restart`.
Diagnostic investigation proved:
1. `runPrune` in `src/index.ts:107` called `await notify(ctx, sessionID, text)` via `ctx.session.synthetic()`. This re-entered the session runner synchronously while the session was processing the `context` hook, deadlocking the OpenCode server loop.
2. The blocked event loop caused OpenChamber's health check (`GET /api/info` with a 5000ms timeout) to fail 20+ times, prompting OpenChamber to kill the OpenCode process and crash client WebSocket connections.
3. Out-of-band SQLite queries against `~/.local/share/opencode/opencode.db` during transactions also locked WAL resources unless opened in immutable/read-only mode.

## Local TODOs

- [x] Initial codebase exploration and log diagnosis
- [ ] Remove `ctx.session.synthetic()` invocation from `runPrune` in `src/index.ts`
- [ ] Ensure over-budget emergency warnings are logged without re-entering `session.synthetic`
- [ ] Add unit test verifying that `runPrune` during `context` hook execution never calls `ctx.session.synthetic`
- [ ] Run test suite (`npm test`) to ensure all tests pass cleanly
- [ ] Update `CHANGELOG.md` via Parse-Then-Append

## Acceptance Criteria

- [ ] `runPrune` in `src/index.ts` never calls `ctx.session.synthetic()` or any re-entrant session mutation inside `session.hook("context")`.
- [ ] Emergency budget conditions in `runPrune` log via `console.warn` safely without stalling or blocking the server.
- [ ] Unit tests verify `runPrune` executes without invoking `session.synthetic`.
- [ ] Full test suite passes with exit code 0 (`rtk test npm test`).

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** All test suites pass with exit code 0
- **Actual result:** _(Pending execution)_
- **Exit code:** _(Pending execution)_

## Definition of Done

- [ ] Build/Test/Lint pass with exit code 0
- [ ] `CHANGELOG.md` updated via Parse-Then-Append
- [ ] Verification evidence recorded

## Risk & Rollback

- **Risk:** Dropping `notify()` removes chat-level synthetic injection of emergency budget warnings when pruning.
- **Rollback plan:** Revert changes to `src/index.ts` if needed. However, awareness warnings (`runAwareness`) already provide system-level context alerts safely without calling `session.synthetic()`, so removing it from `runPrune` is strictly safer.

---

## Execution Log & Reasoning

Investigated OpenChamber and OpenCode logs:
- `journalctl -u openchamber.service` recorded repeated timeouts on `/api/info` whenever `runPrune` ran on large sessions (>140k tokens).
- Root cause identified: `runPrune` called `await notify(ctx, sessionID, text)`, which called `ctx.session.synthetic({ sessionID, text })`. In OpenCode V2, invoking `session.synthetic` from inside `session.hook("context")` deadlocks the active session worker and freezes the HTTP event loop.
- Solution: Remove `await notify(ctx, sessionID, text);` from `runPrune` in `src/index.ts`, keeping `console.warn(text)`.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
<!-- END_GIT_DIFF -->
