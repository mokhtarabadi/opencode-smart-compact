import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isOverEmergencyBudget,
  resolveEmergencyBudget,
  DEFAULT_CONFIG,
  validateConfig,
} from "../src/config.js";

// Isolate the suite from the developer's real global config, so a machine that
// configures `~/.config/opencode/smart-compact.jsonc` cannot change the
// assertions below.
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "smart-compact-xdg-"));

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

test("the emergency budget derives from the window so a 1M session can satisfy it", () => {
  // 60 percent of a 1M window: quiet during normal work, fires near the line.
  assert.equal(resolveEmergencyBudget(DEFAULT_CONFIG, 1_000_000), 600_000);
  assert.equal(isOverEmergencyBudget(100_000, DEFAULT_CONFIG, 1_000_000), false);
  assert.equal(isOverEmergencyBudget(599_999, DEFAULT_CONFIG, 1_000_000), false);
  assert.equal(isOverEmergencyBudget(700_000, DEFAULT_CONFIG, 1_000_000), true);
  // True means "warn", never "abort": an over-budget history must still compact.
  assert.equal(isOverEmergencyBudget(600_001, DEFAULT_CONFIG, 1_000_000), true);
});

test("the emergency budget stays quiet when no window is known", () => {
  // Guessing a denominator is the mistake the awareness module already avoids,
  // so an unknown window disables the derived warning instead of firing forever.
  assert.equal(resolveEmergencyBudget(DEFAULT_CONFIG, undefined), 0);
  assert.equal(resolveEmergencyBudget(DEFAULT_CONFIG, 0), 0);
  assert.equal(isOverEmergencyBudget(10_000_000, DEFAULT_CONFIG), false);
});

test("an explicit emergencyBudgetTokens override wins at any window", () => {
  const overridden = {
    ...DEFAULT_CONFIG,
    tokens: { ...DEFAULT_CONFIG.tokens, emergencyBudgetTokens: 60_000 },
  };
  assert.equal(resolveEmergencyBudget(overridden, 1_000_000), 60_000);
  assert.equal(isOverEmergencyBudget(59_999, overridden, 1_000_000), false);
  assert.equal(isOverEmergencyBudget(60_001, overridden, 1_000_000), true);
  // 0 with no ratio and no window is the explicit "disabled" shape.
  const disabled = { ...DEFAULT_CONFIG, tokens: { ...DEFAULT_CONFIG.tokens, emergencyBudgetTokens: 0 } };
  assert.equal(isOverEmergencyBudget(999_999_999, disabled), false);
  // A zero derived fraction is the explicit opt-out for the window-scaled path.
  const ratioOff = { ...DEFAULT_CONFIG, tokens: { ...DEFAULT_CONFIG.tokens, emergencyBudgetRatio: 0 } };
  assert.equal(resolveEmergencyBudget(ratioOff, 1_000_000), 0);
  assert.equal(isOverEmergencyBudget(900_000, ratioOff, 1_000_000), false);
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

test("awareness defaults are on, with auto-trim armed and no configured window", () => {
  assert.deepEqual(DEFAULT_CONFIG.awareness, {
    enabled: true,
    warnRatio: 0.5,
    emergencyRatio: 0.8,
    rearmStep: 0.05,
    autoTrimRatio: 0.55,
    contextWindowTokens: 0,
    warnAtTokens: 0,
    emergencyAtTokens: 0,
  });
  assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
});

test("token defaults derive the budget from the window", () => {
  assert.equal(DEFAULT_CONFIG.tokens.emergencyBudgetTokens, 0);
  assert.equal(DEFAULT_CONFIG.tokens.emergencyBudgetRatio, 0.6);
});

test("validateConfig names unknown awareness keys and rejects out-of-range values", () => {
  const unknown = validateConfig({ awareness: { nope: 1 } });
  assert.ok(unknown.some((w) => w.includes("awareness.nope")));
  const badRatio = validateConfig({ awareness: { warnRatio: 1.5 } });
  assert.ok(badRatio.some((w) => w.includes("awareness.warnRatio")));
  const badStep = validateConfig({ awareness: { rearmStep: 0 } });
  assert.ok(badStep.some((w) => w.includes("awareness.rearmStep")));
  const inverted = validateConfig({ awareness: { warnRatio: 0.95, emergencyRatio: 0.9 } });
  assert.ok(inverted.some((w) => w.includes("awareness.warnRatio")));
  // autoTrimRatio accepts 0 (off) plus the open (0, 1) range, nothing else.
  assert.deepEqual(validateConfig({ awareness: { autoTrimRatio: 0 } }), []);
  assert.deepEqual(validateConfig({ awareness: { autoTrimRatio: 0.5 } }), []);
  const badAutoTrim = validateConfig({ awareness: { autoTrimRatio: 1 } });
  assert.ok(badAutoTrim.some((w) => w.includes("awareness.autoTrimRatio")));
});

test("validateConfig accepts the fallback window and rejects impossible values", () => {
  // 0 means "no configured denominator"; a positive integer is a window.
  assert.deepEqual(validateConfig({ awareness: { contextWindowTokens: 0 } }), []);
  assert.deepEqual(validateConfig({ awareness: { contextWindowTokens: 200_000 } }), []);
  const badWindow = validateConfig({ awareness: { contextWindowTokens: -1 } });
  assert.ok(badWindow.some((w) => w.includes("awareness.contextWindowTokens")));
  const fractional = validateConfig({ awareness: { contextWindowTokens: 1.5 } });
  assert.ok(fractional.some((w) => w.includes("awareness.contextWindowTokens")));
});

test("validateConfig range-checks the absolute token thresholds", () => {
  // 0 disables each line, a positive number arms it, and the pair may be set
  // independently (a warn line alone is a valid configuration).
  assert.deepEqual(validateConfig({ awareness: { warnAtTokens: 0, emergencyAtTokens: 0 } }), []);
  assert.deepEqual(validateConfig({ awareness: { warnAtTokens: 150_000 } }), []);
  assert.deepEqual(validateConfig({ awareness: { emergencyAtTokens: 400_000 } }), []);
  assert.deepEqual(validateConfig({ awareness: { warnAtTokens: 150_000, emergencyAtTokens: 400_000 } }), []);
  const negative = validateConfig({ awareness: { warnAtTokens: -1 } });
  assert.ok(negative.some((w) => w.includes("awareness.warnAtTokens")));
  const notFinite = validateConfig({ awareness: { emergencyAtTokens: Number.POSITIVE_INFINITY } });
  assert.ok(notFinite.some((w) => w.includes("awareness.emergencyAtTokens")));
  const notNumber = validateConfig({ awareness: { warnAtTokens: "150000" } });
  assert.ok(notNumber.some((w) => w.includes("awareness.warnAtTokens")));
  // An inverted pair would make the escalation unreachable.
  const inverted = validateConfig({ awareness: { warnAtTokens: 500_000, emergencyAtTokens: 400_000 } });
  assert.ok(inverted.some((w) => w.includes("awareness.warnAtTokens")));
  // Equal lines are not inverted: the stronger wins at the same count.
  assert.deepEqual(validateConfig({ awareness: { warnAtTokens: 400_000, emergencyAtTokens: 400_000 } }), []);
});

test("loadConfig keeps a valid absolute threshold and drops an inverted pair", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { loadConfig } = await import("../src/config.js");
  const good = mkdtempSync(join(tmpdir(), "smart-compact-token-lines-"));
  mkdirSync(join(good, ".opencode"), { recursive: true });
  writeFileSync(
    join(good, ".opencode", "smart-compact.jsonc"),
    '{"awareness": {"contextWindowTokens": 200000, "warnAtTokens": 150000}}',
  );
  const config = await loadConfig({ location: { directory: good } } as never);
  assert.equal(config.awareness.contextWindowTokens, 200_000);
  assert.equal(config.awareness.warnAtTokens, 150_000);
  assert.equal(config.awareness.emergencyAtTokens, 0);
  // Siblings survive: the cap does not reset the ratios.
  assert.equal(config.awareness.warnRatio, 0.5);

  const bad = mkdtempSync(join(tmpdir(), "smart-compact-token-lines-bad-"));
  mkdirSync(join(bad, ".opencode"), { recursive: true });
  writeFileSync(
    join(bad, ".opencode", "smart-compact.jsonc"),
    '{"awareness": {"warnAtTokens": 500000, "emergencyAtTokens": 400000}}',
  );
  const original = console.warn;
  console.warn = () => {};
  try {
    const dropped = await loadConfig({ location: { directory: bad } } as never);
    // Both lines fall back together: an inverted pair must not survive.
    assert.equal(dropped.awareness.warnAtTokens, 0);
    assert.equal(dropped.awareness.emergencyAtTokens, 0);
  } finally {
    console.warn = original;
  }
});

test("validateConfig range-checks the window-scaled budget ratio", () => {
  assert.deepEqual(validateConfig({ tokens: { emergencyBudgetRatio: 0.6 } }), []);
  // 0 is the explicit "do not derive" opt-out, not an invalid fraction.
  assert.deepEqual(validateConfig({ tokens: { emergencyBudgetRatio: 0 } }), []);
  const badRatio = validateConfig({ tokens: { emergencyBudgetRatio: 1.5 } });
  assert.ok(badRatio.some((w) => w.includes("tokens.emergencyBudgetRatio")));
  const badBudget = validateConfig({ tokens: { emergencyBudgetTokens: -5 } });
  assert.ok(badBudget.some((w) => w.includes("tokens.emergencyBudgetTokens")));
});

test("loadConfig overrides one awareness key and keeps its siblings", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-awareness-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"warnRatio": 0.6}}');
  const { loadConfig } = await import("../src/config.js");
  const config = await loadConfig({ location: { directory: dir } } as never);
  assert.equal(config.awareness.warnRatio, 0.6);
  assert.equal(config.awareness.emergencyRatio, 0.8);
  assert.equal(config.awareness.rearmStep, 0.05);
  assert.equal(config.awareness.enabled, true);
});

test("loadConfig drops invalid awareness values back to the defaults", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-awareness-bad-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(
    join(dir, ".opencode", "smart-compact.jsonc"),
    '{"awareness": {"warnRatio": 2, "rearmStep": 9}}',
  );
  const original = console.warn;
  console.warn = () => {};
  try {
    const { loadConfig } = await import("../src/config.js");
    const config = await loadConfig({ location: { directory: dir } } as never);
    assert.equal(config.awareness.warnRatio, 0.5);
    assert.equal(config.awareness.rearmStep, 0.05);
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
