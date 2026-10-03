# Task 10: Apply portable ACP lessons to smart-compact

**File:** `tasks/completed/10-acp-lessons-application.md`
**Source:** manager
**Type:** improvement
**Status:** closed

> **Mode:** autopilot locked (Manager confirmed autopilot on this task).

## Goal

Adopt the portable, guardrail-compatible lessons from the ACP study repo into smart-compact without changing its explicit command-driven design.

## Manager's Notes

Study repo cloned to `/tmp/opencode/opencode-acp` (v1.18.3, AGPL, V1 plugin API `@opencode-ai/plugin`, model-driven nudge + `compress` tool). Our plugin is V2-native (`session.hook("context")`), explicit (`/magic-compact`, `/magic-trim`, `compact_context`), zero ongoing prompt overhead. V1 hooks and the nudge loop are explicitly out of scope.

Portable wins identified by three parallel discovery scans:
- Real token counting (`@anthropic-ai/tokenizer` with `chars/4` fallback) instead of chars/words heuristics.
- Truncate-tools overhead bounds plus preserve-recent window (recent messages and tokens, last user message never pruned).
- Reasoning-strip extension to existing purge-errors (drop reasoning parts over threshold, keep error text).
- Fail-closed omitted-content restore (clear abort message when cache cleared by newer compaction).
- Protected-tools review (consider write, edit, plan tools alongside existing question protection).
- Config validation with visible warning on invalid keys.
- Memoized prune pass with gating for transform speed.
- Emergency budget guard and existing stats extension.
- Unit tests following `node:test` plus `tsx` pattern for each new rule.

Explicitly rejected: model-driven automatic summarization, per-request nudge injection, V1 `experimental.chat.messages.transform` port. Those conflict with the explicit zero-overhead comparison in README.

Successor note: ACP README points V2 users to billion-context (`bili` launcher or native plugin). A future study can compare that repo separately.

## Local TODOs

- [x] Step 1: Create `src/tokens.ts` token measurement with fallback
- [x] Step 2: Extend `src/config.ts` (tokens, preserve-recent, truncate, strip-reasoning, validation, budget guard)
- [x] Step 3: Preserve-recent window plus truncate-tools bounds in `src/prune.ts` and `src/plan.ts`
- [x] Step 4: Reasoning-strip in `src/strategies.ts` plus fail-closed miss path in `src/prune.ts`
- [x] Step 5: Memo gate plus stats extension in `src/prune.ts`, `src/types.ts`, `src/store.ts`, `src/index.ts`
- [x] Step 6: Unit tests per new rule (failing-first) plus existing suite green
- [x] Step 7: Update `README.md` and `CHANGELOG.md` via Parse-Then-Append

## Acceptance Criteria

- [x] Prune decisions use measured tokens with fallback when tokenizer is unavailable
- [x] Recent messages and the last user message survive any compaction pass
- [x] Invalid config keys produce a visible warning instead of silent ignore
- [x] `npm run typecheck` exits 0 and unit tests pass

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and full unit suite pass
- **Actual result:** `rtk test npm test` exit 0; 44/44 tests pass (19 new: 3 tokens, 5 config-validation, 5 prune-bounds, 2 strategies strip-reasoning, 4 prune memo/fail-closed/protected/stats); `tsc --noEmit` exit 0. Stack blueprint scan: no stack marker in src (plain TypeScript OpenCode plugin, no framework blueprint) — no stack gate, skipped with reason.
- **Exit code:** 0
- **Re-QA fix round:** QA rejected the first staging with 5 findings; all fixed in order (budget guard wired into both entry paths with stateless abort; preserve window fed to `selectTurns` via `compactNow`; ESM-safe tokenizer loading via `createRequire` plus test seam; per-tool truncate cap with task bar preserved; full-text memo hash; token-aware small-input check). Strengthened tests confirmed red without their fix via temporary revert checks (truncate cap off → truncate test red; token branch off → token test red), then restored to green. `rtk test npm test` exit 0 re-verified after the fix round.

> Verification runner rule: `npm test` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

The task is NOT done unless ALL of the following are true (unconditional, applies to every source type):

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** Tokenizer dependency adds weight and native behavior differences across models
- **Rollback plan:** Keep heuristic path as default fallback; revert prune and config modules to prior version if needed

---

## Execution Log & Reasoning

Autopilot locked (Manager confirmed autopilot on this task).
Seat Check: backend plugin domains → Software Architect requested; Designer/Programmer-as-planner/Planner/Strategist/QA/Reviewer skipped (no UX surface; implementation follows approved plan; planning gate). Trigger evaluation on TITLE+BODY: explicit miss on all three lists (no UX words, no schema/contract/migration/quota/index/API-design word, no flaky/race/deadlock/silent-fail/performance word) — single-seat plan valid.
Brainstorm: not required — single-domain backend improvement, fully reversible via fallback/revert, no cross-disciplinary ambiguity.
Planning gate: no approved plan on file (no blueprint, no prior verdict, no quoted Manager plan) → ran brain_turn planning round under task_id 10. Turn 1 returned discovery request (A1-A3); executed via 4 parallel cognitive-discovery subagents (tree/configs, prune/store/types, apply/summarize/actions/plan/strategies, tests/docs); fed back as [fed-context]. Turn 2 returned Architect plan verdict: 7-step plan (token counter module, preserve-recent + output caps, reasoning-strip + fail-closed restore, protected-lists review, validation warnings + budget guard, memo gate + stats, tests + docs), non-goals O1-O3 (no auto-summarization, no nudge, no V1 transform). Selected path: execute Architect 7-step plan exactly, implementation via Senior Programmer XML after plan approval.
Goal tools (get_goal/create_goal) unavailable in this runtime — tracking continues in this task file.
Assumption A1: Autopilot target is this task (confirmed by Manager).
Plan approval (try 1): Manager answered "Approved" to the relayed Architect 7-step plan — routing back through Brain for Senior Programmer implementation XML.
Implementation: all 7 micro-steps executed in order with failing-first tests (red verified before each green). New files: src/tokens.ts, tests/tokens.test.ts, tests/config-validation.test.ts, tests/prune-bounds.test.ts. Extended: config (tokens/preserve/truncate/stripReasoning/validateConfig/checkBudgetGuard + warn wiring), prune (measureTokens/preserveWindow/truncate/memo/fail-closed), plan (preserve param), strategies (stripReasoning), types/store (stats + pruneMemo), index (runPrune timing/flag, stats text, miss message), README + CHANGELOG.
Incident: a `git stash` probe swallowed tracked edits into the stash and the quiet pop failed; recovered via explicit `git stash pop` and re-verified 44/44 green. No stash use afterwards. Pre-existing worktree modifications (.gitignore and others predating this task) left untouched; staging uses explicit modified_files only.
Staging note: XML named qa_transition, but the task file is untracked and qa_transition moves via git plumbing that hits the git-add denial; using the AGENTS-sanctioned path instead (filesystem mv for the task file per Kanban exception + stage_and_inject_diff with the new path) for the identical end state.
QA round 1 verdict: REJECTED with 5 fix points (executable XML received, fixes applied in order, evidence above). Worktree diff hash after fix round: 619481c42854f859cc8cd9880fe7ad63926ea025 (first attempt at this hash — no loop).
Re-QA verdict: QA_PASSED (no blocking defects; cites actions:46, index:54, tokens:30, prune:95/115, config:210, tests).
Review verdict: APPROVED with PO_REVIEW_PENDING (one low nit N1: double space in tests/prune.test.ts:82, left for a future tidy pass per reviewer R1 — not opening a fix round for style alone). Awaiting explicit closure word.
Closure: Manager accept quote "if all safe, then approve for closure" received (matches approved-for-closure); V2 safety audit clean. Lanes moved qa to completed, status closed.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `5b393085ba08bd11b90b2728791a8f369acaab05`
<!-- END_GIT_DIFF -->
