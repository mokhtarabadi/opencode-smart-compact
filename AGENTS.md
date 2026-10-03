# opencode-smart-compact — Project Context Hub

## Project Overview

Lossless, OpenCode V2-native context compaction. User messages stay verbatim, each old assistant turn is replaced by its own summary, and bulky tool output is pruned to a notice while the original is cached and retrievable via `read_omitted_content`. The agent can trigger compaction itself with the `compact_context` tool (shared logic in `src/actions.ts`).

Stack: TypeScript ES2022, `@opencode/plugin` 2.0.22, strict `tsc --noEmit`. Entry `src/index.ts`. Modules: `actions.ts` (shared compaction actions for the commands and the `compact_context` tool), `apply.ts` (summary/omission application), `config.ts` (JSONC config merge), `plan.ts` (turn grouping/selection), `prune.ts` (tool-result pruning), `strategies.ts` (dedup/purge-errors), `summarize.ts` (per-turn summaries), `store.ts` (per-session state), `types.ts` (Msg, SessionState). No transcript mutation — transform model-visible messages per request via `session.hook("context")`.

## Setup & Dev Commands

- Install: `npm install`
- Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Test: `npm run typecheck` (no unit suite yet)
- Dev: `opencode plugin add /absolute/path/to/opencode-smart-compact` or add dir to `plugins` in `opencode.json`

## Actionable Guardrails (Do's & Don'ts)

- **Don't** mutate the stored transcript directly (V1 `session.messages` / `part.update` pattern)
  -> **Do** transform model-visible messages per request via `session.hook("context")`, `ctx.command.transform`, `ctx.tool.transform`, `ctx.storage`
- **Don't** summarize user messages or merge turns into one lossy blob
  -> **Do** keep user messages verbatim, replace each old assistant turn with its own summary
- **Don't** prune pending or errored tool calls, or `read`/`write`/`edit` outputs that are reloadable without cache
  -> **Do** prune only completed tool results over ~1024 chars or ~128 words, cache original under Content ID (e.g. `omitted-0001`)
- **Don't** read `context-reports/` markdown files yourself.
  -> **Do** generate them using the MCP server — context reports via `custom_context_read_source_files`, tree reports via `custom_context_create_tree_report` ("create a tree of the project") — and hand the file path to the Manager.
- **Don't** execute Git commands like `git add`, `git commit`, or `git mv` autonomously or try to guess when to stage code.
  -> **Do** execute Git commands ONLY when explicitly instructed by an Orchestrator task block. Otherwise, rely on the `custom_context_stage_and_inject_diff` MCP tool.
  -> **Exception:** `git mv` is permitted autonomously for moving task files between Kanban directories.
- **Don't** guess blindly when facing complex bugs, deadlocks, or silent timeouts.
  -> **Do** utilize the `debug-instrumentation` skill to inject strategic logs and trace the runtime execution path.
- **Don't** write bash scripts without strict mode or mask errors with `2>/dev/null` on data commands.
  -> **Do** follow the Defensive Shell Protocol: `set -euo pipefail`, ban error masking, sidecar isolation for Docker backups. See `docs/conventions.md`.
- **Don't** perform financial mutations without snapshotting the prior state or allow nulls in monetary aggregations.
  -> **Do** follow the Universal Financial Ledger Standard: snapshot-on-write, `$ifNull` precedence, discrepancy alerting, deep config merging. See `docs/conventions.md`.
- **Don't** leave task numbers in visible prompt prose, section headings, or skill instructions.
  -> **Do** keep task-number references in code comments, CHANGELOG entries, task files, history archives, and HTML comments only. See `docs/conventions.md`.
- **Don't** carry over assumptions, partial results, or architectural hypotheses from a previous task.
  -> **Do** flush context and treat every task as contextually independent (Buffer Isolation directive in validation-phase).
- **Don't** execute raw, informal, or non-English prompts directly.
  -> **Do** load the `prompt-refactor` skill to translate and expand the intent into an elite English spec first. (Note: If you receive a standard XML task block, skip this and execute normally).
- **Don't** attempt to resolve cross-disciplinary ambiguity within a single persona.
  -> **Do** trigger the Multi-Agent Brainstorming Loop if the Manager explicitly requests brainstorming or a task exhibits cross-disciplinary ambiguity. Interpret the `<brainstorming_session>` results in backlog tasks as non-functional guidelines that govern execution.

## Documentation Sync Rules

When modifying this repository, you must keep these files synchronized:

1. Active task file in `tasks/` (single source of truth for current work items)
2. `CHANGELOG.md` (Keep a Changelog format)
3. `DESIGN.md` (UI/UX design system, if modified — currently absent, skip gracefully)
4. `docs/conventions.md` (syntax rules, datetime standard, SOLID guidelines)
5. Relevant `SKILL.md` files (if structural patterns were altered)

## 🛑 GATEKEEPER VALIDATION (HALT PROTOCOL)

You (the Hands) are the final gatekeeper. Before executing any implementation task, you MUST evaluate the Orchestrator's instructions against this file and any referenced specs (`DESIGN.md`, `architecture.md`, etc.). If the instructions violate project rules, ignore them. HALT immediately and output a `⚠️ RULE VIOLATION WARNING` back to the Manager explaining exactly what the Orchestrator got wrong, forcing it to self-correct.

This is the entry point: read this `AGENTS.md` first before any execution. If referenced, also read `DESIGN.md`, `docs/architecture.md`, `docs/data_model.md`, `docs/conventions.md`. Absent files are skipped gracefully per Absent-File Policy — never halt, never hallucinate.

## 🛑 CORE FILE LOCATIONS

You MUST strictly adhere to these exact paths. Do not create duplicates elsewhere:

- **Global Rules:** `AGENTS.md` (Root)
- **UI/UX Specs:** `DESIGN.md` (Root — currently absent, skip gracefully)
- **Conventions:** `docs/conventions.md`
- **Agent Skills:** `.opencode/skills/<skill-name>/SKILL.md` (Local workspace — optional; only include if project utilizes OpenCode)
- **Active Tasks:** `tasks/backlog/<task-number>-<name>.md` (backlog), `tasks/in-progress/`, `tasks/qa/`, `tasks/completed/`, `tasks/archive/`
- **Plugin Entry:** `src/index.ts`

## 🛑 SKILL LOADING RULES

You MUST follow these skill loading rules in every session:

- **Task-Generator Skill:** Before creating any new task file, you MUST load the `task-generator` skill using the `skill` tool to ensure the correct template format with `<!-- BEGIN_GIT_DIFF -->` / `<!-- END_GIT_DIFF -->` markers.
- **Project Skills:** Before implementing any task, you MUST load every available skill matching the project's tech stack (e.g., `opencode` for plugin API, `prompt-refactor` for informal input). If a relevant skill exists, it MUST be loaded — this enforces framework-specific conventions and architectural rules.
- **Complex Debugging:** Do not guess blindly — load `debug-instrumentation` for deadlocks, races, silent failures.

## 🛑 CONTEXT BOOTSTRAPPING

At the start of every task, you MUST call `search_memory` or `list_namespaces` to load any hidden project quirks relevant to your domain before implementing. Read `.opencode/memory/index.md` alongside this file when present.

## 🛑 MANDATORY END-OF-TASK SEQUENCE

When finishing a task, you MUST execute these exact steps in order:

1. **Update Changelog:** You MUST insert a formal entry into CHANGELOG.md logging your modifications.
2. **Write your Summary:** Manually write your architectural reasoning, local TODO checks, and execution notes into the active `tasks/XX-task.md` file under "Execution Log & Reasoning".
3. **Call MCP Tool & QA Transition:** Call the `custom_context_stage_and_inject_diff` MCP tool with the explicit `modified_files` list (blind `git add -A .` is banned). After injection, you MUST move the task file to `tasks/qa/` via `git mv` before notifying the Manager (implementation tasks only — discovery tasks stay in place). DO NOT execute any `git commit` commands. Closure to `tasks/completed/` happens ONLY after the Manager explicitly says "Approved for closure" or "Close task".
4. **Kanban Metadata Synchronization (mandatory after ANY authorized `git mv`):** After the move, update the task file's `**File:**` metadata header to the new path. If the move happened AFTER staging, re-run `lint_task_file` and call `custom_context_stage_and_inject_diff` AGAIN with the NEW task path and the full `modified_files` array before notifying the Manager — the re-stage keeps the injected diff and staging state in sync with the final path. Never notify the Manager with a stale `**File:**` header.
5. **Notify Manager:** Output exactly: "Task ready. Manager, please copy the contents of `tasks/XX-task.md` and send it back to the Orchestrator Brain for review."

## Lite Mode Protocol

`<lite_mode_protocol>` — when eligible (single-file, no security/financial impact, obvious simplicity, never login/auth/money/security-surface), the full 9-step production line can be bypassed with a `[LITE]` justification in the task's `## Execution Log & Reasoning` section. Escalation to Full Mode is mandatory if hidden complexity is discovered.

## Deprecated-Section Purge Rule

`AGENTS.md` and all active task files MUST NOT contain `## Manager Decisions`, `## Admin Decision`, `Manager Decision`, `Admin Decision` sections. If detected during audit, purge the entire section, document the purge, and never recreate it. Absence of these sections is compliant.

## Task-Number Reference Discipline

Keep task numbers in code comments, CHANGELOG entries, task files, history archives, and HTML comments only. Never in visible prompt prose, headings, or skill instructions.
