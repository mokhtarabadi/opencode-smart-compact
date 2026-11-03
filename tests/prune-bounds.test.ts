import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, type SmartCompactConfig } from "../src/config.js";
import { pruneToolResults } from "../src/prune.js";
import { selectTurns, type Turn } from "../src/plan.js";
import { emptyState, type Msg } from "../src/types.js";

// Omission originals live on disk; keep every test inside a temp directory.
process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-bounds-data-"));

function withPruning(patch: Partial<SmartCompactConfig["pruning"]>): SmartCompactConfig {
  return { ...DEFAULT_CONFIG, pruning: { ...DEFAULT_CONFIG.pruning, ...patch } };
}

function userMsg(id: string): Msg {
  return { id, role: "user", content: [{ type: "text", text: "hello" }] };
}

function bigResult(id: string): Msg {
  return {
    id,
    role: "assistant",
    content: [{ type: "tool-result", id, name: "bash", result: { type: "text", value: "x".repeat(2000) } }],
  };
}

test("preserve-recent window keeps the last turn unpruned", () => {
  const config = withPruning({ preserveRecentTurns: 1 });
  const messages: Msg[] = [userMsg("u1"), bigResult("c1"), userMsg("u2"), bigResult("c2")];
  const result = pruneToolResults(messages, emptyState(), config);
  // c1 sits in an older turn and is pruned; c2 sits in the recent window.
  assert.equal(result.pruned, 1);
  const second = (messages[3]!.content[0]!.result as { value: string }).value;
  assert.equal(second, "x".repeat(2000));
});

test("a large preserve window keeps a single-turn session intact", () => {
  const config = withPruning({ preserveRecentTurns: 5 });
  const messages: Msg[] = [userMsg("u1"), bigResult("c1")];
  assert.equal(pruneToolResults(messages, emptyState(), config).pruned, 0);
});

test("truncate cap prunes over-long results with the full original cached", () => {
  // 500 chars sits well under the 2000-char / 1000-word size limit, so only
  // the 100-char truncate cap can prune here — isolating the cap behavior.
  const config = withPruning({
    preserveRecentTurns: 0,
    maxChars: 2000,
    maxWords: 1000,
    truncateToolsChars: 100,
  });
  const content = "y".repeat(500);
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "tool-result", id: "c1", name: "bash", result: { type: "text", value: content } }],
    },
  ];
  const state = emptyState();
  const result = pruneToolResults(messages, state, config, "ses-bounds");
  assert.equal(result.pruned, 1);
  // The full original is cached in the per-session file, never in the state blob.
  const record = state.omissions["omitted-0001"]!;
  assert.equal(record.content, undefined);
  assert.equal(readFileSync(record.path!, "utf8"), content);
});

test("token-measured decisions prune by token budget when enabled", () => {
  // A single 500-char word stays under the 5000-char / 10-word size limit,
  // so the chars path keeps it while the token path (125 > 10) prunes it.
  const config = withPruning({ preserveRecentTurns: 0, truncateToolsChars: 0, maxChars: 5000, maxWords: 10, useTokens: true });
  const small: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "tool-result", id: "c1", name: "bash", result: { type: "text", value: "short" } }],
    },
  ];
  assert.equal(pruneToolResults(small, emptyState(), config).pruned, 0);
  const big: Msg[] = [
    {
      id: "a2",
      role: "assistant",
      content: [{ type: "tool-result", id: "c2", name: "bash", result: { type: "text", value: "x".repeat(500) } }],
    },
  ];
  assert.equal(pruneToolResults(big, emptyState(), config).pruned, 1);
});

test("selectTurns preserves recent turns and the last user message", () => {
  const turns: Turn[] = [
    { userText: "first", assistants: [{ id: "a1", text: "one" }] },
    { userText: "second", assistants: [{ id: "a2", text: "two" }] },
    { userText: "last", assistants: [{ id: "a3", text: "three" }] },
  ];
  const eligible = selectTurns(turns, 0, 2);
  assert.equal(eligible.length, 1);
  assert.ok(!eligible.some((t) => t.userText === "last"));
});
