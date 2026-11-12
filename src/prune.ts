import { DEFAULT_CONFIG, PRUNE_WEIGHTS, type SmartCompactConfig } from "./config.js";
import { writeOmissionOriginal } from "./omissions.js";
import { countTokens } from "./tokens.js";
import type { Msg, OmissionRecord, Part, SessionState } from "./types.js";

/** Cheap, dependency-free token estimate (~4 chars per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Measure the token cost of a tool result. Routes through the tokenizer
 * module when token measurement is enabled, otherwise uses the
 * dependency-free estimate. Both paths agree for plain text; the tokenizer
 * wins on real model tokenization when installed.
 */
export function measureTokens(text: string, config: SmartCompactConfig = DEFAULT_CONFIG): number {
  return countTokens(text, config.tokens.enabled);
}

function exceeds(text: string, words: number, chars: number): boolean {
  const count = text.trim().split(/\s+/).filter(Boolean).length;
  return text.length > chars || count > words;
}

/**
 * Whether a completed tool result should be pruned under the given config.
 * With `pruning.useTokens`, the word thresholds double as token budgets and
 * the measured token count decides; otherwise the chars/words check decides.
 */
export function shouldPrune(
  tool: string | undefined,
  text: string,
  config: SmartCompactConfig = DEFAULT_CONFIG,
): boolean {
  const name = tool ?? "";
  if (config.pruning.protectedTools.includes(name)) return false;
  if (name in config.pruning.discardTools) return false;
  if (config.pruning.alwaysPruneTools.includes(name)) return true;
  if (config.pruning.useTokens) {
    const measured = measureTokens(text, config);
    if (name === "task") return measured > config.pruning.taskMaxWords;
    return measured > config.pruning.maxWords;
  }
  if (name === "task") return exceeds(text, config.pruning.taskMaxWords, config.pruning.taskMaxChars);
  return exceeds(text, config.pruning.maxWords, config.pruning.maxChars);
}

/**
 * Serialize a tool-result value to text for caching and token estimation.
 * Always returns a string: `JSON.stringify` yields `undefined` for undefined
 * values, functions, and symbols, and a result that claims to be a string but
 * is not would break every `.length` and `.slice` on it downstream.
 */
export function serializeResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === "string" ? encoded : "";
  } catch {
    return String(value);
  }
}

/**
 * Build the notice text that replaces a pruned tool result.
 *
 * The notice is the agent's ONLY pointer to the original output, so it has to
 * carry the whole recovery path: the tool to call (`read_omitted_content`),
 * the argument to pass (`contentId`), and the exact id to pass. It also states
 * that the original is RECOVERABLE rather than lost — without that sentence an
 * agent reads the notice as a deletion, never restores the output, and the
 * pruned result is effectively lost for that turn even though the store still
 * holds it.
 */
export function omissionNotice(id: string, name: string | undefined, tokens: number): string {
  const tool = name ? ` from \`${name}\`` : "";
  return (
    `[omitted tool output${tool} — ~${tokens} tokens. ` +
    `The original output is RECOVERABLE, not lost: it is cached under Content ID ${id}. ` +
    `To restore it, call the \`read_omitted_content\` tool with the argument ` +
    `\`contentId: "${id}"\`.]`
  );
}

/**
 * Lifecycle status of one tool-result part, as far as the plugin can see it.
 *
 * Only a completed result may be pruned or discarded. A pending call has no
 * finished payload to replace, and an errored call carries the failure text
 * the agent needs to diagnose the failure — replacing it with a notice would
 * hide the reason the call failed. The model-visible part shape carries the
 * outcome on `result.type` ("text", "json", "content", "error"); hosts that
 * also attach the richer session state expose `state.status` ("pending",
 * "running", "completed", "error"), which wins when both are present.
 */
export type ToolResultStatus = "completed" | "pending" | "error";

/**
 * Read the lifecycle status of a tool-result part. Never throws: an unknown or
 * malformed shape is treated as completed, because the prune decision still
 * needs a payload to measure and the original stays recoverable either way.
 */
export function toolResultStatus(part: Part): ToolResultStatus {
  const state = part.state as { status?: unknown } | undefined;
  const status = typeof state?.status === "string" ? state.status : undefined;
  if (status === "pending" || status === "running") return "pending";
  if (status === "error") return "error";
  const result = part.result as { type?: unknown } | undefined;
  const type = typeof result?.type === "string" ? result.type : undefined;
  if (type === "pending" || type === "running") return "pending";
  if (type === "error") return "error";
  return "completed";
}

/** Allocate the next monotonic omission id and advance the counter. */
function nextOmissionId(state: SessionState): string {
  const id = `omitted-${String(state.nextOmissionId).padStart(4, "0")}`;
  state.nextOmissionId += 1;
  return id;
}

function partName(part: Part): string | undefined {
  return typeof part.name === "string" ? part.name : undefined;
}

function partCallId(part: Part): string | undefined {
  return typeof part.id === "string" ? part.id : undefined;
}

/**
 * Effective truncate cap for one tool. `task` keeps its higher bar: the cap
 * never bites below `taskMaxChars`. A non-positive `truncateToolsChars`
 * disables the cap for every tool.
 */
export function truncateLimit(tool: string | undefined, config: SmartCompactConfig): number {
  if (config.pruning.truncateToolsChars <= 0) return 0;
  if ((tool ?? "") === "task") {
    return Math.max(config.pruning.truncateToolsChars, config.pruning.taskMaxChars);
  }
  return config.pruning.truncateToolsChars;
}
/**
 * Message indices inside the preserve-recent window: from the Nth-last user
 * message onward, where N is at least 1 so the last user message is always
 * kept. Sessions with no user message get no window (nothing is recent).
 */
export function preserveWindow(messages: Msg[], preserveRecentTurns: number): Set<number> {
  const users: number[] = [];
  messages.forEach((msg, index) => {
    if (msg.role === "user") users.push(index);
  });
  if (users.length === 0) return new Set();
  const keep = Math.max(1, preserveRecentTurns);
  const start = users[Math.max(0, users.length - keep)]!;
  const window = new Set<number>();
  for (let i = start; i < messages.length; i += 1) window.add(i);
  return window;
}

/**
 * Walk the model-visible messages and prune oversized tool results that have
 * not been pruned yet. Mutates the parts in place and returns the number of
 * parts pruned plus the tokens saved. Never throws.
 *
 * The preserve-recent window is checked before any prune decision: results
 * inside the window keep their full text. Over-long results outside the
 * window hit the truncate cap and are cached in full with an omission notice.
 *
 * Only completed results are eligible: a pending call has no finished payload
 * and an errored call carries the failure text the agent needs, so both are
 * left exactly as the provider wrote them.
 */
export function pruneToolResults(
  messages: Msg[],
  state: SessionState,
  config: SmartCompactConfig = DEFAULT_CONFIG,
  sessionID = "unscoped",
): { pruned: number; tokens: number } {
  let pruned = 0;
  let tokens = 0;
  const kept = preserveWindow(messages, config.pruning.preserveRecentTurns);
  // O1 D2: collect eligible tool results first, then prune in fixed-cost rank.
  // User turns never enter candidates — only tool-result kind is ranked here.
  const eligible: { part: Part; callId: string; name: string | undefined; text: string }[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const msg = messages[index]!;
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const callId = partCallId(part);
      if (!callId || state.omittedCalls[callId]) continue;
      const name = partName(part);
      // Only a completed result may be pruned or discarded: a pending call has
      // no finished payload yet, and an errored call carries the failure text
      // the agent needs to diagnose the failure. Both stay exactly as the
      // provider wrote them.
      if (toolResultStatus(part) !== "completed") continue;
      const result = part.result as { type?: string; value?: unknown } | undefined;
      const text = serializeResult(result?.value);

      const discard = name ? config.pruning.discardTools[name] : undefined;
      if (discard !== undefined) {
        part.result = { type: "text", value: discard };
        continue;
      }
      // The recent window always keeps full text, including the last request.
      if (kept.has(index)) continue;
      // The truncate cap is an extra trigger beside shouldPrune; task keeps
      // its higher bar so ordinary task output is not capped early. A
      // non-positive limit disables the cap for every tool.
      const cap = truncateLimit(name, config);
      const overTruncateCap = cap > 0 && text.length > cap;
      if (!shouldPrune(name, text, config) && !overTruncateCap) continue;

      eligible.push({ part, callId, name, text });
    }
  }
  // Rank by fixed cost: tool-result weight first, larger payload first.
  // All candidates here are tool-result kind — rank still orders by size.
  // Duplicate callIds never collapse: ranking uses a unique per-entry id
  // (callId plus index suffix) and prunes via stored entry reference.
  const ranked = rankPruneCandidates(
    eligible.map((e, entryIndex) => ({
      id: `${e.callId}#${entryIndex}`,
      kind: "tool-result" as const,
      sizeTokens: estimateTokens(e.text),
    })),
  );
  const byRankId = new Map(ranked.map((c) => [c.id, c]));
  // Map rank ids back to eligible indices via suffix parse (stable, no collapse).
  const order = ranked
    .map((c) => Number(c.id.split("#").pop()))
    .filter((i) => Number.isInteger(i) && i >= 0 && i < eligible.length);
  for (const entryIndex of order) {
    const entry = eligible[entryIndex]!;
    // Entry always exists — guard for type safety only.
    if (!entry) continue;
    // Keep rank id linkage explicit for audit (no Map keyed by callId remains).
    void byRankId;
    const { part, callId, name, text } = entry;
    const id = nextOmissionId(state);
    const saved = measureTokens(text, config);
    // The original goes to the bounded per-session file store; state keeps only
    // the id-to-path mapping. If the write fails, keep the text inline so a
    // retrieval still works instead of silently losing the original.
    let path: string | undefined;
    try {
      path = writeOmissionOriginal(sessionID, id, text);
    } catch (error) {
      console.warn(
        `[smart-compact] could not store omission ${id} on disk: ` +
          `${(error as Error)?.message ?? error}; keeping it inline.`,
      );
    }
    const record: OmissionRecord = path
      ? { id, callId, name, tokens: saved, path }
      : { id, callId, name, tokens: saved, content: text };
    state.omissions[id] = record;
    state.omittedCalls[callId] = id;
    part.result = { type: "text", value: omissionNotice(id, name, saved) };
    pruned += 1;
    tokens += saved;
  }
  return { pruned, tokens };
}

/** Re-apply stored omissions and discard rules on every request (idempotent). */
export function applyOmissions(
  messages: Msg[],
  state: SessionState,
  config: SmartCompactConfig = DEFAULT_CONFIG,
): void {
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue;
      const name = partName(part);
      const discard = name ? config.pruning.discardTools[name] : undefined;
      if (discard !== undefined) {
        part.result = { type: "text", value: discard };
        continue;
      }
      const callId = partCallId(part);
      if (!callId) continue;
      const id = state.omittedCalls[callId];
      if (!id) continue;
      const record = state.omissions[id];
      // Fail closed: a mapping without its cached original means a newer
      // compaction cleared the cache. Say so plainly instead of replaying a
      // phantom notice with zero tokens.
      if (!record) {
        part.result = { type: "text", value: missingOmissionNotice(id) };
        continue;
      }
      part.result = {
        type: "text",
        value: omissionNotice(id, record.name, record.tokens),
      };
    }
  }
}

/**
 * Fail-closed notice for a pruned result whose cached original is gone
 * (cleared by a newer compaction, or evicted from the bounded store). Names the
 * missing id and the tool that cannot restore it, and tells the reader to
 * rerun the source tool instead of trusting a phantom restore.
 */
export function missingOmissionNotice(id: string): string {
  return (
    `[omitted tool output unavailable — the cached original for Content ID: ${id} ` +
    `was cleared by a newer compaction, so it is no longer recoverable through ` +
    `read_omitted_content. Rerun the tool to reproduce it.]`
  );
}

/**
 * Prune candidate kind for fixed-cost ordering (O1 D2).
 * Only these three kinds ever prune — user turns and active decisions
 * are filtered out before ranking and never reach this table.
 */
export type PruneKind = "tool-result" | "summary" | "omission";

/** One rankable prune candidate with stable id plus kind plus size. */
export interface PruneCandidate {
  id: string;
  kind: PruneKind;
  sizeTokens: number;
}

/**
 * Pure fixed-cost rank for prune candidates (O1 D2).
 * Sorts by weight desc (tool-result 100, summary 50, omission 10),
 * then sizeTokens desc. Never mutates input. Stable for equal keys.
 * User-turn or decision kinds are not in PruneKind — filter them before calling.
 */
export function rankPruneCandidates(candidates: readonly PruneCandidate[]): PruneCandidate[] {
  // Copy first so input order is preserved for stable ties.
  const copy = [...candidates];
  // Weight lookup is fixed from config — no adaptive learning in O1.
  const weight = (kind: PruneKind): number => PRUNE_WEIGHTS[kind] ?? 0;
  // Stable sort: weight desc, then size desc. V8 sort is stable.
  copy.sort((a, b) => {
    // Higher weight prunes first.
    const byWeight = weight(b.kind) - weight(a.kind);
    if (byWeight !== 0) return byWeight;
    // Larger payload prunes first within same kind.
    return b.sizeTokens - a.sizeTokens;
  });
  return copy;
}
