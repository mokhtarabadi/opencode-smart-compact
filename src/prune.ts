import type { Msg, OmissionRecord, Part, SessionState } from "./types.js";

/** Cheap, dependency-free token estimate (~4 chars per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Tools whose completed output is always reloadable, so always prunable. */
const ALWAYS_OMIT = new Set(["read", "write", "edit", "apply_patch", "todowrite", "skill"]);

/** Prune a completed tool result when it is large enough to matter. */
export function shouldPrune(name: string | undefined, text: string): boolean {
  if (name && ALWAYS_OMIT.has(name)) return true;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return text.length > 1024 || words > 128;
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

/**
 * Walk the model-visible messages and prune oversized tool results that have
 * not been pruned yet. Mutates the parts in place and returns the number of
 * parts pruned plus the tokens saved. Never throws: an unexpected part shape is
 * skipped.
 */
export function pruneToolResults(
  messages: Msg[],
  state: SessionState,
): { pruned: number; tokens: number } {
  let pruned = 0;
  let tokens = 0;
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const callId = typeof part.id === "string" ? part.id : undefined;
      if (!callId || state.omittedCalls[callId]) continue;
      const name = typeof part.name === "string" ? part.name : undefined;
      const result = part.result as { type?: string; value?: unknown } | undefined;
      const text = serializeResult(result?.value);
      if (!shouldPrune(name, text)) continue;
      const id = `omitted-${String(Object.keys(state.omissions).length + 1).padStart(4, "0")}`;
      const saved = estimateTokens(text);
      const record: OmissionRecord = { id, callId, name, content: text, tokens: saved };
      state.omissions[id] = record;
      state.omittedCalls[callId] = id;
      // Replace the result payload with a small text notice.
      (part as Part).result = { type: "text", value: omissionNotice(id, name, saved) };
      pruned += 1;
      tokens += saved;
    }
  }
  return { pruned, tokens };
}

/** Re-apply stored omissions on every request (idempotent). */
export function applyOmissions(messages: Msg[], state: SessionState): void {
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const callId = typeof part.id === "string" ? part.id : undefined;
      if (!callId) continue;
      const id = state.omittedCalls[callId];
      if (!id) continue;
      const record = state.omissions[id];
      (part as Part).result = {
        type: "text",
        value: omissionNotice(id, record?.name, record?.tokens ?? 0),
      };
    }
  }
}
