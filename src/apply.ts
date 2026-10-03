import type { Msg, Part, SessionState } from "./types.js";

/** Marker metadata so a summary part is recognizable and idempotent. */
const SUMMARY_META = "smart-compact-summary";

/** Extract the plain text of a message (all text parts joined). */
export function messageText(msg: Msg): string {
  if (!Array.isArray(msg.content)) return "";
  return msg.content
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();
}

/** True once this message already carries a smart-compact summary part. */
function isSummarized(msg: Msg): boolean {
  return msg.content.some(
    (p) =>
      p.type === "text" &&
      p.metadata !== undefined &&
      (p.metadata as Record<string, unknown>)[SUMMARY_META] === true,
  );
}

/**
 * Rebuild an assistant message's parts for a summarized turn: drop the prose and
 * reasoning, keep the tool-call/tool-result/media/compaction structure, and
 * insert a single summary text part in place of the removed prose. An empty
 * `summary` strips prose without emitting a summary (the "absorbed" sentinel for
 * the later assistant messages of a multi-step turn).
 */
function summarizeContent(content: Part[], summary: string): Part[] {
  const kept: Part[] = [];
  let inserted = false;
  for (const part of content) {
    if (part.type === "text" || part.type === "reasoning") {
      if (!inserted && summary) {
        kept.push({ type: "text", text: `[summarized turn — ${summary}]`, metadata: { [SUMMARY_META]: true } });
        inserted = true;
      }
      continue;
    }
    kept.push(part);
  }
  if (!inserted && summary) {
    kept.unshift({ type: "text", text: `[summarized turn — ${summary}]`, metadata: { [SUMMARY_META]: true } });
  }
  return kept;
}

/**
 * Replace summarized assistant prose with its stored summary while preserving
 * tool structure. Mutates in place. Idempotent within a single request.
 */
export function applySummaries(messages: Msg[], state: SessionState): number {
  let applied = 0;
  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.id) continue;
    if (!(msg.id in state.summaries)) continue;
    if (isSummarized(msg)) continue;
    // Nothing to replace: prose was already stripped (e.g. an absorbed turn).
    if (!msg.content.some((p) => p.type === "text" || p.type === "reasoning")) continue;
    msg.content = summarizeContent(msg.content, state.summaries[msg.id] ?? "");
    applied += 1;
  }
  return applied;
}
