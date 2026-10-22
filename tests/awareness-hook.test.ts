import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/index.js";
import type { Msg } from "../src/types.js";

// The hook resolves the global config from XDG_CONFIG_HOME: point it at an
// empty directory so the developer's real global file cannot change results.
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "smart-compact-xdg-"));

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
    messages: [bigMessage(32000)],
  });
  assert.equal(system.length, 1);
  assert.equal(system[0]!.type, "text");
  assert.match(system[0]!.text, /CONTEXT PRESSURE/);
  assert.match(system[0]!.text, /80%/);
  assert.match(system[0]!.text, /compact_context/);
});

test("the reminder fires once per crossing and re-arms only after a further step", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const event = {
    sessionID: "ses-test",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(32000)],
  };
  await h.hook(event);
  assert.equal(system.length, 1);
  // Same fill again: the latch holds, no second nudge.
  await h.hook(event);
  assert.equal(system.length, 1);
  // A small growth stays below the re-arm step.
  const grew = { ...event, messages: [bigMessage(32400)] };
  await h.hook(grew);
  assert.equal(system.length, 1);
  // A further step re-arms the reminder.
  const grewMore = { ...event, messages: [bigMessage(36000)] };
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
  await h.hook({ ...base, messages: [bigMessage(32000)] });
  assert.equal(system.length, 1);
  await h.hook({ ...base, messages: [bigMessage(100)] });
  await h.hook({ ...base, messages: [bigMessage(32000)] });
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
  // 50 percent: above the line but below warnRatio, so a trim is queued silently.
  await h.hook({ ...base, messages: [bigMessage(20000)] });
  const state = h.storage.get("session:ses-auto") as { pending?: unknown };
  assert.deepEqual(state.pending, { mode: "trim", keepTurns: 0 });
  // Trimming is lossless, so no advisory is posted at this fill.
  assert.equal(system.length, 0);
});

test("autoTrimRatio stays off by default", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  await h.hook({
    sessionID: "ses-default",
    model: { providerID: "test", id: "model-x" },
    system,
    messages: [bigMessage(20000)],
  });
  assert.equal((h.storage.get("session:ses-default") as { pending?: unknown } | undefined)?.pending ?? null, null);
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
  // 80 percent: the reminder fires.
  await h.hook({ ...base, messages: [bigMessage(32000)] });
  assert.equal(system.length, 1);
  // 69 percent: just under the threshold, but not far enough to clear the latch.
  await h.hook({ ...base, messages: [bigMessage(27600)] });
  // 80 percent again: the latch still holds, so no second nudge.
  await h.hook({ ...base, messages: [bigMessage(32000)] });
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
  // 80 percent: the level drops back to warn, but the fill did not grow, so
  // the latch holds and nothing is pushed.
  await h.hook({ ...base, messages: [bigMessage(32000)] });
  assert.equal(system.length, 1);
});
