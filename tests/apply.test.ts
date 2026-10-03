import { test } from "node:test";
import assert from "node:assert/strict";
import { applySummaries } from "../src/apply.js";
import { emptyState, type Msg } from "../src/types.js";

test("applySummaries preserves tool parts and replaces prose", () => {
  const state = emptyState();
  state.summaries["a1"] = "Read the config and edited it.";
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [
        { type: "reasoning", text: "long reasoning" },
        { type: "tool-call", id: "call-1", name: "read", input: {} },
        { type: "tool-result", id: "call-1", name: "read", result: { type: "text", value: "data" } },
        { type: "text", text: "here is my answer" },
      ],
    },
  ];
  const applied = applySummaries(messages, state);
  assert.equal(applied, 1);
  const types = messages[0]!.content.map((p) => p.type);
  assert.ok(types.includes("tool-call"));
  assert.ok(types.includes("tool-result"));
  assert.ok(!types.includes("reasoning"));
  const summaryPart = messages[0]!.content.find((p) => typeof p.text === "string" && p.text.includes("summarized turn"));
  assert.ok(summaryPart);
  assert.match(summaryPart!.text as string, /Read the config/);
});

test("applySummaries strips prose for an absorbed (empty) summary", () => {
  const state = emptyState();
  state.summaries["a2"] = "";
  const messages: Msg[] = [
    { id: "a2", role: "assistant", content: [{ type: "text", text: "extra" }, { type: "tool-call", id: "c", name: "x", input: {} }] },
  ];
  applySummaries(messages, state);
  assert.deepEqual(messages[0]!.content.map((p) => p.type), ["tool-call"]);
});

test("applySummaries is idempotent", () => {
  const state = emptyState();
  state.summaries["a1"] = "sum";
  const messages: Msg[] = [{ id: "a1", role: "assistant", content: [{ type: "text", text: "orig" }] }];
  assert.equal(applySummaries(messages, state), 1);
  assert.equal(applySummaries(messages, state), 0);
});
