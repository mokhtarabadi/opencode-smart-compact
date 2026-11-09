import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.js";
import { shouldPrune } from "../src/prune.js";

test("skill is not discarded by default", () => {
  assert.equal("skill" in DEFAULT_CONFIG.pruning.discardTools, false);
  assert.equal(DEFAULT_CONFIG.pruning.discardTools.todowrite, "Successfully updated todos.");
});

test("skill is protected by default", () => {
  assert.deepEqual(DEFAULT_CONFIG.pruning.protectedTools, ["question", "skill"]);
  assert.equal(shouldPrune("skill", "x".repeat(5000)), false);
});
