# Task 08: Agent-callable compaction tool (`compact_context`)

**File:** `tasks/qa/08-agent-callable-compaction-tool.md`
**Source:** manager
**Type:** feature
**Status:** open

> **Mode:** autopilot locked (Manager, this session).

## Goal

Add a `compact_context` tool so the agent can compress the session itself when the context window is under pressure, instead of relying on the Manager to run `/magic-compact`. The tool reuses the exact command logic (summarize now, schedule the prune pass for the next request) so the two paths can never drift.

## Manager's Notes

Manager order: "One gap worth your call: compaction is still Manager-run only — I cannot trigger it myself. Add it." The tool must expose the same behavior as `/magic-compact` and `/magic-trim`: `mode: "compact"` (default) summarizes old assistant turns and schedules pruning; `mode: "trim"` prunes tool output only; `keepTurns` controls how many recent turns stay unsummarized.

## Local TODOs

- [x] Extract the shared compaction logic into `src/actions.ts` (`parseCompactArgs`, `compactNow`, `scheduleTrim`)
- [x] Register the `compact_context` tool in `src/index.ts` and route the commands through the shared helpers
- [x] Add unit tests for `parseCompactArgs`
- [x] Update README, CHANGELOG, and AGENTS.md
- [x] Verify with the RTK-prefixed test command and record evidence

## Acceptance Criteria

- [x] A `compact_context` tool is registered and callable with optional `keepTurns` and `mode`
- [x] `mode: "compact"` summarizes eligible turns now and schedules pruning; `mode: "trim"` schedules pruning only
- [x] Invalid `keepTurns` returns a friendly message instead of throwing
- [x] The `/magic-compact` and `/magic-trim` commands use the same shared helpers (no duplicated logic)
- [x] `parseCompactArgs` is unit-tested for defaults, trim, keepTurns, and invalid input
- [x] `npm run typecheck` and `npm test` pass

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and unit tests pass, exit code 0
- **Actual result:** `tests 19, pass 19, fail 0`; `npm run typecheck` exit 0; `npm run verify:package` OK (14 files)
- **Exit code:** 0

> Verification runner rule: `npm test` is the complete underlying test command. The first verification run MUST use the `rtk test` prefix; record the exact prefixed command above. A raw rerun is allowed only after a failed RTK run for detailed diagnostics.

## Definition of Done

- [x] Build/Test/Lint pass with exit code 0
- [x] `lint_task_file` passes on the active task file
- [x] `CHANGELOG.md` updated via Parse-Then-Append
- [x] `verification-before-completion` applied and evidence recorded

## Risk & Rollback

- **Risk:** an agent-triggered compaction could summarize turns the agent still needs. Mitigated: summaries keep tool structure and user messages verbatim, and the original tool output stays retrievable via `read_omitted_content`; the agent chooses `keepTurns` to protect recent turns.
- **Rollback plan:** remove the tool registration and the `src/actions.ts` extraction; the commands keep working from the same helpers.

---

## Execution Log & Reasoning

**Plan verdict:** Manager-authorized direct feature — "compaction is still Manager-run only — I cannot trigger it myself. Add it." His order is the plan. **Brainstorm:** not required — a single-module additive change with an obvious design (reuse the command path), no cross-disciplinary ambiguity, no destructive or security surface. **Seat Check:** domain = plugin API (Senior Programmer) → requested: Senior Programmer; skipped: UI/UX Designer (no surface), Architect/Strategist (no schema or scope change).

**Design:** extracted the command logic into `src/actions.ts` so the agent-triggered and Manager-triggered paths share one implementation:
- `parseCompactArgs(input)` — pure normalizer: `mode` defaults to `compact` (`trim` only when explicitly `"trim"`), `keepTurns` defaults to `0` and must be a non-negative integer.
- `compactNow(ctx, sessionID, keepTurns)` — summarizes eligible turns now via `ctx.session.context` + `summarizeTurns`, sets `pending`, persists, returns the count.
- `scheduleTrim(ctx, sessionID, keepTurns)` — schedules a prune-only pass.

`src/index.ts` now registers the `compact_context` tool (optional `keepTurns`, `mode`); it catches `parseCompactArgs` errors and returns a friendly `content` string instead of throwing, matching `read_omitted_content`'s style. The `/magic-compact` and `/magic-trim` commands now call the same helpers, removing the previous duplicated body (and an unused `loadConfig` call in the COMPACT handler).

**Why a tool, not auto-invocation:** the plugin cannot force a compaction on its own — the `context` hook runs on every request and must stay cheap and side-effect-free apart from applying stored state. A tool lets the agent decide, with a description that tells it to call when the window is under pressure. Summaries are produced at call time (bounded by `MAX_TURN_CHARS`); the prune pass and application land on the next request, exactly like the commands.

**Safety:** user messages stay verbatim; only assistant prose/reasoning is replaced; tool-call/tool-result structure is preserved; the original tool output stays retrievable via `read_omitted_content`; the agent can pass `keepTurns` to protect recent turns. No transcript mutation — the state is per-session and per-request.

**Assumptions (logged):** A1 the tool keeps the same "summarize now, prune next request" semantics as the command (the hook is where messages are visible). A2 no version bump in this task — the git-spec install picks up the pushed commit, and bumping would let a push auto-publish; the Manager decides when to release.

**Verification:** `rtk test npm test` → `tests 19, pass 19, fail 0`, exit 0; `npm run typecheck` exit 0; `npm run verify:package` OK (14 files). The new `tests/actions.test.ts` covers defaults, `trim`, unknown mode → compact, valid `keepTurns`, and invalid `keepTurns` (-1, 1.5, "2", NaN).

**Live-test note:** the plugin is installed from the Git spec, so this change goes live only after the repo is pushed and the plugin re-added (or OpenCode re-fetches); the tool then appears alongside `read_omitted_content`. No push performed (ZAC).

**Gates (autopilot):** QA Engineer `VERDICT: QA_PASSED` (tool registration, validation, no transcript mutation, no logic drift, agent safety all confirmed; T1 integration-test gap noted as non-blocking). Code Reviewer `PO_REVIEW_PENDING` — technically approved, Low only: R1 prefer `deepStrictEqual` in the tests (already satisfied — `node:assert/strict` aliases `deepEqual` to `deepStrictEqual`), R2 an integration test for `compactNow`'s pending write in a future task. No blocking issues; closure awaits the Manager's exact word.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/AGENTS.md b/AGENTS.md
index 650add79..46c4f9c1 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -2,9 +2,9 @@
 
 ## Project Overview
 
-Lossless, OpenCode V2-native context compaction. User messages stay verbatim, each old assistant turn is replaced by its own summary, and bulky tool output is pruned to a notice while the original is cached and retrievable via `read_omitted_content`.
+Lossless, OpenCode V2-native context compaction. User messages stay verbatim, each old assistant turn is replaced by its own summary, and bulky tool output is pruned to a notice while the original is cached and retrievable via `read_omitted_content`. The agent can trigger compaction itself with the `compact_context` tool (shared logic in `src/actions.ts`).
 
-Stack: TypeScript ES2022, `@opencode/plugin` 2.0.22, strict `tsc --noEmit`. Entry `src/index.ts`. Modules: `apply.ts` (summary/omission application), `prune.ts` (tool-result pruning), `summarize.ts` (per-turn summaries), `store.ts` (per-session state), `types.ts` (Msg, SessionState). No transcript mutation — transform model-visible messages per request via `session.hook("context")`.
+Stack: TypeScript ES2022, `@opencode/plugin` 2.0.22, strict `tsc --noEmit`. Entry `src/index.ts`. Modules: `actions.ts` (shared compaction actions for the commands and the `compact_context` tool), `apply.ts` (summary/omission application), `config.ts` (JSONC config merge), `plan.ts` (turn grouping/selection), `prune.ts` (tool-result pruning), `strategies.ts` (dedup/purge-errors), `summarize.ts` (per-turn summaries), `store.ts` (per-session state), `types.ts` (Msg, SessionState). No transcript mutation — transform model-visible messages per request via `session.hook("context")`.
 
 ## Setup & Dev Commands
 
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 67a62179..0fe36fe8 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -8,6 +8,8 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ### Added
 
+- `compact_context` tool: the agent can compress the session itself (summarize now, schedule pruning) instead of waiting for the Manager to run a slash command. Takes optional `keepTurns` and `mode` (`compact`/`trim`); invalid input returns a friendly message. Shared logic lives in `src/actions.ts` and backs both the tool and the `/magic-compact` / `/magic-trim` commands, so the paths cannot drift.
+
 - Phase 0 bootstrap: Kanban dirs (`tasks/backlog`, `in-progress`, `qa`, `completed`, `archive`), `AGENTS.md` project hub, `docs/conventions.md` standards, validated `opencode.json` project config.
 - Turn-based compaction planning (`src/plan.ts`) that groups history by user boundary.
 - Unit test suite (`tests/`) run through a compiled build (`tsconfig.test.json`), wired to `npm test`.
diff --git a/README.md b/README.md
index 74d5b2b1..62cd55f1 100644
--- a/README.md
+++ b/README.md
@@ -53,6 +53,15 @@ or list it in `opencode.json(c)`:
 
 Compaction is scheduled by the command and applied on the next model request.
 
+### The agent-callable tool
+
+`compact_context` lets the agent compress the session itself when the context window is under pressure, instead of waiting for the Manager to run a slash command. It reuses the exact command logic, so the two paths cannot drift.
+
+| Input | Effect |
+| --- | --- |
+| `keepTurns` (optional) | Most recent turns to keep unsummarized. Default `0` summarizes all. |
+| `mode` (optional) | `compact` (default) summarizes and prunes; `trim` prunes tool output only. |
+
 ### The omitted-content tool
 
 `read_omitted_content` returns the cached original for a Content ID (e.g. `omitted-0001`) that appears in a pruning notice. The lookup is scoped to the current session. Use it only when the original cannot be reproduced by a new tool call.
diff --git a/src/actions.ts b/src/actions.ts
new file mode 100644
index 00000000..cdd941e7
--- /dev/null
+++ b/src/actions.ts
@@ -0,0 +1,61 @@
+/**
+ * Shared compaction actions used by both the slash commands and the
+ * `compact_context` tool, so the agent-triggered and Manager-triggered paths
+ * can never drift.
+ */
+import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
+import { summarizeTurns } from "./summarize.js";
+import { loadState, saveState, type Ctx } from "./store.js";
+
+export type CompactMode = "compact" | "trim";
+
+export interface CompactArgs {
+  mode: CompactMode;
+  keepTurns: number;
+}
+
+/**
+ * Pure: normalize a tool/command argument object into a compaction request.
+ * `mode` defaults to `compact`; `keepTurns` defaults to 0 (summarize all) and
+ * must be a non-negative integer when supplied. Throws on invalid input so the
+ * caller can surface a friendly message.
+ */
+export function parseCompactArgs(input: unknown): CompactArgs {
+  const record = (input && typeof input === "object" ? input : {}) as {
+    mode?: unknown;
+    keepTurns?: unknown;
+  };
+  const mode: CompactMode = record.mode === "trim" ? "trim" : "compact";
+  let keepTurns = 0;
+  if (record.keepTurns !== undefined && record.keepTurns !== null) {
+    const value = record.keepTurns;
+    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
+      throw new Error("keepTurns must be a non-negative integer.");
+    }
+    keepTurns = value;
+  }
+  return { mode, keepTurns };
+}
+
+/**
+ * Summarize the eligible turns now (each becomes a short summary; user
+ * messages stay verbatim) and schedule the tool-output prune pass for the next
+ * request. Returns the number of turns summarized.
+ */
+export async function compactNow(ctx: Ctx, sessionID: string, keepTurns: number): Promise<number> {
+  const state = await loadState(ctx, sessionID);
+  const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
+  const turns = buildTurns(entries);
+  const summarized = await summarizeTurns(ctx, selectTurns(turns, keepTurns), state);
+  state.stats.summarizedTurns += summarized;
+  state.pending = { mode: "compact", keepTurns };
+  await saveState(ctx, sessionID, state);
+  return summarized;
+}
+
+/** Schedule a tool-output-only prune for the next request, without summarizing. */
+export async function scheduleTrim(ctx: Ctx, sessionID: string, keepTurns: number): Promise<void> {
+  const state = await loadState(ctx, sessionID);
+  state.pending = { mode: "trim", keepTurns };
+  await saveState(ctx, sessionID, state);
+}
diff --git a/src/index.ts b/src/index.ts
index 61dbc298..254444c9 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,12 +10,11 @@
  * pruned to a notice while the original is cached and retrievable.
  */
 import { Plugin } from "@opencode/plugin";
+import { compactNow, parseCompactArgs, scheduleTrim } from "./actions.js";
 import { applySummaries } from "./apply.js";
 import { applyOmissions, pruneToolResults } from "./prune.js";
 import { applyStrategies } from "./strategies.js";
-import { summarizeTurns } from "./summarize.js";
 import { loadConfig, type SmartCompactConfig } from "./config.js";
-import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
 import { loadState, saveState, type Ctx } from "./store.js";
 import type { Msg, SessionState } from "./types.js";
 
@@ -23,6 +22,7 @@ const COMPACT = "magic-compact";
 const TRIM = "magic-trim";
 const STATS = "magic-stats";
 const TOOL = "read_omitted_content";
+const COMPACT_TOOL = "compact_context";
 
 /** Parse an optional non-negative integer argument; throws on anything else. */
 function parseKeepTurns(text: string | undefined): number {
@@ -71,14 +71,7 @@ export default Plugin.define({
         description: "Lossless context compression (optional: number of recent turns to keep)",
         async execute({ sessionID, prompt }) {
           const keepTurns = parseKeepTurns(prompt?.text);
-          const config = await loadConfig(ctx);
-          const state = await loadState(ctx, sessionID);
-          const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
-          const turns = buildTurns(entries);
-          const summarized = await summarizeTurns(ctx, selectTurns(turns, keepTurns), state);
-          state.stats.summarizedTurns += summarized;
-          state.pending = { mode: "compact", keepTurns };
-          await saveState(ctx, sessionID, state);
+          const summarized = await compactNow(ctx, sessionID, keepTurns);
           await notify(
             ctx,
             sessionID,
@@ -91,9 +84,7 @@ export default Plugin.define({
         description: "Prune bulky tool output only, without summarizing (optional: recent turns to keep)",
         async execute({ sessionID, prompt }) {
           const keepTurns = parseKeepTurns(prompt?.text);
-          const state = await loadState(ctx, sessionID);
-          state.pending = { mode: "trim", keepTurns };
-          await saveState(ctx, sessionID, state);
+          await scheduleTrim(ctx, sessionID, keepTurns);
         },
       });
       editor.add({
@@ -138,6 +129,47 @@ export default Plugin.define({
           };
         },
       });
+
+      // Tool: agent-callable compaction, so the agent can free context room
+      // itself instead of waiting for the Manager to run a slash command. It
+      // reuses the exact command helpers, so the two paths cannot drift.
+      editor.add({
+        name: COMPACT_TOOL,
+        description:
+          "Compress this session's context now to free room: summarize old assistant turns (each becomes a short summary; user messages stay verbatim) and prune bulky tool output to a retrievable notice. Call it when the context window is under pressure. Optional inputs: keepTurns (most recent turns to keep unsummarized, default 0 = all), mode ('compact' default summarizes and prunes; 'trim' prunes tool output only).",
+        input: {
+          type: "object",
+          properties: {
+            keepTurns: {
+              type: "integer",
+              minimum: 0,
+              description: "Most recent turns to keep unsummarized. Default 0 summarizes all.",
+            },
+            mode: {
+              type: "string",
+              enum: ["compact", "trim"],
+              description: "'compact' (default) summarizes and prunes; 'trim' prunes tool output only.",
+            },
+          },
+          additionalProperties: false,
+        },
+        async execute(input: unknown, context) {
+          let args;
+          try {
+            args = parseCompactArgs(input);
+          } catch (error) {
+            return { content: `[smart-compact] ${(error as Error).message}` };
+          }
+          if (args.mode === "trim") {
+            await scheduleTrim(ctx, context.sessionID, args.keepTurns);
+            return { content: "[smart-compact] tool output will be trimmed on the next request." };
+          }
+          const summarized = await compactNow(ctx, context.sessionID, args.keepTurns);
+          return {
+            content: `[smart-compact] summarized ${summarized} turn(s); bulky tool output will be trimmed on the next request.`,
+          };
+        },
+      });
     });
 
     // Context hook: apply compaction to every model request. Summaries are
diff --git a/tests/actions.test.ts b/tests/actions.test.ts
new file mode 100644
index 00000000..b4591829
--- /dev/null
+++ b/tests/actions.test.ts
@@ -0,0 +1,27 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { parseCompactArgs } from "../src/actions.js";
+
+test("parseCompactArgs defaults to compact-all", () => {
+  assert.deepEqual(parseCompactArgs(undefined), { mode: "compact", keepTurns: 0 });
+  assert.deepEqual(parseCompactArgs({}), { mode: "compact", keepTurns: 0 });
+});
+
+test("parseCompactArgs honors mode trim", () => {
+  assert.deepEqual(parseCompactArgs({ mode: "trim" }), { mode: "trim", keepTurns: 0 });
+});
+
+test("parseCompactArgs treats an unknown mode as compact", () => {
+  assert.deepEqual(parseCompactArgs({ mode: "nonsense" }), { mode: "compact", keepTurns: 0 });
+});
+
+test("parseCompactArgs accepts a non-negative integer keepTurns", () => {
+  assert.deepEqual(parseCompactArgs({ keepTurns: 3, mode: "trim" }), { mode: "trim", keepTurns: 3 });
+  assert.deepEqual(parseCompactArgs({ keepTurns: 0 }), { mode: "compact", keepTurns: 0 });
+});
+
+test("parseCompactArgs rejects a negative, fractional, or non-numeric keepTurns", () => {
+  for (const bad of [-1, 1.5, "2", Number.NaN]) {
+    assert.throws(() => parseCompactArgs({ keepTurns: bad }), /non-negative integer/);
+  }
+});
```
<!-- END_GIT_DIFF -->
