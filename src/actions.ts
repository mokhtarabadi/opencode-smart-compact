/**
 * Shared compaction actions used by both the slash commands and the
 * `compact_context` tool, so the agent-triggered and Manager-triggered paths
 * can never drift.
 */
import { buildTurns, selectTurns, type HistoryEntry } from "./plan.js";
import { summarizeTurns } from "./summarize.js";
import { isOverEmergencyBudget, loadConfig, type BudgetState } from "./config.js";
import { measureTokens } from "./prune.js";
import { loadState, saveState, type BackupPointer, type Ctx } from "./store.js";

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
 * The emergency budget check runs before any work and is a warning only: an
 * over-budget history still compacts, because refusing it would deadlock the
 * sessions that need compaction most. A zero budget disables the warning.
 */
export async function compactNow(ctx: Ctx, sessionID: string, keepTurns: number): Promise<number> {
  const config = await loadConfig(ctx);
  const state = await loadState(ctx, sessionID);
  const entries = (await ctx.session.context({ sessionID })) as unknown as HistoryEntry[];
  const measuredCost = measureHistoryCost(entries, config);
  if (isOverEmergencyBudget(measuredCost, config)) {
    // Warning only: an explicit compaction request must always proceed, because
    // compaction is the remedy for an over-budget history, not a hazard.
    console.warn(
      `[smart-compact] history is over the emergency budget of ` +
        `${config.tokens.emergencyBudgetTokens} tokens (measured ~${measuredCost}); ` +
        `compacting anyway. Raise tokens.emergencyBudgetTokens to silence this warning.`,
    );
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

/**
 * Pure formatter for the hybrid budget meter (O1 D1).
 * Returns stable display text like `Budget 45% (4500/10000) [normal]`.
 * Pure: no I/O, no config reads, safe for stats and hook logs.
 * Guards NaN ratio to 0 — never renders NaN (V4).
 */
export function formatBudgetMeter(state: BudgetState): string {
  // Clamp non-finite ratios first — malformed state renders 0, never NaN.
  const safeRatio = typeof state.ratio === "number" && Number.isFinite(state.ratio) ? state.ratio : 0;
  // Percent is floored display of clamped ratio.
  const percent = Math.floor(safeRatio * 100);
  return `Budget ${percent}% (${state.usedTokens}/${state.limitTokens}) [${state.level}]`;
}

/**
 * Pure formatter for a backup pointer (O1 D3).
 * Storage stays epoch ms UTC; this renders ISO with offset for display only.
 * Fail-closed on malformed input — never throws (V3).
 */
export function formatBackupPointer(pointer: BackupPointer): string {
  // Fallbacks for malformed storage entries — display only, never throw.
  const session = typeof pointer?.sessionId === "string" ? pointer.sessionId : "unknown";
  const omittedLen = Array.isArray(pointer?.omittedIds) ? pointer.omittedIds.length : 0;
  const summaryLen = Array.isArray(pointer?.summaryIds) ? pointer.summaryIds.length : 0;
  const ratio = typeof pointer?.budgetRatio === "number" && Number.isFinite(pointer.budgetRatio) ? pointer.budgetRatio : 0;
  // Safe date: finite timestamp plus try/catch around ISO render.
  let when = "1970-01-01T00:00:00.000Z";
  try {
    const ms = typeof pointer?.createdAtMs === "number" && Number.isFinite(pointer.createdAtMs) ? pointer.createdAtMs : 0;
    when = new Date(ms).toISOString();
  } catch {
    // Keep epoch fallback — display only.
  }
  // Display conversion only — storage keeps epoch ms.
  return `Backup ${session} ${when} omissions ${omittedLen} summaries ${summaryLen} ratio ${Math.floor(ratio * 100)}%`;
}
