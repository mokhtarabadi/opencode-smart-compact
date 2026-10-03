# Task 03: Strategies, config, and visible stats

**File:** `tasks/archive/03-strategies-config-stats.md`
**Source:** manager
**Type:** feature
**Status:** superseded
**Superseded-By:** `05-v2-overhaul-bundle`
**Superseded-At:** `2026-10-03`

> **Mode:** autopilot locked (Manager, this session). Runs end-to-end to the qa lane; closure still requires the explicit approval word.

## Goal

Port the highest-value features the reference plugins have that smart-compact lacks: automatic deduplication of repeated tool calls, errored-tool-input purging after N turns, a project/global config file, and stats surfaced to the user as a visible synthetic message.

## Manager's Notes

From the DCP audit: deduplication keeps the newest of duplicate tool calls (`lib/strategies/deduplication.ts`), purge-errors prunes errored tool inputs after `turns` (`lib/strategies/purge-errors.ts`), config layers project over global (`lib/config.ts`), and stats/context are shown in-conversation. smart-compact currently console.logs stats, which the user never sees.

## Local TODOs

- [ ] Add `config.ts` loading `.opencode/smart-compact.jsonc` then `~/.config/opencode/smart-compact.jsonc`
- [ ] Add deduplication strategy (same tool + normalized args, keep latest)
- [ ] Add purge-errors strategy (errored tool inputs after N turns)
- [ ] Extend `/magic-stats` to inject a visible synthetic message with tokens and estimated cost
- [ ] Thread config through prune/summarize/apply

## Acceptance Criteria

- [x] Config file overrides built-in defaults and invalid files fall back to defaults
- [x] Duplicate tool results are pruned to the latest occurrence
- [x] Errored tool inputs older than the configured turn threshold are pruned
- [x] `/magic-stats` produces a user-visible message, not only a server log
- [x] `npm run typecheck` exits 0 and unit tests pass

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and unit tests pass
- **Actual result:** 14/14 tests pass; `rtk test npm run typecheck` exit 0
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

- **Risk:** Aggressive automatic pruning surprises users
- **Rollback plan:** All strategies are config-gated with safe defaults and can be disabled in config; revert the diff if needed

---

> **Superseded:** This task was bundled into META task `05-v2-overhaul-bundle` and archived on 2026-10-03. See `tasks/backlog/05-v2-overhaul-bundle.md` (or its Kanban successor) for the unified execution. History preserved via `git log --follow -- tasks/archive/03-strategies-config-stats.md`.

## Execution Log & Reasoning

Autopilot locked for this session; ran without approval pauses to the qa lane.

Changes:
- `src/config.ts` (new): typed config with defaults, JSONC loader (comment/trailing-comma stripper, string-aware), global then project merge. `ctx.location.directory` scopes the project file.
- `src/strategies.ts` (new): `stableStringify` for call signatures; `applyDeduplication` keeps the newest identical tool call and replaces earlier results with a notice; `applyPurgeErrors` blanks string leaves of errored tool inputs older than `turns`, preserving structure.
- `src/prune.ts`: thresholds, protected/always-prune/discard tool lists now come from config (default-parameterised so existing callers/tests keep working).
- `src/index.ts`: loads config per request, gates on `config.enabled`, runs strategies in the pending prune pass, and posts a user-visible synthetic message for `/magic-stats` and `/magic-compact`.
- `tests/strategies.test.ts`: 5 new tests.

Assumption A3: config arrays (protectedTools etc.) replace defaults rather than union, matching explicit user intent. Reason: simpler and predictable; union is a possible follow-up.
Assumption A4: strategies run on the pending prune pass only (not every request), matching DCP's "recalc on compress" behavior; discard rules still apply every request via `applyOmissions`.
Q2: Should `enabled:false` also skip summarization at command time, or only the hook? Currently only the hook is gated.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/.gitignore b/.gitignore
index f3753cf5..5affc5ba 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,4 +1,5 @@
 node_modules/
 dist/
+.test-build/
 .opencode/memory/index.md
 tasks/.sessions/
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 1b0e3e16..2c14d6c4 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -9,3 +9,20 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 ### Added
 
 - Phase 0 bootstrap: Kanban dirs (`tasks/backlog`, `in-progress`, `qa`, `completed`, `archive`), `AGENTS.md` project hub, `docs/conventions.md` standards, validated `opencode.json` project config.
+- Turn-based compaction planning (`src/plan.ts`) that groups history by user boundary.
+- Unit test suite (`tests/`) run through a compiled build (`tsconfig.test.json`), wired to `npm test`.
+- Research tasks for strategies/config/stats and docs/publish readiness.
+- Automatic strategies (`src/strategies.ts`): deduplication of identical tool calls and purge-errors of stale errored tool inputs.
+- Configuration (`src/config.ts`): `.opencode/smart-compact.jsonc` over global `~/.config/opencode/smart-compact.jsonc` over built-in defaults.
+- `/magic-stats` and `/magic-compact` now post a user-visible synthetic message instead of logging only to the server.
+
+### Changed
+
+- Summaries now preserve tool-call/tool-result/media structure and replace only prose and reasoning, instead of collapsing the whole assistant message.
+- Summarization runs in the command handler via `ctx.generate.text`, out of the `context` hook; tool-only turns are absorbed without a model call.
+- Omission ids are monotonic (`nextOmissionId`) and no longer collide across restarts.
+- `read_omitted_content` is scoped to the calling session's state.
+
+### Fixed
+
+- Per-tool pruning rules: `question` is never pruned, `task` uses a higher threshold, `todowrite`/`skill` are discarded without caching, `read` is always pruned.
diff --git a/package.json b/package.json
index 8edcf2a0..9f783fc5 100644
--- a/package.json
+++ b/package.json
@@ -10,7 +10,8 @@
   "keywords": ["opencode", "opencode-plugin", "context", "compaction", "llm"],
   "license": "MIT",
   "scripts": {
-    "typecheck": "tsc --noEmit"
+    "typecheck": "tsc --noEmit",
+    "test": "tsc -p tsconfig.test.json && node --test .test-build/tests/*.test.js"
   },
   "devDependencies": {
     "@opencode/plugin": "2.0.22",
diff --git a/src/apply.ts b/src/apply.ts
index ed7c8fd2..7e154e94 100644
--- a/src/apply.ts
+++ b/src/apply.ts
@@ -1,5 +1,8 @@
 import type { Msg, Part, SessionState } from "./types.js";
 
+/** Marker metadata so a summary part is recognizable and idempotent. */
+const SUMMARY_META = "smart-compact-summary";
+
 /** Extract the plain text of a message (all text parts joined). */
 export function messageText(msg: Msg): string {
   if (!Array.isArray(msg.content)) return "";
@@ -10,36 +13,54 @@ export function messageText(msg: Msg): string {
     .trim();
 }
 
+/** True once this message already carries a smart-compact summary part. */
+function isSummarized(msg: Msg): boolean {
+  return msg.content.some(
+    (p) =>
+      p.type === "text" &&
+      p.metadata !== undefined &&
+      (p.metadata as Record<string, unknown>)[SUMMARY_META] === true,
+  );
+}
+
 /**
- * Replace summarized assistant messages with their stored summary, keeping the
- * conversation skeleton. Mutates in place. Idempotent: a message whose content
- * is already the single summary text is left untouched.
+ * Rebuild an assistant message's parts for a summarized turn: drop the prose and
+ * reasoning, keep the tool-call/tool-result/media/compaction structure, and
+ * insert a single summary text part in place of the removed prose. An empty
+ * `summary` strips prose without emitting a summary (the "absorbed" sentinel for
+ * the later assistant messages of a multi-step turn).
  */
-export function applySummaries(messages: Msg[], state: SessionState): number {
-  let applied = 0;
-  for (const msg of messages) {
-    if (msg.role !== "assistant" || !msg.id) continue;
-    const summary = state.summaries[msg.id];
-    if (!summary) continue;
-    if (msg.content.length === 1 && msg.content[0]?.type === "text" && msg.content[0]?.text === summary) {
+function summarizeContent(content: Part[], summary: string): Part[] {
+  const kept: Part[] = [];
+  let inserted = false;
+  for (const part of content) {
+    if (part.type === "text" || part.type === "reasoning") {
+      if (!inserted && summary) {
+        kept.push({ type: "text", text: `[summarized turn — ${summary}]`, metadata: { [SUMMARY_META]: true } });
+        inserted = true;
+      }
       continue;
     }
-    const replacement: Part = {
-      type: "text",
-      text: `[summarized turn — ${summary}]`,
-      metadata: { "smart-compact": true },
-    };
-    msg.content.splice(0, msg.content.length, replacement);
-    applied += 1;
+    kept.push(part);
   }
-  return applied;
+  if (!inserted && summary) {
+    kept.unshift({ type: "text", text: `[summarized turn — ${summary}]`, metadata: { [SUMMARY_META]: true } });
+  }
+  return kept;
 }
 
-/** Count assistant messages that are candidates for summarization. */
-export function assistantTurnIds(messages: Msg[]): string[] {
-  const ids: string[] = [];
+/**
+ * Replace summarized assistant prose with its stored summary while preserving
+ * tool structure. Mutates in place. Idempotent within a single request.
+ */
+export function applySummaries(messages: Msg[], state: SessionState): number {
+  let applied = 0;
   for (const msg of messages) {
-    if (msg.role === "assistant" && msg.id) ids.push(msg.id);
+    if (msg.role !== "assistant" || !msg.id) continue;
+    if (!(msg.id in state.summaries)) continue;
+    if (isSummarized(msg)) continue;
+    msg.content = summarizeContent(msg.content, state.summaries[msg.id] ?? "");
+    applied += 1;
   }
-  return ids;
+  return applied;
 }
diff --git a/src/config.ts b/src/config.ts
new file mode 100644
index 00000000..6d0f09ce
--- /dev/null
+++ b/src/config.ts
@@ -0,0 +1,159 @@
+/**
+ * Configuration for smart-compact. Project config (`.opencode/smart-compact.jsonc`)
+ * overrides the global config (`~/.config/opencode/smart-compact.jsonc`), which
+ * overrides the built-in defaults. Invalid or missing files fall back silently.
+ */
+import { readFile } from "node:fs/promises";
+import { homedir } from "node:os";
+import { join } from "node:path";
+import type { Ctx } from "./store.js";
+
+export interface PruningConfig {
+  maxChars: number;
+  maxWords: number;
+  taskMaxChars: number;
+  taskMaxWords: number;
+  protectedTools: string[];
+  alwaysPruneTools: string[];
+  discardTools: Record<string, string>;
+}
+
+export interface StrategiesConfig {
+  deduplication: { enabled: boolean; protectedTools: string[] };
+  purgeErrors: { enabled: boolean; turns: number; protectedTools: string[] };
+}
+
+export interface SmartCompactConfig {
+  enabled: boolean;
+  pruning: PruningConfig;
+  strategies: StrategiesConfig;
+}
+
+export const DEFAULT_CONFIG: SmartCompactConfig = {
+  enabled: true,
+  pruning: {
+    maxChars: 1024,
+    maxWords: 128,
+    taskMaxChars: 4096,
+    taskMaxWords: 512,
+    protectedTools: ["question"],
+    alwaysPruneTools: ["read"],
+    discardTools: {
+      todowrite: "Successfully updated todos.",
+      skill: "Skill contents omitted after compaction; recall the skill if needed.",
+    },
+  },
+  strategies: {
+    deduplication: { enabled: true, protectedTools: ["question"] },
+    purgeErrors: { enabled: true, turns: 4, protectedTools: ["question"] },
+  },
+};
+
+/** Strip JSONC comments and trailing commas. Best-effort; never throws. */
+function stripJsonc(text: string): string {
+  let out = "";
+  let inString = false;
+  let escaped = false;
+  for (let i = 0; i < text.length; i += 1) {
+    const ch = text[i]!;
+    const next = text[i + 1];
+    if (inString) {
+      out += ch;
+      if (escaped) escaped = false;
+      else if (ch === "\\") escaped = true;
+      else if (ch === '"') inString = false;
+      continue;
+    }
+    if (ch === '"') {
+      inString = true;
+      out += ch;
+      continue;
+    }
+    if (ch === "/" && next === "/") {
+      while (i < text.length && text[i] !== "\n") i += 1;
+      continue;
+    }
+    if (ch === "/" && next === "*") {
+      i += 2;
+      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
+      i += 1;
+      continue;
+    }
+    out += ch;
+  }
+  return out.replace(/,(\s*[}\]])/g, "$1");
+}
+
+function asRecord(value: unknown): Record<string, unknown> | undefined {
+  return value && typeof value === "object" && !Array.isArray(value)
+    ? (value as Record<string, unknown>)
+    : undefined;
+}
+
+function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConfig {
+  const p = asRecord(patch);
+  if (!p) return base;
+  const pruning = asRecord(p.pruning);
+  const strategies = asRecord(p.strategies);
+  const dedup = asRecord(strategies?.deduplication);
+  const purge = asRecord(strategies?.purgeErrors);
+  return {
+    enabled: typeof p.enabled === "boolean" ? p.enabled : base.enabled,
+    pruning: {
+      maxChars: typeof pruning?.maxChars === "number" ? pruning.maxChars : base.pruning.maxChars,
+      maxWords: typeof pruning?.maxWords === "number" ? pruning.maxWords : base.pruning.maxWords,
+      taskMaxChars: typeof pruning?.taskMaxChars === "number" ? pruning.taskMaxChars : base.pruning.taskMaxChars,
+      taskMaxWords: typeof pruning?.taskMaxWords === "number" ? pruning.taskMaxWords : base.pruning.taskMaxWords,
+      protectedTools: Array.isArray(pruning?.protectedTools)
+        ? (pruning.protectedTools as string[])
+        : base.pruning.protectedTools,
+      alwaysPruneTools: Array.isArray(pruning?.alwaysPruneTools)
+        ? (pruning.alwaysPruneTools as string[])
+        : base.pruning.alwaysPruneTools,
+      discardTools: { ...base.pruning.discardTools, ...(asRecord(pruning?.discardTools) as Record<string, string> | undefined) },
+    },
+    strategies: {
+      deduplication: {
+        enabled: typeof dedup?.enabled === "boolean" ? dedup.enabled : base.strategies.deduplication.enabled,
+        protectedTools: Array.isArray(dedup?.protectedTools)
+          ? (dedup.protectedTools as string[])
+          : base.strategies.deduplication.protectedTools,
+      },
+      purgeErrors: {
+        enabled: typeof purge?.enabled === "boolean" ? purge.enabled : base.strategies.purgeErrors.enabled,
+        turns: typeof purge?.turns === "number" ? purge.turns : base.strategies.purgeErrors.turns,
+        protectedTools: Array.isArray(purge?.protectedTools)
+          ? (purge.protectedTools as string[])
+          : base.strategies.purgeErrors.protectedTools,
+      },
+    },
+  };
+}
+
+async function readConfigFile(path: string): Promise<unknown | undefined> {
+  try {
+    const text = await readFile(path, "utf8");
+    return JSON.parse(stripJsonc(text));
+  } catch {
+    return undefined;
+  }
+}
+
+/** The global config path, honoring XDG_CONFIG_HOME. */
+export function globalConfigPath(): string {
+  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
+  return join(base, "opencode", "smart-compact.jsonc");
+}
+
+/** Load the effective config: defaults ← global ← project. */
+export async function loadConfig(ctx: Ctx): Promise<SmartCompactConfig> {
+  let config = DEFAULT_CONFIG;
+  const global = await readConfigFile(globalConfigPath());
+  if (global) config = mergeConfig(config, global);
+  const directory = (ctx.location as { directory?: string }).directory;
+  if (directory) {
+    const project = await readConfigFile(join(directory, ".opencode", "smart-compact.jsonc"));
+    if (project) config = mergeConfig(config, project);
+  }
+  return config;
+}
diff --git a/src/index.ts b/src/index.ts
index c6fc35c4..61dbc298 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -12,7 +12,10 @@
 import { Plugin } from "@opencode/plugin";
 import { applySummaries } from "./apply.js";
 import { applyOmissions, pruneToolResults } from "./prune.js";
-import { summarizeOldTurns } from "./summarize.js";
+import { applyStrategies } from "./strategies.js";
+import { summarizeTurns } from "./summarize.js";
+import { loadConfig, type SmartCompactConfig } from "./config.js";
+import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
 import { loadState, saveState, type Ctx } from "./store.js";
 import type { Msg, SessionState } from "./types.js";
 
@@ -31,22 +34,29 @@ function parseKeepTurns(text: string | undefined): number {
   return Number(trimmed);
 }
 
-/** Run a compaction or trim request and persist the resulting state. */
-async function runCompaction(
+/** Post a user-visible message without prompting the model. */
+async function notify(ctx: Ctx, sessionID: string, text: string): Promise<void> {
+  try {
+    await ctx.session.synthetic({ sessionID, text });
+  } catch {
+    // Synthetic delivery is best-effort; never fail a command over it.
+  }
+}
+
+/** Run any pending automatic strategies and the prune pass, then persist stats. */
+async function runPrune(
   ctx: Ctx,
   sessionID: string,
-  mode: "compact" | "trim",
-  keepTurns: number,
   messages: Msg[],
+  config: SmartCompactConfig,
 ): Promise<SessionState> {
   const state = await loadState(ctx, sessionID);
-  if (mode === "compact") {
-    state.stats.summarizedTurns += await summarizeOldTurns(ctx, messages, keepTurns, state);
-  }
-  const pruned = pruneToolResults(messages, state);
-  state.stats.prunedParts += pruned.pruned;
-  state.stats.prunedTokens += pruned.tokens;
+  const strategies = applyStrategies(messages, config);
+  const pruned = pruneToolResults(messages, state, config);
+  state.stats.prunedParts += pruned.pruned + strategies.pruned;
+  state.stats.prunedTokens += pruned.tokens + strategies.tokens;
   state.stats.lastRun = Date.now();
+  state.pending = null;
   await saveState(ctx, sessionID, state);
   return state;
 }
@@ -54,16 +64,26 @@ async function runCompaction(
 export default Plugin.define({
   id: "smart-compact",
   async setup(ctx) {
-    // Commands: schedule a compaction/trim, applied on the next model request.
+    // Commands: summarize now, schedule the pruning pass for the next request.
     await ctx.command.transform((editor) => {
       editor.add({
         name: COMPACT,
         description: "Lossless context compression (optional: number of recent turns to keep)",
         async execute({ sessionID, prompt }) {
           const keepTurns = parseKeepTurns(prompt?.text);
+          const config = await loadConfig(ctx);
           const state = await loadState(ctx, sessionID);
+          const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
+          const turns = buildTurns(entries);
+          const summarized = await summarizeTurns(ctx, selectTurns(turns, keepTurns), state);
+          state.stats.summarizedTurns += summarized;
           state.pending = { mode: "compact", keepTurns };
           await saveState(ctx, sessionID, state);
+          await notify(
+            ctx,
+            sessionID,
+            `[smart-compact] summarized ${summarized} turn(s); bulky tool output will be trimmed on the next request.`,
+          );
         },
       });
       editor.add({
@@ -82,15 +102,17 @@ export default Plugin.define({
         async execute({ sessionID }) {
           const state = await loadState(ctx, sessionID);
           const s = state.stats;
-          console.log(
-            `[smart-compact] pruned ${s.prunedTokens} tokens across ${s.prunedParts} tool results; ` +
-              `summarized ${s.summarizedTurns} turns; ${Object.keys(state.omissions).length} cached omissions.`,
-          );
+          const text =
+            `[smart-compact] pruned ~${s.prunedTokens} tokens across ${s.prunedParts} tool results; ` +
+            `summarized ${s.summarizedTurns} turns; ${Object.keys(state.omissions).length} cached omissions.`;
+          console.log(text);
+          await notify(ctx, sessionID, text);
         },
       });
     });
 
-    // Tool: retrieve a pruned tool result by its Content ID.
+    // Tool: retrieve a pruned tool result by its Content ID, scoped to the
+    // calling session so one session can never read another's cache.
     await ctx.tool.transform((editor) => {
       editor.add({
         name: TOOL,
@@ -104,49 +126,39 @@ export default Plugin.define({
           required: ["contentId"],
           additionalProperties: false,
         },
-        async execute(input: unknown) {
+        async execute(input: unknown, context) {
           const { contentId } = (input ?? {}) as { contentId?: string };
           if (!contentId) return { content: "Missing contentId." };
-          // Session scoping is applied by the caller's storage namespace; here
-          // we scan all sessions' omissions for the requested id.
-          const record = await findOmission(ctx, contentId);
+          const state = await loadState(ctx, context.sessionID);
+          const record = state.omissions[contentId];
           return {
             content:
-              record ??
-              `No omitted content found for Content ID: ${contentId}. It may have been cleared by a newer compaction.`,
+              record?.content ??
+              `No omitted content found for Content ID: ${contentId} in this session. It may have been cleared by a newer compaction.`,
           };
         },
       });
     });
 
-    // Context hook: apply compaction to every model request.
+    // Context hook: apply compaction to every model request. Summaries are
+    // generated at command time; here we only run the one-shot strategy/prune
+    // pass and re-apply the stored state (mutation is per-request, not persisted).
     await ctx.session.hook("context", async (event) => {
       const sessionID = (event as { sessionID?: string }).sessionID;
       if (!sessionID) return;
       const messages = (event as { messages?: unknown }).messages as Msg[] | undefined;
       if (!Array.isArray(messages)) return;
 
+      const config = await loadConfig(ctx);
+      if (!config.enabled) return;
+
       const state = await loadState(ctx, sessionID);
-      const pending = state.pending;
-      if (pending) {
-        state.pending = null;
-        await saveState(ctx, sessionID, state);
-        await runCompaction(ctx, sessionID, pending.mode, pending.keepTurns, messages);
+      if (state.pending) {
+        await runPrune(ctx, sessionID, messages, config);
       }
       const fresh = await loadState(ctx, sessionID);
       applySummaries(messages, fresh);
-      applyOmissions(messages, fresh);
+      applyOmissions(messages, fresh, config);
     });
   },
 });
-
-/** Find a cached omission by id across the plugin's stored sessions. */
-async function findOmission(ctx: Ctx, contentId: string): Promise<string | undefined> {
-  const scan = await ctx.storage.scan({ prefix: "session:" });
-  for (const entry of scan.entries) {
-    const state = entry.value as Partial<SessionState> | undefined;
-    const hit = state?.omissions?.[contentId];
-    if (hit?.content) return hit.content;
-  }
-  return undefined;
-}
diff --git a/src/plan.ts b/src/plan.ts
new file mode 100644
index 00000000..30dbb770
--- /dev/null
+++ b/src/plan.ts
@@ -0,0 +1,67 @@
+/**
+ * Turn planning: group durable session-history entries into conversation turns
+ * keyed by user-message boundaries, then select the turns eligible for
+ * summarization. Grouping by turn (not by raw assistant message) keeps
+ * multi-step tool loops intact so a tool call is never summarized away from its
+ * result.
+ */
+
+/** Minimal structural view of a durable session-history entry. */
+export interface HistoryEntry {
+  id?: string;
+  type?: string;
+  text?: string;
+  content?: ReadonlyArray<{ type?: string; text?: string; name?: string }>;
+}
+
+/** One conversation turn: the opening user text plus its assistant messages. */
+export interface Turn {
+  userText: string;
+  assistants: Array<{ id: string; text: string }>;
+}
+
+/** Reduce an assistant entry to the prose and tool names that matter for a summary. */
+function assistantText(entry: HistoryEntry): string {
+  const parts = Array.isArray(entry.content) ? entry.content : [];
+  const chunks: string[] = [];
+  for (const part of parts) {
+    if (!part || typeof part !== "object") continue;
+    if ((part.type === "text" || part.type === "reasoning") && typeof part.text === "string") {
+      chunks.push(part.text);
+    } else if (part.type === "tool" && typeof part.name === "string") {
+      chunks.push(`[tool: ${part.name}]`);
+    }
+  }
+  return chunks.join("\n").trim();
+}
+
+/** Group history entries into turns. Only a real `user` entry opens a turn. */
+export function buildTurns(entries: readonly HistoryEntry[]): Turn[] {
+  const turns: Turn[] = [];
+  let current: Turn | null = null;
+  for (const entry of entries) {
+    if (!entry || typeof entry !== "object") continue;
+    if (entry.type === "user") {
+      current = { userText: typeof entry.text === "string" ? entry.text : "", assistants: [] };
+      turns.push(current);
+      continue;
+    }
+    if (entry.type === "assistant" && typeof entry.id === "string") {
+      if (!current) {
+        current = { userText: "", assistants: [] };
+        turns.push(current);
+      }
+      current.assistants.push({ id: entry.id, text: assistantText(entry) });
+    }
+  }
+  return turns;
+}
+
+/**
+ * Select the turns to summarize: everything except the most recent `keepTurns`
+ * turns. `keepTurns <= 0` selects every turn.
+ */
+export function selectTurns(turns: Turn[], keepTurns: number): Turn[] {
+  if (keepTurns <= 0) return turns.slice();
+  return turns.slice(0, Math.max(0, turns.length - keepTurns));
+}
diff --git a/src/prune.ts b/src/prune.ts
index 1627643a..6d71bdd3 100644
--- a/src/prune.ts
+++ b/src/prune.ts
@@ -1,3 +1,4 @@
+import { DEFAULT_CONFIG, type SmartCompactConfig } from "./config.js";
 import type { Msg, OmissionRecord, Part, SessionState } from "./types.js";
 
 /** Cheap, dependency-free token estimate (~4 chars per token). */
@@ -5,14 +6,27 @@ export function estimateTokens(text: string): number {
   return Math.ceil(text.length / 4);
 }
 
-/** Tools whose completed output is always reloadable, so always prunable. */
-const ALWAYS_OMIT = new Set(["read", "write", "edit", "apply_patch", "todowrite", "skill"]);
+/** Output only worth omitting once it is large. */
+const LARGE_ONLY = new Set(["write", "edit", "apply_patch"]);
 
-/** Prune a completed tool result when it is large enough to matter. */
-export function shouldPrune(name: string | undefined, text: string): boolean {
-  if (name && ALWAYS_OMIT.has(name)) return true;
-  const words = text.trim().split(/\s+/).filter(Boolean).length;
-  return text.length > 1024 || words > 128;
+function exceeds(text: string, words: number, chars: number): boolean {
+  const count = text.trim().split(/\s+/).filter(Boolean).length;
+  return text.length > chars || count > words;
+}
+
+/** Whether a completed tool result should be pruned under the given config. */
+export function shouldPrune(
+  tool: string | undefined,
+  text: string,
+  config: SmartCompactConfig = DEFAULT_CONFIG,
+): boolean {
+  const name = tool ?? "";
+  if (config.pruning.protectedTools.includes(name)) return false;
+  if (name in config.pruning.discardTools) return false;
+  if (config.pruning.alwaysPruneTools.includes(name)) return true;
+  if (name === "task") return exceeds(text, config.pruning.taskMaxWords, config.pruning.taskMaxChars);
+  if (LARGE_ONLY.has(name)) return exceeds(text, config.pruning.maxWords, config.pruning.maxChars);
+  return exceeds(text, config.pruning.maxWords, config.pruning.maxChars);
 }
 
 /** Serialize a tool-result value to text for caching and token estimation. */
@@ -34,15 +48,30 @@ export function omissionNotice(id: string, name: string | undefined, tokens: num
   );
 }
 
+/** Allocate the next monotonic omission id and advance the counter. */
+function nextOmissionId(state: SessionState): string {
+  const id = `omitted-${String(state.nextOmissionId).padStart(4, "0")}`;
+  state.nextOmissionId += 1;
+  return id;
+}
+
+function partName(part: Part): string | undefined {
+  return typeof part.name === "string" ? part.name : undefined;
+}
+
+function partCallId(part: Part): string | undefined {
+  return typeof part.id === "string" ? part.id : undefined;
+}
+
 /**
  * Walk the model-visible messages and prune oversized tool results that have
  * not been pruned yet. Mutates the parts in place and returns the number of
- * parts pruned plus the tokens saved. Never throws: an unexpected part shape is
- * skipped.
+ * parts pruned plus the tokens saved. Never throws.
  */
 export function pruneToolResults(
   messages: Msg[],
   state: SessionState,
+  config: SmartCompactConfig = DEFAULT_CONFIG,
 ): { pruned: number; tokens: number } {
   let pruned = 0;
   let tokens = 0;
@@ -50,19 +79,25 @@ export function pruneToolResults(
     if (!Array.isArray(msg.content)) continue;
     for (const part of msg.content) {
       if (part.type !== "tool-result") continue;
-      const callId = typeof part.id === "string" ? part.id : undefined;
+      const callId = partCallId(part);
       if (!callId || state.omittedCalls[callId]) continue;
-      const name = typeof part.name === "string" ? part.name : undefined;
+      const name = partName(part);
       const result = part.result as { type?: string; value?: unknown } | undefined;
       const text = serializeResult(result?.value);
-      if (!shouldPrune(name, text)) continue;
-      const id = `omitted-${String(Object.keys(state.omissions).length + 1).padStart(4, "0")}`;
+
+      const discard = name ? config.pruning.discardTools[name] : undefined;
+      if (discard !== undefined) {
+        part.result = { type: "text", value: discard };
+        continue;
+      }
+      if (!shouldPrune(name, text, config)) continue;
+
+      const id = nextOmissionId(state);
       const saved = estimateTokens(text);
       const record: OmissionRecord = { id, callId, name, content: text, tokens: saved };
       state.omissions[id] = record;
       state.omittedCalls[callId] = id;
-      // Replace the result payload with a small text notice.
-      (part as Part).result = { type: "text", value: omissionNotice(id, name, saved) };
+      part.result = { type: "text", value: omissionNotice(id, name, saved) };
       pruned += 1;
       tokens += saved;
     }
@@ -70,18 +105,28 @@ export function pruneToolResults(
   return { pruned, tokens };
 }
 
-/** Re-apply stored omissions on every request (idempotent). */
-export function applyOmissions(messages: Msg[], state: SessionState): void {
+/** Re-apply stored omissions and discard rules on every request (idempotent). */
+export function applyOmissions(
+  messages: Msg[],
+  state: SessionState,
+  config: SmartCompactConfig = DEFAULT_CONFIG,
+): void {
   for (const msg of messages) {
     if (!Array.isArray(msg.content)) continue;
     for (const part of msg.content) {
       if (part.type !== "tool-result") continue;
-      const callId = typeof part.id === "string" ? part.id : undefined;
+      const name = partName(part);
+      const discard = name ? config.pruning.discardTools[name] : undefined;
+      if (discard !== undefined) {
+        part.result = { type: "text", value: discard };
+        continue;
+      }
+      const callId = partCallId(part);
       if (!callId) continue;
       const id = state.omittedCalls[callId];
       if (!id) continue;
       const record = state.omissions[id];
-      (part as Part).result = {
+      part.result = {
         type: "text",
         value: omissionNotice(id, record?.name, record?.tokens ?? 0),
       };
diff --git a/src/store.ts b/src/store.ts
index 874d5056..f5d43cfa 100644
--- a/src/store.ts
+++ b/src/store.ts
@@ -10,6 +10,16 @@ function key(sessionID: string): string {
   return `${PREFIX}${sessionID}`;
 }
 
+/** Derive the next omission id from stored keys (backward compatible). */
+function deriveNextOmissionId(omissions: Record<string, unknown>): number {
+  let max = 0;
+  for (const id of Object.keys(omissions)) {
+    const match = /^omitted-(\d+)$/.exec(id);
+    if (match) max = Math.max(max, Number(match[1]));
+  }
+  return max + 1;
+}
+
 /**
  * Load the persisted compaction state for a session, falling back to a fresh
  * empty state when none exists or the stored value is malformed. Storage is
@@ -19,9 +29,14 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
   const raw = await ctx.storage.get(key(sessionID));
   if (!raw || typeof raw !== "object") return emptyState();
   const value = raw as Partial<SessionState>;
+  const omissions = value.omissions ?? {};
+  const nextOmissionId =
+    typeof value.nextOmissionId === "number" && value.nextOmissionId > 0
+      ? value.nextOmissionId
+      : deriveNextOmissionId(omissions);
   return {
     summaries: value.summaries ?? {},
-    omissions: value.omissions ?? {},
+    omissions,
     omittedCalls: value.omittedCalls ?? {},
     stats: {
       prunedTokens: value.stats?.prunedTokens ?? 0,
@@ -29,6 +44,7 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
       prunedParts: value.stats?.prunedParts ?? 0,
       lastRun: value.stats?.lastRun,
     },
+    nextOmissionId,
     pending: value.pending ?? null,
   };
 }
diff --git a/src/strategies.ts b/src/strategies.ts
new file mode 100644
index 00000000..00565bd6
--- /dev/null
+++ b/src/strategies.ts
@@ -0,0 +1,151 @@
+/**
+ * Automatic context strategies, ported from the reference DCP plugin:
+ * deduplication keeps only the newest of identical tool calls, and
+ * purge-errors blanks the input of errored tool calls after a turn threshold.
+ * Both mutate the model-visible messages only and never persist anything.
+ */
+import type { SmartCompactConfig } from "./config.js";
+import { estimateTokens, serializeResult } from "./prune.js";
+import type { Msg, Part } from "./types.js";
+
+/** Deterministic stringify with sorted object keys, so equal args compare equal. */
+export function stableStringify(value: unknown): string {
+  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
+  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
+  const record = value as Record<string, unknown>;
+  const keys = Object.keys(record).sort();
+  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
+}
+
+/** Recurse and replace every string leaf with the marker, preserving structure. */
+function blankStrings(value: unknown, marker: string): unknown {
+  if (typeof value === "string") return marker;
+  if (Array.isArray(value)) return value.map((item) => blankStrings(item, marker));
+  if (value && typeof value === "object") {
+    const out: Record<string, unknown> = {};
+    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = blankStrings(v, marker);
+    return out;
+  }
+  return value;
+}
+
+/** The tool name and call id of a part, when present. */
+function name(part: Part): string | undefined {
+  return typeof part.name === "string" ? part.name : undefined;
+}
+function callId(part: Part): string | undefined {
+  return typeof part.id === "string" ? part.id : undefined;
+}
+
+/**
+ * Remove earlier duplicates of identical tool calls (same tool, same normalized
+ * arguments), keeping only the most recent output. Returns pruned parts/tokens.
+ */
+export function applyDeduplication(
+  messages: Msg[],
+  config: SmartCompactConfig,
+): { pruned: number; tokens: number } {
+  let pruned = 0;
+  let tokens = 0;
+  if (!config.strategies.deduplication.enabled) return { pruned, tokens };
+  const protectedTools = new Set(config.strategies.deduplication.protectedTools);
+
+  const inputs = new Map<string, unknown>();
+  for (const msg of messages) {
+    if (!Array.isArray(msg.content)) continue;
+    for (const part of msg.content) {
+      if (part.type === "tool-call") {
+        const id = callId(part);
+        if (id) inputs.set(id, part.input);
+      }
+    }
+  }
+
+  const results: Part[] = [];
+  for (const msg of messages) {
+    if (!Array.isArray(msg.content)) continue;
+    for (const part of msg.content) if (part.type === "tool-result") results.push(part);
+  }
+
+  const latest = new Map<string, string>();
+  const signatureOf = (part: Part): string | undefined => {
+    const id = callId(part);
+    const tool = name(part) ?? "";
+    if (!id) return undefined;
+    return `${tool}::${stableStringify(inputs.get(id) ?? null)}`;
+  };
+  for (const part of results) {
+    const tool = name(part) ?? "";
+    if (protectedTools.has(tool)) continue;
+    const signature = signatureOf(part);
+    if (signature) latest.set(signature, callId(part) ?? "");
+  }
+  for (const part of results) {
+    const tool = name(part) ?? "";
+    if (protectedTools.has(tool)) continue;
+    const signature = signatureOf(part);
+    if (!signature || latest.get(signature) === callId(part)) continue;
+    const value = (part.result as { value?: unknown } | undefined)?.value;
+    tokens += estimateTokens(serializeResult(value));
+    part.result = {
+      type: "text",
+      value: `[duplicate ${tool} output removed — see the most recent identical call]`,
+    };
+    pruned += 1;
+  }
+  return { pruned, tokens };
+}
+
+/**
+ * Blank the arguments of errored tool calls older than the configured number of
+ * turns. Error messages and the tool structure are preserved.
+ */
+export function applyPurgeErrors(
+  messages: Msg[],
+  config: SmartCompactConfig,
+): { pruned: number } {
+  let pruned = 0;
+  if (!config.strategies.purgeErrors.enabled) return { pruned };
+  const protectedTools = new Set(config.strategies.purgeErrors.protectedTools);
+  const threshold = Math.max(1, config.strategies.purgeErrors.turns);
+
+  let turn = 0;
+  const turnOf = new Map<string, number>();
+  for (const msg of messages) {
+    if (msg.role === "user") turn += 1;
+    if (!Array.isArray(msg.content)) continue;
+    for (const part of msg.content) {
+      if (part.type === "tool-call" || part.type === "tool-result") {
+        const id = callId(part);
+        if (id) turnOf.set(id, turn);
+      }
+    }
+  }
+  const currentTurn = turn;
+
+  for (const msg of messages) {
+    if (!Array.isArray(msg.content)) continue;
+    for (const part of msg.content) {
+      if (part.type !== "tool-call") continue;
+      const id = callId(part);
+      const tool = name(part) ?? "";
+      if (!id || protectedTools.has(tool)) continue;
+      if (currentTurn - (turnOf.get(id) ?? currentTurn) < threshold) continue;
+      const result = messages
+        .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
+        .find((p) => p.type === "tool-result" && callId(p) === id);
+      const errored = (result?.result as { type?: string } | undefined)?.type === "error";
+      if (!errored) continue;
+      part.input = blankStrings(part.input, "[input removed due to failed tool call]");
+      pruned += 1;
+    }
+  }
+  return { pruned };
+}
+
+/** Run every enabled strategy. */
+export function applyStrategies(messages: Msg[], config: SmartCompactConfig): { pruned: number; tokens: number } {
+  const dedup = applyDeduplication(messages, config);
+  const purge = applyPurgeErrors(messages, config);
+  return { pruned: dedup.pruned + purge.pruned, tokens: dedup.tokens };
+}
diff --git a/src/summarize.ts b/src/summarize.ts
index f3c787b7..c10ca579 100644
--- a/src/summarize.ts
+++ b/src/summarize.ts
@@ -1,59 +1,78 @@
-import { assistantTurnIds, messageText } from "./apply.js";
+import type { Turn } from "./plan.js";
 import type { Ctx } from "./store.js";
-import type { Msg, SessionState } from "./types.js";
+import type { SessionState } from "./types.js";
 
-const SUMMARY_PROMPT = (turn: string) =>
-  [
+/** Keep a single turn's prompt bounded so one giant turn cannot blow the budget. */
+const MAX_TURN_CHARS = 6000;
+
+/** Build the summarization prompt for one turn. */
+function turnPrompt(turn: Turn, body: string): string {
+  return [
     "Condense the following assistant turn from a coding session into a short, high-signal summary.",
     "Keep: what the assistant did, what it decided and why, files or commands touched, and what comes next.",
     "Drop: raw tool output, repeated reasoning, and restated user text.",
     "Write 2-4 sentences, no preamble, no bullet list.",
     "",
+    "--- USER ---",
+    turn.userText.slice(0, 500),
     "--- ASSISTANT TURN ---",
-    turn,
+    body,
     "--- END TURN ---",
   ].join("\n");
+}
+
+/** Join a turn's assistant text and tool markers, bounded for the prompt. */
+function turnBody(turn: Turn): string {
+  const body = turn.assistants
+    .map((a) => a.text)
+    .filter(Boolean)
+    .join("\n\n")
+    .trim();
+  return body.length > MAX_TURN_CHARS ? `${body.slice(0, MAX_TURN_CHARS)}\n…[truncated]` : body;
+}
+
+/** Deterministic fallback summary when the model output is empty. */
+function heuristic(body: string): string {
+  const oneLine = body.replace(/\s+/g, " ").trim();
+  return oneLine.length > 400 ? `${oneLine.slice(0, 400)}…` : oneLine;
+}
 
 /**
- * Summarize the oldest assistant turns, keeping the most recent `keepTurns`
- * untouched. Turns already summarized are skipped. Summaries are generated with
- * the session's own model through `ctx.generate.text` and stored by message id.
- * Failures are swallowed per turn so one bad turn never aborts a compaction.
+ * Summarize the eligible turns with the session's model through
+ * `ctx.generate.text` and store the result by assistant message id. The first
+ * assistant message of a turn carries the summary; the remaining ones are
+ * marked "absorbed" (empty string) so their prose is stripped without a
+ * duplicate summary. Tool-only turns are absorbed without a model call.
+ * Failures fall back to a heuristic so compaction never fails.
  */
-export async function summarizeOldTurns(
-  ctx: Ctx,
-  messages: Msg[],
-  keepTurns: number,
-  state: SessionState,
-): Promise<number> {
-  const ids = assistantTurnIds(messages);
-  const eligible = keepTurns > 0 ? ids.slice(0, Math.max(0, ids.length - keepTurns)) : ids;
-  const byId = new Map<string, Msg>();
-  for (const msg of messages) if (msg.id) byId.set(msg.id, msg);
-
+export async function summarizeTurns(ctx: Ctx, turns: Turn[], state: SessionState): Promise<number> {
   let done = 0;
-  for (const id of eligible) {
-    if (state.summaries[id]) continue;
-    const msg = byId.get(id);
-    if (!msg) continue;
-    const text = messageText(msg);
-    if (!text) {
-      // No text (e.g. a tool-only turn): mark it summarized with a terse note
-      // so it stops consuming context without an LLM round-trip.
-      state.summaries[id] = "(tool-only turn)";
+  for (const turn of turns) {
+    const first = turn.assistants[0];
+    if (!first) continue;
+    if (first.id in state.summaries) continue;
+
+    const body = turnBody(turn);
+    if (!body) {
+      for (const assistant of turn.assistants) state.summaries[assistant.id] = "";
       done += 1;
       continue;
     }
+
+    let summary = "";
     try {
-      const out = await ctx.generate.text({ prompt: SUMMARY_PROMPT(text) });
-      const summary = (out?.text ?? "").trim();
-      if (summary) {
-        state.summaries[id] = summary;
-        done += 1;
-      }
+      const out = await ctx.generate.text({ prompt: turnPrompt(turn, body) });
+      summary = (out?.text ?? "").trim();
     } catch {
-      // Leave the turn unsummarized; a later run can retry.
+      summary = "";
+    }
+    if (!summary) summary = heuristic(body);
+
+    state.summaries[first.id] = summary;
+    for (let i = 1; i < turn.assistants.length; i += 1) {
+      state.summaries[turn.assistants[i]!.id] = "";
     }
+    done += 1;
   }
   return done;
 }
diff --git a/src/types.ts b/src/types.ts
index 6fc6a7f3..e390cb7e 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -1,9 +1,9 @@
 /**
  * Structural types for the model-visible message shape OpenCode hands to a
- * `session.hook("context")` callback. These are intentionally minimal: the
- * plugin only needs `role`, `id`, and the `content` parts it can prune or
- * summarize, so it stays decoupled from the deep Effect schemas in
- * `@opencode/ai` while remaining assignable to them via a cast.
+ * `session.hook("context")` callback. Native parts are `text`, `media`,
+ * `tool-call`, `tool-result`, `reasoning`, and `compaction`
+ * (`@opencode/ai/dist/schema/messages`). These types stay intentionally
+ * minimal so the plugin remains decoupled from the deep Effect schemas.
  */
 
 /** A single content part (text, media, tool-call, tool-result, reasoning, ...). */
@@ -43,13 +43,20 @@ export interface SessionStats {
 
 /** Per-session compaction state, persisted in plugin storage. */
 export interface SessionState {
-  /** Assistant message id → its generated summary. */
+  /**
+   * Assistant message id → its generated summary. An empty string is the
+   * "absorbed" sentinel: the message's prose and reasoning are stripped without
+   * emitting a summary (used for the assistant messages after the first one in
+   * a multi-step turn).
+   */
   summaries: Record<string, string>;
   /** Omission id → cached original. */
   omissions: Record<string, OmissionRecord>;
   /** Call id → omission id, so the same result is pruned once. */
   omittedCalls: Record<string, string>;
   stats: SessionStats;
+  /** Monotonic counter for the next omission id. */
+  nextOmissionId: number;
   /** A pending command request, consumed by the next context hook. */
   pending?: { mode: "compact" | "trim"; keepTurns: number } | null;
 }
@@ -60,6 +67,7 @@ export function emptyState(): SessionState {
     omissions: {},
     omittedCalls: {},
     stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0 },
+    nextOmissionId: 1,
     pending: null,
   };
 }
diff --git a/tests/apply.test.ts b/tests/apply.test.ts
new file mode 100644
index 00000000..43ea1ce8
--- /dev/null
+++ b/tests/apply.test.ts
@@ -0,0 +1,48 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { applySummaries } from "../src/apply.js";
+import { emptyState, type Msg } from "../src/types.js";
+
+test("applySummaries preserves tool parts and replaces prose", () => {
+  const state = emptyState();
+  state.summaries["a1"] = "Read the config and edited it.";
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [
+        { type: "reasoning", text: "long reasoning" },
+        { type: "tool-call", id: "call-1", name: "read", input: {} },
+        { type: "tool-result", id: "call-1", name: "read", result: { type: "text", value: "data" } },
+        { type: "text", text: "here is my answer" },
+      ],
+    },
+  ];
+  const applied = applySummaries(messages, state);
+  assert.equal(applied, 1);
+  const types = messages[0]!.content.map((p) => p.type);
+  assert.ok(types.includes("tool-call"));
+  assert.ok(types.includes("tool-result"));
+  assert.ok(!types.includes("reasoning"));
+  const summaryPart = messages[0]!.content.find((p) => typeof p.text === "string" && p.text.includes("summarized turn"));
+  assert.ok(summaryPart);
+  assert.match(summaryPart!.text as string, /Read the config/);
+});
+
+test("applySummaries strips prose for an absorbed (empty) summary", () => {
+  const state = emptyState();
+  state.summaries["a2"] = "";
+  const messages: Msg[] = [
+    { id: "a2", role: "assistant", content: [{ type: "text", text: "extra" }, { type: "tool-call", id: "c", name: "x", input: {} }] },
+  ];
+  applySummaries(messages, state);
+  assert.deepEqual(messages[0]!.content.map((p) => p.type), ["tool-call"]);
+});
+
+test("applySummaries is idempotent", () => {
+  const state = emptyState();
+  state.summaries["a1"] = "sum";
+  const messages: Msg[] = [{ id: "a1", role: "assistant", content: [{ type: "text", text: "orig" }] }];
+  assert.equal(applySummaries(messages, state), 1);
+  assert.equal(applySummaries(messages, state), 0);
+});
diff --git a/tests/plan.test.ts b/tests/plan.test.ts
new file mode 100644
index 00000000..c0f39c7f
--- /dev/null
+++ b/tests/plan.test.ts
@@ -0,0 +1,34 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { buildTurns, selectTurns, type HistoryEntry } from "../src/plan.js";
+
+test("buildTurns groups assistant entries under the preceding user turn", () => {
+  const entries: HistoryEntry[] = [
+    { id: "u1", type: "user", text: "do a thing" },
+    { id: "a1", type: "assistant", content: [{ type: "text", text: "thinking" }, { type: "tool", name: "read" }] },
+    { id: "a2", type: "assistant", content: [{ type: "text", text: "done" }] },
+    { id: "u2", type: "user", text: "next" },
+    { id: "a3", type: "assistant", content: [{ type: "text", text: "ok" }] },
+  ];
+  const turns = buildTurns(entries);
+  assert.equal(turns.length, 2);
+  assert.equal(turns[0]!.userText, "do a thing");
+  assert.equal(turns[0]!.assistants.length, 2);
+  assert.match(turns[0]!.assistants[0]!.text, /thinking/);
+  assert.match(turns[0]!.assistants[0]!.text, /\[tool: read\]/);
+  assert.equal(turns[1]!.assistants.length, 1);
+});
+
+test("selectTurns keeps the most recent N turns", () => {
+  const turns = buildTurns([
+    { id: "u1", type: "user", text: "one" },
+    { id: "a1", type: "assistant", content: [{ type: "text", text: "x" }] },
+    { id: "u2", type: "user", text: "two" },
+    { id: "a2", type: "assistant", content: [{ type: "text", text: "y" }] },
+    { id: "u3", type: "user", text: "three" },
+    { id: "a3", type: "assistant", content: [{ type: "text", text: "z" }] },
+  ]);
+  assert.equal(selectTurns(turns, 1).length, 2);
+  assert.equal(selectTurns(turns, 0).length, 3);
+  assert.equal(selectTurns(turns, 99).length, 0);
+});
diff --git a/tests/prune.test.ts b/tests/prune.test.ts
new file mode 100644
index 00000000..62fdb983
--- /dev/null
+++ b/tests/prune.test.ts
@@ -0,0 +1,87 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import {
+  applyOmissions,
+  pruneToolResults,
+  shouldPrune,
+} from "../src/prune.js";
+import { emptyState, type Msg } from "../src/types.js";
+
+test("shouldPrune applies per-tool rules", () => {
+  assert.equal(shouldPrune("read", "short"), true);
+  assert.equal(shouldPrune("question", "x".repeat(5000)), false);
+  assert.equal(shouldPrune("todowrite", "x".repeat(5000)), false);
+  assert.equal(shouldPrune("task", "short output"), false);
+  assert.equal(shouldPrune("task", "x".repeat(5000)), true);
+  assert.equal(shouldPrune("bash", "short"), false);
+  assert.equal(shouldPrune("bash", "x".repeat(2000)), true);
+});
+
+test("pruneToolResults allocates monotonic ids and caches originals", () => {
+  const state = emptyState();
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [
+        { type: "tool-result", id: "call-1", name: "read", result: { type: "text", value: "original file text" } },
+      ],
+    },
+  ];
+  const first = pruneToolResults(messages, state);
+  assert.equal(first.pruned, 1);
+  assert.ok(state.omissions["omitted-0001"]);
+  assert.equal(state.omissions["omitted-0001"]!.content, "original file text");
+  assert.equal(state.nextOmissionId, 2);
+
+  // A second, distinct call must not reuse omitted-0001.
+  const messages2: Msg[] = [
+    {
+      id: "a2",
+      role: "assistant",
+      content: [
+        { type: "tool-result", id: "call-2", name: "read", result: { type: "text", value: "another file" } },
+      ],
+    },
+  ];
+  pruneToolResults(messages2, state);
+  assert.ok(state.omissions["omitted-0002"]);
+});
+
+test("pruneToolResults discards todowrite without caching", () => {
+  const state = emptyState();
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [
+        { type: "tool-result", id: "call-todo", name: "todowrite", result: { type: "text", value: "big todo payload" } },
+      ],
+    },
+  ];
+  pruneToolResults(messages, state);
+  assert.equal(Object.keys(state.omissions).length, 0);
+  assert.deepEqual(messages[0]!.content[0]!.result, { type: "text", value: "Successfully updated todos." });
+});
+
+test("applyOmissions replays a stored omission onto a fresh message", () => {
+  const state = emptyState();
+  state.omissions["omitted-0001"] = {
+    id: "omitted-0001",
+    callId: "call-1",
+    name: "read",
+    content: "original",
+    tokens: 2,
+  };
+  state.omittedCalls["call-1"] = "omitted-0001";
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [{ type: "tool-result", id: "call-1", name: "read", result: { type: "text", value: "original" } }],
+    },
+  ];
+  applyOmissions(messages, state);
+  const value = (messages[0]!.content[0]!.result as { value: string }).value;
+  assert.match(value, /omitted-0001/);
+});
diff --git a/tests/strategies.test.ts b/tests/strategies.test.ts
new file mode 100644
index 00000000..71dcc43d
--- /dev/null
+++ b/tests/strategies.test.ts
@@ -0,0 +1,64 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { DEFAULT_CONFIG } from "../src/config.js";
+import { applyDeduplication, applyPurgeErrors, stableStringify } from "../src/strategies.js";
+import type { Msg } from "../src/types.js";
+
+function toolCall(id: string, name: string, input: unknown) {
+  return { type: "tool-call", id, name, input };
+}
+function toolResult(id: string, name: string, value: unknown, error = false) {
+  return { type: "tool-result", id, name, result: { type: error ? "error" : "text", value } };
+}
+
+test("stableStringify sorts keys so equal args compare equal", () => {
+  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
+});
+
+test("applyDeduplication keeps the latest identical call", () => {
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [toolCall("c1", "read", { path: "x" }), toolResult("c1", "read", "first")],
+    },
+    {
+      id: "a2",
+      role: "assistant",
+      content: [toolCall("c2", "read", { path: "x" }), toolResult("c2", "read", "second")],
+    },
+  ];
+  const result = applyDeduplication(messages, DEFAULT_CONFIG);
+  assert.equal(result.pruned, 1);
+  assert.match((messages[0]!.content[1]!.result as { value: string }).value, /duplicate read output removed/);
+  assert.equal((messages[1]!.content[1]!.result as { value: string }).value, "second");
+});
+
+test("applyDeduplication leaves distinct calls alone", () => {
+  const messages: Msg[] = [
+    { id: "a1", role: "assistant", content: [toolCall("c1", "read", { path: "x" }), toolResult("c1", "read", "one")] },
+    { id: "a2", role: "assistant", content: [toolCall("c2", "read", { path: "y" }), toolResult("c2", "read", "two")] },
+  ];
+  assert.equal(applyDeduplication(messages, DEFAULT_CONFIG).pruned, 0);
+});
+
+test("applyPurgeErrors blanks errored tool input after the threshold", () => {
+  const messages: Msg[] = [
+    { id: "u1", role: "user", content: [{ type: "text", text: "go" }] },
+    { id: "a1", role: "assistant", content: [toolCall("c1", "bash", { command: "ls" }), toolResult("c1", "bash", "boom", true)] },
+  ];
+  for (let i = 0; i < 5; i += 1) {
+    messages.push({ id: `u${i + 2}`, role: "user", content: [{ type: "text", text: "more" }] });
+  }
+  const result = applyPurgeErrors(messages, DEFAULT_CONFIG);
+  assert.equal(result.pruned, 1);
+  assert.deepEqual(messages[1]!.content[0]!.input, { command: "[input removed due to failed tool call]" });
+});
+
+test("applyPurgeErrors ignores recent errored calls", () => {
+  const messages: Msg[] = [
+    { id: "u1", role: "user", content: [{ type: "text", text: "go" }] },
+    { id: "a1", role: "assistant", content: [toolCall("c1", "bash", { command: "ls" }), toolResult("c1", "bash", "boom", true)] },
+  ];
+  assert.equal(applyPurgeErrors(messages, DEFAULT_CONFIG).pruned, 0);
+});
diff --git a/tsconfig.test.json b/tsconfig.test.json
new file mode 100644
index 00000000..52c86659
--- /dev/null
+++ b/tsconfig.test.json
@@ -0,0 +1,16 @@
+{
+  "compilerOptions": {
+    "target": "ES2022",
+    "module": "NodeNext",
+    "moduleResolution": "NodeNext",
+    "lib": ["ES2023"],
+    "strict": true,
+    "noEmit": false,
+    "declaration": false,
+    "skipLibCheck": true,
+    "types": ["node"],
+    "outDir": ".test-build",
+    "rootDir": "."
+  },
+  "include": ["src", "tests"]
+}
```
<!-- END_GIT_DIFF -->
