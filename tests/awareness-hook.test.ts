import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/index.js";
import type { Msg } from "../src/types.js";

// The hook resolves the global config from XDG_CONFIG_HOME: point it at an
// empty directory so the developer's real global file cannot change results.
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "smart-compact-xdg-"));
// Omission originals now live on disk; keep every test file inside a temp dir
// so the suite can never write into the developer's real data directory.
process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-data-"));

/**
 * One assistant turn of `chars` characters. The plugin estimates about four
 * characters per token, so 32000 characters is roughly 8000 tokens, which is
 * 80 percent of the 10000 token window the harness declares.
 */
function bigMessage(chars: number): Msg {
  return {
    role: "assistant",
    content: [{ type: "text", text: "x".repeat(chars) }],
  };
}

/** One bulky completed tool result, which is what the emergency budget measures. */
function bigToolResult(id: string, chars: number): Msg {
  return {
    role: "assistant",
    content: [{ type: "tool-result", id, name: "bash", result: { type: "text", value: "x".repeat(chars) } }],
  };
}

/** Run `fn` while collecting console.warn lines, restoring the console after. */
async function captureWarnings(fn: () => Promise<void>): Promise<string[]> {
  const original = console.warn;
  const lines: string[] = [];
  console.warn = (message: unknown) => void lines.push(String(message));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return lines;
}

/** Run `fn` while collecting console.log lines, restoring the console after. */
async function captureLogs(fn: () => Promise<void>): Promise<string[]> {
  const original = console.log;
  const lines: string[] = [];
  console.log = (message: unknown) => void lines.push(String(message));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}

/** A project config directory holding one JSONC payload, isolated per test. */
async function configDir(name: string, payload: string): Promise<string> {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), `smart-compact-${name}-`));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), payload);
  return dir;
}

interface HarnessOptions {
  /** Context window the stub model reports. */
  limitContext?: number;
  /** Shape the model registry answers with. */
  listShape?: "data" | "array" | "throw";
  /** Directory the plugin resolves the project config from. */
  directory?: string;
}

interface Harness {
  ctx: unknown;
  hook: (event: unknown) => Promise<void>;
  storage: Map<string, unknown>;
}

/**
 * Boot the plugin against a stub context and capture the "context" hook it
 * registers. The stub records every storage write so the awareness latch can
 * be inspected, and exposes a `session` domain whose `compact` and `prompt`
 * throw: the awareness pass must never reach for them.
 */
async function harness(options: HarnessOptions = {}): Promise<Harness> {
  const limitContext = options.limitContext ?? 10_000;
  const listShape = options.listShape ?? "data";
  const storage = new Map<string, unknown>();
  let hook: (event: unknown) => Promise<void> = async () => {};
  const editor = { add: () => {}, list: () => [], get: () => undefined };
  const modelEntry = { providerID: "test", id: "model-x", limit: { context: limitContext } };
  const ctx = {
    location: { directory: options.directory ?? "/nonexistent-smart-compact-test" },
    app: { name: "opencode", version: "test", channel: "test" },
    options: {},
    storage: {
      get: async (key: string) => storage.get(key),
      set: async (key: string, value: unknown) => void storage.set(key, value),
      remove: async (key: string) => void storage.delete(key),
      scan: async () => ({ entries: [] }),
    },
    model: {
      list: async () => {
        if (listShape === "throw") throw new Error("registry unavailable");
        if (listShape === "array") return [modelEntry];
        return { data: [modelEntry] };
      },
    },
    command: { transform: async (cb: (e: unknown) => void) => void cb(editor) },
    tool: { transform: async (cb: (e: unknown) => void) => void cb(editor) },
    session: {
      hook: async (name: string, fn: (event: unknown) => Promise<void>) => {
        if (name === "context") hook = fn;
      },
      synthetic: async () => {
        throw new Error("awareness must not post a synthetic message");
      },
      prompt: async () => {
        throw new Error("awareness must not prompt the model");
      },
      compact: async () => {
        throw new Error("awareness must never compact on its own");
      },
    },
  };
  await plugin.setup(ctx as never);
  return { ctx, hook: (event) => hook(event), storage };
}

test("the context hook pushes one advisory system part when the window fills", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(20000)],
  });
  assert.equal(system.length, 1);
  assert.equal(system[0]!.type, "text");
  assert.match(system[0]!.text, /CONTEXT PRESSURE/);
  assert.match(system[0]!.text, /50%/);
  assert.match(system[0]!.text, /compact_context/);
});

test("the reminder fires once per crossing and re-arms only after a further step", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const event = {
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(20000)],
  };
  await h.hook(event);
  assert.equal(system.length, 1);
  // Same fill again: the latch holds, no second nudge.
  await h.hook(event);
  assert.equal(system.length, 1);
  // A small growth stays below the re-arm step.
  const grew = { ...event, messages: [bigMessage(20400)] };
  await h.hook(grew);
  assert.equal(system.length, 1);
  // A further step re-arms the reminder.
  const grewMore = { ...event, messages: [bigMessage(22000)] };
  await h.hook(grewMore);
  assert.equal(system.length, 2);
});

test("a session back under the threshold clears the latch and warns again later", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const base = {
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
  };
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(system.length, 1);
  await h.hook({ ...base, messages: [bigMessage(100)] });
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(system.length, 2);
});

test("no reminder for an unknown model, and none for a window that is not full", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  // Unknown model: the plugin must stay silent rather than guess a window.
  await h.hook({
    sessionID: "ses-test",
    model: { providerID: "other", id: "model-y" },
    system,
    messages: [bigMessage(32000)],
  });
  assert.equal(system.length, 0);
  // Known model, window barely used.
  await h.hook({
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(100)],
  });
  assert.equal(system.length, 0);
});

test("the reminder also fires when the model registry answers with a bare array", async () => {
  const h = await harness({ limitContext: 10_000, listShape: "array" });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(32000)],
  });
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /CONTEXT PRESSURE/);
});

test("a failing model registry is skipped silently and never breaks the call", async () => {
  const h = await harness({ limitContext: 10_000, listShape: "throw" });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(32000)],
  });
  assert.equal(system.length, 0);
});

test("the kill switch silences the reminder entirely", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-awareness-off-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"enabled": false}}');
  const h = await harness({ limitContext: 10_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(32000)],
  });
  assert.equal(system.length, 0);
});

test("autoTrimRatio queues a lossless trim below the advisory threshold", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"autoTrimRatio": 0.4}}');
  const h = await harness({ limitContext: 10_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  const base = { sessionID: "ses-auto", model: { providerID: "test", id: "model-x" }, system };
  // 25 percent: below the auto-trim line, nothing is queued.
  await h.hook({ ...base, messages: [bigMessage(10000)] });
  assert.equal((h.storage.get("session:ses-auto") as { pending?: unknown } | undefined)?.pending ?? null, null);
  // 40 percent: above the auto-trim line but below warnRatio, so a trim is queued silently.
  await h.hook({ ...base, messages: [bigMessage(16000)] });
  const state = h.storage.get("session:ses-auto") as { pending?: unknown };
  assert.deepEqual(state.pending, { mode: "trim", keepTurns: 0 });
  // Trimming is lossless, so no advisory is posted at this fill.
  assert.equal(system.length, 0);
});

test("the shipped default arms auto-trim at 0.55", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  // 50 percent: below the shipped 0.55 line, nothing is queued.
  await h.hook({
    sessionID: "ses-default-low",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(20000)],
  });
  assert.equal(
    (h.storage.get("session:ses-default-low") as { pending?: unknown } | undefined)?.pending ?? null,
    null,
  );
  // 60 percent: above the line, one lossless trim is queued with no manual call.
  await h.hook({
    sessionID: "ses-default-high",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(24000)],
  });
  assert.deepEqual(
    (h.storage.get("session:ses-default-high") as { pending?: unknown } | undefined)?.pending,
    { mode: "trim", keepTurns: 0 },
  );
});

test("the shipped default reclaims tool output with no manual compaction call", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const sessionID = "ses-auto-default";
  const original = "z".repeat(24000);
  // Three user messages so the bulky result sits outside the default
  // preserve-recent-2-turns window and is therefore prunable.
  const messages: Msg[] = [
    { id: "u1", role: "user", content: [{ type: "text", text: "start" }] },
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "tool-result", id: "call-big", name: "bash", result: { type: "text", value: original } }],
    },
    { id: "u2", role: "user", content: [{ type: "text", text: "continue" }] },
    { id: "u3", role: "user", content: [{ type: "text", text: "still going" }] },
  ];
  const model = { providerID: "test", id: "model-x" };
  // 60 percent of the window: the default line queues a trim, no tool call made.
  await h.hook({ sessionID, model, system, messages });
  assert.deepEqual(
    (h.storage.get(`session:${sessionID}`) as { pending?: unknown }).pending,
    { mode: "trim", keepTurns: 0 },
  );
  // The next model request applies it: the bulky result becomes a notice and
  // the original moves to a per-session file, not the state blob.
  await h.hook({ sessionID, model, system, messages });
  const value = (messages[1]!.content[0]!.result as { value: string }).value;
  assert.match(value, /omitted-0001/);
  // Context dropped: the 24000-character payload is now a short notice.
  assert.ok(value.length < original.length / 10);
  const state = h.storage.get(`session:${sessionID}`) as {
    pending?: unknown;
    omissions: Record<string, { path?: string; content?: string }>;
  };
  // One sustained period queues exactly one trim: the consumed request is not
  // re-queued at the same fill.
  assert.equal(state.pending ?? null, null);
  const record = state.omissions["omitted-0001"]!;
  assert.equal(record.content, undefined);
  assert.equal(typeof record.path, "string");
  assert.ok(existsSync(record.path!));
  assert.equal(readFileSync(record.path!, "utf8"), original);
});

test("a sustained high-pressure period queues one trim, not one per request", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-latch-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"autoTrimRatio": 0.4}}');
  const h = await harness({ limitContext: 10_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  const base = { sessionID: "ses-latch", model: { providerID: "test", id: "model-x" }, system };
  const pendingOf = () =>
    (h.storage.get("session:ses-latch") as { pending?: unknown } | undefined)?.pending ?? null;
  // First request at 50 percent queues the trim.
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.deepEqual(pendingOf(), { mode: "trim", keepTurns: 0 });
  // Second request at the same fill: the queued trim is consumed, nothing is re-queued.
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(pendingOf(), null);
  // Third request, still the same fill: the latch holds.
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(pendingOf(), null);
});

test("the auto-trim latch clears below its line and a new rise trims again", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-reset-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(join(dir, ".opencode", "smart-compact.jsonc"), '{"awareness": {"autoTrimRatio": 0.4}}');
  const h = await harness({ limitContext: 10_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  const base = { sessionID: "ses-reset", model: { providerID: "test", id: "model-x" }, system };
  const stateOf = () => h.storage.get("session:ses-reset") as { pending?: unknown; autoTrimLastRatio?: number };
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.deepEqual(stateOf().pending, { mode: "trim", keepTurns: 0 });
  // Fill drops well below the line: the latch is cleared.
  await h.hook({ ...base, messages: [bigMessage(8000)] });
  assert.equal(stateOf().autoTrimLastRatio, undefined);
  // A new rise past the line trims again.
  await h.hook({ ...base, messages: [bigMessage(22000)] });
  assert.deepEqual(stateOf().pending, { mode: "trim", keepTurns: 0 });
});

test("disabling awareness also stops the automatic trim", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-autotrim-off-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(
    join(dir, ".opencode", "smart-compact.jsonc"),
    '{"awareness": {"enabled": false, "autoTrimRatio": 0.4}}',
  );
  const h = await harness({ limitContext: 10_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-off",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(20000)],
  });
  assert.equal((h.storage.get("session:ses-off") as { pending?: unknown } | undefined)?.pending ?? null, null);
  assert.equal(system.length, 0);
});

test("a session hovering at the threshold does not re-fire on every request", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const base = {
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
  };
  // 50 percent: the reminder fires.
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(system.length, 1);
  // 49 percent: just under the threshold, but not far enough to clear the latch.
  await h.hook({ ...base, messages: [bigMessage(19600)] });
  // 50 percent again: the latch still holds, so no second nudge.
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(system.length, 1);
});

test("the hook escalates the wording past the emergency threshold", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  // 95 percent of the window.
  await h.hook({
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(38000)],
  });
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /95%/);
  assert.match(system[0]!.text, /emergency context pressure/);
});

test("emergency re-fires on every request until the pressure drops", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const base = {
    sessionID: "ses-emergency",
    model: { providerID: "test", id: "model-x" },
    system,
  };
  // 80 percent: at the emergency line, the single-shot latch is bypassed.
  await h.hook({ ...base, messages: [bigMessage(32000)] });
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /COMPACT NOW/);
  // Same fill again: still re-fires — no silent single-shot at emergency.
  await h.hook({ ...base, messages: [bigMessage(32000)] });
  assert.equal(system.length, 2);
  await h.hook({ ...base, messages: [bigMessage(32000)] });
  assert.equal(system.length, 3);
  // Dropping below the clear line (warn minus re-arm step = 45 percent)
  // clears the latch, so the next rise warns again with warn wording.
  await h.hook({ ...base, messages: [bigMessage(100)] });
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(system.length, 4);
  assert.match(system[3]!.text, /ACT NOW/);
});

test("a downgrade from emergency back to warn does not re-fire on its own", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const base = {
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
  };
  // 95 percent: emergency wording.
  await h.hook({ ...base, messages: [bigMessage(38000)] });
  assert.equal(system.length, 1);
  // 50 percent: the level drops back to warn, but the fill did not grow, so
  // the warn gate holds and nothing is pushed.
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  assert.equal(system.length, 1);
});

test("an unknown model records its name with no window, staying silent", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-unknown",
    model: { providerID: "custom", id: "acme-1" },
    system,
    messages: [bigMessage(32000)],
  });
  assert.equal(system.length, 0);
  const state = h.storage.get("session:ses-unknown") as {
    awarenessWindow?: unknown;
    awarenessModel?: unknown;
  };
  assert.equal(state.awarenessWindow, undefined);
  assert.equal(state.awarenessModel, "custom/acme-1");
});

test("a resolved model records its window in state", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-known",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(100)],
  });
  const state = h.storage.get("session:ses-known") as {
    awarenessWindow?: unknown;
    awarenessWindowSource?: unknown;
    awarenessModel?: unknown;
  };
  assert.equal(state.awarenessWindow, 10_000);
  assert.equal(state.awarenessWindowSource, "registry");
  assert.equal(state.awarenessModel, "test/model-x");
});

test("a configured fallback window renders a ratio and names itself as configured", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-window-fallback-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(
    join(dir, ".opencode", "smart-compact.jsonc"),
    '{"awareness": {"contextWindowTokens": 10000}}',
  );
  const h = await harness({ limitContext: 10_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  // The registry has no entry for this model, so only the configured window
  // can produce a denominator — 20000 chars is about 5000 of 10000 tokens.
  await h.hook({
    sessionID: "ses-fallback",
    model: { providerID: "custom", id: "acme-1" },
    system,
    messages: [bigMessage(20000)],
  });
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /50%/);
  assert.match(system[0]!.text, /configured/);
  assert.match(system[0]!.text, /awareness\.contextWindowTokens/);
  const state = h.storage.get("session:ses-fallback") as {
    awarenessWindow?: unknown;
    awarenessWindowSource?: unknown;
  };
  assert.equal(state.awarenessWindow, 10_000);
  assert.equal(state.awarenessWindowSource, "config");
});

test("with neither a registry limit nor a configured window, awareness stays silent", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-no-window",
    model: { providerID: "custom", id: "acme-1" },
    system,
    messages: [bigMessage(40000)],
  });
  assert.equal(system.length, 0);
  const state = h.storage.get("session:ses-no-window") as {
    awarenessWindow?: unknown;
    awarenessWindowSource?: unknown;
  };
  assert.equal(state.awarenessWindow, undefined);
  assert.equal(state.awarenessWindowSource, undefined);
});

test("a 1M window keeps the derived emergency budget quiet during normal work", async () => {
  const h = await harness({ limitContext: 1_000_000 });
  const sessionID = "ses-budget-1m";
  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
  const warnings = await captureWarnings(async () => {
    // ~100K measured tokens against a derived 600K budget for a 1M window.
    await h.hook({
      sessionID,
      model: { providerID: "test", id: "model-x" },
      system: [],
      messages: [bigToolResult("call-1m", 400_000)],
    });
  });
  assert.equal(warnings.some((line) => /emergency budget/.test(line)), false);
});

test("the derived emergency budget fires near the window-scaled line", async () => {
  const h = await harness({ limitContext: 100_000 });
  const sessionID = "ses-budget-warn";
  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
  const warnings = await captureWarnings(async () => {
    // ~75000 measured tokens against the derived 60000 (60 percent of 100K).
    await h.hook({
      sessionID,
      model: { providerID: "test", id: "model-x" },
      system: [],
      messages: [bigToolResult("call-warn", 300_000)],
    });
  });
  assert.ok(warnings.some((line) => /over the emergency budget of 60000 tokens/.test(line)));
});

test("an explicit emergency override behaves exactly as configured", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "smart-compact-budget-override-"));
  mkdirSync(join(dir, ".opencode"), { recursive: true });
  writeFileSync(
    join(dir, ".opencode", "smart-compact.jsonc"),
    '{"tokens": {"emergencyBudgetTokens": 1000}}',
  );
  const h = await harness({ limitContext: 1_000_000, directory: dir });
  const sessionID = "ses-budget-override";
  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
  const warnings = await captureWarnings(async () => {
    // ~2000 measured tokens: over the pinned 1000 even on a 1M window.
    await h.hook({
      sessionID,
      model: { providerID: "test", id: "model-x" },
      system: [],
      messages: [bigToolResult("call-override", 8000)],
    });
  });
  assert.ok(warnings.some((line) => /over the emergency budget of 1000 tokens/.test(line)));
});

test("an unknown window disables the derived emergency warning", async () => {
  const h = await harness({ limitContext: 10_000 });
  const sessionID = "ses-budget-unknown";
  h.storage.set(`session:${sessionID}`, { pending: { mode: "trim", keepTurns: 0 } });
  const warnings = await captureWarnings(async () => {
    await h.hook({
      sessionID,
      model: { providerID: "custom", id: "acme-1" },
      system: [],
      messages: [bigToolResult("call-unknown", 400_000)],
    });
  });
  assert.equal(warnings.some((line) => /emergency budget/.test(line)), false);
});

test("a configured cap warns on a 1M-token window and logs the capped denominator", async () => {
  // The defect scenario: a 1M registry window made warnRatio unreachable, and
  // the configured value was ignored because the registry had a limit. With
  // the cap, 76% of 200000 = 152000 measured tokens must warn.
  const dir = await configDir("cap-1m", '{"awareness": {"contextWindowTokens": 200000}}');
  const h = await harness({ limitContext: 1_000_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  const logs = await captureLogs(async () => {
    await h.hook({
      sessionID: "ses-cap-1m",
      model: { providerID: "test", id: "model-x" },
      system,
      messages: [bigMessage(608_000)],
    });
  });
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /76%/);
  assert.match(system[0]!.text, /200000/);
  // The reminder says the denominator is a cap, and names the real window.
  assert.match(system[0]!.text, /capped/i);
  assert.match(system[0]!.text, /1000000/);
  // Exactly one diagnostic line per fired reminder, carrying both numbers.
  const fired = logs.filter((line) => /awareness .* fired/.test(line));
  assert.equal(fired.length, 1);
  assert.match(fired[0]!, /awareness warn fired: 152000\/200000 \(76%\) registry=1000000 capped=true/);
  const state = h.storage.get("session:ses-cap-1m") as {
    awarenessWindow?: number;
    awarenessWindowSource?: unknown;
    awarenessWindowRegistry?: number;
    awarenessWindowCapped?: boolean;
  };
  assert.equal(state.awarenessWindow, 200_000);
  assert.equal(state.awarenessWindowSource, "config");
  assert.equal(state.awarenessWindowRegistry, 1_000_000);
  assert.equal(state.awarenessWindowCapped, true);
});

test("absolute warnAtTokens fires on a 1M window that no ratio can reach", async () => {
  // 150000 of a 1M window is 15%: far below warnRatio 0.5, yet the absolute
  // line is the whole point of the feature.
  const dir = await configDir("tokens-1m", '{"awareness": {"warnAtTokens": 150000}}');
  const h = await harness({ limitContext: 1_000_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  const event = {
    sessionID: "ses-tokens-1m",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(600_000)],
  };
  const logs = await captureLogs(async () => {
    await h.hook(event);
  });
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /15%/);
  assert.match(system[0]!.text, /150000/);
  assert.match(system[0]!.text, /1000000/);
  const fired = logs.filter((line) => /awareness .* fired/.test(line));
  assert.equal(fired.length, 1);
  assert.match(fired[0]!, /awareness warn fired: 150000\/1000000 \(15%\) registry=1000000 capped=false/);
  const state = h.storage.get("session:ses-tokens-1m") as {
    awarenessWindow?: number;
    awarenessWindowCapped?: boolean;
  };
  // No cap was configured, so the registry window stands and nothing is capped.
  assert.equal(state.awarenessWindow, 1_000_000);
  assert.equal(state.awarenessWindowCapped, false);
  // A repeat at the same fill holds the warn latch: no second nudge, no log.
  const again = await captureLogs(async () => {
    await h.hook(event);
  });
  assert.equal(system.length, 1);
  assert.equal(again.filter((line) => /awareness .* fired/.test(line)).length, 0);
});

test("an absolute emergencyAtTokens escalates above a warn-only ratio", async () => {
  const dir = await configDir(
    "tokens-emergency",
    '{"awareness": {"warnAtTokens": 150000, "emergencyAtTokens": 200000}}',
  );
  const h = await harness({ limitContext: 1_000_000, directory: dir });
  const system: Array<{ type: string; text: string }> = [];
  const logs = await captureLogs(async () => {
    await h.hook({
      sessionID: "ses-tokens-emergency",
      model: { providerID: "test", id: "model-x" },
      system,
      messages: [bigMessage(800_000)],
    });
  });
  // 200000 tokens is 20% of the window: a warn by ratio, an emergency by count.
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /COMPACT NOW/);
  assert.equal(logs.filter((line) => /awareness emergency fired/.test(line)).length, 1);
});

test("the auto-trim log line is emitted once per queued trim", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const base = { sessionID: "ses-trim-log", model: { providerID: "test", id: "model-x" }, system };
  // 60 percent of the window: above the shipped 0.55 auto-trim line.
  const first = await captureLogs(async () => {
    await h.hook({ ...base, messages: [bigMessage(24000)] });
  });
  const queued = first.filter((line) => /auto-trim queued/.test(line));
  assert.equal(queued.length, 1);
  assert.match(queued[0]!, /auto-trim queued: 6000\/10000 \(60%\)/);
  // The queued trim is consumed and the latch holds at the same fill, so the
  // next request must not log another queue line.
  const second = await captureLogs(async () => {
    await h.hook({ ...base, messages: [bigMessage(24000)] });
  });
  assert.equal(second.filter((line) => /auto-trim queued/.test(line)).length, 0);
});

test("a quiet request logs no awareness line at all", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const logs = await captureLogs(async () => {
    await h.hook({
      sessionID: "ses-quiet",
      model: { providerID: "test", id: "model-x" },
      system,
      messages: [bigMessage(400)],
    });
  });
  // 1 percent of the window: no fire, no queue, therefore no diagnostic line.
  assert.equal(system.length, 0);
  assert.equal(logs.filter((line) => /awareness .* fired|auto-trim queued/.test(line)).length, 0);
});

test("runPrune never calls ctx.session.synthetic even when over emergency budget", async () => {
  const h = await harness({ limitContext: 10_000 });
  const state = (h.storage.get("session:ses-prune-safe") ?? {}) as Record<string, unknown>;
  state.pending = { mode: "trim", keepTurns: 0 };
  state.omissions = {};
  state.omittedCalls = {};
  state.summaries = {};
  state.stats = {
    prunedTokens: 0,
    prunedParts: 0,
    summarizedTurns: 0,
    summaryFallbacks: 0,
    lastRun: 0,
    lastRunMs: 0,
  };
  h.storage.set("session:ses-prune-safe", state);

  const system: Array<{ type: string; text: string }> = [];
  const toolResult = {
    type: "tool-result",
    callID: "call-1",
    tool: "read",
    result: { value: "x".repeat(50_000) },
  };

  await h.hook({
    sessionID: "ses-prune-safe",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [
      {
        id: "msg-1",
        role: "assistant",
        content: [toolResult],
      },
    ],
  });

  const updatedState = h.storage.get("session:ses-prune-safe") as {
    stats?: { prunedTokens: number };
  };
  assert.ok((updatedState.stats?.prunedTokens ?? 0) >= 0);
});
