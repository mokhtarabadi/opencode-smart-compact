import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_POINTER_CAP,
  capBackupPointers,
  createBackupPointer,
  readLatestBackupPointer,
  writeBackupPointer,
  type BackupPointer,
} from "../src/store.js";
import { formatBackupPointer } from "../src/actions.js";

test("backup pointer cap is 20 latest", () => {
  assert.equal(BACKUP_POINTER_CAP, 20);
  const many: BackupPointer[] = Array.from({ length: 25 }, (_, i) =>
    createBackupPointer("s1", [`o-${i}`], [], 0.5),
  );
  const capped = capBackupPointers(many);
  assert.equal(capped.length, 20);
  assert.equal(capped[19]!.omittedIds[0], "o-24");
});

test("createBackupPointer copies id arrays", () => {
  const omitted = ["omitted-0001"];
  const p = createBackupPointer("s9", omitted, ["m1"], 0.7);
  assert.equal(p.sessionId, "s9");
  assert.deepEqual(p.omittedIds, ["omitted-0001"]);
  assert.equal(p.budgetRatio, 0.7);
});

test("write then read returns matching ids with fake storage", async () => {
  const mem = new Map<string, unknown>();
  const ctx = {
    storage: {
      get: async (k: string) => mem.get(k) ?? undefined,
      set: async (k: string, v: unknown) => {
        mem.set(k, v);
      },
      remove: async (k: string) => {
        mem.delete(k);
      },
    },
  } as unknown as Parameters<typeof writeBackupPointer>[0];
  const written = await writeBackupPointer(ctx, "sess-1", ["omitted-0001"], ["msg-1"], 0.45);
  const latest = await readLatestBackupPointer(ctx, "sess-1");
  assert.equal(latest!.omittedIds[0], written.omittedIds[0]);
  assert.equal(latest!.sessionId, "sess-1");
});

test("formatBackupPointer renders session plus counts", () => {
  const p: BackupPointer = {
    sessionId: "sess-1",
    createdAtMs: Date.now(),
    omittedIds: ["omitted-0001", "omitted-0002"],
    summaryIds: ["m1"],
    budgetRatio: 0.45,
  };
  const text = formatBackupPointer(p);
  assert.match(text, /sess-1/);
  assert.match(text, /omissions 2/);
});

test("T2 malformed pointer storage returns null never throws", async () => {
  const mem = new Map<string, unknown>([
    ["backup:s-bad", ["oops", null, { sessionId: 42, createdAtMs: "x" }]],
  ]);
  const ctx = {
    storage: {
      get: async (k: string) => mem.get(k) ?? undefined,
      set: async (k: string, v: unknown) => {
        mem.set(k, v);
      },
      remove: async (k: string) => {
        mem.delete(k);
      },
    },
  } as unknown as Parameters<typeof writeBackupPointer>[0];
  const latest = await readLatestBackupPointer(ctx, "s-bad");
  assert.equal(latest, null);
});

test("T3 invalid formatter input falls back safely", () => {
  const bad = { sessionId: undefined, createdAtMs: NaN, omittedIds: undefined, summaryIds: undefined, budgetRatio: NaN } as unknown as BackupPointer;
  const text = formatBackupPointer(bad);
  assert.match(text, /unknown/);
  assert.match(text, /omissions 0/);
});

test("T4 25 storage writes cap to 20 latest", async () => {
  const mem = new Map<string, unknown>();
  const ctx = {
    storage: {
      get: async (k: string) => mem.get(k) ?? undefined,
      set: async (k: string, v: unknown) => {
        mem.set(k, v);
      },
      remove: async (k: string) => {
        mem.delete(k);
      },
    },
  } as unknown as Parameters<typeof writeBackupPointer>[0];
  for (let i = 0; i < 25; i += 1) {
    await writeBackupPointer(ctx, "s-cap", [`o-${i}`], [], 0.5);
  }
  const raw = (await ctx.storage.get("backup:s-cap") as unknown) as BackupPointer[];
  assert.equal(raw.length, 20);
  assert.equal(raw[19]!.omittedIds[0], "o-24");
});
