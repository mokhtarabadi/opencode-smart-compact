# Task 10: Apply portable ACP lessons to smart-compact

**File:** `tasks/qa/10-acp-lessons-application.md`
**Source:** manager
**Type:** improvement
**Status:** in-progress

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
- [ ] `lint_task_file` passes on the active task file — ✅ passed pre-transition (re-lint after qa move below)
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

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 29f3029b..3cfc90de 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -9,6 +9,12 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 ### Added
 
 - `compact_context` tool: the agent can compress the session itself (summarize now, schedule pruning) instead of waiting for the Manager to run a slash command. Takes optional `keepTurns` and `mode` (`compact`/`trim`); invalid input returns a friendly message. Shared logic lives in `src/actions.ts` and backs both the tool and the `/magic-compact` / `/magic-trim` commands, so the paths cannot drift.
+- Token measurement module (`src/tokens.ts`): tokenizer-first counting with a dependency-free fallback, used only on explicit command paths; no new dependency.
+- Preserve-recent window plus truncate-tools bounds in the prune pass: recent turns and the last user message always keep full text, over-long results are cached in full with a notice.
+- Reasoning strip strategy plus fail-closed restore: long reasoning parts are replaced with a marker (protected tools exempt), and a cleared cache reports its missing Content ID instead of restoring a phantom.
+- Config validation warnings naming exact key paths, plus an emergency budget guard that aborts over-budget runs.
+- Prune memo gate keyed by call id plus content hash, with memo-saved tokens, last-run time, and tokenizer flag surfaced in `/magic-stats`.
+- QA hardening: the emergency budget guard now aborts over-budget runs in both entry paths without mutating stored state; the preserve window feeds the summarization path; the optional tokenizer loads under ESM as well as CJS; the truncate cap never bites below the task bar; the memo hash covers the full text.
 
 - Phase 0 bootstrap: Kanban dirs (`tasks/backlog`, `in-progress`, `qa`, `completed`, `archive`), `AGENTS.md` project hub, `docs/conventions.md` standards, validated `opencode.json` project config.
 - Turn-based compaction planning (`src/plan.ts`) that groups history by user boundary.
diff --git a/README.md b/README.md
index 530ae817..719c097f 100644
--- a/README.md
+++ b/README.md
@@ -69,16 +69,21 @@ Compaction is scheduled by the command and applied on the next model request.
 ## Pruning rules
 
 - Completed tool results over the configured size limit (default 1024 chars / 128 words) are pruned to a notice; the original is cached.
+- With `pruning.useTokens`, the word thresholds double as token budgets and measured tokens decide instead of chars/words.
+- The preserve-recent window (default last 2 turns, plus always the last user message) keeps full text; sessions with no user message get no window.
+- Results over `truncateToolsChars` (default 1024) are pruned even under the size limit; `task` keeps its higher bar and is never capped below `taskMaxChars`.
 - `read` output is always pruned (reloadable).
 - `task` output uses a higher bar (default 4096 chars / 512 words).
-- `question` output is never pruned (it captures an explicit user decision).
+- `question` output is never pruned (it captures an explicit user decision); `write`, `edit`, and plan tools can join the protected list via config only.
 - `todowrite` and `skill` output is replaced with a short notice and not cached (redundant or reloadable).
 - Pending and errored calls are never pruned.
+- A pruned result whose cached original was cleared by a newer compaction fails closed: the notice names the missing Content ID and asks for a rerun instead of restoring a phantom.
 
 ## Automatic strategies
 
 - **Deduplication** — identical tool calls (same tool, same normalized arguments) keep only their most recent output; earlier ones are replaced with a notice.
 - **Purge errors** — the arguments of errored tool calls are blanked after a configurable number of turns. Error text is preserved.
+- **Reasoning strip** — reasoning parts over `thresholdChars` (default 500) are replaced with a marker. Messages carrying a protected tool keep their reasoning.
 
 Both run as part of the scheduled compaction pass.
 
@@ -104,15 +109,22 @@ Defaults are applied automatically; only override what you need.
     "discardTools": {
       "todowrite": "Successfully updated todos.",
       "skill": "Skill contents omitted after compaction; recall the skill if needed."
-    }
+    },
+    "preserveRecentTurns": 2,
+    "truncateToolsChars": 1024,
+    "useTokens": false
   },
   "strategies": {
     "deduplication": { "enabled": true, "protectedTools": ["question"] },
-    "purgeErrors": { "enabled": true, "turns": 4, "protectedTools": ["question"] }
-  }
+    "purgeErrors": { "enabled": true, "turns": 4, "protectedTools": ["question"] },
+    "stripReasoning": { "enabled": true, "thresholdChars": 500 }
+  },
+  "tokens": { "enabled": false, "emergencyBudgetTokens": 50000 }
 }
 ```
 
+`tokens.enabled` routes measurements through the optional `@anthropic-ai/tokenizer` package when installed, with the built-in estimate as fallback. Unknown config keys produce a warning naming the exact key path. When measured cost exceeds `emergencyBudgetTokens` (0 disables), the run aborts and state is left unchanged. `/magic-stats` also reports memo-saved tokens, last-run time, and whether the tokenizer backed the run.
+
 ## Comparison
 
 Compared with runtime context managers that compress inside the agent loop, Smart Compact is deliberately explicit: it compacts once on your command, preserves user messages verbatim, keeps tool structure, and does not inject recurring prompts into every turn. The trade-off is that compaction is user-driven rather than automatic.
diff --git a/src/actions.ts b/src/actions.ts
index cdd941e7..89f05626 100644
--- a/src/actions.ts
+++ b/src/actions.ts
@@ -5,6 +5,8 @@
  */
 import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
 import { summarizeTurns } from "./summarize.js";
+import { checkBudgetGuard, loadConfig } from "./config.js";
+import { measureTokens } from "./prune.js";
 import { loadState, saveState, type Ctx } from "./store.js";
 
 export type CompactMode = "compact" | "trim";
@@ -41,18 +43,54 @@ export function parseCompactArgs(input: unknown): CompactArgs {
  * Summarize the eligible turns now (each becomes a short summary; user
  * messages stay verbatim) and schedule the tool-output prune pass for the next
  * request. Returns the number of turns summarized.
+ *
+ * The emergency budget guard runs before any work: an over-budget history
+ * aborts with a warning and the stored state is left unchanged (returns 0,
+ * nothing saved). A zero budget disables the guard.
  */
 export async function compactNow(ctx: Ctx, sessionID: string, keepTurns: number): Promise<number> {
+  const config = await loadConfig(ctx);
   const state = await loadState(ctx, sessionID);
   const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
+  if (checkBudgetGuard(measureHistoryCost(entries, config), config)) {
+    console.warn(
+      `[smart-compact] compaction aborted: history exceeds the emergency budget of ` +
+        `${config.tokens.emergencyBudgetTokens} tokens. Raise tokens.emergencyBudgetTokens (0 disables) and rerun.`,
+    );
+    return 0;
+  }
   const turns = buildTurns(entries);
-  const summarized = await summarizeTurns(ctx, selectTurns(turns, keepTurns), state);
+  const summarized = await summarizeTurns(
+    ctx,
+    selectTurns(turns, keepTurns, config.pruning.preserveRecentTurns),
+    state,
+  );
   state.stats.summarizedTurns += summarized;
   state.pending = { mode: "compact", keepTurns };
   await saveState(ctx, sessionID, state);
   return summarized;
 }
 
+/**
+ * Measured token cost of the durable history entries awaiting summarization.
+ * Read-only: never mutates entries or state.
+ */
+function measureHistoryCost(
+  entries: readonly HistoryEntry[],
+  config: Parameters<typeof measureTokens>[1],
+): number {
+  let total = 0;
+  for (const entry of entries) {
+    if (!entry || typeof entry !== "object") continue;
+    if (typeof entry.text === "string") total += measureTokens(entry.text, config);
+    const parts = Array.isArray(entry.content) ? entry.content : [];
+    for (const part of parts) {
+      if (part && typeof part.text === "string") total += measureTokens(part.text, config);
+    }
+  }
+  return total;
+}
+
 /** Schedule a tool-output-only prune for the next request, without summarizing. */
 export async function scheduleTrim(ctx: Ctx, sessionID: string, keepTurns: number): Promise<void> {
   const state = await loadState(ctx, sessionID);
diff --git a/src/config.ts b/src/config.ts
index 6d0f09ce..c02480ce 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -16,17 +16,33 @@ export interface PruningConfig {
   protectedTools: string[];
   alwaysPruneTools: string[];
   discardTools: Record<string, string>;
+  /** Recent turns that are never pruned, on top of the last user message. */
+  preserveRecentTurns: number;
+  /** Tool result texts longer than this are truncated with a cached record. */
+  truncateToolsChars: number;
+  /** Route prune measurements through the tokenizer module when true. */
+  useTokens: boolean;
 }
 
 export interface StrategiesConfig {
   deduplication: { enabled: boolean; protectedTools: string[] };
   purgeErrors: { enabled: boolean; turns: number; protectedTools: string[] };
+  /** Drop reasoning parts over the threshold while keeping error text. */
+  stripReasoning: { enabled: boolean; thresholdChars: number };
+}
+
+export interface TokensConfig {
+  /** Enable measured counting; false keeps the dependency-free fallback. */
+  enabled: boolean;
+  /** Abort a compaction run above this measured cost. 0 disables the guard. */
+  emergencyBudgetTokens: number;
 }
 
 export interface SmartCompactConfig {
   enabled: boolean;
   pruning: PruningConfig;
   strategies: StrategiesConfig;
+  tokens: TokensConfig;
 }
 
 export const DEFAULT_CONFIG: SmartCompactConfig = {
@@ -42,11 +58,16 @@ export const DEFAULT_CONFIG: SmartCompactConfig = {
       todowrite: "Successfully updated todos.",
       skill: "Skill contents omitted after compaction; recall the skill if needed.",
     },
+    preserveRecentTurns: 2,
+    truncateToolsChars: 1024,
+    useTokens: false,
   },
   strategies: {
     deduplication: { enabled: true, protectedTools: ["question"] },
     purgeErrors: { enabled: true, turns: 4, protectedTools: ["question"] },
+    stripReasoning: { enabled: true, thresholdChars: 500 },
   },
+  tokens: { enabled: false, emergencyBudgetTokens: 50000 },
 };
 
 /** Strip JSONC comments and trailing commas. Best-effort; never throws. */
@@ -95,8 +116,10 @@ function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConf
   if (!p) return base;
   const pruning = asRecord(p.pruning);
   const strategies = asRecord(p.strategies);
+  const tokens = asRecord(p.tokens);
   const dedup = asRecord(strategies?.deduplication);
   const purge = asRecord(strategies?.purgeErrors);
+  const strip = asRecord(strategies?.stripReasoning);
   return {
     enabled: typeof p.enabled === "boolean" ? p.enabled : base.enabled,
     pruning: {
@@ -111,6 +134,15 @@ function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConf
         ? (pruning.alwaysPruneTools as string[])
         : base.pruning.alwaysPruneTools,
       discardTools: { ...base.pruning.discardTools, ...(asRecord(pruning?.discardTools) as Record<string, string> | undefined) },
+      preserveRecentTurns:
+        typeof pruning?.preserveRecentTurns === "number"
+          ? pruning.preserveRecentTurns
+          : base.pruning.preserveRecentTurns,
+      truncateToolsChars:
+        typeof pruning?.truncateToolsChars === "number"
+          ? pruning.truncateToolsChars
+          : base.pruning.truncateToolsChars,
+      useTokens: typeof pruning?.useTokens === "boolean" ? pruning.useTokens : base.pruning.useTokens,
     },
     strategies: {
       deduplication: {
@@ -126,10 +158,91 @@ function mergeConfig(base: SmartCompactConfig, patch: unknown): SmartCompactConf
           ? (purge.protectedTools as string[])
           : base.strategies.purgeErrors.protectedTools,
       },
+      stripReasoning: {
+        enabled: typeof strip?.enabled === "boolean" ? strip.enabled : base.strategies.stripReasoning.enabled,
+        thresholdChars:
+          typeof strip?.thresholdChars === "number" ? strip.thresholdChars : base.strategies.stripReasoning.thresholdChars,
+      },
+    },
+    tokens: {
+      enabled: typeof tokens?.enabled === "boolean" ? tokens.enabled : base.tokens.enabled,
+      emergencyBudgetTokens:
+        typeof tokens?.emergencyBudgetTokens === "number"
+          ? tokens.emergencyBudgetTokens
+          : base.tokens.emergencyBudgetTokens,
     },
   };
 }
 
+/** Every known config key by section, used to warn on typos. */
+const KNOWN_KEYS: Record<string, readonly string[]> = {
+  "": ["enabled", "pruning", "strategies", "tokens"],
+  pruning: [
+    "maxChars",
+    "maxWords",
+    "taskMaxChars",
+    "taskMaxWords",
+    "protectedTools",
+    "alwaysPruneTools",
+    "discardTools",
+    "preserveRecentTurns",
+    "truncateToolsChars",
+    "useTokens",
+  ],
+  strategies: ["deduplication", "purgeErrors", "stripReasoning"],
+  "strategies.deduplication": ["enabled", "protectedTools"],
+  "strategies.purgeErrors": ["enabled", "turns", "protectedTools"],
+  "strategies.stripReasoning": ["enabled", "thresholdChars"],
+  tokens: ["enabled", "emergencyBudgetTokens"],
+};
+
+/** Collect one warning per unknown key, naming its exact dotted path. */
+function collectUnknown(record: Record<string, unknown>, section: string, out: string[]): void {
+  for (const key of Object.keys(record)) {
+    const known = KNOWN_KEYS[section] ?? [];
+    if (!known.includes(key)) {
+      out.push(`Unknown config key: ${section ? `${section}.` : ""}${key}`);
+    }
+  }
+}
+
+/**
+ * Validate a raw config object and return a warning per unknown key, each
+ * naming its exact dotted path (e.g. `pruning.nope`). Returns an empty
+ * array for valid or non-object input — callers surface warnings visibly
+ * instead of silently ignoring typos.
+ */
+export function validateConfig(raw: unknown): string[] {
+  const warnings: string[] = [];
+  const root = asRecord(raw);
+  if (!root) return warnings;
+  collectUnknown(root, "", warnings);
+  const pruning = asRecord(root.pruning);
+  if (pruning) collectUnknown(pruning, "pruning", warnings);
+  const strategies = asRecord(root.strategies);
+  if (strategies) {
+    collectUnknown(strategies, "strategies", warnings);
+    for (const child of ["deduplication", "purgeErrors", "stripReasoning"]) {
+      const section = asRecord(strategies[child]);
+      if (section) collectUnknown(section, `strategies.${child}`, warnings);
+    }
+  }
+  const tokens = asRecord(root.tokens);
+  if (tokens) collectUnknown(tokens, "tokens", warnings);
+  return warnings;
+}
+
+/**
+ * Whether a compaction run must abort: true when the measured token cost
+ * exceeds the configured emergency budget. A budget of 0 disables the
+ * guard explicitly, and state is left unchanged on abort.
+ */
+export function checkBudgetGuard(measuredTokens: number, config: SmartCompactConfig): boolean {
+  const budget = config.tokens.emergencyBudgetTokens;
+  if (typeof budget !== "number" || budget <= 0) return false;
+  return measuredTokens > budget;
+}
+
 async function readConfigFile(path: string): Promise<unknown | undefined> {
   try {
     const text = await readFile(path, "utf8");
@@ -149,11 +262,17 @@ export function globalConfigPath(): string {
 export async function loadConfig(ctx: Ctx): Promise<SmartCompactConfig> {
   let config = DEFAULT_CONFIG;
   const global = await readConfigFile(globalConfigPath());
-  if (global) config = mergeConfig(config, global);
+  if (global) {
+    for (const warning of validateConfig(global)) console.warn(`[smart-compact] ${warning} (global config)`);
+    config = mergeConfig(config, global);
+  }
   const directory = (ctx.location as { directory?: string }).directory;
   if (directory) {
     const project = await readConfigFile(join(directory, ".opencode", "smart-compact.jsonc"));
-    if (project) config = mergeConfig(config, project);
+    if (project) {
+      for (const warning of validateConfig(project)) console.warn(`[smart-compact] ${warning} (project config)`);
+      config = mergeConfig(config, project);
+    }
   }
   return config;
 }
diff --git a/src/index.ts b/src/index.ts
index 254444c9..9a4d14f6 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -12,10 +12,11 @@
 import { Plugin } from "@opencode/plugin";
 import { compactNow, parseCompactArgs, scheduleTrim } from "./actions.js";
 import { applySummaries } from "./apply.js";
-import { applyOmissions, pruneToolResults } from "./prune.js";
+import { applyOmissions, measureTokens, pruneToolResults, serializeResult } from "./prune.js";
 import { applyStrategies } from "./strategies.js";
-import { loadConfig, type SmartCompactConfig } from "./config.js";
+import { checkBudgetGuard, loadConfig, type SmartCompactConfig } from "./config.js";
 import { loadState, saveState, type Ctx } from "./store.js";
+import { isTokenizerAvailable } from "./tokens.js";
 import type { Msg, SessionState } from "./types.js";
 
 const COMPACT = "magic-compact";
@@ -50,17 +51,51 @@ async function runPrune(
   messages: Msg[],
   config: SmartCompactConfig,
 ): Promise<SessionState> {
+  const started = Date.now();
   const state = await loadState(ctx, sessionID);
+  // Emergency budget guard runs before any mutation: an over-budget context
+  // aborts with a visible message and the stored state is left unchanged
+  // (no strategies applied, no save). A zero budget disables the guard.
+  const measured = measureVisibleCost(messages, config);
+  if (checkBudgetGuard(measured, config)) {
+    const text =
+      `[smart-compact] compaction aborted: measured ~${measured} tokens exceeds ` +
+      `the emergency budget of ${config.tokens.emergencyBudgetTokens} tokens. ` +
+      `Raise tokens.emergencyBudgetTokens (0 disables) and rerun.`;
+    console.warn(text);
+    await notify(ctx, sessionID, text);
+    return state;
+  }
   const strategies = applyStrategies(messages, config);
   const pruned = pruneToolResults(messages, state, config);
   state.stats.prunedParts += pruned.pruned + strategies.pruned;
   state.stats.prunedTokens += pruned.tokens + strategies.tokens;
+  state.stats.savedTokens += pruned.memoTokens;
   state.stats.lastRun = Date.now();
+  state.stats.lastRunMs = Date.now() - started;
+  state.stats.tokenizerUsed = isTokenizerAvailable();
   state.pending = null;
   await saveState(ctx, sessionID, state);
   return state;
 }
 
+/**
+ * Measured token cost of the model-visible tool results awaiting the prune
+ * pass. Read-only: never mutates messages or state.
+ */
+function measureVisibleCost(messages: Msg[], config: SmartCompactConfig): number {
+  let total = 0;
+  for (const msg of messages) {
+    if (!Array.isArray(msg.content)) continue;
+    for (const part of msg.content) {
+      if (part.type !== "tool-result") continue;
+      const result = part.result as { value?: unknown } | undefined;
+      total += measureTokens(serializeResult(result?.value), config);
+    }
+  }
+  return total;
+}
+
 export default Plugin.define({
   id: "smart-compact",
   async setup(ctx) {
@@ -95,7 +130,9 @@ export default Plugin.define({
           const s = state.stats;
           const text =
             `[smart-compact] pruned ~${s.prunedTokens} tokens across ${s.prunedParts} tool results; ` +
-            `summarized ${s.summarizedTurns} turns; ${Object.keys(state.omissions).length} cached omissions.`;
+            `summarized ${s.summarizedTurns} turns; ${Object.keys(state.omissions).length} cached omissions; ` +
+            `memo-saved ~${s.savedTokens ?? 0} tokens; last run ${s.lastRunMs ?? 0}ms; ` +
+            `tokenizer ${s.tokenizerUsed ? "on" : "off"}.`;
           console.log(text);
           await notify(ctx, sessionID, text);
         },
@@ -125,7 +162,8 @@ export default Plugin.define({
           return {
             content:
               record?.content ??
-              `No omitted content found for Content ID: ${contentId} in this session. It may have been cleared by a newer compaction.`,
+              `No omitted content found for Content ID: ${contentId} in this session. ` +
+                `It was cleared by a newer compaction — rerun the tool to reproduce the output instead of trusting a restore.`,
           };
         },
       });
diff --git a/src/plan.ts b/src/plan.ts
index 30dbb770..88a87fa5 100644
--- a/src/plan.ts
+++ b/src/plan.ts
@@ -59,9 +59,12 @@ export function buildTurns(entries: readonly HistoryEntry[]): Turn[] {
 
 /**
  * Select the turns to summarize: everything except the most recent `keepTurns`
- * turns. `keepTurns <= 0` selects every turn.
+ * turns and the preserved recent window. `keepTurns <= 0` with no preserved
+ * window selects every turn. The preserved tail always contains the last user
+ * message, so recent context (including the latest request) is never eligible.
  */
-export function selectTurns(turns: Turn[], keepTurns: number): Turn[] {
-  if (keepTurns <= 0) return turns.slice();
-  return turns.slice(0, Math.max(0, turns.length - keepTurns));
+export function selectTurns(turns: Turn[], keepTurns: number, preserveRecentTurns = 0): Turn[] {
+  if (keepTurns <= 0 && preserveRecentTurns <= 0) return turns.slice();
+  const cut = Math.max(0, keepTurns) + Math.max(0, preserveRecentTurns);
+  return turns.slice(0, Math.max(0, turns.length - cut));
 }
diff --git a/src/prune.ts b/src/prune.ts
index 7d932e00..1f9ec89d 100644
--- a/src/prune.ts
+++ b/src/prune.ts
@@ -1,4 +1,5 @@
 import { DEFAULT_CONFIG, type SmartCompactConfig } from "./config.js";
+import { countTokens } from "./tokens.js";
 import type { Msg, OmissionRecord, Part, SessionState } from "./types.js";
 
 /** Cheap, dependency-free token estimate (~4 chars per token). */
@@ -6,12 +7,26 @@ export function estimateTokens(text: string): number {
   return Math.ceil(text.length / 4);
 }
 
+/**
+ * Measure the token cost of a tool result. Routes through the tokenizer
+ * module when token measurement is enabled, otherwise uses the
+ * dependency-free estimate. Both paths agree for plain text; the tokenizer
+ * wins on real model tokenization when installed.
+ */
+export function measureTokens(text: string, config: SmartCompactConfig = DEFAULT_CONFIG): number {
+  return countTokens(text, config.tokens.enabled);
+}
+
 function exceeds(text: string, words: number, chars: number): boolean {
   const count = text.trim().split(/\s+/).filter(Boolean).length;
   return text.length > chars || count > words;
 }
 
-/** Whether a completed tool result should be pruned under the given config. */
+/**
+ * Whether a completed tool result should be pruned under the given config.
+ * With `pruning.useTokens`, the word thresholds double as token budgets and
+ * the measured token count decides; otherwise the chars/words check decides.
+ */
 export function shouldPrune(
   tool: string | undefined,
   text: string,
@@ -21,6 +36,11 @@ export function shouldPrune(
   if (config.pruning.protectedTools.includes(name)) return false;
   if (name in config.pruning.discardTools) return false;
   if (config.pruning.alwaysPruneTools.includes(name)) return true;
+  if (config.pruning.useTokens) {
+    const measured = measureTokens(text, config);
+    if (name === "task") return measured > config.pruning.taskMaxWords;
+    return measured > config.pruning.maxWords;
+  }
   if (name === "task") return exceeds(text, config.pruning.taskMaxWords, config.pruning.taskMaxChars);
   return exceeds(text, config.pruning.maxWords, config.pruning.maxChars);
 }
@@ -59,19 +79,103 @@ function partCallId(part: Part): string | undefined {
   return typeof part.id === "string" ? part.id : undefined;
 }
 
+/**
+ * Small content hash over the entire string plus a length prefix. Any edit —
+ * including one in the middle — changes the hash and invalidates the memo.
+ */
+export function memoHash(text: string): string {
+  let hash = 5381;
+  for (let i = 0; i < text.length; i += 1) {
+    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
+  }
+  return `${text.length}:${(hash >>> 0).toString(36)}`;
+}
+
+/** Whether a tool result is small enough to measure directly, memo aside. */
+function isSmallInput(text: string, config: SmartCompactConfig, tool?: string): boolean {
+  if (config.pruning.useTokens) {
+    // Token-heavy text (even a single long word) is never "small" here:
+    // the measured cost decides against the token budget for its tool.
+    const budget = (tool ?? "") === "task" ? config.pruning.taskMaxWords : config.pruning.maxWords;
+    return measureTokens(text, config) <= budget;
+  }
+  if (text.length > config.pruning.maxChars) return false;
+  return text.trim().split(/\s+/).filter(Boolean).length <= config.pruning.maxWords;
+}
+
+/**
+ * Measure a tool result for one call id, reusing the memoized cost when the
+ * content hash matches. Small inputs bypass the memo entirely — measuring
+ * them directly is cheaper than bookkeeping. Returns the token cost and
+ * whether the memo supplied it.
+ */
+export function measureMemoized(
+  callId: string,
+  text: string,
+  config: SmartCompactConfig,
+  state: SessionState,
+  tool?: string,
+): { tokens: number; hit: boolean } {
+  if (isSmallInput(text, config, tool)) return { tokens: measureTokens(text, config), hit: false };
+  const hash = memoHash(text);
+  const entry = state.pruneMemo[callId];
+  if (entry && entry.hash === hash) return { tokens: entry.tokens, hit: true };
+  const tokens = measureTokens(text, config);
+  state.pruneMemo[callId] = { hash, tokens };
+  return { tokens, hit: false };
+}
+
+/**
+ * Effective truncate cap for one tool. `task` keeps its higher bar: the cap
+ * never bites below `taskMaxChars`. A non-positive `truncateToolsChars`
+ * disables the cap for every tool.
+ */
+export function truncateLimit(tool: string | undefined, config: SmartCompactConfig): number {
+  if (config.pruning.truncateToolsChars <= 0) return 0;
+  if ((tool ?? "") === "task") {
+    return Math.max(config.pruning.truncateToolsChars, config.pruning.taskMaxChars);
+  }
+  return config.pruning.truncateToolsChars;
+}
+/**
+ * Message indices inside the preserve-recent window: from the Nth-last user
+ * message onward, where N is at least 1 so the last user message is always
+ * kept. Sessions with no user message get no window (nothing is recent).
+ */
+export function preserveWindow(messages: Msg[], preserveRecentTurns: number): Set<number> {
+  const users: number[] = [];
+  messages.forEach((msg, index) => {
+    if (msg.role === "user") users.push(index);
+  });
+  if (users.length === 0) return new Set();
+  const keep = Math.max(1, preserveRecentTurns);
+  const start = users[Math.max(0, users.length - keep)]!;
+  const window = new Set<number>();
+  for (let i = start; i < messages.length; i += 1) window.add(i);
+  return window;
+}
+
 /**
  * Walk the model-visible messages and prune oversized tool results that have
  * not been pruned yet. Mutates the parts in place and returns the number of
  * parts pruned plus the tokens saved. Never throws.
+ *
+ * The preserve-recent window is checked before any prune decision: results
+ * inside the window keep their full text. Over-long results outside the
+ * window hit the truncate cap and are cached in full with an omission notice.
  */
 export function pruneToolResults(
   messages: Msg[],
   state: SessionState,
   config: SmartCompactConfig = DEFAULT_CONFIG,
-): { pruned: number; tokens: number } {
+): { pruned: number; tokens: number; memoHits: number; memoTokens: number } {
   let pruned = 0;
   let tokens = 0;
-  for (const msg of messages) {
+  let memoHits = 0;
+  let memoTokens = 0;
+  const kept = preserveWindow(messages, config.pruning.preserveRecentTurns);
+  for (let index = 0; index < messages.length; index += 1) {
+    const msg = messages[index]!;
     if (!Array.isArray(msg.content)) continue;
     for (const part of msg.content) {
       if (part.type !== "tool-result") continue;
@@ -86,10 +190,24 @@ export function pruneToolResults(
         part.result = { type: "text", value: discard };
         continue;
       }
-      if (!shouldPrune(name, text, config)) continue;
+      // The recent window always keeps full text, including the last request.
+      if (kept.has(index)) continue;
+      // The truncate cap is an extra trigger beside shouldPrune; task keeps
+      // its higher bar so ordinary task output is not capped early. A
+      // non-positive limit disables the cap for every tool.
+      const cap = truncateLimit(name, config);
+      const overTruncateCap = cap > 0 && text.length > cap;
+      if (!shouldPrune(name, text, config) && !overTruncateCap) continue;
 
       const id = nextOmissionId(state);
-      const saved = estimateTokens(text);
+      // Reuse the memoized measurement when the content is unchanged; the
+      // memo only ever affects the reported cost, never the prune decision.
+      const measured = measureMemoized(callId, text, config, state, name);
+      const saved = measured.tokens;
+      if (measured.hit) {
+        memoHits += 1;
+        memoTokens += saved;
+      }
       const record: OmissionRecord = { id, callId, name, content: text, tokens: saved };
       state.omissions[id] = record;
       state.omittedCalls[callId] = id;
@@ -98,7 +216,7 @@ export function pruneToolResults(
       tokens += saved;
     }
   }
-  return { pruned, tokens };
+  return { pruned, tokens, memoHits, memoTokens };
 }
 
 /** Re-apply stored omissions and discard rules on every request (idempotent). */
@@ -122,10 +240,29 @@ export function applyOmissions(
       const id = state.omittedCalls[callId];
       if (!id) continue;
       const record = state.omissions[id];
+      // Fail closed: a mapping without its cached original means a newer
+      // compaction cleared the cache. Say so plainly instead of replaying a
+      // phantom notice with zero tokens.
+      if (!record) {
+        part.result = { type: "text", value: missingOmissionNotice(id) };
+        continue;
+      }
       part.result = {
         type: "text",
-        value: omissionNotice(id, record?.name, record?.tokens ?? 0),
+        value: omissionNotice(id, record.name, record.tokens),
       };
     }
   }
 }
+
+/**
+ * Fail-closed notice for a pruned result whose cached original is gone
+ * (cleared by a newer compaction). Names the missing id and tells the
+ * reader to rerun the tool instead of trusting a phantom restore.
+ */
+export function missingOmissionNotice(id: string): string {
+  return (
+    `[omitted tool output unavailable — the cached original for Content ID: ${id} ` +
+    `was cleared by a newer compaction. Rerun the tool to reproduce it.]`
+  );
+}
diff --git a/src/store.ts b/src/store.ts
index f5d43cfa..ebbb06ae 100644
--- a/src/store.ts
+++ b/src/store.ts
@@ -42,9 +42,13 @@ export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionSta
       prunedTokens: value.stats?.prunedTokens ?? 0,
       summarizedTurns: value.stats?.summarizedTurns ?? 0,
       prunedParts: value.stats?.prunedParts ?? 0,
+      savedTokens: value.stats?.savedTokens ?? 0,
       lastRun: value.stats?.lastRun,
+      lastRunMs: value.stats?.lastRunMs,
+      tokenizerUsed: value.stats?.tokenizerUsed,
     },
     nextOmissionId,
+    pruneMemo: value.pruneMemo ?? {},
     pending: value.pending ?? null,
   };
 }
diff --git a/src/strategies.ts b/src/strategies.ts
index 00565bd6..4b1bf9d3 100644
--- a/src/strategies.ts
+++ b/src/strategies.ts
@@ -5,7 +5,7 @@
  * Both mutate the model-visible messages only and never persist anything.
  */
 import type { SmartCompactConfig } from "./config.js";
-import { estimateTokens, serializeResult } from "./prune.js";
+import { estimateTokens, measureTokens, serializeResult } from "./prune.js";
 import type { Msg, Part } from "./types.js";
 
 /** Deterministic stringify with sorted object keys, so equal args compare equal. */
@@ -143,9 +143,53 @@ export function applyPurgeErrors(
   return { pruned };
 }
 
+/** Every tool name treated as protected by any section of the config. */
+function protectedNames(config: SmartCompactConfig): Set<string> {
+  return new Set([
+    ...config.pruning.protectedTools,
+    ...config.strategies.deduplication.protectedTools,
+    ...config.strategies.purgeErrors.protectedTools,
+  ]);
+}
+
+/**
+ * Drop reasoning parts longer than the configured threshold, replacing them
+ * with a short marker. Tool calls, results, and prose are untouched, and
+ * messages carrying a protected tool keep their reasoning intact.
+ */
+export function applyStripReasoning(
+  messages: Msg[],
+  config: SmartCompactConfig,
+): { pruned: number; tokens: number } {
+  let pruned = 0;
+  let tokens = 0;
+  if (!config.strategies.stripReasoning.enabled) return { pruned, tokens };
+  const threshold = Math.max(1, config.strategies.stripReasoning.thresholdChars);
+  const skip = protectedNames(config);
+  for (const msg of messages) {
+    if (!Array.isArray(msg.content)) continue;
+    // A protected tool in this message exempts the whole message.
+    const guarded = msg.content.some((part) => {
+      const tool = name(part);
+      return tool !== undefined && skip.has(tool);
+    });
+    if (guarded) continue;
+    for (const part of msg.content) {
+      if (part.type !== "reasoning") continue;
+      const text = typeof part.text === "string" ? part.text : undefined;
+      if (!text || text.length <= threshold) continue;
+      tokens += measureTokens(text, config);
+      part.text = `[reasoning stripped — over ${threshold} chars]`;
+      pruned += 1;
+    }
+  }
+  return { pruned, tokens };
+}
+
 /** Run every enabled strategy. */
 export function applyStrategies(messages: Msg[], config: SmartCompactConfig): { pruned: number; tokens: number } {
   const dedup = applyDeduplication(messages, config);
   const purge = applyPurgeErrors(messages, config);
-  return { pruned: dedup.pruned + purge.pruned, tokens: dedup.tokens };
+  const strip = applyStripReasoning(messages, config);
+  return { pruned: dedup.pruned + purge.pruned + strip.pruned, tokens: dedup.tokens + strip.tokens };
 }
diff --git a/src/tokens.ts b/src/tokens.ts
new file mode 100644
index 00000000..d99560b7
--- /dev/null
+++ b/src/tokens.ts
@@ -0,0 +1,89 @@
+/**
+ * Token measurement for smart-compact. Tokenizer-first with a heuristic
+ * fallback, used only on explicit command paths (`magic-compact`,
+ * `magic-trim`, `compact_context`) — never in the per-request hook.
+ *
+ * The optional `@anthropic-ai/tokenizer` package is loaded at most once and
+ * only when needed. When the package is missing, fails to load, or throws,
+ * every call falls back to the dependency-free `ceil(len / 4)` estimate so a
+ * missing optional dependency can never break compaction.
+ */
+
+import { createRequire } from "node:module";
+
+declare const require: ((id: string) => unknown) | undefined;
+
+type Tokenizer = { countTokens?: (text: string) => number };
+
+let tokenizerAttempted = false;
+let tokenizer: Tokenizer | null = null;
+
+/**
+ * Resolve a CJS-style require in either module system: the ambient `require`
+ * when running under CJS, otherwise one scoped to this file via
+ * `createRequire(import.meta.url)` under ESM. Returns undefined when neither
+ * is available so callers fall back cleanly.
+ */
+function nodeRequire(): ((id: string) => unknown) | undefined {
+  if (typeof require === "function") return require;
+  try {
+    return createRequire(import.meta.url) as (id: string) => unknown;
+  } catch {
+    return undefined;
+  }
+}
+/**
+ * Dependency-free token estimate (~4 chars per token). Returns 0 for empty
+ * input so empty results never report phantom savings.
+ */
+export function estimateTokensFallback(text: string): number {
+  if (!text) return 0;
+  return Math.ceil(text.length / 4);
+}
+
+/** Attempt the optional tokenizer load exactly once; null on any miss. */
+function loadTokenizerOnce(): Tokenizer | null {
+  if (tokenizerAttempted) return tokenizer;
+  tokenizerAttempted = true;
+  try {
+    const loader = nodeRequire();
+    if (!loader) return null;
+    const loaded = loader("@anthropic-ai/tokenizer") as { countTokens?: unknown };
+    if (loaded && typeof loaded.countTokens === "function") {
+      tokenizer = loaded as Tokenizer;
+    }
+  } catch {
+    tokenizer = null;
+  }
+  return tokenizer;
+}
+
+/** Whether a real tokenizer (not the fallback) is backing measurements. */
+export function isTokenizerAvailable(): boolean {
+  return loadTokenizerOnce() !== null;
+}
+
+/**
+ * Count tokens for `text`. Returns the fallback estimate when `enabled` is
+ * false, when no tokenizer is installed, or when the tokenizer throws or
+ * returns a non-finite or negative count.
+ *
+ * The optional third parameter is a test seam: when provided it replaces the
+ * cached loader result for this call only (`null` forces the fallback, a
+ * throwing or misbehaving tokenizer exercises the guards).
+ */
+export function countTokens(text: string, enabled = false, tokenizerForTest?: Tokenizer | null): number {
+  if (!enabled) return estimateTokensFallback(text);
+  const active = tokenizerForTest !== undefined ? tokenizerForTest : loadTokenizerOnce();
+  if (!active?.countTokens) return estimateTokensFallback(text);
+  try {
+    const counted = active.countTokens(text);
+    // Guard against non-finite or negative tokenizer output.
+    if (typeof counted !== "number" || !Number.isFinite(counted) || counted < 0) {
+      return estimateTokensFallback(text);
+    }
+    return Math.ceil(counted);
+  } catch {
+    return estimateTokensFallback(text);
+  }
+}
diff --git a/src/types.ts b/src/types.ts
index e390cb7e..ac40897b 100644
--- a/src/types.ts
+++ b/src/types.ts
@@ -38,7 +38,21 @@ export interface SessionStats {
   prunedTokens: number;
   summarizedTurns: number;
   prunedParts: number;
+  /** Context tokens saved on prune passes that reused a memoized measurement. */
+  savedTokens: number;
   lastRun?: number;
+  /** Wall-clock cost of the most recent prune pass, in milliseconds. */
+  lastRunMs?: number;
+  /** Whether a real tokenizer (not the fallback) backed the last run. */
+  tokenizerUsed?: boolean;
+}
+
+/** Memoized token measurement for one tool call, keyed by content hash. */
+export interface MemoEntry {
+  /** Hash of the measured content; a content change invalidates the entry. */
+  hash: string;
+  /** Measured token cost reused on a hash hit. */
+  tokens: number;
 }
 
 /** Per-session compaction state, persisted in plugin storage. */
@@ -57,6 +71,11 @@ export interface SessionState {
   stats: SessionStats;
   /** Monotonic counter for the next omission id. */
   nextOmissionId: number;
+  /**
+   * Call id → memoized token measurement. Lets repeat passes over identical
+   * content skip remeasuring; any content change invalidates the entry.
+   */
+  pruneMemo: Record<string, MemoEntry>;
   /** A pending command request, consumed by the next context hook. */
   pending?: { mode: "compact" | "trim"; keepTurns: number } | null;
 }
@@ -66,8 +85,9 @@ export function emptyState(): SessionState {
     summaries: {},
     omissions: {},
     omittedCalls: {},
-    stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0 },
+    stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0, savedTokens: 0 },
     nextOmissionId: 1,
+    pruneMemo: {},
     pending: null,
   };
 }
diff --git a/tests/config-validation.test.ts b/tests/config-validation.test.ts
new file mode 100644
index 00000000..3341f6aa
--- /dev/null
+++ b/tests/config-validation.test.ts
@@ -0,0 +1,53 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import {
+  checkBudgetGuard,
+  DEFAULT_CONFIG,
+  validateConfig,
+} from "../src/config.js";
+
+test("validateConfig accepts known keys without warnings", () => {
+  assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
+  assert.deepEqual(validateConfig({}), []);
+});
+
+test("validateConfig names unknown top-level keys", () => {
+  const warnings = validateConfig({ bogusTop: 1 });
+  assert.equal(warnings.length, 1);
+  assert.match(warnings[0]!, /bogusTop/);
+});
+
+test("validateConfig names unknown nested keys with their path", () => {
+  const warnings = validateConfig({ pruning: { nope: 1 }, strategies: { stripReasoning: { huh: 2 } } });
+  assert.ok(warnings.some((w) => w.includes("pruning.nope")));
+  assert.ok(warnings.some((w) => w.includes("strategies.stripReasoning.huh")));
+});
+
+test("checkBudgetGuard aborts over budget and stays quiet otherwise", () => {
+  assert.equal(checkBudgetGuard(60000, DEFAULT_CONFIG), true);
+  assert.equal(checkBudgetGuard(100, DEFAULT_CONFIG), false);
+  assert.equal(checkBudgetGuard(999999999, { ...DEFAULT_CONFIG, tokens: { enabled: false, emergencyBudgetTokens: 0 } }), false);
+});
+
+test("loadConfig merges project config and warns on unknown keys", async () => {
+  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
+  const { tmpdir } = await import("node:os");
+  const { join } = await import("node:path");
+  const dir = mkdtempSync(join(tmpdir(), "smart-compact-config-"));
+  mkdirSync(join(dir, ".opencode"), { recursive: true });
+  writeFileSync(
+    join(dir, ".opencode", "smart-compact.jsonc"),
+    '{"pruning": {"maxChars": 10}, "bogusKey": 1}',
+  );
+  const warned: string[] = [];
+  const original = console.warn;
+  console.warn = (message: string) => void warned.push(message);
+  try {
+    const { loadConfig } = await import("../src/config.js");
+    const config = await loadConfig({ location: { directory: dir } } as never);
+    assert.equal(config.pruning.maxChars, 10);
+    assert.ok(warned.some((w) => w.includes("bogusKey")));
+  } finally {
+    console.warn = original;
+  }
+});
diff --git a/tests/prune-bounds.test.ts b/tests/prune-bounds.test.ts
new file mode 100644
index 00000000..7650a752
--- /dev/null
+++ b/tests/prune-bounds.test.ts
@@ -0,0 +1,94 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { DEFAULT_CONFIG, type SmartCompactConfig } from "../src/config.js";
+import { pruneToolResults } from "../src/prune.js";
+import { selectTurns, type Turn } from "../src/plan.js";
+import { emptyState, type Msg } from "../src/types.js";
+
+function withPruning(patch: Partial<SmartCompactConfig["pruning"]>): SmartCompactConfig {
+  return { ...DEFAULT_CONFIG, pruning: { ...DEFAULT_CONFIG.pruning, ...patch } };
+}
+
+function userMsg(id: string): Msg {
+  return { id, role: "user", content: [{ type: "text", text: "hello" }] };
+}
+
+function bigResult(id: string): Msg {
+  return {
+    id,
+    role: "assistant",
+    content: [{ type: "tool-result", id, name: "bash", result: { type: "text", value: "x".repeat(2000) } }],
+  };
+}
+
+test("preserve-recent window keeps the last turn unpruned", () => {
+  const config = withPruning({ preserveRecentTurns: 1 });
+  const messages: Msg[] = [userMsg("u1"), bigResult("c1"), userMsg("u2"), bigResult("c2")];
+  const result = pruneToolResults(messages, emptyState(), config);
+  // c1 sits in an older turn and is pruned; c2 sits in the recent window.
+  assert.equal(result.pruned, 1);
+  const second = (messages[3]!.content[0]!.result as { value: string }).value;
+  assert.equal(second, "x".repeat(2000));
+});
+
+test("a large preserve window keeps a single-turn session intact", () => {
+  const config = withPruning({ preserveRecentTurns: 5 });
+  const messages: Msg[] = [userMsg("u1"), bigResult("c1")];
+  assert.equal(pruneToolResults(messages, emptyState(), config).pruned, 0);
+});
+
+test("truncate cap prunes over-long results with the full original cached", () => {
+  // 500 chars sits well under the 2000-char / 1000-word size limit, so only
+  // the 100-char truncate cap can prune here — isolating the cap behavior.
+  const config = withPruning({
+    preserveRecentTurns: 0,
+    maxChars: 2000,
+    maxWords: 1000,
+    truncateToolsChars: 100,
+  });
+  const content = "y".repeat(500);
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [{ type: "tool-result", id: "c1", name: "bash", result: { type: "text", value: content } }],
+    },
+  ];
+  const state = emptyState();
+  const result = pruneToolResults(messages, state, config);
+  assert.equal(result.pruned, 1);
+  assert.equal(state.omissions["omitted-0001"]!.content, content);
+});
+
+test("token-measured decisions prune by token budget when enabled", () => {
+  // A single 500-char word stays under the 5000-char / 10-word size limit,
+  // so the chars path keeps it while the token path (125 > 10) prunes it.
+  const config = withPruning({ preserveRecentTurns: 0, truncateToolsChars: 0, maxChars: 5000, maxWords: 10, useTokens: true });
+  const small: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [{ type: "tool-result", id: "c1", name: "bash", result: { type: "text", value: "short" } }],
+    },
+  ];
+  assert.equal(pruneToolResults(small, emptyState(), config).pruned, 0);
+  const big: Msg[] = [
+    {
+      id: "a2",
+      role: "assistant",
+      content: [{ type: "tool-result", id: "c2", name: "bash", result: { type: "text", value: "x".repeat(500) } }],
+    },
+  ];
+  assert.equal(pruneToolResults(big, emptyState(), config).pruned, 1);
+});
+
+test("selectTurns preserves recent turns and the last user message", () => {
+  const turns: Turn[] = [
+    { userText: "first", assistants: [{ id: "a1", text: "one" }] },
+    { userText: "second", assistants: [{ id: "a2", text: "two" }] },
+    { userText: "last", assistants: [{ id: "a3", text: "three" }] },
+  ];
+  const eligible = selectTurns(turns, 0, 2);
+  assert.equal(eligible.length, 1);
+  assert.ok(!eligible.some((t) => t.userText === "last"));
+});
diff --git a/tests/prune.test.ts b/tests/prune.test.ts
index 62fdb983..f66d0cd1 100644
--- a/tests/prune.test.ts
+++ b/tests/prune.test.ts
@@ -5,6 +5,7 @@ import {
   pruneToolResults,
   shouldPrune,
 } from "../src/prune.js";
+import { DEFAULT_CONFIG } from "../src/config.js";
 import { emptyState, type Msg } from "../src/types.js";
 
 test("shouldPrune applies per-tool rules", () => {
@@ -17,6 +18,20 @@ test("shouldPrune applies per-tool rules", () => {
   assert.equal(shouldPrune("bash", "x".repeat(2000)), true);
 });
 
+test("shouldPrune honors custom protected tools from config", () => {
+  // Defaults prune both bash and write output at this size ...
+  assert.equal(shouldPrune("bash", "x".repeat(5000), DEFAULT_CONFIG), true);
+  assert.equal(shouldPrune("write", "x".repeat(5000), DEFAULT_CONFIG), true);
+  // ... while a custom protected list keeps write (question stays safe).
+  const config = {
+    ...DEFAULT_CONFIG,
+    pruning: { ...DEFAULT_CONFIG.pruning, protectedTools: ["question", "write", "edit", "plan"] },
+  };
+  assert.equal(shouldPrune("question", "x".repeat(5000), config), false);
+  assert.equal(shouldPrune("write", "x".repeat(5000), config), false);
+  assert.equal(shouldPrune("bash", "x".repeat(5000), config), true);
+});
+
 test("pruneToolResults allocates monotonic ids and caches originals", () => {
   const state = emptyState();
   const messages: Msg[] = [
@@ -64,8 +79,7 @@ test("pruneToolResults discards todowrite without caching", () => {
   assert.deepEqual(messages[0]!.content[0]!.result, { type: "text", value: "Successfully updated todos." });
 });
 
-test("applyOmissions replays a stored omission onto a fresh message", () => {
-  const state = emptyState();
+test("applyOmissions replays a stored omission onto a fresh message", () => {  const state = emptyState();
   state.omissions["omitted-0001"] = {
     id: "omitted-0001",
     callId: "call-1",
@@ -85,3 +99,49 @@ test("applyOmissions replays a stored omission onto a fresh message", () => {
   const value = (messages[0]!.content[0]!.result as { value: string }).value;
   assert.match(value, /omitted-0001/);
 });
+
+test("applyOmissions fails closed when the cached original is gone", () => {
+  const state = emptyState();
+  // The call mapping survived but the cached record was cleared by a newer run.
+  state.omittedCalls["call-9"] = "omitted-0009";
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [{ type: "tool-result", id: "call-9", name: "read", result: { type: "text", value: "original" } }],
+    },
+  ];
+  applyOmissions(messages, state);
+  const value = (messages[0]!.content[0]!.result as { value: string }).value;
+  assert.match(value, /omitted-0009/);
+  assert.match(value, /cleared/);
+});
+
+test("emptyState carries the new stats fields and an empty memo", () => {
+  const stats = emptyState().stats;
+  assert.equal(stats.savedTokens, 0);
+  assert.equal(stats.tokenizerUsed ?? false, false);
+  assert.deepEqual(emptyState().pruneMemo, {});
+});
+
+test("pruneToolResults reuses memoized measurement for identical content", () => {
+  const big = "x".repeat(2000);
+  const make = (): Msg[] => [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [{ type: "tool-result", id: "c1", name: "bash", result: { type: "text", value: big } }],
+    },
+  ];
+  const state = emptyState();
+  const first = pruneToolResults(make(), state);
+  assert.equal(first.pruned, 1);
+  assert.equal(first.memoHits, 0);
+  // Simulate a fresh pass over the same content (mapping cleared).
+  delete state.omittedCalls["c1"];
+  delete state.omissions["omitted-0001"];
+  const second = pruneToolResults(make(), state);
+  assert.equal(second.pruned, 1);
+  assert.equal(second.memoHits, 1);
+  assert.equal(second.tokens, first.tokens);
+});
diff --git a/tests/strategies.test.ts b/tests/strategies.test.ts
index 71dcc43d..79d512f2 100644
--- a/tests/strategies.test.ts
+++ b/tests/strategies.test.ts
@@ -1,7 +1,7 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { DEFAULT_CONFIG } from "../src/config.js";
-import { applyDeduplication, applyPurgeErrors, stableStringify } from "../src/strategies.js";
+import { applyDeduplication, applyPurgeErrors, applyStripReasoning, stableStringify } from "../src/strategies.js";
 import type { Msg } from "../src/types.js";
 
 function toolCall(id: string, name: string, input: unknown) {
@@ -62,3 +62,35 @@ test("applyPurgeErrors ignores recent errored calls", () => {
   ];
   assert.equal(applyPurgeErrors(messages, DEFAULT_CONFIG).pruned, 0);
 });
+
+test("applyStripReasoning drops long reasoning but keeps short text and tool structure", () => {
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [
+        { type: "reasoning", text: "r".repeat(600) },
+        { type: "text", text: "kept prose" },
+        toolCall("c1", "bash", { command: "ls" }),
+        toolResult("c1", "bash", "ok"),
+      ],
+    },
+  ];
+  const result = applyStripReasoning(messages, DEFAULT_CONFIG);
+  assert.equal(result.pruned, 1);
+  assert.match(messages[0]!.content[0]!["text"] as string, /reasoning stripped/);
+  assert.equal(messages[0]!.content[1]!["text"], "kept prose");
+  assert.deepEqual(messages[0]!.content[2]!, toolCall("c1", "bash", { command: "ls" }));
+});
+
+test("applyStripReasoning keeps reasoning beside protected tools", () => {
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [{ type: "reasoning", text: "r".repeat(600) }, toolCall("c1", "question", { q: "?" })],
+    },
+  ];
+  assert.equal(applyStripReasoning(messages, DEFAULT_CONFIG).pruned, 0);
+  assert.equal((messages[0]!.content[0]!["text"] as string).length, 600);
+});
diff --git a/tests/tokens.test.ts b/tests/tokens.test.ts
new file mode 100644
index 00000000..01c8c8a5
--- /dev/null
+++ b/tests/tokens.test.ts
@@ -0,0 +1,39 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import {
+  countTokens,
+  estimateTokensFallback,
+  isTokenizerAvailable,
+} from "../src/tokens.js";
+
+test("estimateTokensFallback returns 0 for empty and ceil(len/4) otherwise", () => {
+  assert.equal(estimateTokensFallback(""), 0);
+  assert.equal(estimateTokensFallback("abcdefgh"), 2);
+  assert.equal(estimateTokensFallback("abcdefghi"), 3);
+});
+
+test("countTokens honors the disabled flag and uses the fallback", () => {
+  assert.equal(countTokens("abcdefgh", false), 2);
+  assert.equal(countTokens("", false), 0);
+});
+
+test("countTokens falls back when no tokenizer is available", () => {
+  if (!isTokenizerAvailable()) {
+    assert.equal(countTokens("abcdefgh", true), estimateTokensFallback("abcdefgh"));
+  } else {
+    assert.ok(Number.isFinite(countTokens("abcdefgh", true)));
+  }
+  // The test seam forces each fallback branch without touching the loader.
+  assert.equal(countTokens("abcdefgh", true, null), 2);
+  assert.equal(
+    countTokens("abcdefgh", true, {
+      countTokens: () => {
+        throw new Error("boom");
+      },
+    }),
+    2,
+  );
+  assert.equal(countTokens("abcdefgh", true, { countTokens: () => NaN }), 2);
+  assert.equal(countTokens("abcdefgh", true, { countTokens: () => -5 }), 2);
+  assert.equal(countTokens("abcdefgh", true, { countTokens: () => 7 }), 7);
+});
```
<!-- END_GIT_DIFF -->
