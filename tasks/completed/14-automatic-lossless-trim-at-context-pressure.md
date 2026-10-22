# Task 14: Automatic Lossless Trim At Context Pressure

**File:** `tasks/completed/14-automatic-lossless-trim-at-context-pressure.md`
**Source:** manager
**Type:** feature
**Status:** closed

## Goal

Give the plugin one automatic action that is safe to run without asking: when a session's
model-visible context crosses a configured fill ratio, queue a tool-output-only trim for the
next request instead of only advising the agent. Summarization stays agent-driven. Alongside
it, audit the machine's live plugin state (thresholds, storage hygiene) so the shipped
defaults and the platform config are both defensible.

## Manager's Notes

- The Manager asked whether the plugin already reminds the agent to compact, and whether it
  is automatic. The audit answer: the reminder is automatic, the compression is not.
- The observed evidence on this machine: four sessions latched the advisory at 0.74-0.78 fill
  and pruned zero tokens, so an advisory alone does not produce action.
- The Manager accepted the recommended set: lower the platform thresholds, add the automatic
  trim, and clean the orphaned per-session state. His words: "بزن" and, for the follow-up,
  "تسکش کن تغییراتمون رو و بعدش ببندش".
- The Manager forwarded the plugin decision explicitly: this work is for the agent that runs
  under context pressure, so the trim is preferred over automatic summarization.

## Local TODOs

- [x] Confirm the installed plugin version against the local repository and the remote branch.
- [x] Measure the real behaviour of the awareness layer from persisted per-session state.
- [x] Add `awareness.autoTrimRatio` to the config section (default, merge, validation, keys).
- [x] Add the pure `shouldAutoTrim` decision and wire it into the context hook.
- [x] Unit-test the decision, the config range, and the hook wiring.
- [x] Isolate the test suite from the developer's real global config file.
- [x] Sync `README.md`, `docs/AGENT-TOOLS.md`, `src/DECISIONS.md`, `CHANGELOG.md`.
- [x] Lower the platform thresholds and set the new key in the global config file.
- [x] Remove the orphaned per-session plugin state rows.

## Acceptance Criteria

- [x] At or above `awareness.autoTrimRatio`, the context hook queues a trim for the next
      request by itself, without summarizing a turn and without a user message.
- [x] A compaction already pending is never overwritten by the automatic trim.
- [x] `autoTrimRatio` defaults to `0` (off), so existing installs keep the purely advisory
      behaviour until they opt in.
- [x] The config section validates the new key: `0` plus the open `(0, 1)` range only, with a
      named warning for anything else, and no unknown-key warning for the supported key.
- [x] The test suite is independent of a developer's real `~/.config/opencode` files.
- [x] `npm run typecheck` and `npm test` exit 0, and `lint_task_file` passes on this file.

## Verification Evidence

- **Test command:** `rtk test npm test`
- **Expected result:** the whole node:test suite green, exit 0
- **Actual result:** exit 0, `tests 91 / pass 91 / fail 0` (three new cases: the
  `shouldAutoTrim` matrix, the hook-level auto-trim wiring, the auto-trim-off default, plus
  the `autoTrimRatio` range check in the config suite).
- **Test command:** `rtk test npm run typecheck`
- **Expected result:** `tsc --noEmit` clean
- **Actual result:** exit 0, no diagnostics.
- **Exit code:** 0

> Verification runner rule: the first run of each verification used the `rtk test` prefix. A
> raw rerun was used once, only after a failing RTK run, to read the failing assertion detail.

**Stack skill selection:** root `.`; markers scanned `package.json`, `tsconfig.json`,
`src/index.ts`; matched skills: none; reason: no stack marker found — plain TypeScript OpenCode
V2 plugin, no web or mobile framework markers. Closest discipline reused:
`verification-before-completion` plus the `opencode` skill for the plugin hook contract.

**Sibling doc sync:** `src/DECISIONS.md` gained D7 (auto-trim is the only automatic action),
`README.md` gained the `autoTrimRatio` key plus the corrected comparison paragraph,
`docs/AGENT-TOOLS.md` gained the agent-facing paragraph, and `CHANGELOG.md` gained one entry
under `Unreleased` → `Added`. `src/README.md` needed no change: the module map already lists
`awareness.ts` and the hook owner did not change.

## Definition of Done

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

## Risk & Rollback

- **Risk:** the automatic trim could prune a tool result the agent is about to reuse, costing
  one `read_omitted_content` round-trip or a re-run of the source tool.
- **Mitigation:** only completed tool results over the configured size are eligible, pending or
  errored calls are never pruned, `question` output is protected, user messages and recent
  turns are preserved, and every pruned original is cached under a Content ID.
- **Rollback plan:** set `awareness.autoTrimRatio` to `0` in the config, or revert the
  `shouldAutoTrim` block in `src/index.ts`; both are single-key, single-block reverts.

---

## Execution Log & Reasoning

### What was built

One automatic action at context pressure: `shouldAutoTrim(ratio, autoTrimRatio, hasPending)`
decides when the hook may schedule `pending = { mode: "trim", keepTurns: 0 }` on its own. The
existing prune pass applies it on the next request, so the code path is the same one a manual
`compact_context` trim uses and cannot drift from it.

### Assumptions

- **A1 — pressure trigger, not task boundary.** The Manager's phrasing was "trim at the start
  of a task". The plugin only ever sees model-visible messages: it has no access to the Brain
  task id, the Kanban file, or a session boundary, so detecting a task start would mean
  heuristic matching on message text. Rejected in favour of the measured pressure ratio, which
  is deterministic and correlates with the moment relief is actually needed. Recorded in D7.
- **A2 — defaults unchanged.** `autoTrimRatio` ships as `0` in `DEFAULT_CONFIG`; the platform
  opts in through its global config file. Changing a shipped default would silently alter the
  behaviour of every existing install, which the task did not authorize.
- **A3 — thresholds are platform config, not defaults.** `warnRatio 0.5` and
  `emergencyRatio 0.8` were applied to `~/.config/opencode/smart-compact.jsonc` only. The
  shipped defaults stay `0.7` / `0.9`.

### Findings from the audit that shaped the work

- The installed plugin is the repository head: cache commit `fa02c759` equals both local `HEAD`
  and `origin/main`, version `0.2.1`.
- Awareness had fired four times on this machine (ratios 0.7413-0.7768, all `warn`) and every
  one of those sessions pruned zero tokens and summarized zero turns. That is the evidence
  that the advisory does not produce action by itself.
- The four warning sessions are ephemeral: they hold no rows in `session`, `session_v2`, or
  `session_message`, but their plugin state rows survived. They were removed after backing them
  up to `/tmp/sc-orphan-states-backup.json`.
- Correction to an earlier claim in this session: those orphans were each under 10 KB, so the
  25.2 MB of plugin storage is cached omission originals for live sessions, not orphan bloat.
  Per-session omission storage has no cap; that is a separate, unstarted piece of work.

### Test isolation bug found and fixed

`loadConfig` resolves the global file through `XDG_CONFIG_HOME` or `$HOME/.config`. The suite
never isolated that path, so once the platform config file existed with real values, four tests
failed against the developer's machine rather than against the code. Both affected files now
point `XDG_CONFIG_HOME` at an empty temporary directory before any config read. The suite is
green with the platform config in place, which is the arrangement that actually ships.

### Files

- `src/config.ts` — `autoTrimRatio` on `AwarenessConfig`, default `0`, merge with an explicit
  `0` branch, range validation, known-key entry.
- `src/awareness.ts` — pure `shouldAutoTrim`.
- `src/index.ts` — the auto-trim block in `runAwareness`, after the state load and before the
  advisory branches, with one log line when it queues.
- `tests/awareness.test.ts`, `tests/awareness-hook.test.ts`, `tests/config-validation.test.ts`
  — decision matrix, hook wiring, off-by-default, range check, and XDG isolation.
- `README.md`, `docs/AGENT-TOOLS.md`, `src/DECISIONS.md`, `CHANGELOG.md` — docs sync.

### Local TODO checks

- [x] Installed version matched against repository and remote.
- [x] Live behaviour measured from persisted state rather than assumed.
- [x] Config key added, merged, validated, and documented.
- [x] Decision and hook wiring covered by tests.
- [x] Platform thresholds applied and verified with the real `loadConfig` on the real path.
- [x] Orphaned state removed with a backup taken first.

### Closure

Manager instruction (verbatim): "تسکش کن تغییراتمون رو و بعدش ببندش"

Closure performed via `git mv` to `tasks/completed/` and
`custom_context_commit_and_clean_task`. No source changes in closure.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `7e88f166631734353d502d433bdb780d2d694af7`
<!-- END_GIT_DIFF -->
