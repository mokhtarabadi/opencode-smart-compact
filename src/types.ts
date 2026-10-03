/**
 * Structural types for the model-visible message shape OpenCode hands to a
 * `session.hook("context")` callback. Native parts are `text`, `media`,
 * `tool-call`, `tool-result`, `reasoning`, and `compaction`
 * (`@opencode/ai/dist/schema/messages`). These types stay intentionally
 * minimal so the plugin remains decoupled from the deep Effect schemas.
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
  /**
   * Assistant message id → its generated summary. An empty string is the
   * "absorbed" sentinel: the message's prose and reasoning are stripped without
   * emitting a summary (used for the assistant messages after the first one in
   * a multi-step turn).
   */
  summaries: Record<string, string>;
  /** Omission id → cached original. */
  omissions: Record<string, OmissionRecord>;
  /** Call id → omission id, so the same result is pruned once. */
  omittedCalls: Record<string, string>;
  stats: SessionStats;
  /** Monotonic counter for the next omission id. */
  nextOmissionId: number;
  /** A pending command request, consumed by the next context hook. */
  pending?: { mode: "compact" | "trim"; keepTurns: number } | null;
}

export function emptyState(): SessionState {
  return {
    summaries: {},
    omissions: {},
    omittedCalls: {},
    stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0 },
    nextOmissionId: 1,
    pending: null,
  };
}
