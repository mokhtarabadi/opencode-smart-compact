import type { Plugin } from "@opencode/plugin";
import { emptyState, type SessionState } from "./types.js";

/** The plugin context handed to `setup`. */
export type Ctx = Plugin.Context;

const PREFIX = "session:";

function key(sessionID: string): string {
  return `${PREFIX}${sessionID}`;
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
  return {
    summaries: value.summaries ?? {},
    omissions: value.omissions ?? {},
    omittedCalls: value.omittedCalls ?? {},
    stats: {
      prunedTokens: value.stats?.prunedTokens ?? 0,
      summarizedTurns: value.stats?.summarizedTurns ?? 0,
      prunedParts: value.stats?.prunedParts ?? 0,
      lastRun: value.stats?.lastRun,
    },
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
