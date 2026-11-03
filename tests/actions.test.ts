import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCompactArgs, formatStats } from "../src/actions.js";
import { emptyState } from "../src/types.js";
import { PLUGIN_VERSION } from "../src/version.js";

test("the plugin version resolves from package.json", () => {
  // F8: a review must be able to prove which code produced the numbers.
  assert.match(PLUGIN_VERSION, /^\d+\.\d+\.\d+/);
});

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

test("formatStats renders a fresh session as all zeros", () => {
  const text = formatStats(emptyState());
  assert.equal(
    text,
    `[smart-compact] version ${PLUGIN_VERSION}; pruned ~0 tokens across 0 tool results; ` +
      "summarized 0 turns (fallbacks: 0); 0 cached omissions; last run 0ms; " +
      "measurement heuristic; window unknown (no model seen yet — awareness off).",
  );
});

test("formatStats reports counters, cache size and the measurement path", () => {
  const state = emptyState();
  state.stats = {
    prunedTokens: 1200,
    summarizedTurns: 4,
    prunedParts: 9,
    summaryFallbacks: 3,
    lastRun: 1792837690007,
    lastRunMs: 12,
    measurementPath: "tokenizer",
  };
  state.omissions = {
    "omitted-0001": { id: "omitted-0001", callId: "c1", name: "shell", tokens: 40, path: "/tmp/x" },
  };
  const text = formatStats(state);
  assert.match(text, /pruned ~1200 tokens across 9 tool results/);
  assert.match(text, /summarized 4 turns \(fallbacks: 3\); 1 cached omissions/);
  assert.match(text, /last run 12ms; measurement tokenizer;/);
});

test("formatStats fails over to the heuristic measurement path", () => {
  const state = emptyState();
  state.stats = {
    ...state.stats,
    measurementPath: "heuristic",
  };
  const text = formatStats(state);
  assert.match(text, /measurement heuristic/);
});

test("formatStats never renders NaN for malformed counters", () => {
  const state = emptyState();
  state.stats = { prunedTokens: Number.NaN, summarizedTurns: 2, prunedParts: 1, summaryFallbacks: 0 };
  const text = formatStats(state);
  assert.match(text, /pruned ~0 tokens/);
  assert.equal(text.includes("NaN"), false);
});

test("formatStats names the resolved window and model", () => {
  const state = emptyState();
  state.awarenessWindow = 1048576;
  state.awarenessModel = "opencode-go/muse-spark-1.3-contributor";
  const text = formatStats(state);
  assert.match(text, /window 1048576 \(opencode-go\/muse-spark-1\.3-contributor\)\./);
});

test("formatStats marks a denominator supplied by config, not the registry", () => {
  const state = emptyState();
  state.awarenessWindow = 200_000;
  state.awarenessWindowSource = "config";
  state.awarenessModel = "custom/acme-1";
  const text = formatStats(state);
  assert.match(text, /window 200000 \(custom\/acme-1 — configured\)\./);
});

test("formatStats names the model the registry failed on", () => {
  const state = emptyState();
  state.awarenessWindow = undefined;
  state.awarenessModel = "custom/acme-1";
  const text = formatStats(state);
  assert.match(text, /window unknown \(custom\/acme-1 — awareness off\)\./);
});

test("formatStats never renders NaN for a malformed window", () => {
  const state = emptyState();
  state.awarenessWindow = Number.NaN;
  state.awarenessModel = "";
  const text = formatStats(state);
  assert.match(text, /window unknown \(no model seen yet — awareness off\)\./);
  assert.equal(text.includes("NaN"), false);
});
