import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoTrimResetLine,
  buildAwarenessMessage,
  getAwarenessLevel,
  measureVisibleTokens,
  resolveContextLimit,
  shouldAutoTrim,
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
  const cfg = { warnRatio: 0.5, emergencyRatio: 0.8 };
  assert.equal(getAwarenessLevel(0.49, cfg), "none");
  assert.equal(getAwarenessLevel(0.5, cfg), "warn");
  assert.equal(getAwarenessLevel(0.79, cfg), "warn");
  assert.equal(getAwarenessLevel(0.8, cfg), "emergency");
  assert.equal(getAwarenessLevel(1.2, cfg), "emergency");
  assert.equal(getAwarenessLevel(Number.NaN, cfg), "none");
  assert.equal(getAwarenessLevel(-0.1, cfg), "none");
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
  // The action comes first, as a command — impossible to skim past.
  const firstLine = text.split("\n")[0]!;
  assert.match(firstLine, /compact_context/);
  assert.match(firstLine, /ACT NOW/);
  // The live status of the context window.
  assert.match(text, /72%/);
  assert.match(text, /104000/);
  assert.match(text, /145000/);
  assert.match(text, /lower bound/);
  // What is lost if the reminder is ignored.
  assert.match(text, /dropped/);
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
  // Warn status names the required action.
  assert.match(text, /elevated context pressure/);
});

test("buildAwarenessMessage escalates the wording at the emergency level", () => {
  const text = buildAwarenessMessage({
    usedTokens: 190000,
    limitTokens: 200000,
    ratioPct: 95,
    level: "emergency",
  });
  const firstLine = text.split("\n")[0]!;
  assert.match(firstLine, /compact_context/);
  assert.match(firstLine, /COMPACT NOW/);
  assert.match(text, /95%/);
  assert.match(text, /emergency context pressure/);
  assert.match(text, /dropped/);
});

test("shouldAutoTrim fires on the first crossing and only re-arms after a step", () => {
  const base = { autoTrimRatio: 0.5, rearmStep: 0.05, hasPending: false };
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.4 }), false);
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.5 }), true);
  // 0 is the shipped default: auto-trim off.
  assert.equal(shouldAutoTrim({ ...base, autoTrimRatio: 0, ratio: 0.99 }), false);
  // A compaction already queued for the next request wins over a weaker trim.
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.99, hasPending: true }), false);
  // Same fill again: the latch holds, so a sustained period trims once.
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.5, lastRatio: 0.5 }), false);
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.53, lastRatio: 0.5 }), false);
  // A further step re-arms the trim.
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.55, lastRatio: 0.5 }), true);
  // A latched ratio at or above the current fill never fires.
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.6, lastRatio: 0.7 }), false);
  // Malformed input never schedules anything.
  assert.equal(shouldAutoTrim({ ...base, ratio: Number.NaN }), false);
  assert.equal(shouldAutoTrim({ ...base, autoTrimRatio: Number.NaN, ratio: 0.99 }), false);
  assert.equal(shouldAutoTrim({ ...base, ratio: 0.99, lastRatio: Number.NaN }), true);
  // A zero or invalid step cannot re-arm by growth: an unchanged fill would
  // otherwise re-queue on every request (review R1), so the latch holds.
  assert.equal(shouldAutoTrim({ ...base, rearmStep: 0, ratio: 0.9, lastRatio: 0.9 }), false);
  assert.equal(shouldAutoTrim({ ...base, rearmStep: Number.NaN, ratio: 0.9, lastRatio: 0.5 }), false);
  // The initial crossing still fires, and a reset (cleared latch) still fires.
  assert.equal(shouldAutoTrim({ ...base, rearmStep: 0, ratio: 0.9 }), true);
  assert.equal(shouldAutoTrim({ ...base, rearmStep: 0, ratio: 0.9, lastRatio: undefined }), true);
});

test("autoTrimResetLine never lands at or below zero", () => {
  assert.equal(autoTrimResetLine(0.5, 0.05), 0.45);
  // A step at or above the line would subtract to zero or below and the latch
  // could never clear, so the line itself becomes the reset point.
  assert.equal(autoTrimResetLine(0.03, 0.05), 0.03);
  assert.equal(autoTrimResetLine(0.05, 0.05), 0.05);
  // Disabled or malformed input resets at zero.
  assert.equal(autoTrimResetLine(0, 0.05), 0);
  assert.equal(autoTrimResetLine(Number.NaN, 0.05), 0);
});
