import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countTokens,
  estimateTokensFallback,
  isTokenizerAvailable,
  measurementPath,
} from "../src/tokens.js";

test("estimateTokensFallback returns 0 for empty and ceil(len/4) otherwise", () => {
  assert.equal(estimateTokensFallback(""), 0);
  assert.equal(estimateTokensFallback("abcdefgh"), 2);
  assert.equal(estimateTokensFallback("abcdefghi"), 3);
});

test("countTokens honors the disabled flag and uses the fallback", () => {
  assert.equal(countTokens("abcdefgh", false), 2);
  assert.equal(countTokens("", false), 0);
});

test("measurementPath names the path that actually produced the numbers", () => {
  // Disabled measurement always reports the heuristic, even if a tokenizer is
  // installed; enabled measurement reports tokenizer only when it loaded.
  assert.equal(measurementPath(false), "heuristic");
  assert.equal(measurementPath(true), isTokenizerAvailable() ? "tokenizer" : "heuristic");
});

test("countTokens falls back when no tokenizer is available", () => {
  if (!isTokenizerAvailable()) {
    assert.equal(countTokens("abcdefgh", true), estimateTokensFallback("abcdefgh"));
  } else {
    assert.ok(Number.isFinite(countTokens("abcdefgh", true)));
  }
  // The test seam forces each fallback branch without touching the loader.
  assert.equal(countTokens("abcdefgh", true, null), 2);
  assert.equal(
    countTokens("abcdefgh", true, {
      countTokens: () => {
        throw new Error("boom");
      },
    }),
    2,
  );
  assert.equal(countTokens("abcdefgh", true, { countTokens: () => NaN }), 2);
  assert.equal(countTokens("abcdefgh", true, { countTokens: () => -5 }), 2);
  assert.equal(countTokens("abcdefgh", true, { countTokens: () => 7 }), 7);
});
