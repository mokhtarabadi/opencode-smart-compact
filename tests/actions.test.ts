import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompactArgs } from "../src/actions.js";

test("parseCompactArgs defaults to compact-all", () => {
  assert.deepEqual(parseCompactArgs(undefined), { mode: "compact", keepTurns: 0 });
  assert.deepEqual(parseCompactArgs({}), { mode: "compact", keepTurns: 0 });
});

test("parseCompactArgs honors mode trim", () => {
  assert.deepEqual(parseCompactArgs({ mode: "trim" }), { mode: "trim", keepTurns: 0 });
});

test("parseCompactArgs treats an unknown mode as compact", () => {
  assert.deepEqual(parseCompactArgs({ mode: "nonsense" }), { mode: "compact", keepTurns: 0 });
});

test("parseCompactArgs accepts a non-negative integer keepTurns", () => {
  assert.deepEqual(parseCompactArgs({ keepTurns: 3, mode: "trim" }), { mode: "trim", keepTurns: 3 });
  assert.deepEqual(parseCompactArgs({ keepTurns: 0 }), { mode: "compact", keepTurns: 0 });
});

test("parseCompactArgs rejects a negative, fractional, or non-numeric keepTurns", () => {
  for (const bad of [-1, 1.5, "2", Number.NaN]) {
    assert.throws(() => parseCompactArgs({ keepTurns: bad }), /non-negative integer/);
  }
});
