import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_OMISSION_RESPONSE_CHARS,
  boundOmissionResponse,
  migrateLegacyOmissions,
  omissionFilePath,
  readOmissionOriginal,
  sessionOmissionDir,
  writeOmissionOriginal,
} from "../src/omissions.js";
import type { OmissionRecord } from "../src/types.js";

// Every test file gets its own data root, so the suite never touches the
// developer's real omission store.
process.env.SMART_COMPACT_DATA_DIR = mkdtempSync(
  join(tmpdir(), "smart-compact-omissions-"),
);

function record(patch: Partial<OmissionRecord>): OmissionRecord {
  return { id: "omitted-0001", callId: "call-1", tokens: 10, ...patch };
}

test("writeOmissionOriginal stores the original outside session state", () => {
  const content = "original tool output";
  const path = writeOmissionOriginal("ses-store", "omitted-0001", content);
  assert.ok(path.startsWith(sessionOmissionDir("ses-store")));
  assert.equal(readFileSync(path, "utf8"), content);
  assert.equal(existsSync(path), true);
  // Two sessions never share a directory.
  assert.notEqual(
    sessionOmissionDir("ses-store"),
    sessionOmissionDir("ses-other"),
  );
});

test("readOmissionOriginal reads the file and fails closed when it is gone", () => {
  const path = writeOmissionOriginal("ses-read", "omitted-0002", "stored text");
  assert.equal(readOmissionOriginal(record({ path })), "stored text");
  // A record whose file was evicted (or a session restored elsewhere) returns
  // undefined so the tool can print the fail-closed notice.
  assert.equal(
    readOmissionOriginal(
      record({ path: join(sessionOmissionDir("ses-read"), "absent.txt") }),
    ),
    undefined,
  );
  assert.equal(readOmissionOriginal(record({})), undefined);
});

test("readOmissionOriginal still sees a legacy in-state original", () => {
  // Before migration, an old session carries the text inline; reading it must
  // work rather than pretending the original is gone.
  assert.equal(
    readOmissionOriginal(record({ content: "legacy text" })),
    "legacy text",
  );
});

test("the store cap evicts the oldest files first", () => {
  const session = "ses-evict-count";
  const limits = { maxFiles: 2, maxBytes: 10_000_000 };
  writeOmissionOriginal(session, "omitted-0001", "one", limits);
  writeOmissionOriginal(session, "omitted-0002", "two", limits);
  writeOmissionOriginal(session, "omitted-0003", "three", limits);
  const files = readdirSync(sessionOmissionDir(session))
    .filter((name) => name.endsWith(".txt"))
    .sort();
  assert.deepEqual(files, ["omitted-0002.txt", "omitted-0003.txt"]);
  assert.equal(existsSync(omissionFilePath(session, "omitted-0001")), false);
});

test("the store also caps total bytes", () => {
  const session = "ses-evict-bytes";
  const limits = { maxFiles: 100, maxBytes: 10 };
  writeOmissionOriginal(session, "omitted-0001", "aaaaaa", limits);
  writeOmissionOriginal(session, "omitted-0002", "bbbbbb", limits);
  // 12 bytes exceeds the 10-byte cap, so only the newest file survives.
  assert.equal(existsSync(omissionFilePath(session, "omitted-0001")), false);
  assert.equal(existsSync(omissionFilePath(session, "omitted-0002")), true);
});

test("a single original larger than the whole byte cap stays readable", () => {
  const session = "ses-evict-newest";
  const limits = { maxFiles: 10, maxBytes: 10 };
  const body = "0123456789abcdef"; // 16 bytes, larger than the cap on its own
  const written = writeOmissionOriginal(session, "omitted-0001", body, limits);
  // The newest file is the only copy of the freshest output: evicting it would
  // leave older files behind and lose the content the caller just produced.
  assert.equal(existsSync(written), true);
  assert.equal(readFileSync(written, "utf8"), body);
});

test("migrateLegacyOmissions moves inline originals to files", () => {
  const omissions: Record<string, OmissionRecord> = {
    "omitted-0001": {
      id: "omitted-0001",
      callId: "c1",
      name: "bash",
      tokens: 4,
      content: "legacy body",
    },
  };
  assert.equal(migrateLegacyOmissions("ses-migrate", omissions), true);
  const migrated = omissions["omitted-0001"]!;
  assert.equal(migrated.content, undefined);
  assert.equal(typeof migrated.path, "string");
  assert.equal(readFileSync(migrated.path!, "utf8"), "legacy body");
  // Migration is idempotent: a second load has nothing to move.
  assert.equal(migrateLegacyOmissions("ses-migrate", omissions), false);
});

test("a large original is truncated with an explicit notice", () => {
  const original = "q".repeat(MAX_OMISSION_RESPONSE_CHARS + 5000);
  const text = boundOmissionResponse("omitted-0007", original);
  assert.ok(text.length < original.length);
  assert.ok(text.startsWith("q".repeat(100)));
  assert.match(text, /TRUNCATED/);
  assert.match(text, /omitted-0007/);
  assert.match(text, new RegExp(String(MAX_OMISSION_RESPONSE_CHARS)));
  assert.match(text, new RegExp(String(original.length)));
  // A response that fits is returned untouched.
  assert.equal(boundOmissionResponse("omitted-0007", "short"), "short");
});
