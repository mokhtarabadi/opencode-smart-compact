import { DEFAULT_CONFIG, PRUNE_WEIGHTS, type SmartCompactConfig } from "./config.js";
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

/** Build the notice text that replaces a pruned tool result. */
export function omissionNotice(id: string, name: string | undefined, tokens: number): string {
  const tool = name ? ` from \`${name}\`` : "";
  return (
    `[omitted tool output${tool} — ~${tokens} tokens. ` +
    `Content ID: ${id}. Call read_omitted_content with this ID if the original is required.]`
  );
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
 * Small content hash over the entire string plus a length prefix. Any edit —
 * including one in the middle — changes the hash and invalidates the memo.
 */
export function memoHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

/** Whether a tool result is small enough to measure directly, memo aside. */
function isSmallInput(text: string, config: SmartCompactConfig, tool?: string): boolean {
  if (config.pruning.useTokens) {
    // Token-heavy text (even a single long word) is never "small" here:
    // the measured cost decides against the token budget for its tool.
    const budget = (tool ?? "") === "task" ? config.pruning.taskMaxWords : config.pruning.maxWords;
    return measureTokens(text, config) <= budget;
  }
  if (text.length > config.pruning.maxChars) return false;
  return text.trim().split(/\s+/).filter(Boolean).length <= config.pruning.maxWords;
}

/**
 * Measure a tool result for one call id, reusing the memoized cost when the
 * content hash matches. Small inputs bypass the memo entirely — measuring
 * them directly is cheaper than bookkeeping. Returns the token cost and
 * whether the memo supplied it.
 */
export function measureMemoized(
  callId: string,
  text: string,
  config: SmartCompactConfig,
  state: SessionState,
  tool?: string,
): { tokens: number; hit: boolean } {
  if (isSmallInput(text, config, tool)) return { tokens: measureTokens(text, config), hit: false };
  const hash = memoHash(text);
  const entry = state.pruneMemo[callId];
  if (entry && entry.hash === hash) return { tokens: entry.tokens, hit: true };
  const tokens = measureTokens(text, config);
  state.pruneMemo[callId] = { hash, tokens };
  return { tokens, hit: false };
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
 */
export function pruneToolResults(
  messages: Msg[],
  state: SessionState,
  config: SmartCompactConfig = DEFAULT_CONFIG,
): { pruned: number; tokens: number; memoHits: number; memoTokens: number } {
  let pruned = 0;
  let tokens = 0;
  let memoHits = 0;
  let memoTokens = 0;
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
      // Reuse the memoized measurement when the content is unchanged; the
      // memo only ever affects the reported cost, never the prune decision.
      const measured = measureMemoized(callId, text, config, state, name);
      const saved = measured.tokens;
      if (measured.hit) {
        memoHits += 1;
        memoTokens += saved;
      }
      const record: OmissionRecord = { id, callId, name, content: text, tokens: saved };
      state.omissions[id] = record;
      state.omittedCalls[callId] = id;
      part.result = { type: "text", value: omissionNotice(id, name, saved) };
      pruned += 1;
      tokens += saved;
  }
  return { pruned, tokens, memoHits, memoTokens };
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
 * (cleared by a newer compaction). Names the missing id and tells the
 * reader to rerun the tool instead of trusting a phantom restore.
 */
export function missingOmissionNotice(id: string): string {
  return (
    `[omitted tool output unavailable — the cached original for Content ID: ${id} ` +
    `was cleared by a newer compaction. Rerun the tool to reproduce it.]`
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
