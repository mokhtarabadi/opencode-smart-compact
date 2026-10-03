/**
 * Token measurement for smart-compact. Tokenizer-first with a heuristic
 * fallback, used only on explicit command paths (`magic-compact`,
 * `magic-trim`, `compact_context`) — never in the per-request hook.
 *
 * The optional `@anthropic-ai/tokenizer` package is loaded at most once and
 * only when needed. When the package is missing, fails to load, or throws,
 * every call falls back to the dependency-free `ceil(len / 4)` estimate so a
 * missing optional dependency can never break compaction.
 */

import { createRequire } from "node:module";

declare const require: ((id: string) => unknown) | undefined;

type Tokenizer = { countTokens?: (text: string) => number };

let tokenizerAttempted = false;
let tokenizer: Tokenizer | null = null;

/**
 * Resolve a CJS-style require in either module system: the ambient `require`
 * when running under CJS, otherwise one scoped to this file via
 * `createRequire(import.meta.url)` under ESM. Returns undefined when neither
 * is available so callers fall back cleanly.
 */
function nodeRequire(): ((id: string) => unknown) | undefined {
  if (typeof require === "function") return require;
  try {
    return createRequire(import.meta.url) as (id: string) => unknown;
  } catch {
    return undefined;
  }
}
/**
 * Dependency-free token estimate (~4 chars per token). Returns 0 for empty
 * input so empty results never report phantom savings.
 */
export function estimateTokensFallback(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Attempt the optional tokenizer load exactly once; null on any miss. */
function loadTokenizerOnce(): Tokenizer | null {
  if (tokenizerAttempted) return tokenizer;
  tokenizerAttempted = true;
  try {
    const loader = nodeRequire();
    if (!loader) return null;
    const loaded = loader("@anthropic-ai/tokenizer") as { countTokens?: unknown };
    if (loaded && typeof loaded.countTokens === "function") {
      tokenizer = loaded as Tokenizer;
    }
  } catch {
    tokenizer = null;
  }
  return tokenizer;
}

/** Whether a real tokenizer (not the fallback) is backing measurements. */
export function isTokenizerAvailable(): boolean {
  return loadTokenizerOnce() !== null;
}

/**
 * Count tokens for `text`. Returns the fallback estimate when `enabled` is
 * false, when no tokenizer is installed, or when the tokenizer throws or
 * returns a non-finite or negative count.
 *
 * The optional third parameter is a test seam: when provided it replaces the
 * cached loader result for this call only (`null` forces the fallback, a
 * throwing or misbehaving tokenizer exercises the guards).
 */
export function countTokens(text: string, enabled = false, tokenizerForTest?: Tokenizer | null): number {
  if (!enabled) return estimateTokensFallback(text);
  const active = tokenizerForTest !== undefined ? tokenizerForTest : loadTokenizerOnce();
  if (!active?.countTokens) return estimateTokensFallback(text);
  try {
    const counted = active.countTokens(text);
    // Guard against non-finite or negative tokenizer output.
    if (typeof counted !== "number" || !Number.isFinite(counted) || counted < 0) {
      return estimateTokensFallback(text);
    }
    return Math.ceil(counted);
  } catch {
    return estimateTokensFallback(text);
  }
}
