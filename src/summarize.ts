import type { Turn } from "./plan.js";
import type { Ctx } from "./store.js";
import type { SessionState } from "./types.js";

/** Keep a single turn's prompt bounded so one giant turn cannot blow the budget. */
const MAX_TURN_CHARS = 6000;
/** Cap the accumulated turn text per model call so a large compaction stays bounded. */
const MAX_CHUNK_CHARS = 12000;

/** Join a turn's assistant text and tool markers, bounded for the prompt. */
function turnBody(turn: Turn): string {
  const body = turn.assistants
    .map((a) => a.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return body.length > MAX_TURN_CHARS ? `${body.slice(0, MAX_TURN_CHARS)}\n…[truncated]` : body;
}

/** Deterministic fallback summary when the model output is missing or empty. */
export function heuristicSummary(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 400 ? `${oneLine.slice(0, 400)}…` : oneLine;
}

/** A turn queued for summarization with its precomputed body. */
export interface PendingTurn {
  turn: Turn;
  firstId: string;
  body: string;
}

/**
 * Split queued turns into model-call chunks whose combined body stays under
 * `maxChars`. A single oversized turn still gets its own chunk.
 */
export function chunkTurns(pending: PendingTurn[], maxChars: number = MAX_CHUNK_CHARS): PendingTurn[][] {
  const chunks: PendingTurn[][] = [];
  let current: PendingTurn[] = [];
  let size = 0;
  for (const item of pending) {
    if (current.length > 0 && size + item.body.length > maxChars) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += item.body.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Parse `<summary id="...">text</summary>` blocks from a batched model reply.
 * Ids are the first assistant message id of each turn. Empty summaries are
 * dropped so the caller can fall back to a heuristic.
 */
export function parseSummaryBlocks(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /<summary\s+id="([^"]+)"\s*>([\s\S]*?)<\/summary>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const id = match[1]!;
    const summary = match[2]!.trim();
    if (summary) out.set(id, summary);
  }
  return out;
}

/** Build one prompt asking for a summary block per turn in the chunk. */
function batchPrompt(chunk: PendingTurn[]): string {
  const parts = [
    "You summarize old assistant turns from a coding session.",
    "For each turn below, write a 2-4 sentence high-signal summary.",
    "Keep what the assistant did, the decisions and why, files or commands touched, and what comes next.",
    "Drop raw tool output, repeated reasoning, and restated user text.",
    "Return exactly one block per turn in this form, and nothing else:",
    '<summary id="TURN_ID">summary text</summary>',
    "",
  ];
  for (const item of chunk) {
    parts.push(`<turn id="${item.firstId}">`);
    parts.push(`<user>${item.turn.userText.slice(0, 500)}</user>`);
    parts.push(`<assistant>${item.body}</assistant>`);
    parts.push("</turn>");
  }
  return parts.join("\n");
}

/**
 * Summarize the eligible turns and store the result by assistant message id.
 * Turns are batched into as few `ctx.generate.text` calls as possible (one per
 * chunk), mirroring the reference plugin's single-request design. The first
 * assistant message of a turn carries the summary; the remaining ones are
 * marked "absorbed" (empty string) so their prose is stripped without a
 * duplicate summary. Turns with no prose, reasoning, or tool markers are
 * absorbed without a model call. A failed or incomplete reply falls back to a
 * heuristic so compaction never fails.
 */
export async function summarizeTurns(ctx: Ctx, turns: Turn[], state: SessionState): Promise<number> {
  let done = 0;
  const pending: PendingTurn[] = [];

  for (const turn of turns) {
    const first = turn.assistants[0];
    if (!first) continue;
    if (first.id in state.summaries) continue;
    const body = turnBody(turn);
    if (!body) {
      for (const assistant of turn.assistants) state.summaries[assistant.id] = "";
      done += 1;
      continue;
    }
    pending.push({ turn, firstId: first.id, body });
  }

  for (const chunk of chunkTurns(pending)) {
    let parsed = new Map<string, string>();
    try {
      const out = await ctx.generate.text({ prompt: batchPrompt(chunk) });
      parsed = parseSummaryBlocks(out?.text ?? "");
    } catch {
      parsed = new Map();
    }
    for (const item of chunk) {
      state.summaries[item.firstId] = parsed.get(item.firstId) ?? heuristicSummary(item.body);
      const assistants = item.turn.assistants;
      for (let i = 1; i < assistants.length; i += 1) {
        state.summaries[assistants[i]!.id] = "";
      }
      done += 1;
    }
  }
  return done;
}
