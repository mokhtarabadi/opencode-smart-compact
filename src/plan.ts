/**
 * Turn planning: group durable session-history entries into conversation turns
 * keyed by user-message boundaries, then select the turns eligible for
 * summarization. Grouping by turn (not by raw assistant message) keeps
 * multi-step tool loops intact so a tool call is never summarized away from its
 * result.
 */

/** Minimal structural view of a durable session-history entry. */
export interface HistoryEntry {
  id?: string;
  type?: string;
  text?: string;
  content?: ReadonlyArray<{ type?: string; text?: string; name?: string }>;
}

/** One conversation turn: the opening user text plus its assistant messages. */
export interface Turn {
  userText: string;
  assistants: Array<{ id: string; text: string }>;
}

/** Reduce an assistant entry to the prose and tool names that matter for a summary. */
function assistantText(entry: HistoryEntry): string {
  const parts = Array.isArray(entry.content) ? entry.content : [];
  const chunks: string[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    if ((part.type === "text" || part.type === "reasoning") && typeof part.text === "string") {
      chunks.push(part.text);
    } else if (part.type === "tool" && typeof part.name === "string") {
      chunks.push(`[tool: ${part.name}]`);
    }
  }
  return chunks.join("\n").trim();
}

/** Group history entries into turns. Only a real `user` entry opens a turn. */
export function buildTurns(entries: readonly HistoryEntry[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.type === "user") {
      current = { userText: typeof entry.text === "string" ? entry.text : "", assistants: [] };
      turns.push(current);
      continue;
    }
    if (entry.type === "assistant" && typeof entry.id === "string") {
      if (!current) {
        current = { userText: "", assistants: [] };
        turns.push(current);
      }
      current.assistants.push({ id: entry.id, text: assistantText(entry) });
    }
  }
  return turns;
}

/**
 * Select the turns to summarize: everything except the most recent `keepTurns`
 * turns and the preserved recent window. `keepTurns <= 0` with no preserved
 * window selects every turn. The preserved tail always contains the last user
 * message, so recent context (including the latest request) is never eligible.
 */
export function selectTurns(turns: Turn[], keepTurns: number, preserveRecentTurns = 0): Turn[] {
  if (keepTurns <= 0 && preserveRecentTurns <= 0) return turns.slice();
  const cut = Math.max(0, keepTurns) + Math.max(0, preserveRecentTurns);
  return turns.slice(0, Math.max(0, turns.length - cut));
}
