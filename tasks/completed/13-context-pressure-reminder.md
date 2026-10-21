# Task 13: Context Pressure Reminder For Agent Awareness

**File:** `tasks/completed/13-context-pressure-reminder.md`
**Source:** manager
**Type:** feature
**Status:** closed

## Goal

Add a context-pressure awareness layer to the plugin: when a session's model-visible
context crosses a configured fill ratio of the model's context window, the plugin
informs the agent that the context is filling, states the current fill percentage,
and tells it exactly what to do (compact the session with the plugin's own
`compact_context` tool) instead of letting the agent forget until the Manager has to
run `/magic-compact` by hand.

## Manager's Notes

- The Manager's observed failure mode: the agent keeps working, forgets that the
  context window is filling, and the Manager ends up calling `/magic-compact` manually.
- The reminder must be a professional, complete message addressed to the AI agent, not
  a bare log line. It must include: the current fill percentage, the measured/limit
  token numbers, what to do, and how to do it.
- The message must explicitly instruct the agent to look the tool up in its own tool
  list (search for `compact_context`, or the `/magic-compact` command as the manual
  equivalent) and to re-orient on the project before compacting, so the compaction
  does not lose the thread of what the Manager asked for.
- The reminder must be advisory only: it must never auto-compact and must never
  interrupt a critical step. The agent decides.
- It must tell the agent the current context window status (how full it is now), so
  the agent can act on a concrete number instead of a vague warning.
- When the work in flight is not critical and the session can be compacted, the agent
  must compact — sessions and turns must not silently overflow.
- Separate concern from the existing budget meter: the meter is display-only; this is
  an agent-facing nudge.

## Local TODOs

- [x] Read the OpenCode v2 plugin API surface (`ctx.session.hook("context")` event
      shape, `ctx.session.synthetic`, `ctx.model.list()` limit lookup).
- [x] Decide the delivery channel for the reminder (hook-injected system part vs
      synthetic session message) and record the decision.
- [x] Add the `awareness` config section (defaults, merge, validation, unknown-key
      warnings) in `config.ts`.
- [x] Add the awareness module: measure visible context cost, resolve the model's
      context limit, build the professional reminder text, decide when to fire.
- [x] Wire the awareness pass into the `context` hook in `index.ts`.
- [x] Extend the per-session state with the awareness bookkeeping (last fired ratio,
      last fired level).
- [x] Write unit tests for measurement, threshold decision, and message content.
- [x] Update `src/README.md`, `docs/AGENT-TOOLS.md`, and `CHANGELOG.md`.
- [x] Verify: typecheck + test suite exit 0, task lint passes.

## Acceptance Criteria

- [x] When the model-visible context of a session crosses the configured warning
      ratio of the model's context window, the agent receives a message that states
      the current fill percentage and the token numbers behind it.
- [x] The message tells the agent to call the plugin's `compact_context` tool, how to
      find it (search the tool list; `/magic-compact` is the manual equivalent), and
      to re-orient on the project (read `AGENTS.md` and the active task file) before
      compacting so the thread of the request is preserved.
- [x] The message states that compaction is advisory and must be skipped when the
      agent is mid-critical-step, and that user messages are never summarized while
      pruned tool output stays retrievable via `read_omitted_content`.
- [x] The reminder fires once per threshold crossing, never on every request, and
      re-arms only after the fill ratio rises by the configured step.
- [x] Nothing is auto-compacted and no request is aborted by the awareness pass.
- [x] The feature is off by default or explicitly configurable, and the config
      section is documented in the README and validated like every other section.
- [x] `npm run typecheck` and `npm test` exit 0, and `lint_task_file` passes on this
      task file.

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck clean and the whole node:test suite green, exit 0
- **Actual result:** `npx tsc --noEmit` exited 0. `rtk test npm test` exited 0 with
  `tests 88 / pass 88 / fail 0` (up from 68 before this work: 11 awareness unit
  tests, 10 hook-level integration tests, 4 config tests). The hook
  integration test drives the real plugin setup against a stub context and
  asserts that exactly one system part is pushed at 80 percent fill, that a
  repeat at the same fill pushes nothing, that the latch re-arms only after the
  configured step, that a drop below the threshold clears the latch, that a
  session hovering at the boundary does not re-fire, that an emergency fill
  escalates the wording, that a downgrade back to warn stays quiet, and that an
  unknown model, a bare-array registry, a failing registry, and the disabled
  kill switch all produce no reminder. The stub context throws if the
  awareness pass calls `session.compact`, `session.prompt`, or
  `session.synthetic`, so the advisory-only guarantee is enforced by the test
  rather than by comment.
- **Exit code:** 0

> Verification runner rule: `[exact command]` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

**Stack skill selection:** root `.`; markers scanned `package.json`,
`tsconfig.json`, `src/index.ts`; matched skills: none; reason: no stack marker
found — this is a plain TypeScript OpenCode V2 plugin with no web or mobile
framework markers. Closest discipline reused: `verification-before-completion`
(strict gate: typecheck plus test suite plus recorded evidence, no completion
claim without a green exit code).

**Sibling doc sync:** `src/README.md` gained the module line and the awareness
boundary, `src/DECISIONS.md` gained D6, `docs/AGENT-TOOLS.md` gained the
agent-facing section, the root `README.md` gained the config block plus the
corrected comparison paragraph, and `CHANGELOG.md` gained one entry under
`Unreleased` → `Added`.

**Working tree hygiene (separate from the feature):** `node_modules` was
tracked in the index (17,911 paths) while ignored by `.gitignore`, so the tree
showed every dependency as deleted. The index entries were removed with an
index-only `git rm -r --cached node_modules`, leaving the installed tree
untouched and the ignore rule authoritative. `package-lock.json` was refreshed by
the install; it had been stale (unscoped name, version 0.1.0) against
`package.json` (scoped name, version 0.2.1) and is included in the staged set.

## Definition of Done

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** the reminder could fire on every request and flood the transcript, or it
  could interrupt a critical step mid-edit. Mitigation: threshold-crossing dedupe in
  per-session state, advisory-only wording, and no request mutation beyond an added
  system part.
- **Rollback plan:** set `awareness.enabled` to `false` in the config, or remove the
  hook wiring in `src/index.ts`; both are single-file, single-block reverts.

---

## Execution Log & Reasoning

### What was built

Context-pressure awareness. When the model-visible context of a session crosses a
configured fraction of the model's context window, the plugin pushes one advisory
system part onto the outgoing model call. The agent sees the live fill
percentage, the token numbers behind it, the tool to call, and the rules for
calling it safely. The plugin never compacts on its own, never aborts a step,
and never mutates persisted history.

### Why a system part, not a message

The reminder has to reach an agent that is mid-task, and it must not become a
turn of its own. `event.system.push` is documented to affect only the outgoing
model call, so the transcript does not grow, no new turn is admitted, and the
note rides along on every tool-driven continuation. A synthetic message would
create a durable inbox item and risk flooding the transcript. The existing
`notify()` helper stays reserved for Manager-visible notices.

### Files

- `src/awareness.ts` (new) — pure module: `measureVisibleTokens`,
  `resolveContextLimit`, `getAwarenessLevel`, `shouldFireAwareness`,
  `buildAwarenessMessage`. No I/O, no state, no SDK types.
- `src/config.ts` — new `awareness` section (`enabled`, `warnRatio`,
  `emergencyRatio`, `rearmStep`), defaults 0.7 / 0.9 / 0.05, a merge that keeps
  sibling keys on a partial update, unknown-key warnings, and range checks that
  fall back to the defaults instead of breaking the hook.
- `src/types.ts` — `awarenessLastRatio` and `awarenessLastLevel` on the session
  state.
- `src/store.ts` — the state loader is a whitelist, so the two latch fields had
  to be carried through it; without that the latch is dropped on every load and
  the reminder fires on every request.
- `src/index.ts` — `runAwareness` runs last inside the existing `context` hook,
  after pruning and summarization, so it measures exactly what the model is
  about to receive. Wrapped in a try/catch: a warning must never break a model
  call.
- `tests/awareness.test.ts` and `tests/awareness-hook.test.ts` (new) — unit
  tests plus a hook-level integration test that drives the real plugin setup
  against a stub context.
- `tests/config-validation.test.ts` — awareness defaults, partial override,
  unknown key, and out-of-range fallback.
- `src/README.md`, `src/DECISIONS.md` (D6), `docs/AGENT-TOOLS.md`, `README.md`,
  `CHANGELOG.md` — docs sync.

### Deviations from the Brain's implementation sketch, and why

The sketch for `measureVisibleTokens` walked a generic `parts` / `content` /
`text` shape. The real message shape in this repo is `Msg.content: Part[]`, and
the bulk of a session's context lives in tool results under
`part.result.value`. Measuring the sketched shape would have returned roughly
zero for every session, so the ratio would never have crossed a threshold and
the feature would never have fired. The measurement was therefore implemented
against the real type: text parts, reasoning parts, tool results, and tool-call
arguments, reusing the same dependency-free estimate as the prune pass.

The sketch also omitted the state loader, which reconstructs the session state
field by field. Carrying the two latch fields through it was required.

### Assumptions

- The measured ratio is a lower bound: provider system prompts and tool schemas
  are invisible to the plugin. The reminder says so instead of pretending the
  number is exact.
- A model missing from the registry, or one with no positive context limit,
  leaves the plugin silent rather than guessing a window size.
- `awareness.enabled` ships on, matching the plugin's own `enabled` default, so
  the reminder works without configuration. It stays a one-line kill switch.
- The model registry is read once per request through `ctx.model.list()`. The
  plugin already reads its config files on every request, so this stays in line
  with the existing per-request cost, and it avoids a stale cached window size
  when a provider limit changes.

### QA round one

The QA Engineer returned `QA_PASSED` with four issues and three missing tests.
Three of them reproduced and were fixed; one was disputed with evidence.

- Fixed: the hook only ever saw the `{data}` shape of the model registry, so
  the bare-array branch was untested. A case now covers it. The QA note that
  the production path is the bare array is the reverse of what the installed
  SDK shows — `ctx.model.list()` returns `{location, data}` and the bare array
  is what the model editor returns — so that branch is the defensive one, kept
  and now covered rather than dropped.
- Fixed: the kill switch had no test. A case now boots the plugin against a
  project config that disables awareness and asserts that nothing is pushed.
  The kill switch is the documented rollback path, so it earns a test.
- Fixed: a failing model registry now has a case asserting a silent skip and
  no throw.
- Fixed: `serializeResult` returned `undefined` for an undefined value while
  claiming to return a string. The awareness pass guards against it, and the
  helper itself now always returns a string, which also removes a latent
  crash in the prune pass where a tool result without a value was read for
  its length.
- Fixed: a session hovering at the threshold re-fired the reminder on
  alternating requests, because the latch was cleared on every dip under the
  threshold. The latch is now cleared only once the context has fallen
  meaningfully below it, by one re-arm step. A genuinely compacted session
  still falls far enough to re-arm, and a session that merely hovers stays
  quiet.

### QA round two

The QA Engineer returned `QA_PASSED` again, confirmed all five round-one fixes,
and found no new null-dereference, race, or threshold bypass. Two test gaps were
left open for the reviewer and were closed here: the emergency wording is now
covered at the hook level, not only in the unit test, and the behaviour of a
session that drops back from emergency to warn without the fill growing is now
locked by a case — the latch holds and nothing is pushed. A typo in the README
and changelog ("mututes" for "mutates") was corrected.

### Code review

The Code Reviewer returned technical approval with a pending-review notice:
the reminder matches the approved plan and the project rules. The reviewer
confirmed the pure module with no I/O, the single system-part delivery after
prune and apply, the latch with hysteresis, the config merge with range
validation and the tested kill switch, and all eight required points in the
message. Three notes were informational only: the lockfile refresh rides in
this diff, the clear line sits one re-arm step below the warn threshold, and
the state-loader carry was required. No code change was requested.

The file stays in `tasks/qa/` until the Manager gives the explicit closure
word. This entry is the `PO_REVIEW_PENDING` record.

### Autopilot lock

The Manager locked autopilot mode for this task. QA, the fix loop, and the code
review are chained from the Hands against the same task id, with the staged diff
attached to every turn. Closure stays a human gate: it needs the explicit
approval word, and this file will not move to `tasks/completed/` without it.

### Local TODO checks

- [x] API surface confirmed against the installed `@opencode/plugin` type
      declarations, not from memory: the `context` hook event carries `system`,
      `model`, and `messages`; `ctx.model.list()` returns a list under `data`.
- [x] Delivery channel chosen and recorded: one system part, advisory only.
- [x] Config section added with defaults, merge, validation, and warnings.
- [x] Awareness module added as a pure, dependency-free module.
- [x] Hook wired, with the pass running last and failing soft.
- [x] Session state extended, including the loader that persists it.
- [x] Tests written: 9 unit, 4 hook-level integration, 4 config.
- [x] Docs synced across the module map, the decision log, the agent guide, the
      root README, and the changelog.
- [x] Verification run and recorded.

### Closure

Manager accept (verbatim, answering the relayed closure question): "Approved for closure"

Closure performed via git mv to tasks/completed/ and custom_context_commit_and_clean_task. No source changes in closure.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `377d7bd15620d0f783535d460ed0aca2e282af90`
<!-- END_GIT_DIFF -->
