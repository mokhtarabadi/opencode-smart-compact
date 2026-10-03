/**
 * Automatic context strategies, ported from the reference DCP plugin:
 * deduplication keeps only the newest of identical tool calls, and
 * purge-errors blanks the input of errored tool calls after a turn threshold.
 * Both mutate the model-visible messages only and never persist anything.
 */
import type { SmartCompactConfig } from "./config.js";
import { estimateTokens, serializeResult } from "./prune.js";
import type { Msg, Part } from "./types.js";

/** Deterministic stringify with sorted object keys, so equal args compare equal. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

/** Recurse and replace every string leaf with the marker, preserving structure. */
function blankStrings(value: unknown, marker: string): unknown {
  if (typeof value === "string") return marker;
  if (Array.isArray(value)) return value.map((item) => blankStrings(item, marker));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = blankStrings(v, marker);
    return out;
  }
  return value;
}

/** The tool name and call id of a part, when present. */
function name(part: Part): string | undefined {
  return typeof part.name === "string" ? part.name : undefined;
}
function callId(part: Part): string | undefined {
  return typeof part.id === "string" ? part.id : undefined;
}

/**
 * Remove earlier duplicates of identical tool calls (same tool, same normalized
 * arguments), keeping only the most recent output. Returns pruned parts/tokens.
 */
export function applyDeduplication(
  messages: Msg[],
  config: SmartCompactConfig,
): { pruned: number; tokens: number } {
  let pruned = 0;
  let tokens = 0;
  if (!config.strategies.deduplication.enabled) return { pruned, tokens };
  const protectedTools = new Set(config.strategies.deduplication.protectedTools);

  const inputs = new Map<string, unknown>();
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "tool-call") {
        const id = callId(part);
        if (id) inputs.set(id, part.input);
      }
    }
  }

  const results: Part[] = [];
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) if (part.type === "tool-result") results.push(part);
  }

  const latest = new Map<string, string>();
  const signatureOf = (part: Part): string | undefined => {
    const id = callId(part);
    const tool = name(part) ?? "";
    if (!id) return undefined;
    return `${tool}::${stableStringify(inputs.get(id) ?? null)}`;
  };
  for (const part of results) {
    const tool = name(part) ?? "";
    if (protectedTools.has(tool)) continue;
    const signature = signatureOf(part);
    if (signature) latest.set(signature, callId(part) ?? "");
  }
  for (const part of results) {
    const tool = name(part) ?? "";
    if (protectedTools.has(tool)) continue;
    const signature = signatureOf(part);
    if (!signature || latest.get(signature) === callId(part)) continue;
    const value = (part.result as { value?: unknown } | undefined)?.value;
    tokens += estimateTokens(serializeResult(value));
    part.result = {
      type: "text",
      value: `[duplicate ${tool} output removed — see the most recent identical call]`,
    };
    pruned += 1;
  }
  return { pruned, tokens };
}

/**
 * Blank the arguments of errored tool calls older than the configured number of
 * turns. Error messages and the tool structure are preserved.
 */
export function applyPurgeErrors(
  messages: Msg[],
  config: SmartCompactConfig,
): { pruned: number } {
  let pruned = 0;
  if (!config.strategies.purgeErrors.enabled) return { pruned };
  const protectedTools = new Set(config.strategies.purgeErrors.protectedTools);
  const threshold = Math.max(1, config.strategies.purgeErrors.turns);

  let turn = 0;
  const turnOf = new Map<string, number>();
  for (const msg of messages) {
    if (msg.role === "user") turn += 1;
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type === "tool-call" || part.type === "tool-result") {
        const id = callId(part);
        if (id) turnOf.set(id, turn);
      }
    }
  }
  const currentTurn = turn;

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part.type !== "tool-call") continue;
      const id = callId(part);
      const tool = name(part) ?? "";
      if (!id || protectedTools.has(tool)) continue;
      if (currentTurn - (turnOf.get(id) ?? currentTurn) < threshold) continue;
      const result = messages
        .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
        .find((p) => p.type === "tool-result" && callId(p) === id);
      const errored = (result?.result as { type?: string } | undefined)?.type === "error";
      if (!errored) continue;
      part.input = blankStrings(part.input, "[input removed due to failed tool call]");
      pruned += 1;
    }
  }
  return { pruned };
}

/** Run every enabled strategy. */
export function applyStrategies(messages: Msg[], config: SmartCompactConfig): { pruned: number; tokens: number } {
  const dedup = applyDeduplication(messages, config);
  const purge = applyPurgeErrors(messages, config);
  return { pruned: dedup.pruned + purge.pruned, tokens: dedup.tokens };
}
