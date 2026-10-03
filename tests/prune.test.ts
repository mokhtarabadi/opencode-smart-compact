import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOmissions,
  pruneToolResults,
  shouldPrune,
} from "../src/prune.js";
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

test("applyOmissions replays a stored omission onto a fresh message", () => {
  const state = emptyState();
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
