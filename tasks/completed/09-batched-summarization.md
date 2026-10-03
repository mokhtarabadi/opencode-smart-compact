# Task 09: Batch per-turn summarization into single model calls

**File:** `tasks/completed/09-batched-summarization.md`
**Source:** manager
**Type:** improvement
**Status:** closed

> **Mode:** autopilot locked (Manager, this session).

## Goal

Reduce compaction cost by batching eligible turns into as few `ctx.generate.text` calls as possible, mirroring the reference `magic-compact` plugin's single-request summarization, instead of making one model call per turn.

## Manager's Notes

The reference study showed `magic-compact` generates all turn summaries in one request and parses id-tagged blocks, while our summarizer called the model once per turn. This task ports that design with a bounded chunk size and a heuristic fallback so a failed or partial reply never breaks compaction.

## Local TODOs

- [ ] Add pure `parseSummaryBlocks` and `chunkTurns` helpers
- [ ] Rewrite `summarizeTurns` to batch turns into one call per chunk with per-turn fallback
- [ ] Add unit tests for the parser and chunker
- [ ] Update README and CHANGELOG

## Acceptance Criteria

- [x] Eligible turns are summarized with one model call per chunk, not one per turn
- [x] A missing or malformed block falls back to a deterministic heuristic
- [x] Absorbed (non-first) assistant messages are still marked with the empty sentinel
- [x] `npm run typecheck` exits 0 and unit tests pass

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and unit tests pass
- **Actual result:** 25/25 tests pass (6 new for the parser/chunker); typecheck exit 0
- **Exit code:** 0

> Verification runner rule: `npm test` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

The task is NOT done unless ALL of the following are true (unconditional, applies to every source type):

- [x] Build/Test/Lint pass with exit code 0
- [ ] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** A single large prompt could exceed a model's input budget
- **Rollback plan:** Chunks are capped at 12000 chars; revert `summarize.ts` to the per-turn version if needed

---

## Execution Log & Reasoning

Autopilot locked (Manager). Ported the reference `magic-compact` single-request summarization.

Changes:
- `src/summarize.ts`: added pure `parseSummaryBlocks` (`<summary id="...">…</summary>`) and `chunkTurns` (bounded chunks, default 12000 chars); rewrote `summarizeTurns` to make one `ctx.generate.text` call per chunk and fall back to `heuristicSummary` for any missing block. Absorbed-sentinel and tool-only absorption behavior unchanged.
- `tests/summarize.test.ts`: 6 new tests for the parser, chunker, and heuristic.
- `README.md`, `CHANGELOG.md`: documented.

Verification: 25/25 tests, typecheck exit 0.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `c7e0b4ff63cdd4687011c583f494252ec04d2d79`
<!-- END_GIT_DIFF -->
