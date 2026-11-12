# Task 63: Omission recovery notice and awareness escalation hardening

**File:** `tasks/in-progress/63-omission-recovery-notice-and-awareness-escalation.md`
**Source:** manager
**Type:** improvement
**Status:** open
**Finished:** 2026-11-12T15:23:16Z

## Goal

Make pruned tool output recoverable by construction: every omission notice must name the exact recovery path, and the context-pressure awareness must escalate so an agent under pressure is told to reclaim room rather than warned once and left alone.

## Manager's Notes

Manager ordered a plugin-wide hardening pass after a harness audit found two gaps in the compaction lane.

Measured findings (2026-11-12, HQ workspace):

- A pruned tool result is replaced by a notice plus a Content ID. The agent must call `read_omitted_content` with that ID to recover the original. The notice does not currently name that tool, so an agent can read the notice and never know a recovery path exists — the original is then simply lost for that turn.
- The awareness reminder fires at a warn line and at an emergency line. Between them the agent may burn many turns with a single warning and no instruction about what to do next, and the auto-trim is only queued under its own ratio gate.

Scope guard: this task owns the smart-compact repository only. The goal plugin carries its own task file.

## Local TODOs

- [x] Make every omission notice name the recovery tool and the Content ID explicitly
- [x] Make the awareness reminder state the concrete reclaim action, not only the pressure ratio
- [x] Ensure the emergency level escalates past a single warning while the pressure holds
- [x] Keep user messages verbatim and keep pending or errored tool calls unpruned
- [x] Add tests for the notice content, the awareness text, and the escalation behavior
- [x] Update `CHANGELOG.md` via Parse-Then-Append
- [x] Update sibling `src/README.md` and `src/DECISIONS.md` where the contract changed
- [x] Verify the typecheck and the full test suite pass with exit code 0

## Acceptance Criteria

- [x] Every omission notice names `read_omitted_content` and the exact Content ID
- [x] The notice states that the original is recoverable rather than lost
- [x] The awareness reminder names the reclaim action (trim or compact) alongside the pressure ratio
- [x] The emergency level re-fires on every request while the pressure stays at or above the emergency line
- [x] User messages are never summarized or pruned
- [x] Pending and errored tool calls are never pruned
- [x] `read_omitted_content` returns the original content for a known Content ID and an explicit missing notice for an unknown one
- [x] Typecheck and the full test suite pass with exit code 0

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** all tests pass with exit code 0
- **Actual result:** `tests 172 / pass 172 / fail 0 / cancelled 0 / skipped 0 / todo 0` — 157 pre-existing tests plus the 15 new ones in `tests/omission-recovery-notice.test.ts`. The RTK wrapper printed the collapsed summary (`fail 0`, `duration_ms 3166`).
- **Exit code:** 0
- **Test command:** rtk test npm run typecheck
- **Expected result:** `tsc --noEmit` reports no error, exit code 0
- **Actual result:** no diagnostics; `tsc --noEmit` completed silently (the `> smart-compact@0.3.0 typecheck` banner is the only output).
- **Exit code:** 0
- **Test command:** npm run typecheck
- **Expected result:** strict `tsc --noEmit` over `src` reports no error, exit code 0
- **Actual result:** no output, no errors.
- **Exit code:** 0
- **Test command:** npm test
- **Expected result:** `tsc -p tsconfig.test.json` compiles, then `node --test .test-build/tests/*.test.js` runs every suite; all tests pass, exit code 0
- **Actual result:** `ℹ tests 172 / ℹ pass 172 / ℹ fail 0 / ℹ cancelled 0 / ℹ skipped 0 / ℹ todo 0` (18 suites, including the new `tests/omission-recovery-notice.test.ts`).
- **Exit code:** 0
- **Test command:** npm run verify:package
- **Expected result:** the publish gate passes (metadata shape plus the `npm pack --dry-run` payload), exit code 0
- **Actual result:** `verify-package: OK (20 files)`.
- **Exit code:** 0
- **Mutation check (guard is load-bearing):** with the completed-only guard in `pruneToolResults` temporarily disabled, `npm test` fails exactly the two new invariant tests (`an errored tool call is never pruned`, `a pending tool call is never pruned`) — exit code 1 — and passes again (exit code 0) once the guard is restored. The guard is therefore proven to be what enforces the invariant, not a tautological assertion.
- **Test command:** lint_task_file on `tasks/in-progress/63-omission-recovery-notice-and-awareness-escalation.md`
- **Expected result:** the task file passes the canonical-template validation
- **Actual result:** `✅ /home/mohammad/Develop/Projects/opencode-smart-compact/tasks/in-progress/63-omission-recovery-notice-and-awareness-escalation.md passed Task File linting.`
- **Exit code:** 0

> Verification runner rule: `[exact command]` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

The task is NOT done unless ALL of the following are true:

- [x] Build/Test/Lint pass with exit code 0 (typecheck 0, test 0, `verify:package` 0, `lint_task_file` 0; the repository ships no separate lint script)
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `testing-verification` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** A longer notice text costs tokens on every pruned result, and an awareness message that escalates too aggressively could push an agent into trimming a context it still needs.
- **Rollback plan:** The notice text and the awareness text are single formatter functions, so the previous wording is a one-line revert. The emergency escalation keeps the existing hysteresis latch, so turning it back off is one boolean. No on-disk format changes, so no data migration is involved.

---

## Execution Log & Reasoning

### What was read before editing

`AGENTS.md` (repo hub), the task file, then the full source of `src/omissions.ts`, `src/awareness.ts`, `src/prune.ts`, `src/apply.ts`, `src/actions.ts`, `src/index.ts`, `src/types.ts`, `src/store.ts`, `src/strategies.ts`, the awareness block of `src/config.ts`, plus the test suites `tests/omissions.test.ts`, `tests/awareness.test.ts`, `tests/awareness-hook.test.ts`, `tests/prune.test.ts`, `tests/prune-bounds.test.ts`, `tests/prune-order.test.ts`, `tests/apply.test.ts`. The OpenCode V2 part schema was checked in `node_modules/@opencode/ai/dist/schema/messages.d.ts` to confirm the real shape of a model-visible tool result (`{ type: "tool-result", id, name, result: { type: "json" | "text" | "error" | "content", value } }`).

### (a) The omission notice now carries the whole recovery path

`omissionNotice` (`src/prune.ts`) previously ended with "Content ID: X. Call read_omitted_content with this ID if the original is required." The tool was named, but the argument was not, the id was not bound to the argument, and nothing said the original was still recoverable — a notice that reads like a deletion is never acted on, and the original then sits in the store uncalled for the rest of the turn. The notice now names the tool (`read_omitted_content`), the argument (`contentId`), the exact id to pass (`contentId: "omitted-0001"`), and states that the original is RECOVERABLE, not lost.

`missingOmissionNotice` is the fail-closed twin and keeps a distinct wording: it names the same id, says the original is no longer recoverable, and asks for a rerun. Two notices that say opposite things about recoverability must never share a template, so they were kept separate on purpose.

`read_omitted_content` answered an unknown id with a third string ("No omitted content found for Content ID: X in this session…") while the pruned-result path used `missingOmissionNotice`. The unknown-id branch now routes through `missingOmissionNotice` as well, so the two failure lanes cannot drift and both name the id.

### (b) The awareness reminder names the reclaim action

`buildAwarenessMessage` reported the fill (a percentage plus the token numbers) and named `compact_context` in the surrounding prose, but never named the *mode* to call. A new pure formatter `buildReclaimAction(level)` produces one line that sits directly under the CONTEXT PRESSURE line and names the plugin's own strategy names — `trim` (lossless: tool output becomes a notice, every original stays recoverable) and `compact` (also summarizes old assistant turns, user messages stay verbatim). Those are exactly the `mode` values `compact_context` accepts, so the sentence can be followed as a verbatim call. The emergency variant leads with `NOW` and puts `compact` first because it frees the most room; the warn variant leads with the lossless `trim`.

### (c) Emergency escalation: behaviour kept, policy made explicit

The emergency re-fire already existed as an inline `level !== "emergency"` branch in `runAwareness` (`src/index.ts`). Rather than change the behaviour, the branch was lifted into a pure, testable function `shouldFireAwarenessReminder` (`src/awareness.ts`): the emergency level bypasses the single-shot latch, warn keeps it and delegates to the existing `shouldFireAwareness`. The hook now consumes the function. The hysteresis is untouched — the latch is still cleared only once every armed signal fell below its re-arm line (`isBelowAwarenessRearmLine`), so the wording never oscillates and a downgrade from emergency to warn stays silent.

### Gap found while verifying the invariants

The task asked to *verify* that pending and errored tool calls are never pruned. Verifying found that the rule recorded in `D5` was not enforced: `pruneToolResults` treated a part carrying `result.type === "error"` like any other candidate, so a large failure message could be replaced by an omission notice — hiding the very text the agent needs to diagnose the failure. `toolResultStatus` (`src/prune.ts`) now reads the outcome of every tool-result part (`result.type`, or the host's `state.status` when it is attached) and only a completed result is eligible for pruning *or* discarding. An unknown shape is treated as completed, so the ordinary prune behaviour is unchanged. The guard was proven load-bearing by temporarily disabling it: exactly the two new invariant tests failed (`an errored tool call is never pruned`, `a pending tool call is never pruned`, exit code 1) and passed again after the restore (exit code 0).

User messages were already safe: the prune pass only ever touches `tool-result` parts and the summary lane only ever rewrites assistant turns. That is now pinned by a test rather than assumed.

### Files touched

- `src/prune.ts` — notice contract, missing-notice wording, `toolResultStatus` plus the completed-only guard in `pruneToolResults`.
- `src/awareness.ts` — `buildReclaimAction`, the reclaim line in `buildAwarenessMessage`, `shouldFireAwarenessReminder`.
- `src/index.ts` — the hook consumes `shouldFireAwarenessReminder`; the unknown-Content-ID branch of `read_omitted_content` routes through `missingOmissionNotice`.
- `tests/omission-recovery-notice.test.ts` (new) — 15 tests pinning every acceptance criterion.
- `src/README.md`, `src/DECISIONS.md` (D19, D20, D21), `README.md`, `docs/AGENT-TOOLS.md`, `CHANGELOG.md`, `AGENTS.md` (test count).

### Deliberate non-changes

- No config key was added: the reclaim action is stated in words, not configured, so the config surface stays as it was.
- The notice wording was kept short on purpose — every pruned result pays for it. The recovery path is one sentence, not a paragraph.
- The `read_omitted_content` tool description was not rewritten; it already documented the Content ID and the response cap.
- No version bump: the CHANGELOG was updated with Parse-Then-Append under the existing `## [0.3.0]` header (no duplicate header created).

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `b490bb1c2062156ff3e79877fa00da70d6e743a3`
<!-- END_GIT_DIFF -->
