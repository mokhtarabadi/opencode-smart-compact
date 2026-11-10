import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoTrimResetLine,
  buildAwarenessMessage,
  getAwarenessLevel,
  getAwarenessTokenLevel,
  getEffectiveAwarenessLevel,
  isBelowAwarenessRearmLine,
  measureVisibleTokens,
  resolveAwarenessWindow,
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

test("resolveAwarenessWindow uses the registry alone when nothing is configured", () => {
  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 200_000 } }];
  assert.deepEqual(resolveAwarenessWindow({ providerID: "opencode", id: "model-a" }, models, 0), {
    limitTokens: 200_000,
    source: "registry",
    registryTokens: 200_000,
    capped: false,
  });
});

test("resolveAwarenessWindow falls back to the configured window when the registry has none", () => {
  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 0 } }];
  // No registry number exists at all, so `registryTokens` is absent and the
  // configured value is the denominator exactly, not a cap on anything.
  assert.deepEqual(resolveAwarenessWindow({ providerID: "opencode", id: "model-a" }, models, 150_000), {
    limitTokens: 150_000,
    source: "config",
    capped: false,
  });
  // A configured value of 0 or a malformed value is "not configured".
  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, models, 0), { capped: false });
  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, models, Number.NaN), {
    capped: false,
  });
});

test("resolveAwarenessWindow caps a larger registry window with the configured value", () => {
  // The defect: a 1M-token window made warnRatio unreachable, and the
  // configured value was ignored whenever the registry had a limit. A smaller
  // configured value now wins as a hard cap, and both numbers are reported so
  // the caller can say the denominator was capped rather than measured.
  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 1_000_000 } }];
  assert.deepEqual(resolveAwarenessWindow({ providerID: "opencode", id: "model-a" }, models, 200_000), {
    limitTokens: 200_000,
    source: "config",
    registryTokens: 1_000_000,
    capped: true,
  });
});

test("resolveAwarenessWindow keeps the registry when the configured value is larger", () => {
  // A configured value above the real window cannot be a cap: it would demand
  // more context than the model accepts.
  const models = [{ providerID: "opencode", id: "model-a", limit: { context: 200_000 } }];
  assert.deepEqual(resolveAwarenessWindow({ providerID: "opencode", id: "model-a" }, models, 500_000), {
    limitTokens: 200_000,
    source: "registry",
    registryTokens: 200_000,
    capped: false,
  });
  // Equal numbers are not a cap either: nothing was reduced.
  assert.deepEqual(resolveAwarenessWindow({ providerID: "opencode", id: "model-a" }, models, 200_000), {
    limitTokens: 200_000,
    source: "registry",
    registryTokens: 200_000,
    capped: false,
  });
});

test("resolveAwarenessWindow stays silent when neither source exists", () => {
  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, [], 0), { capped: false });
  assert.deepEqual(resolveAwarenessWindow({ providerID: "x", id: "y" }, [], undefined), {
    capped: false,
  });
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

test("buildAwarenessMessage names a configured denominator", () => {
  const text = buildAwarenessMessage({
    usedTokens: 60_000,
    limitTokens: 100_000,
    ratioPct: 60,
    level: "warn",
    windowSource: "config",
  });
  // The operator must know the denominator was configured, not measured.
  assert.match(text, /configured/);
  assert.match(text, /awareness\.contextWindowTokens/);
});

test("buildAwarenessMessage does not claim a configured denominator from the registry", () => {
  const text = buildAwarenessMessage({
    usedTokens: 60_000,
    limitTokens: 100_000,
    ratioPct: 60,
    level: "warn",
    windowSource: "registry",
  });
  assert.equal(/awareness\.contextWindowTokens/.test(text), false);
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
  // 0 means "never auto-trim", an explicit opt-out.
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

test("getAwarenessTokenLevel maps absolute token counts and stays off at zero", () => {
  const cfg = { warnAtTokens: 150_000, emergencyAtTokens: 400_000 };
  assert.equal(getAwarenessTokenLevel(149_999, cfg), "none");
  assert.equal(getAwarenessTokenLevel(150_000, cfg), "warn");
  assert.equal(getAwarenessTokenLevel(399_999, cfg), "warn");
  assert.equal(getAwarenessTokenLevel(400_000, cfg), "emergency");
  // 0 means "this absolute threshold is disabled", the shipped default.
  assert.equal(getAwarenessTokenLevel(10_000_000, { warnAtTokens: 0, emergencyAtTokens: 0 }), "none");
  // Only the emergency line set: warn stays disabled, emergency still fires.
  assert.equal(getAwarenessTokenLevel(999_999, { warnAtTokens: 0, emergencyAtTokens: 400_000 }), "emergency");
  // A malformed measurement never raises a reminder.
  assert.equal(getAwarenessTokenLevel(Number.NaN, cfg), "none");
  assert.equal(getAwarenessTokenLevel(-1, cfg), "none");
  assert.equal(getAwarenessTokenLevel(Number.POSITIVE_INFINITY, cfg), "none");
});

test("getEffectiveAwarenessLevel takes the stronger of the ratio and token levels", () => {
  const cfg = {
    warnRatio: 0.5,
    emergencyRatio: 0.8,
    warnAtTokens: 150_000,
    emergencyAtTokens: 400_000,
  };
  // Ratio alone: 60% of a 1M window is 600K tokens, which is also emergency.
  assert.equal(getEffectiveAwarenessLevel(600_000, 0.6, cfg), "emergency");
  // Token alone: 15% of a 1M window is a warn because of the absolute line.
  assert.equal(getEffectiveAwarenessLevel(160_000, 0.16, cfg), "warn");
  // Emergency tokens win over a warn ratio (40% of a 1M window).
  assert.equal(getEffectiveAwarenessLevel(400_000, 0.4, cfg), "emergency");
  // Neither signal crossed.
  assert.equal(getEffectiveAwarenessLevel(100_000, 0.1, cfg), "none");
  // Both absolute thresholds disabled: identical to the ratio path.
  const ratioOnly = { ...cfg, warnAtTokens: 0, emergencyAtTokens: 0 };
  assert.equal(getEffectiveAwarenessLevel(900_000, 0.9, ratioOnly), "emergency");
  assert.equal(getEffectiveAwarenessLevel(900_000, 0.4, ratioOnly), "none");
});

test("isBelowAwarenessRearmLine requires every armed signal to be below its line", () => {
  const cfg = { warnRatio: 0.5, warnAtTokens: 150_000, rearmStep: 0.05 };
  // 10 percent below a 45 percent ratio clear line, and below the token line.
  assert.equal(isBelowAwarenessRearmLine({ usedTokens: 40_000, ratio: 0.1, cfg }), true);
  // Hovering just under the ratio line is not enough: the latch must hold.
  assert.equal(isBelowAwarenessRearmLine({ usedTokens: 40_000, ratio: 0.46, cfg }), false);
  // The ratio dropped but the token count still sits near the absolute line
  // (149K of a 150K line): the token signal has not re-armed yet.
  assert.equal(isBelowAwarenessRearmLine({ usedTokens: 149_000, ratio: 0.46, cfg }), false);
  // Token line minus one re-arm step (150K * 0.95 = 142500) clears it.
  assert.equal(isBelowAwarenessRearmLine({ usedTokens: 142_400, ratio: 0.1, cfg }), true);
  // With the absolute line disabled only the ratio decides.
  const ratioOnly = { ...cfg, warnAtTokens: 0 };
  assert.equal(isBelowAwarenessRearmLine({ usedTokens: 900_000, ratio: 0.1, cfg: ratioOnly }), true);
  // Without an armed line and without a usable step nothing clears a latch.
  assert.equal(
    isBelowAwarenessRearmLine({ usedTokens: 0, ratio: 0.1, cfg: { warnRatio: 0.05, warnAtTokens: 0, rearmStep: 0.05 } }),
    false,
  );
});

test("buildAwarenessMessage explains a capped denominator instead of a missing limit", () => {
  const text = buildAwarenessMessage({
    usedTokens: 152_000,
    limitTokens: 200_000,
    ratioPct: 76,
    level: "warn",
    windowSource: "config",
    registryTokens: 1_000_000,
    capped: true,
  });
  assert.match(text, /76%/);
  // The cap must be described as a cap, not as a registry that carries no limit.
  assert.match(text, /capped/i);
  assert.match(text, /1000000/);
  assert.equal(/carries no `limit\.context`/.test(text), false);
});

test("buildAwarenessMessage names an absolute token line as the reason", () => {
  const text = buildAwarenessMessage({
    usedTokens: 150_000,
    limitTokens: 1_000_000,
    ratioPct: 15,
    level: "warn",
    windowSource: "registry",
    registryTokens: 1_000_000,
    capped: false,
    absoluteTriggered: true,
  });
  // A warn at 15 percent needs its reason stated, or the agent cannot tell why.
  assert.match(text, /awareness\.warnAtTokens/);
  assert.match(text, /150000 measured tokens/);
  // A ratio-triggered reminder must not carry the absolute note.
  const ratioOnly = buildAwarenessMessage({
    usedTokens: 600_000,
    limitTokens: 1_000_000,
    ratioPct: 60,
    level: "warn",
    windowSource: "registry",
    registryTokens: 1_000_000,
    capped: false,
  });
  assert.equal(/warnAtTokens/.test(ratioOnly), false);
});
