import type { Plugin } from "@opencode/plugin";
import { emptyState, type SessionState } from "./types.js";

/** The plugin context handed to `setup`. */
export type Ctx = Plugin.Context;

const PREFIX = "session:";

function key(sessionID: string): string {
  return `${PREFIX}${sessionID}`;
}

/** Derive the next omission id from stored keys (backward compatible). */
function deriveNextOmissionId(omissions: Record<string, unknown>): number {
  let max = 0;
  for (const id of Object.keys(omissions)) {
    const match = /^omitted-(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

/**
 * Load the persisted compaction state for a session, falling back to a fresh
 * empty state when none exists or the stored value is malformed. Storage is
 * plugin-scoped and durable, so compaction survives restarts.
 */
export async function loadState(ctx: Ctx, sessionID: string): Promise<SessionState> {
  const raw = await ctx.storage.get(key(sessionID));
  if (!raw || typeof raw !== "object") return emptyState();
  const value = raw as Partial<SessionState>;
  const omissions = value.omissions ?? {};
  const nextOmissionId =
    typeof value.nextOmissionId === "number" && value.nextOmissionId > 0
      ? value.nextOmissionId
      : deriveNextOmissionId(omissions);
  return {
    summaries: value.summaries ?? {},
    omissions,
    omittedCalls: value.omittedCalls ?? {},
    stats: {
      prunedTokens: value.stats?.prunedTokens ?? 0,
      summarizedTurns: value.stats?.summarizedTurns ?? 0,
      prunedParts: value.stats?.prunedParts ?? 0,
      savedTokens: value.stats?.savedTokens ?? 0,
      lastRun: value.stats?.lastRun,
      lastRunMs: value.stats?.lastRunMs,
      tokenizerUsed: value.stats?.tokenizerUsed,
    },
    nextOmissionId,
    pruneMemo: value.pruneMemo ?? {},
    pending: value.pending ?? null,
  };
}

/** Persist the session state. */
export async function saveState(ctx: Ctx, sessionID: string, state: SessionState): Promise<void> {
  await ctx.storage.set(key(sessionID), state as unknown as Parameters<typeof ctx.storage.set>[1]);
}

/** Remove all persisted state for a session. */
export async function clearState(ctx: Ctx, sessionID: string): Promise<void> {
  await ctx.storage.remove(key(sessionID));
}
