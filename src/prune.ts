import { DEFAULT_CONFIG, type SmartCompactConfig } from "./config.js";
import type { Msg, OmissionRecord, Part, SessionState } from "./types.js";

/** Cheap, dependency-free token estimate (~4 chars per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function exceeds(text: string, words: number, chars: number): boolean {
  const count = text.trim().split(/\s+/).filter(Boolean).length;
  return text.length > chars || count > words;
}

/** Whether a completed tool result should be pruned under the given config. */
export function shouldPrune(
  tool: string | undefined,
  text: string,
  config: SmartCompactConfig = DEFAULT_CONFIG,
): boolean {
  const name = tool ?? "";
  if (config.pruning.protectedTools.includes(name)) return false;
  if (name in config.pruning.discardTools) return false;
  if (config.pruning.alwaysPruneTools.includes(name)) return true;
  if (name === "task") return exceeds(text, config.pruning.taskMaxWords, config.pruning.taskMaxChars);
  return exceeds(text, config.pruning.maxWords, config.pruning.maxChars);
}

/** Serialize a tool-result value to text for caching and token estimation. */
export function serializeResult(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Build the notice text that replaces a pruned tool result. */
export function omissionNotice(id: string, name: string | undefined, tokens: number): string {
  const tool = name ? ` from \`${name}\`` : "";
  return (
    `[omitted tool output${tool} — ~${tokens} tokens. ` +
    `Content ID: ${id}. Call read_omitted_content with this ID if the original is required.]`
  );
}

/** Allocate the next monotonic omission id and advance the counter. */
function nextOmissionId(state: SessionState): string {
  const id = `omitted-${String(state.nextOmissionId).padStart(4, "0")}`;
  state.nextOmissionId += 1;
  return id;
}

function partName(part: Part): string | undefined {
  return typeof part.name === "string" ? part.name : undefined;
}

function partCallId(part: Part): string | undefined {
  return typeof part.id === "string" ? part.id : undefined;
}

/**
 * Walk the model-visible messages and prune oversized tool results that have
 * not been pruned yet. Mutates the parts in place and returns the number of
 * parts pruned plus the tokens saved. Never throws.
 */
export function pruneToolResults(
  messages: Msg[],
  state: SessionState,
  config: SmartCompactConfig = DEFAULT_CONFIG,
): { pruned: number; tokens: number } {
  let pruned = 0;
  let tokens = 0;
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const callId = partCallId(part);
      if (!callId || state.omittedCalls[callId]) continue;
      const name = partName(part);
      const result = part.result as { type?: string; value?: unknown } | undefined;
      const text = serializeResult(result?.value);

      const discard = name ? config.pruning.discardTools[name] : undefined;
      if (discard !== undefined) {
        part.result = { type: "text", value: discard };
        continue;
      }
      if (!shouldPrune(name, text, config)) continue;

      const id = nextOmissionId(state);
      const saved = estimateTokens(text);
      const record: OmissionRecord = { id, callId, name, content: text, tokens: saved };
      state.omissions[id] = record;
      state.omittedCalls[callId] = id;
      part.result = { type: "text", value: omissionNotice(id, name, saved) };
      pruned += 1;
      tokens += saved;
    }
  }
  return { pruned, tokens };
}

/** Re-apply stored omissions and discard rules on every request (idempotent). */
export function applyOmissions(
  messages: Msg[],
  state: SessionState,
  config: SmartCompactConfig = DEFAULT_CONFIG,
): void {
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const name = partName(part);
      const discard = name ? config.pruning.discardTools[name] : undefined;
      if (discard !== undefined) {
        part.result = { type: "text", value: discard };
        continue;
      }
      const callId = partCallId(part);
      if (!callId) continue;
      const id = state.omittedCalls[callId];
      if (!id) continue;
      const record = state.omissions[id];
      part.result = {
        type: "text",
        value: omissionNotice(id, record?.name, record?.tokens ?? 0),
      };
    }
  }
}
