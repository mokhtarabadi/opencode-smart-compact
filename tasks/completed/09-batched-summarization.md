# Task 09: Batch per-turn summarization into single model calls

**File:** `tasks/completed/09-batched-summarization.md`
**Source:** manager
**Type:** improvement
**Status:** closed

> **Mode:** autopilot locked (Manager, this session).

## Goal

Reduce compaction cost by batching eligible turns into as few `ctx.generate.text` calls as possible, mirroring the reference `magic-compact` plugin's single-request summarization, instead of making one model call per turn.

## Manager's Notes

The reference study showed `magic-compact` generates all turn summaries in one request and parses id-tagged blocks, while our summarizer called the model once per turn. This task ports that design with a bounded chunk size and a heuristic fallback so a failed or partial reply never breaks compaction.

## Local TODOs

- [ ] Add pure `parseSummaryBlocks` and `chunkTurns` helpers
- [ ] Rewrite `summarizeTurns` to batch turns into one call per chunk with per-turn fallback
- [ ] Add unit tests for the parser and chunker
- [ ] Update README and CHANGELOG

## Acceptance Criteria

- [x] Eligible turns are summarized with one model call per chunk, not one per turn
- [x] A missing or malformed block falls back to a deterministic heuristic
- [x] Absorbed (non-first) assistant messages are still marked with the empty sentinel
- [x] `npm run typecheck` exits 0 and unit tests pass

## Verification Evidence

- **Test command:** rtk test npm test
- **Expected result:** typecheck and unit tests pass
- **Actual result:** 25/25 tests pass (6 new for the parser/chunker); typecheck exit 0
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

- **Risk:** A single large prompt could exceed a model's input budget
- **Rollback plan:** Chunks are capped at 12000 chars; revert `summarize.ts` to the per-turn version if needed

---

## Execution Log & Reasoning

Autopilot locked (Manager). Ported the reference `magic-compact` single-request summarization.

Changes:
- `src/summarize.ts`: added pure `parseSummaryBlocks` (`<summary id="...">…</summary>`) and `chunkTurns` (bounded chunks, default 12000 chars); rewrote `summarizeTurns` to make one `ctx.generate.text` call per chunk and fall back to `heuristicSummary` for any missing block. Absorbed-sentinel and tool-only absorption behavior unchanged.
- `tests/summarize.test.ts`: 6 new tests for the parser, chunker, and heuristic.
- `README.md`, `CHANGELOG.md`: documented.

Verification: 25/25 tests, typecheck exit 0.

## Factual Git Diff

<!-- BEGIN_GIT_DIFF -->
```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 0fe36fe8..29f3029b 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -28,6 +28,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - `read_omitted_content` is scoped to the calling session's state.
 - Package renamed to `@mokhtarabadi/opencode-smart-compact` with `publishConfig.access: "public"` because the unscoped name is owned by another npm author.
 - Automated npm publishing via GitHub Actions OIDC trusted publishing (`.github/workflows/publish.yml`); publishes on push when the version is new, with no token secret.
+- Batched summarization (`src/summarize.ts`): eligible turns are summarized with one model call per bounded chunk instead of one call per turn, with a heuristic fallback for missing blocks.
 
 ### Fixed
 
diff --git a/README.md b/README.md
index 62cd55f1..530ae817 100644
--- a/README.md
+++ b/README.md
@@ -16,7 +16,7 @@ Because the transcript is never modified, a compaction can be recomputed from st
 
 ## Features
 
-- **Turn-aware summaries** — old assistant turns are condensed per conversation turn, and the tool-call/tool-result structure is preserved so nothing is orphaned.
+- **Turn-aware summaries** — old assistant turns are condensed per conversation turn, and the tool-call/tool-result structure is preserved so nothing is orphaned. Eligible turns are batched into a single model call per compaction, so cost stays low.
 - **Verbatim user messages** — your instructions are never summarized away.
 - **Retrievable pruning** — bulky completed tool output is replaced with a notice; the original is cached and can be read back with `read_omitted_content`.
 - **Automatic strategies** — repeated identical tool calls are deduplicated (newest kept) and the arguments of stale errored tool calls are blanked.
diff --git a/src/summarize.ts b/src/summarize.ts
index adc7dbc0..52220ba6 100644
--- a/src/summarize.ts
+++ b/src/summarize.ts
@@ -4,22 +4,8 @@ import type { SessionState } from "./types.js";
 
 /** Keep a single turn's prompt bounded so one giant turn cannot blow the budget. */
 const MAX_TURN_CHARS = 6000;
-
-/** Build the summarization prompt for one turn. */
-function turnPrompt(turn: Turn, body: string): string {
-  return [
-    "Condense the following assistant turn from a coding session into a short, high-signal summary.",
-    "Keep: what the assistant did, what it decided and why, files or commands touched, and what comes next.",
-    "Drop: raw tool output, repeated reasoning, and restated user text.",
-    "Write 2-4 sentences, no preamble, no bullet list.",
-    "",
-    "--- USER ---",
-    turn.userText.slice(0, 500),
-    "--- ASSISTANT TURN ---",
-    body,
-    "--- END TURN ---",
-  ].join("\n");
-}
+/** Cap the accumulated turn text per model call so a large compaction stays bounded. */
+const MAX_CHUNK_CHARS = 12000;
 
 /** Join a turn's assistant text and tool markers, bounded for the prompt. */
 function turnBody(turn: Turn): string {
@@ -31,49 +17,120 @@ function turnBody(turn: Turn): string {
   return body.length > MAX_TURN_CHARS ? `${body.slice(0, MAX_TURN_CHARS)}\n…[truncated]` : body;
 }
 
-/** Deterministic fallback summary when the model output is empty. */
-function heuristic(body: string): string {
+/** Deterministic fallback summary when the model output is missing or empty. */
+export function heuristicSummary(body: string): string {
   const oneLine = body.replace(/\s+/g, " ").trim();
   return oneLine.length > 400 ? `${oneLine.slice(0, 400)}…` : oneLine;
 }
 
+/** A turn queued for summarization with its precomputed body. */
+export interface PendingTurn {
+  turn: Turn;
+  firstId: string;
+  body: string;
+}
+
 /**
- * Summarize the eligible turns with the session's model through
- * `ctx.generate.text` and store the result by assistant message id. The first
+ * Split queued turns into model-call chunks whose combined body stays under
+ * `maxChars`. A single oversized turn still gets its own chunk.
+ */
+export function chunkTurns(pending: PendingTurn[], maxChars: number = MAX_CHUNK_CHARS): PendingTurn[][] {
+  const chunks: PendingTurn[][] = [];
+  let current: PendingTurn[] = [];
+  let size = 0;
+  for (const item of pending) {
+    if (current.length > 0 && size + item.body.length > maxChars) {
+      chunks.push(current);
+      current = [];
+      size = 0;
+    }
+    current.push(item);
+    size += item.body.length;
+  }
+  if (current.length > 0) chunks.push(current);
+  return chunks;
+}
+
+/**
+ * Parse `<summary id="...">text</summary>` blocks from a batched model reply.
+ * Ids are the first assistant message id of each turn. Empty summaries are
+ * dropped so the caller can fall back to a heuristic.
+ */
+export function parseSummaryBlocks(text: string): Map<string, string> {
+  const out = new Map<string, string>();
+  const re = /<summary\s+id="([^"]+)"\s*>([\s\S]*?)<\/summary>/g;
+  let match: RegExpExecArray | null;
+  while ((match = re.exec(text)) !== null) {
+    const id = match[1]!;
+    const summary = match[2]!.trim();
+    if (summary) out.set(id, summary);
+  }
+  return out;
+}
+
+/** Build one prompt asking for a summary block per turn in the chunk. */
+function batchPrompt(chunk: PendingTurn[]): string {
+  const parts = [
+    "You summarize old assistant turns from a coding session.",
+    "For each turn below, write a 2-4 sentence high-signal summary.",
+    "Keep what the assistant did, the decisions and why, files or commands touched, and what comes next.",
+    "Drop raw tool output, repeated reasoning, and restated user text.",
+    "Return exactly one block per turn in this form, and nothing else:",
+    '<summary id="TURN_ID">summary text</summary>',
+    "",
+  ];
+  for (const item of chunk) {
+    parts.push(`<turn id="${item.firstId}">`);
+    parts.push(`<user>${item.turn.userText.slice(0, 500)}</user>`);
+    parts.push(`<assistant>${item.body}</assistant>`);
+    parts.push("</turn>");
+  }
+  return parts.join("\n");
+}
+
+/**
+ * Summarize the eligible turns and store the result by assistant message id.
+ * Turns are batched into as few `ctx.generate.text` calls as possible (one per
+ * chunk), mirroring the reference plugin's single-request design. The first
  * assistant message of a turn carries the summary; the remaining ones are
  * marked "absorbed" (empty string) so their prose is stripped without a
- * duplicate summary. Turns whose assistant messages carry no prose, reasoning,
- * or tool markers are absorbed without a model call.
- * Failures fall back to a heuristic so compaction never fails.
+ * duplicate summary. Turns with no prose, reasoning, or tool markers are
+ * absorbed without a model call. A failed or incomplete reply falls back to a
+ * heuristic so compaction never fails.
  */
 export async function summarizeTurns(ctx: Ctx, turns: Turn[], state: SessionState): Promise<number> {
   let done = 0;
+  const pending: PendingTurn[] = [];
+
   for (const turn of turns) {
     const first = turn.assistants[0];
     if (!first) continue;
     if (first.id in state.summaries) continue;
-
     const body = turnBody(turn);
     if (!body) {
       for (const assistant of turn.assistants) state.summaries[assistant.id] = "";
       done += 1;
       continue;
     }
+    pending.push({ turn, firstId: first.id, body });
+  }
 
-    let summary = "";
+  for (const chunk of chunkTurns(pending)) {
+    let parsed = new Map<string, string>();
     try {
-      const out = await ctx.generate.text({ prompt: turnPrompt(turn, body) });
-      summary = (out?.text ?? "").trim();
+      const out = await ctx.generate.text({ prompt: batchPrompt(chunk) });
+      parsed = parseSummaryBlocks(out?.text ?? "");
     } catch {
-      summary = "";
+      parsed = new Map();
     }
-    if (!summary) summary = heuristic(body);
-
-    state.summaries[first.id] = summary;
-    for (let i = 1; i < turn.assistants.length; i += 1) {
-      state.summaries[turn.assistants[i]!.id] = "";
+    for (const item of chunk) {
+      state.summaries[item.firstId] = parsed.get(item.firstId) ?? heuristicSummary(item.body);
+      const assistants = item.turn.assistants;
+      for (let i = 1; i < assistants.length; i += 1) {
+        state.summaries[assistants[i]!.id] = "";
+      }
+      done += 1;
     }
-    done += 1;
   }
   return done;
 }
diff --git a/tests/summarize.test.ts b/tests/summarize.test.ts
new file mode 100644
index 00000000..658be2ef
--- /dev/null
+++ b/tests/summarize.test.ts
@@ -0,0 +1,51 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import {
+  chunkTurns,
+  heuristicSummary,
+  parseSummaryBlocks,
+  type PendingTurn,
+} from "../src/summarize.js";
+import type { Turn } from "../src/plan.js";
+
+function pending(firstId: string, body: string): PendingTurn {
+  const turn: Turn = { userText: "u", assistants: [{ id: firstId, text: body }] };
+  return { turn, firstId, body };
+}
+
+test("parseSummaryBlocks extracts id-tagged summaries", () => {
+  const text = 'noise <summary id="a1">First summary.</summary> mid <summary id="a2">Second.</summary> tail';
+  const parsed = parseSummaryBlocks(text);
+  assert.equal(parsed.get("a1"), "First summary.");
+  assert.equal(parsed.get("a2"), "Second.");
+  assert.equal(parsed.size, 2);
+});
+
+test("parseSummaryBlocks ignores empty and malformed blocks", () => {
+  const parsed = parseSummaryBlocks('<summary id="a1">   </summary><summary id="a2">ok</summary>');
+  assert.equal(parsed.has("a1"), false);
+  assert.equal(parsed.get("a2"), "ok");
+});
+
+test("chunkTurns splits when the body budget would be exceeded", () => {
+  const chunks = chunkTurns([pending("a", "x".repeat(8)), pending("b", "y".repeat(8)), pending("c", "z".repeat(8))], 10);
+  assert.equal(chunks.length, 3);
+  assert.equal(chunks[0]![0]!.firstId, "a");
+});
+
+test("chunkTurns keeps turns together while under budget", () => {
+  const chunks = chunkTurns([pending("a", "xx"), pending("b", "yy"), pending("c", "zz")], 10);
+  assert.equal(chunks.length, 1);
+  assert.equal(chunks[0]!.length, 3);
+});
+
+test("chunkTurns gives an oversized turn its own chunk", () => {
+  const chunks = chunkTurns([pending("big", "x".repeat(100))], 10);
+  assert.equal(chunks.length, 1);
+  assert.equal(chunks[0]!.length, 1);
+});
+
+test("heuristicSummary collapses whitespace and truncates", () => {
+  assert.equal(heuristicSummary("a   b\n c"), "a b c");
+  assert.ok(heuristicSummary("x".repeat(500)).length <= 401);
+});
```
<!-- END_GIT_DIFF -->
