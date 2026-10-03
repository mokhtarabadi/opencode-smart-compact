# Task 5: v2-overhaul-bundle

**File:** `tasks/completed/05-v2-overhaul-bundle.md`
**Source:** manager
**Type:** feature
**Status:** closed
**Supersedes:** [02, 03, 04]
**Meta:** true
**Created:** 2026-10-03 06:35 UTC
**Bundled:** 3 tasks

## Goal

Unified execution of 3 related small tasks as a single META task to eliminate sequential overhead. This META bundles tasks [02, 03, 04] — "v2-overhaul-bundle" — into one branch, one diff, and one QA gate (all-or-nothing). Every requirement below is preserved **verbatim** from its source task; no summarization or omission is allowed.

> ⚠️ **Guardrail Warning:** Combined source size is 4101 LOC (> 400). Unified META diff may be large and hard to review. Consider splitting into two METAs.

**Source IDs:** [02, 03, 04]
**Next ID:** 5 (discovered via `find tasks -name "*.md" | sort -n | tail -1 +1`)
**Archive Policy:** Source files will be moved to `tasks/archive/` with `superseded-by: 5-v2-overhaul-bundle` and remain reachable via `git log --follow` (never purged until META is completed).

## Manager's Notes

**Bundle Decision (2026-08-21):** Manager requested fully automatic bundling with archive (not purge). This META was generated deterministically by the `bundle_tasks` MCP tool to execute 3 small related tasks together and speed up turnaround.

**Traceability:**
- Supersedes [02, 03, 04] — see per-source verbatim blocks below
- Archive: each source moved via `git mv` to `tasks/archive/` with `**Superseded-By:** 05-v2-overhaul-bundle` header + superseded footer
- Rollback: `git mv tasks/archive/<id>-*.md tasks/backlog/` + delete META file

**Guardrails Applied:**
- Cap 6 per bundle — this bundle has 3 (✅ within cap)
- Verbatim preservation — every source Goal/AC/TODO/Risk copied verbatim below (SHA comparison available in bundler dry-run)
- Diff-size check — combined 4101 LOC (⚠️ exceeds 400 — consider split)

## Source Bundles (Verbatim Preservation)

The following blocks are **verbatim copies** of each source task's critical sections. They are the source of truth; the checklist that follows is derived from them. Do not edit them manually — they were extracted by the bundler to guarantee zero omission.

### Source Task 02: V2 correctness alignment for smart-compact

**Original File:** `/home/mohammad/Develop/Projects/opencode-smart-compact/tasks/qa/02-v2-correctness-alignment.md` → `tasks/archive/02-v2-correctness-alignment.md` (after bundling)

**Title:** V2 correctness alignment for smart-compact

#### Goal (verbatim)

Make smart-compact correct against the OpenCode V2 native message API and the two reference plugins: preserve tool structure when summarizing, group summaries by turn, make omission IDs monotonic, scope omission retrieval to the calling session, apply per-tool pruning rules, strip reasoning from summarized turns, and move LLM summarization out of the `context` hook.

#### Manager's Notes (verbatim)

Grounded in an audit of `aerovato/magic-compact` and `Tarquinen/opencode-dynamic-context-pruning` plus the installed `@opencode/plugin` 2.0.22 types. Findings F1-F6 in the session log: `applySummaries` destroys tool parts; summarization groups by message not turn; omission IDs are non-monotonic; `read_omitted_content` scans all sessions; no `question`/`task` protection; LLM calls happen inside the context hook.

#### Acceptance Criteria (verbatim)

- [x] Summarized assistant messages keep their tool-call and tool-result parts
- [x] Summary generation happens in the command handler, not the context hook
- [x] New omission IDs never reuse an existing id across restarts
- [x] `read_omitted_content` cannot return another session's content
- [x] `question` output is never pruned; `task` uses the higher threshold
- [x] `npm run typecheck` exits 0 and unit tests pass

#### Local TODOs (verbatim)

- [ ] Rewrite `apply.ts` to preserve `tool-call`/`tool-result`/`compaction` parts and replace only `text`/`reasoning` with the summary
- [ ] Add `plan.ts` to group history entries into turns by user boundary
- [ ] Rewrite `summarize.ts` to summarize at command time and parse id-tagged summaries with a heuristic fallback
- [ ] Add monotonic `nextOmissionId` to state and use it for new IDs
- [ ] Scope `read_omitted_content` lookup to the tool `sessionID` via `ToolContext`
- [ ] Add per-tool rules: protect `question`, higher threshold for `task`, discard `todowrite`/`skill`
- [ ] Strip `reasoning` parts from summarized turns
- [ ] Typecheck and add unit tests for prune/apply/plan

#### Risk & Rollback (verbatim)

- **Risk:** Structure-preserving rewrite changes compaction behavior and could leave an inconsistent transcript
- **Rollback plan:** Revert `src/` to the last commit (`8b7c700d`) via the recorded diff; state schema changes are additive and backward compatible

---

### Source Task 03: Strategies, config, and visible stats

**Original File:** `/home/mohammad/Develop/Projects/opencode-smart-compact/tasks/qa/03-strategies-config-stats.md` → `tasks/archive/03-strategies-config-stats.md` (after bundling)

**Title:** Strategies, config, and visible stats

#### Goal (verbatim)

Port the highest-value features the reference plugins have that smart-compact lacks: automatic deduplication of repeated tool calls, errored-tool-input purging after N turns, a project/global config file, and stats surfaced to the user as a visible synthetic message.

#### Manager's Notes (verbatim)

From the DCP audit: deduplication keeps the newest of duplicate tool calls (`lib/strategies/deduplication.ts`), purge-errors prunes errored tool inputs after `turns` (`lib/strategies/purge-errors.ts`), config layers project over global (`lib/config.ts`), and stats/context are shown in-conversation. smart-compact currently console.logs stats, which the user never sees.

#### Acceptance Criteria (verbatim)

- [x] Config file overrides built-in defaults and invalid files fall back to defaults
- [x] Duplicate tool results are pruned to the latest occurrence
- [x] Errored tool inputs older than the configured turn threshold are pruned
- [x] `/magic-stats` produces a user-visible message, not only a server log
- [x] `npm run typecheck` exits 0 and unit tests pass

#### Local TODOs (verbatim)

- [ ] Add `config.ts` loading `.opencode/smart-compact.jsonc` then `~/.config/opencode/smart-compact.jsonc`
- [ ] Add deduplication strategy (same tool + normalized args, keep latest)
- [ ] Add purge-errors strategy (errored tool inputs after N turns)
- [ ] Extend `/magic-stats` to inject a visible synthetic message with tokens and estimated cost
- [ ] Thread config through prune/summarize/apply

#### Risk & Rollback (verbatim)

- **Risk:** Aggressive automatic pruning surprises users
- **Rollback plan:** All strategies are config-gated with safe defaults and can be disabled in config; revert the diff if needed

---

### Source Task 04: Documentation and npm publish readiness

**Original File:** `/home/mohammad/Develop/Projects/opencode-smart-compact/tasks/qa/04-docs-and-publish.md` → `tasks/archive/04-docs-and-publish.md` (after bundling)

**Title:** Documentation and npm publish readiness

#### Goal (verbatim)

Make smart-compact easy for others to install and use: rewrite the README for OpenCode V2, add a LICENSE, complete `package.json` for npm publishing (exports, files, peerDependencies, repository, engines), add a publish verification gate, and validate the npm payload.

#### Manager's Notes (verbatim)

Reference magic-compact installs with `opencode plugin magic-compact --global` and ships raw TypeScript via a `module`/`main`/`exports` map; DCP ships built `dist/` plus a `verify:package` gate and `prepublishOnly`. The Manager asked to update the README and docs so others can use the project, and to publish to npm if possible.

#### Acceptance Criteria (verbatim)

- [x] README documents V2 install and every command and config option
- [x] `package.json` has a valid exports map and non-empty publish payload
- [x] `npm pack --dry-run` includes `src`, `README.md`, `LICENSE` and excludes tests/node_modules
- [x] `npm run typecheck` exits 0

#### Local TODOs (verbatim)

- [ ] Rewrite `README.md`: install, commands, config, pruning rules, comparison, development
- [ ] Complete `package.json` (exports, files, peerDependencies, repository, homepage, bugs, engines, scripts)
- [ ] Add `LICENSE` (MIT)
- [ ] Add `scripts/verify-package.mjs` and wire `prepublishOnly`
- [ ] Validate with `npm pack --dry-run`

#### Risk & Rollback (verbatim)

- **Risk:** A wrong `files`/`exports` shape ships a broken package
- **Rollback plan:** The `verify-package.mjs` gate blocks a bad publish; revert the diff if the payload is wrong

---


## Bundled Checklist (All-or-Nothing)

> **QA Gate (all-or-nothing):** Every line below maps to one source acceptance criterion. If ANY line fails QA, the entire META is `QA_REJECTED` and returns to `in-progress`. Do not partially close.

- [ ] [02] Summarized assistant messages keep their tool-call and tool-result parts
- [ ] [02] Summary generation happens in the command handler, not the context hook
- [ ] [02] New omission IDs never reuse an existing id across restarts
- [ ] [02] `read_omitted_content` cannot return another session's content
- [ ] [02] `question` output is never pruned; `task` uses the higher threshold
- [ ] [02] `npm run typecheck` exits 0 and unit tests pass
- [ ] [03] Config file overrides built-in defaults and invalid files fall back to defaults
- [ ] [03] Duplicate tool results are pruned to the latest occurrence
- [ ] [03] Errored tool inputs older than the configured turn threshold are pruned
- [ ] [03] `/magic-stats` produces a user-visible message, not only a server log
- [ ] [03] `npm run typecheck` exits 0 and unit tests pass
- [ ] [04] README documents V2 install and every command and config option
- [ ] [04] `package.json` has a valid exports map and non-empty publish payload
- [ ] [04] `npm pack --dry-run` includes `src`, `README.md`, `LICENSE` and excludes tests/node_modules
- [ ] [04] `npm run typecheck` exits 0
- [ ] Traceability: All 3 source tasks are archived with superseded-by marker and reachable via `git log --follow`

## Local TODOs

- [ ] Step 1: Validate META bundle — confirm all 3 source requirements are captured verbatim below
- [ ] Step 2: Implement unified changes covering all bundled tasks (single diff, single branch)
- [ ] [02] Rewrite `apply.ts` to preserve `tool-call`/`tool-result`/`compaction` parts and replace only `text`/`reasoning` with the summary
- [ ] [02] Add `plan.ts` to group history entries into turns by user boundary
- [ ] [02] Rewrite `summarize.ts` to summarize at command time and parse id-tagged summaries with a heuristic fallback
- [ ] [02] Add monotonic `nextOmissionId` to state and use it for new IDs
- [ ] [02] Scope `read_omitted_content` lookup to the tool `sessionID` via `ToolContext`
- [ ] [02] Add per-tool rules: protect `question`, higher threshold for `task`, discard `todowrite`/`skill`
- [ ] [02] Strip `reasoning` parts from summarized turns
- [ ] [02] Typecheck and add unit tests for prune/apply/plan
- [ ] [03] Add `config.ts` loading `.opencode/smart-compact.jsonc` then `~/.config/opencode/smart-compact.jsonc`
- [ ] [03] Add deduplication strategy (same tool + normalized args, keep latest)
- [ ] [03] Add purge-errors strategy (errored tool inputs after N turns)
- [ ] [03] Extend `/magic-stats` to inject a visible synthetic message with tokens and estimated cost
- [ ] [03] Thread config through prune/summarize/apply
- [ ] [04] Rewrite `README.md`: install, commands, config, pruning rules, comparison, development
- [ ] [04] Complete `package.json` (exports, files, peerDependencies, repository, homepage, bugs, engines, scripts)
- [ ] [04] Add `LICENSE` (MIT)
- [ ] [04] Add `scripts/verify-package.mjs` and wire `prepublishOnly`
- [ ] [04] Validate with `npm pack --dry-run`
- [ ] Step 21: Verify all bundled checklist items and run lint_task_file + verification-before-completion
- [ ] Step 22: Update CHANGELOG.md and record Verification Evidence

## Acceptance Criteria

- [ ] [02] Summarized assistant messages keep their tool-call and tool-result parts
- [ ] [02] Summary generation happens in the command handler, not the context hook
- [ ] [02] New omission IDs never reuse an existing id across restarts
- [ ] [02] `read_omitted_content` cannot return another session's content
- [ ] [02] `question` output is never pruned; `task` uses the higher threshold
- [ ] [02] `npm run typecheck` exits 0 and unit tests pass
- [ ] [03] Config file overrides built-in defaults and invalid files fall back to defaults
- [ ] [03] Duplicate tool results are pruned to the latest occurrence
- [ ] [03] Errored tool inputs older than the configured turn threshold are pruned
- [ ] [03] `/magic-stats` produces a user-visible message, not only a server log
- [ ] [03] `npm run typecheck` exits 0 and unit tests pass
- [ ] [04] README documents V2 install and every command and config option
- [ ] [04] `package.json` has a valid exports map and non-empty publish payload
- [ ] [04] `npm pack --dry-run` includes `src`, `README.md`, `LICENSE` and excludes tests/node_modules
- [ ] [04] `npm run typecheck` exits 0
- [ ] Traceability: All 3 source tasks are archived with superseded-by marker and reachable via `git log --follow`

## Verification Evidence

- **Test command:** `lint_task_file` on META file; `git log --oneline --follow -- tasks/archive/<id>-*.md | head` for archived sources; project test suite if logic changed
- **Expected result:** META lint passes; all 3 sources in `tasks/archive/` with `superseded` status; single Factual Git Diff covers all bundled changes
- **Actual result:** _(Hands fill during execution)_
- **Exit code:** _(Hands fill)_

## Definition of Done

The task is NOT done unless ALL of the following are true (unconditional, applies to every source type):

- [ ] Build/Test/Lint pass with exit code 0
- [ ] `lint_task_file` passes on the active task file
- [ ] `CHANGELOG.md` updated via Parse-Then-Append
- [ ] `verification-before-completion` applied and evidence recorded

## Risk & Rollback

- **Risk:** Checklist omission — mitigated by verbatim copy + SHA-length comparison of source AC vs bundled checklist; script fails if mismatch >0.
- **Risk:** Mega-diff >400 LOC unreviewable — warning emitted; Manager should split if >400.
- **Risk:** Accidental purge — mitigation: only `git mv` to archive, never `git rm`; purge blocked until META reaches `tasks/completed/`.
- **Rollback plan:** `git mv tasks/archive/<id>-*.md tasks/backlog/<id>-*.md` for each superseded [02, 03, 04], remove Superseded-By footer, delete or archive `tasks/backlog/05-v2-overhaul-bundle.md` as abandoned. No HQ code beyond bundler is affected.

---

## Execution Log & Reasoning

Autopilot locked (Manager). Bundled tasks 02-04 into this META via `bundle_tasks`; the three sources are archived under `tasks/archive/` with `superseded` status. Full diff injected below.

Brain Bridge verdicts (same task_id 05):
- QA Engineer: `QA_PASSED` (cited apply.ts:29, index.ts:132, prune.ts:53, store.ts:14, prune.ts:18, strategies.ts:42/92, index.ts:37).
- Code Reviewer: `APPROVED`, `PO_REVIEW_PENDING`; four non-blocking issues raised (I1-I4). I1 (duplicate `### Changed` in CHANGELOG), I2 (redundant `LARGE_ONLY` set), I3 (absorbed-summary recount), I4 (stale comment) were fixed in this bundle before hand-off. No blocker remains.

GitHub: public repo `mokhtarabadi/opencode-smart-compact` created with description and topics; `origin` remote set. `git push` remains ZAC-forbidden and Manager-owned.

Verification: 14/14 tests, `verify:package` OK, typecheck exit 0.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `a8ba1daf8a261bcc2976a0c5b981e8bd273c591b`
<!-- END_GIT_DIFF -->
