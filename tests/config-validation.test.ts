import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isOverEmergencyBudget,
  DEFAULT_CONFIG,
  validateConfig,
} from "../src/config.js";

test("validateConfig accepts known keys without warnings", () => {
  assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
  assert.deepEqual(validateConfig({}), []);
});

test("validateConfig names unknown top-level keys", () => {
  const warnings = validateConfig({ bogusTop: 1 });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /bogusTop/);
});

test("validateConfig names unknown nested keys with their path", () => {
  const warnings = validateConfig({ pruning: { nope: 1 }, strategies: { stripReasoning: { huh: 2 } } });
  assert.ok(warnings.some((w) => w.includes("pruning.nope")));
  assert.ok(warnings.some((w) => w.includes("strategies.stripReasoning.huh")));
});

test("isOverEmergencyBudget flags an over-budget history as a warning only", () => {
  // True means "warn", never "abort": an over-budget history must still compact.
  assert.equal(isOverEmergencyBudget(60000, DEFAULT_CONFIG), true);
  assert.equal(isOverEmergencyBudget(100, DEFAULT_CONFIG), false);
  assert.equal(
    isOverEmergencyBudget(999999999, { ...DEFAULT_CONFIG, tokens: { enabled: false, emergencyBudgetTokens: 0 } }),
    false,
  );
});

test("loadConfig merges project config and warns on unknown keys", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-config-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(
    join(dir, ".opencode", "smart-compact.jsonc"),
    '{"pruning": {"maxChars": 10}, "bogusKey": 1}',
  );
  const warned: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => void warned.push(message);
  try {
    const { loadConfig } = await import("../src/config.js");
    const config = await loadConfig({ location: { directory: dir } } as never);
    assert.equal(config.pruning.maxChars, 10);
    assert.ok(warned.some((w) => w.includes("bogusKey")));
  } finally {
    console.warn = original;
  }
});

test("budget guard is advisory: no caller early-returns on an over-budget history", async () => {
  // Regression guard for the deadlock: the budget check must never be followed
  // by a bare early return, or the largest sessions silently lose all
  // compaction relief. The full compactNow path needs a ctx harness plus the
  // model for summarization, so the invariant is pinned at the source seam that
  // caused the bug.
  const { readFile } = await import("node:fs/promises");
  // Tests compile to .test-build/tests, so the repo root is two levels up.
  for (const file of ["../../src/actions.ts", "../../src/index.ts"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    const checkAt = source.indexOf("isOverEmergencyBudget(");
    assert.ok(checkAt > -1, `${file} should call the budget predicate`);
    // The guarded block ends at the next closing brace of the if-statement; an
    // early return inside it is the bug.
    const guardedBlock = source.slice(checkAt, source.indexOf("\n  }", checkAt));
    assert.ok(
      !/return\s+(0|state)\s*;/.test(guardedBlock),
      `${file} must warn and continue, not abort, when over budget`,
    );
  }
});
