import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGET_EMERGENCY_RATIO, BUDGET_WARN_RATIO, getBudgetState } from "../src/config.js";
import { formatBudgetMeter } from "../src/actions.js";

test("budget meter thresholds are fixed 0.7 warn 0.9 emergency", () => {
  assert.equal(BUDGET_WARN_RATIO, 0.7);
  assert.equal(BUDGET_EMERGENCY_RATIO, 0.9);
});

test("getBudgetState returns normal warn emergency ratios", () => {
  assert.equal(getBudgetState(4500, 10000).level, "normal");
  assert.equal(getBudgetState(7000, 10000).level, "warn");
  assert.equal(getBudgetState(9000, 10000).level, "emergency");
  assert.equal(getBudgetState(4500, 10000).ratio, 0.45);
});

test("getBudgetState is safe on zero limit", () => {
  const s = getBudgetState(500, 0);
  assert.equal(s.ratio, 0);
  assert.equal(s.level, "normal");
});

test("formatBudgetMeter renders stable display text", () => {
  const text = formatBudgetMeter({ usedTokens: 4500, limitTokens: 10000, ratio: 0.45, level: "normal" });
  assert.match(text, /45%/);
  assert.match(text, /normal/);
});

test("T5 NaN Infinity negative string inputs stay safe normal", () => {
  assert.equal(getBudgetState(NaN, 10000).level, "normal");
  assert.equal(getBudgetState(Infinity, 10000).level, "normal");
  assert.equal(getBudgetState(-50, 10000).usedTokens, 0);
  assert.equal(getBudgetState("500" as unknown as number, 10000).level, "normal");
  const badFmt = formatBudgetMeter({ usedTokens: 1, limitTokens: 2, ratio: NaN, level: "normal" });
  assert.match(badFmt, /0%/);
});
