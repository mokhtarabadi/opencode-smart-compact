/**
 * Shared compaction actions used by both the slash commands and the
 * `compact_context` tool, so the agent-triggered and Manager-triggered paths
 * can never drift.
 */
import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
import { summarizeTurns } from "./summarize.js";
import { checkBudgetGuard, loadConfig } from "./config.js";
import { measureTokens } from "./prune.js";
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
 *
 * The emergency budget guard runs before any work: an over-budget history
 * aborts with a warning and the stored state is left unchanged (returns 0,
 * nothing saved). A zero budget disables the guard.
 */
export async function compactNow(ctx: Ctx, sessionID: string, keepTurns: number): Promise<number> {
  const config = await loadConfig(ctx);
  const state = await loadState(ctx, sessionID);
  const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
  if (checkBudgetGuard(measureHistoryCost(entries, config), config)) {
    console.warn(
      `[smart-compact] compaction aborted: history exceeds the emergency budget of ` +
        `${config.tokens.emergencyBudgetTokens} tokens. Raise tokens.emergencyBudgetTokens (0 disables) and rerun.`,
    );
    return 0;
  }
  const turns = buildTurns(entries);
  const summarized = await summarizeTurns(
    ctx,
    selectTurns(turns, keepTurns, config.pruning.preserveRecentTurns),
    state,
  );
  state.stats.summarizedTurns += summarized;
  state.pending = { mode: "compact", keepTurns };
  await saveState(ctx, sessionID, state);
  return summarized;
}

/**
 * Measured token cost of the durable history entries awaiting summarization.
 * Read-only: never mutates entries or state.
 */
function measureHistoryCost(
  entries: readonly HistoryEntry[],
  config: Parameters<typeof measureTokens>[1],
): number {
  let total = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.text === "string") total += measureTokens(entry.text, config);
    const parts = Array.isArray(entry.content) ? entry.content : [];
    for (const part of parts) {
      if (part && typeof part.text === "string") total += measureTokens(part.text, config);
    }
  }
  return total;
}

/** Schedule a tool-output-only prune for the next request, without summarizing. */
export async function scheduleTrim(ctx: Ctx, sessionID: string, keepTurns: number): Promise<void> {
  const state = await loadState(ctx, sessionID);
  state.pending = { mode: "trim", keepTurns };
  await saveState(ctx, sessionID, state);
}
