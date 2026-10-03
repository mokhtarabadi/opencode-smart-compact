import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.js";
import { applyDeduplication, applyPurgeErrors, stableStringify } from "../src/strategies.js";
import type { Msg } from "../src/types.js";

function toolCall(id: string, name: string, input: unknown) {
  return { type: "tool-call", id, name, input };
}
function toolResult(id: string, name: string, value: unknown, error = false) {
  return { type: "tool-result", id, name, result: { type: error ? "error" : "text", value } };
}

test("stableStringify sorts keys so equal args compare equal", () => {
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
});

test("applyDeduplication keeps the latest identical call", () => {
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [toolCall("c1", "read", { path: "x" }), toolResult("c1", "read", "first")],
    },
    {
      id: "a2",
      role: "assistant",
      content: [toolCall("c2", "read", { path: "x" }), toolResult("c2", "read", "second")],
    },
  ];
  const result = applyDeduplication(messages, DEFAULT_CONFIG);
  assert.equal(result.pruned, 1);
  assert.match((messages[0]!.content[1]!.result as { value: string }).value, /duplicate read output removed/);
  assert.equal((messages[1]!.content[1]!.result as { value: string }).value, "second");
});

test("applyDeduplication leaves distinct calls alone", () => {
  const messages: Msg[] = [
    { id: "a1", role: "assistant", content: [toolCall("c1", "read", { path: "x" }), toolResult("c1", "read", "one")] },
    { id: "a2", role: "assistant", content: [toolCall("c2", "read", { path: "y" }), toolResult("c2", "read", "two")] },
  ];
  assert.equal(applyDeduplication(messages, DEFAULT_CONFIG).pruned, 0);
});

test("applyPurgeErrors blanks errored tool input after the threshold", () => {
  const messages: Msg[] = [
    { id: "u1", role: "user", content: [{ type: "text", text: "go" }] },
    { id: "a1", role: "assistant", content: [toolCall("c1", "bash", { command: "ls" }), toolResult("c1", "bash", "boom", true)] },
  ];
  for (let i = 0; i < 5; i += 1) {
    messages.push({ id: `u${i + 2}`, role: "user", content: [{ type: "text", text: "more" }] });
  }
  const result = applyPurgeErrors(messages, DEFAULT_CONFIG);
  assert.equal(result.pruned, 1);
  assert.deepEqual(messages[1]!.content[0]!.input, { command: "[input removed due to failed tool call]" });
});

test("applyPurgeErrors ignores recent errored calls", () => {
  const messages: Msg[] = [
    { id: "u1", role: "user", content: [{ type: "text", text: "go" }] },
    { id: "a1", role: "assistant", content: [toolCall("c1", "bash", { command: "ls" }), toolResult("c1", "bash", "boom", true)] },
  ];
  assert.equal(applyPurgeErrors(messages, DEFAULT_CONFIG).pruned, 0);
});
