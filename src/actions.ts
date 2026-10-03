/**
 * Shared compaction actions used by both the slash commands and the
 * `compact_context` tool, so the agent-triggered and Manager-triggered paths
 * can never drift.
 */
import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
import { summarizeTurns } from "./summarize.js";
import { loadState, saveState, type Ctx } from "./store.js";

export type CompactMode = "compact" | "trim";

export interface CompactArgs {
  mode: CompactMode;
  keepTurns: number;
}

/**
 * Pure: normalize a tool/command argument object into a compaction request.
 * `mode` defaults to `compact`; `keepTurns` defaults to 0 (summarize all) and
 * must be a non-negative integer when supplied. Throws on invalid input so the
 * caller can surface a friendly message.
 */
export function parseCompactArgs(input: unknown): CompactArgs {
  const record = (input && typeof input === "object" ? input : {}) as {
    mode?: unknown;
    keepTurns?: unknown;
  };
  const mode: CompactMode = record.mode === "trim" ? "trim" : "compact";
  let keepTurns = 0;
  if (record.keepTurns !== undefined && record.keepTurns !== null) {
    const value = record.keepTurns;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error("keepTurns must be a non-negative integer.");
    }
    keepTurns = value;
  }
  return { mode, keepTurns };
}

/**
 * Summarize the eligible turns now (each becomes a short summary; user
 * messages stay verbatim) and schedule the tool-output prune pass for the next
 * request. Returns the number of turns summarized.
 */
export async function compactNow(ctx: Ctx, sessionID: string, keepTurns: number): Promise<number> {
  const state = await loadState(ctx, sessionID);
  const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
  const turns = buildTurns(entries);
  const summarized = await summarizeTurns(ctx, selectTurns(turns, keepTurns), state);
  state.stats.summarizedTurns += summarized;
  state.pending = { mode: "compact", keepTurns };
  await saveState(ctx, sessionID, state);
  return summarized;
}

/** Schedule a tool-output-only prune for the next request, without summarizing. */
export async function scheduleTrim(ctx: Ctx, sessionID: string, keepTurns: number): Promise<void> {
  const state = await loadState(ctx, sessionID);
  state.pending = { mode: "trim", keepTurns };
  await saveState(ctx, sessionID, state);
}
