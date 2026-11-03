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

/**
 * The cached original of a pruned tool result, retrievable by id.
 *
 * The original text lives in a per-session file under the bounded omission
 * store, never in the state blob: state only carries the id-to-path mapping,
 * so a session save stays small no matter how much history was pruned.
 */
export interface OmissionRecord {
  /** Stable id used by `read_omitted_content` (e.g. `omitted-0001`). */
  id: string;
  /** What was pruned: a tool result's call id. */
  callId: string;
  /** Tool name, for the notice text. */
  name?: string;
  /** Estimated tokens saved by pruning. */
  tokens: number;
  /** Absolute path to the file that holds the original serialized result. */
  path?: string;
  /**
   * Legacy inline original from an older state blob. `loadState` migrates it
   * to `path`; it survives only when the file write failed, so a retrieval can
   * still fail over to the text instead of losing it.
   */
  content?: string;
}

/** Which measurement path produced the token numbers. */
export type MeasurementPath = "tokenizer" | "heuristic";

/** Cumulative savings for one session. */
export interface SessionStats {
  prunedTokens: number;
  summarizedTurns: number;
  prunedParts: number;
  /** Heuristic summary fallbacks across all summarization runs. */
  summaryFallbacks: number;
  lastRun?: number;
  /** Wall-clock cost of the most recent prune pass, in milliseconds. */
  lastRunMs?: number;
  /** Token measurement path used by the most recent run. */
  measurementPath?: MeasurementPath;
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
  /**
   * Context fill ratio recorded at the last awareness reminder. Absent means
   * the session has not been warned yet.
   */
  awarenessLastRatio?: number;
  /** Pressure level recorded at the last awareness reminder. */
  awarenessLastLevel?: "warn" | "emergency";
  /**
   * Fill ratio recorded when the automatic trim was last queued. One sustained
   * high-pressure period queues at most one trim; the value is cleared once the
   * fill drops below the auto-trim line by one re-arm step.
   */
  autoTrimLastRatio?: number;
  /**
   * Resolved context window in tokens from the last awareness pass. Absent
   * when the session model is unknown to the registry, no configured fallback
   * exists, and the entry carries no usable limit — in which case no ratio can
   * be computed and the advisory stays silent. Surfaced in `compact_stats` so
   * silence is diagnosable.
   */
  awarenessWindow?: number;
  /**
   * Where `awarenessWindow` came from: the model registry or the configured
   * `awareness.contextWindowTokens` fallback. Lets the reminder and the stats
   * line say the denominator is configured rather than measured.
   */
  awarenessWindowSource?: "registry" | "config";
  /**
   * "providerID/id" of the model seen on the last awareness pass. Recorded
   * even when the window is unknown, so the stats line can name the model
   * the registry failed on.
   */
  awarenessModel?: string;
}

export function emptyState(): SessionState {
  return {
    summaries: {},
    omissions: {},
    omittedCalls: {},
    stats: { prunedTokens: 0, summarizedTurns: 0, prunedParts: 0, summaryFallbacks: 0 },
    nextOmissionId: 1,
    pending: null,
  };
}
