import type { Msg, Part, SessionState } from "./types.js";

/** Extract the plain text of a message (all text parts joined). */
export function messageText(msg: Msg): string {
  if (!Array.isArray(msg.content)) return "";
  return msg.content
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();
}

/**
 * Replace summarized assistant messages with their stored summary, keeping the
 * conversation skeleton. Mutates in place. Idempotent: a message whose content
 * is already the single summary text is left untouched.
 */
export function applySummaries(messages: Msg[], state: SessionState): number {
  let applied = 0;
  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.id) continue;
    const summary = state.summaries[msg.id];
    if (!summary) continue;
    if (msg.content.length === 1 && msg.content[0]?.type === "text" && msg.content[0]?.text === summary) {
      continue;
    }
    const replacement: Part = {
      type: "text",
      text: `[summarized turn — ${summary}]`,
      metadata: { "smart-compact": true },
    };
    msg.content.splice(0, msg.content.length, replacement);
    applied += 1;
  }
  return applied;
}

/** Count assistant messages that are candidates for summarization. */
export function assistantTurnIds(messages: Msg[]): string[] {
  const ids: string[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant" && msg.id) ids.push(msg.id);
  }
  return ids;
}
