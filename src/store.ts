import type { Plugin } from "@opencode/plugin";
import type { Schema } from "effect";
import { migrateLegacyOmissions } from "./omissions.js";
import { emptyState, type OmissionRecord, type SessionState, type SessionStats } from "./types.js";

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
  // Clone the omission map so migration can rewrite records without mutating
  // the object still held by storage.
  const omissions = { ...(value.omissions ?? {}) } as Record<string, OmissionRecord>;
  // Legacy blobs carried the full original inline. Move it to the bounded file
  // store once; the write is best-effort and a failure keeps the text inline.
  const migrated = migrateLegacyOmissions(sessionID, omissions);
  const nextOmissionId =
    typeof value.nextOmissionId === "number" && value.nextOmissionId > 0
      ? value.nextOmissionId
      : deriveNextOmissionId(omissions);
  // Older stats carried `savedTokens` (the removed prune memo) and a boolean
  // `tokenizerUsed`. Only the measurement path survives, mapped from the flag
  // so an existing session still reports which code produced its numbers.
  const legacyStats = (value.stats ?? {}) as SessionStats & {
    savedTokens?: number;
    tokenizerUsed?: boolean;
  };
  const measurementPath =
    value.stats?.measurementPath === "tokenizer" || value.stats?.measurementPath === "heuristic"
      ? value.stats.measurementPath
      : legacyStats.tokenizerUsed === true
        ? "tokenizer"
        : undefined;
  const state: SessionState = {
    summaries: value.summaries ?? {},
    omissions,
    omittedCalls: value.omittedCalls ?? {},
    stats: {
      prunedTokens: value.stats?.prunedTokens ?? 0,
      summarizedTurns: value.stats?.summarizedTurns ?? 0,
      prunedParts: value.stats?.prunedParts ?? 0,
      summaryFallbacks:
        typeof value.stats?.summaryFallbacks === "number" &&
        Number.isFinite(value.stats.summaryFallbacks)
          ? value.stats.summaryFallbacks
          : 0,
      lastRun: value.stats?.lastRun,
      lastRunMs: value.stats?.lastRunMs,
      measurementPath,
    },
    nextOmissionId,
    pending: value.pending ?? null,
    // The awareness latch survives a restart: without it a restarted session
    // would re-warn on the very first request.
    awarenessLastRatio:
      typeof value.awarenessLastRatio === "number" && Number.isFinite(value.awarenessLastRatio)
        ? value.awarenessLastRatio
        : undefined,
    awarenessLastLevel:
      value.awarenessLastLevel === "warn" || value.awarenessLastLevel === "emergency"
        ? value.awarenessLastLevel
        : undefined,
    // The auto-trim latch survives a restart for the same reason as the
    // advisory latch: a restarted session must not trim again immediately.
    autoTrimLastRatio:
      typeof value.autoTrimLastRatio === "number" && Number.isFinite(value.autoTrimLastRatio)
        ? value.autoTrimLastRatio
        : undefined,
    // The resolved window and model name survive a restart so the stats line
    // can report them without waiting for the next awareness pass. Malformed
    // values fall back to absent, which renders as "unknown".
    awarenessWindow:
      typeof value.awarenessWindow === "number" &&
      Number.isFinite(value.awarenessWindow) &&
      value.awarenessWindow > 0
        ? Math.floor(value.awarenessWindow)
        : undefined,
    awarenessWindowSource:
      value.awarenessWindowSource === "registry" || value.awarenessWindowSource === "config"
        ? value.awarenessWindowSource
        : undefined,
    // The registry number and the cap flag back the `capped from <tokens>`
    // suffix in `compact_stats`; a missing whitelist entry would silently drop
    // them on every load, so both are validated here.
    awarenessWindowRegistry:
      typeof value.awarenessWindowRegistry === "number" &&
      Number.isFinite(value.awarenessWindowRegistry) &&
      value.awarenessWindowRegistry > 0
        ? Math.floor(value.awarenessWindowRegistry)
        : undefined,
    awarenessWindowCapped:
      typeof value.awarenessWindowCapped === "boolean" ? value.awarenessWindowCapped : undefined,
    awarenessModel:
      typeof value.awarenessModel === "string" && value.awarenessModel.length > 0
        ? value.awarenessModel
        : undefined,
  };
  // Persist the migrated shape so the inline originals stop being rewritten on
  // every save. Best-effort: a failed save leaves the migration to the next
  // load, and the inline text still serves retrievals in the meantime.
  if (migrated) {
    try {
      await saveState(ctx, sessionID, state);
    } catch (error) {
      console.warn(
        `[smart-compact] could not persist the migrated omission store for ${sessionID}: ` +
          `${(error as Error)?.message ?? error}`,
      );
    }
  }
  return state;
}

/** Persist the session state. */
export async function saveState(ctx: Ctx, sessionID: string, state: SessionState): Promise<void> {
  await ctx.storage.set(key(sessionID), state as unknown as Schema.Json);
}

/** Remove all persisted state for a session. */
export async function clearState(ctx: Ctx, sessionID: string): Promise<void> {
  await ctx.storage.remove(key(sessionID));
}

/**
 * Crash-restore pointer for O1 D3 (backup pointer).
 * Small record written before prune with omitted plus summary ids.
 * Timestamp uses Date.now for stats only per conventions — never for prune decisions.
 * Storage stays epoch ms UTC; display conversion is client layer only.
 */
export interface BackupPointer {
  sessionId: string;
  /** Wall-clock ms (stats only, never a prune decision input). */
  createdAtMs: number;
  omittedIds: string[];
  summaryIds: string[];
  budgetRatio: number;
}

/** Max backup pointers kept per session — caps storage bloat (R3). */
export const BACKUP_POINTER_CAP = 20;

function backupKey(sessionID: string): string {
  return `backup:${sessionID}`;
}

/**
 * Pure constructor for a backup pointer (testable without storage).
 * Uses Date.now only for the stats timestamp.
 */
export function createBackupPointer(
  sessionId: string,
  omittedIds: string[],
  summaryIds: string[],
  budgetRatio: number,
): BackupPointer {
  // Date.now is stats-only here; prune decisions never read createdAtMs.
  return { sessionId, createdAtMs: Date.now(), omittedIds: [...omittedIds], summaryIds: [...summaryIds], budgetRatio };
}

/**
 * Pure cap: keep only the latest 20 pointers (R3 anti-bloat).
 * Never mutates input.
 */
export function capBackupPointers(pointers: readonly BackupPointer[]): BackupPointer[] {
  // Slice from the end — latest entries win.
  if (pointers.length <= BACKUP_POINTER_CAP) return [...pointers];
  return pointers.slice(pointers.length - BACKUP_POINTER_CAP);
}

/**
 * Fail-closed validator for a stored backup pointer (V3).
 * Returns true only for well-formed entries — guards malformed storage.
 */
function isValidBackupPointer(value: unknown): value is BackupPointer {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  // Strict shape: session string, finite timestamp, arrays, finite ratio.
  if (typeof v.sessionId !== "string") return false;
  if (typeof v.createdAtMs !== "number" || !Number.isFinite(v.createdAtMs)) return false;
  if (!Array.isArray(v.omittedIds)) return false;
  if (!Array.isArray(v.summaryIds)) return false;
  if (typeof v.budgetRatio !== "number" || !Number.isFinite(v.budgetRatio)) return false;
  return true;
}

/**
 * Write one backup pointer for a session, capping log to 20 latest.
 * Per-session plugin storage only — no global files, no transcript mutation.
 */
export async function writeBackupPointer(
  ctx: Ctx,
  sessionId: string,
  omittedIds: string[],
  summaryIds: string[],
  budgetRatio: number,
): Promise<BackupPointer> {
  const pointer = createBackupPointer(sessionId, omittedIds, summaryIds, budgetRatio);
  const raw = await ctx.storage.get(backupKey(sessionId));
  // Filter to valid entries only — malformed history never accumulates (V3).
  const existing = Array.isArray(raw) ? (raw as unknown[]).filter(isValidBackupPointer) : [];
  const next = capBackupPointers([...existing, pointer]);
  await ctx.storage.set(backupKey(sessionId), next as unknown as Schema.Json);
  return pointer;
}

/** Read the latest backup pointer for a session, or null when none exists. */
export async function readLatestBackupPointer(ctx: Ctx, sessionId: string): Promise<BackupPointer | null> {
  const raw = await ctx.storage.get(backupKey(sessionId));
  // Guard malformed storage — fail closed to null, never throw.
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const last = (raw as unknown[])[raw.length - 1];
  // Fail closed on malformed latest entry instead of returning phantom.
  if (!isValidBackupPointer(last)) return null;
  return last;
}
