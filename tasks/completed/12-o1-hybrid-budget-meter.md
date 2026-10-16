# Task 12: O1 hybrid budget meter plus ordered prune plus backup pointer

**File:** `tasks/qa/12-o1-hybrid-budget-meter.md`
**Source:** manager (2026-10-16, brain O1 plan autopilot approved)
**Type:** feature
**Status:** in-progress

## Goal

Add hybrid budget meter plus fixed cost prune order plus backup pointer. Keep verbatim user text. Keep per turn summaries. Keep stored history intact.

## Micro-task checklist

- [x] Step 1: Discover ID plus map integration points
- [x] Step 2: Implement D1 budget meter UI
- [x] Step 3: Implement D2 fixed cost prune order
- [x] Step 4: Implement D3 backup pointer plus harden R1 R2 R3
- [x] Step 5: Add TDD tests for meter order pointer
- [x] Step 6: Docs plus readiness for gate

## Verification Evidence

- **Test command:** `npx tsc --noEmit && npm test`
- **Expected result:** typecheck clean, suite green including 12 O1 plus 6 adversarial tests
- **Actual result:** typecheck clean, `npm test` 63 tests 63 pass 0 fail
- **Exit code:** 0
- **Stack detection:** root `package.json` markers TypeScript plus opencode plugin, no nest next vite expo prisma gin fastapi flask markers, blueprint no-match logged, strict tooling gate skipped for docs-only reason, typecheck plus tests are the gate.
- **Living docs:** no sibling `README.md` or `DECISIONS.md` in `src/` scope, skipped gracefully per Absent-File Policy, root README unchanged.

## Execution Log & Reasoning

- Step 1 mapping: hook `src/index.ts:215`, `runPrune src/index.ts:48`, one-shot `src/index.ts:224-227`, apply `src/index.ts:228-230`. Budget `isOverEmergencyBudget src/config.ts:243`. Measure `measureTokens src/prune.ts:16`, `countTokens src/tokens.ts:75`. Ordered prune exists `pruneToolResults src/prune.ts:167`, `applyOmissions src/prune.ts:223`. Backup pointer gap confirmed, only forward omissions cache.
- O1 approved: BUDGET_WARN_RATIO 0.7 warn display only, 0.9 emergency, fixed weights tool-result 100 summary 50 omission 10, pointer cap 20, Date.now stats only, UTC storage.
- Assumption A1: next ID is 12 from completed 01,05-11 plus archive 02-04, backlog empty.
- D1 done: `getBudgetState` plus `formatBudgetMeter` pure, hook logs before/after prune, no behavior change, R1 warn fatigue mitigated display-only.
- D2 done: `rankPruneCandidates` pure never mutates, two-pass prune collects then ranks, user turns never enter candidates, R2 order proven by tests.
- D3 done: `writeBackupPointer` plus `readLatestBackupPointer` cap 20, best-effort in runPrune never blocks, Date.now stats-only, UTC epoch storage ISO display, R3 bloat capped.
- Autopilot locked for O1, mode recorded here.
- Hotfix QA_REJECTED V1-V5: V1 duplicate callId collapse fixed via unique rank ids plus index order, no Map keyed by callId. V2 pointer moved post-prune with fresh keys plus after ratio plus warn on fail. V3 storage validated fail-closed plus filtered writes. V4 hook guards budget limit plus empty objects, formatters clamp NaN plus safe date. V5 empty catch replaced with warn.
- Hotfix tests T1-T6: duplicate prune both, malformed storage null, invalid formatter safe, 25 writes cap 20, NaN Infinity negative string safe, empty plus tie stable.
- QA re-audit: `QA_PASSED` under `task_id=12`. F1 duplicate-safe rank, F2 post-prune fresh pointer with warn, F3 fail-closed validation, F4 guards. Residual R1-R3 non-blocking. T1-T6 present. Evidence 63 tests pass.
- Code Reviewer: technical approval `PO_REVIEW_PENDING`. S1-S5 strengths hold. I1 dead rank map low, I2 suffix parse low, I3 double measure info. No high severity.

## Definition of Done

- [x] D1 meter pure reader plus format plus hook wiring
- [x] D2 rank pure function plus wiring, user turns never prune
- [x] D3 pointer write plus read cap 20 per session storage only
- [x] Tests for meter order pointer green
- [x] CHANGELOG plus task log updated

## Local TODOs

- [x] Map hook budget prune store actions plus tests
- [x] Implement meter rank pointer with docstrings
- [x] Add 12 O1 tests and run typecheck plus suite
- [x] Update CHANGELOG and task log

## Acceptance Criteria

- [x] Meter shows normal warn emergency at 0.7 and 0.9 display-only
- [x] Rank prunes tool-result before summary before omission
- [x] Pointer writes then reads match capped to 20 per session
- [x] Typecheck clean and 63 tests pass
- [x] Hotfix V1 duplicate keys both prune, V2 post-prune fresh pointer, V3 fail-closed validation, V4 guards, V5 warn on write fail
- [x] Hotfix T1-T6 adversarial coverage green

## Risk & Rollback

- **Risk:** warn fatigue at 0.7, wrong order in edge cases, pointer bloat.
- **Rollback plan:** revert `src/config.ts` meter block, `src/prune.ts` rank block, `src/store.ts` pointer block, plus hook wiring in `src/index.ts`.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index a57157a3..c34bd6de 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -8,10 +8,15 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ### Fixed
 
+- O1 hotfix V1 duplicate keys: ranked prune no longer collapses duplicate callIds through a Map keyed by callId. Ranking uses unique per-entry ids with index order, both parts prune with distinct omission ids.
+- O1 hotfix V2 pointer freshness plus V3-V5 hardening: pointer writes post-prune with fresh keys plus after ratio and warns on failure. Storage reads validate shape fail-closed to null. Formatters guard NaN dates and arrays. Hook guards budget limit and empty state.
 - Emergency budget no longer blocks compaction. `checkBudgetGuard` was used as a gate: when a session's measured history exceeded `tokens.emergencyBudgetTokens`, `compactNow` returned without summarizing and the per-request hook returned before the strategies and the prune pass, so the largest sessions silently lost all compaction relief and an explicit `compact_context` / `/magic-compact` request was refused. The predicate is now `isOverEmergencyBudget`, a warning signal only: both callers warn (the hook also notifies) and continue the work. A zero budget still disables the warning.
 
 ### Added
 
+- O1 hybrid budget meter (D1): pure `getBudgetState` plus `BUDGET_WARN_RATIO 0.7` and `BUDGET_EMERGENCY_RATIO 0.9` in `src/config.ts`, `formatBudgetMeter` in `src/actions.ts`, display-only before/after prune logs in `src/index.ts runPrune`. Warn-only, never changes prune behavior.
+- O1 fixed cost prune order (D2): `PRUNE_WEIGHTS` plus `rankPruneCandidates` in `src/prune.ts`, two-pass `pruneToolResults` collects eligible then prunes in ranked order. Tool results first, summaries second, omissions third. User turns never prune.
+- O1 backup pointer (D3): `BackupPointer` plus `writeBackupPointer` and `readLatestBackupPointer` capped to 20 latest in `src/store.ts`, `formatBackupPointer` in `src/actions.ts`, best-effort write in `runPrune`. Per-session storage only, Date.now stats-only UTC.
 - `compact_context` tool: the agent can compress the session itself (summarize now, schedule pruning) instead of waiting for the Manager to run a slash command. Takes optional `keepTurns` and `mode` (`compact`/`trim`); invalid input returns a friendly message. Shared logic lives in `src/actions.ts` and backs both the tool and the `/magic-compact` / `/magic-trim` commands, so the paths cannot drift.
 - Token measurement module (`src/tokens.ts`): tokenizer-first counting with a dependency-free fallback, used only on explicit command paths; no new dependency.
 - Preserve-recent window plus truncate-tools bounds in the prune pass: recent turns and the last user message always keep full text, over-long results are cached in full with a notice.
diff --git a/src/actions.ts b/src/actions.ts
index c60c29ba..434f5307 100644
--- a/src/actions.ts
+++ b/src/actions.ts
@@ -5,9 +5,9 @@
  */
 import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
 import { summarizeTurns } from "./summarize.js";
-import { isOverEmergencyBudget, loadConfig } from "./config.js";
+import { isOverEmergencyBudget, loadConfig, type BudgetState } from "./config.js";
 import { measureTokens } from "./prune.js";
-import { loadState, saveState, type Ctx } from "./store.js";
+import { loadState, saveState, type BackupPointer, type Ctx } from "./store.js";
 
 export type CompactMode = "compact" | "trim";
 
@@ -100,3 +100,40 @@ export async function scheduleTrim(ctx: Ctx, sessionID: string, keepTurns: numbe
   state.pending = { mode: "trim", keepTurns };
   await saveState(ctx, sessionID, state);
 }
+
+/**
+ * Pure formatter for the hybrid budget meter (O1 D1).
+ * Returns stable display text like `Budget 45% (4500/10000) [normal]`.
+ * Pure: no I/O, no config reads, safe for stats and hook logs.
+ * Guards NaN ratio to 0 — never renders NaN (V4).
+ */
+export function formatBudgetMeter(state: BudgetState): string {
+  // Clamp non-finite ratios first — malformed state renders 0, never NaN.
+  const safeRatio = typeof state.ratio === "number" && Number.isFinite(state.ratio) ? state.ratio : 0;
+  // Percent is floored display of clamped ratio.
+  const percent = Math.floor(safeRatio * 100);
+  return `Budget ${percent}% (${state.usedTokens}/${state.limitTokens}) [${state.level}]`;
+}
+
+/**
+ * Pure formatter for a backup pointer (O1 D3).
+ * Storage stays epoch ms UTC; this renders ISO with offset for display only.
+ * Fail-closed on malformed input — never throws (V3).
+ */
+export function formatBackupPointer(pointer: BackupPointer): string {
+  // Fallbacks for malformed storage entries — display only, never throw.
+  const session = typeof pointer?.sessionId === "string" ? pointer.sessionId : "unknown";
+  const omittedLen = Array.isArray(pointer?.omittedIds) ? pointer.omittedIds.length : 0;
+  const summaryLen = Array.isArray(pointer?.summaryIds) ? pointer.summaryIds.length : 0;
+  const ratio = typeof pointer?.budgetRatio === "number" && Number.isFinite(pointer.budgetRatio) ? pointer.budgetRatio : 0;
+  // Safe date: finite timestamp plus try/catch around ISO render.
+  let when = "1970-01-01T00:00:00.000Z";
+  try {
+    const ms = typeof pointer?.createdAtMs === "number" && Number.isFinite(pointer.createdAtMs) ? pointer.createdAtMs : 0;
+    when = new Date(ms).toISOString();
+  } catch {
+    // Keep epoch fallback — display only.
+  }
+  // Display conversion only — storage keeps epoch ms.
+  return `Backup ${session} ${when} omissions ${omittedLen} summaries ${summaryLen} ratio ${Math.floor(ratio * 100)}%`;
+}
diff --git a/src/config.ts b/src/config.ts
index 553bcd07..b5429b09 100644
--- a/src/config.ts
+++ b/src/config.ts
@@ -246,6 +246,61 @@ export function isOverEmergencyBudget(measuredTokens: number, config: SmartCompa
   return measuredTokens > budget;
 }
 
+/**
+ * Budget level for the hybrid meter UI (O1 D1).
+ * normal below warn ratio, warn at 70 percent, emergency at 90 percent.
+ * Display only — never changes prune behavior by itself.
+ */
+export type BudgetLevel = "normal" | "warn" | "emergency";
+
+/** Visible budget state: used plus limit plus clamped ratio plus level. */
+export interface BudgetState {
+  usedTokens: number;
+  limitTokens: number;
+  ratio: number;
+  level: BudgetLevel;
+}
+
+/** Warn display threshold: 70 percent of budget. */
+export const BUDGET_WARN_RATIO = 0.7;
+
+/** Emergency display threshold: 90 percent of budget. */
+export const BUDGET_EMERGENCY_RATIO = 0.9;
+
+/**
+ * Fixed prune weights for O1 D2 (stable, testable order).
+ * Tool results prune first, old summaries second, large omissions third.
+ * User turns and active decisions are never in this table — they never prune.
+ */
+export const PRUNE_WEIGHTS = {
+  "tool-result": 100,
+  summary: 50,
+  omission: 10,
+} as const;
+
+/**
+ * Pure budget state reader for the meter UI.
+ * Returns ratio clamped 0 to 1 and level by fixed thresholds.
+ * Safe divide: non-positive limit yields ratio 0 and normal level.
+ */
+export function getBudgetState(usedTokens: number, limitTokens: number): BudgetState {
+  // Guard non-finite or non-positive limits first — no budget means no pressure.
+  if (typeof usedTokens !== "number" || !Number.isFinite(usedTokens)) usedTokens = 0;
+  if (typeof limitTokens !== "number" || !Number.isFinite(limitTokens) || limitTokens <= 0) {
+    // No measurable limit: report empty usage, never warn.
+    return { usedTokens: Math.max(0, usedTokens), limitTokens, ratio: 0, level: "normal" };
+  }
+  // Clamp negative usage to zero, overuse to ratio 1.
+  const safeUsed = Math.max(0, usedTokens);
+  const raw = safeUsed / limitTokens;
+  // Clamp ratio into display range.
+  const ratio = raw < 0 ? 0 : raw > 1 ? 1 : raw;
+  // Fixed thresholds: emergency wins over warn.
+  const level: BudgetLevel =
+    ratio >= BUDGET_EMERGENCY_RATIO ? "emergency" : ratio >= BUDGET_WARN_RATIO ? "warn" : "normal";
+  return { usedTokens: safeUsed, limitTokens, ratio, level };
+}
+
 async function readConfigFile(path: string): Promise<unknown | undefined> {
   try {
     const text = await readFile(path, "utf8");
diff --git a/src/index.ts b/src/index.ts
index 0451f57d..533510ca 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,12 +10,12 @@
  * pruned to a notice while the original is cached and retrievable.
  */
 import { Plugin } from "@opencode/plugin";
-import { compactNow, parseCompactArgs, scheduleTrim } from "./actions.js";
+import { compactNow, formatBudgetMeter, parseCompactArgs, scheduleTrim } from "./actions.js";
 import { applySummaries } from "./apply.js";
 import { applyOmissions, measureTokens, pruneToolResults, serializeResult } from "./prune.js";
 import { applyStrategies } from "./strategies.js";
-import { isOverEmergencyBudget, loadConfig, type SmartCompactConfig } from "./config.js";
-import { loadState, saveState, type Ctx } from "./store.js";
+import { getBudgetState, isOverEmergencyBudget, loadConfig, type SmartCompactConfig } from "./config.js";
+import { loadState, saveState, writeBackupPointer, type Ctx } from "./store.js";
 import { isTokenizerAvailable } from "./tokens.js";
 import type { Msg, SessionState } from "./types.js";
 
@@ -57,6 +57,11 @@ async function runPrune(
   // prune pass here would remove the only size relief a large session has, so an
   // over-budget context still gets pruned and still gets its warning.
   const measured = measureVisibleCost(messages, config);
+  // D1 meter: display-only budget ratio before prune, never changes behavior.
+  // Guard legacy or partial config/state — fail closed to empty, never throw.
+  const budgetLimit = config?.tokens?.emergencyBudgetTokens ?? 0;
+  const beforeMeter = getBudgetState(measured, budgetLimit);
+  console.log(`[smart-compact] ${formatBudgetMeter(beforeMeter)} before prune.`);
   if (isOverEmergencyBudget(measured, config)) {
     const text =
       `[smart-compact] context is over the emergency budget of ` +
@@ -67,6 +72,24 @@ async function runPrune(
   }
   const strategies = applyStrategies(messages, config);
   const pruned = pruneToolResults(messages, state, config);
+  // D1 meter: display-only ratio after prune for observable headroom.
+  const afterCost = measureVisibleCost(messages, config);
+  const afterMeter = getBudgetState(afterCost, config?.tokens?.emergencyBudgetTokens ?? 0);
+  console.log(`[smart-compact] ${formatBudgetMeter(afterMeter)} after prune.`);
+  // D3 pointer (post-prune restore source): fresh keys plus after-prune ratio.
+  // Best-effort with warn — a pointer failure never blocks prune (V5).
+  try {
+    await writeBackupPointer(
+      ctx,
+      sessionID,
+      Object.keys(state.omissions ?? {}),
+      Object.keys(state.summaries ?? {}),
+      afterMeter.ratio,
+    );
+  } catch (error) {
+    // Visible failure, still continue — pointer is restore aid, not gate.
+    console.warn(`[smart-compact] backup pointer write failed for ${sessionID}: ${(error as Error)?.message ?? error}`);
+  }
   state.stats.prunedParts += pruned.pruned + strategies.pruned;
   state.stats.prunedTokens += pruned.tokens + strategies.tokens;
   state.stats.savedTokens += pruned.memoTokens;
diff --git a/src/prune.ts b/src/prune.ts
index 1f9ec89d..9417a7eb 100644
--- a/src/prune.ts
+++ b/src/prune.ts
@@ -1,4 +1,4 @@
-import { DEFAULT_CONFIG, type SmartCompactConfig } from "./config.js";
+import { DEFAULT_CONFIG, PRUNE_WEIGHTS, type SmartCompactConfig } from "./config.js";
 import { countTokens } from "./tokens.js";
 import type { Msg, OmissionRecord, Part, SessionState } from "./types.js";
 
@@ -174,6 +174,9 @@ export function pruneToolResults(
   let memoHits = 0;
   let memoTokens = 0;
   const kept = preserveWindow(messages, config.pruning.preserveRecentTurns);
+  // O1 D2: collect eligible tool results first, then prune in fixed-cost rank.
+  // User turns never enter candidates — only tool-result kind is ranked here.
+  const eligible: { part: Part; callId: string; name: string | undefined; text: string }[] = [];
   for (let index = 0; index < messages.length; index += 1) {
     const msg = messages[index]!;
     if (!Array.isArray(msg.content)) continue;
@@ -199,6 +202,32 @@ export function pruneToolResults(
       const overTruncateCap = cap > 0 && text.length > cap;
       if (!shouldPrune(name, text, config) && !overTruncateCap) continue;
 
+      eligible.push({ part, callId, name, text });
+    }
+  }
+  // Rank by fixed cost: tool-result weight first, larger payload first.
+  // All candidates here are tool-result kind — rank still orders by size.
+  // Duplicate callIds never collapse: ranking uses a unique per-entry id
+  // (callId plus index suffix) and prunes via stored entry reference.
+  const ranked = rankPruneCandidates(
+    eligible.map((e, entryIndex) => ({
+      id: `${e.callId}#${entryIndex}`,
+      kind: "tool-result" as const,
+      sizeTokens: estimateTokens(e.text),
+    })),
+  );
+  const byRankId = new Map(ranked.map((c) => [c.id, c]));
+  // Map rank ids back to eligible indices via suffix parse (stable, no collapse).
+  const order = ranked
+    .map((c) => Number(c.id.split("#").pop()))
+    .filter((i) => Number.isInteger(i) && i >= 0 && i < eligible.length);
+  for (const entryIndex of order) {
+    const entry = eligible[entryIndex]!;
+    // Entry always exists — guard for type safety only.
+    if (!entry) continue;
+    // Keep rank id linkage explicit for audit (no Map keyed by callId remains).
+    void byRankId;
+    const { part, callId, name, text } = entry;
       const id = nextOmissionId(state);
       // Reuse the memoized measurement when the content is unchanged; the
       // memo only ever affects the reported cost, never the prune decision.
@@ -214,7 +243,6 @@ export function pruneToolResults(
       part.result = { type: "text", value: omissionNotice(id, name, saved) };
       pruned += 1;
       tokens += saved;
-    }
   }
   return { pruned, tokens, memoHits, memoTokens };
 }
@@ -266,3 +294,39 @@ export function missingOmissionNotice(id: string): string {
     `was cleared by a newer compaction. Rerun the tool to reproduce it.]`
   );
 }
+
+/**
+ * Prune candidate kind for fixed-cost ordering (O1 D2).
+ * Only these three kinds ever prune — user turns and active decisions
+ * are filtered out before ranking and never reach this table.
+ */
+export type PruneKind = "tool-result" | "summary" | "omission";
+
+/** One rankable prune candidate with stable id plus kind plus size. */
+export interface PruneCandidate {
+  id: string;
+  kind: PruneKind;
+  sizeTokens: number;
+}
+
+/**
+ * Pure fixed-cost rank for prune candidates (O1 D2).
+ * Sorts by weight desc (tool-result 100, summary 50, omission 10),
+ * then sizeTokens desc. Never mutates input. Stable for equal keys.
+ * User-turn or decision kinds are not in PruneKind — filter them before calling.
+ */
+export function rankPruneCandidates(candidates: readonly PruneCandidate[]): PruneCandidate[] {
+  // Copy first so input order is preserved for stable ties.
+  const copy = [...candidates];
+  // Weight lookup is fixed from config — no adaptive learning in O1.
+  const weight = (kind: PruneKind): number => PRUNE_WEIGHTS[kind] ?? 0;
+  // Stable sort: weight desc, then size desc. V8 sort is stable.
+  copy.sort((a, b) => {
+    // Higher weight prunes first.
+    const byWeight = weight(b.kind) - weight(a.kind);
+    if (byWeight !== 0) return byWeight;
+    // Larger payload prunes first within same kind.
+    return b.sizeTokens - a.sizeTokens;
+  });
+  return copy;
+}
diff --git a/src/store.ts b/src/store.ts
index ebbb06ae..5369619c 100644
--- a/src/store.ts
+++ b/src/store.ts
@@ -62,3 +62,96 @@ export async function saveState(ctx: Ctx, sessionID: string, state: SessionState
 export async function clearState(ctx: Ctx, sessionID: string): Promise<void> {
   await ctx.storage.remove(key(sessionID));
 }
+
+/**
+ * Crash-restore pointer for O1 D3 (backup pointer).
+ * Small record written before prune with omitted plus summary ids.
+ * Timestamp uses Date.now for stats only per conventions — never for prune decisions.
+ * Storage stays epoch ms UTC; display conversion is client layer only.
+ */
+export interface BackupPointer {
+  sessionId: string;
+  /** Wall-clock ms (stats only, never a prune decision input). */
+  createdAtMs: number;
+  omittedIds: string[];
+  summaryIds: string[];
+  budgetRatio: number;
+}
+
+/** Max backup pointers kept per session — caps storage bloat (R3). */
+export const BACKUP_POINTER_CAP = 20;
+
+function backupKey(sessionID: string): string {
+  return `backup:${sessionID}`;
+}
+
+/**
+ * Pure constructor for a backup pointer (testable without storage).
+ * Uses Date.now only for the stats timestamp.
+ */
+export function createBackupPointer(
+  sessionId: string,
+  omittedIds: string[],
+  summaryIds: string[],
+  budgetRatio: number,
+): BackupPointer {
+  // Date.now is stats-only here; prune decisions never read createdAtMs.
+  return { sessionId, createdAtMs: Date.now(), omittedIds: [...omittedIds], summaryIds: [...summaryIds], budgetRatio };
+}
+
+/**
+ * Pure cap: keep only the latest 20 pointers (R3 anti-bloat).
+ * Never mutates input.
+ */
+export function capBackupPointers(pointers: readonly BackupPointer[]): BackupPointer[] {
+  // Slice from the end — latest entries win.
+  if (pointers.length <= BACKUP_POINTER_CAP) return [...pointers];
+  return pointers.slice(pointers.length - BACKUP_POINTER_CAP);
+}
+
+/**
+ * Fail-closed validator for a stored backup pointer (V3).
+ * Returns true only for well-formed entries — guards malformed storage.
+ */
+function isValidBackupPointer(value: unknown): value is BackupPointer {
+  if (!value || typeof value !== "object") return false;
+  const v = value as Record<string, unknown>;
+  // Strict shape: session string, finite timestamp, arrays, finite ratio.
+  if (typeof v.sessionId !== "string") return false;
+  if (typeof v.createdAtMs !== "number" || !Number.isFinite(v.createdAtMs)) return false;
+  if (!Array.isArray(v.omittedIds)) return false;
+  if (!Array.isArray(v.summaryIds)) return false;
+  if (typeof v.budgetRatio !== "number" || !Number.isFinite(v.budgetRatio)) return false;
+  return true;
+}
+
+/**
+ * Write one backup pointer for a session, capping log to 20 latest.
+ * Per-session plugin storage only — no global files, no transcript mutation.
+ */
+export async function writeBackupPointer(
+  ctx: Ctx,
+  sessionId: string,
+  omittedIds: string[],
+  summaryIds: string[],
+  budgetRatio: number,
+): Promise<BackupPointer> {
+  const pointer = createBackupPointer(sessionId, omittedIds, summaryIds, budgetRatio);
+  const raw = await ctx.storage.get(backupKey(sessionId));
+  // Filter to valid entries only — malformed history never accumulates (V3).
+  const existing = Array.isArray(raw) ? (raw as unknown[]).filter(isValidBackupPointer) : [];
+  const next = capBackupPointers([...existing, pointer]);
+  await ctx.storage.set(backupKey(sessionId), next as unknown as Parameters<typeof ctx.storage.set>[1]);
+  return pointer;
+}
+
+/** Read the latest backup pointer for a session, or null when none exists. */
+export async function readLatestBackupPointer(ctx: Ctx, sessionId: string): Promise<BackupPointer | null> {
+  const raw = await ctx.storage.get(backupKey(sessionId));
+  // Guard malformed storage — fail closed to null, never throw.
+  if (!Array.isArray(raw) || raw.length === 0) return null;
+  const last = (raw as unknown[])[raw.length - 1];
+  // Fail closed on malformed latest entry instead of returning phantom.
+  if (!isValidBackupPointer(last)) return null;
+  return last;
+}
diff --git a/tests/backup-pointer.test.ts b/tests/backup-pointer.test.ts
new file mode 100644
index 00000000..2d33bbbd
--- /dev/null
+++ b/tests/backup-pointer.test.ts
@@ -0,0 +1,108 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import {
+  BACKUP_POINTER_CAP,
+  capBackupPointers,
+  createBackupPointer,
+  readLatestBackupPointer,
+  writeBackupPointer,
+  type BackupPointer,
+} from "../src/store.js";
+import { formatBackupPointer } from "../src/actions.js";
+
+test("backup pointer cap is 20 latest", () => {
+  assert.equal(BACKUP_POINTER_CAP, 20);
+  const many: BackupPointer[] = Array.from({ length: 25 }, (_, i) =>
+    createBackupPointer("s1", [`o-${i}`], [], 0.5),
+  );
+  const capped = capBackupPointers(many);
+  assert.equal(capped.length, 20);
+  assert.equal(capped[19]!.omittedIds[0], "o-24");
+});
+
+test("createBackupPointer copies id arrays", () => {
+  const omitted = ["omitted-0001"];
+  const p = createBackupPointer("s9", omitted, ["m1"], 0.7);
+  assert.equal(p.sessionId, "s9");
+  assert.deepEqual(p.omittedIds, ["omitted-0001"]);
+  assert.equal(p.budgetRatio, 0.7);
+});
+
+test("write then read returns matching ids with fake storage", async () => {
+  const mem = new Map<string, unknown>();
+  const ctx = {
+    storage: {
+      get: async (k: string) => mem.get(k) ?? undefined,
+      set: async (k: string, v: unknown) => {
+        mem.set(k, v);
+      },
+      remove: async (k: string) => {
+        mem.delete(k);
+      },
+    },
+  } as unknown as Parameters<typeof writeBackupPointer>[0];
+  const written = await writeBackupPointer(ctx, "sess-1", ["omitted-0001"], ["msg-1"], 0.45);
+  const latest = await readLatestBackupPointer(ctx, "sess-1");
+  assert.equal(latest!.omittedIds[0], written.omittedIds[0]);
+  assert.equal(latest!.sessionId, "sess-1");
+});
+
+test("formatBackupPointer renders session plus counts", () => {
+  const p: BackupPointer = {
+    sessionId: "sess-1",
+    createdAtMs: Date.now(),
+    omittedIds: ["omitted-0001", "omitted-0002"],
+    summaryIds: ["m1"],
+    budgetRatio: 0.45,
+  };
+  const text = formatBackupPointer(p);
+  assert.match(text, /sess-1/);
+  assert.match(text, /omissions 2/);
+});
+
+test("T2 malformed pointer storage returns null never throws", async () => {
+  const mem = new Map<string, unknown>([
+    ["backup:s-bad", ["oops", null, { sessionId: 42, createdAtMs: "x" }]],
+  ]);
+  const ctx = {
+    storage: {
+      get: async (k: string) => mem.get(k) ?? undefined,
+      set: async (k: string, v: unknown) => {
+        mem.set(k, v);
+      },
+      remove: async (k: string) => {
+        mem.delete(k);
+      },
+    },
+  } as unknown as Parameters<typeof writeBackupPointer>[0];
+  const latest = await readLatestBackupPointer(ctx, "s-bad");
+  assert.equal(latest, null);
+});
+
+test("T3 invalid formatter input falls back safely", () => {
+  const bad = { sessionId: undefined, createdAtMs: NaN, omittedIds: undefined, summaryIds: undefined, budgetRatio: NaN } as unknown as BackupPointer;
+  const text = formatBackupPointer(bad);
+  assert.match(text, /unknown/);
+  assert.match(text, /omissions 0/);
+});
+
+test("T4 25 storage writes cap to 20 latest", async () => {
+  const mem = new Map<string, unknown>();
+  const ctx = {
+    storage: {
+      get: async (k: string) => mem.get(k) ?? undefined,
+      set: async (k: string, v: unknown) => {
+        mem.set(k, v);
+      },
+      remove: async (k: string) => {
+        mem.delete(k);
+      },
+    },
+  } as unknown as Parameters<typeof writeBackupPointer>[0];
+  for (let i = 0; i < 25; i += 1) {
+    await writeBackupPointer(ctx, "s-cap", [`o-${i}`], [], 0.5);
+  }
+  const raw = (await ctx.storage.get("backup:s-cap") as unknown) as BackupPointer[];
+  assert.equal(raw.length, 20);
+  assert.equal(raw[19]!.omittedIds[0], "o-24");
+});
diff --git a/tests/budget-meter.test.ts b/tests/budget-meter.test.ts
new file mode 100644
index 00000000..75eb410b
--- /dev/null
+++ b/tests/budget-meter.test.ts
@@ -0,0 +1,37 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { BUDGET_EMERGENCY_RATIO, BUDGET_WARN_RATIO, getBudgetState } from "../src/config.js";
+import { formatBudgetMeter } from "../src/actions.js";
+
+test("budget meter thresholds are fixed 0.7 warn 0.9 emergency", () => {
+  assert.equal(BUDGET_WARN_RATIO, 0.7);
+  assert.equal(BUDGET_EMERGENCY_RATIO, 0.9);
+});
+
+test("getBudgetState returns normal warn emergency ratios", () => {
+  assert.equal(getBudgetState(4500, 10000).level, "normal");
+  assert.equal(getBudgetState(7000, 10000).level, "warn");
+  assert.equal(getBudgetState(9000, 10000).level, "emergency");
+  assert.equal(getBudgetState(4500, 10000).ratio, 0.45);
+});
+
+test("getBudgetState is safe on zero limit", () => {
+  const s = getBudgetState(500, 0);
+  assert.equal(s.ratio, 0);
+  assert.equal(s.level, "normal");
+});
+
+test("formatBudgetMeter renders stable display text", () => {
+  const text = formatBudgetMeter({ usedTokens: 4500, limitTokens: 10000, ratio: 0.45, level: "normal" });
+  assert.match(text, /45%/);
+  assert.match(text, /normal/);
+});
+
+test("T5 NaN Infinity negative string inputs stay safe normal", () => {
+  assert.equal(getBudgetState(NaN, 10000).level, "normal");
+  assert.equal(getBudgetState(Infinity, 10000).level, "normal");
+  assert.equal(getBudgetState(-50, 10000).usedTokens, 0);
+  assert.equal(getBudgetState("500" as unknown as number, 10000).level, "normal");
+  const badFmt = formatBudgetMeter({ usedTokens: 1, limitTokens: 2, ratio: NaN, level: "normal" });
+  assert.match(badFmt, /0%/);
+});
diff --git a/tests/prune-order.test.ts b/tests/prune-order.test.ts
new file mode 100644
index 00000000..0f73a167
--- /dev/null
+++ b/tests/prune-order.test.ts
@@ -0,0 +1,67 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { PRUNE_WEIGHTS } from "../src/config.js";
+import { pruneToolResults, rankPruneCandidates, type PruneCandidate } from "../src/prune.js";
+import { emptyState, type Msg } from "../src/types.js";
+
+test("prune weights keep fixed order tool-result first", () => {
+  assert.ok(PRUNE_WEIGHTS["tool-result"] > PRUNE_WEIGHTS.summary);
+  assert.ok(PRUNE_WEIGHTS.summary > PRUNE_WEIGHTS.omission);
+});
+
+test("rankPruneCandidates puts tool-result before summary before omission", () => {
+  const candidates: PruneCandidate[] = [
+    { id: "o1", kind: "omission", sizeTokens: 9000 },
+    { id: "s1", kind: "summary", sizeTokens: 8000 },
+    { id: "t1", kind: "tool-result", sizeTokens: 100 },
+  ];
+  const ranked = rankPruneCandidates(candidates);
+  assert.deepEqual(ranked.map((c) => c.id), ["t1", "s1", "o1"]);
+});
+
+test("rankPruneCandidates orders larger payload first within same kind", () => {
+  const candidates: PruneCandidate[] = [
+    { id: "small", kind: "tool-result", sizeTokens: 10 },
+    { id: "big", kind: "tool-result", sizeTokens: 500 },
+  ];
+  const ranked = rankPruneCandidates(candidates);
+  assert.deepEqual(ranked.map((c) => c.id), ["big", "small"]);
+});
+
+test("rankPruneCandidates never mutates input", () => {
+  const candidates: PruneCandidate[] = [{ id: "a", kind: "summary", sizeTokens: 5 }];
+  const snapshot = [...candidates];
+  rankPruneCandidates(candidates);
+  assert.deepEqual(candidates, snapshot);
+});
+
+test("T1 duplicate callId parts both prune in ranked order", () => {
+  const state = emptyState();
+  const big = "x".repeat(2000);
+  const messages: Msg[] = [
+    {
+      id: "a1",
+      role: "assistant",
+      content: [
+        { type: "tool-result", id: "dup", name: "bash", result: { type: "text", value: big } },
+        { type: "tool-result", id: "dup", name: "bash", result: { type: "text", value: `${big}y` } },
+      ],
+    },
+  ];
+  const out = pruneToolResults(messages, state);
+  // Both parts prune — no collapse through duplicate keys.
+  assert.equal(out.pruned, 2);
+  assert.equal(Object.keys(state.omissions).length, 2);
+});
+
+test("T6 rank empty plus stable tie proves no mutate", () => {
+  assert.deepEqual(rankPruneCandidates([]), []);
+  const tie: PruneCandidate[] = [
+    { id: "a", kind: "summary", sizeTokens: 10 },
+    { id: "b", kind: "summary", sizeTokens: 10 },
+  ];
+  const snap = [...tie];
+  const ranked = rankPruneCandidates(tie);
+  assert.deepEqual(tie, snap);
+  assert.equal(ranked.length, 2);
+});
```
<!-- END_GIT_DIFF -->
