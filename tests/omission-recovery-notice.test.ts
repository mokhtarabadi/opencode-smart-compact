import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/index.js";
import { buildAwarenessMessage, buildReclaimAction, shouldFireAwarenessReminder } from "../src/awareness.js";
import { writeOmissionOriginal } from "../src/omissions.js";
import {
  applyOmissions,
  missingOmissionNotice,
  omissionNotice,
  pruneToolResults,
  toolResultStatus,
} from "../src/prune.js";
import { applySummaries } from "../src/apply.js";
import { DEFAULT_CONFIG } from "../src/config.js";
import { emptyState, type Msg } from "../src/types.js";

// The hook resolves the global config from XDG_CONFIG_HOME: point it at an
// empty directory so the developer's real global file cannot change results.
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "smart-compact-notice-xdg-"));
// Omission originals live on disk; keep every test inside a temp directory.
process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-notice-data-"));

/** One assistant message holding a single completed tool result. */
function toolResultMessage(id: string, name: string, value: string): Msg {
  return {
    id: "a1",
    role: "assistant",
    content: [{ type: "tool-result", id, name, result: { type: "text", value } }],
  };
}

/** One user message whose text must survive every pass untouched. */
function userMessage(id: string, text: string): Msg {
  return { id, role: "user", content: [{ type: "text", text }] };
}

/** One assistant turn with a large block of prose. */
function bigMessage(chars: number): Msg {
  return { role: "assistant", content: [{ type: "text", text: "x".repeat(chars) }] };
}

interface HarnessOptions {
  /** Context window the stub model reports. */
  limitContext?: number;
}

interface Harness {
  /** The registered agent tools, keyed by tool name. */
  tools: Map<string, { execute: (input: unknown, context: unknown) => Promise<{ content: string }> }>;
  /** The captured "context" hook. */
  hook: (event: unknown) => Promise<void>;
  /** The plugin storage, so a test can inspect or seed session state. */
  storage: Map<string, unknown>;
}

/**
 * Boot the plugin against a stub context and capture both the "context" hook
 * and the registered agent tools. The stub records every storage write and
 * exposes no session side effects: the awareness pass must never prompt,
 * compact, or post a synthetic message on its own.
 */
async function harness(options: HarnessOptions = {}): Promise<Harness> {
  const limitContext = options.limitContext ?? 10_000;
  const storage = new Map<string, unknown>();
  let hook: (event: unknown) => Promise<void> = async () => {};
  const tools = new Map<string, { execute: (input: unknown, context: unknown) => Promise<{ content: string }> }>();
  const editor = {
    add: (tool: { name: string; execute: (input: unknown, context: unknown) => Promise<{ content: string }> }) => {
      tools.set(tool.name, tool);
    },
    list: () => [],
    get: () => undefined,
  };
  const modelEntry = { providerID: "test", id: "model-x", limit: { context: limitContext } };
  const ctx = {
    location: { directory: "/nonexistent-smart-compact-notice-test" },
    app: { name: "opencode", version: "test", channel: "test" },
    options: {},
    storage: {
      get: async (key: string) => storage.get(key),
      set: async (key: string, value: unknown) => void storage.set(key, value),
      remove: async (key: string) => void storage.delete(key),
      scan: async () => ({ entries: [] }),
    },
    model: { list: async () => ({ data: [modelEntry] }) },
    command: { transform: async (cb: (e: unknown) => void) => void cb(editor) },
    tool: { transform: async (cb: (e: unknown) => void) => void cb(editor) },
    session: {
      hook: async (name: string, fn: (event: unknown) => Promise<void>) => {
        if (name === "context") hook = fn;
      },
      synthetic: async () => {
        throw new Error("the plugin must not post a synthetic message");
      },
      prompt: async () => {
        throw new Error("the plugin must not prompt the model");
      },
      compact: async () => {
        throw new Error("the plugin must never compact on its own");
      },
    },
  };
  await plugin.setup(ctx as never);
  return { tools, hook: (event) => hook(event), storage };
}

test("the omission notice names the recovery tool, the exact Content ID, and the argument", () => {
  // The notice is the agent's only pointer to the pruned output: it must say
  // which tool to call, with which argument, and for which id.
  const notice = omissionNotice("omitted-0001", "bash", 1234);
  assert.match(notice, /read_omitted_content/);
  assert.match(notice, /omitted-0001/);
  // The argument name is the one the tool schema declares.
  assert.match(notice, /contentId/);
  // The tool that produced the output is named too.
  assert.match(notice, /bash/);
  // The saved size is still reported, so the agent can judge the cost of a restore.
  assert.match(notice, /1234/);
});

test("the omission notice states that the original is recoverable rather than lost", () => {
  const notice = omissionNotice("omitted-0001", "bash", 10);
  // Without this sentence the agent reads the notice as a deletion and never
  // restores the output, which loses it for the turn even though the store
  // still holds it.
  assert.match(notice, /RECOVERABLE/);
  assert.match(notice, /not lost/);
  assert.match(notice, /cached/);
});

test("a pruned tool result reaches the model with the full recovery path in its notice", () => {
  // The contract must hold on the live message, not only in the formatter: the
  // model sees the notice that the prune pass writes into the part.
  const state = emptyState();
  const messages: Msg[] = [toolResultMessage("call-1", "bash", "x".repeat(3000))];
  const result = pruneToolResults(messages, state, DEFAULT_CONFIG, "ses-notice-live");
  assert.equal(result.pruned, 1);
  const value = (messages[0]!.content[0]!.result as { value: string }).value;
  assert.match(value, /read_omitted_content/);
  assert.match(value, /omitted-0001/);
  assert.match(value, /contentId/);
  assert.match(value, /RECOVERABLE/);
});

test("the replayed notice keeps naming the recovery path on every later request", () => {
  // Every request re-applies the stored omissions, so the notice an agent sees
  // on turn 20 must carry the same recovery path as the one on turn 1.
  const state = emptyState();
  state.omissions["omitted-0001"] = {
    id: "omitted-0001",
    callId: "call-1",
    name: "bash",
    tokens: 750,
    path: "/tmp/omitted-0001.txt",
  };
  state.omittedCalls["call-1"] = "omitted-0001";
  const messages: Msg[] = [toolResultMessage("call-1", "bash", "original")];
  applyOmissions(messages, state, DEFAULT_CONFIG);
  const value = (messages[0]!.content[0]!.result as { value: string }).value;
  assert.match(value, /read_omitted_content/);
  assert.match(value, /omitted-0001/);
  assert.match(value, /contentId/);
  assert.match(value, /RECOVERABLE/);
});

test("the missing-original notice names the id and refuses a phantom restore", () => {
  // The fail-closed twin of the omission notice: the id is named, the tool
  // that cannot restore it is named, and the reader is told to rerun the source
  // tool instead of trusting a restore that would replay nothing.
  const notice = missingOmissionNotice("omitted-0007");
  assert.match(notice, /omitted-0007/);
  assert.match(notice, /read_omitted_content/);
  assert.match(notice, /cleared/);
  assert.match(notice, /Rerun the tool/);
});

test("the awareness reminder names the reclaim action next to the pressure ratio", () => {
  const text = buildAwarenessMessage({
    usedTokens: 104_000,
    limitTokens: 145_000,
    ratioPct: 72,
    level: "warn",
  });
  const lines = text.split("\n");
  const pressureIndex = lines.findIndex((line) => /CONTEXT PRESSURE/.test(line));
  assert.ok(pressureIndex >= 0);
  // The ratio line carries the measurement ...
  assert.match(lines[pressureIndex]!, /72%/);
  assert.match(lines[pressureIndex]!, /104000/);
  // ... and the very next line carries the concrete reclaim action, so the
  // agent reads what to do in the same breath as how much pressure there is.
  const action = lines[pressureIndex + 1]!;
  assert.match(action, /Reclaim action/);
  assert.match(action, /compact_context/);
  assert.match(action, /trim/);
  assert.match(action, /compact/);
});

test("buildReclaimAction names the plugin's own strategy names at both levels", () => {
  for (const level of ["warn", "emergency"] as const) {
    const action = buildReclaimAction(level);
    // The names are the `mode` values the compact_context tool accepts, so the
    // sentence can be followed as a verbatim call.
    assert.match(action, /compact_context/);
    assert.match(action, /mode: "trim"/);
    assert.match(action, /mode: "compact"/);
  }
  // The emergency wording pushes the strongest reclaim first.
  assert.match(buildReclaimAction("emergency"), /NOW/);
});

test("the emergency level re-fires on every request while the pressure holds", () => {
  // The policy, isolated: the emergency level bypasses the single-shot latch,
  // while warn keeps it.
  assert.equal(shouldFireAwarenessReminder(0.9, "emergency", { lastRatio: 0.9, lastLevel: "emergency" }, 0.05), true);
  assert.equal(shouldFireAwarenessReminder(0.9, "warn", { lastRatio: 0.9, lastLevel: "warn" }, 0.05), false);
  // A first crossing still fires at warn.
  assert.equal(shouldFireAwarenessReminder(0.6, "warn", {}, 0.05), true);
});

test("the hook re-fires the emergency advisory on every request at the same fill", async () => {
  const h = await harness({ limitContext: 10_000 });
  const system: Array<{ type: string; text: string }> = [];
  const base = { sessionID: "ses-emergency-refire", model: { providerID: "test", id: "model-x" }, system };
  // 80 percent of the window: the emergency line.
  await h.hook({ ...base, messages: [bigMessage(32_000)] });
  assert.equal(system.length, 1);
  assert.match(system[0]!.text, /COMPACT NOW/);
  // The very same fill again: a heads-down agent must not get one nudge and
  // then silence, so the emergency level re-fires.
  await h.hook({ ...base, messages: [bigMessage(32_000)] });
  assert.equal(system.length, 2);
  await h.hook({ ...base, messages: [bigMessage(32_000)] });
  assert.equal(system.length, 3);
  // Every re-fire still carries the reclaim action next to the ratio.
  assert.match(system[2]!.text, /Reclaim action/);
  assert.match(system[2]!.text, /80%/);
  // The hysteresis is untouched: once the fill falls below the clear line the
  // latch is released and the next crossing warns again with warn wording.
  await h.hook({ ...base, messages: [bigMessage(100)] });
  await h.hook({ ...base, messages: [bigMessage(20_000)] });
  assert.equal(system.length, 4);
  assert.match(system[3]!.text, /ACT NOW/);
});

test("user messages are never pruned and never summarized", () => {
  // The hard invariant: a user message is the request the agent is answering.
  // No pass may touch it, whatever its size.
  const request = "do not touch this: ".repeat(500);
  const state = emptyState();
  const messages: Msg[] = [
    userMessage("u1", request),
    toolResultMessage("call-1", "bash", "x".repeat(3000)),
    userMessage("u2", "still mine"),
  ];
  pruneToolResults(messages, state, DEFAULT_CONFIG, "ses-user-verbatim");
  applyOmissions(messages, state, DEFAULT_CONFIG);
  // The summary lane only ever rewrites assistant turns.
  state.summaries["a1"] = "a summary that must not reach a user turn";
  applySummaries(messages, state);
  assert.equal((messages[0]!.content[0] as { text?: unknown }).text, request);
  assert.equal((messages[2]!.content[0] as { text?: unknown }).text, "still mine");
});

test("an errored tool call is never pruned", () => {
  // The failure text is what the agent needs to diagnose the failure, so the
  // prune pass must leave an errored result exactly as the provider wrote it.
  const failure = "E: command failed with exit code 1\n".repeat(400);
  const state = emptyState();
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [{ type: "tool-result", id: "call-err", name: "bash", result: { type: "error", value: failure } }],
    },
  ];
  const result = pruneToolResults(messages, state, DEFAULT_CONFIG, "ses-error-untouched");
  assert.equal(result.pruned, 0);
  assert.equal(Object.keys(state.omissions).length, 0);
  const value = (messages[0]!.content[0]!.result as { value: string }).value;
  assert.equal(value, failure);
  assert.equal(toolResultStatus(messages[0]!.content[0]!), "error");
});

test("a pending tool call is never pruned", () => {
  // A call that has not produced a result yet has nothing to replace, and a
  // half-finished call must stay visible to the agent.
  const pending = "x".repeat(3000);
  const state = emptyState();
  const messages: Msg[] = [
    {
      id: "a1",
      role: "assistant",
      content: [
        {
          type: "tool-result",
          id: "call-pending",
          name: "bash",
          state: { status: "pending" },
          result: { type: "text", value: pending },
        },
      ],
    },
  ];
  const result = pruneToolResults(messages, state, DEFAULT_CONFIG, "ses-pending-untouched");
  assert.equal(result.pruned, 0);
  assert.equal(Object.keys(state.omissions).length, 0);
  const value = (messages[0]!.content[0]!.result as { value: string }).value;
  assert.equal(value, pending);
  assert.equal(toolResultStatus(messages[0]!.content[0]!), "pending");
});

test("read_omitted_content returns the original for a known Content ID", async () => {
  const h = await harness();
  const original = "the cached original tool output";
  const path = writeOmissionOriginal("ses-read-known", "omitted-0001", original);
  h.storage.set("session:ses-read-known", {
    summaries: {},
    omissions: { "omitted-0001": { id: "omitted-0001", callId: "call-1", name: "bash", tokens: 6, path } },
    omittedCalls: { "call-1": "omitted-0001" },
    stats: {},
    nextOmissionId: 2,
    pending: null,
  });
  const tool = h.tools.get("read_omitted_content");
  assert.ok(tool);
  const response = await tool.execute({ contentId: "omitted-0001" }, { sessionID: "ses-read-known" });
  assert.equal(response.content, original);
});

test("read_omitted_content returns an explicit missing notice for an unknown Content ID", async () => {
  const h = await harness();
  h.storage.set("session:ses-read-unknown", {
    summaries: {},
    omissions: {},
    omittedCalls: {},
    stats: {},
    nextOmissionId: 1,
    pending: null,
  });
  const tool = h.tools.get("read_omitted_content");
  assert.ok(tool);
  const response = await tool.execute({ contentId: "omitted-9999" }, { sessionID: "ses-read-unknown" });
  // No phantom restore: the answer names the id it could not find.
  assert.match(response.content, /omitted-9999/);
  assert.match(response.content, /cleared/);
  assert.equal(response.content.includes("the cached original tool output"), false);
});

test("the cached original stays on disk and readable after the prune pass", () => {
  // The notice promises a restore, so the restore has to work: the original
  // is written to the bounded store and can be read back byte for byte.
  const original = "z".repeat(4096);
  const state = emptyState();
  const messages: Msg[] = [toolResultMessage("call-1", "bash", original)];
  pruneToolResults(messages, state, DEFAULT_CONFIG, "ses-store-readback");
  const record = state.omissions["omitted-0001"]!;
  assert.equal(record.content, undefined);
  assert.equal(readFileSync(record.path!, "utf8"), original);
});
