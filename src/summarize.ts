import { assistantTurnIds, messageText } from "./apply.js";
import type { Ctx } from "./store.js";
import type { Msg, SessionState } from "./types.js";

const SUMMARY_PROMPT = (turn: string) =>
  [
    "Condense the following assistant turn from a coding session into a short, high-signal summary.",
    "Keep: what the assistant did, what it decided and why, files or commands touched, and what comes next.",
    "Drop: raw tool output, repeated reasoning, and restated user text.",
    "Write 2-4 sentences, no preamble, no bullet list.",
    "",
    "--- ASSISTANT TURN ---",
    turn,
    "--- END TURN ---",
  ].join("\n");

/**
 * Summarize the oldest assistant turns, keeping the most recent `keepTurns`
 * untouched. Turns already summarized are skipped. Summaries are generated with
 * the session's own model through `ctx.generate.text` and stored by message id.
 * Failures are swallowed per turn so one bad turn never aborts a compaction.
 */
export async function summarizeOldTurns(
  ctx: Ctx,
  messages: Msg[],
  keepTurns: number,
  state: SessionState,
): Promise<number> {
  const ids = assistantTurnIds(messages);
  const eligible = keepTurns > 0 ? ids.slice(0, Math.max(0, ids.length - keepTurns)) : ids;
  const byId = new Map<string, Msg>();
  for (const msg of messages) if (msg.id) byId.set(msg.id, msg);

  let done = 0;
  for (const id of eligible) {
    if (state.summaries[id]) continue;
    const msg = byId.get(id);
    if (!msg) continue;
    const text = messageText(msg);
    if (!text) {
      // No text (e.g. a tool-only turn): mark it summarized with a terse note
      // so it stops consuming context without an LLM round-trip.
      state.summaries[id] = "(tool-only turn)";
      done += 1;
      continue;
    }
    try {
      const out = await ctx.generate.text({ prompt: SUMMARY_PROMPT(text) });
      const summary = (out?.text ?? "").trim();
      if (summary) {
        state.summaries[id] = summary;
        done += 1;
      }
    } catch {
      // Leave the turn unsummarized; a later run can retry.
    }
  }
  return done;
}
