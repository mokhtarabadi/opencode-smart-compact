import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkBudgetGuard,
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

test("checkBudgetGuard aborts over budget and stays quiet otherwise", () => {
  assert.equal(checkBudgetGuard(60000, DEFAULT_CONFIG), true);
  assert.equal(checkBudgetGuard(100, DEFAULT_CONFIG), false);
  assert.equal(checkBudgetGuard(999999999, { ...DEFAULT_CONFIG, tokens: { enabled: false, emergencyBudgetTokens: 0 } }), false);
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
