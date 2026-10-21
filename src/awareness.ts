/**
 * Context-pressure awareness: pure measurement, threshold selection, and the
 * agent-facing reminder text.
 *
 * This module performs no I/O, holds no state, and imports no SDK types. The
 * `context` hook in `index.ts` owns delivery (one system part on the outgoing
 * model call) and persistence (the per-session latch). Keeping the decision
 * logic pure is what makes the threshold behaviour testable without a running
 * OpenCode server.
 *
 * The measured ratio is a lower bound by construction: the plugin can only see
 * the model-visible messages. Provider-side system prompts and the tool
 * schemas are invisible to it, so the real fill is always higher than the
 * number reported to the agent. The reminder says so explicitly.
 */
import { estimateTokens, serializeResult } from "./prune.js";
import type { Msg, Part } from "./types.js";

/** Severity of the current context pressure. `none` means "stay quiet". */
export type AwarenessLevel = "none" | "warn" | "emergency";

/** The two levels that produce a reminder. */
export type AwarenessWarnLevel = "warn" | "emergency";

/** The latch of the previous reminder for one session. */
export interface AwarenessPrev {
  /** Fill ratio recorded at the last reminder. */
  lastRatio?: number;
  /** Level recorded at the last reminder. */
  lastLevel?: AwarenessWarnLevel;
}

/** Minimal structural view of a model entry used for the limit lookup. */
export interface AwarenessModel {
  providerID: string;
  id: string;
  limit?: { context?: number };
}

/** Text carried by one model-visible part, or an empty string when it has none. */
function partText(part: Part): string {
  if (part.type === "text" || part.type === "reasoning") {
    return typeof part.text === "string" ? part.text : "";
  }
  if (part.type === "tool-result") {
    const result = part.result as { value?: unknown } | undefined;
    const text = serializeResult(result?.value);
    return typeof text === "string" ? text : "";
  }
  if (part.type === "tool-call") {
    const args = part.arguments ?? part.args;
    return args === undefined ? "" : serializeResult(args);
  }
  // Media, compaction markers, and unknown part kinds carry no countable text.
  return "";
}

/**
 * Measured token cost of the model-visible messages.
 *
 * Counts every countable part — text, reasoning, tool results, and tool call
 * arguments — because tool output is normally the bulk of a session's context.
 * Uses the same dependency-free estimate as the prune pass (about four
 * characters per token), so the plugin keeps working with no tokenizer
 * installed and the number stays comparable with the rest of the plugin.
 */
export function measureVisibleTokens(messages: Msg[]): number {
  const chunks: string[] = [];
  for (const msg of messages ?? []) {
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (!part || typeof part !== "object") continue;
      const text = partText(part);
      if (text) chunks.push(text);
    }
  }
  if (chunks.length === 0) return 0;
  return estimateTokens(chunks.join("\n"));
}

/**
 * The context window of the model a session is talking to, looked up by
 * provider and model id. Returns `undefined` when the model is unknown or
 * carries no usable positive limit — the caller then stays silent rather than
 * guessing a window size.
 */
export function resolveContextLimit(
  modelRef: { providerID: string; id: string },
  models: ReadonlyArray<AwarenessModel>,
): number | undefined {
  if (!modelRef || typeof modelRef.providerID !== "string" || typeof modelRef.id !== "string") {
    return undefined;
  }
  const found = (models ?? []).find(
    (m) => m && m.providerID === modelRef.providerID && m.id === modelRef.id,
  );
  const limit = found?.limit?.context;
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) return undefined;
  return Math.floor(limit);
}

/**
 * The pressure level for a fill ratio. `emergency` wins over `warn`; a ratio
 * below the warn threshold is `none` and produces no reminder.
 */
export function getAwarenessLevel(
  ratio: number,
  cfg: { warnRatio: number; emergencyRatio: number },
): AwarenessLevel {
  if (!Number.isFinite(ratio) || ratio < 0) return "none";
  if (ratio >= cfg.emergencyRatio) return "emergency";
  if (ratio >= cfg.warnRatio) return "warn";
  return "none";
}

/**
 * Whether a reminder should fire for the current ratio.
 *
 * The first crossing always fires. After that, a reminder re-fires only when
 * the fill grew by at least `rearmStep`, or when the level escalated (warn to
 * emergency) — an escalation is worth a nudge even below the re-arm step.
 * A session that compacts drops below the warn threshold, which clears the
 * latch in the hook, so the next refill warns again.
 */
export function shouldFireAwareness(
  ratio: number,
  level: AwarenessWarnLevel,
  prev: AwarenessPrev,
  rearmStep: number,
): boolean {
  if (typeof prev?.lastRatio !== "number") return true;
  const last = prev.lastRatio;
  if (typeof prev.lastLevel === "string" && prev.lastLevel !== level && ratio > last) return true;
  return ratio >= last + rearmStep;
}

/**
 * The professional reminder addressed to the agent.
 *
 * It states the current fill of the context window with the numbers behind
 * it, names the exact tool to call and where to find it, tells the agent to
 * re-orient on the project before compacting so the thread of the request
 * survives, and keeps the whole thing advisory: the agent decides when it is
 * safe to compact and no step is ever aborted.
 */
export function buildAwarenessMessage(args: {
  usedTokens: number;
  limitTokens: number;
  ratioPct: number;
  level: AwarenessWarnLevel;
}): string {
  const emergency = args.level === "emergency";
  const status = emergency
    ? "emergency context pressure - immediate action advised"
    : "elevated context pressure - plan compaction soon";
  return [
    `[smart-compact] CONTEXT PRESSURE - ${args.ratioPct}% of the context window is in use (about ${args.usedTokens} of ${args.limitTokens} measured tokens).`,
    "",
    `Status: ${status}. The measured fill is a lower bound: it counts only the model-visible messages, while provider system prompts and tool schemas are invisible to the plugin, so the true usage is higher than this number.`,
    "",
    "What to do now:",
    "1. Search your own tool list for `compact_context` and call it. `/magic-compact` is the Manager-only manual equivalent - never ask the Manager to run a slash command.",
    "2. Before compacting, re-orient on the project: read AGENTS.md and the active task file, so the summary keeps the thread of what was asked.",
    "3. If the work in flight is not a critical, hard-to-reverse step, you MUST compact now. Sessions and turns must not silently overflow.",
    "",
    "Rules:",
    "- Advisory only. If you are mid-critical-step, finish that step and compact right after. Never abort a half-written edit, a running tool call, or a commit sequence to compact.",
    "- User messages are never summarized. Pruned tool output stays retrievable via read_omitted_content by Content ID.",
  ].join("\n");
}
