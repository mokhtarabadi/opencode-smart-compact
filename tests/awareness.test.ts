import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAwarenessMessage,
  getAwarenessLevel,
  measureVisibleTokens,
  resolveContextLimit,
  shouldFireAwareness,
} from "../src/awareness.js";
import type { Msg } from "../src/types.js";

/** One assistant message with a text part, a tool result, and a media part. */
function sampleMessage(): Msg {
  return {
    role: "assistant",
    content: [
      { type: "text", text: "a".repeat(400) },
      { type: "tool-result", id: "call-1", result: { type: "text", value: "b".repeat(800) } },
      { type: "media" },
    ],
  };
}

test("measureVisibleTokens counts text and tool results and ignores media", () => {
  const messages = [sampleMessage()];
  // Text (400 chars) plus the serialized tool result (800 chars) plus one
  // newline separator between the two chunks. The media part carries no text.
  assert.equal(measureVisibleTokens(messages), Math.ceil((400 + 1 + 800) / 4));
});

test("measureVisibleTokens ignores unknown part shapes and empty input", () => {
  const onlyMedia: Msg = { role: "assistant", content: [{ type: "media" }, { type: "compaction" }] };
  assert.equal(measureVisibleTokens([onlyMedia]), 0);
  assert.equal(measureVisibleTokens([]), 0);
});

test("measureVisibleTokens counts an empty tool result as nothing", () => {
  // A tool result with no value must not inflate the ratio.
  const empty: Msg = {
    role: "tool",
    content: [{ type: "tool-result", id: "call-empty", result: { type: "text" } }],
  };
  assert.equal(measureVisibleTokens([empty]), 0);
});

test("resolveContextLimit matches provider plus model id", () => {
  const models = [
    { providerID: "opencode", id: "model-a", limit: { context: 200000 } },
    { providerID: "anthropic", id: "model-b", limit: { context: 100000 } },
  ];
  assert.equal(resolveContextLimit({ providerID: "opencode", id: "model-a" }, models), 200000);
  assert.equal(resolveContextLimit({ providerID: "anthropic", id: "model-b" }, models), 100000);
});

test("resolveContextLimit returns undefined for a miss or an unusable limit", () => {
  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 0 } }];
  assert.equal(resolveContextLimit({ providerID: "opencode", id: "nope" }, models), undefined);
  assert.equal(resolveContextLimit({ providerID: "opencode", id: "model-a" }, models), undefined);
  assert.equal(resolveContextLimit({ providerID: "x", id: "y" }, []), undefined);
  assert.equal(
    resolveContextLimit({ providerID: "x", id: "y" }, [{ providerID: "x", id: "y", limit: { context: -5 } }]),
    undefined,
  );
});

test("getAwarenessLevel maps the ratio to none, warn, and emergency", () => {
  const cfg = { warnRatio: 0.7, emergencyRatio: 0.9 };
  assert.equal(getAwarenessLevel(0.69, cfg), "none");
  assert.equal(getAwarenessLevel(0.7, cfg), "warn");
  assert.equal(getAwarenessLevel(0.89, cfg), "warn");
  assert.equal(getAwarenessLevel(0.9, cfg), "emergency");
  assert.equal(getAwarenessLevel(Number.NaN, cfg), "none");
});

test("shouldFireAwareness fires on the first crossing and stays quiet on a repeat", () => {
  assert.equal(shouldFireAwareness(0.72, "warn", {}, 0.05), true);
  assert.equal(shouldFireAwareness(0.72, "warn", { lastRatio: 0.72, lastLevel: "warn" }, 0.05), false);
});

test("shouldFireAwareness re-arms only after the configured step", () => {
  const prev = { lastRatio: 0.72, lastLevel: "warn" as const };
  assert.equal(shouldFireAwareness(0.74, "warn", prev, 0.05), false);
  assert.equal(shouldFireAwareness(0.77, "warn", prev, 0.05), true);
});

test("shouldFireAwareness fires on an escalation before a full step", () => {
  const prev = { lastRatio: 0.72, lastLevel: "warn" as const };
  assert.equal(shouldFireAwareness(0.75, "emergency", prev, 0.05), true);
});

test("buildAwarenessMessage states the fill, the tool, and the advisory rules", () => {
  const text = buildAwarenessMessage({
    usedTokens: 104000,
    limitTokens: 145000,
    ratioPct: 72,
    level: "warn",
  });
  // The live status of the context window.
  assert.match(text, /72%/);
  assert.match(text, /104000/);
  assert.match(text, /145000/);
  assert.match(text, /lower bound/);
  // The tool to call and where to find it.
  assert.match(text, /compact_context/);
  assert.match(text, /magic-compact/);
  assert.match(text, /never ask the Manager to run a slash command/);
  // Re-orient before compacting.
  assert.match(text, /AGENTS\.md/);
  assert.match(text, /active task file/);
  // The action itself.
  assert.match(text, /you MUST compact now/);
  assert.match(text, /not a critical/);
  // Advisory only, and the safety guarantees.
  assert.match(text, /Advisory only/);
  assert.match(text, /mid-critical-step/);
  assert.match(text, /Never abort a half-written edit/);
  assert.match(text, /user messages are never summarized/i);
  assert.match(text, /read_omitted_content/);
});

test("buildAwarenessMessage escalates the wording at the emergency level", () => {
  const text = buildAwarenessMessage({
    usedTokens: 190000,
    limitTokens: 200000,
    ratioPct: 95,
    level: "emergency",
  });
  assert.match(text, /95%/);
  assert.match(text, /emergency context pressure/);
});
