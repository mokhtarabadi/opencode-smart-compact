import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOmissions,
  pruneToolResults,
  shouldPrune,
} from "../src/prune.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { emptyState, type Msg } from "../src/types.js";

test("shouldPrune applies per-tool rules", () => {
  assert.equal(shouldPrune("read", "short"), true);
  assert.equal(shouldPrune("question", "x".repeat(5000)), false);
  assert.equal(shouldPrune("todowrite", "x".repeat(5000)), false);
  assert.equal(shouldPrune("task", "short output"), false);
  assert.equal(shouldPrune("task", "x".repeat(5000)), true);
  assert.equal(shouldPrune("bash", "short"), false);
  assert.equal(shouldPrune("bash", "x".repeat(2000)), true);
});

test("shouldPrune honors custom protected tools from config", () => {
  // Defaults prune both bash and write output at this size ...
  assert.equal(shouldPrune("bash", "x".repeat(5000), DEFAULT_CONFIG), true);
  assert.equal(shouldPrune("write", "x".repeat(5000), DEFAULT_CONFIG), true);
  // ... while a custom protected list keeps write (question stays safe).
  const config = {
    ...DEFAULT_CONFIG,
    pruning: { ...DEFAULT_CONFIG.pruning, protectedTools: ["question", "write", "edit", "plan"] },
  };
  assert.equal(shouldPrune("question", "x".repeat(5000), config), false);
  assert.equal(shouldPrune("write", "x".repeat(5000), config), false);
  assert.equal(shouldPrune("bash", "x".repeat(5000), config), true);
});

test("pruneToolResults allocates monotonic ids and caches originals", () => {
  const state = emptyState();
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [
        { type: "tool-result", id: "call-1", name: "read", result: { type: "text", value: "original file text" } },
      ],
    },
  ];
  const first = pruneToolResults(messages, state);
  assert.equal(first.pruned, 1);
  assert.ok(state.omissions["omitted-0001"]);
  assert.equal(state.omissions["omitted-0001"]!.content, "original file text");
  assert.equal(state.nextOmissionId, 2);

  // A second, distinct call must not reuse omitted-0001.
  const messages2: Msg[] = [
    {
      id: "a2",
      role: "assistant",
      content: [
        { type: "tool-result", id: "call-2", name: "read", result: { type: "text", value: "another file" } },
      ],
    },
  ];
  pruneToolResults(messages2, state);
  assert.ok(state.omissions["omitted-0002"]);
});

test("pruneToolResults discards todowrite without caching", () => {
  const state = emptyState();
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [
        { type: "tool-result", id: "call-todo", name: "todowrite", result: { type: "text", value: "big todo payload" } },
      ],
    },
  ];
  pruneToolResults(messages, state);
  assert.equal(Object.keys(state.omissions).length, 0);
  assert.deepEqual(messages[0]!.content[0]!.result, { type: "text", value: "Successfully updated todos." });
});

test("applyOmissions replays a stored omission onto a fresh message", () => {  const state = emptyState();
  state.omissions["omitted-0001"] = {
    id: "omitted-0001",
    callId: "call-1",
    name: "read",
    content: "original",
    tokens: 2,
  };
  state.omittedCalls["call-1"] = "omitted-0001";
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "tool-result", id: "call-1", name: "read", result: { type: "text", value: "original" } }],
    },
  ];
  applyOmissions(messages, state);
  const value = (messages[0]!.content[0]!.result as { value: string }).value;
  assert.match(value, /omitted-0001/);
});

test("applyOmissions fails closed when the cached original is gone", () => {
  const state = emptyState();
  // The call mapping survived but the cached record was cleared by a newer run.
  state.omittedCalls["call-9"] = "omitted-0009";
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "tool-result", id: "call-9", name: "read", result: { type: "text", value: "original" } }],
    },
  ];
  applyOmissions(messages, state);
  const value = (messages[0]!.content[0]!.result as { value: string }).value;
  assert.match(value, /omitted-0009/);
  assert.match(value, /cleared/);
});

test("emptyState carries the new stats fields and an empty memo", () => {
  const stats = emptyState().stats;
  assert.equal(stats.savedTokens, 0);
  assert.equal(stats.tokenizerUsed ?? false, false);
  assert.deepEqual(emptyState().pruneMemo, {});
});

test("pruneToolResults reuses memoized measurement for identical content", () => {
  const big = "x".repeat(2000);
  const make = (): Msg[] => [
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "tool-result", id: "c1", name: "bash", result: { type: "text", value: big } }],
    },
  ];
  const state = emptyState();
  const first = pruneToolResults(make(), state);
  assert.equal(first.pruned, 1);
  assert.equal(first.memoHits, 0);
  // Simulate a fresh pass over the same content (mapping cleared).
  delete state.omittedCalls["c1"];
  delete state.omissions["omitted-0001"];
  const second = pruneToolResults(make(), state);
  assert.equal(second.pruned, 1);
  assert.equal(second.memoHits, 1);
  assert.equal(second.tokens, first.tokens);
});
