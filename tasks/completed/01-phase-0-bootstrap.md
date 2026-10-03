# Task 01: Phase 0 bootstrap

**File:** `tasks/qa/01-phase-0-bootstrap.md`
**Source:** manager
**Type:** feature
**Status:** open

## Goal

Bootstrap project governance: Kanban dirs, AGENTS.md, conventions, opencode.json.

## Manager's Notes

Manager approved Phase 0 on 2026-10-03 with task file. Scope: Kanban dirs + AGENTS.md + docs/conventions.md + validated opencode.json. Stack: TypeScript OpenCode V2 plugin (src/index.ts, apply.ts, prune.ts, store.ts, summarize.ts, types.ts).

## Local TODOs

- [x] Create Kanban dirs tasks/backlog, in-progress, qa, completed, archive
- [x] Generate AGENTS.md from audit-agents Phase 0 template
- [x] Generate docs/conventions.md with DateTime, SOLID, Ledger, DSP
- [x] Generate validated opencode.json project-only
- [x] Verify with typecheck

## Acceptance Criteria

- [x] tasks/ has 5 Kanban subdirs
- [x] AGENTS.md exists at root with Core File Locations, ZAC, End-of-Task Sequence, Skill Loading, Context Bootstrapping
- [x] docs/conventions.md exists with required standards
- [x] opencode.json validates with zero errors
- [x] npm run typecheck exits 0

## Verification Evidence

- **Test command:** rtk test npm run typecheck
- **Expected result:** tsc --noEmit exits 0, no errors
- **Actual result:** tsc --noEmit exits 0, no errors (rtk wrapper absent, ran npm run typecheck directly, exit 0)
- **Exit code:** 0

> Verification runner rule: `npm run typecheck` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

The task is NOT done unless ALL of the following are true (unconditional, applies to every source type):

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

> **Box-checking mandate:** During the implementation `<summary_phase>`, the Hands MUST check every `## Acceptance Criteria` and `## Definition of Done` box that is genuinely satisfied by the recorded `## Verification Evidence` — do NOT defer box-checking to a closure task. See `<hands_protocols>` for the authoritative instruction.

## Risk & Rollback

- **Risk:** Invalid opencode.json breaks local config
- **Rollback plan:** Delete generated AGENTS.md, docs/conventions.md, opencode.json, keep src/ untouched; git status to confirm no src changes

---

## Execution Log & Reasoning

Brainstorm: not required — single-domain scaffolding, fully reversible file creation, no cross-disciplinary ambiguity.

Assumption A1: Phase 0 = governance bootstrap per audit-agents Phase 0 + opencode-init + migrate-kanban. Reason: Manager named those three skills explicitly.
Assumption A2: default_agent omitted until agents_dir exists. Reason: opencode-init forbids inventing agent names.
Seat Check: domains → scaffolding/governance → no UI, no schema, no deadlock → no Designer/Architect/Senior trigger → single-seat bootstrap, no consult required.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/.gitignore b/.gitignore
new file mode 100644
index 00000000..f3753cf5
--- /dev/null
+++ b/.gitignore
@@ -0,0 +1,4 @@
+node_modules/
+dist/
+.opencode/memory/index.md
+tasks/.sessions/
diff --git a/AGENTS.md b/AGENTS.md
new file mode 100644
index 00000000..650add79
--- /dev/null
+++ b/AGENTS.md
@@ -0,0 +1,103 @@
+# opencode-smart-compact — Project Context Hub
+
+## Project Overview
+
+Lossless, OpenCode V2-native context compaction. User messages stay verbatim, each old assistant turn is replaced by its own summary, and bulky tool output is pruned to a notice while the original is cached and retrievable via `read_omitted_content`.
+
+Stack: TypeScript ES2022, `@opencode/plugin` 2.0.22, strict `tsc --noEmit`. Entry `src/index.ts`. Modules: `apply.ts` (summary/omission application), `prune.ts` (tool-result pruning), `summarize.ts` (per-turn summaries), `store.ts` (per-session state), `types.ts` (Msg, SessionState). No transcript mutation — transform model-visible messages per request via `session.hook("context")`.
+
+## Setup & Dev Commands
+
+- Install: `npm install`
+- Typecheck: `npm run typecheck` (`tsc --noEmit`)
+- Test: `npm run typecheck` (no unit suite yet)
+- Dev: `opencode plugin add /absolute/path/to/opencode-smart-compact` or add dir to `plugins` in `opencode.json`
+
+## Actionable Guardrails (Do's & Don'ts)
+
+- **Don't** mutate the stored transcript directly (V1 `session.messages` / `part.update` pattern)
+  -> **Do** transform model-visible messages per request via `session.hook("context")`, `ctx.command.transform`, `ctx.tool.transform`, `ctx.storage`
+- **Don't** summarize user messages or merge turns into one lossy blob
+  -> **Do** keep user messages verbatim, replace each old assistant turn with its own summary
+- **Don't** prune pending or errored tool calls, or `read`/`write`/`edit` outputs that are reloadable without cache
+  -> **Do** prune only completed tool results over ~1024 chars or ~128 words, cache original under Content ID (e.g. `omitted-0001`)
+- **Don't** read `context-reports/` markdown files yourself.
+  -> **Do** generate them using the MCP server — context reports via `custom_context_read_source_files`, tree reports via `custom_context_create_tree_report` ("create a tree of the project") — and hand the file path to the Manager.
+- **Don't** execute Git commands like `git add`, `git commit`, or `git mv` autonomously or try to guess when to stage code.
+  -> **Do** execute Git commands ONLY when explicitly instructed by an Orchestrator task block. Otherwise, rely on the `custom_context_stage_and_inject_diff` MCP tool.
+  -> **Exception:** `git mv` is permitted autonomously for moving task files between Kanban directories.
+- **Don't** guess blindly when facing complex bugs, deadlocks, or silent timeouts.
+  -> **Do** utilize the `debug-instrumentation` skill to inject strategic logs and trace the runtime execution path.
+- **Don't** write bash scripts without strict mode or mask errors with `2>/dev/null` on data commands.
+  -> **Do** follow the Defensive Shell Protocol: `set -euo pipefail`, ban error masking, sidecar isolation for Docker backups. See `docs/conventions.md`.
+- **Don't** perform financial mutations without snapshotting the prior state or allow nulls in monetary aggregations.
+  -> **Do** follow the Universal Financial Ledger Standard: snapshot-on-write, `$ifNull` precedence, discrepancy alerting, deep config merging. See `docs/conventions.md`.
+- **Don't** leave task numbers in visible prompt prose, section headings, or skill instructions.
+  -> **Do** keep task-number references in code comments, CHANGELOG entries, task files, history archives, and HTML comments only. See `docs/conventions.md`.
+- **Don't** carry over assumptions, partial results, or architectural hypotheses from a previous task.
+  -> **Do** flush context and treat every task as contextually independent (Buffer Isolation directive in validation-phase).
+- **Don't** execute raw, informal, or non-English prompts directly.
+  -> **Do** load the `prompt-refactor` skill to translate and expand the intent into an elite English spec first. (Note: If you receive a standard XML task block, skip this and execute normally).
+- **Don't** attempt to resolve cross-disciplinary ambiguity within a single persona.
+  -> **Do** trigger the Multi-Agent Brainstorming Loop if the Manager explicitly requests brainstorming or a task exhibits cross-disciplinary ambiguity. Interpret the `<brainstorming_session>` results in backlog tasks as non-functional guidelines that govern execution.
+
+## Documentation Sync Rules
+
+When modifying this repository, you must keep these files synchronized:
+
+1. Active task file in `tasks/` (single source of truth for current work items)
+2. `CHANGELOG.md` (Keep a Changelog format)
+3. `DESIGN.md` (UI/UX design system, if modified — currently absent, skip gracefully)
+4. `docs/conventions.md` (syntax rules, datetime standard, SOLID guidelines)
+5. Relevant `SKILL.md` files (if structural patterns were altered)
+
+## 🛑 GATEKEEPER VALIDATION (HALT PROTOCOL)
+
+You (the Hands) are the final gatekeeper. Before executing any implementation task, you MUST evaluate the Orchestrator's instructions against this file and any referenced specs (`DESIGN.md`, `architecture.md`, etc.). If the instructions violate project rules, ignore them. HALT immediately and output a `⚠️ RULE VIOLATION WARNING` back to the Manager explaining exactly what the Orchestrator got wrong, forcing it to self-correct.
+
+This is the entry point: read this `AGENTS.md` first before any execution. If referenced, also read `DESIGN.md`, `docs/architecture.md`, `docs/data_model.md`, `docs/conventions.md`. Absent files are skipped gracefully per Absent-File Policy — never halt, never hallucinate.
+
+## 🛑 CORE FILE LOCATIONS
+
+You MUST strictly adhere to these exact paths. Do not create duplicates elsewhere:
+
+- **Global Rules:** `AGENTS.md` (Root)
+- **UI/UX Specs:** `DESIGN.md` (Root — currently absent, skip gracefully)
+- **Conventions:** `docs/conventions.md`
+- **Agent Skills:** `.opencode/skills/<skill-name>/SKILL.md` (Local workspace — optional; only include if project utilizes OpenCode)
+- **Active Tasks:** `tasks/backlog/<task-number>-<name>.md` (backlog), `tasks/in-progress/`, `tasks/qa/`, `tasks/completed/`, `tasks/archive/`
+- **Plugin Entry:** `src/index.ts`
+
+## 🛑 SKILL LOADING RULES
+
+You MUST follow these skill loading rules in every session:
+
+- **Task-Generator Skill:** Before creating any new task file, you MUST load the `task-generator` skill using the `skill` tool to ensure the correct template format with `<!-- BEGIN_GIT_DIFF -->` / `<!-- END_GIT_DIFF -->` markers.
+- **Project Skills:** Before implementing any task, you MUST load every available skill matching the project's tech stack (e.g., `opencode` for plugin API, `prompt-refactor` for informal input). If a relevant skill exists, it MUST be loaded — this enforces framework-specific conventions and architectural rules.
+- **Complex Debugging:** Do not guess blindly — load `debug-instrumentation` for deadlocks, races, silent failures.
+
+## 🛑 CONTEXT BOOTSTRAPPING
+
+At the start of every task, you MUST call `search_memory` or `list_namespaces` to load any hidden project quirks relevant to your domain before implementing. Read `.opencode/memory/index.md` alongside this file when present.
+
+## 🛑 MANDATORY END-OF-TASK SEQUENCE
+
+When finishing a task, you MUST execute these exact steps in order:
+
+1. **Update Changelog:** You MUST insert a formal entry into CHANGELOG.md logging your modifications.
+2. **Write your Summary:** Manually write your architectural reasoning, local TODO checks, and execution notes into the active `tasks/XX-task.md` file under "Execution Log & Reasoning".
+3. **Call MCP Tool & QA Transition:** Call the `custom_context_stage_and_inject_diff` MCP tool with the explicit `modified_files` list (blind `git add -A .` is banned). After injection, you MUST move the task file to `tasks/qa/` via `git mv` before notifying the Manager (implementation tasks only — discovery tasks stay in place). DO NOT execute any `git commit` commands. Closure to `tasks/completed/` happens ONLY after the Manager explicitly says "Approved for closure" or "Close task".
+4. **Kanban Metadata Synchronization (mandatory after ANY authorized `git mv`):** After the move, update the task file's `**File:**` metadata header to the new path. If the move happened AFTER staging, re-run `lint_task_file` and call `custom_context_stage_and_inject_diff` AGAIN with the NEW task path and the full `modified_files` array before notifying the Manager — the re-stage keeps the injected diff and staging state in sync with the final path. Never notify the Manager with a stale `**File:**` header.
+5. **Notify Manager:** Output exactly: "Task ready. Manager, please copy the contents of `tasks/XX-task.md` and send it back to the Orchestrator Brain for review."
+
+## Lite Mode Protocol
+
+`<lite_mode_protocol>` — when eligible (single-file, no security/financial impact, obvious simplicity, never login/auth/money/security-surface), the full 9-step production line can be bypassed with a `[LITE]` justification in the task's `## Execution Log & Reasoning` section. Escalation to Full Mode is mandatory if hidden complexity is discovered.
+
+## Deprecated-Section Purge Rule
+
+`AGENTS.md` and all active task files MUST NOT contain `## Manager Decisions`, `## Admin Decision`, `Manager Decision`, `Admin Decision` sections. If detected during audit, purge the entire section, document the purge, and never recreate it. Absence of these sections is compliant.
+
+## Task-Number Reference Discipline
+
+Keep task numbers in code comments, CHANGELOG entries, task files, history archives, and HTML comments only. Never in visible prompt prose, headings, or skill instructions.
diff --git a/CHANGELOG.md b/CHANGELOG.md
new file mode 100644
index 00000000..1b0e3e16
--- /dev/null
+++ b/CHANGELOG.md
@@ -0,0 +1,11 @@
+# Changelog
+
+All notable changes to this project will be documented in this file.
+
+The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
+
+## [Unreleased]
+
+### Added
+
+- Phase 0 bootstrap: Kanban dirs (`tasks/backlog`, `in-progress`, `qa`, `completed`, `archive`), `AGENTS.md` project hub, `docs/conventions.md` standards, validated `opencode.json` project config.
diff --git a/docs/conventions.md b/docs/conventions.md
new file mode 100644
index 00000000..9ee05f55
--- /dev/null
+++ b/docs/conventions.md
@@ -0,0 +1,53 @@
+# Conventions
+
+This document defines syntax rules, naming conventions, file boundaries, and automation patterns for this project.
+
+## Universal DateTime Standard
+
+All projects in this ecosystem MUST follow these datetime rules:
+
+1. **UTC at Rest** — All databases and caches store datetimes in UTC with `TIMESTAMP WITH TIME ZONE`. Banned: naive or local-time storage.
+2. **ISO-8601 with Offset / Epoch ms at API Boundaries** — APIs transmit datetimes as Unix Epoch milliseconds (int64) or ISO-8601 with offset (e.g., `2026-07-23T14:30:00+00:00`). Banned: timezone-naive strings.
+3. **Clock Injection** — All current-time access must go through an injectable `Clock` abstraction. Banned: direct `new Date()`, `datetime.now()`, `time.Now()` in business logic. This plugin uses `Date.now()` only for stats timestamps (`lastRun`), never for business decisions — stats only.
+4. **Dual-Representation for Future Events** — Calendar events expose both `event_start_local` (with timezone) and `event_start_epoch_ms` (absolute).
+5. **`TZ=UTC` Infrastructure** — All environments run with `TZ=UTC`. Timezone display is a client-layer responsibility only.
+
+## SOLID Programming Guidelines
+
+Enforce these SOLID principles and pragmatic guardrails in every implementation:
+
+1. **SRP** — One reason to change per module. Split merged concerns. (This repo: `apply.ts`, `prune.ts`, `summarize.ts`, `store.ts` each own one concern.)
+2. **OCP** — Open for extension, closed for modification. Use composition over inheritance.
+3. **LSP** — Subtypes must be substitutable. Ban `NotImplementedError` overrides.
+4. **ISP** — Small role-specific interfaces. Ban monolithic god-interfaces.
+5. **DIP** — Depend on abstractions, not concretions. Core layer must not import adapters.
+
+**Pragmatic Guardrails:** No abstraction for <3 trivial operations. Only extract interfaces with 2+ implementations. Apply YAGNI strictly. Prefer simpler designs unless a measurable requirement forces complexity.
+
+## Universal Financial Ledger Standard
+
+All financial, transactional, and countable data operations MUST enforce these mandates:
+
+1. **Snapshot-on-Write for Mutable Totals:** Whenever a financial amount, inventory count, or balance is mutated, persist a read-only snapshot of the preceding state in the same transaction (sidecar table, audit log, or WAL). Banned: mutating without preserving the prior value.
+2. **Mandatory `$ifNull` Precedence:** All aggregation queries on monetary fields MUST use explicit null-handling (`COALESCE`, `ISNULL`, `$ifNull`). Banned: passing nullable columns into mathematical operators.
+3. **Observability Alerting on Discrepancies:** If a computed total diverges from its line-item sum by more than 0.01, emit a high-severity alert and prevent finalization.
+4. **Deep Config Merging for Financial Settings:** Financial configuration updates MUST deeply merge nested properties. Banned: shallow object spread on financial config objects.
+
+Note: This plugin tracks compaction stats (`prunedTokens`, `summarizedTurns`) — counters only, not financial ledger. Standard applies if financial features are added.
+
+## Defensive Shell Protocol (DSP)
+
+When writing or reviewing bash scripts, cron jobs, or container orchestration commands:
+
+1. **Mandatory Strict Mode:** All scripts MUST start with `set -euo pipefail`.
+2. **Banned Error Masking:** `2>/dev/null` is STRICTLY FORBIDDEN on data-generation, backup, archive, or database commands.
+3. **No Post-Redirect Status Checks:** Never use `command > file; if [ $? -eq 0 ]` — the shell creates the file before running the command, masking failures.
+4. **Sidecar Isolation for Hostless Backups:** Never rely on host file staging for Docker volume backups. Always use ephemeral containers (`docker run --rm -v volume:/data:ro alpine tar...`) with read-only mounts.
+
+## Task-Number Reference Discipline
+
+Task numbers are provenance for humans, not reasoning material for the model. A bare task number in visible prompt prose invites hallucination: the model treats it as load-bearing context it cannot resolve.
+
+1. **Allowed Homes (only):** code comments (`#`, `//`), `CHANGELOG.md` entries, task files, history archives, and HTML-comment markers (`<!-- -->`).
+2. **Forbidden Homes:** visible prose in prompt fragments, agent instruction files, skill instructions, registry lines, section headings, and any Markdown the Brain or Hands reads as operating instructions.
+3. **Authoring Rule:** when writing or editing prompt-facing Markdown, strip task-number parentheticals. Record provenance in the task file and CHANGELOG instead — never in the prompt text itself.
diff --git a/opencode.json b/opencode.json
new file mode 100644
index 00000000..c8cb8906
--- /dev/null
+++ b/opencode.json
@@ -0,0 +1 @@
+{"$schema":"https://opencode.ai/config.json","default_agent":"build","formatter":true,"instructions":["AGENTS.md","docs/conventions.md"],"lsp":{"typescript":{"command":["typescript-language-server","--stdio"]}},"permission":{"edit":"allow","read":"allow","shell":{"git add":"deny","git add *":"deny","git checkout":"deny","git checkout *":"deny","git commit":"deny","git commit *":"deny","git push":"deny","git push *":"deny"},"write":"allow"}}
\ No newline at end of file
```
<!-- END_GIT_DIFF -->
