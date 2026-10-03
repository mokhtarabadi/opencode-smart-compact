/**
 * Structural types for the model-visible message shape OpenCode hands to a
 * `session.hook("context")` callback. These are intentionally minimal: the
 * plugin only needs `role`, `id`, and the `content` parts it can prune or
 * summarize, so it stays decoupled from the deep Effect schemas in
 * `@opencode/ai` while remaining assignable to them via a cast.
 */

/** A single content part (text, media, tool-call, tool-result, reasoning, ...). */
export interface Part {
  type: string;
  [key: string]: unknown;
}

/** A model-visible message: a role plus its ordered content parts. */
export interface Msg {
  id?: string;
  role: "system" | "user" | "assistant" | "tool" | string;
  content: Part[];
}

/** The cached original of a pruned tool result, retrievable by id. */
export interface OmissionRecord {
  /** Stable id used by `read_omitted_content` (e.g. `omitted-0001`). */
  id: string;
  /** What was pruned: a tool result's call id. */
  callId: string;
  /** Tool name, for the notice text. */
  name?: string;
  /** The original serialized result value. */
  content: string;
  /** Estimated tokens saved by pruning. */
  tokens: number;
}

/** Cumulative savings for one session. */
export interface SessionStats {
  prunedTokens: number;
  summarizedTurns: number;
  prunedParts: number;
  lastRun?: number;
}

/** Per-session compaction state, persisted in plugin storage. */
export interface SessionState {
  /** Assistant message id → its generated summary. */
  summaries: Record<string, string>;
  /** Omission id → cached original. */
  omissions: Record<string, OmissionRecord>;
  /** Call id → omission id, so the same result is pruned once. */
  omittedCalls: Record<string, string>;
  stats: SessionStats;
  /** A pending command request, consumed by the next context hook. */
  pending?: { mode: "compact" | "trim"; keepTurns: number } | null;
}

export function emptyState(): SessionState {
  return {
    summaries: {},
    omissions: {},
    omittedCalls: {},
    stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0 },
    pending: null,
  };
}
