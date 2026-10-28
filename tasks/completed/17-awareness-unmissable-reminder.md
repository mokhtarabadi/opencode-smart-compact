# Task 17: unmissable context-pressure reminder (awareness V2)

**File:** `tasks/completed/17-awareness-unmissable-reminder.md`
**Source:** manager (2026-10-28, after an agent ran 100+ turns without compacting despite the advisory reminder)
**Type:** feature
**Status:** closed
**Finished:** 2026-10-28T10:13:03Z
**Submitted:** 2026-10-28T09:18:42Z

## Goal

Make the smart-compact pressure reminder impossible to silently ignore: reword it as a direct action demand, retune the default thresholds so it fires before the context is effectively gone, and escalate at emergency level so a heads-down agent is forced to act.

## Context

- The mechanism works (hook fires, pruning notices prove it), but the reminder is advisory prose appended as a system part — easy to skim past mid-implementation.
- Local defaults are lenient (warn 0.5 / emergency 0.8 on a lower-bound measurement that excludes provider prompts and tool schemas), so the real fill is much higher than the number shown when it finally fires.
- Agent-side contracts already say "trigger it yourself", but nothing enforces them.

## Scope

1. Rewrite `buildAwarenessMessage` (src/awareness.ts): short, imperative, with the exact tool call first, the current fill vs hard limit, and what is lost if ignored (overflow = dropped work). Keep it advisory-only per the module contract (never abort a step), but make skipping it feel like a deliberate violation, not an oversight.
2. Retune defaults in src/config.ts (and document in README): lower warn/emergency ratios and/or measure against an effective budget (limit minus provider overhead margin) instead of the raw window.
3. Emergency escalation: at emergency level, repeat the reminder every N requests until the latch clears (respect the existing rearm/hysteresis design — extend it, don't bypass it).
4. Tests for the new wording/thresholds/latch behavior (repo has tests/*.test.ts; run `npm run typecheck` + the test suite).
5. Update README + CHANGELOG.

## Acceptance Criteria

- [x] A fresh session crossing warn gets a reminder that names the exact action first.
- [x] Emergency re-fires until pressure drops (no silent single-shot).
- [x] Thresholds documented; typecheck + tests green.

## Micro-Task Checklist (Brain implementation XML, executed in order)

- [x] **Step 1:** `src/config.ts` DEFAULT_CONFIG awareness retuned to warnRatio 0.5 / emergencyRatio 0.8 (rearmStep 0.05, autoTrimRatio 0 untouched; validation untouched).
- [x] **Step 2:** `src/awareness.ts` `buildAwarenessMessage` rewritten as imperative demand (signatures stable, advisory-only preserved).
- [x] **Step 3:** `src/index.ts` `runAwareness` re-fires every request at emergency; warn single-shot gate + hysteresis clear kept.
- [x] **Step 4:** `tests/awareness.test.ts` + `tests/awareness-hook.test.ts` updated (new copy/thresholds, emergency re-fire persistence, latch clear); `tests/config-validation.test.ts` defaults updated.
- [x] **Step 5:** `README.md` behavior section + `CHANGELOG.md` entry (Parse-Then-Append under existing Unreleased `### Changed`).

## Verification Evidence

- Stack detection: `package.json` plain TS plugin, no `next.config`, no `src/ports/` → nextjs / node-hexagonal-api skills skipped (root `/home/mohammad/Develop/Projects/opencode-smart-compact`, markers scanned: package.json, tsconfig.json; matched: none; reason: no framework markers present).
- `rtk` wrapper: not installed in this environment (`rtk: command not found` equivalent — no wrapper available), so verification ran raw per the XML's fallback rule; no output was collapsed on failure (the one failure was kept in full, fixed, re-run green).
- `npm run typecheck` (`tsc --noEmit`): exit 0, no errors.
- `npm test` (`tsc -p tsconfig.test.json && node --test .test-build/tests/*.test.js`): 99 pass / 0 fail. One first-run failure fixed legitimately: `autoTrimRatio queues a lossless trim below the advisory threshold` used 20000 chars (50%) as its "below warn" trim probe, which now correctly fires the warn advisory; probe moved to 16000 chars (40%, above autoTrimRatio 0.4, below warnRatio 0.5) and the suite went green.
- `grep -n warnRatio src/config.ts` → `0.5` (default + merge/validate paths); `grep -n emergencyRatio src/config.ts` → `0.8`.
- `grep -n -i awareness README.md CHANGELOG.md` → README config block (0.5/0.8) + rewritten behavior paragraph; CHANGELOG Unreleased `### Changed` entry.
- Gatekeeper: instructions cross-checked against AGENTS.md + `docs/conventions.md` — no transcript mutation, user messages stay verbatim, no new persistence, no git add/commit; compliant, no HALT.
- Skills loaded: code-search, testing-strategy, verification-before-completion, project-memory, task-generator.


## Local TODOs

- [x] Rewrite `buildAwarenessMessage` as imperative demand (tool call first)
- [x] Retune defaults to warn 0.5 / emergency 0.8
- [x] Emergency re-fire until pressure drops (hysteresis intact)
- [x] Re-base tests + README + CHANGELOG
- [x] Typecheck + full test suite green

## Execution Log & Reasoning

### 2026-10-28 — Lane move + Brain planning turn (plan stage)

- Moved file `tasks/backlog/` → `tasks/in-progress/` (plain `mv`, untracked file) and updated `**File:**` header.
- Read `AGENTS.md` (mandatory first), `src/awareness.ts` (218 lines), `src/config.ts` (awareness section + `DEFAULT_CONFIG`), `src/index.ts` (`runAwareness`, lines 142–239), `tests/awareness.test.ts`, `tests/awareness-hook.test.ts`, `package.json` (typecheck + `node --test` suite).
- **Factual discrepancy found:** task Context claims "lenient (warn 0.5 / emergency 0.8)" defaults, but `src/config.ts:95` ships `warnRatio: 0.7, emergencyRatio: 0.9, rearmStep: 0.05`. The 0.5/0.8 pair does not exist in code. Flagged to Manager — threshold retune must be measured against 0.7/0.9, not 0.5/0.8.
- Brain planning turn sent (`session_id: awareness-unmissable-reminder`, `stage: plan`, `project_root` bound; no numeric task ID exists so `task_id` omitted). Result: `REPORT` status, no XML blocks — **draft plan only, not approved for implementation**.
- **Brain verdict:** draft ready but not final (could not attach task file without numeric ID; grounding from stale tree report). Seat Check: Architect owns plan; Programmer/QA input on latch+tests; Designer input on imperative copy; brainstorming not required; **Lite Mode NOT eligible** (5+ files, behavior change, latch semantics).
- **Brain draft plan (conditional):** D1 imperative `buildAwarenessMessage` copy (signature stable); D2 retune O1 (warn 0.6 / emergency 0.85, recommended) vs O2 (0.5/0.8); D3 emergency latch + re-fire every `runAwareness` while ≥ emergency, clear on ack/drop-below-warn-with-hysteresis. Steps A1–A6 (awareness.ts, config.ts, index.ts, 2 test files, README+CHANGELOG).
- **Brain open questions for Manager:** Q1 O1 vs O2 thresholds? Q2 what clears the emergency latch (manual ack, successful compact, or pressure drop)?

### 2026-10-28 — Implementation (Brain XML, O2 + automatic latch clear)

- Manager approved O2 (warn 0.5 / emergency 0.8); latch question deferred to Hands — decided: clear automatically on pressure drop below warn with existing hysteresis (`ratio < warnRatio - rearmStep`), no extra UI, matches current design.
- Brain implement turn first refused (context_paths attachments unresolved server-side); re-sent with verified source inlined, received `XML_EXTRACTED` implementation task, executed ONLY from that.
- `src/config.ts`: default `warnRatio 0.7→0.5`, `emergencyRatio 0.9→0.8`; `mergeAwareness`/`validateAwareness` untouched.
- `src/awareness.ts`: `buildAwarenessMessage` rewritten — first line is the command (`ACT NOW`/`COMPACT NOW` + `compact_context`), then fill vs limit, lower-bound honesty, loss-if-ignored (`dropped`), re-orient step, MUST-compact rule, advisory-only + never-abort guardrails. `getAwarenessLevel`/`shouldFireAwareness` byte-identical.
- `src/index.ts`: emergency bypasses the `shouldFireAwareness` single-shot gate (args preserved verbatim); warn path, hysteresis clear line, autoTrim block, catch-swallow unchanged.
- Tests: `awareness.test.ts` boundaries re-based to 0.5/0.8 + first-line/copy assertions; `awareness-hook.test.ts` char math re-based (warn 20000, rearm +2000, hover 19600, clear 18000/45%), emergency re-fire test added (3 pushes at same fill + drop-and-rewarn with ACT NOW), downgrade target moved to 20000; `config-validation.test.ts` defaults 0.5/0.8, override probe moved to 0.6 to stay distinct from default; `awareness-hook` trim probe moved 20000→16000 chars.
- README + CHANGELOG updated per XML (config block, behavior paragraph, Unreleased `### Changed` append — no duplicate header).

## Risk & Rollback

- Risk: more frequent reminders annoy focused work — mitigated: warn fires once per fill band (rearmStep gate), only emergency repeats.
- Rollback: revert the five source files + tests; defaults restore to 0.7/0.9.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
**Factual Git Diff:** Stored in Commit Hash: `cc78cc05d43239dce75a6520b5332419550dcc87`
<!-- END_GIT_DIFF -->

## Closure

- 2026-10-28: Manager approved closure ("Approve for cloaure" — accepted as the explicit closure word with typos). File moved to `tasks/completed/`, status closed. Commit via `custom_context_commit_and_clean_task` only (ZAC).
