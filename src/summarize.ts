import type { Turn } from "./plan.js";
import type { Ctx } from "./store.js";
import type { SessionState } from "./types.js";

/** Keep a single turn's prompt bounded so one giant turn cannot blow the budget. */
const MAX_TURN_CHARS = 6000;

/** Build the summarization prompt for one turn. */
function turnPrompt(turn: Turn, body: string): string {
  return [
    "Condense the following assistant turn from a coding session into a short, high-signal summary.",
    "Keep: what the assistant did, what it decided and why, files or commands touched, and what comes next.",
    "Drop: raw tool output, repeated reasoning, and restated user text.",
    "Write 2-4 sentences, no preamble, no bullet list.",
    "",
    "--- USER ---",
    turn.userText.slice(0, 500),
    "--- ASSISTANT TURN ---",
    body,
    "--- END TURN ---",
  ].join("\n");
}

/** Join a turn's assistant text and tool markers, bounded for the prompt. */
function turnBody(turn: Turn): string {
  const body = turn.assistants
    .map((a) => a.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return body.length > MAX_TURN_CHARS ? `${body.slice(0, MAX_TURN_CHARS)}\n…[truncated]` : body;
}

/** Deterministic fallback summary when the model output is empty. */
function heuristic(body: string): string {
  const oneLine = body.replace(/\s+/g, " ").trim();
  return oneLine.length > 400 ? `${oneLine.slice(0, 400)}…` : oneLine;
}

/**
 * Summarize the eligible turns with the session's model through
 * `ctx.generate.text` and store the result by assistant message id. The first
 * assistant message of a turn carries the summary; the remaining ones are
 * marked "absorbed" (empty string) so their prose is stripped without a
 * duplicate summary. Turns whose assistant messages carry no prose, reasoning,
 * or tool markers are absorbed without a model call.
 * Failures fall back to a heuristic so compaction never fails.
 */
export async function summarizeTurns(ctx: Ctx, turns: Turn[], state: SessionState): Promise<number> {
  let done = 0;
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

    let summary = "";
    try {
      const out = await ctx.generate.text({ prompt: turnPrompt(turn, body) });
      summary = (out?.text ?? "").trim();
    } catch {
      summary = "";
    }
    if (!summary) summary = heuristic(body);

    state.summaries[first.id] = summary;
    for (let i = 1; i < turn.assistants.length; i += 1) {
      state.summaries[turn.assistants[i]!.id] = "";
    }
    done += 1;
  }
  return done;
}
