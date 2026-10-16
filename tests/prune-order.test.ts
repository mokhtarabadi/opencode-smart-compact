import { test } from "node:test";
import assert from "node:assert/strict";
import { PRUNE_WEIGHTS } from "../src/config.js";
import { pruneToolResults, rankPruneCandidates, type PruneCandidate } from "../src/prune.js";
import { emptyState, type Msg } from "../src/types.js";

test("prune weights keep fixed order tool-result first", () => {
  assert.ok(PRUNE_WEIGHTS["tool-result"] > PRUNE_WEIGHTS.summary);
  assert.ok(PRUNE_WEIGHTS.summary > PRUNE_WEIGHTS.omission);
});

test("rankPruneCandidates puts tool-result before summary before omission", () => {
  const candidates: PruneCandidate[] = [
    { id: "o1", kind: "omission", sizeTokens: 9000 },
    { id: "s1", kind: "summary", sizeTokens: 8000 },
    { id: "t1", kind: "tool-result", sizeTokens: 100 },
  ];
  const ranked = rankPruneCandidates(candidates);
  assert.deepEqual(ranked.map((c) => c.id), ["t1", "s1", "o1"]);
});

test("rankPruneCandidates orders larger payload first within same kind", () => {
  const candidates: PruneCandidate[] = [
    { id: "small", kind: "tool-result", sizeTokens: 10 },
    { id: "big", kind: "tool-result", sizeTokens: 500 },
  ];
  const ranked = rankPruneCandidates(candidates);
  assert.deepEqual(ranked.map((c) => c.id), ["big", "small"]);
});

test("rankPruneCandidates never mutates input", () => {
  const candidates: PruneCandidate[] = [{ id: "a", kind: "summary", sizeTokens: 5 }];
  const snapshot = [...candidates];
  rankPruneCandidates(candidates);
  assert.deepEqual(candidates, snapshot);
});

test("T1 duplicate callId parts both prune in ranked order", () => {
  const state = emptyState();
  const big = "x".repeat(2000);
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [
        { type: "tool-result", id: "dup", name: "bash", result: { type: "text", value: big } },
        { type: "tool-result", id: "dup", name: "bash", result: { type: "text", value: `${big}y` } },
      ],
    },
  ];
  const out = pruneToolResults(messages, state);
  // Both parts prune — no collapse through duplicate keys.
  assert.equal(out.pruned, 2);
  assert.equal(Object.keys(state.omissions).length, 2);
});

test("T6 rank empty plus stable tie proves no mutate", () => {
  assert.deepEqual(rankPruneCandidates([]), []);
  const tie: PruneCandidate[] = [
    { id: "a", kind: "summary", sizeTokens: 10 },
    { id: "b", kind: "summary", sizeTokens: 10 },
  ];
  const snap = [...tie];
  const ranked = rankPruneCandidates(tie);
  assert.deepEqual(tie, snap);
  assert.equal(ranked.length, 2);
});
