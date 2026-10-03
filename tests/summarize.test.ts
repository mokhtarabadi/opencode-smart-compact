import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunkTurns,
  heuristicSummary,
  parseSummaryBlocks,
  type PendingTurn,
} from "../src/summarize.js";
import type { Turn } from "../src/plan.js";

function pending(firstId: string, body: string): PendingTurn {
  const turn: Turn = { userText: "u", assistants: [{ id: firstId, text: body }] };
  return { turn, firstId, body };
}

test("parseSummaryBlocks extracts id-tagged summaries", () => {
  const text = 'noise <summary id="a1">First summary.</summary> mid <summary id="a2">Second.</summary> tail';
  const parsed = parseSummaryBlocks(text);
  assert.equal(parsed.get("a1"), "First summary.");
  assert.equal(parsed.get("a2"), "Second.");
  assert.equal(parsed.size, 2);
});

test("parseSummaryBlocks ignores empty and malformed blocks", () => {
  const parsed = parseSummaryBlocks('<summary id="a1">   </summary><summary id="a2">ok</summary>');
  assert.equal(parsed.has("a1"), false);
  assert.equal(parsed.get("a2"), "ok");
});

test("chunkTurns splits when the body budget would be exceeded", () => {
  const chunks = chunkTurns([pending("a", "x".repeat(8)), pending("b", "y".repeat(8)), pending("c", "z".repeat(8))], 10);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0]![0]!.firstId, "a");
});

test("chunkTurns keeps turns together while under budget", () => {
  const chunks = chunkTurns([pending("a", "xx"), pending("b", "yy"), pending("c", "zz")], 10);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]!.length, 3);
});

test("chunkTurns gives an oversized turn its own chunk", () => {
  const chunks = chunkTurns([pending("big", "x".repeat(100))], 10);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]!.length, 1);
});

test("heuristicSummary collapses whitespace and truncates", () => {
  assert.equal(heuristicSummary("a   b\n c"), "a b c");
  assert.ok(heuristicSummary("x".repeat(500)).length <= 401);
});
