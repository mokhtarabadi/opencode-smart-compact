import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTurns, selectTurns, type HistoryEntry } from "../src/plan.js";

test("buildTurns groups assistant entries under the preceding user turn", () => {
  const entries: HistoryEntry[] = [
    { id: "u1", type: "user", text: "do a thing" },
    { id: "a1", type: "assistant", content: [{ type: "text", text: "thinking" }, { type: "tool", name: "read" }] },
    { id: "a2", type: "assistant", content: [{ type: "text", text: "done" }] },
    { id: "u2", type: "user", text: "next" },
    { id: "a3", type: "assistant", content: [{ type: "text", text: "ok" }] },
  ];
  const turns = buildTurns(entries);
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.userText, "do a thing");
  assert.equal(turns[0]!.assistants.length, 2);
  assert.match(turns[0]!.assistants[0]!.text, /thinking/);
  assert.match(turns[0]!.assistants[0]!.text, /\[tool: read\]/);
  assert.equal(turns[1]!.assistants.length, 1);
});

test("selectTurns keeps the most recent N turns", () => {
  const turns = buildTurns([
    { id: "u1", type: "user", text: "one" },
    { id: "a1", type: "assistant", content: [{ type: "text", text: "x" }] },
    { id: "u2", type: "user", text: "two" },
    { id: "a2", type: "assistant", content: [{ type: "text", text: "y" }] },
    { id: "u3", type: "user", text: "three" },
    { id: "a3", type: "assistant", content: [{ type: "text", text: "z" }] },
  ]);
  assert.equal(selectTurns(turns, 1).length, 2);
  assert.equal(selectTurns(turns, 0).length, 3);
  assert.equal(selectTurns(turns, 99).length, 0);
});
