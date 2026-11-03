import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadState, type Ctx } from "../src/store.js";

// Omission originals live on disk; keep every test inside a temp directory.
process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(join(tmpdir(), "smart-compact-store-"));

function fakeCtx(initial?: unknown): { ctx: Ctx; storage: Map<string, unknown> } {
  const storage = new Map<string, unknown>();
  if (initial !== undefined) storage.set("session:s1", initial);
  const ctx = {
    storage: {
      get: async (key: string) => storage.get(key),
      set: async (key: string, value: unknown) => void storage.set(key, value),
      remove: async (key: string) => void storage.delete(key),
      scan: async () => ({ entries: [] }),
    },
  } as unknown as Ctx;
  return { ctx, storage };
}

test("loadState migrates legacy in-state originals to files and saves the new shape", async () => {
  const { ctx, storage } = fakeCtx({
    summaries: {},
    omissions: {
      "omitted-0001": { id: "omitted-0001", callId: "c1", name: "bash", tokens: 5, content: "legacy body" },
    },
    omittedCalls: { c1: "omitted-0001" },
    stats: { prunedTokens: 5, summarizedTurns: 1, prunedParts: 1, savedTokens: 3, tokenizerUsed: true },
    nextOmissionId: 2,
    pruneMemo: { c1: { hash: "h", tokens: 5 } },
  });
  const state = await loadState(ctx, "s1");
  const record = state.omissions["omitted-0001"]!;
  assert.equal(record.content, undefined);
  assert.equal(typeof record.path, "string");
  assert.ok(existsSync(record.path!));
  assert.equal(readFileSync(record.path!, "utf8"), "legacy body");
  // P6: the memo is gone from state, and a legacy flag maps to the path name.
  assert.equal("pruneMemo" in state, false);
  assert.equal("savedTokens" in state.stats, false);
  assert.equal(state.stats.measurementPath, "tokenizer");
  // The migration is persisted, so the next load carries no inline original.
  const saved = storage.get("session:s1") as {
    omissions: Record<string, { content?: string; path?: string }>;
    pruneMemo?: unknown;
  };
  assert.equal(saved.omissions["omitted-0001"]!.content, undefined);
  assert.equal(typeof saved.omissions["omitted-0001"]!.path, "string");
  assert.equal("pruneMemo" in saved, false);
});

test("loadState keeps the configured-window source and drops malformed values", async () => {
  const { ctx } = fakeCtx({
    summaries: {},
    omissions: {},
    omittedCalls: {},
    stats: {},
    nextOmissionId: 1,
    awarenessWindow: 200_000,
    awarenessWindowSource: "config",
  });
  const configured = await loadState(ctx, "s1");
  assert.equal(configured.awarenessWindow, 200_000);
  assert.equal(configured.awarenessWindowSource, "config");

  const broken = fakeCtx({
    summaries: {},
    omissions: {},
    omittedCalls: {},
    stats: {},
    nextOmissionId: 1,
    awarenessWindow: Number.NaN,
    awarenessWindowSource: "nonsense",
  });
  const state = await loadState(broken.ctx, "s1");
  assert.equal(state.awarenessWindow, undefined);
  assert.equal(state.awarenessWindowSource, undefined);
});
